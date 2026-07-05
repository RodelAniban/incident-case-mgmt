import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Divider,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { FormEvent, useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  PIR_SECTION_KEYS,
  PIR_SECTION_LABELS,
  PirActionItem,
  PirReport,
  PirSectionKey,
  PirSections,
  PirTemplate,
  Permission,
} from '../api/types';
import { NarrativeEditor, NarrativeViewer } from './NarrativeEditor';

const EMPTY_SECTIONS: PirSections = {
  timelineNotes: '',
  rootCause: '',
  detectionGapAnalysis: '',
  responseEffectiveness: '',
  lessonsLearned: '',
};

export function PirPanel({ caseId }: { caseId: number }) {
  const { can } = useAuth();
  const canDraft = can(Permission.CREATE_EDIT_CASE);
  const canFinalize = can(Permission.FINALIZE_PIR);

  const [templates, setTemplates] = useState<PirTemplate[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [report, setReport] = useState<PirReport | null | undefined>(undefined); // undefined = loading
  const [versions, setVersions] = useState<PirReport[]>([]);
  const [actions, setActions] = useState<PirActionItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PirSections>(EMPTY_SECTIONS);
  const [saving, setSaving] = useState(false);

  const [newAction, setNewAction] = useState('');
  const [newOwner, setNewOwner] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const load = async () => {
    const { data } = await apiClient.get<PirReport | null>(`/pir/cases/${caseId}`);
    setReport(data);
    if (data) {
      const [versionsRes, actionsRes] = await Promise.all([
        apiClient.get<PirReport[]>(`/pir/cases/${caseId}/versions`),
        apiClient.get<PirActionItem[]>(`/pir/reports/${data.id}/actions`),
      ]);
      setVersions(versionsRes.data);
      setActions(actionsRes.data);
    }
  };

  useEffect(() => {
    apiClient.get<PirTemplate[]>('/pir/templates').then((res) => {
      setTemplates(res.data);
      setTemplateId(res.data[0]?.id ?? '');
    });
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const onStart = async () => {
    setError(null);
    try {
      await apiClient.post(`/pir/cases/${caseId}`, { templateId });
      await load();
    } catch {
      setError('Could not start a PIR for this case.');
    }
  };

  const startEditing = () => {
    if (report) setDraft(report.sections);
    setError(null);
    setEditing(true);
  };

  const onSave = async () => {
    if (!report) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.patch(`/pir/reports/${report.id}`, draft);
      await load();
      setEditing(false);
    } catch {
      setError('Could not save — this version may already be finalized.');
    } finally {
      setSaving(false);
    }
  };

  const onFinalize = async () => {
    if (!report) return;
    setError(null);
    try {
      await apiClient.post(`/pir/reports/${report.id}/finalize`);
      await load();
    } catch {
      setError('Could not finalize this report.');
    }
  };

  const onStartNewVersion = async () => {
    setError(null);
    try {
      await apiClient.post(`/pir/cases/${caseId}/versions`);
      await load();
    } catch {
      setError('Could not start a new version.');
    }
  };

  const onAddAction = async (event: FormEvent) => {
    event.preventDefault();
    if (!report || !newAction.trim()) return;
    await apiClient.post(`/pir/reports/${report.id}/actions`, {
      description: newAction,
      owner: newOwner || undefined,
      dueDate: newDueDate || undefined,
    });
    setNewAction('');
    setNewOwner('');
    setNewDueDate('');
    await load();
  };

  const onToggleAction = async (action: PirActionItem) => {
    await apiClient.patch(`/pir/actions/${action.id}`, { done: !action.done });
    await load();
  };

  const onDeleteAction = async (actionId: number) => {
    await apiClient.delete(`/pir/actions/${actionId}`);
    await load();
  };

  if (!canDraft && !canFinalize) {
    return null;
  }
  if (report === undefined) {
    return null; // still loading
  }

  return (
    <Paper variant="outlined">
      <Box
        sx={{
          px: 2,
          py: 1.5,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography variant="subtitle2">Post-Incident Review</Typography>
        {report && (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Chip
              label={report.finalizedAt ? `Finalized · v${report.version}` : `Draft · v${report.version}`}
              size="small"
              color={report.finalizedAt ? 'success' : 'default'}
            />
            {!report.finalizedAt && canDraft && !editing && (
              <Button size="small" onClick={startEditing}>
                Edit
              </Button>
            )}
            {!report.finalizedAt && editing && (
              <>
                <Button size="small" onClick={() => setEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button size="small" variant="contained" disableElevation onClick={onSave} disabled={saving}>
                  Save
                </Button>
              </>
            )}
            {!report.finalizedAt && canFinalize && !editing && (
              <Button size="small" variant="contained" disableElevation color="success" onClick={onFinalize}>
                Finalize
              </Button>
            )}
            {report.finalizedAt && canFinalize && (
              <Button size="small" onClick={onStartNewVersion}>
                Start new version
              </Button>
            )}
          </Box>
        )}
      </Box>

      <Box sx={{ p: 2 }}>
        {error && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {!report ? (
          canDraft ? (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField select size="small" label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)} sx={{ minWidth: 240 }}>
                {templates.map((t) => (
                  <MenuItem key={t.id} value={t.id}>
                    {t.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button variant="contained" disableElevation onClick={onStart}>
                Start PIR
              </Button>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No post-incident review has been started for this case yet.
            </Typography>
          )
        ) : (
          <>
            {templates.find((t) => t.id === report.templateId) && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {templates.find((t) => t.id === report.templateId)?.focus}
              </Typography>
            )}

            {report.finalizedAt && (
              <Alert severity="success" sx={{ mb: 2 }}>
                Finalized by {report.finalizedBy?.name} on {new Date(report.finalizedAt).toLocaleString()}.
                This version is immutable.
              </Alert>
            )}

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {PIR_SECTION_KEYS.map((key: PirSectionKey) => (
                <Box key={key}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    {PIR_SECTION_LABELS[key]}
                  </Typography>
                  {editing ? (
                    <NarrativeEditor
                      html={draft[key]}
                      caseId={caseId}
                      onChange={(html) => setDraft((prev) => ({ ...prev, [key]: html }))}
                      onError={setError}
                    />
                  ) : report.sections[key] ? (
                    <NarrativeViewer html={report.sections[key]} />
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      Not filled in yet.
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>

            {versions.length > 1 && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                  Version history:{' '}
                  {versions.map((v) => `v${v.version}${v.finalizedAt ? ' (finalized)' : ' (draft)'}`).join(' → ')}
                </Typography>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Remediation action items
            </Typography>
            {actions.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                No action items yet.
              </Typography>
            )}
            {actions.map((a) => (
              <Box key={a.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Checkbox
                  size="small"
                  checked={a.done}
                  disabled={!canDraft}
                  onChange={() => onToggleAction(a)}
                  sx={{ p: 0.5 }}
                />
                <Typography
                  variant="body2"
                  sx={{ flex: 1, textDecoration: a.done ? 'line-through' : 'none', color: a.done ? 'text.secondary' : 'text.primary' }}
                >
                  {a.description}
                  {a.owner && ` — ${a.owner}`}
                  {a.dueDate && ` (due ${a.dueDate})`}
                </Typography>
                {canDraft && (
                  <Button size="small" color="error" onClick={() => onDeleteAction(a.id)} sx={{ minWidth: 0, p: 0.5 }}>
                    <DeleteOutlineIcon fontSize="small" />
                  </Button>
                )}
              </Box>
            ))}
            {canDraft && (
              <Box component="form" onSubmit={onAddAction} sx={{ display: 'flex', gap: 1, mt: 1.5, flexWrap: 'wrap' }}>
                <TextField
                  size="small"
                  placeholder="New action item"
                  value={newAction}
                  onChange={(e) => setNewAction(e.target.value)}
                  sx={{ flex: 1, minWidth: 200 }}
                />
                <TextField
                  size="small"
                  placeholder="Owner"
                  value={newOwner}
                  onChange={(e) => setNewOwner(e.target.value)}
                  sx={{ width: 160 }}
                />
                <TextField
                  size="small"
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                  sx={{ width: 160 }}
                />
                <Button type="submit" variant="outlined" size="small" startIcon={<AddIcon fontSize="small" />}>
                  Add
                </Button>
              </Box>
            )}
          </>
        )}
      </Box>
    </Paper>
  );
}
