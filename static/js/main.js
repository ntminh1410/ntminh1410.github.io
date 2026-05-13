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
      if (!form.action) {
        e.preventDefault();
        if (btn) { btn.disabled = false; btn.style.opacity = ''; }
        alert('Newsletter endpoint not configured.');
      }
    });
  });

  // ---- Contact form: submit to Web3Forms via fetch, inline feedback ----
  document.querySelectorAll('[data-contact-form] form').forEach(form => {
    const feedback = form.querySelector('[data-form-feedback]');
    const submitBtn = form.querySelector('button[type="submit"]');
    const submitLabel = submitBtn ? submitBtn.querySelector('.contact-form__submit-label') : null;

    function setBusy(busy) {
      if (!submitBtn) return;
      submitBtn.disabled = busy;
      submitBtn.classList.toggle('is-loading', busy);
      if (submitLabel) submitLabel.textContent = busy ? 'Sending…' : 'Send message';
    }
    function showFeedback(kind, message) {
      if (!feedback) return;
      feedback.className = `contact-form__feedback contact-form__feedback--${kind}`;
      feedback.textContent = message;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      setBusy(true);
      showFeedback('', '');

      const data = new FormData(form);
      // Use "user_subject" (visible field) as the email subject if provided
      const userSubject = data.get('user_subject');
      if (userSubject) data.set('subject', userSubject);
      data.delete('user_subject');
      // Strip the "redirect" hint — only relevant if browser submits natively
      data.delete('redirect');

      try {
        const res = await fetch(form.action, {
          method: 'POST',
          body: data,
          headers: { 'Accept': 'application/json' },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          // Hop over to the thanks page
          window.location.href = '/contact/thanks/';
          return;
        }
        showFeedback('error', json.message || `Something went wrong (HTTP ${res.status}). Try emailing me directly.`);
        setBusy(false);
      } catch (err) {
        showFeedback('error', `Network error: ${err.message}. Try emailing me directly.`);
        setBusy(false);
      }
    });
  });
})();
