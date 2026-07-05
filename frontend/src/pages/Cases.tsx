import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  CATEGORY_LABELS,
  Case,
  CaseCategory,
  CaseSeverity,
  Permission,
  STATUS_LABELS,
} from '../api/types';
import { SeverityChip } from '../components/SeverityChip';

export function Cases() {
  const { user, can } = useAuth();
  const navigate = useNavigate();
  const [cases, setCases] = useState<Case[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState<CaseSeverity>(CaseSeverity.MEDIUM);
  const [category, setCategory] = useState<CaseCategory>(CaseCategory.OTHER);
  const [saving, setSaving] = useState(false);

  const load = () => apiClient.get<Case[]>('/cases').then((res) => setCases(res.data));

  useEffect(() => {
    load();
  }, []);

  const onCreate = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.team) return;
    setSaving(true);
    try {
      await apiClient.post('/cases', { title, severity, category, teamId: user.team.id });
      setDialogOpen(false);
      setTitle('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h5" sx={{ fontFamily: 'Georgia, serif' }}>
          Cases
        </Typography>
        {can(Permission.CREATE_EDIT_CASE) && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New case
          </Button>
        )}
      </Box>

      <Paper variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Case</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Assignee</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {cases.map((c) => (
              <TableRow key={c.id} hover onClick={() => navigate(`/cases/${c.id}`)} sx={{ cursor: 'pointer' }}>
                <TableCell sx={{ fontFamily: 'ui-monospace, monospace' }}>{c.caseNumber}</TableCell>
                <TableCell>{c.title}</TableCell>
                <TableCell>{CATEGORY_LABELS[c.category]}</TableCell>
                <TableCell>
                  <SeverityChip severity={c.severity} />
                </TableCell>
                <TableCell>{STATUS_LABELS[c.status]}</TableCell>
                <TableCell>{c.assignee?.name ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={onCreate}>
          <DialogTitle>New case</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              size="small"
              autoFocus
              required
            />
            <TextField
              select
              label="Severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as CaseSeverity)}
              size="small"
            >
              {Object.values(CaseSeverity).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value as CaseCategory)}
              size="small"
            >
              {Object.values(CaseCategory).map((c) => (
                <MenuItem key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </MenuItem>
              ))}
            </TextField>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disableElevation disabled={saving}>
              Create
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
