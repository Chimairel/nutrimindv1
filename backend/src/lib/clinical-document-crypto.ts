import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function encryptionKey(): Buffer {
  const raw = process.env.CLINICAL_DOCUMENT_ENCRYPTION_KEY?.trim();
  if (!raw) throw new Error('Clinical document encryption is not configured.');
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('CLINICAL_DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptClinicalDocument(payload: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encryptedPayload = Buffer.concat([cipher.update(payload), cipher.final()]);
  return {
    encryptedPayload,
    encryptionIv: iv,
    encryptionAuthTag: cipher.getAuthTag(),
    sha256: createHash('sha256').update(payload).digest('hex'),
  };
}

export function decryptClinicalDocument(input: {
  encryptedPayload: Uint8Array;
  encryptionIv: Uint8Array;
  encryptionAuthTag: Uint8Array;
}): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(input.encryptionIv));
  decipher.setAuthTag(Buffer.from(input.encryptionAuthTag));
  return Buffer.concat([decipher.update(Buffer.from(input.encryptedPayload)), decipher.final()]);
}

export function detectClinicalDocumentMime(payload: Buffer): 'application/pdf' | 'image/jpeg' | 'image/png' | null {
  if (payload.length >= 5 && payload.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  if (payload.length >= 3 && payload[0] === 0xff && payload[1] === 0xd8 && payload[2] === 0xff) return 'image/jpeg';
  if (
    payload.length >= 8 &&
    payload[0] === 0x89 &&
    payload.subarray(1, 4).toString('ascii') === 'PNG' &&
    payload[4] === 0x0d &&
    payload[5] === 0x0a &&
    payload[6] === 0x1a &&
    payload[7] === 0x0a
  )
    return 'image/png';
  return null;
}
