// ==UserScript==
// @name           RentBot form helper
// @name:de        RentBot Formular-Helfer
// @namespace      rentmeifyoucan
// @version        1.0.0
// @description    Fills in flat application forms with the answers from your RentBot in Telegram. You check them, solve the captcha and send.
// @description:de Füllt Bewerbungsformulare mit den Antworten aus deinem RentBot in Telegram aus. Du prüfst, löst das Captcha und sendest.
// @match          https://*/*rentbot-helper.html*
// @match          https://app.wohnungshelden.de/*
// @match          https://www.degewo.de/*
// @match          https://www.wbm.de/*
// @grant          GM.getValue
// @grant          GM.setValue
// @grant          GM.deleteValue
// @grant          GM_getValue
// @grant          GM_setValue
// @grant          GM_deleteValue
// @run-at         document-start
// @noframes
// ==/UserScript==

// How it works: the bot's "✍️ Fill in form" button opens rentbot-helper.html
// with the answers in the URL fragment (#f=…, never sent to any server).
// On that page this script stores them and goes on to the form; on the form
// page it fills them in and shows what it did. Nothing is ever submitted:
// the user checks the form, solves the captcha and sends it.

'use strict';

async function main() {
  if (window.top !== window) return;

  const VERSION = '1.0.0';
  const KEY = 'fill';
  const MAX_AGE = 2 * 3600e3; // stored answers are used for this long

  const gm = typeof GM !== 'undefined' && GM && GM.getValue;
  const store = {
    get: (k) => (gm ? GM.getValue(k) : Promise.resolve(GM_getValue(k))),
    set: (k, v) => (gm ? GM.setValue(k, v) : Promise.resolve(GM_setValue(k, v))),
    del: (k) => (gm ? GM.deleteValue(k) : Promise.resolve(GM_deleteValue(k))),
  };

  // ---------- the helper page: take the answers, open the form ----------

  if (/rentbot-helper\.html$/i.test(location.pathname)) {
    mark('data-rentbot-helper', VERSION);
    const m = /[#&]f=([\w-]+)/.exec(location.hash);
    if (!m) return;
    try {
      const p = await decode(m[1]);
      if (!p || !/^https:\/\//.test(p.u) || !Array.isArray(p.a)) throw new Error('bad payload');
      await store.set(KEY, JSON.stringify({ p, at: Date.now() }));
      location.replace(p.u);
    } catch (e) {
      mark('data-rentbot-error', String((e && e.message) || e));
    }
    return;
  }

  // ---------- a form page: fill it in if answers are waiting for it ----------

  let rec;
  try {
    rec = JSON.parse((await store.get(KEY)) || 'null');
  } catch (e) {
    rec = null;
  }
  if (!rec || !rec.p) return;
  if (Date.now() - rec.at > MAX_AGE) {
    await store.del(KEY);
    return;
  }
  if (formKey(rec.p.u) !== formKey(location.href)) return;
  await domReady();
  await new Filler(rec.p).run();

  // ---------- helpers ----------

  // mark tells the helper page that the script runs (at document-start the
  // page's <html> element may not exist yet).
  function mark(name, value) {
    if (document.documentElement) document.documentElement.setAttribute(name, value);
    else setTimeout(() => mark(name, value), 0);
  }

  async function decode(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    const stream = new Blob([bin]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return JSON.parse(await new Response(stream).text());
  }

  // formKey identifies a form page: host and path (the query and the
  // fragment can differ, e.g. an anchor to the form).
  function formKey(u) {
    try {
      const x = new URL(u);
      let path = x.pathname;
      try {
        path = decodeURIComponent(path);
      } catch (e) {}
      return x.host + path.replace(/\/+$/, '');
    } catch (e) {
      return '';
    }
  }

  function domReady() {
    if (document.readyState !== 'loading') return Promise.resolve();
    return new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}

// norm makes texts comparable: no tags, marks or extra spaces, lower case.
function norm(s) {
  return String(s == null ? '' : s)
    .normalize('NFKC')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*:?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function shown(el) {
  if (!el || !el.isConnected) return false;
  if (el.type === 'hidden' || el.getAttribute('aria-hidden') === 'true') return false;
  for (let e = el; e && e !== document.documentElement; e = e.parentElement) {
    if (e.hidden) return false;
    const cs = getComputedStyle(e);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return true;
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitFor(fn, ms) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v || Date.now() > end) return v;
    await wait(50);
  }
}

const TEXT = {
  de: {
    filling: '✍️ RentBot füllt das Formular aus…',
    filled: (n, m) => `✍️ RentBot hat ${n} von ${m} Feldern ausgefüllt.`,
    yourself: 'Bitte selbst ausfüllen:',
    missed: 'Nicht gefunden, bitte von Hand:',
    then: 'Prüfe die Angaben, löse das Captcha und sende ab.',
    thenNoCaptcha: 'Prüfe die Angaben und sende ab.',
    captcha: 'Zum Captcha',
    close: 'Schließen',
    none: 'RentBot hat hier keine Felder gefunden. Ist das das richtige Formular?',
  },
  en: {
    filling: '✍️ RentBot is filling in the form…',
    filled: (n, m) => `✍️ RentBot filled in ${n} of ${m} fields.`,
    yourself: 'Please fill in yourself:',
    missed: 'Not found, please fill in by hand:',
    then: 'Check the answers, solve the captcha and send.',
    thenNoCaptcha: 'Check the answers and send.',
    captcha: 'Go to captcha',
    close: 'Close',
    none: "RentBot didn't find any fields here. Is this the right form?",
  },
};

// Filler fills a form with the bot's answers: [label, value, key, raw].
// key names the field (its id, name, Angular formControlName or formly
// key); without it the label finds the field. raw is the form's own value
// when it differs from the shown value (option values, 1/0).
class Filler {
  constructor(p) {
    this.t = TEXT[p.l === 'de' ? 'de' : 'en'];
    this.answers = p.a.map(([label, value, key, raw]) => ({
      label: label || '',
      value: value || '',
      key: key || '',
      raw: raw || '',
      done: false,
    }));
  }

  async run() {
    this.badge(this.t.filling, []);
    const start = Date.now();
    let idle = 0;
    let seen = false;
    while (Date.now() - start < 30000) {
      let progress = false;
      for (const a of this.answers) {
        if (a.done) continue;
        const els = this.locate(a);
        if (!els.length) continue;
        seen = true;
        if (!a.value) {
          this.mark(els[0], 'check');
          continue;
        }
        let ok = false;
        try {
          ok = await this.set(a, els);
        } catch (e) {
          ok = false;
        }
        if (ok) {
          a.done = progress = true;
          this.mark(els[0], 'ok');
        }
      }
      if (this.answers.every((a) => a.done || !a.value)) break;
      idle = progress ? 0 : idle + 300;
      // Fields can appear after others are answered (or the app loads late).
      if (idle > (seen ? 3000 : 15000)) break;
      await wait(300);
    }
    // Fields to fill in yourself may have appeared last.
    for (const a of this.answers) {
      if (!a.value) {
        const els = this.locate(a);
        if (els.length) this.mark(els[0], 'check');
      }
    }
    this.finish(seen);
  }

  // locate returns the visible form controls of an answer (for a radio
  // question: all its options).
  locate(a) {
    let els = a.key ? this.byKey(a.key) : [];
    if (!els.length) els = this.byLabel(a.label);
    els = els.filter((e) => shown(e.type === 'radio' || e.type === 'checkbox' ? e.closest('label') || e : e));
    if (els.length && els[0].type === 'radio' && els[0].name) {
      const group = [...document.getElementsByName(els[0].name)].filter((e) => e.type === 'radio');
      if (group.length) return group;
    }
    return els;
  }

  byKey(key) {
    const out = [];
    const add = (e) => {
      if (e && !out.includes(e) && e.matches('input, select, textarea') && e.type !== 'hidden') out.push(e);
    };
    add(document.getElementById(key));
    const k = key.replace(/["\\]/g, '\\$&');
    try {
      document
        .querySelectorAll(`[name="${k}"], [formcontrolname="${k}"], [name$="[${k}]"], [name$="[${k}][]"]`)
        .forEach(add);
    } catch (e) {}
    // Angular formly: id formly_<n>_<type>_<key>_<i>, radio options get -<option>.
    document.querySelectorAll('[id^="formly_"]').forEach((e) => {
      const m = /^formly_\d+_[a-z]+_(.+)_\d+(?:-.*)?$/i.exec(e.id);
      if (m && m[1] === key) add(e);
    });
    return out;
  }

  byLabel(label) {
    const want = norm(label);
    if (want.length < 2) return [];
    const head = want.slice(0, 50);
    const fits = (t) => {
      t = norm(t);
      return t && (t === want || (t.length >= 4 && (t.startsWith(head) || want.startsWith(t))));
    };
    for (const el of document.querySelectorAll('input, select, textarea')) {
      if (el.type === 'hidden' || el.type === 'submit' || el.type === 'button' || el.tabIndex < 0) continue;
      const texts = [
        el.labels && el.labels[0] && el.labels[0].textContent,
        el.getAttribute('aria-label'),
        el.getAttribute('title'),
        el.getAttribute('placeholder'),
      ];
      const wrap = el.closest('formly-field, nz-form-item, .ant-form-item, .form-group, fieldset');
      const lab = wrap && wrap.querySelector('label, legend');
      if (lab && !lab.contains(el)) texts.push(lab.textContent);
      if (texts.some(fits)) return [el];
    }
    return [];
  }

  async set(a, els) {
    const el = els[0];
    if (el.type === 'radio') return this.setRadio(a, els);
    if (el.type === 'checkbox') return this.setCheckbox(a, el);
    if (el.tagName === 'SELECT') return this.setSelect(a, el);
    const dd = el.closest('ng-select, .ng-select, nz-select, .ant-select');
    if (dd) return this.setDropdown(a, dd);
    return this.setText(el, a.raw || a.value);
  }

  setText(el, v) {
    if (el.type === 'date') {
      const m = /^(\d\d)\.(\d\d)\.(\d{4})$/.exec(v);
      if (m) v = `${m[3]}-${m[2]}-${m[1]}`;
    }
    if (el.type === 'number') v = v.replace(/[^\d,.-]/g, '').replace(',', '.');
    if (el.value === v) return true;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new FocusEvent('blur'));
    el.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    return el.value === v;
  }

  async setRadio(a, radios) {
    const raw = norm(a.raw);
    const want = norm(a.value);
    const text = (r) => norm((r.labels && r.labels[0] && r.labels[0].textContent) || (r.closest('label') || {}).textContent || '');
    const opt =
      (raw && radios.find((r) => norm(r.value) === raw)) ||
      radios.find((r) => text(r) === want) ||
      radios.find((r) => norm(r.id).endsWith('-' + want)) ||
      radios.find((r) => text(r).startsWith(want));
    if (!opt) return false;
    return this.tick(opt, true);
  }

  async setCheckbox(a, el) {
    const on = /^(✓|ja|yes|true|1|x)$/i.test((a.raw || a.value).trim());
    return this.tick(el, on);
  }

  // tick clicks a radio button or checkbox until it is in state on. UI
  // libraries (ng-zorro) handle the click on the surrounding label.
  async tick(el, on) {
    if (el.checked === on) return true;
    (el.closest('label') || el).click();
    await waitFor(() => el.checked === on, 400);
    if (el.checked !== on) {
      el.click();
      await waitFor(() => el.checked === on, 400);
    }
    return el.checked === on;
  }

  setSelect(a, el) {
    const raw = a.raw;
    const want = norm(a.value);
    const opts = [...el.options];
    const o =
      (raw && opts.find((o) => o.value === raw)) ||
      opts.find((o) => norm(o.textContent) === want) ||
      (want && opts.find((o) => norm(o.textContent).startsWith(want)));
    if (!o) return false;
    if (el.value !== o.value) {
      el.value = o.value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return el.value === o.value;
  }

  // setDropdown picks an option of a JavaScript dropdown (ng-select on
  // Wohnungshelden, also ng-zorro / Ant Design): open it, click the option.
  async setDropdown(a, host) {
    const want = norm(a.value);
    const label = (o) => norm(o.getAttribute('title') || (o.querySelector('.ng-option-label') || o).textContent);
    const current = () => {
      const v = host.querySelector('.ng-value-label, .ant-select-selection-item');
      return v ? label(v) : '';
    };
    if (current() === want) return true;
    const trigger = host.querySelector('.ng-select-container, .ant-select-selector') || host;
    const find = () => {
      const opts = [...document.querySelectorAll('.ng-dropdown-panel .ng-option, .ant-select-item-option')].filter(
        (o) => shown(o) && !o.classList.contains('ng-option-disabled')
      );
      return opts.find((o) => label(o) === want) || (want && opts.find((o) => label(o).startsWith(want)));
    };
    trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    if (!host.classList.contains('ng-select')) trigger.click();
    const opt = await waitFor(find, 1500);
    if (opt) opt.click();
    await waitFor(() => current() === want || (opt && current() !== ''), 600);
    if (!opt || !current()) {
      const input = host.querySelector('input');
      if (input) input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
      return false;
    }
    return true;
  }

  mark(el, how) {
    const box =
      el.closest('ng-select, .ng-select, nz-select, .ant-select, nz-radio-group, .ant-radio-group, [role=radiogroup], .ant-checkbox-wrapper') ||
      (el.type === 'radio' || el.type === 'checkbox' ? el.closest('label') || el : el);
    box.style.outline = `2px solid ${how === 'ok' ? '#2e9d5b' : '#e08a00'}`;
    box.style.outlineOffset = '2px';
    box.style.borderRadius = box.style.borderRadius || '4px';
  }

  captcha() {
    return document.querySelector(
      '.frc-captcha, iframe[title*="reCAPTCHA"], .g-recaptcha, iframe[src*="challenges.cloudflare.com"], .cf-turnstile, [data-sitekey]'
    );
  }

  finish(seen) {
    const t = this.t;
    const want = this.answers.filter((a) => a.value);
    const done = want.filter((a) => a.done);
    const lines = [];
    const yourself = this.answers.filter((a) => !a.value).map((a) => a.label);
    const missed = want.filter((a) => !a.done).map((a) => `${a.label}: ${a.value}`);
    if (!seen) {
      this.badge(t.none, []);
      return;
    }
    if (yourself.length) lines.push(t.yourself, ...yourself.map((s) => '• ' + clip(s)));
    if (missed.length) lines.push(t.missed, ...missed.map((s) => '• ' + clip(s)));
    const cap = this.captcha();
    lines.push(cap ? t.then : t.thenNoCaptcha);
    const buttons = [];
    if (cap) buttons.push([t.captcha, () => cap.scrollIntoView({ behavior: 'smooth', block: 'center' })]);
    this.badge(t.filled(done.length, want.length), lines, buttons);

    // Friendly Captcha (degewo) starts its in-browser check when the form
    // gets focus; start it now so it is ready when the user wants to send.
    const frc = document.querySelector('.frc-captcha');
    if (frc && frc.closest('form')) frc.closest('form').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const first = document.querySelector('[style*="outline: 2px solid rgb(224, 138, 0)"]');
    (first || cap || (done[0] && this.locate(done[0])[0]) || document.body).scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  badge(title, lines, buttons = []) {
    if (!this.host) {
      this.host = document.createElement('div');
      this.host.setAttribute('data-rentbot-badge', '');
      this.host.style.cssText = 'position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483647;';
      this.root = this.host.attachShadow({ mode: 'open' });
      document.body.appendChild(this.host);
    }
    const box = document.createElement('div');
    box.className = 'b';
    const h = document.createElement('div');
    h.className = 'h';
    h.textContent = title;
    box.appendChild(h);
    for (const l of lines) {
      const d = document.createElement('div');
      d.textContent = l;
      box.appendChild(d);
    }
    const row = document.createElement('div');
    row.className = 'r';
    for (const [label, fn] of [...buttons, [this.t.close, () => this.host.remove()]]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', fn);
      row.appendChild(b);
    }
    box.appendChild(row);
    this.root.innerHTML = `<style>
      .b{max-width:560px;margin:0 auto;padding:12px 14px;border-radius:12px;background:#1f2a24;color:#f3f6f4;
         font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.35);
         max-height:45vh;overflow:auto}
      .h{font-weight:600;font-size:15px;margin-bottom:4px}
      .r{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}
      button{font:inherit;padding:8px 14px;border-radius:8px;border:0;background:#2e9d5b;color:#fff;min-height:40px}
      button:last-child{background:#44524a}
    </style>`;
    this.root.appendChild(box);
  }
}

function clip(s) {
  s = String(s).replace(/\s+/g, ' ').trim();
  return s.length > 90 ? s.slice(0, 89) + '…' : s;
}

main();
