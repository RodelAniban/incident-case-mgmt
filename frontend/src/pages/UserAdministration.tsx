import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Select,
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
import { AdminUser, ROLE_LABELS, Role, Team } from '../api/types';
import { useAuth } from '../auth/AuthContext';

function serverMessage(err: unknown, fallback: string): string {
  if (isAxiosError(err) && typeof err.response?.data?.message === 'string') {
    return err.response.data.message;
  }
  return fallback;
}

/** Shown once right after a create/reset — the API never returns a plaintext password again after this response. */
function TemporaryPasswordDialog({
  open,
  email,
  password,
  onClose,
}: {
  open: boolean;
  email: string;
  password: string | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Temporary password</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Share this with <strong>{email}</strong> out of band (chat, in person — not email). It won't be shown again.
        </Typography>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            bgcolor: 'action.hover',
            borderRadius: 1,
            fontFamily: 'ui-monospace, monospace',
          }}
        >
          <Typography sx={{ flexGrow: 1, fontFamily: 'inherit', wordBreak: 'break-all' }}>{password}</Typography>
          <Tooltip title={copied ? 'Copied' : 'Copy'}>
            <IconButton
              size="small"
              onClick={() => {
                if (password) navigator.clipboard.writeText(password);
                setCopied(true);
              }}
            >
              <ContentCopyOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} variant="contained" disableElevation>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function UserAdministration() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<Role>(Role.ANALYST_L1);
  const [newTeamId, setNewTeamId] = useState<number | ''>('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);

  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  const load = () => {
    apiClient.get<AdminUser[]>('/users').then((res) => setUsers(res.data));
    apiClient.get<Team[]>('/teams').then((res) => setTeams(res.data));
  };

  useEffect(() => {
    load();
  }, []);

  const patchUser = async (id: number, body: Partial<{ role: Role; teamId: number | null; isActive: boolean }>) => {
    setRowError(null);
    try {
      const res = await apiClient.patch<AdminUser>(`/users/${id}`, body);
      setUsers((prev) => prev.map((u) => (u.id === id ? res.data : u)));
    } catch (err) {
      setRowError(serverMessage(err, 'Could not update that user.'));
    }
  };

  const resetPassword = async (u: AdminUser) => {
    setRowError(null);
    try {
      const res = await apiClient.post<{ temporaryPassword: string }>(`/users/${u.id}/reset-password`);
      setTempPassword({ email: u.email, password: res.data.temporaryPassword });
    } catch (err) {
      setRowError(serverMessage(err, 'Could not reset that password.'));
    }
  };

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    setCreating(true);
    try {
      const res = await apiClient.post<{ user: AdminUser; temporaryPassword: string }>('/users', {
        name: newName,
        email: newEmail,
        role: newRole,
        teamId: newTeamId === '' ? undefined : newTeamId,
      });
      setUsers((prev) => [...prev, res.data.user]);
      setCreateOpen(false);
      setNewName('');
      setNewEmail('');
      setNewRole(Role.ANALYST_L1);
      setNewTeamId('');
      setTempPassword({ email: res.data.user.email, password: res.data.temporaryPassword });
    } catch (err) {
      setCreateError(serverMessage(err, 'Could not create that user.'));
    } finally {
      setCreating(false);
    }
  };

  const onCreateTeam = async (event: FormEvent) => {
    event.preventDefault();
    setTeamError(null);
    try {
      const res = await apiClient.post<Team>('/teams', { name: newTeamName });
      setTeams((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTeamName('');
      setTeamDialogOpen(false);
    } catch (err) {
      setTeamError(serverMessage(err, 'Could not create that team.'));
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontFamily: 'Georgia, serif', mb: 0.5 }}>
            User & Role Administration
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage accounts, roles, team assignments, and access.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<AddOutlinedIcon fontSize="small" />} onClick={() => setTeamDialogOpen(true)}>
            New team
          </Button>
          <Button size="small" variant="contained" disableElevation startIcon={<AddOutlinedIcon fontSize="small" />} onClick={() => setCreateOpen(true)}>
            New user
          </Button>
        </Box>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError}
        </Alert>
      )}
      {rowError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setRowError(null)}>
          {rowError}
        </Alert>
      )}

      <Paper variant="outlined">
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Team</TableCell>
                <TableCell>MFA</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Tooltip title={isSelf ? "You can't change your own role" : ''}>
                        <span>
                          <Select
                            size="small"
                            variant="standard"
                            value={u.role}
                            disabled={isSelf}
                            onChange={(e) => patchUser(u.id, { role: e.target.value as Role })}
                          >
                            {Object.values(Role).map((r) => (
                              <MenuItem key={r} value={r}>
                                {ROLE_LABELS[r]}
                              </MenuItem>
                            ))}
                          </Select>
                        </span>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Select
                        size="small"
                        variant="standard"
                        value={u.team?.id ?? ''}
                        displayEmpty
                        onChange={(e) => patchUser(u.id, { teamId: e.target.value === '' ? null : Number(e.target.value) })}
                      >
                        <MenuItem value="">
                          <em>Unassigned</em>
                        </MenuItem>
                        {teams.map((t) => (
                          <MenuItem key={t.id} value={t.id}>
                            {t.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.mfaEnabled ? 'Enabled' : 'Off'}
                        color={u.mfaEnabled ? 'success' : 'default'}
                        variant={u.mfaEnabled ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={u.isActive ? 'Active' : 'Disabled'}
                        color={u.isActive ? 'success' : 'error'}
                        variant={u.isActive ? 'outlined' : 'filled'}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" onClick={() => resetPassword(u)}>
                        Reset password
                      </Button>
                      <Tooltip title={isSelf ? "You can't disable your own account" : ''}>
                        <span>
                          <Button
                            size="small"
                            color={u.isActive ? 'error' : 'success'}
                            disabled={isSelf}
                            onClick={() => patchUser(u.id, { isActive: !u.isActive })}
                          >
                            {u.isActive ? 'Disable' : 'Enable'}
                          </Button>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      </Paper>

      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={onCreate}>
          <DialogTitle>New user</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {createError && <Alert severity="error">{createError}</Alert>}
            <TextField label="Full name" size="small" required value={newName} onChange={(e) => setNewName(e.target.value)} />
            <TextField
              label="Email"
              type="email"
              size="small"
              required
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <TextField select label="Role" size="small" value={newRole} onChange={(e) => setNewRole(e.target.value as Role)}>
              {Object.values(Role).map((r) => (
                <MenuItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Team (optional)"
              size="small"
              value={newTeamId}
              onChange={(e) => setNewTeamId(e.target.value === '' ? '' : Number(e.target.value))}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {teams.map((t) => (
                <MenuItem key={t.id} value={t.id}>
                  {t.name}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="caption" color="text.secondary">
              A temporary password is generated automatically and shown once after creation.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disableElevation disabled={creating || !newName || !newEmail}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Create team dialog */}
      <Dialog open={teamDialogOpen} onClose={() => setTeamDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={onCreateTeam}>
          <DialogTitle>New team</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {teamError && <Alert severity="error">{teamError}</Alert>}
            <TextField label="Team name" size="small" required autoFocus value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setTeamDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disableElevation disabled={!newTeamName.trim()}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <TemporaryPasswordDialog
        open={!!tempPassword}
        email={tempPassword?.email ?? ''}
        password={tempPassword?.password ?? null}
        onClose={() => setTempPassword(null)}
      />
    </Box>
  );
}
