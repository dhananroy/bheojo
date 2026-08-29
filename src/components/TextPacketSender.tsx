import React, { useState } from 'react';
import { Send, FileText, CheckCircle2, Hash, ShieldCheck, Sparkles, Terminal } from 'lucide-react';
import { calculateCRC32, formatBytes } from '../utils/crc32';

interface TextPacketSenderProps {
  onSendTextPacket: (text: string) => void;
  isConnected: boolean;
}

const PRESETS = [
  '⚡ High-Priority Telemetry: Status OK, CPU=24%, Memory=112MB',
  '📍 Geolocation Beacon: Lat 37.7749° N, Lon 122.4194° W',
  '🔒 Encrypted Peer Handshake: Zero Server Upload Verified',
  '🚀 P2P Real-Time Packet Stream initialized across direct WebRTC channel',
];

export const TextPacketSender: React.FC<TextPacketSenderProps> = ({
  onSendTextPacket,
  isConnected,
}) => {
  const [text, setText] = useState('Hello from Peer A! Real-time direct packet delivery.');
  const [sentCount, setSentCount] = useState(0);
  const [justSent, setJustSent] = useState(false);

  const crc = calculateCRC32(text);
  const byteLength = new Blob([text]).size;

  const handleSend = () => {
    if (!text.trim()) return;
    onSendTextPacket(text);
    setSentCount((c) => c + 1);
    setJustSent(true);
    setTimeout(() => setJustSent(false), 1200);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSend();
    }
  };

  return (
    <div id="text-packet-sender-card" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
              <FileText size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Text Data Packet Composer</h3>
              <p className="text-xs text-slate-400">Assemble structured payload with CRC32 verification</p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            {formatBytes(byteLength)}
          </span>
        </div>

        {/* Text Input */}
        <div className="relative">
          <textarea
            id="text-packet-payload-input"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type text message or payload data..."
            className="w-full bg-slate-950 text-slate-100 font-mono text-xs p-3.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500 transition-colors resize-none"
          />
        </div>

        {/* Packet Header Metadata Preview */}
        <div className="grid grid-cols-2 gap-2 my-3 text-[11px] font-mono">
          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between text-slate-400">
            <span className="flex items-center space-x-1">
              <Hash size={12} className="text-slate-500" />
              <span>CRC32 Checksum:</span>
            </span>
            <span className="text-blue-400 font-bold">{crc}</span>
          </div>

          <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800/80 flex items-center justify-between text-slate-400">
            <span className="flex items-center space-x-1">
              <ShieldCheck size={12} className="text-slate-500" />
              <span>Storage Route:</span>
            </span>
            <span className="text-emerald-400 font-bold">0% Server (P2P)</span>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="space-y-1.5 mb-4">
          <span className="text-[11px] text-slate-400 font-medium block">Quick Payload Presets:</span>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((preset, idx) => (
              <button
                key={idx}
                id={`preset-btn-${idx}`}
                onClick={() => setText(preset)}
                className="text-[10px] text-slate-300 hover:text-white bg-slate-950 hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-800 transition-colors text-left truncate max-w-full"
              >
                {preset.substring(0, 36)}...
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hero Action Button 1: SEND PACKET */}
      <div>
        <button
          id="hero-send-text-packet-btn"
          onClick={handleSend}
          disabled={!text.trim()}
          className={`w-full relative group overflow-hidden py-3 px-4 rounded-xl font-bold text-sm text-white shadow-lg transition-all transform active:scale-[0.98] ${
            justSent
              ? 'bg-emerald-600 shadow-emerald-500/25'
              : !isConnected
              ? 'bg-blue-600/80 hover:bg-blue-600 shadow-blue-500/20'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/30'
          }`}
        >
          <div className="flex items-center justify-center space-x-2">
            {justSent ? (
              <>
                <CheckCircle2 size={18} className="animate-bounce text-emerald-200" />
                <span>PACKET TRANSMITTED!</span>
              </>
            ) : (
              <>
                <Send size={18} className="transition-transform group-hover:translate-x-1" />
                <span>BUTTON 1: SEND TEXT PACKET</span>
              </>
            )}
          </div>
        </button>
        <p className="text-[10px] text-center text-slate-400 mt-1.5">
          Shortcut: <kbd className="font-mono bg-slate-800 px-1 py-0.5 rounded text-slate-300">Ctrl+Enter</kbd> • Packets dispatched directly to connected peer
        </p>
      </div>
    </div>
  );
};
