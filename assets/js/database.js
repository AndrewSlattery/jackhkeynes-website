// Clue database — DataTables with per-column wildcard search
$(document).ready(function () {

  // 1. Initialize DataTable (no default search box)
  var table = $('#cluesTable').DataTable({
    "dom": "lrtip",
    "order": [[0, "desc"], [2, "asc"]],
    "pageLength": 25,
    "deferRender": true,
    "language": {
      "lengthMenu": "Show _MENU_ entries",
      "zeroRecords": "No matching clues found",
      "info": "Showing _START_ to _END_ of _TOTAL_ clues",
      "infoEmpty": "No clues available",
      "infoFiltered": "(filtered from _MAX_ total clues)"
    },
    "initComplete": function () {
      // Move tfoot to sit directly below thead
      var $tfoot = $('#cluesTable tfoot').detach();
      $('#cluesTable thead').after($tfoot);

      // Prevent clicks on tfoot cells from triggering sort
      $('#cluesTable tfoot th').on('click', function (e) {
        e.stopPropagation();
      });

      $('#loading-message').hide();
      $('#clue-db-wrapper').fadeIn();
    }
  });

  // 2. Convert user wildcards to regex
  //    .  = any single non-space character (for crossword patterns like P.PP.R)
  //    *  = any sequence of characters including spaces (for broad matching)
  //    All other regex metacharacters are escaped for safety.
  function wildcardToRegex(term) {
    if (!term) return '';
    // Escape regex metacharacters except . and *
    var escaped = term.replace(/([\\^$|?+()[\]{}])/g, '\\$1');
    // Convert wildcards
    escaped = escaped.replace(/\./g, '[^ ]');
    escaped = escaped.replace(/\*/g, '.*');
    return escaped;
  }

  // 3. Bind per-column search inputs
  $('#cluesTable tfoot input').on('keyup change', function () {
    var col = table.column($(this).data('column'));
    var regex = wildcardToRegex(this.value);

    if (col.search() !== regex) {
      col.search(regex, true, false, true).draw();
    }
  });

  // 4. Enter moves focus to next input
  $('#cluesTable tfoot input').on('keydown', function (e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      var inputs = $('#cluesTable tfoot input');
      var next = inputs.eq((inputs.index(this) + 1) % inputs.length);
      next.focus().select();
    }
  });
});
