import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Image as ImageIcon,
  RefreshCw,
  Zap,
  ZapOff,
  Sparkles,
  AlertCircle,
  Gauge,
  Fuel,
  ArrowLeft,
  SkipForward,
} from 'lucide-react';

interface DashboardCameraViewProps {
  plate: string;
  onPhotoCaptured: (dataUrl: string) => void;
  onSkip: () => void;
  onBack: () => void;
}

export const DashboardCameraView: React.FC<DashboardCameraViewProps> = ({
  plate,
  onPhotoCaptured,
  onSkip,
  onBack,
}) => {
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
          'Não foi possível acessar a câmera do painel. Você pode usar a galeria ou continuar preenchendo manualmente.'
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

  const handleSwitchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

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

    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    onPhotoCaptured(dataUrl);
  };

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

  // Generate realistic Dashboard sample photo for testing
  const handleUseSampleDashboard = (type: 'full' | 'half' | 'low') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark vehicle cockpit background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, 1200, 800);

    // Instrument Cluster Housing
    const clusterGrad = ctx.createLinearGradient(0, 100, 0, 700);
    clusterGrad.addColorStop(0, '#1e293b');
    clusterGrad.addColorStop(0.5, '#0f172a');
    clusterGrad.addColorStop(1, '#020617');
    ctx.fillStyle = clusterGrad;
    ctx.roundRect(100, 120, 1000, 560, [40, 40, 30, 30]);
    ctx.fill();
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Speedometer Dial (Left)
    ctx.beginPath();
    ctx.arc(360, 400, 180, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1120';
    ctx.fill();
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('km/h', 360, 470);
    ctx.font = 'bold 72px monospace';
    ctx.fillText('0', 360, 400);

    // Tachometer / Info Dial (Right)
    ctx.beginPath();
    ctx.arc(840, 400, 180, 0, Math.PI * 2);
    ctx.fillStyle = '#0b1120';
    ctx.fill();
    ctx.strokeStyle = '#059669';
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('COMBUSTÍVEL', 840, 340);

    let fuelText = '8/8 • 100%';
    let fuelKm = '48.350 km';
    let fuelLevelColor = '#10b981';

    if (type === 'half') {
      fuelText = '4/8 • 50%';
      fuelKm = '72.190 km';
      fuelLevelColor = '#f59e0b';
    } else if (type === 'low') {
      fuelText = '2/8 • 25%';
      fuelKm = '115.420 km';
      fuelLevelColor = '#ef4444';
    }

    ctx.fillStyle = fuelLevelColor;
    ctx.font = 'bold 56px monospace';
    ctx.fillText(fuelText, 840, 420);

    // Center Display / Odometer Screen
    ctx.fillStyle = '#030712';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(500, 320, 200, 180, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('ODÔMETRO', 600, 360);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 32px monospace';
    ctx.fillText(fuelKm, 600, 420);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px sans-serif';
    ctx.fillText(`PLACA: ${plate}`, 600, 470);

    const sampleDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    onPhotoCaptured(sampleDataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col justify-between select-none">
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Top Header Overlay */}
      <div className="absolute top-0 inset-x-0 z-20 flex items-center justify-between p-4 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
        <button
          onClick={onBack}
          className="px-3.5 py-1.5 rounded-full bg-black/60 text-white/90 text-sm font-semibold backdrop-blur-md active:scale-95 transition flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400 bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-0.5 rounded-full">
            Foto 2/2 • Painel
          </span>
          <span className="text-[10px] font-mono text-white/80 font-bold mt-0.5">{plate}</span>
        </div>

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

      {/* Viewfinder Video Area */}
      <div className="relative flex-1 bg-neutral-950 flex items-center justify-center overflow-hidden">
        {isLoadingCamera && (
          <div className="absolute z-10 flex flex-col items-center gap-3 text-cyan-400">
            <div className="w-10 h-10 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-cyan-200">Abrindo câmera do painel...</p>
          </div>
        )}

        {cameraError ? (
          <div className="p-6 text-center max-w-sm mx-auto text-neutral-300 flex flex-col items-center">
            <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
            <p className="text-sm font-medium mb-4">{cameraError}</p>
            <div className="flex flex-col gap-2 w-full">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg"
              >
                <Camera className="w-5 h-5" />
                Usar Câmera do Sistema / Galeria
              </button>
              <button
                onClick={onSkip}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <SkipForward className="w-4 h-4" />
                Pular Foto e Preencher Manualmente
              </button>
            </div>
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

            {/* Dashboard Targeting Reticle Frame */}
            <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center px-4">
              <div className="w-full max-w-sm h-52 border-2 border-cyan-400/90 rounded-3xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)] flex flex-col justify-between p-3">
                {/* Corner Accents */}
                <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-cyan-300 rounded-tl-xl" />
                <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-cyan-300 rounded-tr-xl" />
                <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-cyan-300 rounded-bl-xl" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-cyan-300 rounded-br-xl" />

                {/* Reticle Top Icons */}
                <div className="flex items-center justify-between text-cyan-300/80 text-[11px] font-bold">
                  <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                    <Gauge className="w-3.5 h-3.5" />
                    <span>Odômetro (KM)</span>
                  </div>
                  <div className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-lg backdrop-blur-sm">
                    <Fuel className="w-3.5 h-3.5" />
                    <span>Combustível</span>
                  </div>
                </div>

                {/* Center scan line */}
                <div className="w-full h-0.5 bg-cyan-400/50 shadow-[0_0_10px_#22d3ee]" />

                {/* Helper hint */}
                <div className="text-center">
                  <span className="text-[11px] font-bold tracking-wide bg-cyan-950/90 text-cyan-200 px-3 py-1 rounded-full border border-cyan-500/50 shadow-md">
                    Enquadre o odômetro e marcador de combustível
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="p-4 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col gap-3 pb-8">
        {/* Sample Dashboard buttons for quick testing */}
        <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs">
          <span className="text-[11px] text-neutral-400 font-medium whitespace-nowrap">Testar painel:</span>
          <button
            onClick={() => handleUseSampleDashboard('full')}
            className="text-[11px] bg-cyan-950/80 border border-cyan-700 text-cyan-300 px-2.5 py-1 rounded-lg active:scale-95 flex items-center gap-1 font-semibold whitespace-nowrap"
          >
            <Sparkles className="w-3 h-3" /> Tanque Cheio (48k km)
          </button>
          <button
            onClick={() => handleUseSampleDashboard('half')}
            className="text-[11px] bg-amber-950/80 border border-amber-700 text-amber-300 px-2.5 py-1 rounded-lg active:scale-95 flex items-center gap-1 font-semibold whitespace-nowrap"
          >
            ⛽ 1/2 Tanque (72k km)
          </button>
          <button
            onClick={() => handleUseSampleDashboard('low')}
            className="text-[11px] bg-rose-950/80 border border-rose-700 text-rose-300 px-2.5 py-1 rounded-lg active:scale-95 flex items-center gap-1 font-semibold whitespace-nowrap"
          >
            ⚠️ Reserva (115k km)
          </button>
        </div>

        {/* Shutter Button & Controls */}
        <div className="flex items-center justify-around max-w-sm mx-auto w-full pt-1">
          {/* Gallery Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-200 flex items-center justify-center active:scale-90 transition shadow-md border border-neutral-700"
            title="Escolher da Galeria"
          >
            <ImageIcon className="w-6 h-6" />
          </button>

          {/* Main Shutter */}
          <button
            onClick={handleCapture}
            className="w-20 h-20 rounded-full border-4 border-cyan-400 p-1 flex items-center justify-center active:scale-95 transition shadow-[0_0_20px_rgba(6,182,212,0.5)]"
          >
            <div className="w-full h-full rounded-full bg-cyan-500 hover:bg-cyan-400 active:bg-cyan-600 transition flex items-center justify-center">
              <Camera className="w-8 h-8 text-cyan-950" />
            </div>
          </button>

          {/* Skip Button */}
          <button
            onClick={onSkip}
            className="w-12 h-12 rounded-full bg-neutral-800 text-neutral-200 flex flex-col items-center justify-center active:scale-90 transition shadow-md border border-neutral-700"
            title="Pular foto e preencher manual"
          >
            <SkipForward className="w-4 h-4 text-cyan-400" />
            <span className="text-[9px] font-bold text-neutral-300 mt-0.5">Pular</span>
          </button>
        </div>
      </div>
    </div>
  );
};
