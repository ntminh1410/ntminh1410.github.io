import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FALLBACK_DIR = new URL('../../data/fallback/', import.meta.url);

/**
 * Resolve a tab spec ({ gid?, url? }) to a CSV URL, or null if not configured.
 */
function resolveUrl(tabName, spec, publishedBase) {
  if (!spec) return null;
  if (spec.url) return spec.url;
  if (spec.gid != null && spec.gid !== '' && publishedBase) {
    return `${publishedBase}?gid=${spec.gid}&single=true&output=csv`;
  }
  return null;
}

/**
 * Fetch CSV for one tab. If remote fetch fails or no URL configured,
 * fall back to data/fallback/<tabName>.csv. Returns CSV text + source label.
 */
export async function fetchTab(tabName, spec, publishedBase, { forceFallback = false } = {}) {
  const url = forceFallback ? null : resolveUrl(tabName, spec, publishedBase);

  if (url) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      // Google returns an HTML error page when a tab is not published — detect it.
      if (text.trimStart().startsWith('<')) {
        throw new Error('response is HTML (tab likely not published)');
      }
      return { text, source: `remote:${url}` };
    } catch (err) {
      console.warn(`[fetch] ${tabName}: remote failed (${err.message}) — using fallback`);
    }
  } else {
    console.warn(`[fetch] ${tabName}: no URL configured — using fallback`);
  }

  const fallbackPath = new URL(`${tabName}.csv`, FALLBACK_DIR);
  const text = await readFile(fallbackPath, 'utf8');
  return { text, source: `fallback:${tabName}.csv` };
}
