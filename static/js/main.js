(function () {
  'use strict';

  // ---- Theme toggle: cycles light → dark → system ----
  const root = document.documentElement;
  const STORAGE_KEY = 'theme';

  function readTheme() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }
  function writeTheme(val) {
    try {
      if (val === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, val);
    } catch (e) { /* ignore */ }
  }
  function applyTheme(theme) {
    if (!theme || theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }
  }
  function currentEffective() {
    const saved = readTheme();
    if (saved === 'light' || saved === 'dark') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const toggle = document.querySelector('[data-theme-toggle]');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const effective = currentEffective();
      const next = effective === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      writeTheme(next);
    });
  }

  // ---- Back-to-top ----
  const backBtn = document.querySelector('[data-back-to-top]');
  if (backBtn) {
    backBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ---- Mark current nav link ----
  const here = window.location.pathname.replace(/\/index\.html$/, '/');
  document.querySelectorAll('.site-nav__link').forEach(a => {
    const href = a.getAttribute('href');
    if (!href) return;
    if (href === '/' && here === '/') a.classList.add('is-active');
    else if (href !== '/' && here.startsWith(href)) a.classList.add('is-active');
  });

  // ---- Newsletter form: basic UX feedback (does not replace provider behaviour) ----
  document.querySelectorAll('.newsletter__form').forEach(form => {
    form.addEventListener('submit', e => {
      const input = form.querySelector('input[type="email"]');
      if (!input || !input.value) return;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) {
        btn.style.opacity = '0.7';
        btn.disabled = true;
      }
      // The form will submit naturally if `action` is set. Otherwise, no-op.
      if (!form.action) {
        e.preventDefault();
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        alert('Newsletter endpoint not configured.');
      }
    });
  });
})();
