/**
 * High-speed CRC32 implementation for verifying packet integrity
 */
const makeCRCTable = (): Uint32Array => {
  let c: number;
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crcTable[n] = c;
  }
  return crcTable;
};

const crcTable = makeCRCTable();

export function calculateCRC32(str: string): string {
  let crc = 0 ^ -1;
  for (let i = 0; i < str.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xff];
  }
  return ((crc ^ -1) >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

export function generatePacketId(): string {
  return 'pkt_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
