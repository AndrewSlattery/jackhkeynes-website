// Indicator database — category tabs, search, and display logic
var allData = [];
var currentCategory = "";
var searchScope = "global"; // "global", "category", or "header"

function initIndicatorApp(jsonUrl) {
  return fetch(jsonUrl)
    .then(function (response) {
      if (!response.ok) {
        throw new Error('HTTP error! status: ' + response.status);
      }
      return response.text();
    })
    .then(function (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("JSON Parse Error. Received text:", text.substring(0, 100) + "...");
        throw new Error("Invalid JSON received. Check console for details.");
      }
    })
    .then(function (data) {
      allData = data.filter(function (item) { return item.word && item.category !== 'spacer'; });
      initApp();
    })
    .catch(function (err) {
      document.getElementById('display-area').innerHTML = '<p class="error-msg">Error loading data: ' + err.message + '</p>';
    });
}

function initApp() {
  var categories = [];
  var seen = {};
  allData.forEach(function (item) {
    if (!seen[item.category]) {
      seen[item.category] = true;
      categories.push(item.category);
    }
  });
  categories.sort();

  var catContainer = document.getElementById('category-list');
  catContainer.innerHTML = "";

  categories.forEach(function (cat, index) {
    var btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.textContent = cat;
    btn.onclick = function () { loadCategory(cat); };
    catContainer.appendChild(btn);

    if (index === 0) loadCategory(cat);
  });
}

function setScope(scope) {
  searchScope = scope;
  document.querySelectorAll('.scope-btn').forEach(function (btn) { btn.classList.remove('active'); });
  document.getElementById('scope-' + scope).classList.add('active');

  // Update placeholder text
  var input = document.getElementById('ind-search');
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

  document.querySelectorAll('.cat-btn').forEach(function (btn) {
    if (btn.textContent === category) btn.classList.add('active');
    else btn.classList.remove('active');
  });

  var searchInput = document.getElementById('ind-search');
  searchInput.value = "";
  document.getElementById('result-summary').style.display = 'none';

  renderCategory(allData.filter(function (item) { return item.category === category; }));
}

function renderCategory(items) {
  var display = document.getElementById('display-area');
  display.innerHTML = "";

  if (items.length === 0) {
    display.innerHTML = "<p>No indicators found.</p>";
    return;
  }

  var isCharade = currentCategory.toLowerCase().includes("charade");
  var groupKey = isCharade ? 'result' : 'type';

  var groups = {};
  items.forEach(function (item) {
    var key = item[groupKey] || "Misc";
    if (!groups[key]) groups[key] = [];
    groups[key].push(item.word);
  });

  var sortedKeys = Object.keys(groups).sort(function (a, b) {
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  sortedKeys.forEach(function (key) {
    var groupDiv = document.createElement('div');
    groupDiv.className = 'ind-group collapsed';

    groups[key].sort(function (a, b) { return a.localeCompare(b); });

    var listHtml = groups[key].map(function (word) { return '<li>' + word + '</li>'; }).join('');
    var count = groups[key].length;
    var preview = groups[key].join(', ');

    groupDiv.innerHTML =
      '<div class="ind-group-header" onclick="toggleGroup(this)">' +
        '<span class="header-label">' + key + ' <span class="count-badge">' + count + '</span></span>' +
        '<span class="preview">' + preview + '</span>' +
        '<span class="chevron">&#9660;</span>' +
      '</div>' +
      '<ul class="ind-list">' + listHtml + '</ul>';
    display.appendChild(groupDiv);
  });
}

function renderGlobalResults(items) {
  var display = document.getElementById('display-area');
  display.innerHTML = "";

  if (items.length === 0) {
    display.innerHTML = "<p>No indicators found.</p>";
    return;
  }

  // Group by category, then by type within each category
  var catGroups = {};
  items.forEach(function (item) {
    if (!catGroups[item.category]) catGroups[item.category] = {};
    var isCharade = item.category.toLowerCase().includes("charade");
    var gKey = isCharade ? item.result : item.type;
    var key = gKey || "Misc";
    if (!catGroups[item.category][key]) catGroups[item.category][key] = [];
    catGroups[item.category][key].push(item.word);
  });

  var sortedCats = Object.keys(catGroups).sort();

  sortedCats.forEach(function (cat) {
    var groups = catGroups[cat];
    var sortedKeys = Object.keys(groups).sort(function (a, b) {
      return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
    });

    sortedKeys.forEach(function (key) {
      var groupDiv = document.createElement('div');
      groupDiv.className = 'ind-group collapsed';

      groups[key].sort(function (a, b) { return a.localeCompare(b); });
      var count = groups[key].length;
      var preview = groups[key].join(', ');

      var listHtml = groups[key].map(function (word) {
        return '<li>' + word + ' <span class="cat-tag">' + cat + '</span></li>';
      }).join('');

      groupDiv.innerHTML =
        '<div class="ind-group-header" onclick="toggleGroup(this)">' +
          '<span class="header-label">' + key + ' <span class="count-badge">' + count + '</span></span>' +
          '<span class="preview">' + preview + '</span>' +
          '<span class="chevron">&#9660;</span>' +
        '</div>' +
        '<ul class="ind-list">' + listHtml + '</ul>';
      display.appendChild(groupDiv);
    });
  });
}

function toggleGroup(headerEl) {
  var group = headerEl.parentElement;
  group.classList.toggle('collapsed');
}

function handleSearch() {
  var query = document.getElementById('ind-search').value.toLowerCase().trim();
  var summaryEl = document.getElementById('result-summary');

  if (!query) {
    summaryEl.style.display = 'none';
    // Restore current category view
    renderCategory(allData.filter(function (item) { return item.category === currentCategory; }));
    // Re-highlight the active category tab
    document.querySelectorAll('.cat-btn').forEach(function (btn) {
      if (btn.textContent === currentCategory) btn.classList.add('active');
      else btn.classList.remove('active');
    });
    return;
  }

  if (searchScope === 'global') {
    // --- GLOBAL SEARCH: across all categories ---
    var matches = allData.filter(function (item) {
      return item.word.toLowerCase().includes(query);
    });

    // Dim all category tabs (none specifically selected)
    document.querySelectorAll('.cat-btn').forEach(function (btn) { btn.classList.remove('active'); });

    summaryEl.textContent = matches.length + ' result' + (matches.length !== 1 ? 's' : '') + ' across all categories';
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
  var groups = document.querySelectorAll('.ind-group');
  groups.forEach(function (group) {
    var listItems = group.querySelectorAll('li');
    var hasVisible = false;
    listItems.forEach(function (li) {
      var text = li.textContent.toLowerCase();
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
  var groups = document.querySelectorAll('.ind-group');
  groups.forEach(function (group) {
    var header = group.querySelector('.ind-group-header').textContent.toLowerCase();
    var listItems = group.querySelectorAll('li');
    if (header.includes(query)) {
      group.style.display = '';
      group.classList.remove('collapsed');
      listItems.forEach(function (li) { li.style.display = ''; });
    } else {
      group.style.display = 'none';
    }
  });
}

// Export for testing
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
  module.exports = {
    initIndicatorApp: initIndicatorApp,
    setScope: setScope,
    loadCategory: loadCategory,
    handleSearch: handleSearch,
    toggleGroup: toggleGroup,
    getAllData: function() { return allData; },
    getCurrentCategory: function() { return currentCategory; },
    getSearchScope: function() { return searchScope; }
  };
}
