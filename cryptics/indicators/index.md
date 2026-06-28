---
layout: page
title: Cryptic Indicators
permalink: /cryptics/indicators/
---

<div id="indicator-app" data-json-url="{{ '/assets/data/indicators.json' | relative_url }}">

  <nav id="ind-nav"></nav>

  <div id="ind-main">
    <div id="ind-search-bar"></div>
    <p id="ind-count"></p>
    <div id="ind-display">
      <p class="ind-loading">Loading indicators…</p>
    </div>
  </div>

</div>

<script defer src="{{ '/assets/js/indicators-app.js' | relative_url }}"></script>
