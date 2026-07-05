import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

// Shared by evidence intake, case-image intake, and MFA TOTP secret storage —
// all three are "encrypt sensitive bytes at rest under one app key" with the
// same threat model, just different retention and access rules layered on
// top in their respective services.
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

/** Passes chunks through unchanged while feeding them to `hash` — lets a pipeline compute a digest as a side effect, without a separate buffered pass. */
function hashingPassThrough(hash: ReturnType<typeof createHash>): Transform {
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      callback(null, chunk);
    },
  });
}

/**
 * Streaming counterpart to encryptBuffer — for evidence uploads, where
 * buffering the whole file (potentially a multi-GB disk image or memory
 * dump) in a Buffer first would be the actual scaling problem. Encrypts
 * `plaintext` straight into `destination`, computing the plaintext's
 * SHA-256 as a side effect of the same pass rather than a second read.
 */
export async function encryptStreamToFile(
  plaintext: NodeJS.ReadableStream,
  destination: NodeJS.WritableStream,
): Promise<{ iv: string; authTag: string; sha256: string; sizeBytes: number }> {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const hash = createHash('sha256');
  let sizeBytes = 0;
  const measure = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      hash.update(chunk);
      sizeBytes += chunk.length;
      callback(null, chunk);
    },
  });

  await pipeline(plaintext, measure, cipher, destination);

  return { iv: iv.toString('hex'), authTag: cipher.getAuthTag().toString('hex'), sha256: hash.digest('hex'), sizeBytes };
}

/**
 * Streaming counterpart to decryptBuffer. GCM's auth tag can only be
 * verified once the *entire* ciphertext has been processed (the check
 * happens inside decipher.final(), which `pipeline` awaits internally) —
 * so this writes to `destination` (meant to be a temp file, never the HTTP
 * response directly) and only resolves once the tag has actually checked
 * out. A caller that streamed straight to the client instead would risk
 * serving tampered plaintext before discovering the tag was invalid.
 * Also returns the plaintext's SHA-256, computed in the same pass, for the
 * existing hash-matches-what-was-stored re-check.
 */
export async function decryptStreamToFile(
  ciphertext: NodeJS.ReadableStream,
  ivHex: string,
  authTagHex: string,
  destination: NodeJS.WritableStream,
): Promise<{ sha256: string }> {
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const hash = createHash('sha256');

  await pipeline(ciphertext, decipher, hashingPassThrough(hash), destination);

  return { sha256: hash.digest('hex') };
}
