---
layout: page
title: Indicator Database
permalink: /cryptics/indicators/
---

<div id="indicator-app">
  <div class="ind-tabbar" id="category-list"></div>

  <div class="ind-controls">
    <input type="text" id="ind-search" placeholder="Search indicators across all categories...">
    <div class="search-scope-toggle">
      <button class="scope-btn active" data-scope="global" id="scope-global">All</button>
      <button class="scope-btn" data-scope="category" id="scope-category">Category</button>
      <button class="scope-btn" data-scope="header" id="scope-header">Headers</button>
    </div>
  </div>

  <div id="result-summary" class="result-summary" style="display:none;"></div>

  <div id="display-area">
    <p class="loading-msg">Loading indicators...</p>
  </div>
</div>

<script src="{{ '/assets/js/indicators-app.js' | relative_url }}"></script>
<script>
  initIndicatorApp('{{ "/assets/js/indicators.json" | relative_url }}');
</script>
