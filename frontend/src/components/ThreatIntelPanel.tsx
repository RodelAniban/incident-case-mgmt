import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  CaseStatus,
  CaseThreatIndicator,
  INDICATOR_TYPE_LABELS,
  IndicatorType,
  Permission,
  ShareRequestStatus,
  ThreatShareRequest,
  ThreatWatchlistMatch,
  Tlp,
} from '../api/types';

const SHAREABLE_TLP = new Set([Tlp.CLEAR, Tlp.GREEN]);

export function ThreatIntelPanel({ caseId, caseStatus }: { caseId: number; caseStatus: CaseStatus }) {
  const { can } = useAuth();
  const canEdit = can(Permission.CREATE_EDIT_CASE);

  const [links, setLinks] = useState<CaseThreatIndicator[]>([]);
  const [attribution, setAttribution] = useState<{ threatActors: string[]; campaigns: string[] }>({
    threatActors: [],
    campaigns: [],
  });
  const [matches, setMatches] = useState<ThreatWatchlistMatch[]>([]);
  const [shareRequests, setShareRequests] = useState<ThreatShareRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<IndicatorType>(IndicatorType.DOMAIN);
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');

  const load = async () => {
    const [indicatorsRes, matchesRes, shareRes] = await Promise.all([
      apiClient.get(`/threat-intel/cases/${caseId}/indicators`),
      apiClient.get<ThreatWatchlistMatch[]>(`/threat-intel/cases/${caseId}/matches`),
      apiClient.get<ThreatShareRequest[]>(`/threat-intel/cases/${caseId}/share-requests`),
    ]);
    setLinks(indicatorsRes.data.links);
    setAttribution({ threatActors: indicatorsRes.data.threatActors, campaigns: indicatorsRes.data.campaigns });
    setMatches(matchesRes.data);
    setShareRequests(shareRes.data);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const onLink = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await apiClient.post(`/threat-intel/cases/${caseId}/indicators`, { type, value, note: note || undefined });
      setValue('');
      setNote('');
      await load();
    } catch {
      setError('Could not link that indicator.');
    }
  };

  const onAcknowledge = async (matchId: number) => {
    await apiClient.post(`/threat-intel/matches/${matchId}/acknowledge`);
    await load();
  };

  const onProposeShare = async (indicatorId: number) => {
    setError(null);
    try {
      await apiClient.post(`/threat-intel/cases/${caseId}/share-requests`, { indicatorId });
      await load();
    } catch {
      setError('Could not propose sharing that indicator.');
    }
  };

  const unacknowledged = matches.filter((m) => !m.acknowledged);
  const shareRequestByIndicator = new Map(shareRequests.map((r) => [r.threatIndicator.id, r]));

  if (!can(Permission.VIEW_ASSIGNED_CASES) && !can(Permission.VIEW_ALL_CASES)) {
    return null;
  }

  return (
    <Paper variant="outlined">
      <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2">Threat Intelligence</Typography>
      </Box>
      <Box sx={{ p: 2 }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {unacknowledged.map((m) => (
          <Alert
            key={m.id}
            severity="info"
            sx={{ mb: 1 }}
            action={
              canEdit && (
                <Button size="small" onClick={() => onAcknowledge(m.id)}>
                  Acknowledge
                </Button>
              )
            }
          >
            New intel on <strong>{m.threatIndicator.value}</strong> — already linked to this case
            {m.threatIndicator.threatActor ? ` (attributed to ${m.threatIndicator.threatActor})` : ''}.
          </Alert>
        ))}

        {(attribution.threatActors.length > 0 || attribution.campaigns.length > 0) && (
          <Box sx={{ mb: 2, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {attribution.threatActors.map((a) => (
              <Chip key={a} label={`Actor: ${a}`} size="small" color="secondary" variant="outlined" />
            ))}
            {attribution.campaigns.map((c) => (
              <Chip key={c} label={`Campaign: ${c}`} size="small" color="secondary" variant="outlined" />
            ))}
          </Box>
        )}

        {links.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No indicators linked to this case yet.
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto', mb: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Type</TableCell>
                  <TableCell>Value</TableCell>
                  <TableCell>TLP</TableCell>
                  <TableCell>Note</TableCell>
                  <TableCell align="right">Sharing</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {links.map((link) => {
                  const existingRequest = shareRequestByIndicator.get(link.threatIndicator.id);
                  const eligible =
                    caseStatus === CaseStatus.CLOSED && SHAREABLE_TLP.has(link.threatIndicator.tlp) && canEdit;
                  return (
                    <TableRow key={link.id} hover>
                      <TableCell>{INDICATOR_TYPE_LABELS[link.threatIndicator.type]}</TableCell>
                      <TableCell sx={{ fontFamily: 'ui-monospace, monospace' }}>{link.threatIndicator.value}</TableCell>
                      <TableCell>
                        <Chip label={link.threatIndicator.tlp} size="small" />
                      </TableCell>
                      <TableCell>{link.note ?? '—'}</TableCell>
                      <TableCell align="right">
                        {existingRequest ? (
                          <Chip
                            label={existingRequest.status}
                            size="small"
                            color={
                              existingRequest.status === ShareRequestStatus.APPROVED
                                ? 'success'
                                : existingRequest.status === ShareRequestStatus.REJECTED
                                  ? 'error'
                                  : 'default'
                            }
                          />
                        ) : eligible ? (
                          <Button size="small" onClick={() => onProposeShare(link.threatIndicator.id)}>
                            Propose share
                          </Button>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            {caseStatus !== CaseStatus.CLOSED ? 'Close case to share' : 'Not shareable (TLP)'}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {canEdit && (
          <Box component="form" onSubmit={onLink} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <TextField select size="small" label="Type" value={type} onChange={(e) => setType(e.target.value as IndicatorType)} sx={{ width: 140 }}>
              {Object.values(IndicatorType).map((t) => (
                <MenuItem key={t} value={t}>
                  {INDICATOR_TYPE_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              placeholder="Indicator value (e.g. evil.example.com)"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
              sx={{ flex: 1, minWidth: 200 }}
            />
            <TextField size="small" placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} sx={{ flex: 1, minWidth: 160 }} />
            <Button type="submit" variant="outlined" size="small">
              Link indicator
            </Button>
          </Box>
        )}
      </Box>
    </Paper>
  );
}
