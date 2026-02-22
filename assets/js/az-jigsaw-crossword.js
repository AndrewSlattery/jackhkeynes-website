// az-jigsaw-crossword.js — A-Z Jigsaw crossword widget driven by an .ipuz file
// Usage: <div id="az-jigsaw-embed" data-puzzle-number="245"></div>
//
// Adapted from crossword.js. Key differences from a standard crossword:
//  1. Clues and grid cells are *not* linked — clicking a clue does not
//     highlight grid cells, and navigating the grid does not highlight clues.
//  2. Clue numbers are hidden; the solver must deduce which grid entry each
//     clue corresponds to.
//  3. Each clue has a "scratchpad" text-input for drafting an answer before
//     the solver knows where it goes in the grid.
//  4. An A-Z bar sits above the grid and greys out each letter once it
//     appears as the first letter of any scratchpad entry or any filled
//     grid-word start cell.

(function () {
  'use strict';

  // ================================================================
  // CONSTANTS
  // ================================================================
  var STORAGE_PREFIX   = 'xw-azprog-';
  var STORAGE_SETTINGS = 'xw-settings';

  // ================================================================
  // MODULE STATE
  // ================================================================
  var puzzle      = null;   // parsed puzzle object
  var words       = [];     // flat sorted word list
  var wordMap     = {};     // "42_across" → word
  var cellWordMap = [];     // [r][c] → {across: word|null, down: word|null}

  var puzzleNumber     = null;
  var container        = null;
  var hiddenInput      = null;
  var trackLastLetter  = false;  // true for Z-A jigsaws (last letter) vs A-Z (first letter)

  var state = {
    cursor:    { row: 0, col: 0 },
    direction: 'across',
    focused:   false,
    completed: false,
    paused:    false,
    scratchpad: {},   // "num_dir" → uppercase string
    highlightedClue: null,  // { num, dir } when a clue list row is selected
    timer: {
      running:    false,
      elapsed:    0,
      intervalId: null
    },
    settings: {
      lightMode:    false,
      skipFilled:   false,
      autoNextWord: true
    }
  };

  // ================================================================
  // INIT
  // ================================================================
  function init() {
    container = document.getElementById('az-jigsaw-embed');
    if (!container) return;

    puzzleNumber    = container.getAttribute('data-puzzle-number');
    if (!puzzleNumber) return;
    trackLastLetter = container.getAttribute('data-letter-end') === 'true';

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
        updateAZBar();
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

    (puz.clues.Across || []).forEach(function (clueData) {
      var start = findCellByNumber(clueData.number);
      if (!start) return;
      var cells = [];
      for (var c = start.col; c < width && !grid[start.row][c].isBlack; c++) {
        cells.push({ row: start.row, col: c });
      }
      if (cells.length < 2) return;
      result.push({
        number:        clueData.number,
        label:         clueData.label ? String(clueData.label) : null,
        continued:     clueData.continued || null,
        continuations: null,
        direction:     'across',
        cells:         cells,
        clue:          clueData.clue        || '',
        enumeration:   clueData.enumeration || '',
        separators:    parseSeparators(clueData.enumeration || '')
      });
    });

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

    // Build continuation stubs for linked clues
    var coveredKeys = {};
    result.forEach(function (w) { coveredKeys[w.number + '_' + w.direction] = true; });

    var stubs = [];
    result.forEach(function (primaryWord) {
      if (!primaryWord.continued) return;
      primaryWord.continuations = [];
      primaryWord.continued.forEach(function (cont) {
        var contDir = cont.direction.toLowerCase();
        var contNum = parseInt(cont.number, 10);
        if (coveredKeys[contNum + '_' + contDir]) return;
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
          number:         contNum,
          label:          null,
          continued:      null,
          continuations:  null,
          isContinuation: true,
          primaryWord:    primaryWord,
          direction:      contDir,
          cells:          cells,
          clue:           '',
          enumeration:    '',
          separators:     []
        };
        primaryWord.continuations.push(stub);
        stubs.push(stub);
      });
    });

    stubs.forEach(function (stub) {
      var idx = result.indexOf(stub.primaryWord);
      while (idx + 1 < result.length && result[idx + 1].isContinuation &&
             result[idx + 1].primaryWord === stub.primaryWord) idx++;
      result.splice(idx + 1, 0, stub);
    });

    return result;
  }

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
    widget.className = 'xw-widget xw-jigsaw' + (state.settings.lightMode ? ' xw-light' : '');
    widget.style.setProperty('--xw-cols', puzzle.width);
    widget.style.setProperty('--xw-rows', puzzle.height);
    widget.setAttribute('tabindex', '0');

    widget.innerHTML = [
      renderHiddenInput(),
      puzzle.notes ? renderNotesModal(puzzle.notes) : '',
      '<div class="xw-controls-bar">',
        renderControls(),
      '</div>',
      '<div class="xw-clue-az-row">',
        '<div class="xw-active-clue-bar">',
          '<span class="xw-acb-label"></span>',
          '<span class="xw-acb-clue"></span>',
        '</div>',
        '<div class="xw-az-bar" aria-label="' + (trackLastLetter ? 'Z to A' : 'A to Z') + ' tracker">',
          renderAZBar(),
        '</div>',
      '</div>',
      '<div class="xw-body">',
        '<div class="xw-pause-overlay" hidden>',
          '<span class="xw-pause-message">⏸ Paused — click to resume</span>',
        '</div>',
        '<div class="xw-grid-wrap">',
          renderGrid(),
        '</div>',
        '<div class="xw-clue-panel">',
          renderAllClues(),
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

  function renderAZBar() {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (l) {
      return '<span class="xw-az-letter" data-letter="' + l + '" title="' + l + '">' + l + '</span>';
    }).join('');
  }

  function renderNotesModal(notes) {
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
      { label: 'Letter',     action: 'clear-cell'       },
      { label: 'Word',       action: 'clear-word'       },
      { label: 'Grid',       action: 'clear-grid'       },
      { label: 'Scratchpad', action: 'clear-scratchpad' }
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

    var pauseBtn = '<button class="xw-ctrl-btn xw-pause-btn" type="button" data-action="pause" title="Pause / resume">⏸</button>';
    var fsBtn    = '<button class="xw-ctrl-btn xw-fs-btn"    type="button" data-action="fullscreen" title="Fullscreen">⛶</button>';
    var pdfBtn   = '<button class="xw-ctrl-btn"              type="button" data-action="print" title="Save as PDF">PDF</button>';
    var notesBtn = puzzle.notes
      ? '<button class="xw-ctrl-btn" type="button" data-action="notes" title="Puzzle notes">ℹ</button>'
      : '';
    var timer    = '<div class="xw-timer-group"><div class="xw-timer" role="timer" aria-label="Time elapsed">0:00</div>' + pauseBtn + '</div>';

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

  function fmtEnum(enumStr) {
    return enumStr.replace(/ /g, ',');
  }

  // Returns all non-continuation words sorted by total length then alphabetically by clue text.
  // Sorting by length first groups clues of the same answer length, which obfuscates the
  // grid position more effectively than the default number order.
  function getSortedDisplayClues() {
    var clues = words.filter(function (w) { return !w.isContinuation; });
    clues.sort(function (a, b) {
      var aLen = getAllWordCells(a).length;
      var bLen = getAllWordCells(b).length;
      if (aLen !== bLen) return aLen - bLen;
      var aAns = getAllWordCells(a).map(function (wc) { return puzzle.grid[wc.row][wc.col].solution || ''; }).join('').toLowerCase();
      var bAns = getAllWordCells(b).map(function (wc) { return puzzle.grid[wc.row][wc.col].solution || ''; }).join('').toLowerCase();
      if (trackLastLetter) { aAns = aAns.split('').reverse().join(''); bAns = bAns.split('').reverse().join(''); }
      return aAns.localeCompare(bAns);
    });
    return clues;
  }

  // Renders all clues as a single section sorted by length then alphabetically.
  // Each row has the clue text on the left and a scratchpad input on the right.
  function renderAllClues() {
    var sortedClues = getSortedDisplayClues();
    var items = sortedClues.map(function (w) {
      var enumStr = (puzzle.showEnumerations && w.enumeration)
        ? ' <span class="xw-clue-enum">(' + fmtEnum(w.enumeration) + ')</span>'
        : '';
      var key   = w.number + '_' + w.direction;
      var spVal = escapeAttr(state.scratchpad[key] || '');
      return '<div class="xw-clue" data-num="' + w.number + '" data-dir="' + w.direction + '">' +
        '<span class="xw-clue-text">' + w.clue + enumStr + '</span>' +
        '<input class="xw-scratchpad" type="text"' +
          ' autocomplete="off" autocorrect="off" autocapitalize="characters" spellcheck="false"' +
          ' data-sp-num="' + w.number + '" data-sp-dir="' + w.direction + '"' +
          ' placeholder="Answer…" value="' + spVal + '" aria-label="Scratchpad">' +
      '</div>';
    }).join('');
    return '<div class="xw-clue-section">' +
      '<div class="xw-clue-section-title">Clues</div>' +
      '<div class="xw-clue-list">' + items + '</div>' +
    '</div>';
  }

  function escapeAttr(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Apply word-separator CSS classes after the grid is in the DOM
  function applySeparators() {
    words.forEach(function (word) {
      var isLinkedPrimary = !!(word.continuations && word.continuations.length);
      word.separators.forEach(function (sep) {
        var idx = sep.after - 1;
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
  // A-Z BAR
  // ================================================================
  function updateAZBar() {
    var used = {};

    // Track first or last letter of each scratchpad entry
    Object.keys(state.scratchpad).forEach(function (key) {
      var letters = (state.scratchpad[key] || '').replace(/[^A-Z]/g, '');
      if (letters) used[trackLastLetter ? letters[letters.length - 1] : letters[0]] = true;
    });

    container.querySelectorAll('.xw-az-letter').forEach(function (el) {
      el.classList.toggle('xw-az-used', !!used[el.getAttribute('data-letter')]);
    });

    updateClueDoneStates();
  }

  // Grey out a clue row when its scratchpad answer matches any fully-filled grid word.
  // Matching against *any* position (not the clue's own grid position) means filling
  // a cell can't be used to probe which clue belongs to which grid slot.
  // Non-letter characters (hyphens, spaces) are stripped from scratchpad values before comparing.
  function updateClueDoneStates() {
    // Step 1: collect all fully-filled grid word entries into a lookup set.
    var placedEntries = {};
    words.forEach(function (v) {
      if (v.isContinuation) return;
      var cells = getAllWordCells(v);
      var allFilled = cells.every(function (wc) { return !!puzzle.grid[wc.row][wc.col].entry; });
      if (!allFilled) return;
      var entry = cells.map(function (wc) { return puzzle.grid[wc.row][wc.col].entry; }).join('');
      placedEntries[entry] = true;
    });

    // Step 2: grey out each clue whose scratchpad answer appears anywhere in that set.
    words.forEach(function (w) {
      if (w.isContinuation) return;
      var key       = w.number + '_' + w.direction;
      var spLetters = (state.scratchpad[key] || '').replace(/[^A-Z]/g, '');
      var isDone    = spLetters.length > 0 && !!placedEntries[spLetters];
      var clueEl    = container.querySelector(
        '.xw-clue[data-num="' + w.number + '"][data-dir="' + w.direction + '"]'
      );
      if (clueEl) clueEl.classList.toggle('xw-clue-done', isDone);
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

  function updateCellDisplay(r, c) {
    var el   = getCellEl(r, c);
    if (!el) return;
    var cell = puzzle.grid[r][c];
    if (cell.isBlack) return;

    var letterEl = el.querySelector('.xw-letter');
    if (letterEl) letterEl.textContent = cell.entry || '';

    el.classList.remove('xw-correct', 'xw-incorrect', 'xw-revealed');
    if      (cell.revealed)                el.classList.add('xw-revealed');
    else if (cell.checked === 'correct')   el.classList.add('xw-correct');
    else if (cell.checked === 'incorrect') el.classList.add('xw-incorrect');
  }

  function updateAllCells() {
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        if (!puzzle.grid[r][c].isBlack) updateCellDisplay(r, c);
      }
    }
  }

  // ================================================================
  // SELECTION & NAVIGATION
  // ================================================================
  function selectCell(r, c, preferredDir, silent) {
    var cell = puzzle.grid[r][c];
    if (!cell || cell.isBlack) return;

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

    // Highlight word cells in the grid only — no clue-panel highlighting
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

    // Intentionally NOT highlighting any clue in the clue panel

    updateActiveClueBar();
    if (hiddenInput && document.activeElement !== hiddenInput) {
      hiddenInput.focus({ preventScroll: true });
    }
  }

  function getDisplayWord(word) {
    return (word && word.isContinuation) ? word.primaryWord : word;
  }

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

  function clearClueHighlights() {
    container.querySelectorAll('.xw-clue.xw-clue-active').forEach(function (el) {
      el.classList.remove('xw-clue-active');
    });
  }

  // In jigsaw mode the active-clue bar shows only the length/enumeration of the
  // currently selected grid entry, not the clue text (which is unknown until the
  // solver has matched it up).
  function updateActiveClueBar() {
    var labelEl = container.querySelector('.xw-acb-label');
    var clueEl  = container.querySelector('.xw-acb-clue');
    if (!labelEl || !clueEl) return;

    // A highlighted clue in the list takes priority over the grid word
    if (state.highlightedClue) {
      var hcWord = wordMap[state.highlightedClue.num + '_' + state.highlightedClue.dir];
      if (hcWord) {
        labelEl.textContent = '';
        var hcEnum = (puzzle.showEnumerations && hcWord.enumeration)
          ? ' (' + fmtEnum(hcWord.enumeration) + ')'
          : '';
        clueEl.textContent = hcWord.clue + hcEnum;
        return;
      }
    }

    // Fall back to the selected grid word's enumeration
    var word = getDisplayWord(getCurrentWord());
    if (!word) { labelEl.textContent = ''; clueEl.textContent = ''; return; }

    labelEl.textContent = '?';
    var enumStr = (puzzle.showEnumerations && word.enumeration)
      ? ' (' + fmtEnum(word.enumeration) + ')'
      : '';
    clueEl.textContent = enumStr;
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
      var cont   = word.continuations[0];
      var target = firstEmptyInWord(cont) || cont.cells[0];
      selectCell(target.row, target.col, cont.direction);
    } else if (state.settings.autoNextWord) {
      jumpToNextWord();
    }
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
      if (next.isContinuation) continue;
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
      if (prev.isContinuation) continue;
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
      // Cell click — navigate the grid as normal
      var cellEl = e.target.closest('.xw-cell:not(.xw-black)');
      if (cellEl) {
        var r = parseInt(cellEl.dataset.r, 10);
        var c = parseInt(cellEl.dataset.c, 10);
        if (state.cursor.row === r && state.cursor.col === c) {
          var other = (state.direction === 'across') ? 'down' : 'across';
          if (cellWordMap[r][c][other]) selectCell(r, c, other);
        } else {
          selectCell(r, c);
        }
        return;
      }

      // Clue click — jigsaw mode: toggle highlight on the clue row.
      // Clicks directly on the scratchpad input pass through naturally.
      var clueEl = e.target.closest('.xw-clue');
      if (clueEl) {
        if (e.target.closest('.xw-scratchpad')) return;
        var num = parseInt(clueEl.dataset.num, 10);
        var dir = clueEl.dataset.dir;
        if (state.highlightedClue &&
            state.highlightedClue.num === num &&
            state.highlightedClue.dir === dir) {
          state.highlightedClue = null;
          clearClueHighlights();
        } else {
          state.highlightedClue = { num: num, dir: dir };
          clearClueHighlights();
          clueEl.classList.add('xw-clue-active');
        }
        updateActiveClueBar();
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

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.xw-dd-group')) closeAllDropdowns(widget);
    });

    // Notes modal close
    widget.addEventListener('click', function (e) {
      var backdrop = e.target.closest('.xw-notes-backdrop');
      if (!backdrop) return;
      if (e.target.classList.contains('xw-notes-close') ||
          e.target.classList.contains('xw-notes-backdrop')) {
        backdrop.setAttribute('hidden', '');
      }
    });

    // Pause overlay
    widget.addEventListener('click', function (e) {
      if (e.target.closest('.xw-pause-overlay')) togglePause();
    });

    // Fullscreen button icon update
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

    // ---- Scratchpad inputs ----
    // Uppercase the text and update the A-Z bar on each keystroke.
    widget.addEventListener('input', function (e) {
      var sp = e.target.closest('.xw-scratchpad');
      if (!sp) return;
      if (!state.timer.running && !state.completed) startTimer();
      var val = sp.value.toUpperCase().replace(/[^A-Z\-' ]/g, '');
      sp.value = val;
      var key = sp.dataset.spNum + '_' + sp.dataset.spDir;
      state.scratchpad[key] = val;
      updateAZBar();
      saveProgress();
    });

    // Stop scratchpad keystrokes from reaching the grid's hidden-input handler
    widget.addEventListener('keydown', function (e) {
      if (e.target.closest('.xw-scratchpad')) {
        e.stopPropagation();
      }
    }, true);

    // Focusing a scratchpad field highlights its clue row and updates the clue bar.
    widget.addEventListener('focusin', function (e) {
      var sp = e.target.closest('.xw-scratchpad');
      if (!sp) return;
      var clueEl = sp.closest('.xw-clue');
      if (!clueEl) return;
      var num = parseInt(clueEl.dataset.num, 10);
      var dir = clueEl.dataset.dir;
      if (state.highlightedClue && state.highlightedClue.num === num && state.highlightedClue.dir === dir) return;
      state.highlightedClue = { num: num, dir: dir };
      clearClueHighlights();
      clueEl.classList.add('xw-clue-active');
      updateActiveClueBar();
    });

    // ---- Keyboard via hidden input (grid navigation) ----
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
      });

      hiddenInput.addEventListener('input', function () {
        if (!state.focused) return;
        var val = hiddenInput.value;
        hiddenInput.value = '';
        if (!val) return;
        var ch = val.slice(-1).toUpperCase();
        if (/^[A-Z]$/.test(ch)) handleLetter(ch);
      });

      hiddenInput.addEventListener('focus', function () { state.focused = true; });
      hiddenInput.addEventListener('blur',  function (e) {
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

    if (newDir === state.direction) {
      var word = getCurrentWord();
      var idx  = getCurrentWordCellIndex();
      if (word && idx >= 0) {
        var dw    = getDisplayWord(word);
        var parts = [dw].concat(dw.continuations || []);
        var pIdx  = parts.indexOf(word);

        if ((dc > 0 || dr > 0) && idx === word.cells.length - 1 && pIdx < parts.length - 1) {
          var next = parts[pIdx + 1];
          selectCell(next.cells[0].row, next.cells[0].col, next.direction);
          return;
        }

        if ((dc < 0 || dr < 0) && idx === 0 && pIdx > 0) {
          var prev     = parts[pIdx - 1];
          var lastCell = prev.cells[prev.cells.length - 1];
          selectCell(lastCell.row, lastCell.col, prev.direction);
          return;
        }
      }
    }

    var nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < puzzle.height && nc >= 0 && nc < puzzle.width) {
      if (!puzzle.grid[nr][nc].isBlack) {
        selectCell(nr, nc, newDir);
        return;
      }
      nr += dr;
      nc += dc;
    }
  }

  function handleLetter(ch) {
    var r    = state.cursor.row, c = state.cursor.col;
    var cell = puzzle.grid[r][c];
    if (cell.revealed) { advanceCursor(); return; }

    cell.entry   = ch;
    cell.checked = null;
    updateCellDisplay(r, c);
    updateAZBar();
    saveProgress();
    checkCompletion();
    advanceCursor();
  }

  function handleBackspace() {
    var r    = state.cursor.row, c = state.cursor.col;
    var cell = puzzle.grid[r][c];

    if (getCurrentWordCellIndex() === 0) {
      if (!cell.revealed && cell.entry) {
        cell.entry   = '';
        cell.checked = null;
        updateCellDisplay(r, c);
        updateAZBar();
        saveProgress();
      } else {
        jumpToPrevWord();
      }
      return;
    }

    if (!cell.revealed && cell.entry) {
      cell.entry   = '';
      cell.checked = null;
      updateCellDisplay(r, c);
      updateAZBar();
      saveProgress();
    } else {
      retreatCursor();
      var nr  = state.cursor.row, nc = state.cursor.col;
      var nc2 = puzzle.grid[nr][nc];
      if (!nc2.revealed) {
        nc2.entry   = '';
        nc2.checked = null;
        updateCellDisplay(nr, nc);
        updateAZBar();
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
    updateAZBar();
    saveProgress();
  }

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
      case 'check-cell':       checkCells([state.cursor]);         break;
      case 'check-word':       checkCells(getCurrentWordCells());  break;
      case 'check-grid':       checkCells(getAllCells());           break;
      case 'reveal-cell':      revealCells([state.cursor]);        break;
      case 'reveal-word':      revealCells(getCurrentWordCells()); break;
      case 'reveal-grid':      revealCells(getAllCells());          break;
      case 'clear-cell':       clearCells([state.cursor]);         break;
      case 'clear-word':       clearCells(getCurrentWordCells());  break;
      case 'clear-grid':       clearCells(getAllCells());           break;
      case 'clear-scratchpad': clearScratchpad();                  break;
      case 'pause':            togglePause();                      break;
      case 'fullscreen':       toggleFullscreen();                 break;
      case 'print':            printPDF();                         break;
      case 'notes':            showNotes();                        break;
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
    updateAZBar();
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
    updateAZBar();
    saveProgress();
  }

  function clearScratchpad() {
    state.scratchpad = {};
    container.querySelectorAll('.xw-scratchpad').forEach(function (inp) {
      inp.value = '';
    });
    updateAZBar();
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
      hidden.splice(0).forEach(function (el) {
        el.style.removeProperty('display');
      });
    }

    window.addEventListener('afterprint', function onAfter() {
      window.removeEventListener('afterprint', onAfter);
      restore();
    });
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
      entries:    entries,
      revealed:   revealed,
      checked:    checked,
      timer:      state.timer.elapsed,
      completed:  state.completed,
      scratchpad: state.scratchpad
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

    // Restore grid entries
    var idx = 0;
    for (var r = 0; r < puzzle.height; r++) {
      for (var c = 0; c < puzzle.width; c++) {
        var cell = puzzle.grid[r][c];
        var i    = r * puzzle.width + c;
        cell.entry    = (data.entries && data.entries[idx]) || '';
        cell.revealed = !!(data.revealed && data.revealed.indexOf(i) >= 0);
        cell.checked  = null;
        if (data.checked) {
          for (var k = 0; k < data.checked.length; k++) {
            if (data.checked[k].i === i) { cell.checked = data.checked[k].v; break; }
          }
        }
        idx++;
      }
    }

    // Restore scratchpad
    if (data.scratchpad && typeof data.scratchpad === 'object') {
      state.scratchpad = {};
      Object.keys(data.scratchpad).forEach(function (key) {
        state.scratchpad[key] = data.scratchpad[key];
      });
      // Populate the DOM inputs
      Object.keys(state.scratchpad).forEach(function (key) {
        var parts = key.split('_');
        var num = parts[0], dir = parts[1];
        var inp = container.querySelector(
          '.xw-scratchpad[data-sp-num="' + num + '"][data-sp-dir="' + dir + '"]'
        );
        if (inp) inp.value = state.scratchpad[key];
      });
    }

    state.timer.elapsed = data.timer     || 0;
    state.completed     = data.completed || false;

    updateTimerDisplay();
    updateAllCells();
    updateAZBar();

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

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { parseIPuz: parseIPuz, buildWordList: buildWordList, parseSeparators: parseSeparators };
  }

})();
