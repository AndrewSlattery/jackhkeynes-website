// spiral-puzzle.js — interactive spiral crossword widget
// Usage: <div id="spiral-puzzle-embed" data-spiral-puzzle-number="1"></div>
//
// Spiral puzzles have "Inward" and "Outward" clue sets, each with an explicit
// ordered list of cell coordinates (not simple row/column runs). Every cell is
// covered by exactly one Inward and one Outward clue, so direction toggling
// (Space key / same-cell click) is always valid. Shares _crossword.scss with
// the other widget types; the barred-grid CSS classes (xw-bar-*) handle bars.

(function () {
  'use strict';

  // ================================================================
  // CONSTANTS
  // ================================================================
  var STORAGE_PREFIX   = 'xw-spiral-';
  var STORAGE_SETTINGS = 'xw-settings';  // shared with other widgets

  // ================================================================
  // MODULE STATE
  // ================================================================
  var puzzle      = null;   // parsed puzzle object
  var words       = [];     // flat word list: Inward words first, then Outward
  var wordMap     = {};     // "1-5_inward" → word (O(1) lookup)
  var cellWordMap = [];     // [r][c] → { inward: word|null, outward: word|null }

  var puzzleNumber = null;
  var container    = null;
  var hiddenInput  = null;

  var state = {
    cursor:    { row: 0, col: 0 },
    direction: 'inward',    // 'inward' | 'outward'
    focused:   false,
    completed: false,
    paused:    false,
    timer: {
      running:    false,
      elapsed:    0,
      intervalId: null
    },
    settings: {
      lightMode:    false,
      skipFilled:   true,
      autoNextWord: true
    }
  };

  // ================================================================
  // INIT
  // ================================================================
  function init() {
    container = document.getElementById('spiral-puzzle-embed');
    if (!container) return;

    puzzleNumber = container.getAttribute('data-spiral-puzzle-number');
    if (!puzzleNumber) return;

    loadSettings();

    // Files are named "Spiral N.ipuz"; the front-matter field is just the number.
    var url = '/assets/ipuz/' + encodeURIComponent('Spiral ' + puzzleNumber) + '.ipuz';
    fetch(url)
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (data) {
        puzzle = parseIPuz(data);
        words  = buildWordList(data);
        buildCellWordMap();
        render();
        loadProgress();
        // Position cursor at the first unfilled cell of the first Inward word
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
  // IPUZ PARSER — spiral variant
  // ================================================================
  // Cells in the spiral .ipuz are either plain number strings ("10") or objects
  // { cell: "1", style: { barred: "B" } } where the number is the spiral
  // position (1–100) and barred encodes which edges carry a bar.
  function parseIPuz(data) {
    var width  = data.dimensions.width;
    var height = data.dimensions.height;

    var grid = [];
    for (var r = 0; r < height; r++) {
      grid[r] = [];
      for (var c = 0; c < width; c++) {
        var raw    = data.puzzle[r][c];
        var rawSol = data.solution ? data.solution[r][c] : null;

        var spiralNum, barStr;
        if (typeof raw === 'object' && raw !== null) {
          spiralNum = parseInt(String(raw.cell), 10);
          barStr    = (raw.style && raw.style.barred) ? String(raw.style.barred) : '';
        } else {
          spiralNum = parseInt(String(raw), 10);
          barStr    = '';
        }

        var solution = null;
        if (rawSol && typeof rawSol === 'object' && rawSol.value) {
          solution = rawSol.value.toUpperCase();
        } else if (typeof rawSol === 'string') {
          solution = rawSol.toUpperCase();
        }

        // barStr characters: T = top bar, L = left bar, R = right bar, B = bottom bar
        grid[r][c] = {
          row:       r,
          col:       c,
          spiralNum: spiralNum,
          showNum:   false,     // set true by buildWordList for clue-start cells
          bars: {
            top:    barStr.indexOf('T') >= 0,
            left:   barStr.indexOf('L') >= 0,
            right:  barStr.indexOf('R') >= 0,
            bottom: barStr.indexOf('B') >= 0
          },
          solution: solution,
          entry:    '',
          revealed: false,
          checked:  null   // null | 'correct' | 'incorrect'
        };
      }
    }

    // Propagate bars bidirectionally so both sides of every boundary are consistent.
    for (var r2 = 0; r2 < height; r2++) {
      for (var c2 = 0; c2 < width; c2++) {
        var cell = grid[r2][c2];
        if (c2 + 1 < width) {
          var hasHBar = cell.bars.right || grid[r2][c2 + 1].bars.left;
          cell.bars.right              = hasHBar;
          grid[r2][c2 + 1].bars.left   = hasHBar;
        }
        if (r2 + 1 < height) {
          var hasVBar = cell.bars.bottom || grid[r2 + 1][c2].bars.top;
          cell.bars.bottom             = hasVBar;
          grid[r2 + 1][c2].bars.top    = hasVBar;
        }
      }
    }

    return {
      width:  width,
      height: height,
      grid:   grid,
      clues:  data.clues || {},
      title:  data.title  || '',
      author: data.author || '',
      notes:  data.notes  || ''
    };
  }

  // ================================================================
  // WORD LIST BUILDER — driven by explicit cell lists in clue data
  // ================================================================
  // Unlike blocked/barred grids, spiral clues each carry a `cells` array
  // of [col, row] pairs (1-indexed) that trace the exact path through the grid.
  function buildWordList(data) {
    var result = [];

    ['Inward', 'Outward'].forEach(function (dirTitle) {
      var dir      = dirTitle.toLowerCase();   // 'inward' | 'outward'
      var clueList = (data.clues && data.clues[dirTitle]) || [];

      clueList.forEach(function (clueData) {
        // Convert [col, row] 1-indexed pairs to { row, col } 0-indexed objects
        var cellRefs = (clueData.cells || []).map(function (pair) {
          return { row: pair[1] - 1, col: pair[0] - 1 };
        });
        if (cellRefs.length === 0) return;

        // Mark the first cell of this clue so a number is shown in the grid
        var first = cellRefs[0];
        puzzle.grid[first.row][first.col].showNum = true;

        var word = {
          number:      String(clueData.number),
          label:       String(clueData.number),
          direction:   dir,
          cells:       cellRefs,
          clue:        clueData.clue        || '',
          enumeration: clueData.enumeration || ''
        };

        result.push(word);
        wordMap[word.number + '_' + dir] = word;
      });
    });

    return result;
  }

  function buildCellWordMap() {
    cellWordMap = [];
    for (var r = 0; r < puzzle.height; r++) {
      cellWordMap[r] = [];
      for (var c = 0; c < puzzle.width; c++) {
        cellWordMap[r][c] = { inward: null, outward: null };
      }
    }
    words.forEach(function (word) {
      word.cells.forEach(function (wc) {
        cellWordMap[wc.row][wc.col][word.direction] = word;
      });
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
          renderClueSection('Inward'),
          renderClueSection('Outward'),
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

  function renderHiddenInput() {
    return '<input class="xw-hidden-input" type="text" ' +
      'autocomplete="off" autocorrect="off" autocapitalize="characters" ' +
      'spellcheck="false" aria-hidden="true">';
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

    var checkDd  = dropdown('Check',  [
      { label: 'Letter', action: 'check-cell'  },
      { label: 'Word',   action: 'check-word'  },
      { label: 'Grid',   action: 'check-grid'  }
    ]);
    var revealDd = dropdown('Reveal', [
      { label: 'Letter', action: 'reveal-cell' },
      { label: 'Word',   action: 'reveal-word' },
      { label: 'Grid',   action: 'reveal-grid' }
    ]);
    var clearDd  = dropdown('Clear',  [
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

    var pauseBtn = '<button class="xw-ctrl-btn xw-pause-btn" type="button" data-action="pause" title="Pause / resume">⏸</button>';
    var fsBtn    = '<button class="xw-ctrl-btn xw-fs-btn"    type="button" data-action="fullscreen" title="Fullscreen">⛶</button>';
    var pdfBtn   = '<button class="xw-ctrl-btn"              type="button" data-action="print" title="Save as PDF">PDF</button>';
    var notesBtn = puzzle.notes
      ? '<button class="xw-ctrl-btn" type="button" data-action="notes" title="Puzzle notes">ℹ</button>'
      : '';
    var timer = '<div class="xw-timer-group"><div class="xw-timer" role="timer" aria-label="Time elapsed">0:00</div>' + pauseBtn + '</div>';

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
    // Spiral grids are always rectangular — do NOT add xw-barred (which removes
    // the outer border). The inner bars use xw-bar-* classes as in barred grids.
    return '<div class="xw-grid" role="grid">' + rows.join('') + '</div>';
  }

  function renderCell(r, c) {
    var cell    = puzzle.grid[r][c];
    var classes = 'xw-cell';

    if (cell.bars.top)    classes += ' xw-bar-top';
    if (cell.bars.left)   classes += ' xw-bar-left';
    if (cell.bars.right)  classes += ' xw-bar-right';
    if (cell.bars.bottom) classes += ' xw-bar-bottom';

    var numSpan   = cell.showNum
      ? '<span class="xw-num" aria-hidden="true">' + cell.spiralNum + '</span>'
      : '';
    var ariaLabel = (cell.showNum ? cell.spiralNum + ' ' : '') +
                    'row ' + (r + 1) + ' column ' + (c + 1);

    return '<div class="' + classes + '" data-r="' + r + '" data-c="' + c + '"' +
           ' role="gridcell" aria-label="' + ariaLabel + '">' +
      numSpan +
      '<span class="xw-letter" aria-hidden="true"></span>' +
    '</div>';
  }

  function renderClueSection(dirTitle) {
    var dir   = dirTitle.toLowerCase();
    var items = words
      .filter(function (w) { return w.direction === dir; })
      .map(function (word) {
        return '<div class="xw-clue" data-num="' + word.number + '" data-dir="' + dir + '">' +
          '<span class="xw-clue-num">' + word.label + '</span>' +
          '<span class="xw-clue-text">' + word.clue + '</span>' +
        '</div>';
      }).join('');
    return '<div class="xw-clue-section">' +
      '<div class="xw-clue-section-title">' + dirTitle + '</div>' +
      '<div class="xw-clue-list">' + items + '</div>' +
    '</div>';
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
    return container.querySelector('.xw-clue[data-num="' + num + '"][data-dir="' + dir + '"]');
  }

  function updateCellDisplay(r, c) {
    var el   = getCellEl(r, c);
    if (!el) return;
    var cell = puzzle.grid[r][c];

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
        updateCellDisplay(r, c);
      }
    }
  }

  // Dim clues whose words are fully filled in
  function updateClueDoneStates() {
    words.forEach(function (word) {
      var done = word.cells.every(function (wc) {
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
    // Resolve direction: prefer what was asked for; fall back if no clue there.
    // In a well-formed spiral every cell has both directions, but guard anyway.
    var dir = preferredDir || state.direction;
    if (!cellWordMap[r][c][dir]) {
      var other = (dir === 'inward') ? 'outward' : 'inward';
      if (cellWordMap[r][c][other]) dir = other;
    }

    clearHighlights();

    state.cursor    = { row: r, col: c };
    state.direction = dir;
    state.focused   = true;

    if (!silent && !state.timer.running && !state.completed) startTimer();

    // Highlight the entire current word
    var word = cellWordMap[r][c][dir];
    if (word) {
      word.cells.forEach(function (wc) {
        var el = getCellEl(wc.row, wc.col);
        if (el) el.classList.add('xw-highlighted');
      });
    }
    var selEl = getCellEl(r, c);
    if (selEl) selEl.classList.add('xw-selected');

    // Activate corresponding clue in the panel
    if (word) {
      container.querySelectorAll('.xw-clue.xw-clue-active').forEach(function (el) {
        el.classList.remove('xw-clue-active');
      });
      var clueEl = getClueEl(word.number, word.direction);
      if (clueEl) {
        clueEl.classList.add('xw-clue-active');
        clueEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    updateActiveClueBar();
    if (hiddenInput && document.activeElement !== hiddenInput) {
      hiddenInput.focus({ preventScroll: true });
    }
  }

  function clearHighlights() {
    container.querySelectorAll('.xw-highlighted, .xw-selected').forEach(function (el) {
      el.classList.remove('xw-highlighted', 'xw-selected');
    });
  }

  function updateActiveClueBar() {
    var word   = getCurrentWord();
    var label  = container.querySelector('.xw-acb-label');
    var clueEl = container.querySelector('.xw-acb-clue');
    if (!label || !clueEl) return;
    if (!word) { label.textContent = ''; clueEl.textContent = ''; return; }

    // Direction indicator: I for Inward, O for Outward — mirrors 42A / 42D style
    var dirChar = (word.direction === 'inward') ? 'I' : 'O';
    label.textContent = word.label + dirChar + '. ';
    clueEl.innerHTML  = word.clue;
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

  // Move cursor forward along the current clue's cell path after entering a letter
  function advanceCursor() {
    var word = getCurrentWord();
    if (!word) return;
    var idx     = getCurrentWordCellIndex();
    var nextIdx = -1;

    if (state.settings.skipFilled) {
      for (var i = idx + 1; i < word.cells.length; i++) {
        if (!puzzle.grid[word.cells[i].row][word.cells[i].col].entry) {
          nextIdx = i;
          break;
        }
      }
    } else {
      nextIdx = (idx + 1 < word.cells.length) ? idx + 1 : -1;
    }

    if (nextIdx >= 0) {
      selectCell(word.cells[nextIdx].row, word.cells[nextIdx].col, state.direction);
    } else if (state.settings.autoNextWord) {
      jumpToNextWord();
    }
    // else stay at the last cell
  }

  // Move cursor backward one step along the current clue's cell path
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
      var next   = words[(idx + i) % n];
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
      var prev   = words[(idx - i + n) % n];
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
      var cellEl = e.target.closest('.xw-cell');
      if (cellEl) {
        var r = parseInt(cellEl.dataset.r, 10);
        var c = parseInt(cellEl.dataset.c, 10);
        if (state.cursor.row === r && state.cursor.col === c) {
          // Same cell → toggle between Inward and Outward
          var other = (state.direction === 'inward') ? 'outward' : 'inward';
          if (cellWordMap[r][c][other]) selectCell(r, c, other);
        } else {
          selectCell(r, c);
        }
        return;
      }

      // Clue click
      var clueEl = e.target.closest('.xw-clue');
      if (clueEl) {
        var num  = clueEl.dataset.num;
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

      // Action button
      var actionEl = e.target.closest('[data-action]');
      if (actionEl) {
        handleAction(actionEl.dataset.action);
        closeAllDropdowns(widget);
        return;
      }
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.xw-dd-group')) closeAllDropdowns(widget);
    });

    // Notes modal: close on button or backdrop click
    widget.addEventListener('click', function (e) {
      var backdrop = e.target.closest('.xw-notes-backdrop');
      if (!backdrop) return;
      if (e.target.classList.contains('xw-notes-close') ||
          e.target.classList.contains('xw-notes-backdrop')) {
        backdrop.setAttribute('hidden', '');
      }
    });

    // Pause overlay: click resumes
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

        if (key === 'ArrowLeft' || key === 'ArrowRight' ||
            key === 'ArrowUp'   || key === 'ArrowDown') {
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
        // Letter keys handled by the `input` event (mobile-friendly)
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

  // Spatial arrow navigation: move one step in the grid direction.
  // Prefer the current clue direction at the new cell; switch if unavailable.
  function handleArrow(key) {
    var r = state.cursor.row, c = state.cursor.col;
    var dr = 0, dc = 0;

    if      (key === 'ArrowLeft')  dc = -1;
    else if (key === 'ArrowRight') dc =  1;
    else if (key === 'ArrowUp')    dr = -1;
    else if (key === 'ArrowDown')  dr =  1;

    var nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= puzzle.height || nc < 0 || nc >= puzzle.width) return;

    selectCell(nr, nc, state.direction);
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

    if (!cell.revealed && cell.entry) {
      cell.entry   = '';
      cell.checked = null;
      updateCellDisplay(r, c);
      updateClueDoneStates();
      saveProgress();
    } else {
      retreatCursor();
      var nr   = state.cursor.row, nc = state.cursor.col;
      var prev = puzzle.grid[nr][nc];
      if (!prev.revealed) {
        prev.entry   = '';
        prev.checked = null;
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

  // Space: toggle between Inward and Outward on the current cell
  function handleSpaceToggle() {
    var r     = state.cursor.row, c = state.cursor.col;
    var other = (state.direction === 'inward') ? 'outward' : 'inward';
    if (cellWordMap[r][c][other]) selectCell(r, c, other);
  }

  // ================================================================
  // SOLVING ACTIONS (Check / Reveal / Clear)
  // ================================================================
  function handleAction(action) {
    switch (action) {
      case 'check-cell':  checkCells([state.cursor]);         break;
      case 'check-word':  checkCells(getCurrentWordCells());  break;
      case 'check-grid':  checkCells(getAllCells());           break;
      case 'reveal-cell': revealCells([state.cursor]);        break;
      case 'reveal-word': revealCells(getCurrentWordCells()); break;
      case 'reveal-grid': revealCells(getAllCells());          break;
      case 'clear-cell':  clearCells([state.cursor]);         break;
      case 'clear-word':  clearCells(getCurrentWordCells());  break;
      case 'clear-grid':  clearCells(getAllCells());           break;
      case 'pause':       togglePause();                      break;
      case 'fullscreen':  toggleFullscreen();                 break;
      case 'print':       printPDF();                         break;
      case 'notes':       showNotes();                        break;
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
        cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  function checkCells(cells) {
    cells.forEach(function (pos) {
      var cell = puzzle.grid[pos.row][pos.col];
      if (!cell.entry || cell.revealed) return;
      cell.checked = (cell.entry === cell.solution) ? 'correct' : 'incorrect';
      updateCellDisplay(pos.row, pos.col);
    });
    saveProgress();
  }

  function revealCells(cells) {
    cells.forEach(function (pos) {
      var cell = puzzle.grid[pos.row][pos.col];
      if (!cell.solution) return;
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
      if (cell.revealed) return;
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
        if (!cell.solution || cell.entry !== cell.solution) return;
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
    var node   = widget;
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
      hidden.splice(0).forEach(function (el) { el.style.removeProperty('display'); });
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
          for (var k = 0; k < data.checked.length; k++) {
            if (data.checked[k].i === i) { cell.checked = data.checked[k].v; break; }
          }
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
    module.exports = { parseIPuz: parseIPuz, buildWordList: buildWordList };
  }

})();
