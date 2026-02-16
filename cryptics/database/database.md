---
layout: page
title: Clue Database
permalink: /cryptics/database/
---

<link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.11.5/css/jquery.dataTables.css">
<link rel="stylesheet" href="{{ '/assets/css/database.css' | relative_url }}">

<div id="loading-message">Loading Clue Database...</div>

<div id="clue-db-wrapper">
  <p id="search-help">
    Search tips: <code>.</code> = any single character,
    <code>*</code> = any sequence of characters.
    Searches are case-insensitive.
  </p>

  <table id="cluesTable" class="display">
    <thead>
      <tr>
        <th style="width: 10%;">Grid #</th>
        <th style="width: 50%;">Clue</th>
        <th style="width: 25%;">Answer</th>
        <th style="width: 15%;">Enum</th>
      </tr>
    </thead>
    <tfoot>
      <tr>
        <th><input type="text" placeholder="Grid #" data-column="0" /></th>
        <th><input type="text" placeholder="Clue" data-column="1" /></th>
        <th><input type="text" placeholder="Answer" data-column="2" /></th>
        <th><input type="text" placeholder="Enum" data-column="3" /></th>
      </tr>
    </tfoot>
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
<script src="{{ '/assets/js/database.js' | relative_url }}"></script>
