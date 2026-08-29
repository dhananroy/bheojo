import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import {
  Camera,
  CheckCircle2,
  Download,
  Copy,
  Check,
  RefreshCw,
  SwitchCamera,
  Flashlight,
  Sparkles,
  AlertCircle,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { calculateCRC32 } from '../utils/crc32';
import { playSuccessChime, playTickSound } from '../utils/audioFeedback';
import confetti from 'canvas-confetti';

interface SimpleQrReceiverProps {
  theme: 'light' | 'dark';
}

export const SimpleQrReceiver: React.FC<SimpleQrReceiverProps> = ({ theme }) => {
  const isDark = theme === 'dark';
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);

  // Scanning progress state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [totalChunks, setTotalChunks] = useState<number>(0);
  const [chunksMap, setChunksMap] = useState<Map<number, string>>(new Map());
  const [completedPayload, setCompletedPayload] = useState<{
    type: 'TEXT' | 'PHOTO';
    content: string;
    fileName?: string;
  } | null>(null);

  const [hasCopied, setHasCopied] = useState(false);

  const scanReqRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start Camera
  const startCamera = async (mode = facingMode) => {
    stopCamera();
    setCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported on this browser or device.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // Check for torch/flashlight capability
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? (track.getCapabilities() as any) : {};
      if (capabilities && capabilities.torch) {
        setHasTorch(true);
      } else {
        setHasTorch(false);
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        startScanLoop();
      }
    } catch (err: any) {
      console.error('Camera initialization failed:', err);
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser.'
          : 'Could not connect to camera. Please verify device permissions.'
      );
      setIsScanning(false);
    }
  };

  const stopCamera = () => {
    if (scanReqRef.current) {
      cancelAnimationFrame(scanReqRef.current);
      scanReqRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setIsTorchOn(false);
  };

  const toggleCameraFacing = () => {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track) {
      try {
        const nextState = !isTorchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextState }],
        });
        setIsTorchOn(nextState);
      } catch (e) {
        console.error('Failed to toggle torch:', e);
      }
    }
  };

  const startScanLoop = () => {
    const scanFrame = () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data && code.data.startsWith('OPT|')) {
          handleScannedData(code.data);
        }
      }

      scanReqRef.current = requestAnimationFrame(scanFrame);
    };

    scanReqRef.current = requestAnimationFrame(scanFrame);
  };

  const handleScannedData = (rawString: string) => {
    // Format: OPT|SID|IDX|TOTAL|CRC|DATA
    const parts = rawString.split('|');
    if (parts.length < 6) return;

    const [_, sid, idxStr, totalStr, crc, ...dataParts] = parts;
    const chunkIdx = parseInt(idxStr, 10);
    const total = parseInt(totalStr, 10);
    const sliceData = dataParts.join('|');

    // Verify CRC for integrity
    if (calculateCRC32(sliceData) !== crc) {
      return;
    }

    setSessionId((prevSid) => {
      if (prevSid !== sid) {
        // Brand new stream detected!
        setChunksMap(new Map([[chunkIdx, sliceData]]));
        setTotalChunks(total);
        setCompletedPayload(null);
        playTickSound();
        return sid;
      }
      return prevSid;
    });

    setChunksMap((prevMap) => {
      if (prevMap.has(chunkIdx)) return prevMap;
      const nextMap = new Map(prevMap);
      nextMap.set(chunkIdx, sliceData);
      playTickSound();

      // Check if all pieces have been received
      if (nextMap.size >= total) {
        const fullPieces: string[] = [];
        for (let i = 0; i < total; i++) {
          fullPieces.push((nextMap.get(i) as string) || '');
        }
        const fullJson = fullPieces.join('');
        try {
          const parsed = JSON.parse(fullJson);
          if (parsed.t === 'TXT') {
            setCompletedPayload({ type: 'TEXT', content: parsed.d });
          } else if (parsed.t === 'IMG') {
            setCompletedPayload({
              type: 'PHOTO',
              content: parsed.d,
              fileName: parsed.n || 'bhejo_photo.jpg',
            });
          }

          // Celebratory Feedback
          playSuccessChime();
          if (navigator.vibrate) {
            navigator.vibrate([100, 50, 150]);
          }
          confetti({
            particleCount: 70,
            spread: 90,
            origin: { y: 0.6 },
          });
        } catch (e) {
          console.error('Failed to parse assembled data:', e);
        }
      }

      return nextMap;
    });
  };

  // Start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Reset to scan another message/photo
  const handleResetScanner = () => {
    setChunksMap(new Map());
    setTotalChunks(0);
    setCompletedPayload(null);
    setSessionId(null);
    setHasCopied(false);
  };

  const handleCopyText = () => {
    if (!completedPayload || completedPayload.type !== 'TEXT') return;
    navigator.clipboard.writeText(completedPayload.content);
    setHasCopied(true);
    setTimeout(() => setHasCopied(false), 3000);
  };

  const progressPercent =
    totalChunks > 0 ? Math.round((chunksMap.size / totalChunks) * 100) : 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* If completed, display the received result prominently */}
      {completedPayload ? (
        <div
          className={`rounded-3xl p-6 sm:p-8 border shadow-xl transition-colors duration-200 space-y-6 ${
            isDark
              ? 'bg-slate-900/90 border-emerald-500/40 backdrop-blur'
              : 'bg-white border-emerald-500/50 shadow-emerald-500/10'
          }`}
        >
          <div
            className={`flex items-center space-x-3 pb-4 border-b ${
              isDark ? 'border-slate-800 text-emerald-400' : 'border-slate-100 text-emerald-600'
            }`}
          >
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-600'
              }`}
            >
              <CheckCircle2 size={26} />
            </div>
            <div>
              <h2
                className={`text-xl font-bold ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                Received Successfully!
              </h2>
              <p
                className={`text-xs sm:text-sm font-semibold ${
                  isDark ? 'text-emerald-400' : 'text-emerald-600'
                }`}
              >
                Transfer 100% complete with zero missing parts.
              </p>
            </div>
          </div>

          {/* Content Result */}
          {completedPayload.type === 'TEXT' ? (
            <div className="space-y-4">
              <div
                className={`flex items-center justify-between text-xs font-semibold ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <FileText size={15} className="text-blue-500" />
                  <span>Received Text Message:</span>
                </span>
                <span>{completedPayload.content.length} characters</span>
              </div>

              <div
                className={`p-5 rounded-2xl border text-sm sm:text-base font-normal leading-relaxed whitespace-pre-wrap select-all ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100'
                    : 'bg-slate-50 border-slate-200 text-slate-900 shadow-inner'
                }`}
              >
                {completedPayload.content}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={handleCopyText}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 py-3.5 px-6 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl shadow-lg shadow-blue-600/25 transition-all active:scale-98"
                >
                  {hasCopied ? <Check size={18} /> : <Copy size={18} />}
                  <span>{hasCopied ? 'Copied to Clipboard! ✅' : 'Copy Text'}</span>
                </button>

                <button
                  onClick={handleResetScanner}
                  className={`w-full sm:w-auto flex items-center justify-center space-x-2 py-3.5 px-6 font-semibold rounded-2xl border transition-colors ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <RefreshCw size={16} />
                  <span>Scan Another Code</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div
                className={`flex items-center justify-between text-xs font-semibold ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span className="flex items-center space-x-1.5">
                  <ImageIcon size={15} className="text-indigo-500" />
                  <span>Received Photo:</span>
                </span>
                <span>{completedPayload.fileName}</span>
              </div>

              <div
                className={`p-3 rounded-2xl border flex justify-center ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <img
                  src={completedPayload.content}
                  alt="Received"
                  className="max-h-80 w-auto rounded-xl object-contain shadow-lg"
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <a
                  href={completedPayload.content}
                  download={completedPayload.fileName || `bhejo-photo-${Date.now()}.jpg`}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center space-x-2 py-3.5 px-6 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-600/25 transition-all active:scale-98"
                >
                  <Download size={18} />
                  <span>Save Photo to Device</span>
                </a>

                <button
                  onClick={handleResetScanner}
                  className={`w-full sm:w-auto flex items-center justify-center space-x-2 py-3.5 px-6 font-semibold rounded-2xl border transition-colors ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <RefreshCw size={16} />
                  <span>Scan Another Code</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`rounded-2xl p-4 sm:p-5 border shadow-xs transition-colors duration-200 ${
            isDark
              ? 'bg-slate-900/80 border-slate-800 backdrop-blur'
              : 'bg-white border-slate-200/90 shadow-slate-200/50'
          }`}
        >
          {/* Top Bar */}
          <div
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b ${
              isDark ? 'border-slate-800' : 'border-slate-100'
            }`}
          >
            <div>
              <h2
                className={`text-sm sm:text-base font-bold flex items-center space-x-2 ${
                  isDark ? 'text-slate-100' : 'text-slate-900'
                }`}
              >
                <Camera size={18} className="text-emerald-600 dark:text-emerald-400" />
                <span>Optical Camera Receiver</span>
              </h2>
              <p
                className={`text-[10px] sm:text-[11px] mt-0.5 ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                Point camera steadily at the sender's animated QR screen.
              </p>
            </div>

            {/* Camera Controls */}
            <div className="flex items-center space-x-1.5 self-start sm:self-auto">
              {hasTorch && (
                <button
                  onClick={toggleTorch}
                  className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    isTorchOn
                      ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-xs'
                      : isDark
                      ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                  }`}
                  title="Flashlight"
                >
                  <Flashlight size={14} />
                  <span className="hidden sm:inline">{isTorchOn ? 'Torch On' : 'Torch'}</span>
                </button>
              )}

              <button
                onClick={toggleCameraFacing}
                className={`p-2 rounded-xl border text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                  isDark
                    ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                }`}
                title="Switch Camera"
              >
                <SwitchCamera size={14} />
                <span className="hidden sm:inline">Flip Camera</span>
              </button>
            </div>
          </div>

          {/* Grid Layout: Left Viewfinder, Right Status & Live Packet Assembly */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
            {/* Left Viewfinder Column */}
            <div className="lg:col-span-6 flex flex-col items-center justify-center">
              <div className="relative w-full max-w-[210px] xs:max-w-[230px] sm:max-w-[260px] md:max-w-[280px] max-h-[35vh] aspect-square bg-black rounded-2xl overflow-hidden border-2 border-slate-800 shadow-md">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Aiming Reticle Overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-4">
                  <div className="w-36 h-36 sm:w-44 sm:h-44 border-2 border-emerald-400/90 rounded-2xl relative shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
                    {/* Glowing Animated Scan line */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent absolute top-1/2 -translate-y-1/2 animate-pulse" />
                    {/* Corner accents */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-3 border-l-3 border-emerald-400 rounded-tl-md" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-3 border-r-3 border-emerald-400 rounded-tr-md" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-3 border-l-3 border-emerald-400 rounded-bl-md" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-3 border-r-3 border-emerald-400 rounded-br-md" />
                  </div>
                </div>

                {cameraError && (
                  <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-slate-950/95 text-center space-y-3">
                    <AlertCircle size={28} className="text-rose-400" />
                    <p className="text-[11px] text-rose-300 max-w-xs">{cameraError}</p>
                    <button
                      onClick={() => startCamera()}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
                    >
                      Try Camera Again
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Decoder Dashboard Column */}
            <div className="lg:col-span-6 space-y-3.5">
              {/* Real-time Status Card */}
              <div
                className={`p-3.5 sm:p-4 rounded-xl border space-y-3 ${
                  isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[10px] uppercase font-bold tracking-wider ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Optical Stream Decoder
                  </span>
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isScanning ? 'Scanner Active' : 'Idle'}</span>
                  </div>
                </div>

                {/* Progress Numbers */}
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                      {chunksMap.size}
                    </span>
                    <span
                      className={`text-xs sm:text-sm font-bold ml-1 ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      / {totalChunks > 0 ? totalChunks : '--'} Parts
                    </span>
                  </div>
                  <span className="text-base font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {totalChunks > 0 ? `${progressPercent}%` : '0%'}
                  </span>
                </div>

                {/* Progress Line */}
                <div
                  className={`w-full h-2 rounded-full overflow-hidden ${
                    isDark ? 'bg-slate-800' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className="bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 h-full transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Live Packet Map */}
                <div className="space-y-1.5 pt-0.5">
                  <span
                    className={`text-[10px] font-semibold block ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Received Packet Blocks:
                  </span>
                  {totalChunks > 0 ? (
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {Array.from({ length: totalChunks }, (_, i) => i).map((idx) => {
                        const isDone = chunksMap.has(idx);
                        return (
                          <div
                            key={idx}
                            className={`h-5 min-w-5 px-1 rounded-md flex items-center justify-center text-[10px] font-bold transition-all ${
                              isDone
                                ? 'bg-emerald-500 text-white shadow-xs'
                                : isDark
                                ? 'bg-slate-800 text-slate-500'
                                : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            {idx + 1}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p
                      className={`text-[11px] italic ${
                        isDark ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      Waiting for first optical frame from sender...
                    </p>
                  )}
                </div>
              </div>

              {/* Helpful instructions */}
              <div
                className={`p-3 rounded-xl border text-[11px] space-y-1 ${
                  isDark
                    ? 'bg-slate-900/40 border-slate-800/80 text-slate-400'
                    : 'bg-white/80 border-slate-200/80 text-slate-600'
                }`}
              >
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  Tips for fastest reception:
                </p>
                <ul className="list-disc list-inside space-y-0.5 pl-1">
                  <li>Hold phone parallel to the sender screen</li>
                  <li>Ensure whole QR code is centered inside the reticle</li>
                  <li>Avoid strong screen glare or light reflections</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
