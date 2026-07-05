import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Alert,
  Box,
  Divider,
  IconButton,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  CATEGORY_LABELS,
  Case,
  CaseHistoryEntry,
  CaseStatus,
  Permission,
  STATUS_LABELS,
} from '../api/types';
import { EvidencePanel } from '../components/EvidencePanel';
import { SeverityChip } from '../components/SeverityChip';

export function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [history, setHistory] = useState<CaseHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await apiClient.get<Case>(`/cases/${id}`);
    setCaseData(data);
    if (can(Permission.VIEW_AUDIT_LOG)) {
      const auditRes = await apiClient.get<CaseHistoryEntry[]>(`/audit/cases/${id}`);
      setHistory(auditRes.data);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const onStatusChange = async (status: CaseStatus) => {
    setError(null);
    try {
      await apiClient.patch(`/cases/${id}`, { status });
      await load();
    } catch {
      setError(`Your role cannot move this case to "${STATUS_LABELS[status]}".`);
    }
  };

  if (!caseData) {
    return <Typography color="text.secondary">Loading case…</Typography>;
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 900 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <IconButton size="small" onClick={() => navigate('/cases')}>
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography variant="caption" sx={{ fontFamily: 'ui-monospace, monospace', color: 'text.secondary' }}>
          {caseData.caseNumber}
        </Typography>
      </Box>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box>
            <Typography variant="h5" sx={{ fontFamily: 'Georgia, serif' }}>
              {caseData.title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {CATEGORY_LABELS[caseData.category]} · Team {caseData.team.name} · Assignee{' '}
              {caseData.assignee?.name ?? 'Unassigned'}
            </Typography>
          </Box>
          <SeverityChip severity={caseData.severity} />
        </Box>

        {error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          select
          label="Status"
          value={caseData.status}
          onChange={(e) => onStatusChange(e.target.value as CaseStatus)}
          size="small"
          sx={{ mt: 3, minWidth: 220 }}
        >
          {Object.values(CaseStatus).map((s) => (
            <MenuItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </MenuItem>
          ))}
        </TextField>
      </Paper>

      <EvidencePanel caseId={caseData.id} />

      {can(Permission.VIEW_AUDIT_LOG) && (
        <Paper variant="outlined">
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2">Audit trail</Typography>
          </Box>
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {history.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No history recorded yet.
              </Typography>
            )}
            {history.map((entry, i) => (
              <Box key={entry.id}>
                {i > 0 && <Divider sx={{ mb: 1.5 }} />}
                <Typography variant="body2">
                  <strong>{entry.actor.name}</strong> changed <code>{entry.field}</code> from{' '}
                  <em>{entry.oldValue ?? '—'}</em> to <em>{entry.newValue ?? '—'}</em>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {new Date(entry.ts).toLocaleString()}
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </Box>
  );
}
