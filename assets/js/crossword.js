// crossword.js — standard blocked crossword widget
// Usage: <div id="crossword-embed" data-puzzle-number="42"></div>
// Requires crossword-core.js to be loaded first.

(function () {
  'use strict';

  XwCore({
    containerId:   'crossword-embed',
    dataAttr:      'data-puzzle-number',
    storagePrefix: 'xw-progress-'
    // All other options use core defaults:
    //   parseIPuz, buildWordList, renderCell, isCellPlayable
  });

})();
