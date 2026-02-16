// Clue database — DataTables with per-column wildcard search

// 2. Convert user wildcards to regex
//    .  = any single non-space character (for crossword patterns like P.PP.R)
//    *  = any sequence of characters including spaces
//    " at start = anchor to start of field (^)
//    " at end   = anchor to end of field ($)
//    All other regex metacharacters are escaped for safety.
function wildcardToRegex(term) {
  if (!term) return '';

  // Detect edge-of-field anchors
  var anchorStart = false;
  var anchorEnd = false;

  if (term.charAt(0) === '"') {
    anchorStart = true;
    term = term.substring(1);
  }
  if (term.length > 0 && term.charAt(term.length - 1) === '"') {
    anchorEnd = true;
    term = term.substring(0, term.length - 1);
  }

  // Escape regex metacharacters except . and *
  var escaped = term.replace(/([\\^$|?+()[\]{}])/g, '\\$1');
  // Convert wildcards
  escaped = escaped.replace(/\./g, '[^ ]');
  escaped = escaped.replace(/\*/g, '.*');

  // Apply anchors
  if (anchorStart) escaped = '^' + escaped;
  if (anchorEnd) escaped = escaped + '$';

  return escaped;
}

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wildcardToRegex };
}

if (typeof $ !== 'undefined') {
  $(document).ready(function () {

    // 1. Initialize DataTable (no default search box)
    var table = $('#cluesTable').DataTable({
      "dom": "lrtip",
      "order": [[0, "desc"], [2, "asc"]],
      "pageLength": 25,
      "deferRender": true,
      "orderCellsTop": true,
      "language": {
        "lengthMenu": "Show _MENU_ entries",
        "zeroRecords": "No matching clues found",
        "info": "Showing _START_ to _END_ of _TOTAL_ clues",
        "infoEmpty": "No clues available",
        "infoFiltered": "(filtered from _MAX_ total clues)"
      },
      "initComplete": function () {
        // Prevent clicks on search-row cells from triggering column sort
        $('#cluesTable thead .search-row th').on('click', function (e) {
          e.stopPropagation();
        });

        $('#loading-message').hide();
        $('#clue-db-wrapper').fadeIn();
      }
    });

    // 3. Bind per-column search inputs
    $('#cluesTable thead .search-row input').on('keyup change', function () {
      var col = table.column($(this).data('column'));
      var regex = wildcardToRegex(this.value);

      if (col.search() !== regex) {
        col.search(regex, true, false, true).draw();
      }
    });

    // 4. Enter moves focus to next input
    $('#cluesTable thead .search-row input').on('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var inputs = $('#cluesTable thead .search-row input');
        var next = inputs.eq((inputs.index(this) + 1) % inputs.length);
        next.focus().select();
      }
    });
  });
}
