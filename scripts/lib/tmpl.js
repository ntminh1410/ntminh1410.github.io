import { readFile } from 'node:fs/promises';

/**
 * Tiny template engine: a recursive {{var}} / {{#if x}}..{{/if}} / {{#each list}}..{{/each}} processor.
 *
 *   {{name}}              — variable lookup. Dotted path supported: {{profile.name}}
 *   {{{raw_html}}}        — variable, NOT html-escaped (use for pre-rendered HTML)
 *   {{#if cond}}..{{/if}} — show inner if cond is truthy. {{#if cond}}..{{else}}..{{/if}} supported.
 *   {{#unless cond}}..{{/unless}} — opposite of if.
 *   {{#each items}}..{{/each}} — loop, exposes {{this}} and {{@index}}, plus item.field lookups.
 *
 * Partials: {{> partialName}} pulls templates/<partialName>.html and renders it with the same context.
 */

const TEMPLATES_DIR = new URL('../../templates/', import.meta.url);
const partialCache = new Map();

async function loadPartial(name) {
  if (!partialCache.has(name)) {
    const url = new URL(`${name}.html`, TEMPLATES_DIR);
    partialCache.set(name, await readFile(url, 'utf8'));
  }
  return partialCache.get(name);
}

export function clearPartialCache() {
  partialCache.clear();
}

function htmlEscape(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lookup(ctx, path) {
  if (path === 'this') return ctx.__this;
  if (path === '@index') return ctx.__index;
  if (path === '@first') return ctx.__first;
  if (path === '@last') return ctx.__last;
  const parts = path.split('.');
  let v = ctx;
  for (const p of parts) {
    if (v == null) return '';
    if (p === 'this') v = ctx.__this;
    else v = v[p];
  }
  return v == null ? '' : v;
}

function isTruthy(v) {
  if (v == null || v === '') return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') {
    const s = v.toLowerCase();
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return !!v;
}

/**
 * Tokenize template into a flat list of { type, value, raw } tokens.
 * Block tokens (#if, #each, #unless, else, /if, /each, /unless) are kept flat;
 * the renderer walks them as a stream and recurses on blocks.
 */
function tokenize(src) {
  const tokens = [];
  const re = /\{\{\{(.*?)\}\}\}|\{\{(.*?)\}\}/gs;
  let last = 0;
  let m;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: src.slice(last, m.index) });
    if (m[1] != null) {
      tokens.push({ type: 'var-raw', value: m[1].trim() });
    } else {
      const raw = m[2].trim();
      if (raw.startsWith('#if ')) tokens.push({ type: 'if-open', value: raw.slice(4).trim() });
      else if (raw.startsWith('#unless ')) tokens.push({ type: 'unless-open', value: raw.slice(8).trim() });
      else if (raw.startsWith('#each ')) tokens.push({ type: 'each-open', value: raw.slice(6).trim() });
      else if (raw === 'else') tokens.push({ type: 'else' });
      else if (raw === '/if') tokens.push({ type: 'if-close' });
      else if (raw === '/unless') tokens.push({ type: 'unless-close' });
      else if (raw === '/each') tokens.push({ type: 'each-close' });
      else if (raw.startsWith('> ')) tokens.push({ type: 'partial', value: raw.slice(2).trim() });
      else tokens.push({ type: 'var', value: raw });
    }
    last = re.lastIndex;
  }
  if (last < src.length) tokens.push({ type: 'text', value: src.slice(last) });
  return tokens;
}

async function renderTokens(tokens, ctx, start = 0, stopTypes = []) {
  let out = '';
  let i = start;
  while (i < tokens.length) {
    const t = tokens[i];
    if (stopTypes.includes(t.type)) return { out, next: i };
    if (t.type === 'text') {
      out += t.value;
      i++;
    } else if (t.type === 'var') {
      out += htmlEscape(lookup(ctx, t.value));
      i++;
    } else if (t.type === 'var-raw') {
      out += String(lookup(ctx, t.value) ?? '');
      i++;
    } else if (t.type === 'partial') {
      const partialSrc = await loadPartial(t.value);
      out += await render(partialSrc, ctx);
      i++;
    } else if (t.type === 'if-open' || t.type === 'unless-open') {
      const isUnless = t.type === 'unless-open';
      const cond = isTruthy(lookup(ctx, t.value));
      // Render true branch
      const trueBranch = await renderTokens(tokens, ctx, i + 1, ['else', isUnless ? 'unless-close' : 'if-close']);
      // Optional else branch
      let falseBranch = { out: '', next: trueBranch.next };
      if (tokens[trueBranch.next]?.type === 'else') {
        falseBranch = await renderTokens(tokens, ctx, trueBranch.next + 1, [isUnless ? 'unless-close' : 'if-close']);
      }
      const closeType = isUnless ? 'unless-close' : 'if-close';
      if (tokens[falseBranch.next]?.type !== closeType) {
        throw new Error(`Missing {{/${isUnless ? 'unless' : 'if'}}} for {{#${isUnless ? 'unless' : 'if'} ${t.value}}}`);
      }
      const useTrue = isUnless ? !cond : cond;
      out += useTrue ? trueBranch.out : falseBranch.out;
      i = falseBranch.next + 1;
    } else if (t.type === 'each-open') {
      const list = lookup(ctx, t.value);
      const items = Array.isArray(list) ? list : [];
      // Find matching /each
      let depth = 1, j = i + 1;
      while (j < tokens.length && depth > 0) {
        if (tokens[j].type === 'each-open') depth++;
        else if (tokens[j].type === 'each-close') depth--;
        if (depth > 0) j++;
      }
      if (depth !== 0) throw new Error(`Missing {{/each}} for {{#each ${t.value}}}`);
      const inner = tokens.slice(i + 1, j);
      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const childCtx = {
          ...ctx,
          ...(typeof item === 'object' && item !== null ? item : {}),
          __this: item,
          __index: idx,
          __first: idx === 0,
          __last: idx === items.length - 1,
        };
        const sub = await renderTokens(inner, childCtx, 0, []);
        out += sub.out;
      }
      i = j + 1;
    } else {
      // Unmatched else / close — treat as text to avoid crashes
      i++;
    }
  }
  return { out, next: i };
}

/**
 * Render a template string with a context object.
 */
export async function render(src, ctx) {
  const tokens = tokenize(src);
  const { out } = await renderTokens(tokens, ctx);
  return out;
}

/**
 * Render a template file by name (relative to templates/) with a context.
 */
export async function renderFile(name, ctx) {
  const src = await loadPartial(name);
  return render(src, ctx);
}
