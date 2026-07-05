import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import SendIcon from '@mui/icons-material/Send';
import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { apiClient, AUTH_TOKEN_KEY } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { ChatMessage, NOTE_TAG_LABELS, NoteTag, Permission } from '../api/types';

// No <a> or <img> — chat deliberately has no external egress or third-party embeds.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li', 'blockquote'];

function renderMarkdown(body: string): string {
  const html = marked.parse(body, { async: false, breaks: true }) as string;
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}

const TAG_COLORS: Record<NoteTag, 'info' | 'default' | 'warning' | 'secondary'> = {
  [NoteTag.FINDING]: 'info',
  [NoteTag.HYPOTHESIS]: 'default',
  [NoteTag.ACTION_ITEM]: 'warning',
  [NoteTag.HANDOFF]: 'secondary',
};

function socketUrl(): string {
  return (apiClient.defaults.baseURL ?? '').replace(/\/api\/?$/, '');
}

export function ChatPanel({ caseId }: { caseId: number }) {
  const { user, can } = useAuth();
  const canChat = can(Permission.CHAT_ON_CASE);
  const canExport = can(Permission.EXPORT_CHAT_NOTES);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [body, setBody] = useState('');
  const [tag, setTag] = useState<NoteTag | ''>('');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!canChat) return;

    apiClient.get<ChatMessage[]>(`/chat/cases/${caseId}/messages`).then((res) => setMessages(res.data));

    const socket = io(socketUrl(), { transports: ['websocket'] });
    socketRef.current = socket;

    const join = () => {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      socket.emit('join', { caseId, token });
    };

    socket.on('connect', join);
    socket.on('joined', () => setConnectionError(null));
    socket.on('join-error', () => setConnectionError('Could not join live chat for this case.'));
    socket.on('message', (message: ChatMessage) => {
      setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
    });
    socket.on('connect_error', () => setConnectionError('Chat connection lost — retrying…'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [caseId, canChat]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ block: 'nearest' });
  }, [messages]);

  const onSend = async (event: FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    await apiClient.post(`/chat/cases/${caseId}/messages`, { body, tag: tag || undefined });
    setBody('');
    setTag('');
  };

  const onExport = async () => {
    const res = await apiClient.get(`/chat/cases/${caseId}/export`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = `case-${caseId}-chat-export.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!canChat && !canExport) {
    return null;
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
        <Typography variant="subtitle2">Chat & Notes</Typography>
        {canExport && (
          <Button size="small" startIcon={<DownloadOutlinedIcon fontSize="small" />} onClick={onExport}>
            Export
          </Button>
        )}
      </Box>

      {!canChat ? (
        <Box sx={{ p: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Your role can export a transcript of this case's chat, but can't view it live.
          </Typography>
        </Box>
      ) : (
        <>
          {connectionError && (
            <Alert severity="warning" sx={{ m: 2, mb: 0 }}>
              {connectionError}
            </Alert>
          )}
          <Box sx={{ p: 2, maxHeight: 360, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {messages.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No messages yet — say something to the team.
              </Typography>
            )}
            {messages.map((m) => (
              <Box key={m.id} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, flexWrap: 'wrap' }}>
                    <Typography
                      variant="body2"
                      sx={{ fontWeight: m.author.id === user?.id ? 700 : 500 }}
                    >
                      {m.author.name}
                    </Typography>
                    {m.tag && <Chip label={NOTE_TAG_LABELS[m.tag]} size="small" color={TAG_COLORS[m.tag]} />}
                    <Typography variant="caption" color="text.secondary">
                      {new Date(m.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                  <Box
                    sx={{ fontSize: '0.875rem', '& p': { margin: '2px 0' }, '& pre': { overflowX: 'auto' } }}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.body) }}
                  />
                </Box>
              </Box>
            ))}
            <div ref={listEndRef} />
          </Box>

          <Box
            component="form"
            onSubmit={onSend}
            sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'flex-end' }}
          >
            <TextField
              select
              size="small"
              label="Tag"
              value={tag}
              onChange={(e) => setTag(e.target.value as NoteTag | '')}
              sx={{ width: 150 }}
            >
              <MenuItem value="">None</MenuItem>
              {Object.values(NoteTag).map((t) => (
                <MenuItem key={t} value={t}>
                  {NOTE_TAG_LABELS[t]}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              size="small"
              placeholder="Write a note — markdown supported"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              multiline
              maxRows={4}
              sx={{ flex: 1 }}
            />
            <Button type="submit" variant="contained" disableElevation disabled={!body.trim()} endIcon={<SendIcon fontSize="small" />}>
              Send
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
}
