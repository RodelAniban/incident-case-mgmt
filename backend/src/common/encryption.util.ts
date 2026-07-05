import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

// Shared by evidence intake and case-image intake — both are "encrypt an
// uploaded blob at rest" with the same threat model, just different retention
// and access rules layered on top in their respective services.
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const raw = process.env.EVIDENCE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('EVIDENCE_ENCRYPTION_KEY is not set — see backend/.env.example');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('EVIDENCE_ENCRYPTION_KEY must decode to exactly 32 bytes (base64-encoded AES-256 key)');
  }
  return key;
}

export function sha256Hex(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function encryptBuffer(plaintext: Buffer): { ciphertext: Buffer; iv: string; authTag: string } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex') };
}

export function decryptBuffer(ciphertext: Buffer, ivHex: string, authTagHex: string): Buffer {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
