import * as sanitizeHtml from 'sanitize-html';

// Matches exactly what the frontend's Tiptap toolbar can produce — nothing else survives.
const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'u', 's', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'img'];

// Only ever our own case-image endpoint, any host — checked on pathname alone so this
// doesn't care whether the API is same-origin (prod, behind a reverse proxy) or a
// different port (dev). Rejects external hotlinks, data:, and javascript: URIs, since
// none of those produce this exact path shape.
const IMAGE_SRC_PATH = /^\/api\/case-images\/[0-9a-fA-F-]{36}\/raw$/;

function isAllowedImageSrc(src: string | undefined): boolean {
  if (!src) return false;
  try {
    const url = src.startsWith('/') ? new URL(src, 'http://placeholder.invalid') : new URL(src);
    return IMAGE_SRC_PATH.test(url.pathname);
  } catch {
    return false;
  }
}

export function sanitizeNarrativeHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: { img: ['src', 'alt'] },
    disallowedTagsMode: 'discard',
    exclusiveFilter: (frame) => frame.tag === 'img' && !isAllowedImageSrc(frame.attribs.src),
  });
}

/** Plain-text excerpt for audit-log entries — keeps the hash chain from bloating with full HTML on every edit. */
export function htmlToExcerpt(html: string, maxLen = 80): string {
  const text = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return '(empty)';
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}
