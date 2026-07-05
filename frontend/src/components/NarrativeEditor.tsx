import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import RedoIcon from '@mui/icons-material/Redo';
import UndoIcon from '@mui/icons-material/Undo';
import { Box, CircularProgress, Divider, IconButton, MenuItem, TextField, ToggleButton, Tooltip } from '@mui/material';
import { SxProps, Theme } from '@mui/material/styles';
import Image from '@tiptap/extension-image';
import Underline from '@tiptap/extension-underline';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';
import { useState } from 'react';
import { apiClient } from '../api/client';

// Kept in lockstep with backend/src/cases/sanitize-narrative.util.ts — the toolbar
// below can only ever produce markup that the server-side sanitizer already allows.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'img'];
const ALLOWED_ATTR = ['src', 'alt'];

const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export const narrativeContentSx: SxProps<Theme> = {
  fontSize: '0.9rem',
  lineHeight: 1.6,
  '& p': { margin: '0 0 8px' },
  '& p:last-child': { marginBottom: 0 },
  '& h1, & h2, & h3': { margin: '14px 0 8px', fontFamily: 'Georgia, serif', lineHeight: 1.3 },
  '& h1:first-of-type, & h2:first-of-type, & h3:first-of-type': { marginTop: 0 },
  '& ul, & ol': { margin: '0 0 8px', paddingLeft: '1.4em' },
  '& blockquote': {
    borderLeft: '3px solid',
    borderColor: 'divider',
    margin: '0 0 8px',
    paddingLeft: '12px',
    color: 'text.secondary',
  },
  '& img': { maxWidth: '100%', borderRadius: 4, display: 'block', margin: '8px 0' },
};

async function uploadCaseImage(caseId: number, file: File): Promise<string> {
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image exceeds the 8MB limit');
  }
  const form = new FormData();
  form.append('file', file);
  const { data } = await apiClient.post<{ publicId: string }>(`/cases/${caseId}/images`, form);
  return `${apiClient.defaults.baseURL}/case-images/${data.publicId}/raw`;
}

function StyleSelect({ editor }: { editor: NonNullable<ReturnType<typeof useEditor>> }) {
  const value = editor.isActive('heading', { level: 1 })
    ? 'h1'
    : editor.isActive('heading', { level: 2 })
      ? 'h2'
      : editor.isActive('heading', { level: 3 })
        ? 'h3'
        : 'p';

  return (
    <TextField
      select
      size="small"
      value={value}
      onChange={(e) => {
        const next = e.target.value;
        if (next === 'p') editor.chain().focus().setParagraph().run();
        else editor.chain().focus().setHeading({ level: Number(next[1]) as 1 | 2 | 3 }).run();
      }}
      sx={{ width: 150 }}
    >
      <MenuItem value="p">Paragraph</MenuItem>
      <MenuItem value="h1">Heading 1</MenuItem>
      <MenuItem value="h2">Heading 2</MenuItem>
      <MenuItem value="h3">Heading 3</MenuItem>
    </TextField>
  );
}

function Toolbar({
  editor,
  caseId,
  onError,
}: {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  caseId: number;
  onError?: (message: string) => void;
}) {
  const [uploading, setUploading] = useState(false);

  const insertImage = async (file: File) => {
    setUploading(true);
    try {
      const src = await uploadCaseImage(caseId, file);
      editor.chain().focus().setImage({ src }).run();
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        p: 1,
        borderBottom: 1,
        borderColor: 'divider',
        flexWrap: 'wrap',
      }}
    >
      <StyleSelect editor={editor} />
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Tooltip title="Bold">
        <ToggleButton
          value="bold"
          size="small"
          selected={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <FormatBoldIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Italic">
        <ToggleButton
          value="italic"
          size="small"
          selected={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <FormatItalicIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Underline">
        <ToggleButton
          value="underline"
          size="small"
          selected={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <FormatUnderlinedIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Strikethrough">
        <ToggleButton
          value="strike"
          size="small"
          selected={editor.isActive('strike')}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <FormatStrikethroughIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Tooltip title="Bullet list">
        <ToggleButton
          value="bulletList"
          size="small"
          selected={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <FormatListBulletedIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Numbered list">
        <ToggleButton
          value="orderedList"
          size="small"
          selected={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <FormatListNumberedIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Quote">
        <ToggleButton
          value="blockquote"
          size="small"
          selected={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <FormatQuoteIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Tooltip title="Insert image or screenshot">
        <span>
          <IconButton size="small" component="label" disabled={uploading}>
            {uploading ? <CircularProgress size={16} /> : <ImageOutlinedIcon fontSize="small" />}
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) insertImage(file);
              }}
            />
          </IconButton>
        </span>
      </Tooltip>
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <Tooltip title="Undo">
        <IconButton size="small" onClick={() => editor.chain().focus().undo().run()}>
          <UndoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Redo">
        <IconButton size="small" onClick={() => editor.chain().focus().redo().run()}>
          <RedoIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function NarrativeEditor({
  html,
  caseId,
  onChange,
  onError,
}: {
  html: string;
  caseId: number;
  onChange: (html: string) => void;
  onError?: (message: string) => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1, 2, 3] } }), Underline, Image],
    content: html || '<p></p>',
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      // Lets you paste a screenshot straight from the clipboard, the same way you
      // would into Word — no separate "upload" step.
      handlePaste(view, event) {
        const item = Array.from(event.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'));
        const file = item?.getAsFile();
        if (!file) return false;
        event.preventDefault();
        uploadCaseImage(caseId, file)
          .then((src) => {
            const node = view.state.schema.nodes.image.create({ src });
            view.dispatch(view.state.tr.replaceSelectionWith(node));
          })
          .catch((err) => onError?.(err instanceof Error ? err.message : 'Image upload failed.'));
        return true;
      },
      handleDrop(view, event) {
        const file = Array.from(event.dataTransfer?.files ?? []).find((f) => f.type.startsWith('image/'));
        if (!file) return false;
        event.preventDefault();
        const coords = view.posAtCoords({ left: event.clientX, top: event.clientY });
        uploadCaseImage(caseId, file)
          .then((src) => {
            const node = view.state.schema.nodes.image.create({ src });
            view.dispatch(view.state.tr.insert(coords?.pos ?? view.state.selection.from, node));
          })
          .catch((err) => onError?.(err instanceof Error ? err.message : 'Image upload failed.'));
        return true;
      },
    },
  });

  if (!editor) return null;

  return (
    <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
      <Toolbar editor={editor} caseId={caseId} onError={onError} />
      <Box sx={{ px: 1.5, py: 1, ...narrativeContentSx, '& .ProseMirror': { outline: 'none', minHeight: 160 } }}>
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}

export function NarrativeViewer({ html }: { html: string }) {
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
  return <Box sx={narrativeContentSx} dangerouslySetInnerHTML={{ __html: clean }} />;
}
