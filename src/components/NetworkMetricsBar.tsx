import React from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Clock, Gauge, Wifi, WifiOff } from 'lucide-react';
import { NetworkStats, PeerConnectionStatus } from '../types';
import { formatBytes } from '../utils/crc32';

interface NetworkMetricsBarProps {
  stats: NetworkStats;
  connectionStatus: string;
  isConnected: boolean;
  onSendPing: () => void;
  onOpenQRConnect: () => void;
}

export const NetworkMetricsBar: React.FC<NetworkMetricsBarProps> = ({
  stats,
  connectionStatus,
  isConnected,
  onSendPing,
  onOpenQRConnect,
}) => {
  const getLatencyColor = (rtt: number) => {
    if (rtt <= 0) return 'text-slate-400';
    if (rtt < 50) return 'text-emerald-400';
    if (rtt < 150) return 'text-amber-400';
    return 'text-rose-400';
  };

  return (
    <div
      id="network-metrics-bar"
      className="bg-slate-900/90 backdrop-blur border border-slate-800 rounded-2xl p-4 shadow-xl"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Connection Status Badge */}
        <div className="flex items-center space-x-3">
          <div className="relative flex items-center justify-center">
            {isConnected ? (
              <span className="relative flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="inline-flex rounded-full h-3.5 w-3.5 bg-rose-500"></span>
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-100">
                {isConnected ? 'P2P Link Active' : 'P2P Link Standby'}
              </span>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  isConnected
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {connectionStatus}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Direct WebRTC DataChannel (0 Server Upload)</p>
          </div>
        </div>

        {/* Real-Time Metrics Counters */}
        <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs">
          {/* Packets Transferred */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80">
            <ArrowUpRight size={15} className="text-blue-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Sent</span>
              <span className="font-mono font-bold text-slate-200">
                {stats.packetsSent} <span className="text-[10px] font-normal text-slate-400">({formatBytes(stats.bytesSent)})</span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80">
            <ArrowDownRight size={15} className="text-emerald-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Recv</span>
              <span className="font-mono font-bold text-slate-200">
                {stats.packetsReceived} <span className="text-[10px] font-normal text-slate-400">({formatBytes(stats.bytesReceived)})</span>
              </span>
            </div>
          </div>

          {/* RTT Latency */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80">
            <Activity size={15} className="text-purple-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">RTT Latency</span>
              <span className={`font-mono font-bold ${getLatencyColor(stats.lastRttMs)}`}>
                {stats.lastRttMs > 0 ? `${stats.lastRttMs} ms` : '—'}
              </span>
            </div>
          </div>

          {/* Throughput */}
          <div className="flex items-center space-x-2 bg-slate-950/80 px-3 py-1.5 rounded-xl border border-slate-800/80">
            <Gauge size={15} className="text-cyan-400" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Throughput</span>
              <span className="font-mono font-bold text-slate-200">
                {formatBytes(stats.transferSpeedBps)}/s
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2">
          {isConnected && (
            <button
              id="ping-btn"
              onClick={onSendPing}
              className="flex items-center space-x-1 px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-lg text-xs font-semibold transition-colors"
              title="Send Round-Trip Latency Diagnostic Packet"
            >
              <Activity size={13} />
              <span>Ping RTT</span>
            </button>
          )}

          <button
            id="qr-pairing-modal-toggle-btn"
            onClick={onOpenQRConnect}
            className={`flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all ${
              isConnected
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
            }`}
          >
            {isConnected ? <Wifi size={14} className="text-emerald-400" /> : <WifiOff size={14} />}
            <span>{isConnected ? 'QR Connection Details' : 'Pair Clients via QR'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
