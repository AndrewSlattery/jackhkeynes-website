// spiral-puzzle.js — spiral crossword widget
// Usage: <div id="spiral-puzzle-embed" data-spiral-puzzle-number="1"></div>
// Requires crossword-core.js to be loaded first.
//
// Spiral puzzles have "Inward" and "Outward" clue sets, each with an explicit
// ordered list of cell coordinates (not simple row/column runs). Every cell is
// covered by exactly one Inward and one Outward clue, so direction toggling
// (Space key / same-cell click) is always valid. Shares _crossword.scss with
// the other widget types; the barred-grid CSS classes (xw-bar-*) handle bars.

(function () {
  'use strict';

  // ================================================================
  // SPIRAL-GRID PARSER
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
          checked:  null
        };
      }
    }

    // Propagate bars bidirectionally
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
      width:            width,
      height:           height,
      grid:             grid,
      clues:            data.clues || {},
      showEnumerations: false,
      title:            data.title  || '',
      author:           data.author || '',
      notes:            data.notes  || ''
    };
  }

  // ================================================================
  // SPIRAL WORD LIST BUILDER
  // ================================================================
  // Unlike blocked/barred grids, spiral clues each carry a `cells` array
  // of [col, row] pairs (1-indexed) that trace the exact path through the grid.
  function buildWordList(puz) {
    var result = [];

    ['Inward', 'Outward'].forEach(function (dirTitle) {
      var dir      = dirTitle.toLowerCase();
      var clueList = (puz.clues && puz.clues[dirTitle]) || [];

      clueList.forEach(function (clueData) {
        var cellRefs = (clueData.cells || []).map(function (pair) {
          return { row: pair[1] - 1, col: pair[0] - 1 };
        });
        if (cellRefs.length === 0) return;

        // Mark the first cell of this clue so a number is shown in the grid
        var first = cellRefs[0];
        puz.grid[first.row][first.col].showNum = true;

        result.push({
          number:      String(clueData.number),
          label:       String(clueData.number),
          direction:   dir,
          cells:       cellRefs,
          clue:        clueData.clue        || '',
          enumeration: clueData.enumeration || ''
        });
      });
    });

    return result;
  }

  // ================================================================
  // SPIRAL CELL RENDERER
  // ================================================================
  function renderCell(r, c, cell) {
    var classes = 'xw-cell';

    if (cell.bars.top)    classes += ' xw-bar-top';
    if (cell.bars.left)   classes += ' xw-bar-left';
    if (cell.bars.right)  classes += ' xw-bar-right';
    if (cell.bars.bottom) classes += ' xw-bar-bottom';

    var numSpan = cell.showNum
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

  // ================================================================
  // SIMPLE SPATIAL ARROW HANDLER
  // ================================================================
  // Spiral grids use simple one-step spatial movement — no direction
  // switching or cell skipping on arrow keys.
  function handleArrow(key, engine) {
    var r = engine.state.cursor.row, c = engine.state.cursor.col;
    var dr = 0, dc = 0;

    if      (key === 'ArrowLeft')  dc = -1;
    else if (key === 'ArrowRight') dc =  1;
    else if (key === 'ArrowUp')    dr = -1;
    else if (key === 'ArrowDown')  dr =  1;

    var nr = r + dr, nc = c + dc;
    if (nr < 0 || nr >= engine.puzzle.height || nc < 0 || nc >= engine.puzzle.width) return;

    engine.selectCell(nr, nc, engine.state.direction);
  }

  // ================================================================
  // CREATE WIDGET
  // ================================================================
  XwCore({
    containerId:     'spiral-puzzle-embed',
    dataAttr:        'data-spiral-puzzle-number',
    storagePrefix:   'xw-spiral-',
    directions:      ['inward', 'outward'],
    directionLabels: { inward: 'I', outward: 'O' },
    directionTitles: { inward: 'Inward', outward: 'Outward' },
    defaultSettings: { skipFilled: true },
    puzzleUrl:       function (n) {
      return '/assets/ipuz/' + encodeURIComponent('Spiral ' + n) + '.ipuz';
    },
    parseIPuz:      parseIPuz,
    buildWordList:  buildWordList,
    renderCell:     renderCell,
    isCellPlayable: function () { return true; },
    handleArrow:    handleArrow
  });

})();
