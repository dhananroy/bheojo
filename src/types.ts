export type PacketType = 'TEXT' | 'IMAGE_CHUNK' | 'IMAGE_META' | 'PING' | 'ACK' | 'PULL_REQUEST';

export interface PacketHeader {
  id: string;
  seq: number;
  timestamp: number;
  type: PacketType;
  senderId: string;
  checksum: string;
  sizeBytes: number;
  totalChunks?: number;
  chunkIndex?: number;
  transferId?: string;
}

export interface DataPacket {
  header: PacketHeader;
  payload: {
    text?: string;
    imageChunk?: string; // base64 chunk
    imageMeta?: {
      transferId: string;
      fileName: string;
      fileType: string;
      totalSize: number;
      totalChunks: number;
      dimensions?: { width: number; height: number };
    };
    ackForId?: string;
    rtt?: number;
    notes?: string;
  };
}

export interface PacketLogEntry {
  packet: DataPacket;
  direction: 'SENT' | 'RECEIVED';
  status: 'DELIVERED' | 'ACKNOWLEDGED' | 'PENDING' | 'RECONSTRUCTED';
  loggedAt: number;
  rttMs?: number;
}

export interface ImageReconstruction {
  transferId: string;
  fileName: string;
  fileType: string;
  totalSize: number;
  totalChunks: number;
  receivedChunks: Map<number, string>;
  dimensions?: { width: number; height: number };
  startedAt: number;
  completedAt?: number;
  assembledDataUrl?: string;
  isComplete: boolean;
}

export type ConnectionMode = 'WEBRTC_QR' | 'OPTICAL_STREAM' | 'LOCAL_SIMULATOR';

export type PeerConnectionStatus = 'DISCONNECTED' | 'GENERATING_OFFER' | 'AWAITING_ANSWER' | 'CONNECTING' | 'CONNECTED' | 'FAILED';

export interface NetworkStats {
  packetsSent: number;
  packetsReceived: number;
  bytesSent: number;
  bytesReceived: number;
  lastRttMs: number;
  avgRttMs: number;
  transferSpeedBps: number;
  connectionUptimeSeconds: number;
}
