import { ComingSoon } from '../components/ComingSoon';

export const EvidencePlaceholder = () => (
  <ComingSoon
    title="Evidence Management"
    phase={2}
    description="Forensically sound intake, SHA-256 hashing, and an append-only chain-of-custody ledger for every artifact attached to a case."
  />
);

export const ChatPlaceholder = () => (
  <ComingSoon
    title="Secure Analyst Chat & Notes"
    phase={3}
    description="Case-scoped, encrypted collaboration with structured findings and shift hand-off notes — without leaving the platform."
  />
);

export const PirPlaceholder = () => (
  <ComingSoon
    title="Post-Incident Review Templates"
    phase={4}
    description="Standardized root-cause analysis, auto-populated timelines, and tracked remediation action items."
  />
);

export const ThreatIntelPlaceholder = () => (
  <ComingSoon
    title="Threat Intelligence Integration"
    phase={5}
    description="STIX/TAXII and MISP feed ingestion, automatic enrichment, and watchlist matching against open cases."
  />
);

export const AdminUsersPlaceholder = () => (
  <ComingSoon
    title="User & Role Administration"
    phase={1}
    description="Full user management UI is next up — for now, seed or edit users directly via the backend seed script."
  />
);
