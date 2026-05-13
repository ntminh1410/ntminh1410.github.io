# Tung Portfolio

Personal portfolio website with chat-bubble layout (inspired by OnFlow theme), content sourced from Google Sheets, built static via Node, deployed on GitHub Pages.

## Stack

- **Vanilla HTML/CSS/JS** — no frameworks at runtime
- **Node 20+** build script — fetches Google Sheet CSV per tab, renders HTML templates, emits `dist/`
- **GitHub Actions** — fetches sheet + rebuilds + deploys every 30 minutes (or on push)
- **GitHub Pages** — hosts the static `dist/` output

## Quick commands

```bash
npm install              # one-time
npm run dev              # build (fallback data) + serve at http://localhost:4173
npm run build            # fetch real sheet + build
npm run build:offline    # build using local data/fallback/*.csv only
npm run serve            # serve dist/ at :4173 (no build)
```

## Where to edit content

Don't touch HTML — edit the Google Sheet instead. See [SETUP.md](./SETUP.md) for the full guide.

| Want to change… | Edit tab… |
|---|---|
| Profile name, bio, socials, accent color | `Settings` |
| Blog posts | `Writings` (set `status` = `published`) |
| Portfolio items | `Projects` |
| Tools you recommend | `Recommendations` |
| Tag list & colors | `Tags` |
| Top nav / footer links | `Navigation` |

## File layout

```
site/
├── .github/workflows/build-deploy.yml  # CI: fetch sheet → build → deploy
├── config/sources.json                  # Sheet URLs / gid mapping
├── data/fallback/*.csv                  # Demo data when sheet fetch fails
├── scripts/
│   ├── build.js                         # Main build orchestrator
│   ├── serve.js                         # Local dev server
│   └── lib/                             # CSV parser, fetcher, template engine, markdown
├── static/
│   ├── css/styles.css
│   └── js/main.js
├── templates/
│   ├── layout.html                      # HTML shell (head + header + footer + content slot)
│   ├── index.html                       # Home page
│   ├── writings.html, writing.html      # Writings list + detail
│   ├── projects.html, project.html      # Projects list + detail
│   ├── 404.html
│   └── _*.html                          # Partials (header, footer, profile, newsletter, ...)
└── dist/                                # Build output (gitignored, deployed by CI)
```

## Design

Chat-bubble aesthetic per `Tung-portfolio-mo-ta.md`:
- Single column, max 680px
- Geist Variable font
- Light + dark + system theme (no flash on load)
- Accent color configurable per `site.accent_color` in Settings sheet
- Soft `--bg-bubble` cards with hover lift

## Adding new content types

To add a new section (e.g., "Speaking" or "Bookshelf"):

1. Add a tab to the Google Sheet with header row.
2. Add the tab name + gid to `config/sources.json` under `tabs`.
3. Add a parser in `scripts/lib/data.js`.
4. Create a template in `templates/`.
5. Add a build step in `scripts/build.js`.

## License

Code MIT — content (`data/fallback/*.csv`, Google Sheet) belongs to the author.
