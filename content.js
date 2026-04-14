(function () {
  "use strict";

  const TOOLBAR_ID = "yt-search-sorter-toolbar";
  const RENDERER_SELECTOR = "ytd-video-renderer, ytd-playlist-renderer";
  const SIDEBAR_SELECTOR = "#secondary, #related";
  const STABLE_DELAY_MS = 1500;
  const MAX_WAIT_MS = 10000;

  const TIME_UNITS = {
    second: 1e3,
    minute: 6e4,
    hour: 36e5,
    day: 864e5,
    week: 6048e5,
    month: 2592e6,
    year: 31536e6,
  };

  const DATE_PATTERN = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/;
  const DATE_CONTEXT_PATTERN = /(?:streamed|premiered)?\s*(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)/i;

  const SORT_OPTIONS = [
    { key: "default", label: "Default" },
    { key: "newest", label: "Newest" },
    { key: "oldest", label: "Oldest" },
  ];

  const TYPE_OPTIONS = [
    { key: "mixed", label: "Mixed" },
    { key: "videos-first", label: "Videos" },
    { key: "playlists-first", label: "Playlists" },
  ];

  // --- Preferences ---

  const Preferences = {
    sort: "default",
    typeOrder: "mixed",

    load() {
      if (!chrome.storage?.local) return;
      chrome.storage.local.get(["sortOrder", "typeOrder"], (result) => {
        if (result.sortOrder) this.sort = result.sortOrder;
        if (result.typeOrder) this.typeOrder = result.typeOrder;
      });
    },

    save() {
      if (!chrome.storage?.local) return;
      chrome.storage.local.set({ sortOrder: this.sort, typeOrder: this.typeOrder });
    },

    isDefault() {
      return this.sort === "default" && this.typeOrder === "mixed";
    },
  };

  // --- Date Parsing ---

  function parseRelativeDate(text) {
    if (!text) return 0;
    const match = text.toLowerCase().match(DATE_PATTERN);
    if (!match) return 0;
    return Date.now() - parseInt(match[1]) * (TIME_UNITS[match[2]] || 0);
  }

  function extractDateFromElement(el) {
    const match = (el.textContent || "").match(DATE_CONTEXT_PATTERN);
    return match ? parseRelativeDate(match[1]) : 0;
  }

  // --- Renderer Discovery ---

  function getRendererType(el) {
    return el.tagName.toLowerCase().includes("playlist") ? "playlist" : "video";
  }

  function findAllRenderers() {
    const scope = document.querySelector("#page-manager") || document.body;
    return Array.from(scope.querySelectorAll(RENDERER_SELECTOR))
      .filter((el) => !el.closest(SIDEBAR_SELECTOR));
  }

  function consolidateRenderers(renderers) {
    if (renderers.length === 0) return null;
    const container = renderers[0].parentElement;
    if (!container) return null;
    for (const r of renderers) {
      if (r.parentElement !== container) container.appendChild(r);
    }
    return container;
  }

  function getDirectChildren(container) {
    return Array.from(container.querySelectorAll(
      `:scope > ${RENDERER_SELECTOR}`
    ));
  }

  // --- Result Stabilization ---

  function waitForStableResults() {
    return new Promise((resolve) => {
      let lastCount = findAllRenderers().length;
      let stableTimer = null;

      function settle() {
        observer.disconnect();
        resolve(findAllRenderers());
      }

      function resetStableTimer() {
        if (stableTimer) clearTimeout(stableTimer);
        stableTimer = setTimeout(settle, STABLE_DELAY_MS);
      }

      if (lastCount > 0) resetStableTimer();

      const target = document.querySelector("#page-manager") || document.body;
      const observer = new MutationObserver(() => {
        const count = findAllRenderers().length;
        if (count !== lastCount) {
          lastCount = count;
          resetStableTimer();
        }
      });
      observer.observe(target, { childList: true, subtree: true });

      setTimeout(() => {
        if (stableTimer) clearTimeout(stableTimer);
        settle();
      }, MAX_WAIT_MS);
    });
  }

  // --- Sorting ---

  let originalOrder = [];

  function captureOriginalOrder(container, items) {
    if (originalOrder.length === 0 || originalOrder[0]?.parentElement !== container) {
      originalOrder = items.slice();
    }
  }

  function reorderWithoutFlicker(container, orderedElements) {
    container.style.visibility = "hidden";
    for (const el of orderedElements) {
      container.appendChild(el);
    }
    requestAnimationFrame(() => {
      container.style.visibility = "";
    });
  }

  function compareEntries(a, b) {
    if (Preferences.typeOrder !== "mixed") {
      const ap = a.type === "playlist" ? 1 : 0;
      const bp = b.type === "playlist" ? 1 : 0;
      if (ap !== bp) {
        return Preferences.typeOrder === "playlists-first" ? bp - ap : ap - bp;
      }
    }
    if (Preferences.sort === "newest") return b.date - a.date;
    if (Preferences.sort === "oldest") return a.date - b.date;
    return 0;
  }

  function sortResults() {
    const renderers = findAllRenderers();
    if (renderers.length === 0) return;

    const container = consolidateRenderers(renderers);
    if (!container) return;

    const items = getDirectChildren(container);
    if (items.length === 0) return;

    captureOriginalOrder(container, items);

    if (Preferences.isDefault()) {
      reorderWithoutFlicker(container, originalOrder.filter((el) => el.parentNode === container));
      updateToolbarState();
      return;
    }

    const source = Preferences.sort === "default" ? originalOrder.filter((el) => el.parentNode === container) : items;

    const entries = source
      .map((el) => ({ el, date: extractDateFromElement(el), type: getRendererType(el) }))
      .sort(compareEntries);

    reorderWithoutFlicker(container, entries.map((e) => e.el));
    updateToolbarState();
  }

  // --- Toolbar UI ---

  function createButtonGroup(label, options, dataAttr, currentValue, onClick) {
    const section = document.createElement("div");
    section.className = "ytss-section";

    const span = document.createElement("span");
    span.className = "ytss-label";
    span.textContent = label;
    section.appendChild(span);

    for (const opt of options) {
      const btn = document.createElement("button");
      btn.className = "ytss-btn";
      btn.dataset[dataAttr] = opt.key;
      btn.textContent = opt.label;
      if (opt.key === currentValue) btn.classList.add("ytss-active");
      btn.addEventListener("click", () => onClick(opt.key));
      section.appendChild(btn);
    }

    return section;
  }

  function createToolbar() {
    const existing = document.getElementById(TOOLBAR_ID);
    if (existing) existing.remove();

    const toolbar = document.createElement("div");
    toolbar.id = TOOLBAR_ID;

    toolbar.appendChild(createButtonGroup("Sort by:", SORT_OPTIONS, "sort", Preferences.sort, (key) => {
      Preferences.sort = key;
      Preferences.save();
      sortResults();
    }));

    toolbar.appendChild(createButtonGroup("Show first:", TYPE_OPTIONS, "typeOrder", Preferences.typeOrder, (key) => {
      Preferences.typeOrder = key;
      Preferences.save();
      sortResults();
    }));

    const count = document.createElement("div");
    count.className = "ytss-section ytss-count";
    count.id = "ytss-count";
    toolbar.appendChild(count);

    return toolbar;
  }

  function updateToolbarState() {
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) return;

    toolbar.querySelectorAll("[data-sort]").forEach((btn) => {
      btn.classList.toggle("ytss-active", btn.dataset.sort === Preferences.sort);
    });
    toolbar.querySelectorAll("[data-type-order]").forEach((btn) => {
      btn.classList.toggle("ytss-active", btn.dataset.typeOrder === Preferences.typeOrder);
    });

    updateItemCount();
  }

  function updateItemCount() {
    const countEl = document.getElementById("ytss-count");
    if (!countEl) return;

    const items = findAllRenderers();
    const videos = items.filter((el) => getRendererType(el) === "video").length;
    const playlists = items.filter((el) => getRendererType(el) === "playlist").length;

    countEl.textContent =
      `${videos} video${videos !== 1 ? "s" : ""}` +
      (playlists > 0 ? `, ${playlists} playlist${playlists !== 1 ? "s" : ""}` : "");
  }

  // --- Toolbar Injection ---

  function findInsertionTarget() {
    const target = document.querySelector("ytd-section-list-renderer");
    if (target) return target;

    const first = findAllRenderers()[0];
    return first?.closest("ytd-section-list-renderer, ytd-item-section-renderer") || null;
  }

  function injectToolbar() {
    if (document.getElementById(TOOLBAR_ID)) {
      updateItemCount();
      return;
    }

    const target = findInsertionTarget();
    if (!target) return;

    target.parentNode.insertBefore(createToolbar(), target);
    updateItemCount();
  }

  function removeToolbar() {
    const el = document.getElementById(TOOLBAR_ID);
    if (el) el.remove();
    originalOrder = [];
  }

  // --- Page Lifecycle ---

  function isChannelSearchPage() {
    return /^\/@[^/]+\/search/.test(window.location.pathname);
  }

  async function onChannelSearchEnter() {
    originalOrder = [];
    const renderers = await waitForStableResults();

    if (!isChannelSearchPage()) return;
    if (renderers.length === 0) return;

    injectToolbar();

    if (!Preferences.isDefault()) {
      sortResults();
    }
  }

  function onPageChange() {
    if (isChannelSearchPage()) {
      onChannelSearchEnter();
    } else {
      removeToolbar();
    }
  }

  // --- Init ---

  Preferences.load();

  document.addEventListener("yt-navigate-finish", onPageChange);
  document.addEventListener("yt-page-data-updated", () => {
    if (isChannelSearchPage() && !document.getElementById(TOOLBAR_ID)) {
      onChannelSearchEnter();
    }
  });
  window.addEventListener("popstate", () => setTimeout(onPageChange, 500));

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onPageChange);
  } else {
    onPageChange();
  }
})();
