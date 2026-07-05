import { Alert, Box, Button, Chip, Paper, TextField, Typography } from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export function AccountSecurity() {
  const { user, setMfaEnabled } = useAuth();
  const [mfaEnabled, setLocalMfaEnabled] = useState(user?.mfaEnabled ?? false);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'idle' | 'enrolling' | 'disabling'>('idle');

  useEffect(() => {
    apiClient.get('/auth/mfa/status').then((res) => setLocalMfaEnabled(res.data.mfaEnabled));
  }, []);

  const startEnroll = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await apiClient.post<SetupResponse>('/auth/mfa/setup');
      setSetup(res.data);
      setMode('enrolling');
    } catch {
      setError('Could not start MFA setup — try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmEnroll = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiClient.post('/auth/mfa/verify', { code });
      setLocalMfaEnabled(true);
      setMfaEnabled(true);
      setMode('idle');
      setSetup(null);
      setCode('');
    } catch {
      setError('Invalid code — check your authenticator app and try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiClient.post('/auth/mfa/disable', { code });
      setLocalMfaEnabled(false);
      setMfaEnabled(false);
      setMode('idle');
      setCode('');
    } catch {
      setError('Invalid code — MFA was not disabled.');
    } finally {
      setBusy(false);
    }
  };

  const cancel = () => {
    setMode('idle');
    setSetup(null);
    setCode('');
    setError(null);
  };

  return (
    <Box sx={{ maxWidth: 520 }}>
      <Typography variant="h6" sx={{ fontFamily: 'Georgia, serif', mb: 0.5 }}>
        Account Security
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Multi-factor authentication is required before you can upload or download evidence.
      </Typography>

      <Paper variant="outlined" sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2">Authenticator app (TOTP)</Typography>
          <Chip
            size="small"
            label={mfaEnabled ? 'Enabled' : 'Not enabled'}
            color={mfaEnabled ? 'success' : 'default'}
            variant={mfaEnabled ? 'filled' : 'outlined'}
          />
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {mode === 'idle' && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {mfaEnabled
                ? 'Codes from your authenticator app are required at login and before evidence access.'
                : 'Set up an authenticator app (Google Authenticator, 1Password, Authy, etc.) to enable evidence access.'}
            </Typography>
            {mfaEnabled ? (
              <Button variant="outlined" color="error" size="small" onClick={() => setMode('disabling')} disabled={busy}>
                Disable MFA
              </Button>
            ) : (
              <Button variant="contained" disableElevation size="small" onClick={startEnroll} disabled={busy}>
                Set up MFA
              </Button>
            )}
          </>
        )}

        {mode === 'enrolling' && setup && (
          <Box component="form" onSubmit={confirmEnroll} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2">Scan this QR code with your authenticator app:</Typography>
            <Box
              component="img"
              src={setup.qrCodeDataUrl}
              alt="MFA enrollment QR code"
              sx={{ width: 180, height: 180, alignSelf: 'center', border: 1, borderColor: 'divider', borderRadius: 1 }}
            />
            <Typography variant="caption" color="text.secondary">
              Can't scan it? Enter this key manually:{' '}
              <Box component="span" sx={{ fontFamily: 'ui-monospace, monospace' }}>
                {setup.secret}
              </Box>
            </Typography>
            <TextField
              label="Enter the 6-digit code to confirm"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              size="small"
              autoFocus
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              required
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button type="submit" variant="contained" disableElevation size="small" disabled={busy || code.length !== 6}>
                Confirm & enable
              </Button>
              <Button size="small" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
            </Box>
          </Box>
        )}

        {mode === 'disabling' && (
          <Box component="form" onSubmit={confirmDisable} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Enter a current code from your authenticator app to confirm disabling MFA.
            </Typography>
            <TextField
              label="Authentication code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              size="small"
              autoFocus
              inputProps={{ inputMode: 'numeric', maxLength: 6 }}
              required
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button type="submit" variant="outlined" color="error" size="small" disabled={busy || code.length !== 6}>
                Confirm disable
              </Button>
              <Button size="small" onClick={cancel} disabled={busy}>
                Cancel
              </Button>
            </Box>
          </Box>
        )}
      </Paper>
    </Box>
  );
}
