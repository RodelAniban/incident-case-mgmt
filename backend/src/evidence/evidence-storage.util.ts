import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'fs';
import { join } from 'path';

function storageRoot(): string {
  return process.env.EVIDENCE_STORAGE_DIR ?? './data/evidence';
}

function storageDirFor(caseId: number): string {
  return join(storageRoot(), String(caseId));
}

/**
 * Writes an encrypted blob and immediately locks it read-only, simulating the
 * WORM/retention-locked object storage called for in the architecture plan.
 * Returns a storageRef relative to EVIDENCE_STORAGE_DIR.
 */
export function writeWormBlob(caseId: number, filename: string, data: Buffer): string {
  const dir = storageDirFor(caseId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  if (existsSync(path)) {
    throw new Error(`Evidence blob already exists at ${path} — refusing to overwrite a write-once original`);
  }
  writeFileSync(path, data);
  chmodSync(path, 0o444);
  return join(String(caseId), filename);
}

export function readWormBlob(storageRef: string): Buffer {
  return readFileSync(join(storageRoot(), storageRef));
}
