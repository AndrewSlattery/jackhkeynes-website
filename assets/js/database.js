// Clue database — DataTables initialization with regex search support
$(document).ready(function () {
  // 1. Initialize DataTable
  var table = $('#cluesTable').DataTable({
    "order": [[0, "desc"], [2, "asc"]],
    "pageLength": 25,
    "deferRender": true,
    "language": {
      "search": "\uD83D\uDD0D Search Clues:",
      "lengthMenu": "Show _MENU_ entries",
      "zeroRecords": "No matching clues found",
      "info": "Showing _START_ to _END_ of _TOTAL_ clues",
      "infoEmpty": "No clues available",
      "infoFiltered": "(filtered from _MAX_ total clues)"
    },
    "initComplete": function () {
      // Move our custom checkbox into the DataTables filter div
      var checkbox = $('#regex-toggle-container').children();
      $('.dataTables_filter').prepend(checkbox);

      $('#loading-message').hide();
      $('#clue-db-wrapper').fadeIn();
    }
  });

  // 2. Custom Search Logic
  var searchInputSelector = '.dataTables_filter input[type="search"]';
  var regexBox = $('#regexCheckbox');

  var doSearch = function () {
    var searchTerm = $(searchInputSelector).val();
    var isRegex = regexBox.is(':checked');

    if (isRegex) {
      // TRICK: We want '.' to match anything EXCEPT a space.
      // But we must NOT change escaped dots (e.g. user typing "\.")

      // 1. Hide escaped dots by replacing '\.' with a placeholder string
      searchTerm = searchTerm.replace(/\\\./g, '__ESC_DOT__');

      // 2. Replace all remaining 'wildcard' dots with '[^ ]' (Not Space)
      searchTerm = searchTerm.replace(/\./g, '[^ ]');

      // 3. Restore the escaped dots
      searchTerm = searchTerm.replace(/__ESC_DOT__/g, '\\.');
    }

    // table.search( input, regex, smart, caseInsen )
    // Note: caseInsen is set to !isRegex.
    // This means if Regex is ON, Case Insensitivity is OFF (Case Sensitive).
    table.search(searchTerm, isRegex, !isRegex, !isRegex).draw();
  };

  // Trigger search on typing
  $(document).on('keyup change', searchInputSelector, function () {
    doSearch();
  });

  // Trigger search when checkbox is toggled
  regexBox.on('change', function () {
    doSearch();
    $(searchInputSelector).focus();
  });
});
