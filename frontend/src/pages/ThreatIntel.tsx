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
  INDICATOR_TYPE_LABELS,
  IndicatorType,
  Role,
  ThreatIndicator,
  ThreatShareRequest,
  Tlp,
} from '../api/types';

export function ThreatIntel() {
  const { user } = useAuth();
  const isAdmin = user?.role === Role.ADMIN;
  const isCiso = user?.role === Role.CISO_MANAGER;

  const [search, setSearch] = useState('');
  const [indicators, setIndicators] = useState<ThreatIndicator[]>([]);
  const [pending, setPending] = useState<ThreatShareRequest[]>([]);

  const [type, setType] = useState<IndicatorType>(IndicatorType.DOMAIN);
  const [value, setValue] = useState('');
  const [confidence, setConfidence] = useState('50');
  const [tlp, setTlp] = useState<Tlp>(Tlp.AMBER);
  const [source, setSource] = useState('');
  const [threatActor, setThreatActor] = useState('');
  const [campaign, setCampaign] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const loadIndicators = () =>
    apiClient.get<ThreatIndicator[]>('/threat-intel/indicators', { params: { search: search || undefined } }).then((res) => setIndicators(res.data));

  const loadPending = () => {
    if (isCiso) {
      apiClient.get<ThreatShareRequest[]>('/threat-intel/share-requests/pending').then((res) => setPending(res.data));
    }
  };

  useEffect(() => {
    loadIndicators();
    loadPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = (event: FormEvent) => {
    event.preventDefault();
    loadIndicators();
  };

  const onImport = async (event: FormEvent) => {
    event.preventDefault();
    setImportError(null);
    setImportMessage(null);
    try {
      const { data } = await apiClient.post('/threat-intel/import', {
        indicators: [
          {
            type,
            value,
            confidence: Number(confidence),
            tlp,
            source,
            threatActor: threatActor || undefined,
            campaign: campaign || undefined,
          },
        ],
      });
      setImportMessage(`Imported. ${data.matched} case(s) already had this indicator linked and were flagged.`);
      setValue('');
      setThreatActor('');
      setCampaign('');
      await loadIndicators();
    } catch {
      setImportError('Import failed — check the fields and try again.');
    }
  };

  const onDecide = async (id: number, approve: boolean) => {
    await apiClient.post(`/threat-intel/share-requests/${id}/${approve ? 'approve' : 'reject'}`, {});
    await loadPending();
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, maxWidth: 1100 }}>
      <Typography variant="h5" sx={{ fontFamily: 'Georgia, serif' }}>
        Threat Intelligence
      </Typography>

      {isCiso && (
        <Paper variant="outlined">
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2">Pending outbound sharing approvals</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {pending.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Nothing awaiting approval.
              </Typography>
            ) : (
              pending.map((req) => (
                <Box key={req.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
                  <Chip label={req.threatIndicator.tlp} size="small" />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    <strong>{req.threatIndicator.value}</strong> from case {req.case.caseNumber}, requested by{' '}
                    {req.requestedBy.name}
                  </Typography>
                  <Button size="small" color="error" onClick={() => onDecide(req.id, false)}>
                    Reject
                  </Button>
                  <Button size="small" variant="contained" disableElevation onClick={() => onDecide(req.id, true)}>
                    Approve
                  </Button>
                </Box>
              ))
            )}
          </Box>
        </Paper>
      )}

      {isAdmin && (
        <Paper variant="outlined">
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2">Import indicator</Typography>
          </Box>
          <Box sx={{ p: 2 }}>
            {importError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {importError}
              </Alert>
            )}
            {importMessage && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {importMessage}
              </Alert>
            )}
            <Box component="form" onSubmit={onImport} sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <TextField select size="small" label="Type" value={type} onChange={(e) => setType(e.target.value as IndicatorType)} sx={{ width: 150 }}>
                {Object.values(IndicatorType).map((t) => (
                  <MenuItem key={t} value={t}>
                    {INDICATOR_TYPE_LABELS[t]}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Value" value={value} onChange={(e) => setValue(e.target.value)} required sx={{ minWidth: 200 }} />
              <TextField
                size="small"
                label="Confidence"
                type="number"
                value={confidence}
                onChange={(e) => setConfidence(e.target.value)}
                sx={{ width: 110 }}
              />
              <TextField select size="small" label="TLP" value={tlp} onChange={(e) => setTlp(e.target.value as Tlp)} sx={{ width: 170 }}>
                {Object.values(Tlp).map((t) => (
                  <MenuItem key={t} value={t}>
                    {t}
                  </MenuItem>
                ))}
              </TextField>
              <TextField size="small" label="Source" value={source} onChange={(e) => setSource(e.target.value)} required sx={{ width: 160 }} />
              <TextField size="small" label="Threat actor" value={threatActor} onChange={(e) => setThreatActor(e.target.value)} sx={{ width: 160 }} />
              <TextField size="small" label="Campaign" value={campaign} onChange={(e) => setCampaign(e.target.value)} sx={{ width: 160 }} />
              <Button type="submit" variant="contained" disableElevation>
                Import
              </Button>
            </Box>
          </Box>
        </Paper>
      )}

      <Paper variant="outlined">
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Box component="form" onSubmit={onSearch} sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              placeholder="Search indicator value…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1, maxWidth: 320 }}
            />
            <Button type="submit" size="small">
              Search
            </Button>
          </Box>
        </Box>
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Type</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Confidence</TableCell>
                <TableCell>TLP</TableCell>
                <TableCell>Source</TableCell>
                <TableCell>Attribution</TableCell>
                <TableCell>Last seen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {indicators.map((ind) => (
                <TableRow key={ind.id} hover>
                  <TableCell>{INDICATOR_TYPE_LABELS[ind.type]}</TableCell>
                  <TableCell sx={{ fontFamily: 'ui-monospace, monospace' }}>{ind.value}</TableCell>
                  <TableCell sx={{ fontVariantNumeric: 'tabular-nums' }}>{ind.confidence}</TableCell>
                  <TableCell>
                    <Chip label={ind.tlp} size="small" />
                  </TableCell>
                  <TableCell>{ind.source}</TableCell>
                  <TableCell>{[ind.threatActor, ind.campaign].filter(Boolean).join(' · ') || '—'}</TableCell>
                  <TableCell>{new Date(ind.lastSeenAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>
    </Box>
  );
}
