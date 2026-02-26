// az-jigsaw-crossword.js — A-Z Jigsaw crossword widget driven by an .ipuz file
// Usage: <div id="az-jigsaw-embed" data-puzzle-number="245"></div>
// Requires crossword-core.js to be loaded first.
//
// Key differences from a standard crossword:
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

  var fmtEnum = XwCore.fmtEnum;

  // Jigsaw-specific state
  var trackLastLetter = false;
  var scratchpad      = {};           // "num_dir" → uppercase string
  var highlightedClue = null;         // { num, dir } when a clue list row is selected
  var _engine         = null;         // set by onInit

  // ================================================================
  // JIGSAW-SPECIFIC HELPERS
  // ================================================================
  function escapeAttr(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Returns all non-continuation words sorted by total length then
  // alphabetically by answer — this obfuscates the grid position.
  function getSortedDisplayClues(engine) {
    return engine.words.filter(function (w) {
      return !w.isContinuation;
    }).sort(function (a, b) {
      var aLen = engine.getAllWordCells(a).length;
      var bLen = engine.getAllWordCells(b).length;
      if (aLen !== bLen) return aLen - bLen;
      var aAns = engine.getAllWordCells(a).map(function (wc) {
        return engine.puzzle.grid[wc.row][wc.col].solution || '';
      }).join('').toLowerCase();
      var bAns = engine.getAllWordCells(b).map(function (wc) {
        return engine.puzzle.grid[wc.row][wc.col].solution || '';
      }).join('').toLowerCase();
      if (trackLastLetter) {
        aAns = aAns.split('').reverse().join('');
        bAns = bAns.split('').reverse().join('');
      }
      return aAns.localeCompare(bAns);
    });
  }

  function updateAZBar(engine) {
    var used = {};
    Object.keys(scratchpad).forEach(function (key) {
      var letters = (scratchpad[key] || '').replace(/[^A-Z?]/g, '');
      if (letters) used[trackLastLetter ? letters[letters.length - 1] : letters[0]] = true;
    });

    engine.container.querySelectorAll('.xw-az-letter').forEach(function (el) {
      el.classList.toggle('xw-az-used', !!used[el.getAttribute('data-letter')]);
    });

    updateClueDoneStates(engine);
  }

  // Grey out a clue row when its scratchpad answer matches any fully-filled grid word.
  function updateClueDoneStates(engine) {
    var placedEntries = {};
    engine.words.forEach(function (v) {
      if (v.isContinuation) return;
      var cells = engine.getAllWordCells(v);
      var allFilled = cells.every(function (wc) { return !!engine.puzzle.grid[wc.row][wc.col].entry; });
      if (!allFilled) return;
      var entry = cells.map(function (wc) { return engine.puzzle.grid[wc.row][wc.col].entry; }).join('');
      placedEntries[entry] = true;
    });

    engine.words.forEach(function (w) {
      if (w.isContinuation) return;
      var key       = w.number + '_' + w.direction;
      var spLetters = (scratchpad[key] || '').replace(/[^A-Z?]/g, '');
      var isDone    = spLetters.length > 0 && !!placedEntries[spLetters];
      var clueEl    = engine.container.querySelector(
        '.xw-clue[data-num="' + w.number + '"][data-dir="' + w.direction + '"]'
      );
      if (clueEl) clueEl.classList.toggle('xw-clue-done', isDone);
    });
  }

  function clearScratchpad(engine) {
    scratchpad = {};
    engine.container.querySelectorAll('.xw-scratchpad').forEach(function (inp) {
      inp.value = '';
    });
    updateAZBar(engine);
    engine.saveProgress();
  }

  function renderAZBar() {
    return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (l) {
      return '<span class="xw-az-letter" data-letter="' + l + '" title="' + l + '">' + l + '</span>';
    }).join('');
  }

  // ================================================================
  // CREATE WIDGET
  // ================================================================
  XwCore({
    containerId:   'az-jigsaw-embed',
    dataAttr:      'data-puzzle-number',
    storagePrefix: 'xw-azprog-',
    widgetClass:   'xw-jigsaw',

    // ---- Rendering overrides ----
    renderAboveBody: function (engine) {
      trackLastLetter = engine.container.getAttribute('data-letter-end') === 'true';
      return '<div class="xw-clue-az-row">' +
        '<div class="xw-active-clue-bar">' +
          '<span class="xw-acb-label"></span>' +
          '<span class="xw-acb-clue"></span>' +
        '</div>' +
        '<div class="xw-az-bar" aria-label="' + (trackLastLetter ? 'Z to A' : 'A to Z') + ' tracker">' +
          renderAZBar() +
        '</div>' +
      '</div>';
    },

    renderCluePanel: function (engine) {
      var sortedClues = getSortedDisplayClues(engine);
      var items = sortedClues.map(function (w) {
        var enumStr = (engine.puzzle.showEnumerations && w.enumeration)
          ? ' <span class="xw-clue-enum">(' + fmtEnum(w.enumeration) + ')</span>'
          : '';
        var key   = w.number + '_' + w.direction;
        var spVal = escapeAttr(scratchpad[key] || '');
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
    },

    extraClearItems: [
      { label: 'Scratchpad', action: 'clear-scratchpad' }
    ],

    extraActions: {
      'clear-scratchpad': function (engine) { clearScratchpad(engine); }
    },

    // ---- Selection: no clue highlighting in jigsaw mode ----
    onSelectCell: function () {
      // intentionally empty — grid navigation does not highlight clues
    },

    // ---- Active clue bar: show highlighted clue text or grid word enumeration ----
    updateActiveClueBar: function (word, engine) {
      var labelEl = engine.container.querySelector('.xw-acb-label');
      var clueEl  = engine.container.querySelector('.xw-acb-clue');
      if (!labelEl || !clueEl) return;

      // A highlighted clue in the list takes priority
      if (highlightedClue) {
        var hcWord = engine.wordMap[highlightedClue.num + '_' + highlightedClue.dir];
        if (hcWord) {
          labelEl.textContent = '';
          var hcEnum = (engine.puzzle.showEnumerations && hcWord.enumeration)
            ? ' (' + fmtEnum(hcWord.enumeration) + ')'
            : '';
          clueEl.textContent = hcWord.clue + hcEnum;
          return;
        }
      }

      // Fall back to the selected grid word's enumeration
      var displayWord = engine.getDisplayWord(word);
      if (!displayWord) { labelEl.textContent = ''; clueEl.textContent = ''; return; }

      labelEl.textContent = '?';
      var enumStr = (engine.puzzle.showEnumerations && displayWord.enumeration)
        ? ' (' + fmtEnum(displayWord.enumeration) + ')'
        : '';
      clueEl.textContent = enumStr;
    },

    // ---- Cell modification: update A-Z bar instead of default clue dimming ----
    onCellModified: function (engine) {
      updateAZBar(engine);
    },

    updateClueDoneStates: function (engine) {
      updateClueDoneStates(engine);
    },

    // ---- Clue click: toggle highlight (no grid navigation) ----
    onClueClick: function (clueEl, e, engine) {
      if (e.target.closest('.xw-scratchpad')) return;  // pass through to scratchpad
      var num = parseInt(clueEl.dataset.num, 10);
      var dir = clueEl.dataset.dir;
      if (highlightedClue &&
          highlightedClue.num === num &&
          highlightedClue.dir === dir) {
        highlightedClue = null;
        engine.clearClueHighlights();
      } else {
        highlightedClue = { num: num, dir: dir };
        engine.clearClueHighlights();
        clueEl.classList.add('xw-clue-active');
      }
      // Re-run updateActiveClueBar via the engine's selectCell path won't fire
      // here, so call it directly:
      var labelEl = engine.container.querySelector('.xw-acb-label');
      var acbClue = engine.container.querySelector('.xw-acb-clue');
      if (labelEl && acbClue) {
        if (highlightedClue) {
          var hcWord = engine.wordMap[highlightedClue.num + '_' + highlightedClue.dir];
          if (hcWord) {
            labelEl.textContent = '';
            var hcEnum = (engine.puzzle.showEnumerations && hcWord.enumeration)
              ? ' (' + fmtEnum(hcWord.enumeration) + ')'
              : '';
            acbClue.textContent = hcWord.clue + hcEnum;
          }
        } else {
          // Restore grid word display
          var word = engine.getDisplayWord(engine.getCurrentWord());
          if (!word) { labelEl.textContent = ''; acbClue.textContent = ''; }
          else {
            labelEl.textContent = '?';
            var enumStr = (engine.puzzle.showEnumerations && word.enumeration)
              ? ' (' + fmtEnum(word.enumeration) + ')'
              : '';
            acbClue.textContent = enumStr;
          }
        }
      }
    },

    // ---- Extra events: scratchpad inputs ----
    bindExtraEvents: function (widget, engine) {
      // Uppercase scratchpad text and update the A-Z bar on each keystroke
      widget.addEventListener('input', function (e) {
        var sp = e.target.closest('.xw-scratchpad');
        if (!sp) return;
        if (!engine.state.timer.running && !engine.state.completed) engine.startTimer();
        var val = sp.value.toUpperCase().replace(/[^A-Z\-' ?]/g, '');
        sp.value = val;
        var key = sp.dataset.spNum + '_' + sp.dataset.spDir;
        scratchpad[key] = val;
        updateAZBar(engine);
        engine.saveProgress();
      });

      // Stop scratchpad keystrokes from reaching the grid's hidden-input handler
      widget.addEventListener('keydown', function (e) {
        if (e.target.closest('.xw-scratchpad')) {
          e.stopPropagation();
        }
      }, true);

      // Focusing a scratchpad field highlights its clue row
      widget.addEventListener('focusin', function (e) {
        var sp = e.target.closest('.xw-scratchpad');
        if (!sp) return;
        var clueEl = sp.closest('.xw-clue');
        if (!clueEl) return;
        var num = parseInt(clueEl.dataset.num, 10);
        var dir = clueEl.dataset.dir;
        if (highlightedClue && highlightedClue.num === num && highlightedClue.dir === dir) return;
        highlightedClue = { num: num, dir: dir };
        engine.clearClueHighlights();
        clueEl.classList.add('xw-clue-active');
        // Update the active clue bar to show this clue
        var labelEl = engine.container.querySelector('.xw-acb-label');
        var acbClue = engine.container.querySelector('.xw-acb-clue');
        if (labelEl && acbClue) {
          var hcWord = engine.wordMap[num + '_' + dir];
          if (hcWord) {
            labelEl.textContent = '';
            var hcEnum = (engine.puzzle.showEnumerations && hcWord.enumeration)
              ? ' (' + fmtEnum(hcWord.enumeration) + ')'
              : '';
            acbClue.textContent = hcWord.clue + hcEnum;
          }
        }
      });

      // Ensure the grid's hidden input regains focus when clicking an already-highlighted cell
      ['mousedown', 'touchstart'].forEach(function(evt) {
        widget.addEventListener(evt, function (e) {
          // Ignore interactions inside the clue list or A-Z bar
          if (e.target.closest('.xw-clue-section') || e.target.closest('.xw-clue-az-row')) {
            return;
          }
          
          // Find the core engine's hidden input (the only input that isn't a scratchpad)
          var hiddenInput = widget.querySelector('input:not(.xw-scratchpad)');
          if (hiddenInput) {
            // Push focus to the end of the event loop to let the core engine finish its own click handling first
            setTimeout(function() {
              hiddenInput.focus();
            }, 10);
          }
        });
      });
    },

    // ---- Persistence: scratchpad data ----
    saveExtraData: function (data) {
      data.scratchpad = scratchpad;
    },

    loadExtraData: function (data, engine) {
      if (data.scratchpad && typeof data.scratchpad === 'object') {
        scratchpad = {};
        Object.keys(data.scratchpad).forEach(function (key) {
          scratchpad[key] = data.scratchpad[key];
        });
        // Populate the DOM inputs
        Object.keys(scratchpad).forEach(function (key) {
          var parts = key.split('_');
          var num = parts[0], dir = parts[1];
          var inp = engine.container.querySelector(
            '.xw-scratchpad[data-sp-num="' + num + '"][data-sp-dir="' + dir + '"]'
          );
          if (inp) inp.value = scratchpad[key];
        });
      }
    },

    onInit: function (engine) {
      _engine = engine;
      trackLastLetter = engine.container.getAttribute('data-letter-end') === 'true';
      updateAZBar(engine);
    }
  });

})();