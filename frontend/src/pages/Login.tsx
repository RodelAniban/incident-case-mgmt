import { Alert, Box, Button, Divider, Link, Paper, TextField, Typography } from '@mui/material';
import { GoogleLogin } from '@react-oauth/google';
import { isAxiosError } from 'axios';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';

const googleSsoEnabled = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

export function Login() {
  const { login, loginWithGoogle, completeMfaLogin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('lead@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  const afterLogin = (result: { mfaRequired: boolean; mfaToken?: string }) => {
    if (result.mfaRequired && result.mfaToken) {
      setMfaToken(result.mfaToken);
    } else {
      navigate('/');
    }
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      afterLogin(await login(email, password));
    } catch (err) {
      if (isAxiosError(err) && err.response) {
        setError('Invalid email or password.');
      } else {
        setError(`Could not reach the API at ${apiClient.defaults.baseURL}. Is the backend running?`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const onGoogleSuccess = async (idToken: string | undefined) => {
    if (!idToken) return;
    setError(null);
    try {
      afterLogin(await loginWithGoogle(idToken));
    } catch (err) {
      if (isAxiosError(err) && err.response?.status === 403) {
        setError(err.response.data?.message ?? 'This Google account is not authorized here.');
      } else {
        setError('Google sign-in failed — try again.');
      }
    }
  };

  const onSubmitCode = async (event: FormEvent) => {
    event.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setSubmitting(true);
    try {
      await completeMfaLogin(mfaToken, code);
      navigate('/');
    } catch {
      setError('Invalid or expired code — try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper variant="outlined" sx={{ p: 5, width: 380 }}>
        <Typography variant="h5" sx={{ fontFamily: 'Georgia, serif', mb: 0.5 }}>
          Incident Case Management
        </Typography>

        {!mfaToken ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Sign in with your analyst account.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={onSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                size="small"
                fullWidth
                required
              />
              <TextField
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                size="small"
                fullWidth
                required
              />
              <Button type="submit" variant="contained" disabled={submitting} disableElevation>
                Sign in
              </Button>
            </Box>
            {googleSsoEnabled && (
              <>
                <Divider sx={{ my: 2.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    OR
                  </Typography>
                </Divider>
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <GoogleLogin
                    onSuccess={(res) => onGoogleSuccess(res.credential)}
                    onError={() => setError('Google sign-in failed — try again.')}
                    useOneTap={false}
                    width="288"
                  />
                </Box>
              </>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
              Seeded demo accounts share the password <code>ChangeMe123!</code> — see backend/README.md.
            </Typography>
          </>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Enter the 6-digit code from your authenticator app.
            </Typography>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            <Box component="form" onSubmit={onSubmitCode} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                label="Authentication code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                size="small"
                fullWidth
                autoFocus
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                required
              />
              <Button type="submit" variant="contained" disabled={submitting || code.length !== 6} disableElevation>
                Verify
              </Button>
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={() => {
                  setMfaToken(null);
                  setCode('');
                  setError(null);
                }}
              >
                Back to sign in
              </Link>
            </Box>
          </>
        )}
      </Paper>
    </Box>
  );
}
