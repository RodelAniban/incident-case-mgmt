import { chmodSync, createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

function storageRoot(): string {
  return process.env.EVIDENCE_STORAGE_DIR ?? './data/evidence';
}

function storageDirFor(caseId: number): string {
  return join(storageRoot(), String(caseId));
}

/**
 * Opens a write stream at a fresh WORM path (refusing to ever overwrite an
 * existing blob) and hands it back unlocked — the caller streams ciphertext
 * into it, then calls lockWormBlob() once writing has actually finished.
 * Splitting "open for write" from "lock" means a failed/partial write never
 * gets chmod'd read-only; the caller is expected to delete the partial file
 * on error instead.
 */
export function openWormBlobForWrite(caseId: number, filename: string): { stream: NodeJS.WritableStream; path: string; storageRef: string } {
  const dir = storageDirFor(caseId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  if (existsSync(path)) {
    throw new Error(`Evidence blob already exists at ${path} — refusing to overwrite a write-once original`);
  }
  return { stream: createWriteStream(path), path, storageRef: join(String(caseId), filename) };
}

/** Locks a just-written blob read-only — call only once its write stream has fully flushed and closed. */
export function lockWormBlob(storageRef: string): void {
  chmodSync(join(storageRoot(), storageRef), 0o444);
}

export function readWormBlobStream(storageRef: string): NodeJS.ReadableStream {
  return createReadStream(join(storageRoot(), storageRef));
}
