// crossword.js — interactive crossword widget driven by an .ipuz file
// Usage: <div id="crossword-embed" data-puzzle-number="42"></div>

(function () {
  'use strict';

  // ================================================================
  // CONSTANTS
  // ================================================================
  var STORAGE_PREFIX   = 'xw-progress-';
  var STORAGE_SETTINGS = 'xw-settings';

  // ================================================================
  // MODULE STATE
  // ================================================================
  var puzzle      = null;   // parsed puzzle object
  var words       = [];     // flat sorted word list
  var wordMap     = {};     // "42_across" → word
  var cellWordMap = [];     // [r][c] → {across: word|null, down: word|null}

  var puzzleNumber = null;
  var container    = null;
  var hiddenInput  = null;

  var state = {
    cursor:    { row: 0, col: 0 },
    direction: 'across',
    focused:   false,
    completed: false,
    paused:    false,
    timer: {
      running:    false,
      elapsed:    0,
      intervalId: null
    },
    settings: {
      lightMode:   false,
      skipFilled:  false,
      autoNextWord: true
    }
  };

  // ================================================================
  // INIT
  // ================================================================
  function init() {
    container = document.getElementById('crossword-embed');
    if (!container) return;

    puzzleNumber = container.getAttribute('data-puzzle-number');
    if (!puzzleNumber) return;

    loadSettings();

    var url = '/assets/ipuz/' + encodeURIComponent(puzzleNumber) + '.ipuz';
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        puzzle      = parseIPuz(data);
        words       = buildWordList(puzzle);
        buildCellWordMap();
        render();
        applySeparators();
        loadProgress();
        // Position cursor at the first unfilled cell of the first across word
        var first = words[0];
        if (first) {
          var target = firstEmptyInWord(first) || first.cells[0];
          selectCell(target.row, target.col, first.direction, true);
        }
      })
      .catch(function (e) {
        container.innerHTML = '<p class="xw-error">Failed to load puzzle: ' + e.message + '</p>';
      });
  }

  // ================================================================
  // IPUZ PARSER
  // ================================================================
  function parseIPuz(data) {
    var width  = data.dimensions.width;
    var height = data.dimensions.height;

    var grid = [];
    for (var r = 0; r < height; r++) {
      grid[r] = [];
      for (var c = 0; c < width; c++) {
        var raw    = data.puzzle[r][c];
        var rawSol = data.solution ? data.solution[r][c] : null;

        var isBlack = (raw === '#');
        var number  = (typeof raw === 'number') ? raw : null;

        var solution = null;
        if (!isBlack && rawSol) {
          if (typeof rawSol === 'object' && rawSol.value) {
            solution = rawSol.value.toUpperCase();
          } else if (typeof rawSol === 'string' && rawSol !== '#') {
            solution = rawSol.toUpperCase();
          }
        }

        grid[r][c] = {
          row:      r,
          col:      c,
          number:   number,
          isBlack:  isBlack,
          solution: solution,
          entry:    '',
          revealed: false,
          checked:  null   // null | 'correct' | 'incorrect'
        };
      }
    }

    return {
      width:            width,
      height:           height,
      grid:             grid,
      clues:            data.clues || {},
      showEnumerations: data.showenumerations !== false,
      title:            data.title  || '',
      author:           data.author || '',
      notes:            data.notes  || ''
    };
  }

  // ================================================================
  // WORD LIST BUILDER
  // ================================================================
  function buildWordList(puz) {
    var result = [];
    var grid   = puz.grid;
    var width  = puz.width;
    var height = puz.height;

    // Index clues by number for quick lookup
    var clueIdx = { Across: {}, Down: {} };
    ['Across', 'Down'].forEach(function (dir) {
      (puz.clues[dir] || []).forEach(function (c) {
        clueIdx[dir][c.number] = c;
      });
    });

    function findCellByNumber(num) {
      for (var r = 0; r < height; r++) {
        for (var c = 0; c < width; c++) {
          if (grid[r][c].number === num) return grid[r][c];
        }
      }
      return null;
    }

    // Across words (driven by clue list, so order matches editorial order)
    (puz.clues.Across || []).forEach(function (clueData) {
      var start = findCellByNumber(clueData.number);
      if (!start) return;
      var cells = [];
      for (var c = start.col; c < width && !grid[start.row][c].isBlack; c++) {
        cells.push({ row: start.row, col: c });
      }
      if (cells.length < 2) return; // degenerate
      result.push({
        number:        clueData.number,
        label:         clueData.label ? String(clueData.label) : null,
        continued:     clueData.continued || null,
        continuations: null,   // filled in below
        direction:     'across',
        cells:         cells,
        clue:          clueData.clue        || '',
        enumeration:   clueData.enumeration || '',
        separators:    parseSeparators(clueData.enumeration || '')
      });
    });

    // Down words
    (puz.clues.Down || []).forEach(function (clueData) {
      var start = findCellByNumber(clueData.number);
      if (!start) return;
      var cells = [];
      for (var r = start.row; r < height && !grid[r][start.col].isBlack; r++) {
        cells.push({ row: r, col: start.col });
      }
      if (cells.length < 2) return;
      result.push({
        number:        clueData.number,
        label:         clueData.label ? String(clueData.label) : null,
        continued:     clueData.continued || null,
        continuations: null,
        direction:     'down',
        cells:         cells,
        clue:          clueData.clue        || '',
        enumeration:   clueData.enumeration || '',
        separators:    parseSeparators(clueData.enumeration || '')
      });
    });

    // Build continuation stubs for linked clues (e.g. "1/10" spanning two grid entries).
    // The ipuz `continued` field names a cell number that starts a new grid segment
    // belonging to the same logical answer.  These continuation cells have no standalone
    // entry in the clue list, so we create a lightweight stub word for them.
    var coveredKeys = {};
    result.forEach(function (w) { coveredKeys[w.number + '_' + w.direction] = true; });

    var stubs = [];
    result.forEach(function (primaryWord) {
      if (!primaryWord.continued) return;
      primaryWord.continuations = [];
      primaryWord.continued.forEach(function (cont) {
        var contDir = cont.direction.toLowerCase();
        var contNum = parseInt(cont.number, 10);
        if (coveredKeys[contNum + '_' + contDir]) return; // already has its own clue entry
        var start = findCellByNumber(contNum);
        if (!start) return;
        var cells = [];
        if (contDir === 'across') {
          for (var cc = start.col; cc < width && !grid[start.row][cc].isBlack; cc++) {
            cells.push({ row: start.row, col: cc });
          }
        } else {
          for (var rr = start.row; rr < height && !grid[rr][start.col].isBlack; rr++) {
            cells.push({ row: rr, col: start.col });
          }
        }
        if (!cells.length) return;
        var stub = {
          number:        contNum,
          label:         null,
          continued:     null,
          continuations: null,
          isContinuation: true,
          primaryWord:   primaryWord,
          direction:     contDir,
          cells:         cells,
          clue:          '',
          enumeration:   '',
          separators:    []
        };
        primaryWord.continuations.push(stub);
        stubs.push(stub);
      });
    });

    // Insert each stub immediately after its primary word in the list
    stubs.forEach(function (stub) {
      var idx = result.indexOf(stub.primaryWord);
      // also skip over any stubs already inserted after this primary
      while (idx + 1 < result.length && result[idx + 1].isContinuation &&
             result[idx + 1].primaryWord === stub.primaryWord) idx++;
      result.splice(idx + 1, 0, stub);
    });

    return result;
  }

  // Parse "6 8", "5-4", "1-6", "4 2" → [{after: N, type: 'space'|'hyphen'}, ...]
  // `after` is the 1-based cell index after which the separator falls
  function parseSeparators(enumStr) {
    if (!enumStr) return [];
    var seps = [];
    var pos  = 0;
    var re   = /(\d+)([-\s])?/g;
    var m;
    while ((m = re.exec(enumStr)) !== null) {
      pos += parseInt(m[1], 10);
      if      (m[2] === '-') seps.push({ after: pos, type: 'hyphen' });
      else if (m[2] === ' ') seps.push({ after: pos, type: 'space' });
    }
    return seps;
  }

  function buildCellWordMap() {
    cellWordMap = [];
    for (var r = 0; r < puzzle.height; r++) {
      cellWordMap[r] = [];
      for (var c = 0; c < puzzle.width; c++) {
        cellWordMap[r][c] = { across: null, down: null };
      }
    }
    words.forEach(function (word) {
      word.cells.forEach(function (wc) {
        cellWordMap[wc.row][wc.col][word.direction] = word;
      });
      wordMap[word.number + '_' + word.direction] = word;
    });
  }

  // ================================================================
  // RENDERING
  // ================================================================
  function render() {
    var widget = document.createElement('div');
    widget.className = 'xw-widget' + (state.settings.lightMode ? ' xw-light' : '');
    widget.style.setProperty('--xw-cols', puzzle.width);
    widget.style.setProperty('--xw-rows', puzzle.height);
    widget.setAttribute('tabindex', '0');

    widget.innerHTML = [
      renderHiddenInput(),
      puzzle.notes ? renderNotesModal(puzzle.notes) : '',
      '<div class="xw-controls-bar">',
        renderControls(),
      '</div>',
      '<div class="xw-active-clue-bar">',
        '<span class="xw-acb-label"></span>',
        '<span class="xw-acb-clue"></span>',
      '</div>',
      '<div class="xw-body">',
        '<div class="xw-pause-overlay" hidden>',
          '<span class="xw-pause-message">⏸ Paused — click to resume</span>',
        '</div>',
        '<div class="xw-grid-wrap">',
          renderGrid(),
        '</div>',
        '<div class="xw-clue-panel">',
          renderClueSection('Across'),
          renderClueSection('Down'),
        '</div>',
      '</div>',
      '<div class="xw-completion-banner" hidden>',
        '🎉 Puzzle complete!',
      '</div>'
    ].join('');

    container.appendChild(widget);
    hiddenInput = widget.querySelector('.xw-hidden-input');
    bindEvents(widget);
  }

  function renderNotesModal(notes) {
    // Escape HTML entities so raw notes text is safe to inject
    var safe = notes
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>');
    return '<div class="xw-notes-backdrop">' +
      '<div class="xw-notes-modal" role="dialog" aria-modal="true" aria-label="Puzzle notes">' +
        '<div class="xw-notes-body">' + safe + '</div>' +
        '<button class="xw-notes-close xw-ctrl-btn" type="button">Got it</button>' +
      '</div>' +
    '</div>';
  }

  function renderHiddenInput() {
    return '<input class="xw-hidden-input" type="text" ' +
      'autocomplete="off" autocorrect="off" autocapitalize="characters" ' +
      'spellcheck="false" aria-hidden="true">';
  }

  function renderControls() {
    function dropdown(label, items) {
      var btns = items.map(function (item) {
        return '<button class="xw-dd-item" data-action="' + item.action + '">' + item.label + '</button>';
      }).join('');
      return '<div class="xw-dd-group">' +
        '<button class="xw-ctrl-btn xw-dd-trigger" type="button">' +
          label + ' <span class="xw-caret">▾</span>' +
        '</button>' +
        '<div class="xw-dd-panel">' + btns + '</div>' +
      '</div>';
    }

    var checkDd = dropdown('Check', [
      { label: 'Letter', action: 'check-cell'  },
      { label: 'Word',   action: 'check-word'  },
      { label: 'Grid',   action: 'check-grid'  }
    ]);
    var revealDd = dropdown('Reveal', [
      { label: 'Letter', action: 'reveal-cell' },
      { label: 'Word',   action: 'reveal-word' },
      { label: 'Grid',   action: 'reveal-grid' }
    ]);
    var clearDd = dropdown('Clear', [
      { label: 'Letter', action: 'clear-cell'  },
      { label: 'Word',   action: 'clear-word'  },
      { label: 'Grid',   action: 'clear-grid'  }
    ]);

    var settingsDd =
      '<div class="xw-dd-group">' +
        '<button class="xw-ctrl-btn xw-dd-trigger" type="button" title="Settings">⚙</button>' +
        '<div class="xw-dd-panel xw-settings-panel">' +
          settingRow('lightMode',    'Light mode')           +
          settingRow('skipFilled',   'Skip filled letters')  +
          settingRow('autoNextWord', 'Jump to next word')    +
        '</div>' +
      '</div>';

    var pauseBtn  = '<button class="xw-ctrl-btn xw-pause-btn" type="button" data-action="pause" title="Pause / resume">⏸</button>';
    var fsBtn     = '<button class="xw-ctrl-btn xw-fs-btn"    type="button" data-action="fullscreen" title="Fullscreen">⛶</button>';
    var pdfBtn    = '<button class="xw-ctrl-btn"              type="button" data-action="print" title="Save as PDF">PDF</button>';
    var notesBtn  = puzzle.notes
      ? '<button class="xw-ctrl-btn" type="button" data-action="notes" title="Puzzle notes">ℹ</button>'
      : '';
    var timer     = '<div class="xw-timer-group"><div class="xw-timer" role="timer" aria-label="Time elapsed">0:00</div>' + pauseBtn + '</div>';

    return checkDd + revealDd + clearDd + settingsDd + notesBtn + timer + fsBtn + pdfBtn;
  }

  function settingRow(key, label) {
    var checked = state.settings[key] ? ' checked' : '';
    return '<label class="xw-setting-row">' +
      '<span>' + label + '</span>' +
      '<input type="checkbox" data-setting="' + key + '"' + checked + '>' +
    '</label>';
  }

  function renderGrid() {
    var rows = [];
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        rows.push(renderCell(r, c));
      }
    }
    return '<div class="xw-grid" role="grid">' + rows.join('') + '</div>';
  }

  function renderCell(r, c) {
    var cell = puzzle.grid[r][c];
    if (cell.isBlack) {
      return '<div class="xw-cell xw-black" data-r="' + r + '" data-c="' + c +
             '" role="gridcell" aria-disabled="true"></div>';
    }
    var numSpan = cell.number
      ? '<span class="xw-num" aria-hidden="true">' + cell.number + '</span>'
      : '';
    var ariaLabel = (cell.number ? cell.number + ' ' : '') + 'row ' + (r+1) + ' column ' + (c+1);
    return '<div class="xw-cell" data-r="' + r + '" data-c="' + c + '"' +
           ' role="gridcell" aria-label="' + ariaLabel + '">' +
      numSpan +
      '<span class="xw-letter" aria-hidden="true"></span>' +
    '</div>';
  }

  // Format an enumeration for display: spaces become commas, hyphens are kept.
  // e.g. "6 8" → "6,8"  |  "5-4" → "5-4"  |  "4 2" → "4,2"
  function fmtEnum(enumStr) {
    return enumStr.replace(/ /g, ',');
  }

  function renderClueSection(dir) {
    var clues = puzzle.clues[dir] || [];
    var items = clues.map(function (c) {
      var enumStr = (puzzle.showEnumerations && c.enumeration)
        ? ' <span class="xw-clue-enum">(' + fmtEnum(c.enumeration) + ')</span>'
        : '';
      var displayNum = c.label ? String(c.label) : String(c.number);
      return '<div class="xw-clue" data-num="' + c.number + '" data-dir="' + dir.toLowerCase() + '">' +
        '<span class="xw-clue-num">' + displayNum + '</span>' +
        '<span class="xw-clue-text">' + c.clue + enumStr + '</span>' +
      '</div>';
    }).join('');
    return '<div class="xw-clue-section">' +
      '<div class="xw-clue-section-title">' + dir + '</div>' +
      '<div class="xw-clue-list">' + items + '</div>' +
    '</div>';
  }

  // Apply word-separator CSS classes after the grid is in the DOM
  function applySeparators() {
    words.forEach(function (word) {
      // A separator whose 1-based index equals the word's cell count sits on
      // the very last cell — for a linked-clue primary word that position is
      // the physical break between grid segments, not an in-answer word
      // boundary, so we skip it (the grid layout already makes the split
      // visible; the extra border would be misleading).
      var isLinkedPrimary = !!(word.continuations && word.continuations.length);

      word.separators.forEach(function (sep) {
        var idx = sep.after - 1; // 0-indexed cell after which separator sits
        if (idx < 0 || idx >= word.cells.length) return;
        if (isLinkedPrimary && idx === word.cells.length - 1) return;
        var wc  = word.cells[idx];
        var el  = getCellEl(wc.row, wc.col);
        if (!el) return;
        if (word.direction === 'across') {
          el.classList.add(sep.type === 'hyphen' ? 'xw-sep-right-hyphen' : 'xw-sep-right-space');
        } else {
          el.classList.add(sep.type === 'hyphen' ? 'xw-sep-bottom-hyphen' : 'xw-sep-bottom-space');
        }
      });
    });
  }

  // ================================================================
  // DOM HELPERS
  // ================================================================
  function getWidget() {
    return container.querySelector('.xw-widget');
  }

  function getCellEl(r, c) {
    return container.querySelector('.xw-cell[data-r="' + r + '"][data-c="' + c + '"]');
  }

  function getClueEl(num, dir) {
    return container.querySelector('.xw-clue[data-num="' + num + '"][data-dir="' + dir.toLowerCase() + '"]');
  }

  // Scroll a clue element into view within its .xw-clue-section only,
  // without scrolling the page viewport (avoids mobile judder).
  function scrollClueIntoView(clueEl) {
    var section = clueEl.closest('.xw-clue-section');
    if (!section) return;
    var st = section.scrollTop;
    var sh = section.clientHeight;
    var ct = clueEl.offsetTop - section.offsetTop;
    var ch = clueEl.offsetHeight;
    if (ct < st) {
      section.scrollTop = ct;
    } else if (ct + ch > st + sh) {
      section.scrollTop = ct + ch - sh;
    }
  }

  function updateCellDisplay(r, c) {
    var el   = getCellEl(r, c);
    if (!el) return;
    var cell = puzzle.grid[r][c];
    if (cell.isBlack) return;

    var letterEl = el.querySelector('.xw-letter');
    if (letterEl) letterEl.textContent = cell.entry || '';

    el.classList.remove('xw-correct', 'xw-incorrect', 'xw-revealed');
    if      (cell.revealed)              el.classList.add('xw-revealed');
    else if (cell.checked === 'correct') el.classList.add('xw-correct');
    else if (cell.checked === 'incorrect') el.classList.add('xw-incorrect');
  }

  function updateAllCells() {
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        if (!puzzle.grid[r][c].isBlack) updateCellDisplay(r, c);
      }
    }
  }

  // Dim clues whose words are fully filled in
  function updateClueDoneStates() {
    words.forEach(function (word) {
      if (word.isContinuation) return; // handled via its primary word
      var done = getAllWordCells(word).every(function (wc) {
        return !!puzzle.grid[wc.row][wc.col].entry;
      });
      var el = getClueEl(word.number, word.direction);
      if (el) el.classList.toggle('xw-clue-done', done);
    });
  }

  // ================================================================
  // SELECTION & NAVIGATION
  // ================================================================
  function selectCell(r, c, preferredDir, silent) {
    var cell = puzzle.grid[r][c];
    if (!cell || cell.isBlack) return;

    // Resolve direction: use preferred if a word exists there, else try the other
    var dir = preferredDir || state.direction;
    if (!cellWordMap[r][c][dir]) {
      var other = (dir === 'across') ? 'down' : 'across';
      if (cellWordMap[r][c][other]) dir = other;
    }

    clearHighlights();

    state.cursor    = { row: r, col: c };
    state.direction = dir;
    state.focused   = true;

    if (!silent && !state.timer.running && !state.completed) startTimer();

    // Highlight word (all parts for linked clues) and mark selected cell
    var word = cellWordMap[r][c][dir];
    var displayWord = getDisplayWord(word);
    if (displayWord) {
      getAllWordCells(displayWord).forEach(function (wc) {
        var el = getCellEl(wc.row, wc.col);
        if (el) el.classList.add('xw-highlighted');
      });
    }
    var selEl = getCellEl(r, c);
    if (selEl) selEl.classList.add('xw-selected');

    // Update clue panel — always look up by the primary (display) word
    if (displayWord) {
      container.querySelectorAll('.xw-clue.xw-clue-active').forEach(function (el) {
        el.classList.remove('xw-clue-active');
      });
      var clueEl = getClueEl(displayWord.number, displayWord.direction);
      if (clueEl) {
        clueEl.classList.add('xw-clue-active');
        scrollClueIntoView(clueEl);
      }
    }

    updateActiveClueBar();
    if (hiddenInput && document.activeElement !== hiddenInput) {
      hiddenInput.focus({ preventScroll: true });
    }
  }

  // For a continuation stub, return its primary word; otherwise return the word itself.
  function getDisplayWord(word) {
    return (word && word.isContinuation) ? word.primaryWord : word;
  }

  // All cells that belong to the logical word (primary + all continuations).
  function getAllWordCells(word) {
    var dw = getDisplayWord(word);
    if (!dw) return [];
    var cells = dw.cells.slice();
    if (dw.continuations) {
      dw.continuations.forEach(function (stub) {
        cells = cells.concat(stub.cells);
      });
    }
    return cells;
  }

  function clearHighlights() {
    container.querySelectorAll('.xw-highlighted, .xw-selected').forEach(function (el) {
      el.classList.remove('xw-highlighted', 'xw-selected');
    });
  }

  function updateActiveClueBar() {
    var word    = getDisplayWord(getCurrentWord());
    var label   = container.querySelector('.xw-acb-label');
    var clueEl  = container.querySelector('.xw-acb-clue');
    if (!label || !clueEl) return;
    if (!word) { label.textContent = ''; clueEl.textContent = ''; return; }

    var numStr  = word.label || String(word.number);
    label.textContent = numStr + (word.direction === 'across' ? 'A' : 'D') + '. ';
    var enumStr = (puzzle.showEnumerations && word.enumeration) ? ' (' + fmtEnum(word.enumeration) + ')' : '';
    clueEl.innerHTML = word.clue + enumStr;
  }

  function getCurrentWord() {
    var r = state.cursor.row, c = state.cursor.col;
    if (!cellWordMap[r]) return null;
    return cellWordMap[r][c][state.direction] || null;
  }

  function getCurrentWordCellIndex() {
    var word = getCurrentWord();
    if (!word) return -1;
    var r = state.cursor.row, c = state.cursor.col;
    for (var i = 0; i < word.cells.length; i++) {
      if (word.cells[i].row === r && word.cells[i].col === c) return i;
    }
    return -1;
  }

  function firstEmptyInWord(word) {
    for (var i = 0; i < word.cells.length; i++) {
      var wc = word.cells[i];
      if (!puzzle.grid[wc.row][wc.col].entry) return wc;
    }
    return null;
  }

  function advanceCursor() {
    var word = getCurrentWord();
    if (!word) return;
    var idx     = getCurrentWordCellIndex();
    var nextIdx = -1;

    if (state.settings.skipFilled) {
      for (var i = idx + 1; i < word.cells.length; i++) {
        var wc = word.cells[i];
        if (!puzzle.grid[wc.row][wc.col].entry) { nextIdx = i; break; }
      }
    } else {
      nextIdx = idx + 1 < word.cells.length ? idx + 1 : -1;
    }

    if (nextIdx >= 0) {
      selectCell(word.cells[nextIdx].row, word.cells[nextIdx].col, state.direction);
    } else if (!word.isContinuation && word.continuations && word.continuations.length) {
      // Flow from primary word into its first continuation stub
      var cont   = word.continuations[0];
      var target = firstEmptyInWord(cont) || cont.cells[0];
      selectCell(target.row, target.col, cont.direction);
    } else if (state.settings.autoNextWord) {
      jumpToNextWord();
    }
    // else stay at last cell
  }

  function retreatCursor() {
    var word = getCurrentWord();
    if (!word) return;
    var idx = getCurrentWordCellIndex();
    if (idx > 0) {
      selectCell(word.cells[idx - 1].row, word.cells[idx - 1].col, state.direction);
    }
  }

  function jumpToNextWord() {
    var cur = getCurrentWord();
    var idx = getWordListIndex(cur);
    var n   = words.length;
    for (var i = 1; i <= n; i++) {
      var next = words[(idx + i) % n];
      if (next.isContinuation) continue; // skip stubs; typing flows into them naturally
      var target = firstEmptyInWord(next) || next.cells[0];
      selectCell(target.row, target.col, next.direction);
      return;
    }
  }

  function jumpToPrevWord() {
    var cur = getCurrentWord();
    var idx = getWordListIndex(cur);
    var n   = words.length;
    for (var i = 1; i <= n; i++) {
      var prev = words[(idx - i + n) % n];
      if (prev.isContinuation) continue; // skip stubs
      var target = prev.cells[prev.cells.length - 1];
      selectCell(target.row, target.col, prev.direction);
      return;
    }
  }

  function getWordListIndex(word) {
    if (!word) return 0;
    for (var i = 0; i < words.length; i++) {
      if (words[i] === word) return i;
    }
    return 0;
  }

  // ================================================================
  // EVENT BINDING
  // ================================================================
  function bindEvents(widget) {
    // ---- Mouse / touch ----
    widget.addEventListener('click', function (e) {
      // Cell click
      var cellEl = e.target.closest('.xw-cell:not(.xw-black)');
      if (cellEl) {
        var r = parseInt(cellEl.dataset.r, 10);
        var c = parseInt(cellEl.dataset.c, 10);
        if (state.cursor.row === r && state.cursor.col === c) {
          // Toggle direction on same cell
          var other = (state.direction === 'across') ? 'down' : 'across';
          if (cellWordMap[r][c][other]) selectCell(r, c, other);
        } else {
          selectCell(r, c);
        }
        return;
      }

      // Clue click
      var clueEl = e.target.closest('.xw-clue');
      if (clueEl) {
        var num  = parseInt(clueEl.dataset.num, 10);
        var dir  = clueEl.dataset.dir;
        var word = wordMap[num + '_' + dir];
        if (word) {
          var target = firstEmptyInWord(word) || word.cells[0];
          selectCell(target.row, target.col, dir);
        }
        return;
      }

      // Dropdown trigger
      var trigger = e.target.closest('.xw-dd-trigger');
      if (trigger) {
        var group = trigger.closest('.xw-dd-group');
        var panel = group && group.querySelector('.xw-dd-panel');
        if (panel) {
          var wasOpen = panel.classList.contains('xw-dd-open');
          closeAllDropdowns(widget);
          if (!wasOpen) panel.classList.add('xw-dd-open');
        }
        e.stopPropagation();
        return;
      }

      // Action item
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        handleAction(actionEl.dataset.action);
        closeAllDropdowns(widget);
        return;
      }
    });

    // Close dropdowns when clicking anywhere outside a dropdown group
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.xw-dd-group')) closeAllDropdowns(widget);
    });

    // Notes modal close (button or backdrop click)
    widget.addEventListener('click', function (e) {
      var backdrop = e.target.closest('.xw-notes-backdrop');
      if (!backdrop) return;
      // Close if the button itself was clicked, or if the click landed on the backdrop
      // (i.e. outside the modal card)
      if (e.target.classList.contains('xw-notes-close') ||
          e.target.classList.contains('xw-notes-backdrop')) {
        backdrop.setAttribute('hidden', '');
      }
    });

    // Click on pause overlay resumes the puzzle
    widget.addEventListener('click', function (e) {
      if (e.target.closest('.xw-pause-overlay')) togglePause();
    });

    // Fullscreen change: update button icon
    document.addEventListener('fullscreenchange', function () {
      var btn = widget.querySelector('.xw-fs-btn');
      if (btn) btn.textContent = document.fullscreenElement ? '✕' : '⛶';
    });

    // Settings checkboxes
    widget.addEventListener('change', function (e) {
      var input = e.target.closest('[data-setting]');
      if (!input) return;
      var key = input.dataset.setting;
      state.settings[key] = input.checked;
      saveSettings();
      if (key === 'lightMode') widget.classList.toggle('xw-light', input.checked);
    });

    // ---- Keyboard via hidden input ----
    if (hiddenInput) {
      hiddenInput.addEventListener('keydown', function (e) {
        if (!state.focused) return;
        var key = e.key;

        if (key === 'ArrowLeft' || key === 'ArrowRight' || key === 'ArrowUp' || key === 'ArrowDown') {
          e.preventDefault();
          handleArrow(key);
        } else if (key === 'Tab' || key === 'Enter') {
          e.preventDefault();
          if (e.shiftKey) jumpToPrevWord(); else jumpToNextWord();
        } else if (key === 'Backspace') {
          e.preventDefault();
          handleBackspace();
        } else if (key === 'Delete') {
          e.preventDefault();
          handleDelete();
        } else if (key === ' ') {
          e.preventDefault();
          handleSpaceToggle();
        }
        // Letter keys: let the `input` event handle them (works on mobile too)
      });

      hiddenInput.addEventListener('input', function () {
        if (!state.focused) return;
        var val = hiddenInput.value;
        hiddenInput.value = '';
        if (!val) return;
        // Take the last character in case of IME or autocorrect inserting multiple chars
        var ch = val.slice(-1).toUpperCase();
        if (/^[A-Z]$/.test(ch)) handleLetter(ch);
      });

      hiddenInput.addEventListener('focus', function () { state.focused = true; });
      hiddenInput.addEventListener('blur',  function (e) {
        // Only lose focus if we're leaving the widget entirely
        if (widget && !widget.contains(e.relatedTarget)) state.focused = false;
      });
    }
  }

  function closeAllDropdowns(widget) {
    widget.querySelectorAll('.xw-dd-panel.xw-dd-open').forEach(function (p) {
      p.classList.remove('xw-dd-open');
    });
  }

  function handleArrow(key) {
    var r = state.cursor.row, c = state.cursor.col;
    var dr = 0, dc = 0, newDir;

    if      (key === 'ArrowLeft')  { dc = -1; newDir = 'across'; }
    else if (key === 'ArrowRight') { dc =  1; newDir = 'across'; }
    else if (key === 'ArrowUp')    { dr = -1; newDir = 'down';   }
    else if (key === 'ArrowDown')  { dr =  1; newDir = 'down';   }

    // When the arrow is in the same direction as the currently highlighted word,
    // check whether we are sitting at a linked-clue part boundary.  If so, step
    // to the adjacent part of the linked answer rather than moving grid-wise.
    // (If a different direction is highlighted — e.g. 5D while cursor sits in 1A
    // — newDir !== state.direction, so we fall straight through to normal movement.)
    if (newDir === state.direction) {
      var word = getCurrentWord();
      var idx  = getCurrentWordCellIndex();
      if (word && idx >= 0) {
        var dw    = getDisplayWord(word);             // primary word
        var parts = [dw].concat(dw.continuations || []);
        var pIdx  = parts.indexOf(word);              // index of current segment

        // Forward (→ / ↓): last cell of this segment → first cell of next segment
        if ((dc > 0 || dr > 0) && idx === word.cells.length - 1 && pIdx < parts.length - 1) {
          var next = parts[pIdx + 1];
          selectCell(next.cells[0].row, next.cells[0].col, next.direction);
          return;
        }

        // Backward (← / ↑): first cell of this segment → last cell of previous segment
        if ((dc < 0 || dr < 0) && idx === 0 && pIdx > 0) {
          var prev     = parts[pIdx - 1];
          var lastCell = prev.cells[prev.cells.length - 1];
          selectCell(lastCell.row, lastCell.col, prev.direction);
          return;
        }
      }
    }

    var nr = r + dr, nc = c + dc;

    // Keep checking squares in the chosen direction until we hit the edge
    while (nr >= 0 && nr < puzzle.height && nc >= 0 && nc < puzzle.width) {
      // If the square is NOT black, select it and stop looking
      if (!puzzle.grid[nr][nc].isBlack) {
        selectCell(nr, nc, newDir);
        return;
      }

      // If it IS black, keep moving in the same direction
      nr += dr;
      nc += dc;
    }

    // If the loop finishes without returning, it means we hit the edge
    // of the board without finding a white square. Do nothing.
  }

  function handleLetter(ch) {
    var r    = state.cursor.row, c = state.cursor.col;
    var cell = puzzle.grid[r][c];
    if (cell.revealed) { advanceCursor(); return; }

    cell.entry   = ch;
    cell.checked = null;
    updateCellDisplay(r, c);
    updateClueDoneStates();
    saveProgress();
    checkCompletion();
    advanceCursor();
  }

  function handleBackspace() {
    var r    = state.cursor.row, c = state.cursor.col;
    var cell = puzzle.grid[r][c];

    // At the first cell of a word: if it's empty, jump to previous word;
    // if it has content, just clear it and stay put.
    if (getCurrentWordCellIndex() === 0) {
      if (!cell.revealed && cell.entry) {
        cell.entry   = '';
        cell.checked = null;
        updateCellDisplay(r, c);
        updateClueDoneStates();
        saveProgress();
      } else {
        jumpToPrevWord();
      }
      return;
    }

    // Mid-word: clear current cell if non-empty, otherwise retreat and clear.
    if (!cell.revealed && cell.entry) {
      cell.entry   = '';
      cell.checked = null;
      updateCellDisplay(r, c);
      updateClueDoneStates();
      saveProgress();
    } else {
      retreatCursor();
      var nr  = state.cursor.row, nc = state.cursor.col;
      var nc2 = puzzle.grid[nr][nc];
      if (!nc2.revealed) {
        nc2.entry   = '';
        nc2.checked = null;
        updateCellDisplay(nr, nc);
        updateClueDoneStates();
        saveProgress();
      }
    }
  }

  function handleDelete() {
    var r    = state.cursor.row, c = state.cursor.col;
    var cell = puzzle.grid[r][c];
    if (cell.revealed) return;
    cell.entry   = '';
    cell.checked = null;
    updateCellDisplay(r, c);
    updateClueDoneStates();
    saveProgress();
  }

  // Toggle between across and down on a crossed cell (Space key).
  function handleSpaceToggle() {
    var r     = state.cursor.row, c = state.cursor.col;
    var other = (state.direction === 'across') ? 'down' : 'across';
    if (cellWordMap[r][c][other]) selectCell(r, c, other);
  }

  // ================================================================
  // SOLVING ACTIONS (Check / Reveal / Clear)
  // ================================================================
  function handleAction(action) {
    switch (action) {
      case 'check-cell':  checkCells([state.cursor]);          break;
      case 'check-word':  checkCells(getCurrentWordCells());   break;
      case 'check-grid':  checkCells(getAllCells());            break;
      case 'reveal-cell': revealCells([state.cursor]);         break;
      case 'reveal-word': revealCells(getCurrentWordCells());  break;
      case 'reveal-grid': revealCells(getAllCells());           break;
      case 'clear-cell':  clearCells([state.cursor]);          break;
      case 'clear-word':  clearCells(getCurrentWordCells());   break;
      case 'clear-grid':  clearCells(getAllCells());            break;
      case 'pause':       togglePause();                       break;
      case 'fullscreen':  toggleFullscreen();                  break;
      case 'print':       printPDF();                          break;
      case 'notes':       showNotes();                         break;
    }
  }

  function getCurrentWordCells() {
    var word = getCurrentWord();
    return word ? word.cells : [];
  }

  function getAllCells() {
    var cells = [];
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        if (!puzzle.grid[r][c].isBlack) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  function checkCells(cells) {
    cells.forEach(function (pos) {
      var cell = puzzle.grid[pos.row][pos.col];
      if (cell.isBlack || !cell.entry || cell.revealed) return;
      cell.checked = (cell.entry === cell.solution) ? 'correct' : 'incorrect';
      updateCellDisplay(pos.row, pos.col);
    });
    saveProgress();
  }

  function revealCells(cells) {
    cells.forEach(function (pos) {
      var cell = puzzle.grid[pos.row][pos.col];
      if (cell.isBlack || !cell.solution) return;
      cell.entry    = cell.solution;
      cell.revealed = true;
      cell.checked  = 'correct';
      updateCellDisplay(pos.row, pos.col);
    });
    updateClueDoneStates();
    saveProgress();
    checkCompletion();
  }

  function clearCells(cells) {
    cells.forEach(function (pos) {
      var cell = puzzle.grid[pos.row][pos.col];
      if (cell.isBlack || cell.revealed) return;
      cell.entry   = '';
      cell.checked = null;
      updateCellDisplay(pos.row, pos.col);
    });
    updateClueDoneStates();
    saveProgress();
  }

  // ================================================================
  // COMPLETION
  // ================================================================
  function checkCompletion() {
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        var cell = puzzle.grid[r][c];
        if (cell.isBlack || !cell.solution) continue;
        if (cell.entry !== cell.solution) return;
      }
    }
    state.completed = true;
    stopTimer();
    var banner = container.querySelector('.xw-completion-banner');
    if (banner) banner.removeAttribute('hidden');
    saveProgress();
  }

  // ================================================================
  // PAUSE / FULLSCREEN / PRINT
  // ================================================================
  function togglePause() {
    if (state.completed) return;
    state.paused = !state.paused;
    var widget  = getWidget();
    var overlay = widget && widget.querySelector('.xw-pause-overlay');
    var btn     = widget && widget.querySelector('.xw-pause-btn');

    if (state.paused) {
      stopTimer();
      if (overlay) overlay.removeAttribute('hidden');
      if (btn)     btn.textContent = '▶';
      widget.classList.add('xw-paused');
    } else {
      if (overlay) overlay.setAttribute('hidden', '');
      if (btn)     btn.textContent = '⏸';
      widget.classList.remove('xw-paused');
      startTimer();
    }
  }

  function showNotes() {
    var widget   = getWidget();
    var backdrop = widget && widget.querySelector('.xw-notes-backdrop');
    if (backdrop) backdrop.removeAttribute('hidden');
  }

  function toggleFullscreen() {
    var widget = getWidget();
    if (!widget) return;
    if (!document.fullscreenElement) {
      (widget.requestFullscreen || widget.webkitRequestFullscreen || function () {}).call(widget);
    } else {
      (document.exitFullscreen || document.webkitExitFullscreen || function () {}).call(document);
    }
  }

  function printPDF() {
    var widget = getWidget();
    if (!widget) { window.print(); return; }

    // Walk from the widget up to <body>, temporarily hiding every sibling of
    // each ancestor.  This isolates just the widget in the printed output
    // without any knowledge of the surrounding page structure (post header,
    // archive list, nav, footer, etc. all disappear automatically).
    var hidden = [];
    var node = widget;
    while (node && node !== document.body) {
      var parent = node.parentElement;
      if (!parent) break;
      Array.from(parent.children).forEach(function (sib) {
        if (sib !== node) {
          sib.style.setProperty('display', 'none', 'important');
          hidden.push(sib);
        }
      });
      node = parent;
    }

    function restore() {
      // splice(0) drains the array so double-calls (afterprint + setTimeout) are safe
      hidden.splice(0).forEach(function (el) {
        el.style.removeProperty('display');
      });
    }

    window.addEventListener('afterprint', function onAfter() {
      window.removeEventListener('afterprint', onAfter);
      restore();
    });
    // Fallback in case afterprint doesn't fire (print cancelled silently, etc.)
    setTimeout(restore, 30000);

    window.print();
  }

  // ================================================================
  // TIMER
  // ================================================================
  function startTimer() {
    if (state.timer.running || state.completed || state.paused) return;
    state.timer.running    = true;
    state.timer.intervalId = setInterval(function () {
      state.timer.elapsed++;
      updateTimerDisplay();
    }, 1000);
  }

  function stopTimer() {
    state.timer.running = false;
    if (state.timer.intervalId) {
      clearInterval(state.timer.intervalId);
      state.timer.intervalId = null;
    }
  }

  function updateTimerDisplay() {
    var el = container && container.querySelector('.xw-timer');
    if (el) el.textContent = formatTime(state.timer.elapsed);
  }

  function formatTime(secs) {
    var m = Math.floor(secs / 60);
    var s = secs % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // ================================================================
  // PERSISTENCE
  // ================================================================
  function saveProgress() {
    if (!puzzleNumber) return;
    var entries  = [];
    var revealed = [];
    var checked  = [];

    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        var cell = puzzle.grid[r][c];
        var i    = r * puzzle.width + c;
        entries.push(cell.entry || '');
        if (cell.revealed) revealed.push(i);
        if (cell.checked)  checked.push({ i: i, v: cell.checked });
      }
    }

    var data = {
      entries:   entries,
      revealed:  revealed,
      checked:   checked,
      timer:     state.timer.elapsed,
      completed: state.completed
    };
    try {
      localStorage.setItem(STORAGE_PREFIX + puzzleNumber, JSON.stringify(data));
    } catch (e) { /* storage unavailable */ }
  }

  function loadProgress() {
    if (!puzzleNumber) return;
    var raw;
    try { raw = localStorage.getItem(STORAGE_PREFIX + puzzleNumber); } catch (e) {}
    if (!raw) return;
    var data;
    try { data = JSON.parse(raw); } catch (e) { return; }

    var idx = 0;
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        var cell = puzzle.grid[r][c];
        var i    = r * puzzle.width + c;
        cell.entry    = (data.entries && data.entries[idx]) || '';
        cell.revealed = !!(data.revealed && data.revealed.indexOf(i) >= 0);
        cell.checked  = null;
        if (data.checked) {
          var found = null;
          for (var k = 0; k < data.checked.length; k++) {
            if (data.checked[k].i === i) { found = data.checked[k].v; break; }
          }
          cell.checked = found;
        }
        idx++;
      }
    }

    state.timer.elapsed = data.timer     || 0;
    state.completed     = data.completed || false;

    updateTimerDisplay();
    updateAllCells();
    updateClueDoneStates();

    if (state.completed) {
      var banner = container.querySelector('.xw-completion-banner');
      if (banner) banner.removeAttribute('hidden');
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(state.settings));
    } catch (e) {}
  }

  function loadSettings() {
    var raw;
    try { raw = localStorage.getItem(STORAGE_SETTINGS); } catch (e) {}
    if (!raw) return;
    try {
      var saved = JSON.parse(raw);
      Object.keys(saved).forEach(function (k) {
        if (k in state.settings) state.settings[k] = saved[k];
      });
    } catch (e) {}
  }

  // ================================================================
  // ENTRY POINT
  // ================================================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose internals for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseIPuz: parseIPuz, buildWordList: buildWordList, parseSeparators: parseSeparators };
  }

})();
