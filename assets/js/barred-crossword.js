// barred-crossword.js — barred-grid crossword widget
// Usage: <div id="barred-crossword-embed" data-bar-puzzle-number="44"></div>
// Requires crossword-core.js to be loaded first.

(function () {
  'use strict';

  var parseSeparators = XwCore.parseSeparators;

  // ================================================================
  // BARRED-GRID PARSER
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

        // null = outside the playable boundary (non-rectangular grids)
        if (raw === null) {
          grid[r][c] = { row: r, col: c, isOutside: true };
          continue;
        }

        var cellVal, barStr;
        if (typeof raw === 'object') {
          cellVal = raw.cell;
          barStr  = (raw.style && raw.style.barred) ? String(raw.style.barred) : '';
        } else {
          cellVal = raw;
          barStr  = '';
        }

        var number   = (typeof cellVal === 'number') ? cellVal : null;
        var solution = null;
        if (rawSol && typeof rawSol === 'object' && rawSol.value) {
          solution = rawSol.value.toUpperCase();
        } else if (typeof rawSol === 'string' && rawSol !== '#') {
          solution = rawSol.toUpperCase();
        }

        grid[r][c] = {
          row:       r,
          col:       c,
          isOutside: false,
          number:    number,
          solution:  solution,
          entry:     '',
          revealed:  false,
          checked:   null,
          bars: {
            top:    barStr.indexOf('T') >= 0,
            left:   barStr.indexOf('L') >= 0,
            right:  barStr.indexOf('R') >= 0,
            bottom: barStr.indexOf('B') >= 0
          }
        };
      }
    }

    // Normalise bars bidirectionally
    for (var r2 = 0; r2 < height; r2++) {
      for (var c2 = 0; c2 < width; c2++) {
        var cell = grid[r2][c2];
        if (!cell || cell.isOutside) continue;

        if (c2 + 1 < width && grid[r2][c2 + 1] && !grid[r2][c2 + 1].isOutside) {
          var hasHBar = cell.bars.right || grid[r2][c2 + 1].bars.left;
          cell.bars.right            = hasHBar;
          grid[r2][c2 + 1].bars.left = hasHBar;
        }
        if (r2 + 1 < height && grid[r2 + 1][c2] && !grid[r2 + 1][c2].isOutside) {
          var hasVBar = cell.bars.bottom || grid[r2 + 1][c2].bars.top;
          cell.bars.bottom           = hasVBar;
          grid[r2 + 1][c2].bars.top  = hasVBar;
        }
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
  // BARRED-GRID WORD LIST BUILDER
  // ================================================================
  function buildWordList(puz) {
    var result = [];
    var grid   = puz.grid;
    var width  = puz.width;
    var height = puz.height;

    function findCellByNumber(num) {
      for (var r = 0; r < height; r++)
        for (var c = 0; c < width; c++)
          if (!grid[r][c].isOutside && grid[r][c].number === num) return grid[r][c];
      return null;
    }

    function acrossCells(startRow, startCol) {
      var cells = [];
      for (var c = startCol; c < width; c++) {
        var cell = grid[startRow][c];
        if (!cell || cell.isOutside) break;
        cells.push({ row: startRow, col: c });
        if (cell.bars.right) break;
      }
      return cells;
    }

    function downCells(startRow, startCol) {
      var cells = [];
      for (var r = startRow; r < height; r++) {
        var cell = grid[r][startCol];
        if (!cell || cell.isOutside) break;
        cells.push({ row: r, col: startCol });
        if (cell.bars.bottom) break;
      }
      return cells;
    }

    (puz.clues.Across || []).forEach(function (clueData) {
      var start = findCellByNumber(clueData.number);
      if (!start) return;
      var cells = acrossCells(start.row, start.col);
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
      var cells = downCells(start.row, start.col);
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

    // Continuation stubs for linked clues
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
        var cells = (contDir === 'across')
          ? acrossCells(start.row, start.col)
          : downCells(start.row, start.col);
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

  // ================================================================
  // BARRED-GRID CELL RENDERER
  // ================================================================
  function renderCell(r, c, cell, puz) {
    var g      = puz.grid;
    var width  = puz.width;
    var height = puz.height;

    if (cell.isOutside) {
      return '<div class="xw-outside" data-r="' + r + '" data-c="' + c + '"></div>';
    }

    var classes = 'xw-cell';

    // Outer-edge borders
    if (r === 0          || g[r - 1][c].isOutside) classes += ' xw-edge-top';
    if (c === 0          || g[r][c - 1].isOutside) classes += ' xw-edge-left';
    if (c === width  - 1 || g[r][c + 1].isOutside) classes += ' xw-edge-right';
    if (r === height - 1 || g[r + 1][c].isOutside) classes += ' xw-edge-bottom';

    // Internal bar borders
    if (cell.bars.top)    classes += ' xw-bar-top';
    if (cell.bars.left)   classes += ' xw-bar-left';
    if (cell.bars.right)  classes += ' xw-bar-right';
    if (cell.bars.bottom) classes += ' xw-bar-bottom';

    var numSpan   = cell.number
      ? '<span class="xw-num" aria-hidden="true">' + cell.number + '</span>'
      : '';
    var ariaLabel = (cell.number ? cell.number + ' ' : '') + 'row ' + (r + 1) + ' column ' + (c + 1);

    return '<div class="' + classes + '" data-r="' + r + '" data-c="' + c + '"' +
           ' role="gridcell" aria-label="' + ariaLabel + '">' +
      numSpan +
      '<span class="xw-letter" aria-hidden="true"></span>' +
    '</div>';
  }

  // ================================================================
  // CREATE WIDGET
  // ================================================================
  XwCore({
    containerId:   'barred-crossword-embed',
    dataAttr:      'data-bar-puzzle-number',
    storagePrefix: 'xw-barprog-',
    gridClass:     'xw-barred',
    parseIPuz:      parseIPuz,
    buildWordList:  buildWordList,
    renderCell:     renderCell,
    isCellPlayable: function (cell) { return !cell.isOutside; }
  });

})();
