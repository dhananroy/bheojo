import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  MessageSquare,
  Image as ImageIcon,
  Play,
  Pause,
  Upload,
  Sparkles,
  Zap,
  Check,
  X,
  Gauge,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  Shield,
  Layers,
  Radio,
} from 'lucide-react';
import { calculateCRC32 } from '../utils/crc32';

interface SimpleQrSenderProps {
  theme: 'light' | 'dark';
}

export const SimpleQrSender: React.FC<SimpleQrSenderProps> = ({ theme }) => {
  const isDark = theme === 'dark';
  const [contentType, setContentType] = useState<'TEXT' | 'PHOTO'>('TEXT');
  const [textMessage, setTextMessage] = useState(
    'Welcome to Share! Fast screen-to-camera optical transfer with zero internet'
  );
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState<string>('');

  // Transmission settings
  const [speed, setSpeed] = useState<'SLOW' | 'NORMAL' | 'FAST'>('NORMAL');
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [chunks, setChunks] = useState<string[]>([]);
  const [isFullscreenQr, setIsFullscreenQr] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Speed in Frames Per Second (FPS)
  const fps = speed === 'SLOW' ? 4 : speed === 'NORMAL' ? 7 : 12;
  // Chunk character size (balanced density for fast reliable camera decoding)
  const chunkSize = 200;

  // Split content into QR frames whenever message/photo changes
  useEffect(() => {
    let rawData = '';
    const sessionId = 'b' + Math.random().toString(36).substring(2, 6);

    if (contentType === 'TEXT') {
      if (!textMessage.trim()) {
        setChunks([]);
        return;
      }
      rawData = JSON.stringify({ t: 'TXT', d: textMessage, s: sessionId });
    } else if (contentType === 'PHOTO' && photoPreview) {
      rawData = JSON.stringify({
        t: 'IMG',
        d: photoPreview,
        n: photoName || 'photo.jpg',
        s: sessionId,
      });
    }

    if (!rawData) {
      setChunks([]);
      return;
    }

    const newChunks: string[] = [];
    const total = Math.ceil(rawData.length / chunkSize);
    for (let i = 0; i < total; i++) {
      const slice = rawData.slice(i * chunkSize, (i + 1) * chunkSize);
      const crc = calculateCRC32(slice);
      // Compact wire format: OPT|SID|IDX|TOTAL|CRC|DATA
      newChunks.push(`OPT|${sessionId}|${i}|${total}|${crc}|${slice}`);
    }

    setChunks(newChunks);
    setCurrentFrameIndex(0);
  }, [contentType, textMessage, photoPreview, photoName]);

  // Frame animation loop
  useEffect(() => {
    if (!isPlaying || chunks.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % chunks.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, chunks.length, fps]);

  // Draw current QR code to main canvas & fullscreen canvas
  useEffect(() => {
    if (chunks.length === 0) return;
    const currentChunk = chunks[currentFrameIndex];
    if (!currentChunk) return;

    const qrOptions: QRCode.QRCodeRenderersOptions = {
      scale: 8,
      margin: 1,
      color: {
        dark: '#090d16',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    };

    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, currentChunk, qrOptions, (err) => {
        if (err) console.error('QR Render error:', err);
        if (canvasRef.current) {
          canvasRef.current.style.width = '100%';
          canvasRef.current.style.height = '100%';
          canvasRef.current.style.display = 'block';
          canvasRef.current.style.imageRendering = 'pixelated';
        }
      });
    }

    if (fullscreenCanvasRef.current) {
      QRCode.toCanvas(
        fullscreenCanvasRef.current,
        currentChunk,
        {
          ...qrOptions,
          scale: 12,
          margin: 1,
        },
        (err) => {
          if (err) console.error('Fullscreen QR Render error:', err);
          if (fullscreenCanvasRef.current) {
            fullscreenCanvasRef.current.style.width = '100%';
            fullscreenCanvasRef.current.style.height = '100%';
            fullscreenCanvasRef.current.style.display = 'block';
            fullscreenCanvasRef.current.style.imageRendering = 'pixelated';
          }
        }
      );
    }
  }, [chunks, currentFrameIndex, isFullscreenQr]);

  // Handle Photo Picker with fast client-side optimization
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 260;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxDim) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          }
        } else {
          if (h > maxDim) {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
        setPhotoPreview(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const sampleTexts = [
    'Hello! Glad to connect via Share',
    'WiFi: HomeOffice | Password: secretKey2026',
    'Meet me at the main gate at 4:30 PM',
  ];

  const handlePrevFrame = () => {
    if (chunks.length === 0) return;
    setIsPlaying(false);
    setCurrentFrameIndex((prev) => (prev - 1 + chunks.length) % chunks.length);
  };

  const handleNextFrame = () => {
    if (chunks.length === 0) return;
    setIsPlaying(false);
    setCurrentFrameIndex((prev) => (prev + 1) % chunks.length);
  };

  const totalByteEstimate =
    contentType === 'TEXT'
      ? textMessage.length
      : photoPreview
      ? Math.round(photoPreview.length * 0.75)
      : 0;

  const cycleTimeSeconds =
    chunks.length > 0 ? (chunks.length / fps).toFixed(1) : '0.0';

  return (
    <div className="w-full">
      {/* 2-Column Responsive Grid Layout: Balanced height & Compact sizing */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5 items-start">
        {/* LEFT COLUMN: Data Input & Speed Controls */}
        <div className="lg:col-span-6 space-y-4">
          <div
            className={`rounded-2xl p-4 sm:p-5 transition-colors duration-200 border shadow-sm ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 backdrop-blur'
                : 'bg-white border-slate-200/90 shadow-slate-200/50'
            }`}
          >
            {/* Header & Type Switcher */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shadow-sm">
                  1
                </span>
                <h2
                  className={`text-sm sm:text-base font-bold ${
                    isDark ? 'text-slate-100' : 'text-slate-900'
                  }`}
                >
                  Payload Setup
                </h2>
              </div>

              {/* Type Switcher */}
              <div
                className={`flex items-center p-1 rounded-xl border ${
                  isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  id="send-type-text-btn"
                  onClick={() => setContentType('TEXT')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    contentType === 'TEXT'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <MessageSquare size={13} />
                  <span>Text</span>
                </button>

                <button
                  id="send-type-photo-btn"
                  onClick={() => setContentType('PHOTO')}
                  className={`flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    contentType === 'PHOTO'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon size={13} />
                  <span>Photo</span>
                </button>
              </div>
            </div>

            {/* Input Controls */}
            <div className="mt-3">
              {contentType === 'TEXT' ? (
                <div className="space-y-2.5">
                  <div className="relative">
                    <textarea
                      id="message-input"
                      rows={3}
                      value={textMessage}
                      onChange={(e) => setTextMessage(e.target.value)}
                      placeholder="Type your message, notes, link, or keys..."
                      className={`w-full text-xs sm:text-sm rounded-xl p-3 transition-all resize-none border focus:outline-none focus:ring-2 focus:ring-blue-500/20 ${
                        isDark
                          ? 'bg-slate-950/90 border-slate-800 text-slate-100 placeholder:text-slate-500 focus:border-blue-500'
                          : 'bg-slate-50 border-slate-200 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-600'
                      }`}
                    />
                    {textMessage && (
                      <button
                        onClick={() => setTextMessage('')}
                        className={`absolute top-2 right-2 text-[10px] px-1.5 py-0.5 rounded-md transition-colors flex items-center space-x-1 ${
                          isDark
                            ? 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                            : 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                        }`}
                      >
                        <X size={10} />
                        <span>Clear</span>
                      </button>
                    )}
                  </div>

                  {/* Sample presets */}
                  <div className="space-y-1">
                    <span
                      className={`text-[10px] font-semibold block uppercase tracking-wider ${
                        isDark ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    >
                      Quick Templates:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sampleTexts.map((sample, idx) => (
                        <button
                          key={idx}
                          onClick={() => setTextMessage(sample)}
                          className={`text-[11px] px-2 py-0.5 rounded-lg border transition-colors truncate max-w-full ${
                            isDark
                              ? 'bg-slate-800/70 hover:bg-slate-700 text-slate-300 border-slate-700/60'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                          }`}
                        >
                          {sample.split('|')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors ${
                      isDark
                        ? 'border-slate-800 hover:border-blue-500/80 bg-slate-950/60'
                        : 'border-slate-300 hover:border-blue-500 bg-slate-50'
                    }`}
                  >
                    <input
                      id="photo-input"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                    <label
                      htmlFor="photo-input"
                      className="cursor-pointer flex flex-col items-center justify-center space-y-1.5"
                    >
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          isDark
                            ? 'bg-blue-600/10 text-blue-400'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        <Upload size={20} />
                      </div>
                      <div>
                        <span className="inline-block px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all">
                          {photoPreview ? 'Change Photo' : 'Select Photo'}
                        </span>
                      </div>
                      <p
                        className={`text-[10px] ${
                          isDark ? 'text-slate-400' : 'text-slate-500'
                        }`}
                      >
                        Auto-compressed for instant optical transmission
                      </p>
                    </label>
                  </div>

                  {photoPreview && (
                    <div
                      className={`flex items-center space-x-2.5 p-2 rounded-xl border ${
                        isDark
                          ? 'bg-slate-950 border-slate-800'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <img
                        src={photoPreview}
                        alt="Preview"
                        className="w-10 h-10 object-cover rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm"
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            isDark ? 'text-slate-200' : 'text-slate-800'
                          }`}
                        >
                          {photoName || 'Selected Photo'}
                        </p>
                        <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          Ready ({chunks.length} parts)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Speed Configuration */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold flex items-center space-x-1.5 ${
                    isDark ? 'text-slate-300' : 'text-slate-700'
                  }`}
                >
                  <Gauge size={13} className="text-blue-500" />
                  <span>Streaming Speed</span>
                </span>
                <span className="text-[11px] font-mono text-blue-600 dark:text-blue-400 font-bold">
                  {fps} FPS ({cycleTimeSeconds}s / loop)
                </span>
              </div>

              <div
                className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800'
                    : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  onClick={() => setSpeed('SLOW')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    speed === 'SLOW'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Slow (4 FPS)
                </button>
                <button
                  onClick={() => setSpeed('NORMAL')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    speed === 'NORMAL'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Normal (7 FPS)
                </button>
                <button
                  onClick={() => setSpeed('FAST')}
                  className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                    speed === 'FAST'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : isDark
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Fast (12 FPS)
                </button>
              </div>
            </div>
          </div>

          {/* Quick Info & Transmission Details */}
          <div
            className={`rounded-2xl p-3 sm:p-4 border transition-colors duration-200 ${
              isDark
                ? 'bg-slate-900/40 border-slate-800/80 text-slate-300'
                : 'bg-white/80 border-slate-200/80 text-slate-700 shadow-sm'
            }`}
          >
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div
                className={`p-2.5 rounded-xl border ${
                  isDark
                    ? 'bg-slate-950/60 border-slate-800/60'
                    : 'bg-slate-50 border-slate-200/60'
                }`}
              >
                <span
                  className={`text-[10px] uppercase font-bold block tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Total Stream Parts
                </span>
                <span className="text-sm sm:text-base font-black text-blue-600 dark:text-blue-400">
                  {chunks.length} {chunks.length === 1 ? 'Frame' : 'Frames'}
                </span>
              </div>

              <div
                className={`p-2.5 rounded-xl border ${
                  isDark
                    ? 'bg-slate-950/60 border-slate-800/60'
                    : 'bg-slate-50 border-slate-200/60'
                }`}
              >
                <span
                  className={`text-[10px] uppercase font-bold block tracking-wider ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Est. Data Size
                </span>
                <span className="text-sm sm:text-base font-black text-emerald-600 dark:text-emerald-400">
                  {totalByteEstimate > 1024
                    ? `${(totalByteEstimate / 1024).toFixed(1)} KB`
                    : `${totalByteEstimate} B`}
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center space-x-1.5 text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              <Shield size={13} />
              <span>Physical optical airgap • 100% offline & zero server storage</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Big QR Display Stage with Responsive Fit */}
        <div className="lg:col-span-6 space-y-4">
          <div
            className={`rounded-2xl p-4 sm:p-5 transition-colors duration-200 border shadow-sm flex flex-col items-center ${
              isDark
                ? 'bg-slate-900/80 border-slate-800 backdrop-blur'
                : 'bg-white border-slate-200/90 shadow-slate-200/50'
            }`}
          >
            {/* Top Stage Header */}
            <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-sm">
                  2
                </span>
                <div>
                  <h2
                    className={`text-sm sm:text-base font-bold ${
                      isDark ? 'text-slate-100' : 'text-slate-900'
                    }`}
                  >
                    Optical QR Stream
                  </h2>
                  <p
                    className={`text-[10px] sm:text-[11px] ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Point receiver camera at this code
                  </p>
                </div>
              </div>

              {/* Status Badge & Fullscreen trigger */}
              <div className="flex items-center space-x-1.5">
                <div className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>{isPlaying ? 'Live' : 'Paused'}</span>
                </div>

                <button
                  id="fullscreen-qr-btn"
                  onClick={() => setIsFullscreenQr(true)}
                  className={`p-1.5 rounded-lg border transition-colors ${
                    isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                  title="Expand QR to Fullscreen for easy scanning"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            {/* RESPONSIVE QR CODE CONTAINER - Fits perfectly on any screen */}
            {chunks.length > 0 ? (
              <div className="w-full flex flex-col items-center justify-center">
                {/* QR Canvas — perfectly centered with clean border and responsive sizing */}
                <div
                  className={`w-full max-w-[260px] xs:max-w-[290px] sm:max-w-[320px] md:max-w-[340px] aspect-square rounded-2xl overflow-hidden border-2 transition-all flex items-center justify-center bg-white ${
                    isDark
                      ? 'border-slate-700/80 shadow-md'
                      : 'border-slate-200/90 shadow-sm'
                  }`}
                >
                  <canvas
                    ref={canvasRef}
                    className="w-full h-full aspect-square block !w-full !h-full"
                    style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
                  />
                </div>

                {/* Progress & Current Frame Status - Centered & matching QR width */}
                <div className="w-full max-w-[260px] xs:max-w-[290px] sm:max-w-[320px] md:max-w-[340px] mt-3 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-bold ${
                        isDark ? 'text-slate-200' : 'text-slate-800'
                      }`}
                    >
                      Part{' '}
                      <span className="text-blue-600 dark:text-blue-400 font-extrabold text-sm">
                        #{currentFrameIndex + 1}
                      </span>{' '}
                      of{' '}
                      <span
                        className={isDark ? 'text-slate-400' : 'text-slate-500'}
                      >
                        {chunks.length}
                      </span>
                    </span>

                    <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
                      {Math.round(
                        ((currentFrameIndex + 1) / chunks.length) * 100
                      )}
                      %
                    </span>
                  </div>

                  {/* Progress Line */}
                  <div
                    className={`w-full h-2 rounded-full overflow-hidden ${
                      isDark ? 'bg-slate-800' : 'bg-slate-200'
                    }`}
                  >
                    <div
                      className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 h-full transition-all duration-100"
                      style={{
                        width: `${
                          ((currentFrameIndex + 1) / chunks.length) * 100
                        }%`,
                      }}
                    />
                  </div>

                  {/* Interactive Frame Blocks / Dots */}
                  {chunks.length > 1 && (
                    <div className="flex flex-wrap gap-1 justify-center pt-0.5 max-h-16 overflow-y-auto">
                      {chunks.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setIsPlaying(false);
                            setCurrentFrameIndex(idx);
                          }}
                          className={`h-2 rounded-sm transition-all duration-150 ${
                            idx === currentFrameIndex
                              ? 'w-5 bg-blue-600 dark:bg-blue-400 scale-105 shadow-sm'
                              : isDark
                              ? 'w-2 bg-slate-800 hover:bg-slate-700'
                              : 'w-2 bg-slate-300 hover:bg-slate-400'
                          }`}
                          title={`Jump to frame ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Compact Playback Controls Bar - Centered & matching QR width */}
                <div
                  className={`w-full max-w-[260px] xs:max-w-[290px] sm:max-w-[320px] md:max-w-[340px] mt-3 pt-3 border-t flex items-center justify-between gap-2 ${
                    isDark ? 'border-slate-800' : 'border-slate-100'
                  }`}
                >
                  {/* Previous Frame */}
                  <button
                    onClick={handlePrevFrame}
                    className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                    title="Previous Frame"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {/* Play / Pause Toggle */}
                  <button
                    id="toggle-playback-btn"
                    onClick={() => setIsPlaying(!isPlaying)}
                    className={`flex-1 flex items-center justify-center space-x-1.5 py-2 px-3 rounded-xl text-xs font-bold transition-all shadow-sm ${
                      isPlaying
                        ? isDark
                          ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/25'
                    }`}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Pause Loop' : 'Resume Loop'}</span>
                  </button>

                  {/* Next Frame */}
                  <button
                    onClick={handleNextFrame}
                    className={`p-2 rounded-xl border text-xs font-bold transition-colors ${
                      isDark
                        ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                    }`}
                    title="Next Frame"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <div
                className={`py-12 text-center text-xs ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Enter text or pick a photo on the left to start streaming code.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FULLSCREEN QR EXPANDED MODAL (For effortless long-distance scanning) */}
      {isFullscreenQr && (
        <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex flex-col items-center justify-between p-4 sm:p-8 transition-opacity duration-200">
          <div className="w-full max-w-md flex items-center justify-between text-white">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold text-sm sm:text-base tracking-wide">
                Share Fullscreen Stream
              </span>
            </div>
            <button
              onClick={() => setIsFullscreenQr(false)}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              title="Exit Fullscreen"
            >
              <Minimize2 size={18} />
            </button>
          </div>

          <div
            className="rounded-2xl overflow-hidden border-4 border-slate-400/40 shadow-2xl bg-white flex items-center justify-center"
            style={{ width: 'min(80vmin, 480px)', height: 'min(80vmin, 480px)' }}
          >
            <canvas
              ref={fullscreenCanvasRef}
              className="w-full h-full block !w-full !h-full"
              style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
            />
          </div>

          <div className="w-full max-w-xs sm:max-w-sm space-y-3">
            <div className="flex items-center justify-between text-white text-xs font-semibold">
              <span>
                Part #{currentFrameIndex + 1} of {chunks.length}
              </span>
              <span>{fps} FPS</span>
            </div>

            <div className="flex items-center justify-center space-x-3">
              <button
                onClick={handlePrevFrame}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs sm:text-sm rounded-xl transition-colors shadow-md"
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                onClick={handleNextFrame}
                className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

