import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Download, Maximize2, Minimize2, QrCode as QrIcon } from 'lucide-react';

interface QRCodeDisplayProps {
  data: string;
  title?: string;
  subtitle?: string;
  size?: number;
  badge?: string;
  onScanAnother?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  data,
  title = 'Scan to Connect',
  subtitle = 'Point the peer camera at this QR code',
  size = 240,
  badge = 'P2P Session QR',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !data) return;

    QRCode.toCanvas(
      canvasRef.current,
      data,
      {
        width: isFullscreen ? Math.min(window.innerWidth * 0.7, 400) : size,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      },
      (err) => {
        if (err) {
          console.error('QR code generation error:', err);
        }
      }
    );
  }, [data, size, isFullscreen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Failed to copy', e);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.download = `p2p-session-qr-${Date.now()}.png`;
    a.href = url;
    a.click();
  };

  return (
    <div
      id="qr-code-card"
      className="flex flex-col items-center bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg text-slate-100"
    >
      <div className="flex items-center justify-between w-full mb-3">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
            <QrIcon size={18} />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-950/60 px-2.5 py-1 rounded-full border border-blue-800/40">
            {badge}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            id="qr-fullscreen-btn"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
            title={isFullscreen ? 'Minimize' : 'Enlarge QR'}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            id="qr-download-btn"
            onClick={handleDownload}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-md transition-colors"
            title="Download QR Image"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <div className="bg-white p-3.5 rounded-xl shadow-inner border-2 border-slate-700/50 my-2">
        <canvas ref={canvasRef} className="rounded" />
      </div>

      <div className="text-center mt-3 mb-4">
        <h4 className="text-sm font-semibold text-slate-100">{title}</h4>
        <p className="text-xs text-slate-400 mt-0.5 max-w-xs">{subtitle}</p>
      </div>

      <div className="w-full flex items-center gap-2">
        <button
          id="qr-copy-raw-btn"
          onClick={handleCopy}
          className="flex-1 flex items-center justify-center space-x-2 py-2 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-all shadow-sm"
        >
          {copied ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span className="text-emerald-400">Copied Raw Code</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy Signaling Code</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
