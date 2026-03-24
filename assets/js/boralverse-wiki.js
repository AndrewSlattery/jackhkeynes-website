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
    var overview = entries.find(function (e) { return e.category === ''; });
    return overview ? overview.slug : (entries[0] ? entries[0].slug : null);
  }

  // ── Tree helpers ───────────────────────────────────────────────────────────

  // Build a recursive directory tree from a flat entry list.
  // Each node: { _entries: [...direct entries...], childName: <node>, … }
  function buildSubtree(items) {
    var root = { _entries: [] };
    items.forEach(function (e) {
      if (!e.subcategory) {
        root._entries.push(e);
      } else {
        var parts = e.subcategory.split('/');
        var node = root;
        parts.forEach(function (part) {
          if (!node[part]) node[part] = { _entries: [] };
          node = node[part];
        });
        node._entries.push(e);
      }
    });
    return root;
  }

  // Return all entries anywhere inside a tree node (including nested).
  function flattenEntries(node) {
    var result = node._entries.slice();
    Object.keys(node).filter(function (k) { return k !== '_entries'; }).forEach(function (k) {
      result = result.concat(flattenEntries(node[k]));
    });
    return result;
  }

  // ── Sidebar entry link ─────────────────────────────────────────────────────
  function makeEntryLi(e) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = '#' + e.slug;
    a.className = 'bv-entry-link' + (e.slug === currentSlug ? ' active' : '');
    a.setAttribute('data-slug', e.slug);
    a.textContent = e.title;
    li.appendChild(a);
    return li;
  }

  // ── Recursive tree rendering ───────────────────────────────────────────────
  // depth: 0 = directly inside a category body; increases with each subdir level.
  // Entry lists get extra left padding proportional to depth so text aligns under
  // the arrow of the containing header.
  //   header  paddingLeft = 16 + depth * 10  px
  //   ul      paddingLeft = depth * 10        px  (bv-entry-link itself adds 26px)

  function renderTreeNode(node, container, depth) {
    var sorted = node._entries.slice().sort(function (a, b) {
      return a.title.localeCompare(b.title);
    });

    if (sorted.length) {
      var list = document.createElement('ul');
      list.className = 'bv-cat-list';
      if (depth > 0) list.style.paddingLeft = (depth * 10) + 'px';
      sorted.forEach(function (e) { list.appendChild(makeEntryLi(e)); });
      container.appendChild(list);
    }

    var childKeys = Object.keys(node).filter(function (k) { return k !== '_entries'; }).sort();
    childKeys.forEach(function (key) {
      container.appendChild(makeSubcatNode(key, node[key], depth));
    });
  }

  function makeSubcatNode(name, node, depth) {
    var allEntries    = flattenEntries(node);
    var containsActive = allEntries.some(function (e) { return e.slug === currentSlug; });

    var wrapper = document.createElement('div');
    wrapper.className = 'bv-subcat-section';

    var hdr = document.createElement('div');
    hdr.className = 'bv-subcat-header';
    hdr.style.paddingLeft = (16 + depth * 10) + 'px';

    var arrow = document.createElement('span');
    arrow.className = 'bv-subcat-arrow';

    var nameSpan = document.createElement('span');
    nameSpan.className = 'bv-subcat-name';
    nameSpan.textContent = name;

    hdr.appendChild(arrow);
    hdr.appendChild(nameSpan);

    var body = document.createElement('div');
    body.className = 'bv-subcat-body';
    renderTreeNode(node, body, depth + 1);

    if (containsActive) {
      arrow.textContent = '\u25bc'; // ▼
    } else {
      arrow.textContent = '\u25b6'; // ▶
      body.style.display = 'none';
      hdr.classList.add('collapsed');
    }

    hdr.addEventListener('click', function () {
      var open = body.style.display !== 'none';
      body.style.display = open ? 'none' : 'block';
      arrow.textContent = open ? '\u25b6' : '\u25bc';
      hdr.classList.toggle('collapsed', open);
    });

    wrapper.appendChild(hdr);
    wrapper.appendChild(body);
    return wrapper;
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
      var items = groups[cat];
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

      // Collapsible body: built from a recursive directory tree
      var body = document.createElement('div');
      body.className = 'bv-cat-body';
      renderTreeNode(buildSubtree(items), body, 0);

      // Decide initial collapsed state
      var containsActive = items.some(function (e) { return e.slug === currentSlug; });
      var isOpen = containsActive || isRoot;
      if (isOpen) {
        arrow.textContent = '\u25bc'; // ▼
      } else {
        arrow.textContent = '\u25b6'; // ▶
        body.style.display = 'none';
        header.classList.add('collapsed');
      }

      header.addEventListener('click', function () {
        var open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        arrow.textContent = open ? '\u25b6' : '\u25bc';
        header.classList.toggle('collapsed', open);
      });

      section.appendChild(header);
      section.appendChild(body);
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

    // Ensure the category body and every nested subcat body on the path to the
    // active article are expanded — walk up the DOM from the active link.
    indexDiv.querySelectorAll('.bv-cat-section').forEach(function (section) {
      var activeLink = section.querySelector('.bv-entry-link.active');
      if (!activeLink) return;

      // Expand top-level category body
      var catBody = section.querySelector('.bv-cat-body');
      var catHdr  = section.querySelector('.bv-cat-header');
      var catArw  = catHdr && catHdr.querySelector('.bv-cat-arrow');
      if (catBody && catBody.style.display === 'none') {
        catBody.style.display = 'block';
        if (catHdr) catHdr.classList.remove('collapsed');
        if (catArw) catArw.textContent = '\u25bc';
      }

      // Walk up from the link, expanding any hidden subcat bodies along the way
      var el = activeLink.parentElement;
      while (el && el !== section) {
        if (el.classList.contains('bv-subcat-body') && el.style.display === 'none') {
          el.style.display = 'block';
          var subHdr = el.previousElementSibling;
          if (subHdr && subHdr.classList.contains('bv-subcat-header')) {
            subHdr.classList.remove('collapsed');
            var subArw = subHdr.querySelector('.bv-subcat-arrow');
            if (subArw) subArw.textContent = '\u25bc';
          }
        }
        el = el.parentElement;
      }
    });

    // Build breadcrumb string
    var breadcrumb = '';
    if (entry.category) {
      breadcrumb = entry.subcategory
        ? entry.category + ' \u203a ' + entry.subcategory.replace(/\//g, ' \u203a ')
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
    // Auto-expand everything in search mode
    if (q) {
      indexDiv.querySelectorAll('.bv-cat-body, .bv-subcat-body').forEach(function (el) {
        el.style.display = 'block';
      });
      indexDiv.querySelectorAll('.bv-cat-header, .bv-subcat-header').forEach(function (h) {
        h.classList.remove('collapsed');
        var arw = h.querySelector('.bv-cat-arrow') || h.querySelector('.bv-subcat-arrow');
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
