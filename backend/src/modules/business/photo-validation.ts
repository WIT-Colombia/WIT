import { AppError } from '../../shared/errors/app-error.js';

/** Límite para imágenes originales: admite 4K y evita dimensiones descomunales. */
export const MAX_PHOTO_EDGE = 8192;
export const MAX_PHOTO_PIXELS = 48_000_000;

function dimensions(data: Buffer, mime: string): { width: number; height: number } | null {
  if (mime === 'image/png') {
    if (data.length < 33 || data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        data.toString('ascii', 12, 16) !== 'IHDR' || data.readUInt32BE(8) !== 13) return null;
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  if (mime === 'image/webp') {
    if (data.length < 25 || data.toString('ascii', 0, 4) !== 'RIFF' ||
        data.toString('ascii', 8, 12) !== 'WEBP' || data.readUInt32LE(4) + 8 > data.length) return null;
    const kind = data.toString('ascii', 12, 16);
    if (kind === 'VP8X' && data.length >= 30)
      return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
    if (kind === 'VP8L' && data.length >= 25 && data[20] === 0x2f)
      return { width: 1 + (data[21] | ((data[22] & 0x3f) << 8)),
        height: 1 + (((data[22] & 0xc0) >> 6) | (data[23] << 2) | ((data[24] & 0x0f) << 10)) };
    if (kind === 'VP8 ' && data.length >= 30 && data[23] === 0x9d && data[24] === 0x01 && data[25] === 0x2a)
      return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
    return null;
  }
  if (mime === 'image/jpeg') {
    if (data.length < 12 || data[0] !== 0xff || data[1] !== 0xd8) return null;
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset++] !== 0xff) return null;
      while (data[offset] === 0xff && offset < data.length) offset++;
      const marker = data[offset++];
      if (marker === 0xd9 || marker === 0xda) return null;
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > data.length) return null;
      const length = data.readUInt16BE(offset);
      if (length < 2 || offset + length > data.length) return null;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {
        if (length < 7) return null;
        return { width: data.readUInt16BE(offset + 5), height: data.readUInt16BE(offset + 3) };
      }
      offset += length;
    }
  }
  return null;
}

/** Comprobación de estructura/dimensiones, NO sustituye decodificación completa. */
export function assertSafePhotoDimensions(buffer: Buffer, mimeType: string): void {
  const size = dimensions(buffer, mimeType);
  if (!size) throw new AppError(422, 'PHOTO_FORMAT_UNSUPPORTED', 'El archivo no contiene una cabecera de imagen válida.');
  if (size.width < 1 || size.height < 1 || size.width > MAX_PHOTO_EDGE ||
      size.height > MAX_PHOTO_EDGE || size.width * size.height > MAX_PHOTO_PIXELS)
    throw new AppError(422, 'PHOTO_DIMENSIONS_INVALID', 'La imagen supera las dimensiones admitidas. Se permiten fotografías 4K.');
}
