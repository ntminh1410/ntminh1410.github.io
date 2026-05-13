#!/usr/bin/env node
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAllData, groupWritingsByYear } from './lib/data.js';
import { render, renderFile, clearPartialCache } from './lib/tmpl.js';
import { md, mdInline } from './lib/md.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const DIST = new URL('../dist/', import.meta.url);
const STATIC_SRC = new URL('../static/', import.meta.url);
const STATIC_DST = new URL('../dist/static/', import.meta.url);
const CONFIG_PATH = new URL('../config/sources.json', import.meta.url);

const HOME_WRITINGS_LIMIT = 6;
const HOME_PROJECTS_LIMIT = 3;

const SOCIAL_ICONS = {
  x: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M18.244 2H21l-6.52 7.45L22 22h-6.86l-4.78-6.43L4.86 22H2.1l6.97-7.96L2 2h6.91l4.33 5.93L18.244 2Zm-1.2 18.4h1.55L7.04 3.5H5.4l11.644 16.9Z"/></svg>`,
  facebook: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M22 12a10 10 0 1 0-11.56 9.88V14.9H7.9V12h2.54V9.8c0-2.5 1.5-3.9 3.78-3.9 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.77l-.44 2.9h-2.33v6.98A10 10 0 0 0 22 12Z"/></svg>`,
  instagram: `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.4A4 4 0 1 1 12.6 8 4 4 0 0 1 16 11.4z"/><line x1="17.5" y1="6.5" x2="17.5" y2="6.5"/></svg>`,
  linkedin: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19 0H5a5 5 0 0 0-5 5v14a5 5 0 0 0 5 5h14a5 5 0 0 0 5-5V5a5 5 0 0 0-5-5ZM8 19H5V8h3v11Zm-1.5-12.5a1.75 1.75 0 1 1 0-3.5 1.75 1.75 0 0 1 0 3.5ZM20 19h-3v-5.5c0-1.4-.5-2.5-2-2.5s-2 1.1-2 2.5V19h-3V8h3v1.4A4 4 0 0 1 16.5 8c2.6 0 3.5 1.8 3.5 4.5V19Z"/></svg>`,
  github: `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.67 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.17a11 11 0 0 1 5.79 0c2.2-1.48 3.17-1.17 3.17-1.17.63 1.58.23 2.75.12 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.37-5.26 5.66.41.35.78 1.05.78 2.12v3.14c0 .31.21.66.79.55C20.21 21.38 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z"/></svg>`,
};

function socialsHtml(socials) {
  return socials.map(s => {
    const icon = SOCIAL_ICONS[s.type] || `<span>${s.label}</span>`;
    return `<li><a href="${s.url}" target="_blank" rel="noopener" aria-label="${s.label}">${icon}</a></li>`;
  }).join('');
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function contactSocialsHtml(socials) {
  return socials.map(s => {
    const icon = SOCIAL_ICONS[s.type] || `<span>${s.label[0]}</span>`;
    return `<a class="contact-alt__item" href="${escapeAttr(s.url)}" target="_blank" rel="noopener" aria-label="${escapeAttr(s.label)}">` +
      `${icon}<span>${escapeAttr(s.label)}</span>` +
      `</a>`;
  }).join('');
}

async function readConfig() {
  const raw = await readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(raw);
}

async function writePage(relPath, html) {
  const out = new URL(relPath, DIST);
  await mkdir(new URL('.', out), { recursive: true });
  await writeFile(out, html, 'utf8');
  console.log(`[write] dist/${relPath}`);
}

async function copyStatic() {
  await cp(STATIC_SRC, STATIC_DST, { recursive: true });
  console.log('[copy] static/ → dist/static/');
}

async function renderPage({ template, ctx, title, description, path, content_partial_html }) {
  const pageInner = template
    ? await renderFile(template, ctx)
    : (content_partial_html ?? '');
  const html = await renderFile('layout', {
    ...ctx,
    page_content: pageInner,
    page_title: title,
    page_description: description,
    page_path: path,
  });
  return html;
}

async function buildHome(data) {
  const homeWritings = data.writings.slice(0, HOME_WRITINGS_LIMIT);
  const homeProjects = data.projects.filter(p => p.featured).concat(
    data.projects.filter(p => !p.featured)
  ).slice(0, HOME_PROJECTS_LIMIT);

  const home_writings_html = await renderFile('_writings_list', {
    year_groups: groupWritingsByYear(homeWritings),
  });
  const home_projects_html = await renderFile('_projects_list', {
    projects: homeProjects,
  });
  const recommendations_html = data.recommendations.length
    ? await renderFile('_recommendations', { recommendations: data.recommendations })
    : '';

  const ctx = {
    ...data,
    home_writings_html,
    home_projects_html,
    recommendations_html,
    has_more_writings: data.writings.length > HOME_WRITINGS_LIMIT,
    has_more_projects: data.projects.length > HOME_PROJECTS_LIMIT,
  };

  const html = await renderPage({
    template: 'index',
    ctx,
    title: data.site.title,
    description: data.site.description,
    path: '/',
  });
  await writePage('index.html', html);
}

async function buildWritings(data) {
  const writings_html = await renderFile('_writings_list', {
    year_groups: groupWritingsByYear(data.writings),
  });
  const ctx = { ...data, writings_html, is_all: true };
  const html = await renderPage({
    template: 'writings',
    ctx,
    title: `Writings · ${data.site.title}`,
    description: 'Notes on design, tools, and process.',
    path: '/writings/',
  });
  await writePage('writings/index.html', html);
}

async function buildWritingsByTag(data) {
  for (const tag of data.tags) {
    if (!tag.visible_in_filter) continue;
    const items = data.writings.filter(w => w.tag_slugs.includes(tag.slug));
    if (!items.length) continue;
    const writings_html = await renderFile('_writings_list', {
      year_groups: groupWritingsByYear(items),
    });
    // Inject @active flag on the matching tag chip
    const tagsCtx = data.tags.map(t => ({ ...t, '@active': t.slug === tag.slug }));
    const ctx = { ...data, tags: tagsCtx, writings: items, writings_html, is_all: false };
    const html = await renderPage({
      template: 'writings',
      ctx,
      title: `${tag.name} · Writings · ${data.site.title}`,
      description: tag.description || `Writings tagged "${tag.name}"`,
      path: `/writings/tag/${tag.slug}/`,
    });
    await writePage(`writings/tag/${tag.slug}/index.html`, html);
  }
}

async function buildWritingDetails(data) {
  for (const w of data.writings) {
    const writing = {
      ...w,
      body_html: md(w.body_md),
      access_paid: w.access && w.access.toLowerCase() === 'paid',
    };
    const ctx = { ...data, writing };
    const html = await renderPage({
      template: 'writing',
      ctx,
      title: writing.seo_title || `${writing.title} · ${data.site.title}`,
      description: writing.seo_description || writing.summary,
      path: `/writings/${writing.slug}/`,
    });
    await writePage(`writings/${writing.slug}/index.html`, html);
  }
}

async function buildProjects(data) {
  const projects_html = await renderFile('_projects_list', { projects: data.projects });
  const ctx = { ...data, projects_html };
  const html = await renderPage({
    template: 'projects',
    ctx,
    title: `Projects · ${data.site.title}`,
    description: "Things I've built, shipped, or am still tinkering with.",
    path: '/projects/',
  });
  await writePage('projects/index.html', html);
}

async function buildProjectDetails(data) {
  for (const p of data.projects) {
    if (!p.is_post) continue;  // External-link projects don't get a detail page
    const project = {
      ...p,
      body_html: md(p.body_md),
      has_actions: !!(p.project_url || p.github_url),
    };
    const ctx = { ...data, project };
    const html = await renderPage({
      template: 'project',
      ctx,
      title: `${project.title} · ${data.site.title}`,
      description: project.description,
      path: `/projects/${project.slug}/`,
    });
    await writePage(`projects/${project.slug}/index.html`, html);
  }
}

async function buildContact(data) {
  const ctx = {
    ...data,
    contact_socials_html: contactSocialsHtml(data.profile.socials),
  };
  const html = await renderPage({
    template: 'contact',
    ctx,
    title: `Contact · ${data.site.title}`,
    description: data.contact.intro || 'Get in touch.',
    path: '/contact/',
  });
  await writePage('contact/index.html', html);

  const thanksHtml = await renderPage({
    template: 'contact-thanks',
    ctx: data,
    title: `Message received · ${data.site.title}`,
    description: 'Your message has been received.',
    path: '/contact/thanks/',
  });
  await writePage('contact/thanks/index.html', thanksHtml);
}

async function build404(data) {
  const html = await renderPage({
    template: '404',
    ctx: data,
    title: `404 · ${data.site.title}`,
    description: 'Page not found',
    path: '/404.html',
  });
  await writePage('404.html', html);
}

async function buildRssFeed(data) {
  const items = data.writings.slice(0, 20).map(w => {
    const link = `${data.site.url}/writings/${w.slug}/`;
    const pubDate = w.publish_date ? new Date(w.publish_date).toUTCString() : new Date().toUTCString();
    return `    <item>
      <title>${escapeXml(w.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(w.summary || '')}</description>
    </item>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(data.site.title)}</title>
    <link>${data.site.url}</link>
    <description>${escapeXml(data.site.description)}</description>
    <language>en-us</language>
${items}
  </channel>
</rss>`;
  await writePage('rss.xml', xml);
}

function escapeXml(s) {
  return String(s ?? '').replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

async function buildSitemap(data) {
  const urls = ['/', '/writings/', '/projects/', '/contact/']
    .concat(data.writings.map(w => `/writings/${w.slug}/`))
    .concat(data.projects.filter(p => p.is_post).map(p => `/projects/${p.slug}/`))
    .concat(data.tags.filter(t => t.visible_in_filter).map(t => `/writings/tag/${t.slug}/`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${data.site.url}${u}</loc></url>`).join('\n')}
</urlset>`;
  await writePage('sitemap.xml', xml);
}

async function buildNoJekyll() {
  await writeFile(new URL('.nojekyll', DIST), '');
  console.log('[write] dist/.nojekyll');
}

async function main() {
  const startedAt = Date.now();
  const useFallback = process.env.USE_FALLBACK === '1';

  console.log('▸ Reading config…');
  const config = await readConfig();

  console.log(`▸ Loading data ${useFallback ? '(forced fallback)' : ''}…`);
  const data = await loadAllData(config, { forceFallback: useFallback });

  // Enrich profile with pre-rendered socials HTML + initial
  data.profile.socials_html = socialsHtml(data.profile.socials);
  data.profile.name_initial = (data.profile.name || '?').trim()[0] || '?';

  // Pre-render summary for prose contexts
  for (const w of data.writings) {
    w.summary = w.summary || '';
  }

  console.log('▸ Cleaning dist/…');
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  console.log('▸ Copying static assets…');
  await copyStatic();

  console.log('▸ Building pages…');
  await buildHome(data);
  await buildWritings(data);
  await buildWritingsByTag(data);
  await buildWritingDetails(data);
  await buildProjects(data);
  await buildProjectDetails(data);
  await buildContact(data);
  await build404(data);
  await buildRssFeed(data);
  await buildSitemap(data);
  await buildNoJekyll();

  clearPartialCache();

  const dur = ((Date.now() - startedAt) / 1000).toFixed(2);
  console.log(`\n✓ Build complete in ${dur}s`);
  console.log(`  ${data.writings.length} writings · ${data.projects.length} projects · ${data.recommendations.length} recommendations`);
}

main().catch(err => {
  console.error('\n✗ Build failed:');
  console.error(err);
  process.exit(1);
});
