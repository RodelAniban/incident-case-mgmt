import { ComingSoon } from '../components/ComingSoon';

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
