import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  RotateCcw,
  Zap,
  ZapOff,
  X,
  FileText,
  Check,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';
import { stampDateTimeOnCanvas, compressAndStampImage } from '../utils/imageOptimizer';

interface DocumentCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPhotoCaptured: (dataUrl: string) => void;
  title?: string;
}

export const DocumentCameraModal: React.FC<DocumentCameraModalProps> = ({
  isOpen,
  onClose,
  onPhotoCaptured,
  title = 'Foto do Documento (CRLV / Doc)',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Start Camera Stream
  useEffect(() => {
    if (!isOpen) return;

    let currentStream: MediaStream | null = null;

    async function startCamera() {
      setIsLoadingCamera(true);
      setCameraError(null);

      // Stop previous stream
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      try {
        // Optimized resolution to guarantee ZERO memory spike (1280x720 / 720p HD is crystal clear for CRLV text)
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        currentStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(() => {});
        }

        // Check torch capability
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.warn('Document camera access error:', err);
        setCameraError(
          'Não foi possível abrir a câmera direta do navegador. Você pode anexar uma foto da galeria ou arquivo usando o botão abaixo.'
        );
      } finally {
        setIsLoadingCamera(false);
      }
    }

    startCamera();

    return () => {
      if (currentStream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [isOpen, facingMode]);

  // Clean up when closing modal
  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      setStream(null);
    }
    onClose();
  };

  // Toggle Torch/Flash
  const handleToggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      const newTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorch }],
      });
      setIsTorchOn(newTorch);
    } catch (e) {
      console.warn('Torch toggle error:', e);
    }
  };

  // Switch between front/back cameras
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture Photo Directly from Video Stream
  const handleCapture = () => {
    if (!videoRef.current || isProcessing) return;

    try {
      setIsProcessing(true);
      const video = videoRef.current;
      const width = video.videoWidth || 1280;
      const height = video.videoHeight || 720;

      // Target max 1280 to prevent excessive memory
      let targetW = width;
      let targetH = height;
      const maxDim = 1280;

      if (width > maxDim || height > maxDim) {
        if (width >= height) {
          targetW = maxDim;
          targetH = Math.max(1, Math.round((height * maxDim) / width));
        } else {
          targetH = maxDim;
          targetW = Math.max(1, Math.round((width * maxDim) / height));
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d', { alpha: false });

      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(video, 0, 0, targetW, targetH);

      // Stamp legible date & time badge
      stampDateTimeOnCanvas(ctx, targetW, targetH, new Date());

      // Generate ultra-optimized lightweight JPEG (approx 80-120KB)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

      // Clean up canvas memory immediately
      canvas.width = 1;
      canvas.height = 1;

      // Stop camera stream immediately to free memory
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        setStream(null);
      }

      onPhotoCaptured(dataUrl);
      handleClose();
    } catch (err) {
      console.warn('Erro ao capturar foto do documento:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle fallback file upload
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setIsProcessing(true);
    try {
      // Memory-safe compression
      const stampedUrl = await compressAndStampImage(file, {
        maxDimension: 1200,
        quality: 0.80,
        stampDate: true,
      });

      if (stampedUrl) {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
          setStream(null);
        }
        onPhotoCaptured(stampedUrl);
        handleClose();
      }
    } catch (err) {
      console.warn('Erro ao processar arquivo de documento:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col justify-between select-none animate-in fade-in duration-200">
      {/* Hidden File Input for gallery/file backup */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Bar */}
      <div className="p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center justify-between text-white z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-600 rounded-lg text-white">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-black leading-tight text-white">{title}</h2>
            <p className="text-[11px] text-neutral-300">Posicione o documento no quadro central</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              type="button"
              onClick={handleToggleTorch}
              className={`p-2.5 rounded-full backdrop-blur-md transition ${
                isTorchOn ? 'bg-amber-400 text-neutral-900' : 'bg-white/20 text-white hover:bg-white/30'
              }`}
              title="Luz / Lanterna"
            >
              {isTorchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            type="button"
            onClick={handleSwitchCamera}
            className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition cursor-pointer"
            title="Alternar Câmera"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            type="button"
            onClick={handleClose}
            className="p-2.5 rounded-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-md transition cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Camera Viewport & Document Framing Guide */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden bg-neutral-950">
        {isLoadingCamera && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white z-20">
            <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-bold tracking-wider uppercase text-neutral-300">
              Iniciando câmera de documento...
            </span>
          </div>
        )}

        {cameraError ? (
          <div className="p-6 max-w-sm text-center flex flex-col items-center gap-3 text-white z-20">
            <div className="p-3 bg-rose-500/20 text-rose-400 rounded-full border border-rose-500/40">
              <AlertCircle className="w-8 h-8" />
            </div>
            <p className="text-xs text-neutral-300 leading-relaxed">{cameraError}</p>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-2 py-2.5 px-5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl flex items-center gap-2 transition cursor-pointer"
            >
              <ImageIcon className="w-4 h-4" />
              <span>Escolher da Galeria / Arquivos</span>
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Document Guide Reticle / Mask */}
            <div className="relative z-10 w-[88%] max-w-md aspect-[3/2] border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] pointer-events-none flex flex-col justify-between p-3.5">
              {/* Corner Accents */}
              <div className="flex justify-between">
                <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              </div>

              <div className="flex items-center justify-center">
                <span className="bg-black/70 backdrop-blur-xs text-emerald-300 text-[10px] font-bold px-3 py-1 rounded-full border border-emerald-500/40 shadow-sm uppercase tracking-wider">
                  Enquadre o Documento / CRLV
                </span>
              </div>

              <div className="flex justify-between">
                <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Bar: Action Controls */}
      <div className="p-5 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex flex-col items-center gap-3 z-10 shrink-0">
        <div className="w-full flex items-center justify-between max-w-md px-4">
          {/* Gallery Fallback Button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isProcessing}
            className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition cursor-pointer"
          >
            <div className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md">
              <ImageIcon className="w-5 h-5 text-emerald-400" />
            </div>
            <span className="text-[10px] font-bold">Galeria</span>
          </button>

          {/* Main Shutter / Capture Button */}
          <button
            type="button"
            onClick={handleCapture}
            disabled={isLoadingCamera || Boolean(cameraError) || isProcessing}
            className={`w-18 h-18 rounded-full border-4 border-white flex items-center justify-center transition active:scale-95 shadow-2xl ${
              isLoadingCamera || cameraError || isProcessing
                ? 'opacity-40 cursor-not-allowed bg-neutral-600'
                : 'bg-emerald-500 hover:bg-emerald-400 cursor-pointer ring-4 ring-emerald-500/40'
            }`}
            title="Tirar Foto do Documento"
          >
            {isProcessing ? (
              <div className="w-7 h-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-white flex items-center justify-center text-emerald-700 shadow-inner">
                <Camera className="w-7 h-7" />
              </div>
            )}
          </button>

          {/* Close / Cancel Button */}
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="flex flex-col items-center gap-1 text-white/80 hover:text-white transition cursor-pointer"
          >
            <div className="p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md">
              <X className="w-5 h-5 text-neutral-300" />
            </div>
            <span className="text-[10px] font-bold">Cancelar</span>
          </button>
        </div>

        <span className="text-[10px] text-neutral-400 font-medium">
          Foto otimizada automaticamente com proteção contra falta de memória
        </span>
      </div>
    </div>
  );
};
