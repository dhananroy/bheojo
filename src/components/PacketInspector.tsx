import React, { useState } from 'react';
import { Terminal, Search, ArrowUpRight, ArrowDownRight, Eye, X, Copy, Check, Filter } from 'lucide-react';
import { PacketLogEntry, PacketType } from '../types';
import { formatBytes } from '../utils/crc32';

interface PacketInspectorProps {
  logs: PacketLogEntry[];
  onClearLogs: () => void;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({ logs, onClearLogs }) => {
  const [selectedLog, setSelectedLog] = useState<PacketLogEntry | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  const filteredLogs = logs.filter((entry) => {
    if (filterType !== 'ALL' && entry.packet.header.type !== filterType) {
      return false;
    }
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const idMatch = entry.packet.header.id.toLowerCase().includes(s);
      const textMatch = entry.packet.payload.text?.toLowerCase().includes(s);
      const senderMatch = entry.packet.header.senderId.toLowerCase().includes(s);
      return idMatch || textMatch || senderMatch;
    }
    return true;
  });

  const getTypeBadge = (type: PacketType) => {
    switch (type) {
      case 'TEXT':
        return 'bg-blue-950 text-blue-400 border-blue-800/40';
      case 'IMAGE_CHUNK':
        return 'bg-indigo-950 text-indigo-400 border-indigo-800/40';
      case 'IMAGE_META':
        return 'bg-purple-950 text-purple-400 border-purple-800/40';
      case 'PING':
        return 'bg-amber-950 text-amber-400 border-amber-800/40';
      case 'ACK':
        return 'bg-emerald-950 text-emerald-400 border-emerald-800/40';
      case 'PULL_REQUEST':
        return 'bg-teal-950 text-teal-400 border-teal-800/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const handleCopyJson = async (obj: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  return (
    <div id="packet-inspector-container" className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl text-slate-100">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-2">
          <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
            <Terminal size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-100">Real-Time Data Packet Inspector</h3>
            <p className="text-xs text-slate-400">Live wire frame telemetry, checksums & raw packet payloads</p>
          </div>
        </div>

        {/* Search & Filter */}
        <div className="flex items-center space-x-2">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by ID, payload..."
              className="bg-slate-950 text-xs pl-7 pr-3 py-1.5 rounded-lg border border-slate-800 focus:outline-none focus:border-cyan-500 text-slate-200 w-40 sm:w-48"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 text-xs px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-300 focus:outline-none focus:border-cyan-500"
          >
            <option value="ALL">All Types</option>
            <option value="TEXT">TEXT</option>
            <option value="IMAGE_CHUNK">IMAGE_CHUNK</option>
            <option value="IMAGE_META">IMAGE_META</option>
            <option value="PING">PING</option>
            <option value="ACK">ACK</option>
          </select>

          <button
            onClick={onClearLogs}
            className="text-[11px] text-slate-400 hover:text-rose-400 px-2 py-1.5 rounded bg-slate-950 border border-slate-800 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Packet Stream Table */}
      <div className="mt-3 overflow-x-auto max-h-72 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="sticky top-0 bg-slate-950/90 backdrop-blur text-[10px] text-slate-400 uppercase tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-2 px-3">Direction</th>
              <th className="py-2 px-3">Seq #</th>
              <th className="py-2 px-3">Type</th>
              <th className="py-2 px-3">Packet ID</th>
              <th className="py-2 px-3">Size</th>
              <th className="py-2 px-3">CRC32</th>
              <th className="py-2 px-3">Time</th>
              <th className="py-2 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-slate-400 text-xs">
                  No packet telemetry recorded yet.
                </td>
              </tr>
            ) : (
              filteredLogs.map((entry) => {
                const pkt = entry.packet;
                const isSent = entry.direction === 'SENT';
                return (
                  <tr
                    key={`${pkt.header.id}_${entry.loggedAt}_${entry.direction}`}
                    className="hover:bg-slate-950/50 transition-colors group"
                  >
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          isSent
                            ? 'bg-blue-950/70 text-blue-400 border border-blue-800/40'
                            : 'bg-emerald-950/70 text-emerald-400 border border-emerald-800/40'
                        }`}
                      >
                        {isSent ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                        <span>{entry.direction}</span>
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-slate-300">#{pkt.header.seq}</td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getTypeBadge(pkt.header.type)}`}>
                        {pkt.header.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 truncate max-w-[120px]">
                      {pkt.header.id.substring(0, 12)}...
                    </td>
                    <td className="py-2 px-3 text-slate-400">
                      {formatBytes(pkt.header.sizeBytes || 64)}
                    </td>
                    <td className="py-2 px-3 text-slate-400">{pkt.header.checksum}</td>
                    <td className="py-2 px-3 text-slate-400 text-[10px]">
                      {new Date(entry.loggedAt).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setSelectedLog(entry)}
                        className="p-1 text-slate-400 hover:text-cyan-300 hover:bg-slate-800 rounded transition-colors"
                        title="View Packet Frame Details"
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Packet Deep Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center space-x-2">
                <span className="p-1.5 bg-cyan-500/10 text-cyan-400 rounded-lg">
                  <Terminal size={18} />
                </span>
                <div>
                  <h4 className="text-sm font-bold">DataPacket Frame Analysis</h4>
                  <p className="text-[11px] font-mono text-slate-400">
                    ID: {selectedLog.packet.header.id} • Seq #{selectedLog.packet.header.seq}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Packet Header Breakdown */}
            <div className="grid grid-cols-2 gap-2 my-3 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Type:</span>
                <span className="font-bold text-blue-400">{selectedLog.packet.header.type}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">CRC32 Checksum:</span>
                <span className="font-bold text-emerald-400">{selectedLog.packet.header.checksum}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Sender ID:</span>
                <span className="text-slate-200">{selectedLog.packet.header.senderId}</span>
              </div>
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">Wire Size:</span>
                <span className="text-slate-200">{formatBytes(selectedLog.packet.header.sizeBytes)}</span>
              </div>
            </div>

            {/* Raw JSON Dump */}
            <div className="flex-1 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300">
              <pre className="whitespace-pre-wrap">
                {JSON.stringify(selectedLog.packet, null, 2)}
              </pre>
            </div>

            <div className="mt-3 flex justify-between items-center">
              <button
                onClick={() => handleCopyJson(selectedLog.packet)}
                className="flex items-center space-x-1 text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700"
              >
                {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copied ? 'Copied JSON' : 'Copy Raw Packet'}</span>
              </button>
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
