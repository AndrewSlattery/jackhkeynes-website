---
layout: page
title: Indicator Database
permalink: /cryptics/indicators/
---

<style>
  /* --- Layout & Container --- */
  #indicator-app {
    display: flex;
    flex-wrap: wrap;
    gap: 30px;
    margin-top: 20px;
    min-height: 600px;
  }

  /* --- Sidebar (Navigation) --- */
  .ind-sidebar {
    flex: 1 0 200px;
    max-width: 250px;
    background-color: #1a1a1a;
    border: 1px solid #424242;
    border-radius: 4px;
    padding: 15px;
    height: fit-content;
  }

  .ind-sidebar h3 {
    margin-top: 0;
    font-size: 1.1em;
    color: #828282;
    border-bottom: 1px solid #424242;
    padding-bottom: 10px;
    margin-bottom: 10px;
  }

  .cat-btn {
    display: block;
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    color: #e0e0e0;
    padding: 8px 10px;
    cursor: pointer;
    border-radius: 4px;
    font-size: 1em;
    transition: background 0.2s, color 0.2s;
  }

  .cat-btn:hover {
    background-color: #333;
    color: #fff;
  }

  .cat-btn.active {
    background-color: rgba(81, 251, 68, 0.1); /* Low opacity brand color */
    color: #51fb44; /* Brand neon green */
    font-weight: bold;
    border-left: 3px solid #51fb44;
  }

  /* --- Main Content Area --- */
  .ind-content {
    flex: 3 0 300px;
  }

  /* Search/Filter Box */
  .ind-controls {
    margin-bottom: 20px;
  }
  
  #ind-search {
    width: 100%;
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

  /* Groups/Cards */
  .ind-group {
    margin-bottom: 30px;
    border: 1px solid #424242;
    background-color: #262626; /* Slightly lighter than main bg */
    border-radius: 4px;
    overflow: hidden;
  }

  .ind-group-header {
    background-color: #1a1a1a;
    padding: 10px 15px;
    border-bottom: 1px solid #424242;
    font-weight: bold;
    color: #51fb44;
    font-size: 1.1em;
  }

  .ind-list {
    list-style: none;
    margin: 0;
    padding: 15px;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .ind-list li {
    background-color: #333;
    padding: 5px 10px;
    border-radius: 3px;
    font-size: 0.95em;
    color: #e0e0e0;
  }

  /* Responsive Mobile Tweaks */
  @media (max-width: 768px) {
    .ind-sidebar {
      max-width: 100%;
      margin-bottom: 20px;
    }
    #indicator-app {
      flex-direction: column;
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
  <div class="ind-sidebar">
    <h3>Categories</h3>
    <div id="category-list">
      </div>
  </div>

  <div class="ind-content">
    <div class="ind-controls">
      <input type="text" id="ind-search" placeholder="Filter list... (start with '-' to filter by section)" onkeyup="filterWords()">
    </div>
    <div id="display-area">
      <p class="loading-msg">Loading indicators...</p>
    </div>
  </div>
</div>

<script>
  let allData = [];
  let currentCategory = "";

  // Updated path as requested
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

  function loadCategory(category) {
    currentCategory = category;
    
    document.querySelectorAll('.cat-btn').forEach(btn => {
      if (btn.textContent === category) btn.classList.add('active');
      else btn.classList.remove('active');
    });

    document.getElementById('ind-search').value = "";
    
    renderIndicators(allData.filter(item => item.category === category));
  }

  function renderIndicators(items) {
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
      a.localeCompare(b, undefined, {numeric: true, sensitivity: 'base'})
    );

    sortedKeys.forEach(key => {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'ind-group';
      
      groups[key].sort((a, b) => a.localeCompare(b));

      const listHtml = groups[key].map(word => `<li>${word}</li>`).join('');

      groupDiv.innerHTML = `
        <div class="ind-group-header">${key}</div>
        <ul class="ind-list">
          ${listHtml}
        </ul>
      `;
      display.appendChild(groupDiv);
    });
  }

  function filterWords() {
    let query = document.getElementById('ind-search').value.toLowerCase();
    const groups = document.querySelectorAll('.ind-group');
    
    // Check if user is using the "-" prefix for Header Search
    const isHeaderSearch = query.startsWith('-');
    if (isHeaderSearch) {
      query = query.substring(1); // Remove the hyphen
    }

    groups.forEach(group => {
      const header = group.querySelector('.ind-group-header').textContent.toLowerCase();
      const listItems = group.querySelectorAll('li');
      
      if (isHeaderSearch) {
        // --- MODE 1: Header Search ---
        // If the section header matches the query, show the section AND all its contents
        if (header.includes(query)) {
          group.style.display = '';
          listItems.forEach(li => li.style.display = ''); // Make sure items aren't hidden from previous filters
        } else {
          group.style.display = 'none';
        }
      } else {
        // --- MODE 2: Content Search (Standard) ---
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
        // Only show group if it has visible items
        group.style.display = hasVisible ? '' : 'none';
      }
    });
  }
</script>