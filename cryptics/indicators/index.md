---
layout: page
title: Indicator Database
permalink: /cryptics/indicators/
---

<style>
  /* --- Layout & Container --- */
  #indicator-app {
    margin-top: 20px;
    min-height: 600px;
  }

  /* --- Horizontal Tab Bar --- */
  .ind-tabbar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 20px;
    padding: 12px;
    background-color: #1a1a1a;
    border: 1px solid #424242;
    border-radius: 4px;
  }

  .cat-btn {
    background: none;
    border: 1px solid #424242;
    color: #e0e0e0;
    padding: 6px 14px;
    cursor: pointer;
    border-radius: 20px;
    font-size: 0.95em;
    transition: background 0.2s, color 0.2s, border-color 0.2s;
    white-space: nowrap;
  }

  .cat-btn:hover {
    background-color: #333;
    color: #fff;
    border-color: #666;
  }

  .cat-btn.active {
    background-color: rgba(81, 251, 68, 0.15);
    color: #51fb44;
    font-weight: bold;
    border-color: #51fb44;
  }

  /* --- Search Controls --- */
  .ind-controls {
    margin-bottom: 20px;
    display: flex;
    gap: 10px;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 10;
    background-color: #0d1117;
    padding: 10px 0;
  }

  #ind-search {
    flex: 1;
    padding: 10px;
    background: #1a1a1a;
    border: 1px solid #828282;
    color: #e0e0e0;
    border-radius: 4px;
    font-size: 1em;
  }

  #ind-search:focus {
    border-color: #51fb44;
    outline: none;
  }

  .search-scope-toggle {
    display: flex;
    border: 1px solid #424242;
    border-radius: 4px;
    overflow: hidden;
    flex-shrink: 0;
  }

  .scope-btn {
    background: #1a1a1a;
    border: none;
    color: #828282;
    padding: 10px 14px;
    cursor: pointer;
    font-size: 0.9em;
    transition: background 0.2s, color 0.2s;
  }

  .scope-btn:not(:last-child) {
    border-right: 1px solid #424242;
  }

  .scope-btn:hover {
    background-color: #333;
    color: #e0e0e0;
  }

  .scope-btn.active {
    background-color: rgba(81, 251, 68, 0.15);
    color: #51fb44;
    font-weight: bold;
  }

  /* --- Display grid --- */
  #display-area {
    columns: 2 350px;
    column-gap: 12px;
  }

  /* --- Groups/Cards --- */
  .ind-group {
    margin-bottom: 12px;
    border: 1px solid #424242;
    background-color: #262626;
    border-radius: 4px;
    overflow: hidden;
    break-inside: avoid;
  }

  .ind-group-header {
    background-color: #1a1a1a;
    padding: 10px 15px;
    border-bottom: 1px solid #424242;
    font-weight: bold;
    color: #51fb44;
    font-size: 1.05em;
    cursor: pointer;
    display: flex;
    align-items: center;
    user-select: none;
    transition: background 0.15s;
    gap: 10px;
  }

  .ind-group-header:hover {
    background-color: #222;
  }

  .ind-group-header .header-label {
    flex-shrink: 0;
  }

  .ind-group-header .count-badge {
    font-size: 0.8em;
    font-weight: normal;
    color: #828282;
    background: #333;
    padding: 2px 8px;
    border-radius: 10px;
  }

  .ind-group-header .preview {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: normal;
    font-size: 0.85em;
    color: #828282;
  }

  /* Hide preview when expanded */
  .ind-group:not(.collapsed) .preview {
    display: none;
  }

  .ind-group-header .chevron {
    font-size: 0.75em;
    color: #828282;
    flex-shrink: 0;
    transition: transform 0.2s;
  }

  .ind-group.collapsed .chevron {
    transform: rotate(-90deg);
  }

  .ind-group.collapsed .ind-list {
    display: none;
  }

  .ind-group.collapsed .ind-group-header {
    border-bottom: none;
  }

  .ind-list {
    list-style: none;
    margin: 0;
    padding: 12px 15px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .ind-list li {
    background-color: #333;
    padding: 4px 10px;
    border-radius: 3px;
    font-size: 0.9em;
    color: #e0e0e0;
  }

  /* --- Global search result category tags --- */
  .ind-list li .cat-tag {
    font-size: 0.75em;
    color: #51fb44;
    margin-left: 6px;
    opacity: 0.7;
  }

  /* --- Result count summary --- */
  .result-summary {
    color: #828282;
    font-size: 0.9em;
    margin-bottom: 15px;
    font-style: italic;
  }

  /* --- Responsive Mobile Tweaks --- */
  @media (max-width: 768px) {
    .ind-tabbar {
      gap: 6px;
    }
    .cat-btn {
      padding: 5px 10px;
      font-size: 0.85em;
    }
    .ind-controls {
      flex-direction: column;
      align-items: stretch;
    }
    .search-scope-toggle {
      justify-content: center;
    }
  }

  .loading-msg {
    color: #828282;
    font-style: italic;
  }

  .error-msg {
    color: #ff6b6b;
    border: 1px solid #ff6b6b;
    padding: 10px;
    border-radius: 4px;
    background: rgba(255, 107, 107, 0.1);
  }
</style>

<div id="indicator-app">
  <div class="ind-tabbar" id="category-list"></div>

  <div class="ind-controls">
    <input type="text" id="ind-search" placeholder="Search indicators across all categories..." oninput="handleSearch()">
    <div class="search-scope-toggle">
      <button class="scope-btn active" onclick="setScope('global')" id="scope-global">All</button>
      <button class="scope-btn" onclick="setScope('category')" id="scope-category">Category</button>
      <button class="scope-btn" onclick="setScope('header')" id="scope-header">Headers</button>
    </div>
  </div>

  <div id="result-summary" class="result-summary" style="display:none;"></div>

  <div id="display-area">
    <p class="loading-msg">Loading indicators...</p>
  </div>
</div>

<script>
  let allData = [];
  let currentCategory = "";
  let searchScope = "global"; // "global", "category", or "header"

  const jsonUrl = '{{ "/assets/js/indicators.json" | relative_url }}';

  fetch(jsonUrl)
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.text();
    })
    .then(text => {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error. Received text:", text.substring(0, 100) + "...");
        throw new Error("Invalid JSON received. Check console for details.");
      }
    })
    .then(data => {
      allData = data.filter(item => item.word && item.category !== 'spacer');
      initApp();
    })
    .catch(err => {
      document.getElementById('display-area').innerHTML = `<p class="error-msg">Error loading data: ${err.message}</p>`;
    });

  function initApp() {
    const categories = [...new Set(allData.map(item => item.category))].sort();

    const catContainer = document.getElementById('category-list');
    catContainer.innerHTML = "";

    categories.forEach((cat, index) => {
      const btn = document.createElement('button');
      btn.className = 'cat-btn';
      btn.textContent = cat;
      btn.onclick = () => loadCategory(cat);
      catContainer.appendChild(btn);

      if (index === 0) loadCategory(cat);
    });
  }

  function setScope(scope) {
    searchScope = scope;
    document.querySelectorAll('.scope-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('scope-' + scope).classList.add('active');

    // Update placeholder text
    const input = document.getElementById('ind-search');
    if (scope === 'global') {
      input.placeholder = "Search indicators across all categories...";
    } else if (scope === 'category') {
      input.placeholder = "Filter within current category...";
    } else {
      input.placeholder = "Filter by section header...";
    }

    handleSearch();
  }

  function loadCategory(category) {
    currentCategory = category;

    document.querySelectorAll('.cat-btn').forEach(btn => {
      if (btn.textContent === category) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    // If user was doing a global search, clear it and switch to category scope
    const searchInput = document.getElementById('ind-search');
    if (searchScope === 'global' && searchInput.value.trim()) {
      // Keep the search if user clicks a category during global search —
      // switch to category scope to narrow results
    }
    searchInput.value = "";
    document.getElementById('result-summary').style.display = 'none';

    renderCategory(allData.filter(item => item.category === category));
  }

  function renderCategory(items) {
    const display = document.getElementById('display-area');
    display.innerHTML = "";

    if (items.length === 0) {
      display.innerHTML = "<p>No indicators found.</p>";
      return;
    }

    const isCharade = currentCategory.toLowerCase().includes("charade");
    const groupKey = isCharade ? 'result' : 'type';

    const groups = {};
    items.forEach(item => {
      const key = item[groupKey] || "Misc";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item.word);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    sortedKeys.forEach(key => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'ind-group collapsed';

      groups[key].sort((a, b) => a.localeCompare(b));

      const listHtml = groups[key].map(word => `<li>${word}</li>`).join('');
      const count = groups[key].length;
      const preview = groups[key].join(', ');

      groupDiv.innerHTML = `
        <div class="ind-group-header" onclick="toggleGroup(this)">
          <span class="header-label">${key} <span class="count-badge">${count}</span></span>
          <span class="preview">${preview}</span>
          <span class="chevron">&#9660;</span>
        </div>
        <ul class="ind-list">
          ${listHtml}
        </ul>
      `;
      display.appendChild(groupDiv);
    });
  }

  function renderGlobalResults(items) {
    const display = document.getElementById('display-area');
    display.innerHTML = "";

    if (items.length === 0) {
      display.innerHTML = "<p>No indicators found.</p>";
      return;
    }

    // Group by category, then by type within each category
    const catGroups = {};
    items.forEach(item => {
      if (!catGroups[item.category]) catGroups[item.category] = {};
      const isCharade = item.category.toLowerCase().includes("charade");
      const groupKey = isCharade ? item.result : item.type;
      const key = groupKey || "Misc";
      if (!catGroups[item.category][key]) catGroups[item.category][key] = [];
      catGroups[item.category][key].push(item.word);
    });

    const sortedCats = Object.keys(catGroups).sort();

    sortedCats.forEach(cat => {
      const groups = catGroups[cat];
      const sortedKeys = Object.keys(groups).sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
      );

      sortedKeys.forEach(key => {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'ind-group collapsed';

        groups[key].sort((a, b) => a.localeCompare(b));
        const count = groups[key].length;
        const preview = groups[key].join(', ');

        const listHtml = groups[key].map(word =>
          `<li>${word} <span class="cat-tag">${cat}</span></li>`
        ).join('');

        groupDiv.innerHTML = `
          <div class="ind-group-header" onclick="toggleGroup(this)">
            <span class="header-label">${key} <span class="count-badge">${count}</span></span>
            <span class="preview">${preview}</span>
            <span class="chevron">&#9660;</span>
          </div>
          <ul class="ind-list">
            ${listHtml}
          </ul>
        `;
        display.appendChild(groupDiv);
      });
    });
  }

  function toggleGroup(headerEl) {
    const group = headerEl.parentElement;
    group.classList.toggle('collapsed');
  }

  function handleSearch() {
    const query = document.getElementById('ind-search').value.toLowerCase().trim();
    const summaryEl = document.getElementById('result-summary');

    if (!query) {
      summaryEl.style.display = 'none';
      // Restore current category view
      renderCategory(allData.filter(item => item.category === currentCategory));
      // Re-highlight the active category tab
      document.querySelectorAll('.cat-btn').forEach(btn => {
        if (btn.textContent === currentCategory) btn.classList.add('active');
        else btn.classList.remove('active');
      });
      return;
    }

    if (searchScope === 'global') {
      // --- GLOBAL SEARCH: across all categories ---
      const matches = allData.filter(item =>
        item.word.toLowerCase().includes(query)
      );

      // Dim all category tabs (none specifically selected)
      document.querySelectorAll('.cat-btn').forEach(btn => btn.classList.remove('active'));

      summaryEl.textContent = `${matches.length} result${matches.length !== 1 ? 's' : ''} across all categories`;
      summaryEl.style.display = 'block';

      renderGlobalResults(matches);

    } else if (searchScope === 'category') {
      // --- CATEGORY SEARCH: filter within active category ---
      summaryEl.style.display = 'none';
      filterWithinCategory(query);

    } else if (searchScope === 'header') {
      // --- HEADER SEARCH: filter groups by header name ---
      summaryEl.style.display = 'none';
      filterByHeader(query);
    }
  }

  function filterWithinCategory(query) {
    const groups = document.querySelectorAll('.ind-group');
    groups.forEach(group => {
      const listItems = group.querySelectorAll('li');
      let hasVisible = false;
      listItems.forEach(li => {
        const text = li.textContent.toLowerCase();
        if (text.includes(query)) {
          li.style.display = '';
          hasVisible = true;
        } else {
          li.style.display = 'none';
        }
      });
      group.style.display = hasVisible ? '' : 'none';
      // Auto-expand groups that have matches
      if (hasVisible) group.classList.remove('collapsed');
    });
  }

  function filterByHeader(query) {
    const groups = document.querySelectorAll('.ind-group');
    groups.forEach(group => {
      const header = group.querySelector('.ind-group-header').textContent.toLowerCase();
      const listItems = group.querySelectorAll('li');
      if (header.includes(query)) {
        group.style.display = '';
        group.classList.remove('collapsed');
        listItems.forEach(li => li.style.display = '');
      } else {
        group.style.display = 'none';
      }
    });
  }
</script>
