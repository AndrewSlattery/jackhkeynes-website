// Boralverse Wiki — two-panel navigable encyclopaedia widget
var BoralverseWiki = (function () {

  // ── State ──────────────────────────────────────────────────────────────────
  var entries = [];
  var bySlug  = {};
  var currentSlug = null;

  // ── DOM ────────────────────────────────────────────────────────────────────
  var container    = document.getElementById('bv-wiki');
  var fetchUrl     = container.getAttribute('data-fetch-url');
  var sidebar      = document.getElementById('bv-sidebar');
  var indexDiv     = document.getElementById('bv-index');
  var articleDiv   = document.getElementById('bv-article');
  var articleInner = document.getElementById('bv-article-inner');
  var searchInput  = document.getElementById('bv-search');
  var toggleBtn    = document.getElementById('bv-toggle');

  // ── Init ───────────────────────────────────────────────────────────────────
  async function init() {
    articleInner.innerHTML = '<p class="bv-loading">Loading\u2026</p>';
    try {
      var res = await fetch(fetchUrl);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      entries = await res.json();
    } catch (e) {
      articleInner.innerHTML = '<p class="bv-error">Failed to load wiki data: ' + esc(e.message) + '</p>';
      return;
    }

    // Build slug index
    entries.forEach(function (e) { bySlug[e.slug] = e; });

    // Render sidebar
    renderIndex(entries);

    // Navigate to initial article (hash or root overview)
    var hash = window.location.hash.replace(/^#/, '');
    var initial = (hash && bySlug[hash]) ? hash : findDefaultSlug();
    if (initial) renderArticle(initial);
  }

  function findDefaultSlug() {
    // Prefer the root-level overview entry (category === '')
    var overview = entries.find(function (e) { return e.category === ''; });
    return overview ? overview.slug : (entries[0] ? entries[0].slug : null);
  }

  // ── Sidebar rendering ──────────────────────────────────────────────────────
  function renderIndex(filtered) {
    indexDiv.innerHTML = '';

    // Group by top-level category
    var groups = {};
    filtered.forEach(function (e) {
      var key = e.category || '';
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });

    // Sort: root first, then A→Z
    var keys = Object.keys(groups).sort(function (a, b) {
      if (a === '') return -1;
      if (b === '') return 1;
      return a.localeCompare(b);
    });

    keys.forEach(function (cat) {
      var items = groups[cat].slice().sort(function (a, b) {
        return a.title.localeCompare(b.title);
      });

      var isRoot = cat === '';
      var displayCat = isRoot ? 'Overview' : cat;

      var section = document.createElement('div');
      section.className = 'bv-cat-section';

      // Header row (clickable to expand/collapse)
      var header = document.createElement('div');
      header.className = 'bv-cat-header';

      var arrow = document.createElement('span');
      arrow.className = 'bv-cat-arrow';

      var nameSpan = document.createElement('span');
      nameSpan.className = 'bv-cat-name';
      nameSpan.textContent = displayCat;

      var countSpan = document.createElement('span');
      countSpan.className = 'bv-cat-count';
      countSpan.textContent = '(' + items.length + ')';

      header.appendChild(arrow);
      header.appendChild(nameSpan);
      header.appendChild(countSpan);

      // Entry list
      var list = document.createElement('ul');
      list.className = 'bv-cat-list';

      items.forEach(function (e) {
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = '#' + e.slug;
        a.className = 'bv-entry-link' + (e.slug === currentSlug ? ' active' : '');
        a.setAttribute('data-slug', e.slug);
        a.textContent = e.title;
        li.appendChild(a);
        list.appendChild(li);
      });

      // Decide initial collapsed state
      var containsActive = items.some(function (e) { return e.slug === currentSlug; });
      var isOpen = containsActive || isRoot;
      if (isOpen) {
        arrow.textContent = '\u25bc'; // ▼
      } else {
        arrow.textContent = '\u25b6'; // ▶
        list.style.display = 'none';
        header.classList.add('collapsed');
      }

      header.addEventListener('click', function () {
        var open = list.style.display !== 'none';
        list.style.display = open ? 'none' : 'block';
        arrow.textContent = open ? '\u25b6' : '\u25bc';
        header.classList.toggle('collapsed', open);
      });

      section.appendChild(header);
      section.appendChild(list);
      indexDiv.appendChild(section);
    });
  }

  // ── Article rendering ──────────────────────────────────────────────────────
  function renderArticle(slug) {
    var entry = bySlug[slug];
    if (!entry) {
      articleInner.innerHTML = '<p class="bv-error">Article not found: <em>' + esc(slug) + '</em>.</p>';
      currentSlug = null;
      return;
    }

    currentSlug = slug;

    // Update active link in existing sidebar DOM
    indexDiv.querySelectorAll('.bv-entry-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-slug') === slug);
    });

    // Ensure the category section containing this article is expanded
    indexDiv.querySelectorAll('.bv-cat-section').forEach(function (section) {
      var activeLink = section.querySelector('.bv-entry-link.active');
      if (activeLink) {
        var list = section.querySelector('.bv-cat-list');
        var hdr  = section.querySelector('.bv-cat-header');
        var arw  = section.querySelector('.bv-cat-arrow');
        if (list && list.style.display === 'none') {
          list.style.display = 'block';
          hdr.classList.remove('collapsed');
          arw.textContent = '\u25bc';
        }
      }
    });

    // Build breadcrumb string
    var breadcrumb = '';
    if (entry.category) {
      breadcrumb = entry.subcategory
        ? entry.category + ' \u203a ' + entry.subcategory
        : entry.category;
    }

    articleInner.innerHTML =
      '<h1 class="bv-article-title">' + esc(entry.title) + '</h1>' +
      (breadcrumb ? '<p class="bv-breadcrumb">' + esc(breadcrumb) + '</p>' : '') +
      '<div class="bv-content">' + entry.html + '</div>';

    articleDiv.scrollTop = 0;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  // Search: filter entries by title or category
  searchInput.addEventListener('input', function () {
    var q = this.value.trim().toLowerCase();
    var filtered = q
      ? entries.filter(function (e) {
          return e.title.toLowerCase().indexOf(q) !== -1 ||
                 (e.category && e.category.toLowerCase().indexOf(q) !== -1);
        })
      : entries;
    renderIndex(filtered);
    // Auto-expand all categories in search mode
    if (q) {
      indexDiv.querySelectorAll('.bv-cat-list').forEach(function (l) {
        l.style.display = 'block';
      });
      indexDiv.querySelectorAll('.bv-cat-header').forEach(function (h) {
        h.classList.remove('collapsed');
        var arw = h.querySelector('.bv-cat-arrow');
        if (arw) arw.textContent = '\u25bc';
      });
    }
  });

  // Sidebar entry clicks
  indexDiv.addEventListener('click', function (e) {
    var link = e.target.closest('.bv-entry-link');
    if (link) {
      e.preventDefault();
      window.location.hash = link.getAttribute('data-slug');
      // Close sidebar on mobile after selection
      container.classList.remove('sidebar-open');
    }
  });

  // Wikilink clicks inside article content
  articleDiv.addEventListener('click', function (e) {
    var link = e.target.closest('a.wiki-link');
    if (link) {
      e.preventDefault();
      var slug = link.getAttribute('href').replace(/^#/, '');
      window.location.hash = slug;
    }
  });

  // Hash-change navigation (handles browser back/forward too)
  window.addEventListener('hashchange', function () {
    var slug = window.location.hash.replace(/^#/, '');
    if (slug && slug !== currentSlug) {
      renderArticle(slug);
    }
  });

  // Mobile sidebar toggle
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      container.classList.toggle('sidebar-open');
    });
  }

  init();

  return {
    navigateTo: function (slug) { window.location.hash = slug; }
  };
})();

if (typeof module !== 'undefined') {
  module.exports = BoralverseWiki;
}
