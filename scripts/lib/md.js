import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

export function md(text) {
  if (!text) return '';
  return marked.parse(String(text));
}

/**
 * For previews/summaries — render inline markdown (no block elements).
 */
export function mdInline(text) {
  if (!text) return '';
  return marked.parseInline(String(text));
}
