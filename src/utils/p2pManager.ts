import { DataPacket, PacketHeader, PacketType, ImageReconstruction, NetworkStats } from '../types';
import { calculateCRC32, generatePacketId } from './crc32';

// STUN servers for reliable direct NAT traversal without any media relay/upload
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export class P2PConnectionManager {
  private peerConnection: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private broadcastChannel: BroadcastChannel | null = null;
  private localClientId: string;
  private seqCounter = 0;
  private imageReconstructions = new Map<string, ImageReconstruction>();

  public onStatusChange?: (status: string, isConnected: boolean) => void;
  public onPacketReceived?: (packet: DataPacket) => void;
  public onPacketSent?: (packet: DataPacket) => void;
  public onImageReconstructed?: (reconstruction: ImageReconstruction) => void;
  public onImageChunkProgress?: (transferId: string, received: number, total: number) => void;
  public onStatsUpdate?: (stats: NetworkStats) => void;

  private stats: NetworkStats = {
    packetsSent: 0,
    packetsReceived: 0,
    bytesSent: 0,
    bytesReceived: 0,
    lastRttMs: 0,
    avgRttMs: 0,
    transferSpeedBps: 0,
    connectionUptimeSeconds: 0,
  };

  private pingTimers = new Map<string, number>();
  private startTime = 0;
  private speedWindowBytes = 0;
  private speedIntervalId?: number;

  constructor() {
    this.localClientId = 'client_' + Math.random().toString(36).substring(2, 7);
    this.initBroadcastChannel();
    this.startSpeedTracker();
  }

  public getClientId(): string {
    return this.localClientId;
  }

  public isConnected(): boolean {
    return this.dataChannel?.readyState === 'open';
  }

  private startSpeedTracker() {
    if (typeof window === 'undefined') return;
    this.speedIntervalId = window.setInterval(() => {
      this.stats.transferSpeedBps = this.speedWindowBytes;
      this.speedWindowBytes = 0;
      if (this.startTime > 0 && this.isConnected()) {
        this.stats.connectionUptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
      }
      this.onStatsUpdate?.({ ...this.stats });
    }, 1000);
  }

  private initBroadcastChannel() {
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        this.broadcastChannel = new BroadcastChannel('p2p_packet_channel');
        this.broadcastChannel.onmessage = (event) => {
          try {
            const data = event.data;
            if (data && data._p2p_signaling) {
              this.handleBroadcastSignaling(data);
            }
          } catch (err) {
            console.warn('Broadcast channel msg err:', err);
          }
        };
      }
    } catch (e) {
      console.warn('BroadcastChannel not supported:', e);
    }
  }

  // --- WebRTC SDP Handshake via QR Code ---

  public async createOffer(): Promise<string> {
    this.cleanup();
    this.onStatusChange?.('Generating WebRTC Offer...', false);

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.setupPeerConnectionListeners();

    // Create Data Channel
    this.dataChannel = this.peerConnection.createDataChannel('p2p-packets', {
      ordered: true,
    });
    this.setupDataChannelListeners();

    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);

    // Wait for ICE gathering to complete so all candidates are bundled in single QR
    await this.waitForIceGathering(this.peerConnection);

    const fullOffer = this.peerConnection.localDescription;
    const signalingPayload = JSON.stringify({
      type: 'OFFER',
      sdp: fullOffer?.sdp,
      sender: this.localClientId,
    });

    this.onStatusChange?.('Offer QR Ready! Scan on Receiver', false);

    // Also notify local broadcast channel in case second tab is open
    this.broadcastChannel?.postMessage({
      _p2p_signaling: true,
      type: 'OFFER',
      payload: signalingPayload,
      from: this.localClientId,
    });

    return signalingPayload;
  }

  public async handleOfferAndCreateAnswer(offerJsonString: string): Promise<string> {
    this.cleanup();
    this.onStatusChange?.('Ingesting Offer & Generating Answer...', false);

    const parsed = JSON.parse(offerJsonString);
    if (!parsed.sdp) throw new Error('Invalid Offer format');

    this.peerConnection = new RTCPeerConnection(ICE_SERVERS);
    this.setupPeerConnectionListeners();

    this.peerConnection.ondatachannel = (event) => {
      this.dataChannel = event.channel;
      this.setupDataChannelListeners();
    };

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'offer', sdp: parsed.sdp })
    );

    const answer = await this.peerConnection.createAnswer();
    await this.peerConnection.setLocalDescription(answer);

    await this.waitForIceGathering(this.peerConnection);

    const fullAnswer = this.peerConnection.localDescription;
    const signalingPayload = JSON.stringify({
      type: 'ANSWER',
      sdp: fullAnswer?.sdp,
      sender: this.localClientId,
    });

    this.onStatusChange?.('Answer QR Ready! Scan back on Host', false);

    // Broadcast if in multi-tab test
    this.broadcastChannel?.postMessage({
      _p2p_signaling: true,
      type: 'ANSWER',
      payload: signalingPayload,
      from: this.localClientId,
    });

    return signalingPayload;
  }

  public async handleAnswer(answerJsonString: string): Promise<void> {
    if (!this.peerConnection) {
      throw new Error('No active connection. Create an Offer first.');
    }
    const parsed = JSON.parse(answerJsonString);
    if (!parsed.sdp) throw new Error('Invalid Answer format');

    await this.peerConnection.setRemoteDescription(
      new RTCSessionDescription({ type: 'answer', sdp: parsed.sdp })
    );
    this.onStatusChange?.('Connecting to Peer...', false);
  }

  private handleBroadcastSignaling(data: any) {
    if (data.from === this.localClientId) return;
    // Auto-discover in same-browser tabs if user enabled quick-pair
    console.log('Discovered local peer via BroadcastChannel:', data.type);
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }
      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };
      pc.addEventListener('icegatheringstatechange', checkState);
      // Timeout after 3.5s to not block QR display if slow STUN
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 3500);
    });
  }

  private setupPeerConnectionListeners() {
    if (!this.peerConnection) return;

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      if (state === 'connected') {
        this.startTime = Date.now();
        this.onStatusChange?.('P2P WebRTC Connected!', true);
      } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        this.onStatusChange?.(`Connection ${state}`, false);
      }
    };
  }

  private setupDataChannelListeners() {
    if (!this.dataChannel) return;

    this.dataChannel.onopen = () => {
      this.startTime = Date.now();
      this.onStatusChange?.('Real-Time DataChannel Open & Active', true);
      // Send initial handshake ping
      this.sendPing('Initial Connection Handshake');
    };

    this.dataChannel.onclose = () => {
      this.onStatusChange?.('DataChannel Closed', false);
    };

    this.dataChannel.onerror = (err) => {
      console.error('DataChannel error:', err);
      this.onStatusChange?.('DataChannel Error', false);
    };

    this.dataChannel.onmessage = (event) => {
      try {
        const raw = event.data;
        const byteSize = typeof raw === 'string' ? new Blob([raw]).size : (raw as ArrayBuffer).byteLength;
        this.stats.packetsReceived++;
        this.stats.bytesReceived += byteSize;
        this.speedWindowBytes += byteSize;

        const packet: DataPacket = JSON.parse(raw);
        this.processIncomingPacket(packet);
      } catch (err) {
        console.error('Failed to parse incoming packet:', err);
      }
    };
  }

  // --- Packet Dispatching & Handling ---

  public sendPacket(packet: DataPacket): boolean {
    if (!this.isConnected() || !this.dataChannel) {
      // If not connected via WebRTC, check if we can simulate/broadcast
      console.warn('DataChannel is not open. Trying fallback broadcast...');
      this.broadcastChannel?.postMessage({
        _p2p_simulated_packet: true,
        packet,
      });
      return false;
    }

    const json = JSON.stringify(packet);
    const byteSize = new Blob([json]).size;
    packet.header.sizeBytes = byteSize;

    this.dataChannel.send(json);

    this.stats.packetsSent++;
    this.stats.bytesSent += byteSize;
    this.speedWindowBytes += byteSize;

    if (packet.header.type === 'PING') {
      this.pingTimers.set(packet.header.id, Date.now());
    }

    this.onPacketSent?.(packet);
    this.onStatsUpdate?.({ ...this.stats });
    return true;
  }

  public createTextPacket(text: string): DataPacket {
    this.seqCounter++;
    const id = generatePacketId();
    const timestamp = Date.now();
    const checksum = calculateCRC32(text);

    return {
      header: {
        id,
        seq: this.seqCounter,
        timestamp,
        type: 'TEXT',
        senderId: this.localClientId,
        checksum,
        sizeBytes: 0,
      },
      payload: {
        text,
      },
    };
  }

  public sendPing(notes = 'Diagnostic Ping'): void {
    this.seqCounter++;
    const id = generatePacketId();
    const packet: DataPacket = {
      header: {
        id,
        seq: this.seqCounter,
        timestamp: Date.now(),
        type: 'PING',
        senderId: this.localClientId,
        checksum: calculateCRC32(notes),
        sizeBytes: 0,
      },
      payload: {
        notes,
      },
    };
    this.sendPacket(packet);
  }

  public sendPullRequest(notes = 'Requesting Peer Packet Ingestion'): void {
    this.seqCounter++;
    const id = generatePacketId();
    const packet: DataPacket = {
      header: {
        id,
        seq: this.seqCounter,
        timestamp: Date.now(),
        type: 'PULL_REQUEST',
        senderId: this.localClientId,
        checksum: calculateCRC32(notes),
        sizeBytes: 0,
      },
      payload: {
        notes,
      },
    };
    this.sendPacket(packet);
  }

  public async sendImageInPackets(
    file: File | Blob,
    fileName: string,
    chunkSizeBytes = 32 * 1024,
    onProgress?: (sent: number, total: number) => void
  ): Promise<string> {
    const transferId = 'img_' + Math.random().toString(36).substring(2, 9);
    const dataUrl = await this.blobToDataUrl(file);
    const totalSize = dataUrl.length;

    // Split dataUrl string into chunks
    const chunks: string[] = [];
    for (let i = 0; i < totalSize; i += chunkSizeBytes) {
      chunks.push(dataUrl.slice(i, i + chunkSizeBytes));
    }
    const totalChunks = chunks.length;

    // Send metadata packet first
    this.seqCounter++;
    const metaPacket: DataPacket = {
      header: {
        id: generatePacketId(),
        seq: this.seqCounter,
        timestamp: Date.now(),
        type: 'IMAGE_META',
        senderId: this.localClientId,
        checksum: calculateCRC32(transferId + fileName + totalChunks),
        sizeBytes: 0,
        transferId,
        totalChunks,
      },
      payload: {
        imageMeta: {
          transferId,
          fileName,
          fileType: file.type || 'image/png',
          totalSize,
          totalChunks,
        },
      },
    };
    this.sendPacket(metaPacket);

    // Send chunk packets with gentle pacing to avoid WebRTC buffer overflow
    for (let i = 0; i < totalChunks; i++) {
      this.seqCounter++;
      const chunkData = chunks[i];
      const chunkPacket: DataPacket = {
        header: {
          id: generatePacketId(),
          seq: this.seqCounter,
          timestamp: Date.now(),
          type: 'IMAGE_CHUNK',
          senderId: this.localClientId,
          checksum: calculateCRC32(chunkData),
          sizeBytes: chunkData.length,
          transferId,
          totalChunks,
          chunkIndex: i,
        },
        payload: {
          imageChunk: chunkData,
        },
      };

      this.sendPacket(chunkPacket);
      onProgress?.(i + 1, totalChunks);

      // Micro delay for network buffer pacing
      if (i % 5 === 0) {
        await new Promise((r) => setTimeout(r, 8));
      }
    }

    return transferId;
  }

  private processIncomingPacket(packet: DataPacket) {
    // Verify checksum
    if (packet.header.type === 'TEXT' && packet.payload.text) {
      const calculated = calculateCRC32(packet.payload.text);
      if (calculated !== packet.header.checksum) {
        console.warn('CRC32 checksum mismatch on packet', packet.header.id);
      }
    }

    // Auto-reply with ACK for TEXT and IMAGE_CHUNK
    if (packet.header.type === 'TEXT' || packet.header.type === 'IMAGE_CHUNK' || packet.header.type === 'PING') {
      this.sendAck(packet.header.id, packet.header.seq);
    }

    // Handle ACK to compute Round-Trip-Time (RTT)
    if (packet.header.type === 'ACK' && packet.payload.ackForId) {
      const sentTime = this.pingTimers.get(packet.payload.ackForId);
      if (sentTime) {
        const rtt = Date.now() - sentTime;
        this.pingTimers.delete(packet.payload.ackForId);
        this.stats.lastRttMs = rtt;
        this.stats.avgRttMs = this.stats.avgRttMs === 0 ? rtt : Math.round((this.stats.avgRttMs * 0.8) + (rtt * 0.2));
        this.onStatsUpdate?.({ ...this.stats });
      }
    }

    // Handle IMAGE_META
    if (packet.header.type === 'IMAGE_META' && packet.payload.imageMeta) {
      const meta = packet.payload.imageMeta;
      this.imageReconstructions.set(meta.transferId, {
        transferId: meta.transferId,
        fileName: meta.fileName,
        fileType: meta.fileType,
        totalSize: meta.totalSize,
        totalChunks: meta.totalChunks,
        receivedChunks: new Map<number, string>(),
        startedAt: Date.now(),
        isComplete: false,
      });
      this.onImageChunkProgress?.(meta.transferId, 0, meta.totalChunks);
    }

    // Handle IMAGE_CHUNK
    if (packet.header.type === 'IMAGE_CHUNK' && packet.header.transferId !== undefined && packet.header.chunkIndex !== undefined && packet.payload.imageChunk) {
      const transferId = packet.header.transferId;
      let rec = this.imageReconstructions.get(transferId);
      if (!rec && packet.header.totalChunks) {
        // Create fallback reconstruction entry if meta arrived out of order
        rec = {
          transferId,
          fileName: `received_image_${Date.now()}.png`,
          fileType: 'image/png',
          totalSize: 0,
          totalChunks: packet.header.totalChunks,
          receivedChunks: new Map<number, string>(),
          startedAt: Date.now(),
          isComplete: false,
        };
        this.imageReconstructions.set(transferId, rec);
      }

      if (rec) {
        rec.receivedChunks.set(packet.header.chunkIndex, packet.payload.imageChunk);
        this.onImageChunkProgress?.(transferId, rec.receivedChunks.size, rec.totalChunks);

        if (rec.receivedChunks.size >= rec.totalChunks && !rec.isComplete) {
          // Reassemble full data URL!
          const fullChunks: string[] = [];
          for (let i = 0; i < rec.totalChunks; i++) {
            fullChunks.push(rec.receivedChunks.get(i) || '');
          }
          rec.assembledDataUrl = fullChunks.join('');
          rec.completedAt = Date.now();
          rec.isComplete = true;
          this.onImageReconstructed?.(rec);
        }
      }
    }

    this.onPacketReceived?.(packet);
    this.onStatsUpdate?.({ ...this.stats });
  }

  private sendAck(forId: string, forSeq: number) {
    if (!this.isConnected() || !this.dataChannel) return;
    const ackPacket: DataPacket = {
      header: {
        id: generatePacketId(),
        seq: this.seqCounter++,
        timestamp: Date.now(),
        type: 'ACK',
        senderId: this.localClientId,
        checksum: calculateCRC32(forId),
        sizeBytes: 0,
      },
      payload: {
        ackForId: forId,
        notes: `ACK for Seq #${forSeq}`,
      },
    };
    try {
      this.dataChannel.send(JSON.stringify(ackPacket));
    } catch (e) {
      // ignore transient send failures
    }
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  public cleanup() {
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
  }

  public destroy() {
    this.cleanup();
    if (this.speedIntervalId) {
      clearInterval(this.speedIntervalId);
    }
    if (this.broadcastChannel) {
      this.broadcastChannel.close();
      this.broadcastChannel = null;
    }
  }
}
