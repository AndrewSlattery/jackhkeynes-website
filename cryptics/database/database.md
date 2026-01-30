---
layout: page
title: Clue Database
permalink: /cryptics/database/
---

<link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.11.5/css/jquery.dataTables.css">

<style>
  /* --- 1. Loading State --- */
  #loading-message {
    text-align: center;
    padding: 40px;
    font-family: monospace;
    color: #00ff00;
    font-size: 1.2em;
  }

  /* Hide the table wrapper initially */
  #clue-db-wrapper {
    display: none;
    color: #e8e8e8;
    margin-top: 20px;
    font-size: 0.95em;
  }

  /* --- 2. Dark Theme Overrides --- */
  
  /* Reset the entire table background */
  table.dataTable {
    background-color: #1d1d1d;
    border-collapse: collapse;
    width: 100%;
    border: 1px solid #424242;
  }

  /* Header styling */
  table.dataTable thead th {
    background-color: #2d2d2d;
    color: #00ff00;
    border-bottom: 2px solid #424242;
    padding: 12px 10px;
    text-align: left;
    font-weight: bold;
  }

  /* Standard Cell styling */
  table.dataTable tbody td {
    border-bottom: 1px solid #333;
    padding: 10px;
    color: #e8e8e8;
    background-color: #1d1d1d;
    vertical-align: top;
  }

  /* --- FIX: The "Nuclear Option" for Sorted Columns --- */
  table.dataTable.display tbody tr.odd > .sorting_1,
  table.dataTable.order-column.stripe tbody tr.odd > .sorting_1,
  table.dataTable.display tbody tr.odd > .sorting_2,
  table.dataTable.order-column.stripe tbody tr.odd > .sorting_2,
  table.dataTable.display tbody tr.odd > .sorting_3,
  table.dataTable.order-column.stripe tbody tr.odd > .sorting_3 {
    background-color: #262626 !important;
    box-shadow: none !important;
    color: #e8e8e8 !important;
  }

  table.dataTable.display tbody tr.even > .sorting_1,
  table.dataTable.order-column.stripe tbody tr.even > .sorting_1,
  table.dataTable.display tbody tr.even > .sorting_2,
  table.dataTable.order-column.stripe tbody tr.even > .sorting_2,
  table.dataTable.display tbody tr.even > .sorting_3,
  table.dataTable.order-column.stripe tbody tr.even > .sorting_3 {
    background-color: #2a2a2a !important;
    box-shadow: none !important;
    color: #e8e8e8 !important;
  }

  table.dataTable.display tbody tr:hover > .sorting_1,
  table.dataTable.order-column.stripe tbody tr:hover > .sorting_1,
  table.dataTable.display tbody tr:hover > .sorting_2,
  table.dataTable.order-column.stripe tbody tr:hover > .sorting_2,
  table.dataTable.display tbody tr:hover > .sorting_3,
  table.dataTable.order-column.stripe tbody tr:hover > .sorting_3 {
    background-color: #333 !important;
    box-shadow: none !important;
    color: #fff !important;
  }

  table.dataTable tbody tr:hover td {
    background-color: #333 !important;
    color: #fff;
  }

  /* --- 3. Column Specifics --- */
  .answer-col {
    font-family: monospace;
    font-weight: bold;
    letter-spacing: 0.05em;
  }

  .enum-col {
    font-size: 0.85em;
    color: #828282 !important;
    white-space: nowrap;
  }

  /* --- 4. Controls (Search/Pagination) --- */
  .dataTables_filter input {
    background: #2d2d2d;
    border: 1px solid #424242;
    border-radius: 4px;
    color: #e8e8e8;
    padding: 6px 10px;
    margin-left: 8px;
    outline: none;
  }
  .dataTables_filter input:focus {
    border-color: #00ff00;
  }

  .dataTables_wrapper .dataTables_length, 
  .dataTables_wrapper .dataTables_length label,
  .dataTables_wrapper .dataTables_filter,
  .dataTables_wrapper .dataTables_info,
  .dataTables_wrapper .dataTables_paginate {
    color: #828282 !important;
    margin-bottom: 15px;
  }
  
  .dataTables_wrapper .dataTables_length select {
    background: #2d2d2d;
    border: 1px solid #424242;
    border-radius: 4px;
    color: #e8e8e8;
    padding: 4px;
    margin: 0 5px;
  }

  .dataTables_wrapper .dataTables_paginate .paginate_button {
    color: #e8e8e8 !important;
    border: 1px solid transparent;
  }
  
  .dataTables_wrapper .dataTables_paginate .paginate_button.current,
  .dataTables_wrapper .dataTables_paginate .paginate_button.current:hover {
    background: #2d2d2d;
    border: 1px solid #424242;
    color: #00ff00 !important;
  }

  .dataTables_wrapper .dataTables_paginate .paginate_button:hover {
    background: #333;
    color: #fff !important;
    border: 1px solid #424242;
  }

  /* --- 5. Regex Checkbox Styling --- */
  .regex-control {
    float: right; 
    margin-left: 15px;
    color: #828282;
    font-size: 0.9em;
    padding-top: 6px;
    cursor: pointer;
  }
  
  .regex-control input {
    margin-right: 5px;
    cursor: pointer;
  }
</style>

<div id="loading-message">Loading Clue Database...</div>

<div id="clue-db-wrapper">
  <div id="regex-toggle-container" style="display:none;">
    <label class="regex-control">
      <input type="checkbox" id="regexCheckbox"> Regex
    </label>
  </div>

  <table id="cluesTable" class="display">
    <thead>
      <tr>
        <th style="width: 10%;">Grid #</th>
        <th style="width: 50%;">Clue</th>
        <th style="width: 25%;">Answer</th>
        <th style="width: 15%;">Enum</th>
      </tr>
    </thead>
    <tbody>
      {% for row in site.data.clues %}
        <tr>
          <td>{{ row['Grid Number'] }}</td>
          <td>{{ row['Clue'] }}</td>
          <td class="answer-col"><span>{{ row['Answer'] }}</span></td>
          <td class="enum-col">({{ row['Enumeration'] }})</td>
        </tr>
      {% endfor %}
    </tbody>
  </table>
</div>

<script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
<script type="text/javascript" charset="utf8" src="https://cdn.datatables.net/1.11.5/js/jquery.dataTables.js"></script>

<script>
  $(document).ready(function() {
    // 1. Initialize DataTable
    var table = $('#cluesTable').DataTable({
      "order": [[ 0, "desc" ], [ 2, "asc" ]],
      "pageLength": 25,
      "deferRender": true, 
      "language": {
        "search": "🔍 Search Clues:",
        "lengthMenu": "Show _MENU_ entries",
        "zeroRecords": "No matching clues found",
        "info": "Showing _START_ to _END_ of _TOTAL_ clues",
        "infoEmpty": "No clues available",
        "infoFiltered": "(filtered from _MAX_ total clues)"
      },
      "initComplete": function(settings, json) {
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

    var doSearch = function() {
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
    $(document).on('keyup change', searchInputSelector, function() {
      doSearch();
    });

    // Trigger search when checkbox is toggled
    regexBox.on('change', function() {
      doSearch();
      $(searchInputSelector).focus();
    });
  });
</script>