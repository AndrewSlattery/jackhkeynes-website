// Cryptic Indicators — two-panel app with category-specific search controls
(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────

  var allData = [];
  var currentCategory = '';
  var filterState = {
    letterFirst:  null,   // charade(2): first letter of digram
    letterSecond: null,   // charade(2): second letter of digram
    letterOnly:   null,   // charade(1): the single letter
    query:        ''      // text search (all types)
  };

  // Alphabetical list of all possible categories with their rendering type.
  // Only categories actually present in the JSON will appear in the nav.
  var CATEGORY_CONFIG = [
    { key: 'Anagrams',         type: 'simple',       label: 'Anagrams'          },
    { key: 'Charade (1)',      type: 'charade1',     label: '1-letter charades' },
    { key: 'Charade (2)',      type: 'charade2',     label: '2-letter charades' },
    { key: 'Containment',      type: 'hierarchical', label: 'Containment'       },
    { key: 'Deletions',        type: 'hierarchical', label: 'Deletions'         },
    { key: 'Hiddens',          type: 'simple',       label: 'Hidden words'      },
    { key: 'Homophones',       type: 'simple',       label: 'Homophones'        },
    { key: 'Letter selection', type: 'hierarchical', label: 'Letter selection'  },
    { key: 'Linking',          type: 'hierarchical', label: 'Linking words'     },
    { key: 'Reversals',        type: 'hierarchical', label: 'Reversals'         },
    { key: 'Swaps',            type: 'hierarchical', label: 'Swaps'             },
  ];

  // ─── Bootstrap ────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    var app = document.getElementById('indicator-app');
    var url = app && app.dataset.jsonUrl;
    if (url) fetchData(url);
  });

  function fetchData(url) {
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        allData = data.filter(function (d) { return d.word && d.category !== 'spacer'; });
        buildNav();
        var first = CATEGORY_CONFIG.find(function (c) {
          return allData.some(function (d) { return d.category === c.key; });
        });
        if (first) loadCategory(first.key);
      })
      .catch(function (e) {
        document.getElementById('ind-display').innerHTML =
          '<p class="ind-error">Failed to load indicators: ' + e.message + '</p>';
      });
  }

  // ─── Nav ──────────────────────────────────────────────────────────────────

  function buildNav() {
    var nav = document.getElementById('ind-nav');
    var present = {};
    allData.forEach(function (d) { present[d.category] = true; });

    CATEGORY_CONFIG
      .filter(function (c) { return present[c.key]; })
      .forEach(function (cat) {
        var btn = document.createElement('button');
        btn.className = 'ind-nav-btn';
        btn.dataset.cat = cat.key;
        btn.textContent = cat.label;
        btn.addEventListener('click', function () { loadCategory(cat.key); });
        nav.appendChild(btn);
      });
  }

  function getCatType(catName) {
    var cfg = CATEGORY_CONFIG.find(function (c) { return c.key === catName; });
    return cfg ? cfg.type : 'simple';
  }

  // ─── Category loading ─────────────────────────────────────────────────────

  function loadCategory(catName) {
    currentCategory = catName;
    filterState = { letterFirst: null, letterSecond: null, letterOnly: null, query: '' };

    document.querySelectorAll('.ind-nav-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.cat === catName);
    });

    renderSearchBar(catName);
    applyFilters();
  }

  // ─── Search bar ───────────────────────────────────────────────────────────

  function renderSearchBar(catName) {
    var bar = document.getElementById('ind-search-bar');
    bar.innerHTML = '';
    var type = getCatType(catName);

    // Letter-filter rows — charade pages only
    if (type === 'charade2') {
      bar.appendChild(makeLetterRow('First letter',  'first'));
      bar.appendChild(makeLetterRow('Second letter', 'second'));
    } else if (type === 'charade1') {
      bar.appendChild(makeLetterRow('Letter', 'only'));
    }

    // Text search + expand/collapse controls
    var searchRow = document.createElement('div');
    searchRow.className = 'ind-search-row';

    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'ind-search-input';
    input.placeholder = 'Search indicator words…';
    input.addEventListener('input', debounce(function () {
      filterState.query = input.value.trim().toLowerCase();
      applyFilters();
    }, 180));
    searchRow.appendChild(input);

    // Expand/Collapse all — most useful for hierarchical / simple categories
    // Also handy on charade pages when many groups are shown
    var expandBtn = document.createElement('button');
    expandBtn.className = 'util-btn';
    expandBtn.textContent = 'Expand all';
    expandBtn.addEventListener('click', function () { setAllCollapsed(false); });
    searchRow.appendChild(expandBtn);

    var collapseBtn = document.createElement('button');
    collapseBtn.className = 'util-btn';
    collapseBtn.textContent = 'Collapse all';
    collapseBtn.addEventListener('click', function () { setAllCollapsed(true); });
    searchRow.appendChild(collapseBtn);

    bar.appendChild(searchRow);
  }

  function makeLetterRow(labelText, which) {
    var row = document.createElement('div');
    row.className = 'letter-filter-row';

    var label = document.createElement('span');
    label.className = 'letter-filter-label';
    label.textContent = labelText;
    row.appendChild(label);

    var btns = document.createElement('span');
    btns.className = 'letter-btns';

    'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').forEach(function (letter) {
      var btn = document.createElement('button');
      btn.className = 'letter-btn';
      btn.textContent = letter;
      btn.dataset.letter = letter;

      btn.addEventListener('click', function () {
        var wasActive = btn.classList.contains('active');
        // Clear all buttons in this row, then toggle
        row.querySelectorAll('.letter-btn').forEach(function (b) {
          b.classList.remove('active');
        });
        if (!wasActive) {
          btn.classList.add('active');
          setLetterFilter(which, letter);
        } else {
          setLetterFilter(which, null);
        }
        applyFilters();
      });

      btns.appendChild(btn);
    });

    row.appendChild(btns);
    return row;
  }

  function setLetterFilter(which, letter) {
    if      (which === 'first')  filterState.letterFirst  = letter;
    else if (which === 'second') filterState.letterSecond = letter;
    else                         filterState.letterOnly   = letter;
  }

  // ─── Filter & render ──────────────────────────────────────────────────────

  function applyFilters() {
    var type     = getCatType(currentCategory);
    // Charade categories group by `result` (the digram/letter);
    // all other categories group by `type` (the subcategory label).
    var groupKey = (type === 'charade2' || type === 'charade1') ? 'result' : 'type';
    var query    = filterState.query;

    // Collect all items for this category and bucket them into groups
    var groups = {};
    allData
      .filter(function (d) { return d.category === currentCategory; })
      .forEach(function (item) {
        var key = item[groupKey] || 'Misc';
        if (!groups[key]) groups[key] = [];
        groups[key].push(item.word);
      });

    // Sort group keys naturally (handles digrams AA–ZZ and numeric subcategories)
    var sortedKeys = Object.keys(groups).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    // ── Apply letter filters (charade pages) ────────────────────────────────
    if (type === 'charade2') {
      sortedKeys = sortedKeys.filter(function (k) {
        if (filterState.letterFirst  && k.charAt(0) !== filterState.letterFirst)  return false;
        if (filterState.letterSecond && k.charAt(1) !== filterState.letterSecond) return false;
        return true;
      });
    } else if (type === 'charade1') {
      sortedKeys = sortedKeys.filter(function (k) {
        return !filterState.letterOnly || k === filterState.letterOnly;
      });
    }

    // ── Decide whether to auto-expand groups ────────────────────────────────
    // Auto-expand when: text search active, both digram filters set (single result),
    // or single-letter filter active on charade(1).
    var autoExpand =
      !!query ||
      (type === 'charade2' && filterState.letterFirst && filterState.letterSecond) ||
      (type === 'charade1' && !!filterState.letterOnly);

    // ── Build DOM ───────────────────────────────────────────────────────────
    var display = document.getElementById('ind-display');
    display.innerHTML = '';

    var matchedGroups = 0;
    var totalIndicators = 0;

    sortedKeys.forEach(function (key) {
      var allWords = groups[key].slice().sort(function (a, b) { return a.localeCompare(b); });

      // Filter by text query if present
      var visibleWords = query
        ? allWords.filter(function (w) { return w.toLowerCase().includes(query); })
        : allWords;

      if (visibleWords.length === 0) return;

      matchedGroups++;
      totalIndicators += visibleWords.length;

      display.appendChild(
        buildGroupDiv(key, visibleWords, allWords.length, type, autoExpand)
      );
    });

    if (matchedGroups === 0) {
      display.innerHTML = '<p class="ind-no-results">No indicators found.</p>';
    }

    // ── Update count line ───────────────────────────────────────────────────
    var countEl = document.getElementById('ind-count');
    if (countEl) {
      if (matchedGroups > 0) {
        countEl.textContent =
          matchedGroups + ' group' + (matchedGroups !== 1 ? 's' : '') +
          ' · ' +
          totalIndicators + ' indicator' + (totalIndicators !== 1 ? 's' : '');
      } else {
        countEl.textContent = '';
      }
    }
  }

  // ─── Group DOM builder ────────────────────────────────────────────────────

  function buildGroupDiv(key, visibleWords, totalCount, type, expanded) {
    var groupDiv = document.createElement('div');
    groupDiv.className = 'ind-group' + (expanded ? '' : ' collapsed');

    // ── Header ──────────────────────────────────────────────────────────────
    var header = document.createElement('div');
    header.className = 'ind-group-header';
    header.addEventListener('click', function () {
      groupDiv.classList.toggle('collapsed');
    });

    // Label: monospace green for digrams/letters, bold grey for subcategories
    var labelEl = document.createElement('span');
    var isDigram = (type === 'charade2' || type === 'charade1');
    labelEl.className = 'header-label' + (isDigram ? ' digram-label' : '');
    labelEl.textContent = key;

    // Count badge — shows "n / total" when text search is narrowing the list
    var badge = document.createElement('span');
    badge.className = 'count-badge';
    badge.textContent = (visibleWords.length < totalCount)
      ? visibleWords.length + ' / ' + totalCount
      : String(totalCount);

    // Preview: first few words as a hint while collapsed
    var preview = document.createElement('span');
    preview.className = 'preview';
    preview.textContent =
      visibleWords.slice(0, 7).join(', ') + (visibleWords.length > 7 ? '…' : '');

    var chevron = document.createElement('span');
    chevron.className = 'chevron';
    chevron.textContent = '▾'; // ▾

    header.appendChild(labelEl);
    header.appendChild(badge);
    header.appendChild(preview);
    header.appendChild(chevron);

    // ── Word list ────────────────────────────────────────────────────────────
    var ul = document.createElement('ul');
    ul.className = 'ind-list';

    visibleWords.forEach(function (word) {
      var li = document.createElement('li');
      li.textContent = word;
      ul.appendChild(li);
    });

    groupDiv.appendChild(header);
    groupDiv.appendChild(ul);
    return groupDiv;
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  function setAllCollapsed(collapse) {
    document.querySelectorAll('.ind-group').forEach(function (g) {
      g.classList.toggle('collapsed', collapse);
    });
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, delay);
    };
  }

})();
