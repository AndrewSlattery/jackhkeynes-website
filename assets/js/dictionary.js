// Borlish dictionary — search, render, and navigation logic
(function () {
  // STATE
  var dictionaryData = [];
  var englishIndex = {};
  var currentMode = 'borlish';

  // DOM ELEMENTS
  var searchInput = document.getElementById('dict-search');
  var resultsDiv = document.getElementById('dict-results');
  var statusDiv = document.getElementById('dict-status');
  var modeRadios = document.querySelectorAll('input[name="dict-mode"]');
  var clearBtn = document.getElementById('clear-search');

  // Read fetch URL from data attribute on the container
  var container = document.getElementById('borlish-dictionary');
  var fetchUrl = container ? container.getAttribute('data-fetch-url') : '/assets/boralverse/borlish-dictionary.json';

  // 1. INITIALIZATION
  async function init() {
    try {
      var response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
      dictionaryData = await response.json();

      buildEnglishIndex();

      if (window.location.hash) {
        var query = decodeURIComponent(window.location.hash.substring(1));
        searchInput.value = query;
        performSearch(query);
      } else {
        // Show nothing initially for a clean look
        statusDiv.textContent = dictionaryData.length + ' entries.';
      }

    } catch (e) {
      statusDiv.textContent = 'Error loading dictionary: ' + e.message;
      console.error(e);
    }
  }

  // 2. INDEXING
  function buildEnglishIndex() {
    dictionaryData.forEach(function (entry) {
      var glosses = [];
      if (Array.isArray(entry.ge)) {
        glosses = entry.ge;
      } else if (typeof entry.ge === 'string') {
        glosses = [entry.ge];
      }

      glosses.forEach(function (gloss) {
        var keywords = gloss.split(/[,;]/).map(function (s) { return s.trim().toLowerCase(); });
        keywords.forEach(function (word) {
          if (!word) return;
          if (!englishIndex[word]) englishIndex[word] = [];
          englishIndex[word].push(entry);
        });
      });
    });
  }

  // 3. SEARCH
  function performSearch(query) {
    resultsDiv.innerHTML = '';
    var q = query.toLowerCase().trim();

    if (!q) {
      statusDiv.textContent = "Type to search...";
      return;
    }

    // --- Strict Match Logic ---
    var strictStart = q.startsWith('"');
    var strictEnd = q.endsWith('"');

    if (strictStart) q = q.substring(1);
    if (strictEnd && q.length > 0) q = q.substring(0, q.length - 1);

    history.replaceState(null, null, '#' + query);

    if (currentMode === 'borlish') {
      var matches = dictionaryData.filter(function (entry) {
        var term = entry.lx.toLowerCase();

        if (strictStart && strictEnd) return term === q;
        if (strictStart) return term.startsWith(q);
        if (strictEnd) return term.endsWith(q);
        return term.includes(q);
      });

      if (matches.length === 0) {
        statusDiv.textContent = 'No matches found.';
      } else {
        var noun = matches.length === 1 ? 'match' : 'matches';
        statusDiv.textContent = 'Found ' + matches.length + ' ' + noun + '.';
        renderEntries(matches);
      }

    } else {
      var enMatches = Object.keys(englishIndex).filter(function (enWord) {
        if (strictStart && strictEnd) return enWord === q;
        if (strictStart) return enWord.startsWith(q);
        if (strictEnd) return enWord.endsWith(q);
        return enWord.includes(q);
      }).sort();

      if (enMatches.length === 0) {
        statusDiv.textContent = 'No English matches found.';
      } else {
        var enNoun = enMatches.length === 1 ? 'English term' : 'English terms';
        statusDiv.textContent = 'Found ' + enMatches.length + ' ' + enNoun + '.';
        renderEnglishResults(enMatches);
      }
    }
  }

  // 4. RENDERING
  function renderEntries(entries) {
    var fragment = document.createDocumentFragment();
    entries.forEach(function (entry) {
      var el = document.createElement('div');
      el.className = 'dict-entry';

      var glossHtml = Array.isArray(entry.ge) ? entry.ge.join(', ') : entry.ge;

      var mnHtml = '';
      if (entry.mn) {
        var links = [];
        var mnArr = Array.isArray(entry.mn) ? entry.mn : [entry.mn];
        mnArr.forEach(function (ref) {
          links.push('<a href="#%22' + ref + '%22" class="mn-link" data-ref="' + ref + '">' + ref + '</a>');
        });
        mnHtml = '<div class="dict-meta"><span class="dict-label">See also:</span> ' + links.join(', ') + '</div>';
      }

      var etHtml = entry.et ? '<div class="dict-meta"><span class="dict-label">Etymology:</span> ' + entry.et + '</div>' : '';

      var exHtml = '';
      if (entry.examples && entry.examples.length > 0) {
        exHtml = '<div class="dict-meta"><span class="dict-label">Examples:</span>';
        entry.examples.forEach(function (ex) {
          exHtml += '<div class="dict-example">' +
            '<span class="dict-vernacular">' + ex.vernacular + '</span> ' +
            '<span class="dict-translation">"' + ex.english + '"</span>' +
            '</div>';
        });
        exHtml += '</div>';
      }

      el.innerHTML =
        '<div class="dict-headword-line">' +
          '<span class="dict-lx">' + entry.lx + '</span>' +
          (entry.hm ? '<span class="dict-hm">' + entry.hm + '</span>' : '') +
          '<span class="dict-ps">' + (entry.ps || '') + '</span>' +
        '</div>' +
        '<div class="dict-ge">' + glossHtml + '</div>' +
        etHtml +
        mnHtml +
        exHtml;
      fragment.appendChild(el);
    });
    resultsDiv.appendChild(fragment);
  }

  function renderEnglishResults(englishWords) {
    var limit = 50;
    var list = englishWords.slice(0, limit);

    list.forEach(function (word) {
      var containerEl = document.createElement('div');
      containerEl.className = 'english-index-item';

      var header = document.createElement('div');
      header.className = 'english-keyword';
      header.textContent = word;

      var refsDiv = document.createElement('div');
      refsDiv.className = 'english-refs';

      var entries = englishIndex[word];
      entries.forEach(function (entry) {
        var link = document.createElement('a');
        link.href = '#%22' + entry.lx + '%22';
        link.className = 'mn-link';
        link.style.marginRight = '15px';
        link.textContent = entry.lx + (entry.hm ? ' ' + entry.hm : '');
        link.setAttribute('data-ref', entry.lx);
        refsDiv.appendChild(link);
      });

      containerEl.appendChild(header);
      containerEl.appendChild(refsDiv);
      resultsDiv.appendChild(containerEl);
    });

    if (englishWords.length > limit) {
      var more = document.createElement('div');
      more.style.color = '#828282';
      more.style.fontStyle = 'italic';
      more.style.marginTop = '10px';
      more.textContent = '...and ' + (englishWords.length - limit) + ' more.';
      resultsDiv.appendChild(more);
    }
  }

  // 5. EVENT LISTENERS
  searchInput.addEventListener('input', function (e) {
    performSearch(e.target.value);
  });

  clearBtn.addEventListener('click', function () {
    searchInput.value = '';
    performSearch('');
    searchInput.focus();
  });

  modeRadios.forEach(function (radio) {
    radio.addEventListener('change', function (e) {
      currentMode = e.target.value;
      performSearch(searchInput.value);
    });
  });

  resultsDiv.addEventListener('click', function (e) {
    if (e.target.classList.contains('mn-link')) {
      e.preventDefault();
      var ref = e.target.getAttribute('data-ref');

      if (currentMode === 'english') {
        document.querySelector('input[value="borlish"]').click();
      }

      // Manually add quotes for same-tab clicks
      var exactQuery = '"' + ref + '"';
      searchInput.value = exactQuery;
      performSearch(exactQuery);

      window.scrollTo(0, 0);
    }
  });

  window.addEventListener('hashchange', function () {
    var query = decodeURIComponent(window.location.hash.substring(1));
    if (query !== searchInput.value) {
      searchInput.value = query;
      performSearch(query);
    }
  });

  init();
})();
