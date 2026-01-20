/*!
 * BCS Magazine Runtime (No React)
 * File: bcs-magazine-runtime.js
 * Version: 2026-01-20-option-b
 *
 * Exposes: window.BCSMagazine.mount(...)
 * Auto-mounts: any element with [data-bcs-magazine-json]
 */
(function () {
  "use strict";

  var VERSION = "2026-01-20-option-b";

  // ----------------------------
  // Utilities
  // ----------------------------

  function E(tag, attrs) {
    var n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (k === "class") n.className = v;
        else if (k === "text") n.textContent = v;
        else if (k === "html") n.innerHTML = v;
        else if (k === "style") n.setAttribute("style", v);
        else if (k === "role") n.setAttribute("role", v);
        else if (k === "ariaLabel") n.setAttribute("aria-label", v);
        else if (k.indexOf("data-") === 0) n.setAttribute(k, v);
        else n.setAttribute(k, v);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null) continue;
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  }

  function safeText(s) {
    try {
      return String(s);
    } catch (e) {
      return "Unknown error";
    }
  }

  function setError(root, msg) {
    root.innerHTML = "";
    root.appendChild(
      E("div", { class: "bcs-error", role: "alert" }, "BCS Magazine error: " + msg)
    );
  }

  function stripBOM(text) {
    // Remove BOM if present
    if (!text) return text;
    return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  }

  function isLikelyJson(text) {
    if (!text) return false;
    var t = stripBOM(text).trim();
    return t.length > 0 && (t[0] === "{" || t[0] === "[");
  }

  function pageUrl(p) {
    if (!p) return null;
    if (typeof p === "string") return p;
    return p.imageUrl || p.url || p.src || null;
  }

  function normalizePages(doc) {
    // Accept common shapes:
    // 1) [ "url1", "url2", ... ]
    // 2) { pages: [ {imageUrl:"..."}, ... ] }
    // 3) { spreads: [ {left:{imageUrl}, right:{imageUrl}}, ... ] }
    if (Array.isArray(doc)) return doc;

    if (doc && Array.isArray(doc.pages)) return doc.pages;

    if (doc && Array.isArray(doc.spreads)) {
      var out = [];
      doc.spreads.forEach(function (s) {
        if (!s) return;
        if (s.left) out.push({ imageUrl: pageUrl(s.left) || s.left.imageUrl || s.left.url || s.left });
        if (s.right) out.push({ imageUrl: pageUrl(s.right) || s.right.imageUrl || s.right.url || s.right });
      });
      return out;
    }

    return [];
  }

  function fetchJson(url) {
    return fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("Failed to fetch JSON (" + res.status + ")");
        return res.text();
      })
      .then(function (text) {
        var t = stripBOM(text);
        if (!isLikelyJson(t)) throw new Error("Invalid JSON content (not JSON)");
        return JSON.parse(t);
      });
  }

  // ----------------------------
  // Core viewer
  // ----------------------------

  function mount(root, opts) {
    opts = opts || {};
    var jsonUrl = opts.jsonUrl;

    if (!root) throw new Error("mount(): missing container element");

    // Ensure focusable for keyboard nav
    if (!root.hasAttribute("tabindex")) root.tabIndex = 0;

    if (!jsonUrl) {
      setError(root, "Missing json_url.");
      return;
    }

    // Build DOM
    root.classList.add("bcs-root");
    root.innerHTML = "";

    var toolbar = E("div", {
      class: "bcs-toolbar",
      role: "toolbar",
      ariaLabel: "Magazine toolbar",
    });

    var btnMenu = E("button", {
      class: "bcs-btn",
      type: "button",
      ariaLabel: "Table of contents",
      text: "TOC",
    });

    var btnPrev = E("button", {
      class: "bcs-btn",
      type: "button",
      ariaLabel: "Previous spread",
      text: "◀",
    });

    var btnNext = E("button", {
      class: "bcs-btn",
      type: "button",
      ariaLabel: "Next spread",
      text: "▶",
    });

    var title = E("div", { class: "bcs-title", text: "Magazine" });
    var status = E("div", { class: "bcs-status", text: "" });

    toolbar.appendChild(btnMenu);
    toolbar.appendChild(btnPrev);
    toolbar.appendChild(title);
    toolbar.appendChild(btnNext);
    toolbar.appendChild(status);

    var toc = E("div", { class: "bcs-toc", "data-open": "0" });
    var tocList = E("div", { class: "bcs-toc-list" });
    toc.appendChild(tocList);

    var stage = E("div", { class: "bcs-stage" });
    var book = E("div", { class: "bcs-book" });

    var pageL = E("div", { class: "bcs-page bcs-left" });
    var pageR = E("div", { class: "bcs-page bcs-right" });
    var imgL = E("img", { class: "bcs-img", alt: "Left page" });
    var imgR = E("img", { class: "bcs-img", alt: "Right page" });

    pageL.appendChild(imgL);
    pageR.appendChild(imgR);
    book.appendChild(pageL);
    book.appendChild(pageR);
    stage.appendChild(book);

    root.appendChild(toolbar);
    root.appendChild(toc);
    root.appendChild(stage);

    // State
    var pages = [];
    var spreadIndex = 0;

    function totalSpreads() {
      return Math.max(1, Math.ceil(pages.length / 2));
    }

    function render() {
      var leftIdx = spreadIndex * 2;
      var rightIdx = leftIdx + 1;

      var left = pageUrl(pages[leftIdx]);
      var right = pageUrl(pages[rightIdx]);

      if (left) {
        imgL.style.display = "block";
        imgL.src = left;
      } else {
        imgL.style.display = "none";
        imgL.removeAttribute("src");
      }

      if (right) {
        imgR.style.display = "block";
        imgR.src = right;
      } else {
        imgR.style.display = "none";
        imgR.removeAttribute("src");
      }

      status.textContent = (spreadIndex + 1) + " / " + totalSpreads();

      btnPrev.disabled = spreadIndex <= 0;
      btnNext.disabled = spreadIndex >= totalSpreads() - 1;
    }

    function openToc(open) {
      toc.setAttribute("data-open", open ? "1" : "0");
    }

    // Events
    btnMenu.addEventListener("click", function () {
      openToc(toc.getAttribute("data-open") !== "1");
    });

    btnPrev.addEventListener("click", function () {
      spreadIndex = Math.max(0, spreadIndex - 1);
      render();
    });

    btnNext.addEventListener("click", function () {
      spreadIndex = Math.min(totalSpreads() - 1, spreadIndex + 1);
      render();
    });

    toc.addEventListener("click", function (e) {
      var target = e.target;
      if (!target) return;

      var btn = target.closest ? target.closest("[data-spread]") : null;
      if (!btn) return;

      var v = parseInt(btn.getAttribute("data-spread") || "0", 10);
      spreadIndex = isNaN(v) ? 0 : Math.max(0, Math.min(totalSpreads() - 1, v));
      openToc(false);
      render();
    });

    root.addEventListener("keydown", function (e) {
      // Do not interfere with typing in inputs (if any wrapper adds them)
      var t = e.target;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;

      if (e.key === "ArrowLeft") {
        btnPrev.click();
        e.preventDefault();
      } else if (e.key === "ArrowRight") {
        btnNext.click();
        e.preventDefault();
      } else if (e.key === "Escape") {
        openToc(false);
      }
    });

    // Load JSON
    fetchJson(jsonUrl)
      .then(function (doc) {
        pages = normalizePages(doc);
        if (!pages || !pages.length) throw new Error("No pages found in viewer.json");

        // Build TOC
        tocList.innerHTML = "";
        for (var s = 0; s < totalSpreads(); s++) {
          tocList.appendChild(
            E("button", {
              class: "bcs-toc-item",
              type: "button",
              "data-spread": String(s),
              text: "Spread " + (s + 1),
            })
          );
        }

        spreadIndex = 0;
        render();
      })
      .catch(function (err) {
        setError(root, err && err.message ? err.message : safeText(err));
      });
  }

  // ----------------------------
  // Public API expected by WP plugin
  // ----------------------------

  // WP plugin expects: window.BCSMagazine.mount(...)
  window.BCSMagazine = window.BCSMagazine || {};
  window.BCSMagazine.version = VERSION;

  window.BCSMagazine.mount = function (container, opts) {
    if (typeof container === "string") {
      var el = document.querySelector(container);
      if (!el) throw new Error("Container not found: " + container);
      return mount(el, opts);
    }
    return mount(container, opts);
  };

  // Back-compat alias (safe)
  window.BCS_MAGAZINE = window.BCSMagazine;

  // ----------------------------
  // Auto-mount placeholders emitted by shortcode/plugin
  // ----------------------------

  document.addEventListener("DOMContentLoaded", function () {
    var nodes = document.querySelectorAll("[data-bcs-magazine-json]");
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.getAttribute("data-bcs-mounted") === "1") continue;
      n.setAttribute("data-bcs-mounted", "1");

      var jsonUrl = n.getAttribute("data-bcs-magazine-json");
      if (!jsonUrl) continue;

      try {
        mount(n, { jsonUrl: jsonUrl });
      } catch (e) {
        setError(n, e && e.message ? e.message : safeText(e));
      }
    }
  });
})();
