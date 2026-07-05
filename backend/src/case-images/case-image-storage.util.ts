import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

function storageRoot(): string {
  return process.env.CASE_IMAGE_STORAGE_DIR ?? './data/case-images';
}

// No WORM lock here (unlike evidence) — these are illustrative narrative images,
// not forensic artifacts, and there's no chain-of-custody requirement to preserve.
export function writeCaseImageBlob(caseId: number, filename: string, data: Buffer): string {
  const dir = join(storageRoot(), String(caseId));
  mkdirSync(dir, { recursive: true });
  const path = join(dir, filename);
  if (existsSync(path)) {
    throw new Error(`Case image blob already exists at ${path}`);
  }
  writeFileSync(path, data);
  return join(String(caseId), filename);
}

export function readCaseImageBlob(storageRef: string): Buffer {
  return readFileSync(join(storageRoot(), storageRef));
}

/** Used by NarrativeImageGcService to reclaim blobs no saved content references anymore. */
export function deleteCaseImageBlob(storageRef: string): void {
  rmSync(join(storageRoot(), storageRef), { force: true });
}
