---
layout: page
title: Borlish Dictionary
permalink: /boralverse/borlish-dictionary/
dictionary: A dictionary of the Borlish language
---

<div id="borlish-dictionary" class="dict-container">
  
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

  <div id="dict-status" class="dict-status">Loading dictionary data...</div>

  <div id="dict-results" class="dict-results"></div>

</div>

<style>
  /* --- App Styling (Dark Mode Adapted) --- */
  
  /* Inherit fonts from site, but ensure defaults */
  .dict-container {
    max-width: 800px;
    margin: 0 auto;
    color: #e0e0e0; /* Matches main.css body color */
  }

  /* Controls Box */
  .dict-controls {
    background: #1a1a1a; /* Matches code block background */
    padding: 1.5rem;
    border-radius: 4px;
    margin-bottom: 2rem;
    border: 1px solid #424242; /* Matches main.css borders */
  }

  .dict-search-wrapper {
    position: relative;
    margin-bottom: 1rem;
  }

  /* Input Field */
  #dict-search {
    width: 100%;
    padding: 12px;
    font-size: 1.1rem;
    background-color: #2b2b2b; /* Matches site body bg */
    border: 1px solid #424242;
    color: #e0e0e0;
    border-radius: 3px;
    box-sizing: border-box;
    font-family: inherit;
  }

  #dict-search:focus {
    border-color: #51fb44; /* Matches site link color */
    outline: none;
  }

  /* Clear Button */
  #clear-search {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: #828282; /* Matches blockquote/meta color */
  }
  #clear-search:hover {
    color: #e0e0e0;
  }

  /* Radio Toggles */
  .dict-mode-toggle {
    display: flex;
    gap: 20px;
  }

  .dict-mode-toggle label {
    cursor: pointer;
    font-weight: 400;
    color: #e0e0e0;
  }

  /* Status Text */
  .dict-status {
    color: #828282;
    font-style: italic;
    margin-bottom: 1rem;
  }

  /* Results List */
  .dict-entry {
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid #424242; /* Dark border */
  }

  .dict-headword-line {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 10px;
  }

  /* Headword */
  .dict-lx {
    font-size: 1.5rem;
    font-weight: bold;
    color: #51fb44; /* Using the Green link color for Headwords to make them pop */
  }

  .dict-hm {
    font-size: 0.8rem;
    vertical-align: super;
    color: #828282;
  }

  .dict-ps {
    font-style: italic;
    color: #828282;
  }

  .dict-ge {
    margin-top: 0.5rem;
    font-size: 1.1rem;
    line-height: 1.5;
    color: #e0e0e0;
  }

  /* Metadata Box (Etymology, Examples) */
  .dict-meta {
    margin-top: 0.8rem;
    font-size: 0.95rem;
    color: #e0e0e0;
    background: #1a1a1a; /* Darker background like code blocks */
    padding: 12px;
    border: 1px solid #424242;
    border-radius: 3px;
  }

  .dict-label {
    font-weight: bold;
    color: #51fb44; /* Green accent */
    margin-right: 5px;
  }

  .dict-example {
    margin-top: 0.5rem;
    padding-left: 1rem;
    border-left: 3px solid #424242;
  }

  .dict-vernacular {
    font-weight: bold;
    color: #fff;
  }
  
  .dict-translation {
    color: #bbb;
  }

  /* Links */
  .mn-link {
    color: #51fb44; /* Site link color */
    text-decoration: none;
    cursor: pointer;
    border-bottom: 1px dotted #51fb44;
  }
  .mn-link:hover {
    color: rgb(173, 253, 167); /* Lighter green on hover */
    border-bottom-style: solid;
  }

  /* English Index Styling */
  .english-index-item {
    margin-bottom: 1rem;
    border-bottom: 1px solid #333; /* Faint separator */
    padding-bottom: 0.5rem;
  }
  .english-keyword {
    font-weight: bold;
    font-size: 1.2rem;
    color: #fff;
  }
  .english-refs {
    margin-left: 0;
    margin-top: 5px;
  }
</style>

<script>
(function() {
  // CONFIGURATION
  const FETCH_URL = '/assets/boralverse/borlish-dictionary.json';
  
  // STATE
  let dictionaryData = [];
  let englishIndex = {}; 
  let currentMode = 'borlish'; 

  // DOM ELEMENTS
  const searchInput = document.getElementById('dict-search');
  const resultsDiv = document.getElementById('dict-results');
  const statusDiv = document.getElementById('dict-status');
  const modeRadios = document.querySelectorAll('input[name="dict-mode"]');
  const clearBtn = document.getElementById('clear-search');

  // 1. INITIALIZATION
  async function init() {
    try {
      const response = await fetch(FETCH_URL);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      dictionaryData = await response.json();
      
      buildEnglishIndex();
      
      if(window.location.hash) {
        const query = decodeURIComponent(window.location.hash.substring(1));
        searchInput.value = query;
        performSearch(query);
      } else {
        // Show nothing initially for a clean look
        statusDiv.textContent = `Loaded ${dictionaryData.length} entries. Ready to search.`;
      }

    } catch (e) {
      statusDiv.textContent = 'Error loading dictionary: ' + e.message;
      console.error(e);
    }
  }

  // 2. INDEXING
  function buildEnglishIndex() {
    dictionaryData.forEach(entry => {
      let glosses = [];
      if (Array.isArray(entry.ge)) {
        glosses = entry.ge;
      } else if (typeof entry.ge === 'string') {
        glosses = [entry.ge];
      }

      glosses.forEach(gloss => {
        const keywords = gloss.split(/[,;]/).map(s => s.trim().toLowerCase());
        keywords.forEach(word => {
          if (!word) return;
          if (!englishIndex[word]) englishIndex[word] = [];
          englishIndex[word].push(entry);
        });
      });
    });
  }

  // 3. SEARCH
  function performSearch(query) {
    resultsDiv.innerHTML = '';
    const q = query.toLowerCase().trim();

    if (!q) {
      statusDiv.textContent = "Type to search...";
      return;
    }

    history.replaceState(null, null, '#' + query);

    if (currentMode === 'borlish') {
      const matches = dictionaryData.filter(entry => {
        return entry.lx.toLowerCase().includes(q);
      });
      
      if (matches.length === 0) {
        statusDiv.textContent = 'No matches found.';
      } else {
        statusDiv.textContent = `Found ${matches.length} matches.`;
        renderEntries(matches);
      }

    } else {
      const matches = Object.keys(englishIndex).filter(enWord => enWord.includes(q)).sort();
      
      if (matches.length === 0) {
        statusDiv.textContent = 'No English matches found.';
      } else {
        statusDiv.textContent = `Found ${matches.length} English terms.`;
        renderEnglishResults(matches);
      }
    }
  }

  // 4. RENDERING
  function renderEntries(entries) {
    const fragment = document.createDocumentFragment();
    entries.forEach(entry => {
      const el = document.createElement('div');
      el.className = 'dict-entry';
      
      let glossHtml = Array.isArray(entry.ge) ? entry.ge.join(', ') : entry.ge;

      let mnHtml = '';
      if (entry.mn) {
        let links = [];
        const mnArr = Array.isArray(entry.mn) ? entry.mn : [entry.mn];
        mnArr.forEach(ref => {
          links.push(`<a href="#${ref}" class="mn-link" data-ref="${ref}">${ref}</a>`);
        });
        mnHtml = `<div class="dict-meta"><span class="dict-label">See also:</span> ${links.join(', ')}</div>`;
      }

      let etHtml = entry.et ? `<div class="dict-meta"><span class="dict-label">Etymology:</span> ${entry.et}</div>` : '';

      let exHtml = '';
      if (entry.examples && entry.examples.length > 0) {
        exHtml = '<div class="dict-meta"><span class="dict-label">Examples:</span>';
        entry.examples.forEach(ex => {
          exHtml += `<div class="dict-example">
            <span class="dict-vernacular">${ex.vernacular}</span> 
            <span class="dict-translation">"${ex.english}"</span>
          </div>`;
        });
        exHtml += '</div>';
      }

      el.innerHTML = `
        <div class="dict-headword-line">
          <span class="dict-lx">${entry.lx}</span>
          ${entry.hm ? `<span class="dict-hm">${entry.hm}</span>` : ''}
          <span class="dict-ps">${entry.ps || ''}</span>
        </div>
        <div class="dict-ge">${glossHtml}</div>
        ${etHtml}
        ${mnHtml}
        ${exHtml}
      `;
      fragment.appendChild(el);
    });
    resultsDiv.appendChild(fragment);
  }

  function renderEnglishResults(englishWords) {
    const limit = 50; 
    const list = englishWords.slice(0, limit);
    
    list.forEach(word => {
      const container = document.createElement('div');
      container.className = 'english-index-item';
      
      const header = document.createElement('div');
      header.className = 'english-keyword';
      header.textContent = word;
      
      const refsDiv = document.createElement('div');
      refsDiv.className = 'english-refs';
      
      const entries = englishIndex[word];
      entries.forEach(entry => {
        const link = document.createElement('a');
        link.href = `#${entry.lx}`;
        link.className = 'mn-link';
        link.style.marginRight = '15px';
        link.textContent = entry.lx + (entry.hm ? ` ${entry.hm}` : '');
        link.addEventListener('click', (e) => {
           e.preventDefault();
           document.querySelector('input[value="borlish"]').click();
           searchInput.value = entry.lx;
           performSearch(entry.lx);
        });
        refsDiv.appendChild(link);
      });

      container.appendChild(header);
      container.appendChild(refsDiv);
      resultsDiv.appendChild(container);
    });

    if (englishWords.length > limit) {
      const more = document.createElement('div');
      more.style.color = '#828282';
      more.style.fontStyle = 'italic';
      more.style.marginTop = '10px';
      more.textContent = `...and ${englishWords.length - limit} more.`;
      resultsDiv.appendChild(more);
    }
  }

  // 5. EVENT LISTENERS
  searchInput.addEventListener('input', (e) => {
    performSearch(e.target.value);
  });

  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    performSearch('');
    searchInput.focus();
  });

  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      currentMode = e.target.value;
      performSearch(searchInput.value);
    });
  });

  resultsDiv.addEventListener('click', (e) => {
    if (e.target.classList.contains('mn-link')) {
      e.preventDefault();
      const ref = e.target.getAttribute('data-ref');
      if (currentMode === 'english') {
        document.querySelector('input[value="borlish"]').click();
      }
      searchInput.value = ref;
      performSearch(ref);
      window.scrollTo(0,0);
    }
  });

  window.addEventListener('hashchange', () => {
    const query = decodeURIComponent(window.location.hash.substring(1));
    if (query !== searchInput.value) {
      searchInput.value = query;
      performSearch(query);
    }
  });

  init();
})();
</script>