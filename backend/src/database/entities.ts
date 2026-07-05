import {
  AdminAuditEntry,
  Case,
  CaseHistoryEntry,
  CaseImage,
  CaseThreatIndicator,
  ChatMessage,
  EvidenceAccessGrant,
  EvidenceCustodyEntry,
  EvidenceItem,
  PirActionItem,
  PirReport,
  RevokedToken,
  Team,
  ThreatIndicator,
  ThreatShareRequest,
  ThreatWatchlistMatch,
  User,
} from '../entities';

// Shared by DatabaseModule (the app's runtime connection) and data-source.ts
// (the TypeORM CLI's connection for migration:generate/run) — one list, so
// the two can never drift and produce a migration against the wrong schema.
export const ENTITIES = [
  AdminAuditEntry,
  Case,
  CaseHistoryEntry,
  CaseImage,
  CaseThreatIndicator,
  ChatMessage,
  EvidenceAccessGrant,
  EvidenceCustodyEntry,
  EvidenceItem,
  PirActionItem,
  PirReport,
  RevokedToken,
  Team,
  ThreatIndicator,
  ThreatShareRequest,
  ThreatWatchlistMatch,
  User,
];
