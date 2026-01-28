---
layout: home
title: Keynesian Cryptics
permalink: /cryptics/
---

<style>
  /* 1. Container for layout control */
  .search-container-row {
    margin-bottom: 20px; /* Adds breathing room before "Posts" */
  }

  .search-input-wrapper {
    position: relative;
    /* CHANGED: Use percentage for responsiveness, max-width to keep it neat */
    width: 100%;
    max-width: 300px; 
  }

  #search-input {
    width: 100%;
    padding: 8px 12px;
    background: #2d2d2d;
    border: 1px solid #424242;
    border-radius: 4px;
    color: #e8e8e8;
    outline: none;
    font-size: 14px;
    box-sizing: border-box; /* Ensures padding doesn't break the width */
  }

  #search-input:focus {
    border-color: #00ff00; /* Optional: Nice polish to match your theme */
  }

  /* 3. Search Results Dropdown */
  #results-container {
    list-style: none;
    margin: 8px 0 0 0;
    padding: 0;
    position: absolute;
    width: 100%; /* Matches the input wrapper width */
    background: #1d1d1d;
    border: 1px solid #424242;
    border-radius: 4px;
    z-index: 999;
    box-shadow: 0 10px 20px rgba(0,0,0,0.5);
  }

  /* THE FIX: This hides the border/box when there are no results */
  #results-container:empty {
    display: none;
  }

  #results-container li {
    padding: 12px;
    border-bottom: 1px solid #333;
  }
  
  /* Remove border from the last item so it looks cleaner */
  #results-container li:last-child {
    border-bottom: none;
  }

  #results-container a {
    color: #00ff00; 
    text-decoration: none;
    font-weight: bold;
    display: block; /* Makes the whole area clickable */
  }
  
  #results-container a:hover {
    text-decoration: underline;
  }

  .result-date {
    display: block;
    font-size: 0.8em;
    color: #828282;
    margin-bottom: 4px;
  }
</style>

<div class="search-container-row">
  <div class="search-input-wrapper">
    <input type="text" id="search-input" placeholder="🔍 Search" autocomplete="off">
    <ul id="results-container"></ul>
  </div>
</div>

<script src="https://unpkg.com/simple-jekyll-search@latest/dest/simple-jekyll-search.min.js"></script>

<script>
  new SimpleJekyllSearch({
    searchInput: document.getElementById('search-input'),
    resultsContainer: document.getElementById('results-container'),
    json: '{{ site.baseurl }}/search.json',
    searchResultTemplate: '<li><span class="result-date">{date}</span><a href="{url}">{title}</a></li>',
    noResultsText: '<li style="color:#828282; padding:10px;">No matches found</li>',
    limit: 10,
    fuzzy: false
  });
</script>

[Clue Database](/cryptics/database)
