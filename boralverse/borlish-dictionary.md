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
      <button id="clear-search" title="Clear search">✕</button>
    </div>

    <div class="dict-mode-toggle">
      <label>
        <input type="radio" name="dict-mode" value="borlish" checked>
        Borlish &rarr; English
      </label>
      <label>
        <input type="radio" name="dict-mode" value="english">
        English &rarr; Borlish
      </label>
    </div>
  </div>

  <div id="dict-status" class="dict-status">Loading…</div>

  <div id="dict-results" class="dict-results"></div>

</div>

<script src="{{ '/assets/js/dictionary.js' | relative_url }}"></script>
