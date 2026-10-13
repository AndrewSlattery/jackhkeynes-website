// Borlish dictionary - search, render, and navigation logic
var BorlishDictionary = (function () {
  'use strict';

  // ----- CONFIG -----
  var BORLISH_RESULT_CAP = 100;
  var ENGLISH_RESULT_CAP = 80;
  var PS_LABELS = {
    'n': 'noun',
    'r v': 'verb (-r)',
    'ar v': 'verb (-ar)',
    'ir1 v': 'verb (-ir, group 1)',
    'ir2 v': 'verb (-ir, group 2)',
    'v rfl': 'reflexive verb',
    'adj': 'adjective',
    'adv': 'adverb',
    'prep': 'preposition',
    'conj': 'conjunction',
    'det': 'determiner',
    'exc': 'exclamation',
    'interj': 'interjection',
    'pron': 'pronoun',
    'article': 'article',
    'num': 'numeral',
    'question word': 'question word'
  };

  // ----- ENTRY STRUCTURE -----
  // Each entry is { lx, hm?, senses: [{ ps, ge, ue, uv, de, dv, examples }],
  // et, mn, sd, subentries: [...] }; subentries share the entry's shape.
  function asArray(v) {
    return v == null ? [] : Array.isArray(v) ? v : [v];
  }

  // The entry itself followed by its subentries.
  function recordsOf(entry) {
    return [entry].concat(asArray(entry.subentries));
  }

  function entryHasPos(entry, filter) {
    return entry._pos.indexOf(filter) !== -1;
  }

  // ----- HELPERS -----
  var DIACRITIC_RE = new RegExp('[\\u0300-\\u036f]', 'g');

  function fold(s) {
    return (s == null ? '' : String(s))
      .normalize('NFD')
      .replace(DIACRITIC_RE, '')
      .toLowerCase()
      .replace(/æ/g, 'ae')
      .replace(/œ/g, 'oe');
  }

  // Fold a string while building a folded-index -> original-index map.
  // Lets us highlight diacritic-insensitive matches in the original string.
  function foldWithMap(s) {
    var folded = [];
    var map = [];
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      var f = ch.normalize('NFD').replace(DIACRITIC_RE, '').toLowerCase()
        .replace(/æ/g, 'ae').replace(/œ/g, 'oe');
      for (var j = 0; j < f.length; j++) {
        folded.push(f[j]);
        map.push(i);
      }
    }
    return { folded: folded.join(''), map: map };
  }

  // ----- SORT / COLLATION -----
  // Each standard letter maps to a char code spaced 4 apart (×4 leaves room to insert).
  // ç = 0x0d (between c=0x0c and d=0x10), ð = 0x11 (between d=0x10 and e=0x14).
  // æ expands to 'ae', œ expands to 'oe' (user-requested sort-as-sequence behaviour).
  var _SORT_BASE = (function () {
    var t = {};
    var alpha = 'abcdefghijklmnopqrstuvwxyz';
    for (var i = 0; i < alpha.length; i++) {
      t[alpha[i]] = String.fromCharCode(4 + i * 4);
    }
    return t;
  })();

  function sortKey(str) {
    var s = str ? str.toLowerCase() : '';
    var out = '';
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === 'æ') { out += _SORT_BASE['a'] + _SORT_BASE['e']; }
      else if (ch === 'œ') { out += _SORT_BASE['o'] + _SORT_BASE['e']; }
      else if (ch === 'ç') { out += '\x0d'; }
      else if (ch === 'ð') { out += '\x11'; }
      else {
        var f = fold(ch);
        out += (f && _SORT_BASE[f[0]]) ? _SORT_BASE[f[0]] : ch;
      }
    }
    return out;
  }

  function cmpSort(a, b) {
    var ka = sortKey(a.lx), kb = sortKey(b.lx);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  }

  // Returns the collation "strip character" for the first letter of lx.
  // ç, æ, œ all need explicit guards: fold() maps ç→'c', æ→'ae', œ→'oe',
  // which would lose them into the wrong A-Z bucket.
  // ð folds to itself so no special case is needed for it.
  function stripChar(lx) {
    if (!lx) return '';
    var ch = lx[0].toLowerCase();
    if (ch === 'ç') return 'ç';
    if (ch === 'æ') return 'æ';
    if (ch === 'œ') return 'œ';
    return fold(ch)[0] || ch;
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function highlight(orig, qFold, mode) {
    if (!orig) return '';
    if (!qFold) return escapeHtml(orig);
    var fm = foldWithMap(orig);
    var idx = -1;
    if (mode === 'exact') {
      if (fm.folded === qFold) return '<mark>' + escapeHtml(orig) + '</mark>';
      return escapeHtml(orig);
    } else if (mode === 'prefix') {
      idx = fm.folded.indexOf(qFold) === 0 ? 0 : -1;
    } else if (mode === 'suffix') {
      idx = fm.folded.length >= qFold.length
        && fm.folded.lastIndexOf(qFold) === fm.folded.length - qFold.length
        ? fm.folded.length - qFold.length : -1;
    } else {
      idx = fm.folded.indexOf(qFold);
    }
    if (idx === -1) return escapeHtml(orig);
    var startOrig = fm.map[idx];
    var endOrig;
    if (idx + qFold.length >= fm.map.length) {
      endOrig = orig.length;
    } else {
      endOrig = fm.map[idx + qFold.length];
    }
    return escapeHtml(orig.slice(0, startOrig))
      + '<mark>' + escapeHtml(orig.slice(startOrig, endOrig)) + '</mark>'
      + escapeHtml(orig.slice(endOrig));
  }

  // ----- STATE -----
  var dictionaryData = [];
  var englishIndex = {};      // foldedKey -> { display, refs: [{ entry, record, ps: [] }] }
  var englishKeys = [];       // sorted folded keys
  var lxLookup = {};          // foldedLx -> headword (entry or subentry) as written
  var posList = [];           // unique parts of speech (sorted)
  var currentMode = 'borlish';
  var currentPos = '';
  var currentBrowseLetter = '';
  var currentDomain = '';

  // ----- DOM -----
  var container = document.getElementById('borlish-dictionary');
  var searchInput = document.getElementById('dict-search');
  var resultsDiv = document.getElementById('dict-results');
  var statusDiv = document.getElementById('dict-status');
  var modeRadios = document.querySelectorAll('input[name="dict-mode"]');
  var clearBtn = document.getElementById('clear-search');
  var posFilter = document.getElementById('dict-pos-filter');
  var azStrip = document.getElementById('dict-az-strip');
  var randomBtn = document.getElementById('dict-random');

  var fetchUrl = container
    ? container.getAttribute('data-fetch-url')
    : '/assets/boralverse/borlish-dictionary.json';

  // ----- INIT -----
  async function init() {
    try {
      var response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('HTTP error! status: ' + response.status);
      dictionaryData = await response.json();
      buildIndices();
      buildPosFilter();
      buildAzStrip();
      validateCrossRefs();
      applyStateFromHash(true);
    } catch (e) {
      statusDiv.textContent = 'Error loading dictionary: ' + e.message;
      console.error(e);
    }
  }

  // ----- INDEXING -----
  function glossChips(sense) {
    var chips = [];
    var glosses = asArray(sense.ge);
    for (var g = 0; g < glosses.length; g++) {
      var parts = String(glosses[g]).split(/[,;]/);
      for (var p = 0; p < parts.length; p++) {
        var part = parts[p].trim();
        if (part && chips.indexOf(part) === -1) chips.push(part);
      }
    }
    return chips;
  }

  // One ref per headword (entry or subentry), listing the parts of speech of
  // the senses that carry the gloss.
  function indexGloss(gloss, entry, record, ps) {
    var k = fold(gloss);
    var item = englishIndex[k] || (englishIndex[k] = { display: gloss, refs: [] });
    var ref = null;
    for (var i = 0; i < item.refs.length; i++) {
      if (item.refs[i].record === record) { ref = item.refs[i]; break; }
    }
    if (!ref) item.refs.push(ref = { entry: entry, record: record, ps: [] });
    if (ps && ref.ps.indexOf(ps) === -1) ref.ps.push(ps);
  }

  function buildIndices() {
    englishIndex = {};
    lxLookup = {};
    var posSet = {};
    var i, entry;
    // Main headwords first, so they win lxLookup over identically spelled subentries.
    for (i = 0; i < dictionaryData.length; i++) {
      entry = dictionaryData[i];
      entry._lxFold = fold(entry.lx);
      entry._stripChar = stripChar(entry.lx);
      if (!lxLookup[entry._lxFold]) lxLookup[entry._lxFold] = entry.lx;
    }
    for (i = 0; i < dictionaryData.length; i++) {
      entry = dictionaryData[i];
      entry._heads = [];
      entry._pos = [];
      entry._domains = [];
      var records = recordsOf(entry);
      for (var r = 0; r < records.length; r++) {
        var rec = records[r];
        var recFold = fold(rec.lx);
        entry._heads.push(recFold);
        if (!lxLookup[recFold]) lxLookup[recFold] = rec.lx;
        var sds = asArray(rec.sd);
        for (var d = 0; d < sds.length; d++) {
          if (entry._domains.indexOf(sds[d]) === -1) entry._domains.push(sds[d]);
        }
        var senses = asArray(rec.senses);
        for (var s = 0; s < senses.length; s++) {
          var sense = senses[s];
          if (sense.ps) {
            posSet[sense.ps] = true;
            if (entry._pos.indexOf(sense.ps) === -1) entry._pos.push(sense.ps);
          }
          sense._chips = glossChips(sense);
          for (var c = 0; c < sense._chips.length; c++) {
            indexGloss(sense._chips[c], entry, rec, sense.ps);
          }
        }
      }
    }
    englishKeys = Object.keys(englishIndex).sort();
    posList = Object.keys(posSet).sort(function (a, b) {
      var la = PS_LABELS[a] || a;
      var lb = PS_LABELS[b] || b;
      return la < lb ? -1 : la > lb ? 1 : 0;
    });

    // Auto-assign display homonym numbers for entries sharing lx without hm markers.
    var byLx = {};
    for (var ii = 0; ii < dictionaryData.length; ii++) {
      var e = dictionaryData[ii];
      if (!byLx[e.lx]) byLx[e.lx] = [];
      byLx[e.lx].push(e);
    }
    for (var lxKey in byLx) {
      var group = byLx[lxKey];
      if (group.length <= 1) continue;
      // Skip groups where every entry already has a hm value
      var allHaveHm = true;
      for (var gi = 0; gi < group.length; gi++) {
        if (group[gi].hm == null) { allHaveHm = false; break; }
      }
      if (allHaveHm) continue;
      // Collect hm values already in use
      var usedHm = {};
      for (var gi2 = 0; gi2 < group.length; gi2++) {
        if (group[gi2].hm != null) usedHm[String(group[gi2].hm)] = true;
      }
      // Assign _displayHm: keep existing hm; fill gaps for those without
      var nextNum = 1;
      for (var gi3 = 0; gi3 < group.length; gi3++) {
        var ge = group[gi3];
        if (ge.hm != null) {
          ge._displayHm = ge.hm;
        } else {
          while (usedHm[String(nextNum)]) nextNum++;
          ge._displayHm = String(nextNum);
          usedHm[String(nextNum)] = true;
          nextNum++;
        }
      }
    }
  }

  function buildPosFilter() {
    if (!posFilter) return;
    posFilter.innerHTML = '<option value="">All parts of speech</option>';
    for (var i = 0; i < posList.length; i++) {
      var ps = posList[i];
      if (!PS_LABELS.hasOwnProperty(ps)) continue; // omit unrecognised / legacy values
      var opt = document.createElement('option');
      opt.value = ps;
      var label = PS_LABELS[ps];
      opt.textContent = label;
      posFilter.appendChild(opt);
    }
  }

  function buildAzStrip() {
    if (!azStrip) return;
    var letters = {};
    for (var i = 0; i < dictionaryData.length; i++) {
      var sc = dictionaryData[i]._stripChar;
      if (sc) letters[sc] = true;
    }
    // Sort using the custom collation order
    var sorted = Object.keys(letters).sort(function (a, b) {
      var ka = sortKey(a), kb = sortKey(b);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
    azStrip.innerHTML = '';
    // "All" reset button at start
    var allBtn = document.createElement('button');
    allBtn.className = 'az-all';
    allBtn.type = 'button';
    allBtn.textContent = 'All';
    allBtn.title = 'Exit letter browse';
    azStrip.appendChild(allBtn);
    for (var j = 0; j < sorted.length; j++) {
      var btn = document.createElement('button');
      btn.className = 'az-letter';
      btn.type = 'button';
      btn.setAttribute('data-letter', sorted[j]);
      btn.textContent = sorted[j].toUpperCase();
      azStrip.appendChild(btn);
    }
  }

  function updateAzActive() {
    if (!azStrip) return;
    var buttons = azStrip.querySelectorAll('.az-letter');
    for (var i = 0; i < buttons.length; i++) {
      var active = buttons[i].getAttribute('data-letter') === currentBrowseLetter;
      buttons[i].classList.toggle('az-active', active);
    }
    var allBtn = azStrip.querySelector('.az-all');
    if (allBtn) allBtn.classList.toggle('az-active', !currentBrowseLetter);
  }

  // Cross-references may name a homonym by number: "cart1", "pouvr 2".
  function parseRef(ref) {
    var s = String(ref).trim();
    if (lxLookup[fold(s)]) return { lx: s, hm: '' };
    var m = /^(.*?\S)\s*(\d+)$/.exec(s);
    if (m && lxLookup[fold(m[1])]) return { lx: m[1], hm: m[2] };
    return { lx: s, hm: '', dead: true };
  }

  function validateCrossRefs() {
    var seen = {};
    var dead = 0;
    for (var i = 0; i < dictionaryData.length; i++) {
      var records = recordsOf(dictionaryData[i]);
      for (var rc = 0; rc < records.length; rc++) {
        var refs = asArray(records[rc].mn);
        for (var r = 0; r < refs.length; r++) {
          var ref = refs[r];
          if (seen[ref]) continue;
          seen[ref] = true;
          if (parseRef(ref).dead) {
            dead++;
            console.warn('[dictionary] dead cross-ref "' + ref + '" (referenced from "' + records[rc].lx + '")');
          }
        }
      }
    }
    if (dead > 0) console.warn('[dictionary] ' + dead + ' dead cross-ref(s) total');
  }

  // ----- HASH STATE -----
  function parseHash() {
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return {};
    // Legacy: hash without '=' is a plain Borlish query
    if (raw.indexOf('=') === -1) {
      try { return { mode: 'borlish', q: decodeURIComponent(raw) }; }
      catch (e) { return { mode: 'borlish', q: raw }; }
    }
    var params = {};
    var pairs = raw.split('&');
    for (var i = 0; i < pairs.length; i++) {
      var eq = pairs[i].indexOf('=');
      var k = eq === -1 ? pairs[i] : pairs[i].slice(0, eq);
      var v = eq === -1 ? '' : pairs[i].slice(eq + 1);
      if (!k) continue;
      try { params[k] = decodeURIComponent(v.replace(/\+/g, ' ')); }
      catch (e) { params[k] = v; }
    }
    return params;
  }

  function writeHash(push) {
    var parts = [];
    if (currentMode && currentMode !== 'borlish') parts.push('mode=' + encodeURIComponent(currentMode));
    if (currentBrowseLetter) {
      parts.push('browse=' + encodeURIComponent(currentBrowseLetter));
    } else if (currentDomain) {
      parts.push('domain=' + encodeURIComponent(currentDomain));
    } else if (searchInput && searchInput.value) {
      parts.push('q=' + encodeURIComponent(searchInput.value));
    }
    if (currentPos) parts.push('pos=' + encodeURIComponent(currentPos));
    var hash = parts.length ? '#' + parts.join('&') : '';
    var target = hash || (window.location.hash ? window.location.pathname + window.location.search : null);
    if (!target) return;
    try {
      if (push) history.pushState(null, '', target);
      else history.replaceState(null, '', target);
    } catch (e) { /* jsdom or restricted env */ }
  }

  function applyStateFromHash(updateMode) {
    var p = parseHash();
    if (updateMode) {
      // No mode in the hash means the default, Borlish
      currentMode = p.mode || 'borlish';
      var radio = document.querySelector('input[name="dict-mode"][value="' + currentMode + '"]');
      if (radio) radio.checked = true;
    }
    currentPos = p.pos || '';
    if (posFilter) posFilter.value = currentPos;
    currentBrowseLetter = '';
    currentDomain = '';
    if (p.browse) {
      currentBrowseLetter = p.browse;
      searchInput.value = '';
      renderBrowse(p.browse, false);
      return;
    }
    if (p.domain) {
      searchInput.value = '';
      renderDomain(p.domain, false);
      return;
    }
    if (p.q) {
      searchInput.value = p.q;
      performSearch(p.q, false);
    } else {
      searchInput.value = '';
      statusDiv.textContent = dictionaryData.length + ' entries.';
      resultsDiv.innerHTML = '';
      updateAzActive();
    }
  }

  // ----- SEARCH -----
  function rankMatch(haystackFold, qFold, strictStart, strictEnd) {
    if (strictStart && strictEnd) return haystackFold === qFold ? 0 : -1;
    if (strictStart) return haystackFold.indexOf(qFold) === 0 ? 0 : -1;
    if (strictEnd) {
      var n = haystackFold.length - qFold.length;
      return n >= 0 && haystackFold.indexOf(qFold, n) === n ? 0 : -1;
    }
    if (haystackFold === qFold) return 0;
    if (haystackFold.indexOf(qFold) === 0) return 1;
    if (haystackFold.indexOf(qFold) !== -1) return 2;
    return -1;
  }

  function performSearch(query, push) {
    currentBrowseLetter = '';
    currentDomain = '';
    updateAzActive();
    resultsDiv.innerHTML = '';

    if (!query || !query.trim()) {
      statusDiv.textContent = 'Type to search...';
      writeHash(push);
      return;
    }

    var q = query.trim();
    var strictStart = q.charAt(0) === '"';
    var strictEnd = q.length > 1 && q.charAt(q.length - 1) === '"';
    if (strictStart) q = q.substring(1);
    if (strictEnd) q = q.substring(0, q.length - 1);
    var qFold = fold(q);

    writeHash(push);

    if (!qFold) {
      statusDiv.textContent = 'Type to search...';
      return;
    }

    if (currentMode === 'borlish') {
      searchBorlish(qFold, strictStart, strictEnd);
    } else {
      searchEnglish(qFold, strictStart, strictEnd);
    }
  }

  function searchBorlish(qFold, strictStart, strictEnd) {
    var matches = [];
    for (var i = 0; i < dictionaryData.length; i++) {
      var entry = dictionaryData[i];
      if (currentPos && !entryHasPos(entry, currentPos)) continue;
      // Best rank across the headword and any subentry headwords
      var best = -1;
      for (var h = 0; h < entry._heads.length; h++) {
        var r = rankMatch(entry._heads[h], qFold, strictStart, strictEnd);
        if (r !== -1 && (best === -1 || r < best)) best = r;
      }
      if (best !== -1) matches.push({ entry: entry, rank: best });
    }
    matches.sort(function (a, b) {
      return a.rank - b.rank || cmpSort(a.entry, b.entry);
    });

    if (matches.length === 0) {
      statusDiv.textContent = 'No matches found.';
      return;
    }
    var noun = matches.length === 1 ? 'match' : 'matches';
    statusDiv.textContent = 'Found ' + matches.length + ' ' + noun + '.';

    var visible = matches.slice(0, BORLISH_RESULT_CAP).map(function (m) { return m.entry; });
    renderEntries(visible);
    if (matches.length > BORLISH_RESULT_CAP) {
      appendShowMore(matches.slice(BORLISH_RESULT_CAP).map(function (m) { return m.entry; }));
    }
  }

  function refHasPos(ref) {
    return ref.ps.indexOf(currentPos) !== -1;
  }

  function searchEnglish(qFold, strictStart, strictEnd) {
    var matches = [];
    for (var i = 0; i < englishKeys.length; i++) {
      var key = englishKeys[i];
      var r = rankMatch(key, qFold, strictStart, strictEnd);
      if (r === -1) continue;
      if (currentPos && !englishIndex[key].refs.some(refHasPos)) continue;
      matches.push({ key: key, display: englishIndex[key].display, rank: r });
    }
    matches.sort(function (a, b) {
      return a.rank - b.rank || a.key.localeCompare(b.key);
    });

    if (matches.length === 0) {
      statusDiv.textContent = 'No English matches found.';
      return;
    }
    var noun = matches.length === 1 ? 'English term' : 'English terms';
    statusDiv.textContent = 'Found ' + matches.length + ' ' + noun + '.';

    renderEnglishResults(matches.slice(0, ENGLISH_RESULT_CAP));
    if (matches.length > ENGLISH_RESULT_CAP) {
      var more = document.createElement('div');
      more.className = 'dict-more-note';
      more.textContent = '…and ' + (matches.length - ENGLISH_RESULT_CAP) + ' more.';
      resultsDiv.appendChild(more);
    }
  }

  function appendShowMore(remainingEntries) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dict-show-more';
    btn.textContent = 'Show ' + remainingEntries.length + ' more';
    btn.addEventListener('click', function () {
      btn.remove();
      renderEntries(remainingEntries);
    });
    resultsDiv.appendChild(btn);
  }

  function renderCapped(matches) {
    renderEntries(matches.slice(0, BORLISH_RESULT_CAP));
    if (matches.length > BORLISH_RESULT_CAP) {
      appendShowMore(matches.slice(BORLISH_RESULT_CAP));
    }
  }

  // ----- BROWSE -----
  function exitBrowse() {
    currentBrowseLetter = '';
    currentDomain = '';
    resultsDiv.innerHTML = '';
    statusDiv.textContent = dictionaryData.length + ' entries.';
    writeHash(true);
    updateAzActive();
  }

  function renderBrowse(letter, push) {
    currentDomain = '';
    resultsDiv.innerHTML = '';
    var matches = [];
    for (var i = 0; i < dictionaryData.length; i++) {
      var e = dictionaryData[i];
      if (e._stripChar !== letter) continue;
      if (currentPos && !entryHasPos(e, currentPos)) continue;
      matches.push(e);
    }
    matches.sort(cmpSort);
    if (matches.length === 0) {
      statusDiv.textContent = 'No entries start with "' + letter.toUpperCase() + '".';
      writeHash(push);
      return;
    }
    statusDiv.textContent = 'Browsing ' + matches.length + ' entries starting with "' + letter.toUpperCase() + '".';
    renderCapped(matches);
    writeHash(push);
    updateAzActive();
  }

  // Lists every entry tagged with a semantic domain (\sd), e.g. "Months".
  function renderDomain(domain, push) {
    currentBrowseLetter = '';
    currentDomain = domain;
    updateAzActive();
    resultsDiv.innerHTML = '';
    var matches = [];
    for (var i = 0; i < dictionaryData.length; i++) {
      var e = dictionaryData[i];
      if (e._domains.indexOf(domain) === -1) continue;
      if (currentPos && !entryHasPos(e, currentPos)) continue;
      matches.push(e);
    }
    matches.sort(cmpSort);
    if (matches.length === 0) {
      statusDiv.textContent = 'No entries in the domain "' + domain + '".';
    } else {
      statusDiv.textContent = 'Showing ' + matches.length + (matches.length === 1 ? ' entry' : ' entries')
        + ' in the domain "' + domain + '".';
      renderCapped(matches);
    }
    writeHash(push);
  }

  // ----- RENDER -----
  function psHtml(ps) {
    if (!ps) return '';
    return '<span class="dict-ps" title="' + escapeHtml(PS_LABELS[ps] || ps) + '">' + escapeHtml(ps) + '</span>';
  }

  function glossesHtml(chips) {
    var parts = [];
    for (var i = 0; i < chips.length; i++) {
      var g = escapeHtml(chips[i]);
      parts.push('<a class="gloss-link" data-gloss="' + g + '" title="Search English for &quot;' + g + '&quot;">' + g + '</a>');
    }
    return parts.join(', ');
  }

  // Usage labels: \ue (archaic, vulgar, ...) and \uv, which in this
  // dictionary holds irregular comparative endings such as "-errem".
  function usageHtml(sense) {
    var html = '';
    var ue = asArray(sense.ue);
    for (var i = 0; i < ue.length; i++) {
      html += '<span class="dict-usage">' + escapeHtml(ue[i]) + '</span>';
    }
    var uv = asArray(sense.uv);
    for (var j = 0; j < uv.length; j++) {
      html += '<span class="dict-usage">' + (sense.ps === 'adj' ? 'comparative ' : '')
        + '<span class="dict-usage-vern">' + escapeHtml(uv[j]) + '</span></span>';
    }
    return html;
  }

  function examplesHtml(examples) {
    var html = '';
    for (var i = 0; i < examples.length; i++) {
      var ex = examples[i];
      html += '<div class="dict-example">';
      if (ex.vernacular) html += '<span class="dict-vernacular">' + tokeniseAndLink(ex.vernacular) + '</span>';
      if (ex.english) html += ' <span class="dict-translation">"' + escapeHtml(ex.english) + '"</span>';
      html += '</div>';
    }
    return html;
  }

  // Glosses (with the part of speech inline when the entry has several
  // senses), then definitions (\de, \dv) and the sense's own examples.
  function senseHtml(sense, inlinePs) {
    var html = '<div class="dict-ge">'
      + (inlinePs ? psHtml(sense.ps) : '')
      + usageHtml(sense)
      + glossesHtml(sense._chips || [])
      + '</div>';
    var defs = asArray(sense.de).concat(asArray(sense.dv));
    for (var i = 0; i < defs.length; i++) {
      html += '<div class="dict-def">' + escapeHtml(defs[i]) + '</div>';
    }
    return html + examplesHtml(asArray(sense.examples));
  }

  function etymologyHtml(et) {
    var paras = String(et).split(/\n{2,}/);
    var html = '<div class="dict-meta"><span class="dict-label">Etymology:</span> ' + escapeHtml(paras[0]);
    for (var i = 1; i < paras.length; i++) {
      html += '<p class="dict-para">' + escapeHtml(paras[i]) + '</p>';
    }
    return html + '</div>';
  }

  function crossRefsHtml(refs) {
    var parts = [];
    for (var i = 0; i < refs.length; i++) {
      var ref = parseRef(refs[i]);
      parts.push(
        '<a class="mn-link' + (ref.dead ? ' mn-dead' : '') + '" data-ref="' + escapeHtml(ref.lx) + '"'
        + (ref.dead ? ' title="No entry found for this cross-reference"' : '')
        + '>' + escapeHtml(ref.lx) + (ref.hm ? '<sup>' + escapeHtml(ref.hm) + '</sup>' : '') + '</a>'
      );
    }
    return '<div class="dict-meta"><span class="dict-label">See also:</span> ' + parts.join(', ') + '</div>';
  }

  function domainsHtml(domains) {
    var html = '';
    for (var i = 0; i < domains.length; i++) {
      var d = escapeHtml(domains[i]);
      html += '<a class="sd-link" data-domain="' + d + '" title="Show all entries in &quot;' + d + '&quot;">' + d + '</a>';
    }
    return html;
  }

  // An entry or subentry: headword line, senses, etymology, cross-refs, then
  // any subentries nested beneath.
  function recordHtml(rec, hm, isSub) {
    var senses = asArray(rec.senses);
    var single = senses.length === 1;
    var html = '<div class="dict-headword-line">'
      + '<span class="' + (isSub ? 'dict-sub-lx' : 'dict-lx') + '">' + escapeHtml(rec.lx) + '</span>'
      + (hm ? '<span class="dict-hm">' + escapeHtml(hm) + '</span>' : '')
      + (single ? psHtml(senses[0].ps) : '')
      + domainsHtml(asArray(rec.sd))
      + '</div>';

    if (single) {
      html += senseHtml(senses[0], false);
    } else if (senses.length) {
      html += '<ol class="dict-senses">';
      for (var s = 0; s < senses.length; s++) {
        html += '<li class="dict-sense">' + senseHtml(senses[s], true) + '</li>';
      }
      html += '</ol>';
    }

    if (rec.et) html += etymologyHtml(rec.et);
    if (rec.mn) html += crossRefsHtml(asArray(rec.mn));

    var subs = asArray(rec.subentries);
    for (var i = 0; i < subs.length; i++) {
      html += '<section class="dict-subentry">' + recordHtml(subs[i], subs[i].hm, true) + '</section>';
    }
    return html;
  }

  function tokeniseAndLink(text) {
    if (!text) return '';
    var out = [];
    var buf = '';
    var wordRe;
    try { wordRe = new RegExp("[\\p{L}'-]", 'u'); }
    catch (e) { wordRe = /[A-Za-z'\-À-ɏ]/; }

    function flush() {
      if (!buf) return;
      var k = fold(buf);
      if (lxLookup[k]) {
        out.push('<a class="ex-link" data-ref="' + escapeHtml(lxLookup[k]) + '">' + escapeHtml(buf) + '</a>');
      } else {
        out.push(escapeHtml(buf));
      }
      buf = '';
    }
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (wordRe.test(ch)) {
        buf += ch;
      } else {
        flush();
        out.push(escapeHtml(ch));
      }
    }
    flush();
    return out.join('');
  }

  function displayHm(entry) {
    return (entry._displayHm !== undefined) ? entry._displayHm : entry.hm;
  }

  function renderEntries(entries) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < entries.length; i++) {
      var article = document.createElement('article');
      article.className = 'dict-entry';
      article.innerHTML = recordHtml(entries[i], displayHm(entries[i]), false);
      frag.appendChild(article);
    }
    resultsDiv.appendChild(frag);
  }

  function renderEnglishResults(matches) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      var wrap = document.createElement('div');
      wrap.className = 'english-index-item';
      var kwHtml = escapeHtml(m.display);
      var refs = englishIndex[m.key].refs;
      var refParts = [];
      for (var e = 0; e < refs.length; e++) {
        var ref = refs[e];
        if (currentPos && !refHasPos(ref)) continue;
        var rec = ref.record;
        var hmVal = rec === ref.entry ? displayHm(rec) : rec.hm;
        var hm = hmVal ? ' <sup>' + escapeHtml(hmVal) + '</sup>' : '';
        var ps = ref.ps.length ? ' <span class="ref-ps">(' + escapeHtml(ref.ps.join(', ')) + ')</span>' : '';
        refParts.push(
          '<a class="mn-link" data-ref="' + escapeHtml(rec.lx) + '">'
            + escapeHtml(rec.lx) + hm
          + '</a>' + ps
        );
      }
      wrap.innerHTML = '<div class="english-keyword">' + kwHtml + '</div>'
        + '<div class="english-refs">' + refParts.join('  ') + '</div>';
      frag.appendChild(wrap);
    }
    resultsDiv.appendChild(frag);
  }

  // ----- NAV HELPERS -----
  function setMode(m) {
    var r = document.querySelector('input[name="dict-mode"][value="' + m + '"]');
    if (r && !r.checked) r.checked = true;
    currentMode = m;
  }
  function jumpToBorlish(ref) {
    setMode('borlish');
    var q = '"' + ref + '"';
    searchInput.value = q;
    currentBrowseLetter = '';
    performSearch(q, true);
    window.scrollTo(0, 0);
  }
  function jumpToEnglish(gloss) {
    setMode('english');
    var q = '"' + gloss + '"';
    searchInput.value = q;
    currentBrowseLetter = '';
    performSearch(q, true);
    window.scrollTo(0, 0);
  }

  // ----- EVENT WIRING -----
  if (searchInput) {
    searchInput.addEventListener('input', function (e) {
      performSearch(e.target.value, false);  // replaceState while typing
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      searchInput.value = '';
      currentBrowseLetter = '';
      performSearch('', true);
      searchInput.focus();
    });
  }
  if (modeRadios) {
    modeRadios.forEach(function (radio) {
      radio.addEventListener('change', function (e) {
        currentMode = e.target.value;
        currentBrowseLetter = '';
        performSearch(searchInput.value, true);
      });
    });
  }
  if (posFilter) {
    posFilter.addEventListener('change', function (e) {
      currentPos = e.target.value;
      if (currentBrowseLetter) {
        renderBrowse(currentBrowseLetter, true);
      } else if (currentDomain) {
        renderDomain(currentDomain, true);
      } else {
        performSearch(searchInput.value, true);
      }
    });
  }
  if (azStrip) {
    azStrip.addEventListener('click', function (e) {
      // "All" reset button
      if (e.target.closest && e.target.closest('.az-all')) {
        exitBrowse();
        return;
      }
      var t = e.target.closest ? e.target.closest('.az-letter') : null;
      if (!t) return;
      var letter = t.getAttribute('data-letter');
      if (currentBrowseLetter === letter) {
        // Clicking the active letter again exits browse
        exitBrowse();
        return;
      }
      setMode('borlish');
      searchInput.value = '';
      currentBrowseLetter = letter;
      renderBrowse(letter, true);
    });
  }
  if (randomBtn) {
    randomBtn.addEventListener('click', function () {
      if (!dictionaryData.length) return;
      var r = dictionaryData[Math.floor(Math.random() * dictionaryData.length)];
      jumpToBorlish(r.lx);
    });
  }
  if (resultsDiv) {
    resultsDiv.addEventListener('click', function (e) {
      var t = e.target;
      var mnLink = t.closest ? t.closest('.mn-link') : null;
      if (mnLink) {
        e.preventDefault();
        if (mnLink.classList.contains('mn-dead')) return;
        jumpToBorlish(mnLink.getAttribute('data-ref'));
        return;
      }
      var exLink = t.closest ? t.closest('.ex-link') : null;
      if (exLink) {
        e.preventDefault();
        jumpToBorlish(exLink.getAttribute('data-ref'));
        return;
      }
      var glossLink = t.closest ? t.closest('.gloss-link') : null;
      if (glossLink) {
        e.preventDefault();
        jumpToEnglish(glossLink.getAttribute('data-gloss'));
        return;
      }
      var sdLink = t.closest ? t.closest('.sd-link') : null;
      if (sdLink) {
        e.preventDefault();
        setMode('borlish');
        searchInput.value = '';
        renderDomain(sdLink.getAttribute('data-domain'), true);
        window.scrollTo(0, 0);
        return;
      }
    });
  }
  window.addEventListener('hashchange', function () {
    applyStateFromHash(true);
  });

  init();

  return { init: init, performSearch: performSearch };
})();

if (typeof module !== 'undefined') {
  module.exports = BorlishDictionary;
}
