import React, { useState } from 'react';
import {
  X,
  Share2,
  Copy,
  Check,
  Download,
  ExternalLink,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { formatPlateForDisplay } from '../utils/plateNormalizer';
import { dataUrlToFile, openWhatsAppShare } from '../utils/shareService';

export interface ShareDataField {
  label: string;
  value: string | number | undefined | null;
}

export interface SharePhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  photoUrl?: string | null;
  plate: string;
  title?: string;
  dataFields?: ShareDataField[];
  customMessage?: string;
}

export const SharePhotoModal: React.FC<SharePhotoModalProps> = ({
  isOpen,
  onClose,
  photoUrl,
  plate,
  title = 'Registro de Veículo',
  dataFields = [],
  customMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);
  const [isPhotoExpanded, setIsPhotoExpanded] = useState(false);

  if (!isOpen) return null;

  const cleanPlate = plate ? plate.toUpperCase().replace(/[^A-Z0-9]/g, '') : 'VEICULO';
  const displayPlate = formatPlateForDisplay(cleanPlate);

  // Build formatted text message
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR');
  const timeStr = now.toLocaleTimeString('pt-BR');

  let formattedText = customMessage;
  if (!formattedText) {
    const lines: string[] = [
      `📸 *${title.toUpperCase()} - CMDIT*`,
      `🚗 *Placa:* ${displayPlate}`,
    ];

    dataFields.forEach((field) => {
      if (field.value !== undefined && field.value !== null && String(field.value).trim() !== '') {
        lines.push(`• *${field.label}:* ${String(field.value).trim()}`);
      }
    });

    lines.push(`📅 *Data:* ${dateStr} às ${timeStr}`);
    lines.push(`_Sistema de Gestão de Pátio CMDIT_`);
    formattedText = lines.join('\n');
  }

  const getShareFile = async (): Promise<File | null> => {
    if (!photoUrl) return null;
    try {
      const filename = `${title.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${cleanPlate}_${Date.now()}.jpg`;
      if (photoUrl.startsWith('data:')) {
        return dataUrlToFile(photoUrl, filename);
      }
      // If remote or blob URL
      const resp = await fetch(photoUrl);
      const blob = await resp.blob();
      return new File([blob], filename, { type: blob.type || 'image/jpeg' });
    } catch (e) {
      console.warn('Erro ao converter foto para arquivo:', e);
      return null;
    }
  };

  const handleShareWhatsApp = async () => {
    setSharing(true);
    setFeedback(null);
    try {
      const file = await getShareFile();

      // Check if browser/Android supports sharing files via Web Share API
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            files: [file],
            text: formattedText,
            title: `${title} - ${displayPlate}`,
          });
          setFeedback({ type: 'success', text: 'Compartilhado com sucesso!' });
          return;
        } catch (err: any) {
          if (err.name === 'AbortError') {
            setFeedback({ type: 'info', text: 'Compartilhamento cancelado.' });
            return;
          }
        }
      }

      // Fallback: If desktop or browser without file sharing support
      if (file) {
        // Trigger auto-download of the stamped photo so user can easily attach it
        try {
          const downloadUrl = URL.createObjectURL(file);
          const a = document.createElement('a');
          a.href = downloadUrl;
          a.download = file.name;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(downloadUrl);
        } catch {}
      }

      // Open WhatsApp with formatted text
      openWhatsAppShare(formattedText || '');
      setFeedback({
        type: 'success',
        text: file
          ? 'WhatsApp aberto e foto baixada! Basta anexar a foto e enviar.'
          : 'WhatsApp aberto com os dados formatados!',
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err.message || 'Erro ao compartilhar.' });
    } finally {
      setSharing(false);
    }
  };

  const handleShareNative = async () => {
    setSharing(true);
    setFeedback(null);
    try {
      const file = await getShareFile();
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          text: formattedText,
          title: `${title} - ${displayPlate}`,
        });
        setFeedback({ type: 'success', text: 'Compartilhado com sucesso!' });
      } else if (navigator.share) {
        await navigator.share({
          text: formattedText,
          title: `${title} - ${displayPlate}`,
        });
        setFeedback({ type: 'success', text: 'Texto compartilhado com sucesso!' });
      } else {
        handleCopyText();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setFeedback({ type: 'error', text: 'Não foi possível acionar o compartilhamento do aparelho.' });
      }
    } finally {
      setSharing(false);
    }
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedText || '');
      setCopied(true);
      setFeedback({ type: 'success', text: 'Texto dos dados copiado para a área de transferência!' });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      setFeedback({ type: 'error', text: 'Falha ao copiar texto.' });
    }
  };

  const handleDownloadPhoto = async () => {
    if (!photoUrl) return;
    try {
      const file = await getShareFile();
      if (!file) return;
      const downloadUrl = URL.createObjectURL(file);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      setFeedback({ type: 'success', text: 'Foto baixada com sucesso!' });
    } catch {
      setFeedback({ type: 'error', text: 'Erro ao baixar foto.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-emerald-900 text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
              <Share2 className="w-5 h-5 text-emerald-300" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Compartilhar Foto e Dados</h3>
              <p className="text-xs text-emerald-200">{title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Scrollable Area */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-neutral-800">
          {/* Photo Preview */}
          {photoUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-950 group">
              <img
                src={photoUrl}
                alt={`Veículo placa ${displayPlate}`}
                className="w-full h-44 object-cover cursor-pointer hover:opacity-95 transition"
                onClick={() => setIsPhotoExpanded(true)}
              />
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-xs px-2.5 py-1 rounded-md text-[11px] font-bold text-white flex items-center gap-1.5 border border-white/20">
                <Camera className="w-3.5 h-3.5 text-emerald-400" />
                <span>Foto Registrada</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPhotoExpanded(true)}
                className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/90 backdrop-blur-xs text-white text-xs font-semibold px-2.5 py-1 rounded-lg border border-white/20 transition cursor-pointer"
              >
                Ampliar Foto
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-xl border border-dashed border-neutral-300 bg-neutral-50 text-center flex flex-col items-center gap-1">
              <ImageIcon className="w-8 h-8 text-neutral-400" />
              <p className="text-xs text-neutral-500 font-medium">Nenhuma foto anexada a este registro</p>
            </div>
          )}

          {/* Vehicle & Plate Card */}
          <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-200 flex flex-col gap-2">
            <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Placa do Veículo</span>
              <span className="text-lg font-mono font-black text-neutral-900 bg-white px-2.5 py-0.5 rounded-md border border-neutral-300 shadow-xs">
                {displayPlate}
              </span>
            </div>

            {/* List of Details */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-1">
              {dataFields.map((f, idx) => (
                <div key={idx} className="flex flex-col bg-white p-2 rounded-lg border border-neutral-100">
                  <span className="text-[10px] uppercase font-bold text-neutral-400">{f.label}</span>
                  <span className="font-semibold text-neutral-800 truncate">{String(f.value || '-')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* WhatsApp Text Preview */}
          <div className="bg-neutral-900 text-neutral-100 rounded-xl p-3 border border-neutral-800 text-xs">
            <div className="text-[10px] uppercase font-bold text-emerald-400 mb-1 flex items-center gap-1">
              <Share2 className="w-3 h-3" />
              <span>Mensagem do WhatsApp (enviada com a foto):</span>
            </div>
            <pre className="font-sans whitespace-pre-line text-neutral-200 text-xs leading-relaxed select-all">
              {formattedText}
            </pre>
          </div>

          {/* Feedback notification if any */}
          {feedback && (
            <div
              className={`p-3 rounded-xl text-xs font-semibold flex items-start gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  : feedback.type === 'info'
                  ? 'bg-sky-50 text-sky-900 border border-sky-200'
                  : 'bg-rose-50 text-rose-900 border border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-1">
            {/* WhatsApp Primary */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={sharing}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white shadow-md active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Share2 className="w-4 h-4" />
              <span>{photoUrl ? 'Compartilhar no WhatsApp (Foto + Dados)' : 'Compartilhar no WhatsApp'}</span>
            </button>

            {/* Native Share button */}
            <button
              type="button"
              onClick={handleShareNative}
              disabled={sharing}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Compartilhar via Outros Aplicativos (Android / iOS)</span>
            </button>

            {/* Download and Copy Secondary buttons */}
            <div className="grid grid-cols-2 gap-2 mt-1">
              {photoUrl && (
                <button
                  type="button"
                  onClick={handleDownloadPhoto}
                  className="py-2 px-3 rounded-lg text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar Foto</span>
                </button>
              )}

              <button
                type="button"
                onClick={handleCopyText}
                className={`py-2 px-3 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  !photoUrl ? 'col-span-2' : ''
                } ${
                  copied
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-700" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Photo Lightbox */}
      {isPhotoExpanded && photoUrl && (
        <div
          onClick={() => setIsPhotoExpanded(false)}
          className="fixed inset-0 z-60 bg-black/95 flex flex-col items-center justify-center p-4 backdrop-blur-md"
        >
          <div className="relative max-w-4xl max-h-[85vh] w-full flex flex-col items-center justify-center">
            <img
              src={photoUrl}
              alt={`Foto da Placa ${displayPlate}`}
              className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-2xl border border-white/20"
            />
            <p className="text-white text-xs font-semibold mt-4 bg-neutral-900/80 border border-neutral-700 px-4 py-2 rounded-full cursor-pointer">
              Toque em qualquer lugar para fechar
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
