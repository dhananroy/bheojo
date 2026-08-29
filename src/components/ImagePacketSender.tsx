import React, { useState, useRef } from 'react';
import { Image as ImageIcon, Upload, Send, CheckCircle2, Layers, Cpu, Sparkles, PenTool, Trash2 } from 'lucide-react';
import { calculateCRC32, formatBytes } from '../utils/crc32';

interface ImagePacketSenderProps {
  onSendImagePackets: (file: Blob, fileName: string, chunkSize: number) => Promise<void>;
  isConnected: boolean;
}

export const ImagePacketSender: React.FC<ImagePacketSenderProps> = ({
  onSendImagePackets,
  isConnected,
}) => {
  const [selectedImage, setSelectedImage] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [chunkSize, setChunkSize] = useState(32 * 1024); // 32KB chunks
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<{ sent: number; total: number } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showCanvasPad, setShowCanvasPad] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPaintingRef = useRef(false);

  // Quick Preset Samples (Generated with Canvas)
  const generateSampleImage = (type: 'GRID' | 'BADGE' | 'GRADIENT') => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    const ctx = canvas.getContext('2d')!;

    if (type === 'GRID') {
      // Tech Grid Pattern
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, 320, 320);
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 320; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 320);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(320, i);
        ctx.stroke();
      }
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px monospace';
      ctx.fillText('P2P PACKET TEST', 40, 165);
    } else if (type === 'BADGE') {
      // Cyber Security Badge
      const grad = ctx.createLinearGradient(0, 0, 320, 320);
      grad.addColorStop(0, '#1e1b4b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 320, 320);
      ctx.beginPath();
      ctx.arc(160, 160, 100, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('ZERO SERVER', 160, 155);
      ctx.fillText('UPLOAD', 160, 180);
    } else {
      // High-Contrast Gradient
      const grad = ctx.createLinearGradient(0, 0, 320, 320);
      grad.addColorStop(0, '#ec4899');
      grad.addColorStop(0.5, '#8b5cf6');
      grad.addColorStop(1, '#3b82f6');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 320, 320);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('PACKET STREAM', 160, 165);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setSelectedImage({
          blob,
          url,
          name: `sample_${type.toLowerCase()}_${Date.now()}.png`,
        });
      }
    }, 'image/png');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSelectedImage({
      blob: file,
      url,
      name: file.name,
    });
  };

  const handleSendImage = async () => {
    if (!selectedImage || isSending) return;
    setIsSending(true);
    setSendProgress({ sent: 0, total: 100 });

    try {
      await onSendImagePackets(selectedImage.blob, selectedImage.name, chunkSize);
    } catch (err) {
      console.error('Failed to send image packets:', err);
    } finally {
      setIsSending(false);
      setSendProgress(null);
    }
  };

  // Drawing Pad Functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isPaintingRef.current = true;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isPaintingRef.current) return;
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const stopDrawing = () => {
    isPaintingRef.current = false;
  };

  const saveDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        setSelectedImage({
          blob,
          url,
          name: `sketch_${Date.now()}.png`,
        });
        setShowCanvasPad(false);
      }
    }, 'image/png');
  };

  const clearDrawing = () => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const estimatedChunks = selectedImage
    ? Math.ceil((selectedImage.blob.size * 1.37) / chunkSize)
    : 0;

  return (
    <div id="image-packet-sender-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-indigo-500/10 text-indigo-400 rounded-lg">
              <ImageIcon size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Image Data Packet Slicer</h3>
              <p className="text-xs text-slate-400">Chunked binary transmission with zero server upload</p>
            </div>
          </div>
          {selectedImage && (
            <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
              {formatBytes(selectedImage.blob.size)}
            </span>
          )}
        </div>

        {/* Image Preview / Drop Area */}
        <div className="relative mb-3">
          {selectedImage ? (
            <div className="relative bg-slate-950 rounded-xl border border-slate-800 p-2 flex items-center space-x-3">
              <img
                src={selectedImage.url}
                alt="Selected preview"
                className="w-16 h-16 object-cover rounded-lg border border-slate-700 bg-black/40"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{selectedImage.name}</p>
                <div className="flex items-center space-x-2 text-[10px] text-slate-400 mt-1 font-mono">
                  <span>{formatBytes(selectedImage.blob.size)}</span>
                  <span>•</span>
                  <span className="text-blue-400 font-bold">{estimatedChunks} Packets</span>
                </div>
              </div>
              <button
                id="remove-selected-image-btn"
                onClick={() => setSelectedImage(null)}
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Remove image"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-slate-950/60 hover:bg-slate-950 border-2 border-dashed border-slate-800 hover:border-indigo-500/50 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer transition-colors"
            >
              <Upload size={24} className="text-slate-400 mb-1" />
              <p className="text-xs font-semibold text-slate-300">Click or Drop Image to Slice</p>
              <p className="text-[10px] text-slate-400">PNG, JPG, WEBP, GIF up to 10MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>

        {/* Drawing Pad Modal / Expandable */}
        {showCanvasPad ? (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 mb-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-300">Draw Quick Sketch Packet:</span>
              <div className="flex items-center space-x-1">
                <button
                  onClick={clearDrawing}
                  className="p-1 text-slate-400 hover:text-rose-400 text-xs"
                >
                  Clear
                </button>
                <button
                  onClick={saveDrawing}
                  className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold rounded"
                >
                  Use Drawing
                </button>
              </div>
            </div>
            <canvas
              ref={drawingCanvasRef}
              width={280}
              height={140}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="w-full bg-slate-900 border border-slate-700 rounded cursor-crosshair"
            />
          </div>
        ) : (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-slate-400">Quick Samples:</span>
              <button
                id="sample-grid-btn"
                onClick={() => generateSampleImage('GRID')}
                className="text-[10px] text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800"
              >
                Grid
              </button>
              <button
                id="sample-badge-btn"
                onClick={() => generateSampleImage('BADGE')}
                className="text-[10px] text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800"
              >
                Badge
              </button>
              <button
                id="sample-grad-btn"
                onClick={() => generateSampleImage('GRADIENT')}
                className="text-[10px] text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 px-2 py-0.5 rounded border border-slate-800"
              >
                Gradient
              </button>
            </div>
            <button
              onClick={() => {
                setShowCanvasPad(true);
                setTimeout(() => clearDrawing(), 50);
              }}
              className="flex items-center space-x-1 text-[10px] text-blue-400 hover:text-blue-300 font-medium"
            >
              <PenTool size={11} />
              <span>Draw Sketch</span>
            </button>
          </div>
        )}

        {/* Chunk Slicing Config */}
        <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 mb-4 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 flex items-center space-x-1">
            <Layers size={13} className="text-slate-500" />
            <span>Packet Chunk Size:</span>
          </span>
          <div className="flex items-center space-x-1">
            {[16 * 1024, 32 * 1024, 64 * 1024].map((sz) => (
              <button
                key={sz}
                onClick={() => setChunkSize(sz)}
                className={`px-2 py-0.5 text-[10px] font-mono rounded transition-colors ${
                  chunkSize === sz
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {sz / 1024} KB
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Action Button 1: SEND IMAGE PACKETS */}
      <div>
        <button
          id="hero-send-image-packet-btn"
          onClick={handleSendImage}
          disabled={!selectedImage || isSending}
          className={`w-full relative group overflow-hidden py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-[0.98] ${
            isSending
              ? 'bg-amber-600'
              : !selectedImage
              ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/30'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            {isSending ? (
              <>
                <Cpu size={18} className="animate-spin text-amber-200" />
                <span>STREAMING IMAGE PACKETS...</span>
              </>
            ) : (
              <>
                <Send size={18} className="transition-transform group-hover:translate-x-1" />
                <span>BUTTON 1: SEND IMAGE PACKET STREAM</span>
              </>
            )}
          </div>
        </button>
        <p className="text-[10px] text-center text-slate-400 mt-1.5">
          Slices image into sequenced DataPackets with CRC verification & auto-assembly
        </p>
      </div>
    </div>
  );
};
