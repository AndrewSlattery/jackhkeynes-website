---
layout: page
title: Borlish Dictionary
permalink: /boralverse/borlish-dictionary/
description: A dictionary of the Borlish language
---

<div id="borlish-dictionary" class="dict-container" data-fetch-url="{{ '/assets/boralverse/borlish-dictionary.json' | relative_url }}">

  <div class="dict-controls">
    <div class="dict-search-wrapper">
      <input type="text" id="dict-search" placeholder="Search dictionary..." aria-label="Search">
      <button id="clear-search" type="button" title="Clear search" aria-label="Clear search">✕</button>
    </div>

    <div class="dict-options-row">
      <div class="dict-mode-toggle" role="radiogroup" aria-label="Search direction">
        <label>
          <input type="radio" name="dict-mode" value="borlish" checked>
          Borlish &rarr; English
        </label>
        <label>
          <input type="radio" name="dict-mode" value="english">
          English &rarr; Borlish
        </label>
      </div>

      <label class="dict-pos-label">
        Part of speech:
        <select id="dict-pos-filter" aria-label="Filter by part of speech">
          <option value="">All parts of speech</option>
        </select>
      </label>

      <button id="dict-random" type="button" class="dict-random-btn" title="Show a random entry">Random entry</button>
    </div>

    <div id="dict-az-strip" class="dict-az-strip" aria-label="Browse by first letter"></div>
  </div>

  <div id="dict-status" class="dict-status" role="status" aria-live="polite">Loading…</div>

  <div id="dict-results" class="dict-results"></div>

</div>

<script src="{{ '/assets/js/dictionary.js' | relative_url }}"></script>
