import React, { useState } from 'react';
import { Inbox, Download, Copy, Check, CheckCircle2, FileText, Image as ImageIcon, Sparkles, RefreshCw, Layers, ShieldCheck } from 'lucide-react';
import { DataPacket, ImageReconstruction } from '../types';
import { formatBytes } from '../utils/crc32';

interface ReceivedPacketsListProps {
  packets: DataPacket[];
  reconstructedImages: ImageReconstruction[];
  onTriggerReceivePacket: () => void;
  isConnected: boolean;
  onClearHistory: () => void;
}

export const ReceivedPacketsList: React.FC<ReceivedPacketsListProps> = ({
  packets,
  reconstructedImages,
  onTriggerReceivePacket,
  isConnected,
  onClearHistory,
}) => {
  const [activeTab, setActiveTab] = useState<'ALL' | 'TEXT' | 'IMAGES'>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [receiveEffect, setReceiveEffect] = useState(false);

  const textPackets = packets.filter((p) => p.header.type === 'TEXT');

  const handleCopyText = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleReceiveClick = () => {
    setReceiveEffect(true);
    onTriggerReceivePacket();
    setTimeout(() => setReceiveEffect(false), 800);
  };

  return (
    <div id="received-packets-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between h-full">
      <div>
        {/* Header with Hero Button 2 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Inbox size={20} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Received Packet Ingestion & Storage</h3>
              <p className="text-xs text-slate-400">
                Direct client memory buffer • {packets.length} Packets • {reconstructedImages.length} Images
              </p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setActiveTab('ALL')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'ALL' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All ({packets.length})
            </button>
            <button
              onClick={() => setActiveTab('TEXT')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'TEXT' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Texts ({textPackets.length})
            </button>
            <button
              onClick={() => setActiveTab('IMAGES')}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                activeTab === 'IMAGES' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Images ({reconstructedImages.length})
            </button>
          </div>
        </div>

        {/* Hero Button 2: RECEIVE / INGEST / ACK PACKET */}
        <div className="my-4">
          <button
            id="hero-receive-packet-btn"
            onClick={handleReceiveClick}
            className={`w-full relative group overflow-hidden py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-[0.98] ${
              receiveEffect
                ? 'bg-emerald-500 shadow-emerald-500/40 ring-2 ring-emerald-300'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-500/25'
            }`}
          >
            <div className="flex items-center justify-center space-x-2">
              <RefreshCw
                size={18}
                className={`transition-transform ${receiveEffect ? 'animate-spin' : 'group-hover:rotate-180'}`}
              />
              <span>BUTTON 2: RECEIVE / REQUEST DATA PACKET</span>
            </div>
          </button>
          <p className="text-[10px] text-center text-slate-400 mt-1.5">
            Triggers active packet pull, round-trip acknowledgement & buffer verification
          </p>
        </div>

        {/* Content Stream View */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {/* If No Items */}
          {packets.length === 0 && reconstructedImages.length === 0 && (
            <div className="bg-slate-950/60 rounded-xl border border-dashed border-slate-800 p-8 text-center">
              <Inbox size={32} className="text-slate-400 mx-auto mb-2 opacity-50" />
              <p className="text-xs font-semibold text-slate-300">Packet Buffer is Empty</p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                Connect via QR Code and click <span className="text-blue-400 font-bold">Button 1</span> or <span className="text-emerald-400 font-bold">Button 2</span> to send and ingest real-time data packets.
              </p>
            </div>
          )}

          {/* Reconstructed Images Gallery */}
          {(activeTab === 'ALL' || activeTab === 'IMAGES') &&
            reconstructedImages.map((img) => (
              <div
                key={img.transferId}
                id={`received-img-${img.transferId}`}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2.5 transition-all hover:border-emerald-500/40"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="p-1 bg-emerald-500/10 text-emerald-400 rounded">
                      <ImageIcon size={15} />
                    </span>
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[180px]">
                      {img.fileName}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
                      100% Reconstructed ({img.totalChunks} Chunks)
                    </span>
                    <a
                      href={img.assembledDataUrl}
                      download={img.fileName}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
                      title="Download received image"
                    >
                      <Download size={13} />
                    </a>
                  </div>
                </div>

                {img.assembledDataUrl && (
                  <div className="bg-black/50 rounded-lg p-1.5 border border-slate-800 flex justify-center">
                    <img
                      src={img.assembledDataUrl}
                      alt={img.fileName}
                      className="max-h-44 object-contain rounded"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Transfer: {img.transferId}</span>
                  <span className="text-emerald-400 font-semibold">Zero Server Upload</span>
                </div>
              </div>
            ))}

          {/* Text Messages Stream */}
          {(activeTab === 'ALL' || activeTab === 'TEXT') &&
            textPackets.map((pkt) => (
              <div
                key={pkt.header.id}
                id={`received-packet-${pkt.header.id}`}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2 transition-all hover:border-blue-500/30"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="p-1 bg-blue-500/10 text-blue-400 rounded">
                      <FileText size={14} />
                    </span>
                    <span className="text-[11px] font-mono text-slate-300">
                      Seq #{pkt.header.seq} • ID: {pkt.header.id.substring(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(pkt.header.timestamp).toLocaleTimeString()}
                    </span>
                    <button
                      onClick={() => handleCopyText(pkt.payload.text || '', pkt.header.id)}
                      className="p-1 text-slate-400 hover:text-slate-200 transition-colors"
                      title="Copy text"
                    >
                      {copiedId === pkt.header.id ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-2.5 text-xs font-mono text-slate-200 whitespace-pre-wrap border border-slate-800">
                  {pkt.payload.text}
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                  <span>CRC32: {pkt.header.checksum}</span>
                  <span>Sender: {pkt.header.senderId}</span>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Footer Clear */}
      {packets.length > 0 && (
        <div className="pt-3 mt-3 border-t border-slate-800 flex justify-between items-center text-xs">
          <span className="text-slate-400 font-mono text-[11px]">
            Total Ingested: {packets.length} packets
          </span>
          <button
            onClick={onClearHistory}
            className="text-slate-400 hover:text-rose-400 transition-colors text-[11px]"
          >
            Clear Ingest Buffer
          </button>
        </div>
      )}
    </div>
  );
};
