import React, { useEffect, useRef, useState } from 'react';
import { Camera, Image as ImageIcon, RefreshCw, Zap, ZapOff, Sparkles, AlertCircle } from 'lucide-react';

interface CameraViewProps {
  onPhotoCaptured: (dataUrl: string) => void;
  onCancel: () => void;
}

export const CameraView: React.FC<CameraViewProps> = ({ onPhotoCaptured, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isLoadingCamera, setIsLoadingCamera] = useState<boolean>(true);

  // Start Camera Stream
  useEffect(() => {
    let currentStream: MediaStream | null = null;

    async function startCamera() {
      setIsLoadingCamera(true);
      setCameraError(null);

      // Stop previous stream if any
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }

      try {
        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
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

        // Check torch support
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch (err: any) {
        console.warn('Camera access error:', err);
        setCameraError(
          'Não foi possível acessar a câmera automaticamente. Você pode usar a galeria ou tirar foto pelo seletor padrão abaixo.'
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
  }, [facingMode]);

  // Toggle Torch/Flashlight
  const handleToggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      const newTorch = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: newTorch }],
      });
      setIsTorchOn(newTorch);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  // Switch between front and back camera
  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Capture frame from video
  const handleCapture = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

    // Stop camera
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    onPhotoCaptured(dataUrl);
  };

  // Handle native file input / camera fallback
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        if (stream) {
          stream.getTracks().forEach((t) => t.stop());
        }
        onPhotoCaptured(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Pre-made sample photo generator for testing without real car nearby
  const handleUseSamplePhoto = (sampleType: 'mercosul' | 'old' | 'revenda') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background car bumper / pavement
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, 1200, 800);

    // Car Body Grill / Bumper
    const grad = ctx.createLinearGradient(0, 100, 0, 700);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#334155');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
    ctx.roundRect(100, 150, 1000, 500, [40, 40, 20, 20]);
    ctx.fill();

    // Car plate background (White with black border)
    const plateX = 350;
    const plateY = 320;
    const plateW = 500;
    const plateH = 200;

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.roundRect(plateX, plateY, plateW, plateH, 16);
    ctx.fill();
    ctx.stroke();

    let plateText = 'ABC1D23';
    let isMerc = true;

    if (sampleType === 'old') {
      plateText = 'ABC1234';
      isMerc = false;
      // Old Brazilian plate: State header
      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SP - SAO PAULO', plateX + plateW / 2, plateY + 40);
    } else if (sampleType === 'revenda') {
      plateText = 'BRA2E19';
      isMerc = true;
    }

    if (isMerc) {
      // Blue top band for Mercosul
      ctx.fillStyle = '#003399';
      ctx.beginPath();
      ctx.roundRect(plateX + 5, plateY + 5, plateW - 10, 50, [12, 12, 0, 0]);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('BRASIL', plateX + plateW / 2, plateY + 38);
    }

    // Plate Characters (Large black centered)
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 84px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(plateText, plateX + plateW / 2, plateY + (isMerc ? 130 : 120));

    const sampleDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    onPhotoCaptured(sampleDataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      {/* Hidden elements */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Controls Overlay */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <button
          onClick={onCancel}
          className="px-3.5 py-1.5 rounded-full bg-black/60 text-white/90 text-sm font-semibold backdrop-blur-md active:scale-95 transition"
        >
          Cancelar
        </button>

        <div className="flex items-center gap-2">
          {hasTorch && (
            <button
              onClick={handleToggleTorch}
              className={`p-2.5 rounded-full backdrop-blur-md transition ${
                isTorchOn ? 'bg-amber-400 text-black' : 'bg-black/60 text-white'
              }`}
            >
              {isTorchOn ? <Zap className="w-5 h-5" /> : <ZapOff className="w-5 h-5" />}
            </button>
          )}

          <button
            onClick={handleSwitchCamera}
            className="p-2.5 rounded-full bg-black/60 text-white backdrop-blur-md active:rotate-180 transition duration-300"
            title="Alternar Câmera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Viewfinder Main Video Area */}
      <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden">
        {isLoadingCamera && (
          <div className="absolute z-10 flex flex-col items-center gap-3 text-emerald-400">
            <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-emerald-200">Abrindo câmera...</p>
          </div>
        )}

        {cameraError ? (
          <div className="p-6 text-center max-w-sm mx-auto text-neutral-300 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <p className="text-sm font-medium mb-4">{cameraError}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
            >
              <Camera className="w-5 h-5" />
              Abrir Câmera do Sistema / Galeria
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />

            {/* License Plate Targeting Frame (Reticle Overlay) */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
              {/* Dimmed background masks */}
              <div className="w-[85%] max-w-sm h-36 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-300 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-300 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-300 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-300 rounded-br-lg" />

                {/* Center scan line animation */}
                <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-0.5 bg-emerald-400/60 shadow-[0_0_8px_#34d399]" />

                <div className="absolute -bottom-8 inset-x-0 text-center">
                  <span className="text-[12px] font-semibold tracking-wide bg-emerald-950/80 text-emerald-200 px-3 py-1 rounded-full border border-emerald-500/40">
                    Posicione a placa do veículo aqui
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-3 pb-8">
        {/* Sample vehicle options for instant testing / dev preview */}
        <div className="flex items-center justify-center gap-2 overflow-x-auto py-1">
          <span className="text-[11px] text-neutral-400 font-medium">Testar com foto:</span>
          <button
            onClick={() => handleUseSamplePhoto('mercosul')}
            className="text-[11px] bg-emerald-950/80 border border-emerald-700 text-emerald-300 px-2.5 py-1 rounded-lg active:scale-95 flex items-center gap-1 font-semibold"
          >
            <Sparkles className="w-3 h-3" /> Mercosul (ABC1D23)
          </button>
          <button
            onClick={() => handleUseSamplePhoto('old')}
            className="text-[11px] bg-neutral-800 border border-neutral-700 text-neutral-300 px-2.5 py-1 rounded-lg active:scale-95 flex items-center gap-1 font-semibold"
          >
            Antiga (ABC1234)
          </button>
        </div>

        {/* Shutter Button & Gallery fallback */}
        <div className="flex items-center justify-around max-w-sm mx-auto w-full pt-1">
          {/* Gallery Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center active:scale-90 transition shadow-md border border-neutral-700"
            title="Escolher da Galeria"
          >
            <ImageIcon className="w-6 h-6" />
          </button>

          {/* Main Big Shutter Button */}
          <button
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-4 border-emerald-400 p-1 flex items-center justify-center active:scale-95 transition shadow-[0_0_20px_rgba(16,185,129,0.5)]"
          >
            <div className="w-full h-full rounded-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 transition flex items-center justify-center">
              <Camera className="w-8 h-8 text-emerald-950" />
            </div>
          </button>

          {/* Cancel button */}
          <button
            onClick={onCancel}
            className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center active:scale-90 transition shadow-md border border-neutral-700 text-xs font-bold"
          >
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
};
