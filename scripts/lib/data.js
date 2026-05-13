import { parseCsv, parseKv, toBool, sortByOrder } from './csv.js';
import { fetchTab } from './fetch-sheet.js';

const TAB_NAMES = ['settings', 'writings', 'projects', 'recommendations', 'tags', 'navigation'];

export async function loadAllData(config, { forceFallback = false } = {}) {
  const raw = {};
  for (const name of TAB_NAMES) {
    const { text, source } = await fetchTab(name, config.tabs?.[name], config.publishedBase, { forceFallback });
    raw[name] = parseCsv(text);
    console.log(`[data] ${name}: ${raw[name].length} rows (${source})`);
  }

  const settings = parseKv(raw.settings);

  const tags = raw.tags
    .filter(r => r.slug)
    .map(r => ({
      slug: r.slug,
      name: r.name || r.slug,
      description: r.description || '',
      color: r.color || settings.accent_color || '#0084FF',
      visible_in_filter: toBool(r.visible_in_filter),
      sort_order: r.sort_order,
    }));
  const tagBySlug = new Map(tags.map(t => [t.slug, t]));

  const writings = raw.writings
    .filter(r => toBool(r.status === 'published' ? true : r.status === 'published'))
    .filter(r => r.id && r.title)
    .map(r => {
      const tagSlugs = (r.tags || '').split(',').map(s => s.trim()).filter(Boolean);
      const tagObjs = tagSlugs.map(s => tagBySlug.get(s) || { slug: s, name: s, color: settings.accent_color || '#0084FF' });
      const date = r.publish_date || '';
      return {
        id: r.id,
        status: r.status || 'draft',
        slug: r.slug || r.id,
        title: r.title,
        icon: r.icon || '',
        summary: r.summary || '',
        body_md: r.body_md || '',
        publish_date: date,
        date_display: formatDate(date),
        date_short: formatDateShort(date),
        year: normalizeYear(r.year, date),
        tag_slugs: tagSlugs,
        tags: tagObjs,
        featured_image: r.featured_image || '',
        access: r.access || 'public',
        featured: toBool(r.featured),
        author: r.author || settings.profile_name || '',
        seo_title: r.seo_title || `${r.title} | ${settings.site_title}`,
        seo_description: r.seo_description || r.summary || '',
      };
    });
  // status filter: only "published" → output
  const writingsPublished = writings.filter(w => w.status === 'published');
  // newest first by publish_date
  writingsPublished.sort((a, b) => String(b.publish_date).localeCompare(String(a.publish_date)));

  const projects = raw.projects
    .filter(r => r.id && r.title && r.status === 'published')
    .map(r => ({
      id: r.id,
      status: r.status,
      slug: r.slug || r.id,
      title: r.title,
      description: r.description || '',
      image_url: r.image_url || '',
      image_alt: r.image_alt || r.title,
      gradient_from: r.gradient_from || '#0084FF',
      gradient_to: r.gradient_to || '#4FB1FF',
      project_url: r.project_url || '',
      github_url: r.github_url || '',
      tech: (r.tech || '').split(',').map(s => s.trim()).filter(Boolean),
      featured: toBool(r.featured),
      publish_date: r.publish_date,
      date_display: formatDate(r.publish_date),
      date_short: formatDateShort(r.publish_date),
      year: normalizeYear(r.year, r.publish_date),
      sort_order: r.sort_order,
      is_coming_soon: /coming\s*soon/i.test(r.description || ''),
    }));
  const projectsSorted = sortByOrder(projects);

  const recommendations = sortByOrder(
    raw.recommendations
      .filter(r => r.id && r.name && r.status === 'published')
      .map(r => ({
        id: r.id,
        status: r.status,
        name: r.name,
        category: r.category || '',
        logo_emoji: r.logo_emoji || '',
        logo_url: r.logo_url || '',
        brand_color: r.brand_color || '#1E1E1E',
        url: r.url || '',
        description: r.description || '',
        featured: toBool(r.featured),
        sort_order: r.sort_order,
      }))
  );

  // Navigation grouped by location
  const nav = { primary: [], secondary: [], footer: [] };
  for (const row of raw.navigation) {
    if (!row.label) continue;
    const loc = (row.location || 'primary').toLowerCase();
    if (!nav[loc]) nav[loc] = [];
    nav[loc].push({
      label: row.label,
      url: row.url || '#',
      open_in_new_tab: toBool(row.open_in_new_tab),
      sort_order: row.sort_order,
      external: /^https?:\/\//.test(row.url || ''),
    });
  }
  for (const k of Object.keys(nav)) {
    nav[k] = sortByOrder(nav[k]);
  }

  const profile = {
    name: settings.profile_name || settings.site_title || '',
    tagline: settings.profile_tagline || '',
    bio: settings.profile_bio || '',
    avatar_url: settings.profile_avatar_url || '',
    socials: [
      { type: 'x', url: settings.social_x, label: 'X' },
      { type: 'facebook', url: settings.social_facebook, label: 'Facebook' },
      { type: 'instagram', url: settings.social_instagram, label: 'Instagram' },
      { type: 'linkedin', url: settings.social_linkedin, label: 'LinkedIn' },
      { type: 'github', url: settings.social_github, label: 'GitHub' },
    ].filter(s => s.url),
  };

  const site = {
    title: settings.site_title || 'Portfolio',
    description: settings.site_description || '',
    url: (settings.site_url || '').replace(/\/$/, ''),
    accent_color: settings.accent_color || '#0084FF',
    color_scheme_default: settings.color_scheme_default || 'system',
    footer_copyright: settings.footer_copyright || '',
    meta_og_image: settings.meta_og_image || '',
    analytics_provider: settings.analytics_provider || '',
    analytics_site_id: settings.analytics_site_id || '',
  };

  const newsletter = {
    enabled: toBool(settings.newsletter_enabled),
    provider: settings.newsletter_provider || '',
    endpoint: settings.newsletter_endpoint || '',
    title: settings.newsletter_title || 'Subscribe to Newsletter',
    desc: settings.newsletter_desc || '',
  };

  return {
    site,
    profile,
    newsletter,
    nav,
    tags,
    writings: writingsPublished,
    projects: projectsSorted,
    recommendations,
    raw_settings: settings,
  };
}

function normalizeYear(rawYear, dateStr) {
  // Strip trailing ".0" from openpyxl-extracted numbers; fall back to year from date.
  if (rawYear) {
    const s = String(rawYear).replace(/\.0+$/, '').trim();
    if (/^\d{4}$/.test(s)) return s;
  }
  if (dateStr) {
    const m = String(dateStr).match(/^(\d{4})/);
    if (m) return m[1];
  }
  return '';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  // Accept YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  const d = new Date(String(dateStr));
  if (Number.isNaN(d.getTime())) return String(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/**
 * Group writings by year, returning [{year, items}, ...] sorted desc.
 */
export function groupWritingsByYear(writings) {
  const byYear = new Map();
  for (const w of writings) {
    const y = String(w.year || '—');
    if (!byYear.has(y)) byYear.set(y, []);
    byYear.get(y).push(w);
  }
  return [...byYear.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([year, items]) => ({ year, items }));
}
