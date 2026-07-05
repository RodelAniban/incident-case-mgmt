import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import { Alert, Box, Chip, Divider, Paper, Typography } from '@mui/material';
import { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { ADMIN_AUDIT_ACTION_LABELS, AdminAuditEntry } from '../api/types';

export function AuditLog() {
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AdminAuditEntry[]>('/admin-audit')
      .then((res) => setEntries([...res.data].reverse()))
      .catch(() => setError('Could not load the audit log.'));
    apiClient
      .get<{ valid: boolean }>('/admin-audit/verify')
      .then((res) => setChainValid(res.data.valid))
      .catch(() => setChainValid(null));
  }, []);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'Georgia, serif', mb: 0.5 }}>
            Audit Log
          </Typography>
          <Typography variant="body2" color="text.secondary">
            System-wide record of admin actions — account creation, role/team changes, deactivation, password resets.
          </Typography>
        </Box>
        {chainValid !== null && (
          <Chip
            size="small"
            icon={chainValid ? <VerifiedOutlinedIcon fontSize="small" /> : <WarningAmberOutlinedIcon fontSize="small" />}
            label={chainValid ? 'Chain verified' : 'Chain broken — tampering suspected'}
            color={chainValid ? 'success' : 'error'}
            variant={chainValid ? 'outlined' : 'filled'}
          />
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper variant="outlined">
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {entries.length === 0 && !error && (
            <Typography variant="body2" color="text.secondary">
              No admin actions recorded yet.
            </Typography>
          )}
          {entries.map((entry, i) => (
            <Box key={entry.id}>
              {i > 0 && <Divider sx={{ mb: 1.5 }} />}
              <Typography variant="body2">
                <strong>{entry.actor.name}</strong> {ADMIN_AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                {entry.targetUser && (
                  <>
                    {' '}
                    for <strong>{entry.targetUser.name}</strong>
                  </>
                )}
                {entry.details && <> — {entry.details}</>}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {new Date(entry.ts).toLocaleString()}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>
    </Box>
  );
}
