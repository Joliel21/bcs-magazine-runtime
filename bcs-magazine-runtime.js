(function(){
  'use strict';

  const VERSION = 'try-a-2026-01-20';

  function E(tag, attrs){
    const n = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (k === 'class') n.className = v;
        else if (k === 'text') n.textContent = v;
        else if (k === 'html') n.innerHTML = v;
        else if (k === 'style') n.setAttribute('style', v);
        else if (k.startsWith('data-')) n.setAttribute(k, v);
        else if (k === 'role') n.setAttribute('role', v);
        else if (k === 'ariaLabel') n.setAttribute('aria-label', v);
        else n.setAttribute(k, v);
      }
    }
    for (let i = 2; i < arguments.length; i++) {
      const c = arguments[i];
      if (c == null) continue;
      if (typeof c === 'string') n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  }

  async function fetchJson(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Failed to fetch JSON (' + res.status + ')');
    const text = await res.text();
    const t = text.trim();
    if (!t || (t[0] !== '{' && t[0] !== '[')) throw new Error('Invalid JSON content');
    return JSON.parse(t);
  }

  function normalizePages(doc){
    if (Array.isArray(doc)) return doc;
    if (doc && Array.isArray(doc.pages)) return doc.pages;
    if (doc && Array.isArray(doc.spreads)) {
      const out = [];
      for (const s of doc.spreads) {
        if (s && s.left) out.push({ imageUrl: s.left.imageUrl || s.left.url || s.left });
        if (s && s.right) out.push({ imageUrl: s.right.imageUrl || s.right.url || s.right });
      }
      return out;
    }
    return [];
  }

  function pageUrl(p){
    if (!p) return null;
    if (typeof p === 'string') return p;
    return p.imageUrl || p.url || null;
  }

  function mount(root, opts){
    opts = opts || {};
    const jsonUrl = opts.jsonUrl;
    if (!jsonUrl) {
      root.innerHTML = '<div class="bcs-error">BCS Magazine: Missing json_url.</div>';
      return;
    }

    root.classList.add('bcs-root');
    root.innerHTML = '';

    const toolbar = E('div', { class: 'bcs-toolbar', role: 'toolbar', ariaLabel: 'Magazine toolbar' });
    const btnMenu = E('button', { class: 'bcs-btn', type: 'button', ariaLabel: 'Table of contents', text: 'TOC' });
    const btnPrev = E('button', { class: 'bcs-btn', type: 'button', ariaLabel: 'Previous', text: '◀' });
    const btnNext = E('button', { class: 'bcs-btn', type: 'button', ariaLabel: 'Next', text: '▶' });
    const title = E('div', { class: 'bcs-title', text: 'Magazine' });
    const status = E('div', { class: 'bcs-status', text: '' });

    const toc = E('div', { class: 'bcs-toc', 'data-open': '0' });
    const tocList = E('div', { class: 'bcs-toc-list' });
    toc.appendChild(tocList);

    toolbar.appendChild(btnMenu);
    toolbar.appendChild(btnPrev);
    toolbar.appendChild(title);
    toolbar.appendChild(btnNext);
    toolbar.appendChild(status);

    const stage = E('div', { class: 'bcs-stage' });
    const book = E('div', { class: 'bcs-book' });
    const pageL = E('div', { class: 'bcs-page bcs-left' });
    const pageR = E('div', { class: 'bcs-page bcs-right' });
    const imgL = E('img', { class: 'bcs-img', alt: 'Left page' });
    const imgR = E('img', { class: 'bcs-img', alt: 'Right page' });
    pageL.appendChild(imgL);
    pageR.appendChild(imgR);
    book.appendChild(pageL);
    book.appendChild(pageR);
    stage.appendChild(book);

    root.appendChild(toolbar);
    root.appendChild(toc);
    root.appendChild(stage);

    let pages = [];
    let index = 0; // spread index

    function render(){
      const leftIdx = index * 2;
      const rightIdx = leftIdx + 1;
      const left = pageUrl(pages[leftIdx]);
      const right = pageUrl(pages[rightIdx]);

      // If only one page left (odd count), keep right blank
      imgL.style.display = left ? 'block' : 'none';
      imgR.style.display = right ? 'block' : 'none';
      imgL.src = left || '';
      imgR.src = right || '';

      const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));
      status.textContent = (index + 1) + ' / ' + totalSpreads;

      btnPrev.disabled = index <= 0;
      btnNext.disabled = index >= totalSpreads - 1;
    }

    function openToc(open){
      toc.setAttribute('data-open', open ? '1' : '0');
    }

    btnMenu.addEventListener('click', function(){
      openToc(toc.getAttribute('data-open') !== '1');
    });

    btnPrev.addEventListener('click', function(){
      index = Math.max(0, index - 1);
      render();
    });

    btnNext.addEventListener('click', function(){
      const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));
      index = Math.min(totalSpreads - 1, index + 1);
      render();
    });

    toc.addEventListener('click', function(e){
      const a = e.target.closest('[data-spread]');
      if (!a) return;
      index = parseInt(a.getAttribute('data-spread') || '0', 10) || 0;
      openToc(false);
      render();
    });

    // Keyboard
    root.addEventListener('keydown', function(e){
      if (e.key === 'ArrowLeft') { btnPrev.click(); e.preventDefault(); }
      if (e.key === 'ArrowRight') { btnNext.click(); e.preventDefault(); }
      if (e.key === 'Escape') { openToc(false); }
    });
    root.tabIndex = 0;

    (async function(){
      try {
        const doc = await fetchJson(jsonUrl);
        pages = normalizePages(doc);
        if (!pages.length) throw new Error('No pages in viewer.json');

        // Build TOC
        tocList.innerHTML = '';
        const totalSpreads = Math.max(1, Math.ceil(pages.length / 2));
        for (let s = 0; s < totalSpreads; s++) {
          const label = 'Spread ' + (s + 1);
          tocList.appendChild(E('button', { class: 'bcs-toc-item', type: 'button', 'data-spread': String(s), text: label }));
        }

        index = 0;
        render();
      } catch (err) {
        root.innerHTML = '<div class="bcs-error">BCS Magazine error: ' + (err && err.message ? err.message : String(err)) + '</div>';
      }
    })();
  }

  // Public API
  window.BCS_MAGAZINE = window.BCS_MAGAZINE || {};
  window.BCS_MAGAZINE.version = VERSION;
  window.BCS_MAGAZINE.mount = function(container, opts){
    if (typeof container === 'string') {
      const el = document.querySelector(container);
      if (!el) throw new Error('Container not found: ' + container);
      return mount(el, opts);
    }
    return mount(container, opts);
  };

  // Auto-mount any placeholders
  document.addEventListener('DOMContentLoaded', function(){
    const nodes = document.querySelectorAll('[data-bcs-magazine-json]');
    nodes.forEach(function(n){
      if (n.getAttribute('data-bcs-mounted') === '1') return;
      n.setAttribute('data-bcs-mounted', '1');
      const jsonUrl = n.getAttribute('data-bcs-magazine-json');
      mount(n, { jsonUrl });
    });
  });
})();
