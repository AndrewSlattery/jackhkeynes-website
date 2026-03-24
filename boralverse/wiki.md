---
layout: page
title: Boralverse Wiki
permalink: /boralverse/wiki/
description: An encyclopaedia of the Boralverse alternate history setting
---

<div id="bv-wiki" class="bv-wiki" data-fetch-url="{{ '/assets/boralverse/boralverse-wiki.json' | relative_url }}">

  <button id="bv-toggle" class="bv-toggle">☰ Index</button>

  <div id="bv-sidebar" class="bv-sidebar">
    <div class="bv-search-wrap">
      <input type="text" id="bv-search" placeholder="Search articles…" autocomplete="off" aria-label="Search wiki">
    </div>
    <div id="bv-index" class="bv-index"></div>
  </div>

  <div id="bv-article" class="bv-article">
    <div id="bv-article-inner">
      <p class="bv-loading">Loading…</p>
    </div>
  </div>

</div>

<script src="{{ '/assets/js/boralverse-wiki.js' | relative_url }}"></script>
