import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Case, CaseImage, PirReport } from '../entities';
import { deleteCaseImageBlob } from './case-image-storage.util';

// A pasted image uploads immediately, well before the narrative/PIR section
// it's meant to sit in ever gets saved — a sweep running mid-edit could
// delete an image the user hasn't finished attaching to saved content yet.
// This is the window a sweep must leave alone.
const DEFAULT_GRACE_MS = 24 * 60 * 60 * 1000;

const IMAGE_URL_PATTERN = /\/api\/case-images\/([0-9a-fA-F-]{36})\/raw/g;

@Injectable()
export class NarrativeImageGcService {
  private readonly logger = new Logger(NarrativeImageGcService.name);

  constructor(
    @InjectRepository(CaseImage) private readonly images: Repository<CaseImage>,
    @InjectRepository(Case) private readonly cases: Repository<Case>,
    @InjectRepository(PirReport) private readonly pirReports: Repository<PirReport>,
  ) {}

  private extractReferencedPublicIds(text: string): Set<string> {
    const ids = new Set<string>();
    for (const match of text.matchAll(IMAGE_URL_PATTERN)) {
      ids.add(match[1].toLowerCase());
    }
    return ids;
  }

  /**
   * Deletes case images no saved content references anymore. "Referenced"
   * means: in the case's current narrative (Case.description), OR in *any*
   * PirReport version for the case — finalized reports are immutable
   * historical records, so an image a finalized report embeds must never be
   * reclaimed just because it later dropped out of the live narrative.
   * `graceMs` exists so tests don't have to wait out DEFAULT_GRACE_MS.
   */
  async sweepCase(caseId: number, graceMs: number = DEFAULT_GRACE_MS): Promise<{ deleted: number }> {
    const kase = await this.cases.findOne({ where: { id: caseId } });
    if (!kase) {
      return { deleted: 0 };
    }

    const referenced = this.extractReferencedPublicIds(kase.description ?? '');
    const reports = await this.pirReports.find({ where: { case: { id: caseId } } });
    for (const report of reports) {
      for (const id of this.extractReferencedPublicIds(report.sectionsJson ?? '')) {
        referenced.add(id);
      }
    }

    const cutoff = new Date(Date.now() - graceMs);
    const candidates = await this.images.find({ where: { case: { id: caseId } } });

    let deleted = 0;
    for (const image of candidates) {
      if (referenced.has(image.publicId.toLowerCase())) continue;
      if (image.createdAt > cutoff) continue; // could still be mid-edit — leave it for a later sweep
      try {
        deleteCaseImageBlob(image.storageRef);
      } catch (err) {
        this.logger.warn(`Could not delete blob for orphaned case image ${image.publicId}: ${err}`);
        continue;
      }
      await this.images.remove(image);
      deleted++;
    }
    if (deleted > 0) {
      this.logger.log(`Swept ${deleted} orphaned narrative image(s) for case ${caseId}`);
    }
    return { deleted };
  }

  /**
   * Nightly safety net. A per-save sweep (see CasesService/PirService) only
   * fires when saved content changes, so it can't catch an image that was
   * uploaded (e.g. pasted) and then never attached to any saved content at
   * all — there's no "save" event to hang that check off of. This sweeps
   * every case, relying on DEFAULT_GRACE_MS alone to protect images still
   * mid-edit.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async sweepAllCases(): Promise<{ deleted: number }> {
    const allCases = await this.cases.find({ select: ['id'] });
    let deleted = 0;
    for (const { id } of allCases) {
      deleted += (await this.sweepCase(id)).deleted;
    }
    if (deleted > 0) {
      this.logger.log(`Nightly sweep reclaimed ${deleted} orphaned narrative image(s) across ${allCases.length} case(s)`);
    }
    return { deleted };
  }
}
