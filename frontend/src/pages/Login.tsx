import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { isAxiosError } from 'axios';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('lead@example.com');
  const [password, setPassword] = useState('ChangeMe123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/');
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
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>
          Seeded demo accounts share the password <code>ChangeMe123!</code> — see backend/README.md.
        </Typography>
      </Paper>
    </Box>
  );
}
