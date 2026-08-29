import React, { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, X, RefreshCw, Zap, Clipboard, AlertCircle, CheckCircle2 } from 'lucide-react';
import confetti from 'canvas-confetti';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (data: string) => void;
  title?: string;
  expectedType?: 'OFFER' | 'ANSWER' | 'ANY';
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Scan Peer QR Code',
  expectedType = 'ANY',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const requestRef = useRef<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    setScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser or iframe context.');
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startScanLoop();
      }
    } catch (err: any) {
      console.warn('Camera start error:', err);
      setCameraError(err?.message || 'Could not access camera. Please check permissions or paste code below.');
    }
  };

  const stopCamera = () => {
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setScanning(false);
  };

  const startScanLoop = () => {
    const scan = () => {
      if (!videoRef.current || !canvasRef.current) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && code.data.trim().length > 0) {
          handleFoundCode(code.data);
          return;
        }
      }

      requestRef.current = requestAnimationFrame(scan);
    };

    requestRef.current = requestAnimationFrame(scan);
  };

  const handleFoundCode = (scannedData: string) => {
    stopCamera();
    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch (e) {
      // ignore
    }
    onScanSuccess(scannedData);
    onClose();
  };

  const handlePasteManual = () => {
    setManualError(null);
    if (!manualCode.trim()) {
      setManualError('Please paste a valid signaling string or token');
      return;
    }
    try {
      handleFoundCode(manualCode.trim());
    } catch (err: any) {
      setManualError('Invalid code payload');
    }
  };

  const handleReadClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setManualCode(text);
      }
    } catch (e) {
      setManualError('Clipboard access blocked. Please paste manually into the box.');
    }
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch (e) {
        console.warn('Torch not supported on this device/camera.');
      }
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  if (!isOpen) return null;

  return (
    <div
      id="qr-scanner-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
    >
      <div
        id="qr-scanner-dialog"
        className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-blue-600/20 text-blue-400 rounded-lg">
              <Camera size={20} />
            </span>
            <div>
              <h3 className="text-base font-semibold text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400">
                {expectedType === 'OFFER'
                  ? 'Scan the Host Offer QR'
                  : expectedType === 'ANSWER'
                  ? 'Scan the Receiver Answer QR'
                  : 'Align camera with any QR Code'}
              </p>
            </div>
          </div>
          <button
            id="close-scanner-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Camera Viewfinder */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center overflow-hidden">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Viewfinder Target Graphic */}
          {!cameraError && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-56 h-56 border-2 border-blue-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                {/* Laser animation */}
                <div className="absolute left-1 right-1 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_8px_#60a5fa] animate-pulse top-1/2" />
                {/* Corner markers */}
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl-lg" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr-lg" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl-lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br-lg" />
              </div>
            </div>
          )}

          {/* Camera Controls Overlay */}
          {!cameraError && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-3 px-4 pointer-events-auto">
              <button
                id="switch-camera-btn"
                onClick={switchCamera}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900/85 hover:bg-slate-800 text-slate-200 text-xs rounded-full border border-slate-700 backdrop-blur transition-colors"
              >
                <RefreshCw size={14} />
                <span>Flip Cam</span>
              </button>
              <button
                id="toggle-torch-btn"
                onClick={toggleTorch}
                className={`flex items-center space-x-1.5 px-3 py-1.5 ${
                  torchOn ? 'bg-amber-500 text-black font-semibold' : 'bg-slate-900/85 text-slate-200'
                } hover:opacity-90 text-xs rounded-full border border-slate-700 backdrop-blur transition-colors`}
              >
                <Zap size={14} />
                <span>Flash</span>
              </button>
            </div>
          )}

          {/* Camera Error Message */}
          {cameraError && (
            <div className="absolute inset-0 p-6 flex flex-col items-center justify-center bg-slate-950/90 text-center">
              <AlertCircle size={36} className="text-amber-400 mb-2" />
              <p className="text-sm text-slate-200 font-medium">{cameraError}</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                You can still connect instantly by pasting the signaling code from the other client below.
              </p>
              <button
                id="retry-camera-btn"
                onClick={startCamera}
                className="mt-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Manual Code Input Fallback */}
        <div className="p-5 bg-slate-900 border-t border-slate-800 flex-1 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-300">
              Or paste signaling code directly:
            </span>
            <button
              id="scanner-paste-clipboard-btn"
              onClick={handleReadClipboard}
              className="flex items-center space-x-1 text-xs text-blue-400 hover:text-blue-300"
            >
              <Clipboard size={13} />
              <span>Paste from Clipboard</span>
            </button>
          </div>
          <textarea
            id="manual-signaling-input"
            rows={2}
            value={manualCode}
            onChange={(e) => {
              setManualCode(e.target.value);
              setManualError(null);
            }}
            placeholder='Paste JSON signaling code starting with {"type": ...'
            className="w-full text-xs font-mono bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-blue-500 transition-colors"
          />

          {manualError && (
            <div className="text-xs text-rose-400 mt-1 flex items-center space-x-1">
              <AlertCircle size={13} />
              <span>{manualError}</span>
            </div>
          )}

          <div className="mt-3 flex justify-end gap-2">
            <button
              id="cancel-scanner-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 rounded-lg border border-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-manual-code-btn"
              onClick={handlePasteManual}
              disabled={!manualCode.trim()}
              className="flex items-center space-x-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
            >
              <CheckCircle2 size={14} />
              <span>Apply Code</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
