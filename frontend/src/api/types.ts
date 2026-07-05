export enum Role {
  ANALYST_L1 = 'analyst_l1',
  ANALYST_L2 = 'analyst_l2',
  IR_LEAD = 'ir_lead',
  CISO_MANAGER = 'ciso_manager',
  AUDITOR = 'auditor',
  ADMIN = 'admin',
}

export const ROLE_LABELS: Record<Role, string> = {
  [Role.ANALYST_L1]: 'Analyst L1',
  [Role.ANALYST_L2]: 'Analyst L2',
  [Role.IR_LEAD]: 'IR Lead',
  [Role.CISO_MANAGER]: 'CISO / Manager',
  [Role.AUDITOR]: 'Auditor',
  [Role.ADMIN]: 'Admin',
};

export enum Permission {
  VIEW_ASSIGNED_CASES = 'view_assigned_cases',
  VIEW_ALL_CASES = 'view_all_cases',
  CREATE_EDIT_CASE = 'create_edit_case',
  CLOSE_HIGH_CRITICAL_CASE = 'close_high_critical_case',
  UPLOAD_EVIDENCE = 'upload_evidence',
  DOWNLOAD_EVIDENCE = 'download_evidence',
  VIEW_EVIDENCE_METADATA = 'view_evidence_metadata',
  CHAT_ON_CASE = 'chat_on_case',
  EXPORT_CHAT_NOTES = 'export_chat_notes',
  FINALIZE_PIR = 'finalize_pir',
  APPROVE_TI_SHARING = 'approve_ti_sharing',
  MANAGE_USERS = 'manage_users',
  VIEW_AUDIT_LOG = 'view_audit_log',
}

// Mirrors backend/src/common/permissions.ts. UI-only — used to decide what to
// render, never to decide what to allow. The API re-checks every request.
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ANALYST_L1]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.CHAT_ON_CASE,
  ],
  [Role.ANALYST_L2]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.CHAT_ON_CASE,
  ],
  [Role.IR_LEAD]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.CLOSE_HIGH_CRITICAL_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.CHAT_ON_CASE,
    Permission.EXPORT_CHAT_NOTES,
    Permission.FINALIZE_PIR,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.CISO_MANAGER]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.CLOSE_HIGH_CRITICAL_CASE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.EXPORT_CHAT_NOTES,
    Permission.FINALIZE_PIR,
    Permission.APPROVE_TI_SHARING,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.AUDITOR]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.VIEW_AUDIT_LOG,
  ],
  [Role.ADMIN]: [
    Permission.VIEW_ASSIGNED_CASES,
    Permission.VIEW_ALL_CASES,
    Permission.CREATE_EDIT_CASE,
    Permission.CLOSE_HIGH_CRITICAL_CASE,
    Permission.UPLOAD_EVIDENCE,
    Permission.DOWNLOAD_EVIDENCE,
    Permission.VIEW_EVIDENCE_METADATA,
    Permission.EXPORT_CHAT_NOTES,
    Permission.MANAGE_USERS,
    Permission.VIEW_AUDIT_LOG,
  ],
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export enum CaseSeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export enum CaseCategory {
  PHISHING = 'phishing',
  MALWARE = 'malware',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_EXFILTRATION = 'data_exfiltration',
  DENIAL_OF_SERVICE = 'denial_of_service',
  INSIDER_THREAT = 'insider_threat',
  OTHER = 'other',
}

export const CATEGORY_LABELS: Record<CaseCategory, string> = {
  [CaseCategory.PHISHING]: 'Phishing',
  [CaseCategory.MALWARE]: 'Malware',
  [CaseCategory.UNAUTHORIZED_ACCESS]: 'Unauthorized Access',
  [CaseCategory.DATA_EXFILTRATION]: 'Data Exfiltration',
  [CaseCategory.DENIAL_OF_SERVICE]: 'Denial of Service',
  [CaseCategory.INSIDER_THREAT]: 'Insider Threat',
  [CaseCategory.OTHER]: 'Other',
};

export enum CaseStatus {
  NEW = 'new',
  TRIAGE = 'triage',
  CONTAINED = 'contained',
  ERADICATED = 'eradicated',
  RECOVERED = 'recovered',
  CLOSED = 'closed',
}

export const STATUS_LABELS: Record<CaseStatus, string> = {
  [CaseStatus.NEW]: 'New',
  [CaseStatus.TRIAGE]: 'Triage',
  [CaseStatus.CONTAINED]: 'Contained',
  [CaseStatus.ERADICATED]: 'Eradicated',
  [CaseStatus.RECOVERED]: 'Recovered',
  [CaseStatus.CLOSED]: 'Closed',
};

export interface Team {
  id: number;
  name: string;
}

export interface UserSummary {
  id: number;
  email: string;
  name: string;
  role: Role;
  team: Team | null;
  mfaEnabled: boolean;
}

/** Shape returned by the admin-only /users endpoints — a superset of UserSummary. */
export interface AdminUser extends UserSummary {
  isActive: boolean;
  createdAt: string;
}

export interface Case {
  id: number;
  caseNumber: string;
  title: string;
  description: string;
  severity: CaseSeverity;
  category: CaseCategory;
  status: CaseStatus;
  assignee: UserSummary | null;
  team: Team;
  slaDueAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseHistoryEntry {
  id: number;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  actor: UserSummary;
  ts: string;
}

export interface DashboardSummary {
  openCaseCount: number;
  slaAtRiskCount: number;
  bySeverity: Record<CaseSeverity, number>;
  recentCases: Case[];
}

export enum EvidenceType {
  DISK_IMAGE = 'disk_image',
  MEMORY_DUMP = 'memory_dump',
  LOG_EXPORT = 'log_export',
  EMAIL = 'email',
  PCAP = 'pcap',
  SCREENSHOT = 'screenshot',
  OTHER = 'other',
}

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  [EvidenceType.DISK_IMAGE]: 'Disk image',
  [EvidenceType.MEMORY_DUMP]: 'Memory dump',
  [EvidenceType.LOG_EXPORT]: 'Log export',
  [EvidenceType.EMAIL]: 'Email',
  [EvidenceType.PCAP]: 'Packet capture',
  [EvidenceType.SCREENSHOT]: 'Screenshot',
  [EvidenceType.OTHER]: 'Other',
};

export interface EvidenceItem {
  id: number;
  type: EvidenceType;
  source: string | null;
  originalFilename: string;
  mimeType: string | null;
  sizeBytes: number;
  sha256: string;
  tags: string | null;
  notes: string | null;
  collectedBy: UserSummary;
  collectedAt: string;
}

export enum CustodyAction {
  UPLOADED = 'uploaded',
  DOWNLOADED = 'downloaded',
  ACCESS_GRANTED = 'access_granted',
  ACCESS_REVOKED = 'access_revoked',
}

export const CUSTODY_ACTION_LABELS: Record<CustodyAction, string> = {
  [CustodyAction.UPLOADED]: 'uploaded',
  [CustodyAction.DOWNLOADED]: 'downloaded',
  [CustodyAction.ACCESS_GRANTED]: 'granted access',
  [CustodyAction.ACCESS_REVOKED]: 'revoked access',
};

export interface EvidenceCustodyEntry {
  id: number;
  action: CustodyAction;
  reason: string | null;
  actor: UserSummary;
  ts: string;
}

export interface EvidenceAccessGrant {
  id: number;
  user: UserSummary;
  grantedBy: UserSummary;
  reason: string | null;
  grantedAt: string;
}

export enum NoteTag {
  FINDING = 'finding',
  HYPOTHESIS = 'hypothesis',
  ACTION_ITEM = 'action_item',
  HANDOFF = 'handoff',
}

export const NOTE_TAG_LABELS: Record<NoteTag, string> = {
  [NoteTag.FINDING]: 'Finding',
  [NoteTag.HYPOTHESIS]: 'Hypothesis',
  [NoteTag.ACTION_ITEM]: 'Action item',
  [NoteTag.HANDOFF]: 'Shift hand-off',
};

export interface ChatMessage {
  id: number;
  body: string;
  tag: NoteTag | null;
  author: UserSummary;
  ts: string;
}

// Mirrors backend/src/pir/pir-templates.ts — the 5 sections are fixed; only the
// template's framing text changes.
export interface PirTemplate {
  id: string;
  name: string;
  focus: string;
}

export const PIR_SECTION_KEYS = [
  'timelineNotes',
  'rootCause',
  'detectionGapAnalysis',
  'responseEffectiveness',
  'lessonsLearned',
] as const;

export type PirSectionKey = (typeof PIR_SECTION_KEYS)[number];
export type PirSections = Record<PirSectionKey, string>;

export const PIR_SECTION_LABELS: Record<PirSectionKey, string> = {
  timelineNotes: 'Timeline reconstruction',
  rootCause: 'Root cause',
  detectionGapAnalysis: 'Detection gap analysis',
  responseEffectiveness: 'Response effectiveness',
  lessonsLearned: 'Lessons learned',
};

export interface PirReport {
  id: number;
  templateId: string;
  sections: PirSections;
  version: number;
  createdBy: UserSummary;
  finalizedAt: string | null;
  finalizedBy: UserSummary | null;
  createdAt: string;
}

export interface PirActionItem {
  id: number;
  description: string;
  owner: string | null;
  dueDate: string | null;
  done: boolean;
  createdAt: string;
}

export enum IndicatorType {
  IP = 'ip',
  DOMAIN = 'domain',
  URL = 'url',
  FILE_HASH = 'file_hash',
  EMAIL = 'email',
  OTHER = 'other',
}

export const INDICATOR_TYPE_LABELS: Record<IndicatorType, string> = {
  [IndicatorType.IP]: 'IP address',
  [IndicatorType.DOMAIN]: 'Domain',
  [IndicatorType.URL]: 'URL',
  [IndicatorType.FILE_HASH]: 'File hash',
  [IndicatorType.EMAIL]: 'Email address',
  [IndicatorType.OTHER]: 'Other',
};

export enum Tlp {
  CLEAR = 'TLP:CLEAR',
  GREEN = 'TLP:GREEN',
  AMBER = 'TLP:AMBER',
  AMBER_STRICT = 'TLP:AMBER+STRICT',
  RED = 'TLP:RED',
}

export interface ThreatIndicator {
  id: number;
  type: IndicatorType;
  value: string;
  confidence: number;
  tlp: Tlp;
  source: string;
  threatActor: string | null;
  campaign: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CaseThreatIndicator {
  id: number;
  case: Case;
  threatIndicator: ThreatIndicator;
  linkedBy: UserSummary;
  note: string | null;
  linkedAt: string;
}

export interface ThreatWatchlistMatch {
  id: number;
  threatIndicator: ThreatIndicator;
  matchedAt: string;
  acknowledged: boolean;
  acknowledgedBy: UserSummary | null;
  acknowledgedAt: string | null;
}

export enum ShareRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export interface ThreatShareRequest {
  id: number;
  threatIndicator: ThreatIndicator;
  case: Case;
  requestedBy: UserSummary;
  requestedAt: string;
  status: ShareRequestStatus;
  decidedBy: UserSummary | null;
  decidedAt: string | null;
  reason: string | null;
}
