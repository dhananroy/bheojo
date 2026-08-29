import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { Play, Pause, RefreshCw, Camera, CheckCircle2, ShieldCheck, Sparkles, Image, FileText, Download } from 'lucide-react';
import { calculateCRC32, formatBytes } from '../utils/crc32';
import confetti from 'canvas-confetti';

export const OpticalQRStream: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'TRANSMIT' | 'RECEIVE'>('TRANSMIT');

  // Transmitter State
  const [payloadType, setPayloadType] = useState<'TEXT' | 'IMAGE'>('TEXT');
  const [textInput, setTextInput] = useState('Real-Time Data Packet via Optical Air-Gap Stream: 100% serverless peer-to-peer transmission!');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [chunkSize, setChunkSize] = useState(240); // Characters per QR code
  const [fps, setFps] = useState(8); // Frames per second
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [chunks, setChunks] = useState<string[]>([]);
  const txCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Receiver State
  const rxVideoRef = useRef<HTMLVideoElement | null>(null);
  const rxCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [rxSessionId, setRxSessionId] = useState<string | null>(null);
  const [rxTotalChunks, setRxTotalChunks] = useState(0);
  const [rxChunksMap, setRxChunksMap] = useState<Map<number, string>>(new Map());
  const [rxCompletedPayload, setRxCompletedPayload] = useState<{ type: 'TEXT' | 'IMAGE'; content: string } | null>(null);
  const [rxCameraError, setRxCameraError] = useState<string | null>(null);
  const rxRequestRef = useRef<number | null>(null);
  const rxStreamRef = useRef<MediaStream | null>(null);

  // Prepare Chunks when payload changes
  useEffect(() => {
    let rawData = '';
    const sid = 'opt_' + Math.random().toString(36).substring(2, 6);

    if (payloadType === 'TEXT') {
      rawData = JSON.stringify({ t: 'TXT', d: textInput, s: sid });
    } else if (payloadType === 'IMAGE' && imagePreview) {
      rawData = JSON.stringify({ t: 'IMG', d: imagePreview, s: sid });
    }

    if (!rawData) {
      setChunks([]);
      return;
    }

    const generatedChunks: string[] = [];
    const total = Math.ceil(rawData.length / chunkSize);
    for (let i = 0; i < total; i++) {
      const slice = rawData.slice(i * chunkSize, (i + 1) * chunkSize);
      const crc = calculateCRC32(slice);
      // Compact wire format: OPT|SID|IDX|TOTAL|CRC|DATA
      generatedChunks.push(`OPT|${sid}|${i}|${total}|${crc}|${slice}`);
    }

    setChunks(generatedChunks);
    setCurrentFrameIndex(0);
  }, [payloadType, textInput, imagePreview, chunkSize]);

  // Transmitter Animation Loop
  useEffect(() => {
    if (!isPlaying || chunks.length === 0) return;

    const interval = setInterval(() => {
      setCurrentFrameIndex((prev) => (prev + 1) % chunks.length);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [isPlaying, chunks.length, fps]);

  // Render current QR Frame
  useEffect(() => {
    if (!txCanvasRef.current || chunks.length === 0) return;
    const currentChunk = chunks[currentFrameIndex];
    if (!currentChunk) return;

    QRCode.toCanvas(
      txCanvasRef.current,
      currentChunk,
      {
        width: 280,
        margin: 2,
        color: {
          dark: '#020617',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'L',
      },
      (err) => {
        if (err) console.error('Optical QR render error:', err);
      }
    );
  }, [chunks, currentFrameIndex]);

  // Image Upload Handler for Transmitter
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      // Compress/resize image onto canvas to keep QR packet count manageable for visual transmission
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 280;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else {
          if (height > maxDim) {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.65);
        setImagePreview(compressedDataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Receiver Camera Scanning
  const startReceiverCamera = async () => {
    stopReceiverCamera();
    setRxCameraError(null);
    setIsScanning(true);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not accessible.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      rxStreamRef.current = stream;
      if (rxVideoRef.current) {
        rxVideoRef.current.srcObject = stream;
        rxVideoRef.current.setAttribute('playsinline', 'true');
        await rxVideoRef.current.play();
        startReceiverScanLoop();
      }
    } catch (err: any) {
      setRxCameraError(err?.message || 'Could not start camera.');
      setIsScanning(false);
    }
  };

  const stopReceiverCamera = () => {
    if (rxRequestRef.current) {
      cancelAnimationFrame(rxRequestRef.current);
      rxRequestRef.current = null;
    }
    if (rxStreamRef.current) {
      rxStreamRef.current.getTracks().forEach((t) => t.stop());
      rxStreamRef.current = null;
    }
    setIsScanning(false);
  };

  const startReceiverScanLoop = () => {
    const scan = () => {
      if (!rxVideoRef.current || !rxCanvasRef.current) return;
      const video = rxVideoRef.current;
      const canvas = rxCanvasRef.current;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data.startsWith('OPT|')) {
          processScannedChunk(code.data);
        }
      }

      rxRequestRef.current = requestAnimationFrame(scan);
    };

    rxRequestRef.current = requestAnimationFrame(scan);
  };

  const processScannedChunk = (rawString: string) => {
    // Format: OPT|SID|IDX|TOTAL|CRC|DATA
    const parts = rawString.split('|');
    if (parts.length < 6) return;

    const [_, sid, idxStr, totalStr, crc, ...dataParts] = parts;
    const chunkIdx = parseInt(idxStr, 10);
    const total = parseInt(totalStr, 10);
    const sliceData = dataParts.join('|');

    // Verify CRC
    if (calculateCRC32(sliceData) !== crc) {
      return;
    }

    setRxSessionId((prevSid) => {
      if (prevSid !== sid) {
        // New session started!
        setRxChunksMap(new Map([[chunkIdx, sliceData]]));
        setRxTotalChunks(total);
        setRxCompletedPayload(null);
        return sid;
      }
      return prevSid;
    });

    setRxChunksMap((prevMap) => {
      if (prevMap.has(chunkIdx)) return prevMap;
      const nextMap = new Map(prevMap);
      nextMap.set(chunkIdx, sliceData);

      // Check if complete
      if (nextMap.size >= total) {
        // Reassemble!
        const fullParts: string[] = [];
        for (let i = 0; i < total; i++) {
          fullParts.push((nextMap.get(i) as string) || '');
        }
        const fullJson = fullParts.join('');
        try {
          const parsed = JSON.parse(fullJson);
          if (parsed.t === 'TXT') {
            setRxCompletedPayload({ type: 'TEXT', content: parsed.d });
          } else if (parsed.t === 'IMG') {
            setRxCompletedPayload({ type: 'IMAGE', content: parsed.d });
          }
          confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
        } catch (e) {
          console.error('Failed to parse optical reconstructed payload:', e);
        }
      }

      return nextMap;
    });
  };

  useEffect(() => {
    return () => {
      stopReceiverCamera();
    };
  }, []);

  const rxProgress = rxTotalChunks > 0 ? Math.round((rxChunksMap.size / rxTotalChunks) * 100) : 0;

  return (
    <div id="optical-stream-panel" className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <ShieldCheck size={20} />
            </span>
            <h3 className="text-lg font-bold text-slate-100">Air-Gap Optical QR Stream</h3>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800/40">
              100% Zero-Network Air-Gap
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Transmit text & images directly screen-to-camera with sequenced QR packet streams.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            id="optical-tx-tab-btn"
            onClick={() => {
              setActiveTab('TRANSMIT');
              stopReceiverCamera();
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'TRANSMIT'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Optical Transmitter
          </button>
          <button
            id="optical-rx-tab-btn"
            onClick={() => {
              setActiveTab('RECEIVE');
              startReceiverCamera();
            }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'RECEIVE'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Optical Receiver
          </button>
        </div>
      </div>

      {/* TRANSMITTER VIEW */}
      {activeTab === 'TRANSMIT' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
          {/* Controls */}
          <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setPayloadType('TEXT')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  payloadType === 'TEXT'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                <FileText size={14} />
                <span>Text Packet</span>
              </button>
              <button
                onClick={() => setPayloadType('IMAGE')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  payloadType === 'IMAGE'
                    ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                    : 'bg-slate-800/60 border-slate-700 text-slate-400'
                }`}
              >
                <Image size={14} />
                <span>Image Packet</span>
              </button>
            </div>

            {payloadType === 'TEXT' ? (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Text Payload
                </label>
                <textarea
                  rows={4}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  className="w-full text-xs font-mono bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-blue-500"
                  placeholder="Enter message to transmit via optical QR stream..."
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">
                  Select Image for Optical Broadcast
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 bg-slate-950 p-2 rounded-xl border border-slate-800"
                />
                {imagePreview && (
                  <div className="mt-2 flex items-center space-x-3 bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <img
                      src={imagePreview}
                      alt="Tx Preview"
                      className="w-12 h-12 object-cover rounded border border-slate-700"
                    />
                    <div className="text-xs text-slate-300">
                      <p className="font-medium">Compressed for Optical Speed</p>
                      <p className="text-slate-500">{formatBytes(imagePreview.length)} payload</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stream Settings */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Transmission Frame Rate:</span>
                <span className="font-mono text-blue-400 font-bold">{fps} FPS</span>
              </div>
              <input
                type="range"
                min={2}
                max={15}
                value={fps}
                onChange={(e) => setFps(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />

              <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                <span>Total Packet Frames:</span>
                <span className="font-mono text-slate-200">{chunks.length} packets</span>
              </div>
            </div>

            {/* Play/Pause Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`flex-1 flex items-center justify-center space-x-2 py-2.5 rounded-xl text-xs font-semibold shadow-lg transition-all ${
                  isPlaying
                    ? 'bg-amber-600/90 hover:bg-amber-600 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                }`}
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                <span>{isPlaying ? 'Pause Optical Stream' : 'Resume Optical Stream'}</span>
              </button>
            </div>
          </div>

          {/* Animated QR Code Stream Canvas */}
          <div className="lg:col-span-6 flex flex-col items-center justify-center bg-slate-950 p-5 rounded-2xl border border-slate-800">
            <div className="bg-white p-3 rounded-2xl shadow-2xl border-4 border-slate-700/60">
              <canvas ref={txCanvasRef} className="rounded-lg" />
            </div>

            {/* Sequence counter */}
            <div className="w-full mt-4 flex items-center justify-between px-2">
              <div className="text-xs text-slate-400">
                Transmitting Frame{' '}
                <span className="font-mono font-bold text-blue-400">
                  #{chunks.length > 0 ? currentFrameIndex + 1 : 0}
                </span>{' '}
                of <span className="font-mono text-slate-300">{chunks.length}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="text-[11px] font-mono text-emerald-400">STREAMING</span>
              </div>
            </div>

            {/* Frame progress bar */}
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-blue-500 h-full transition-all duration-100"
                style={{
                  width: `${chunks.length > 0 ? ((currentFrameIndex + 1) / chunks.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* RECEIVER VIEW */}
      {activeTab === 'RECEIVE' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 items-start">
          {/* Camera Viewfinder */}
          <div className="lg:col-span-6 flex flex-col items-center">
            <div className="relative w-full aspect-square max-w-sm bg-black rounded-2xl overflow-hidden border border-slate-800">
              <video
                ref={rxVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={rxCanvasRef} className="hidden" />

              {/* Viewfinder Target */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-emerald-500/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] relative">
                  <div className="absolute inset-0 bg-emerald-500/10 animate-pulse rounded-2xl" />
                </div>
              </div>

              {rxCameraError && (
                <div className="absolute inset-0 p-4 flex flex-col items-center justify-center bg-slate-950/90 text-center">
                  <p className="text-xs text-rose-400 mb-2">{rxCameraError}</p>
                  <button
                    onClick={startReceiverCamera}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg"
                  >
                    Retry Camera
                  </button>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-3 text-center">
              Point this camera continuously at the Transmitter's animated QR screen.
            </p>
          </div>

          {/* Reconstruction Status & Received Content */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-300">Packet Ingestion Progress</span>
                <span className="font-mono text-xs font-bold text-emerald-400">{rxProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full transition-all duration-200"
                  style={{ width: `${rxProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-500 mt-2">
                <span>Received: {rxChunksMap.size} chunks</span>
                <span>Target: {rxTotalChunks} chunks</span>
              </div>
            </div>

            {/* Complete Reconstructed Payload Card */}
            {rxCompletedPayload ? (
              <div className="bg-emerald-950/30 border border-emerald-500/40 p-4 rounded-xl">
                <div className="flex items-center space-x-2 text-emerald-400 mb-2 font-semibold text-xs">
                  <CheckCircle2 size={16} />
                  <span>Optical Transmission Assembled Successfully!</span>
                </div>

                {rxCompletedPayload.type === 'TEXT' ? (
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap">
                    {rxCompletedPayload.content}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <img
                      src={rxCompletedPayload.content}
                      alt="Reconstructed"
                      className="max-h-48 rounded-lg border border-slate-800 mx-auto"
                    />
                    <a
                      href={rxCompletedPayload.content}
                      download={`optical-received-${Date.now()}.png`}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg"
                    >
                      <Download size={13} />
                      <span>Save Reconstructed Image</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-950/60 p-4 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                Awaiting complete packet stream frames...
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
