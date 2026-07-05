import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { isAxiosError } from 'axios';
import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  CUSTODY_ACTION_LABELS,
  EVIDENCE_TYPE_LABELS,
  EvidenceAccessGrant,
  EvidenceCustodyEntry,
  EvidenceItem,
  EvidenceType,
  Permission,
  Role,
} from '../api/types';

const LEADERSHIP_ROLES = [Role.IR_LEAD, Role.CISO_MANAGER, Role.ADMIN];

// The MFA-required guard and the RBAC guard both return 403, but only the
// former has something actionable to say — surface the server's own message
// instead of a generic "forbidden" so the "set it up under Account Security"
// hint (see backend/src/common/guards/mfa-required.guard.ts) actually reaches the user.
function describeError(err: unknown, fallback: string): string {
  if (isAxiosError(err) && err.response?.status === 403 && typeof err.response.data?.message === 'string') {
    return err.response.data.message;
  }
  return fallback;
}

// Download requests use responseType: 'blob', so axios never parses a 403's
// JSON body into err.response.data — it's a Blob instead. Read it out by hand
// so the same actionable MFA-required message reaches this error path too.
async function describeDownloadError(err: unknown, fallback: string): Promise<string> {
  if (isAxiosError(err) && err.response?.status === 403 && err.response.data instanceof Blob) {
    try {
      const body = JSON.parse(await err.response.data.text());
      if (typeof body.message === 'string') return body.message;
    } catch {
      // fall through to fallback
    }
  }
  return fallback;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EvidencePanel({ caseId }: { caseId: number }) {
  const { user, can } = useAuth();
  const isLeadership = !!user && LEADERSHIP_ROLES.includes(user.role);

  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<EvidenceType>(EvidenceType.OTHER);
  const [source, setSource] = useState('');
  const [tags, setTags] = useState('');
  const [notes, setNotes] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [downloadTarget, setDownloadTarget] = useState<EvidenceItem | null>(null);
  const [downloadReason, setDownloadReason] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [detailTarget, setDetailTarget] = useState<EvidenceItem | null>(null);
  const [custody, setCustody] = useState<EvidenceCustodyEntry[]>([]);
  const [grants, setGrants] = useState<EvidenceAccessGrant[]>([]);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantReason, setGrantReason] = useState('');
  const [grantError, setGrantError] = useState<string | null>(null);

  const load = () => apiClient.get<EvidenceItem[]>(`/evidence/case/${caseId}`).then((res) => setItems(res.data));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const onUpload = async (event: FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setUploadError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('caseId', String(caseId));
      form.append('type', type);
      if (source) form.append('source', source);
      if (tags) form.append('tags', tags);
      if (notes) form.append('notes', notes);
      await apiClient.post('/evidence', form);
      setUploadOpen(false);
      setFile(null);
      setSource('');
      setTags('');
      setNotes('');
      await load();
    } catch (err) {
      setUploadError(describeError(err, 'Upload failed — check the file and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const onDownload = async () => {
    if (!downloadTarget) return;
    setDownloadError(null);
    try {
      const res = await apiClient.get(`/evidence/${downloadTarget.id}/download`, {
        params: { reason: downloadReason },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadTarget.originalFilename;
      a.click();
      URL.revokeObjectURL(url);
      setDownloadTarget(null);
      setDownloadReason('');
    } catch (err) {
      setDownloadError(await describeDownloadError(err, 'You do not have access to this item, or no reason was given.'));
    }
  };

  const openDetail = async (item: EvidenceItem) => {
    setDetailTarget(item);
    setGrantError(null);
    const custodyRes = await apiClient.get<EvidenceCustodyEntry[]>(`/evidence/${item.id}/custody`);
    setCustody(custodyRes.data);
    if (isLeadership) {
      const grantsRes = await apiClient.get<EvidenceAccessGrant[]>(`/evidence/${item.id}/access`);
      setGrants(grantsRes.data);
    } else {
      setGrants([]);
    }
  };

  const onGrant = async (event: FormEvent) => {
    event.preventDefault();
    if (!detailTarget) return;
    setGrantError(null);
    try {
      await apiClient.post(`/evidence/${detailTarget.id}/access`, { email: grantEmail, reason: grantReason || undefined });
      setGrantEmail('');
      setGrantReason('');
      const grantsRes = await apiClient.get<EvidenceAccessGrant[]>(`/evidence/${detailTarget.id}/access`);
      setGrants(grantsRes.data);
    } catch {
      setGrantError('Could not grant access — check the email address.');
    }
  };

  const onRevoke = async (userId: number) => {
    if (!detailTarget) return;
    await apiClient.delete(`/evidence/${detailTarget.id}/access/${userId}`);
    const grantsRes = await apiClient.get<EvidenceAccessGrant[]>(`/evidence/${detailTarget.id}/access`);
    setGrants(grantsRes.data);
  };

  if (!can(Permission.VIEW_EVIDENCE_METADATA)) {
    return null;
  }

  return (
    <Paper variant="outlined">
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="subtitle2">Evidence</Typography>
        {can(Permission.UPLOAD_EVIDENCE) && (
          <Button size="small" startIcon={<CloudUploadOutlinedIcon fontSize="small" />} onClick={() => setUploadOpen(true)}>
            Add evidence
          </Button>
        )}
      </Box>

      {items.length === 0 ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            No evidence collected yet.
          </Typography>
        </Box>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Filename</TableCell>
                <TableCell>Size</TableCell>
                <TableCell>SHA-256</TableCell>
                <TableCell>Collected by</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>{EVIDENCE_TYPE_LABELS[item.type]}</TableCell>
                  <TableCell>
                    {item.originalFilename}
                    {item.tags && (
                      <Box sx={{ mt: 0.5, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {item.tags.split(',').map((tag) => (
                          <Chip key={tag} label={tag.trim()} size="small" variant="outlined" />
                        ))}
                      </Box>
                    )}
                  </TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{formatBytes(item.sizeBytes)}</TableCell>
                  <TableCell sx={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}>
                    {item.sha256.slice(0, 12)}…
                  </TableCell>
                  <TableCell>{item.collectedBy.name}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Custody history & access">
                      <IconButton size="small" onClick={() => openDetail(item)}>
                        <HistoryOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {can(Permission.DOWNLOAD_EVIDENCE) && (
                      <Tooltip title="Download">
                        <IconButton size="small" onClick={() => setDownloadTarget(item)}>
                          <DownloadOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onClose={() => setUploadOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={onUpload}>
          <DialogTitle>Add evidence</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {uploadError && <Alert severity="error">{uploadError}</Alert>}
            <Button component="label" variant="outlined" size="small">
              {file ? file.name : 'Choose file'}
              <input type="file" hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Button>
            <TextField select label="Type" size="small" value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
              {Object.values(EvidenceType).map((t) => (
                <MenuItem key={t} value={t}>
                  {EVIDENCE_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
            <TextField label="Source" size="small" value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. EDR export" />
            <TextField label="Tags (comma-separated)" size="small" value={tags} onChange={(e) => setTags(e.target.value)} />
            <TextField label="Notes" size="small" multiline minRows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setUploadOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disableElevation disabled={!file || saving}>
              Upload
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Download dialog */}
      <Dialog open={!!downloadTarget} onClose={() => setDownloadTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle>Download evidence</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
          {downloadError && <Alert severity="error">{downloadError}</Alert>}
          <Typography variant="body2" color="text.secondary">
            Downloading <strong>{downloadTarget?.originalFilename}</strong> requires a logged justification.
          </Typography>
          <TextField
            label="Reason for download"
            size="small"
            required
            autoFocus
            value={downloadReason}
            onChange={(e) => setDownloadReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDownloadTarget(null)}>Cancel</Button>
          <Button variant="contained" disableElevation disabled={!downloadReason.trim()} onClick={onDownload}>
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* Custody history + access dialog */}
      <Dialog open={!!detailTarget} onClose={() => setDetailTarget(null)} fullWidth maxWidth="sm">
        <DialogTitle>{detailTarget?.originalFilename}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Typography variant="subtitle2">Chain of custody</Typography>
          {custody.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No custody events yet.
            </Typography>
          )}
          {custody.map((entry, i) => (
            <Box key={entry.id}>
              {i > 0 && <Divider sx={{ mb: 1 }} />}
              <Typography variant="body2">
                <strong>{entry.actor.name}</strong> {CUSTODY_ACTION_LABELS[entry.action]}
                {entry.reason ? ` — ${entry.reason}` : ''}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(entry.ts).toLocaleString()}
              </Typography>
            </Box>
          ))}

          {isLeadership && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2">Access grants</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>
                Analyst L2 needs an explicit grant to download this item unless they collected it themselves.
              </Typography>
              {grants.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No explicit grants — only the collector and leadership roles can download.
                </Typography>
              )}
              {grants.map((grant) => (
                <Box key={grant.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                  <Typography variant="body2">
                    {grant.user.name} ({grant.user.email})
                    {grant.reason ? ` — ${grant.reason}` : ''}
                  </Typography>
                  <Button size="small" color="error" onClick={() => onRevoke(grant.user.id)}>
                    Revoke
                  </Button>
                </Box>
              ))}
              {grantError && (
                <Alert severity="error" sx={{ mt: 1 }}>
                  {grantError}
                </Alert>
              )}
              <Box component="form" onSubmit={onGrant} sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
                <TextField
                  label="Grant to email"
                  size="small"
                  value={grantEmail}
                  onChange={(e) => setGrantEmail(e.target.value)}
                  sx={{ flex: 1 }}
                  required
                />
                <TextField
                  label="Reason"
                  size="small"
                  value={grantReason}
                  onChange={(e) => setGrantReason(e.target.value)}
                  sx={{ flex: 1 }}
                />
                <Button type="submit" variant="outlined" size="small">
                  Grant
                </Button>
              </Box>
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDetailTarget(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
