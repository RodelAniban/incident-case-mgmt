import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { CATEGORY_LABELS, CaseSeverity, DashboardSummary } from '../api/types';
import { SeverityChip } from '../components/SeverityChip';

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, flex: '1 1 140px' }}>
      <Typography
        variant="h4"
        sx={{ fontFamily: 'ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
    </Paper>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    apiClient.get<DashboardSummary>('/dashboard/summary').then((res) => setSummary(res.data));
  }, []);

  if (!summary) {
    return <Typography color="text.secondary">Loading dashboard…</Typography>;
  }

  const severityOrder = [CaseSeverity.CRITICAL, CaseSeverity.HIGH, CaseSeverity.MEDIUM, CaseSeverity.LOW];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h5" sx={{ fontFamily: 'Georgia, serif' }}>
        SOC Overview
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Kpi label="Open cases" value={summary.openCaseCount} />
        <Kpi label="SLA at risk" value={summary.slaAtRiskCount} />
        {severityOrder.map((sev) => (
          <Kpi key={sev} label={`${sev} open`} value={summary.bySeverity[sev]} />
        ))}
      </Box>

      <Paper variant="outlined">
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">Recent cases</Typography>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Case</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summary.recentCases.map((c) => (
              <TableRow key={c.id} hover>
                <TableCell sx={{ fontFamily: 'ui-monospace, monospace' }}>{c.caseNumber}</TableCell>
                <TableCell>{c.title}</TableCell>
                <TableCell>{CATEGORY_LABELS[c.category]}</TableCell>
                <TableCell>
                  <SeverityChip severity={c.severity} />
                </TableCell>
                <TableCell sx={{ textTransform: 'capitalize' }}>{c.status}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
