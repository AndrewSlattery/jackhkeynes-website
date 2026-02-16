/**
 * @jest-environment jsdom
 */

// Mock data
const mockData = [
  { word: "APPLE", category: "Fruit", type: "Pome", result: "A" },
  { word: "BANANA", category: "Fruit", type: "Berry", result: "B" },
  { word: "CARROT", category: "Vegetable", type: "Root", result: "C" },
  { word: "DOG", category: "Animal", type: "Mammal", result: "D" },
  { word: "EAGLE", category: "Animal", type: "Bird", result: "E" },
  { word: "FROG", category: "Animal", type: "Amphibian", result: "F" },
  // Spacer should be filtered out
  { word: null, category: "spacer" }
];

describe('Indicators App', () => {
  let app;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
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
    `;

    // Mock fetch
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve(JSON.stringify(mockData)),
      })
    );

    // Reset modules to clear global state in the app
    jest.resetModules();
    app = require('../assets/js/indicators-app.js');

    // Attach functions to window so inline onclick handlers work
    window.loadCategory = app.loadCategory;
    window.setScope = app.setScope;
    window.handleSearch = app.handleSearch;
    window.toggleGroup = app.toggleGroup;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('initIndicatorApp fetches data and populates categories', async () => {
    await app.initIndicatorApp('dummy.json');

    // Check fetch called
    expect(global.fetch).toHaveBeenCalledWith('dummy.json');

    // Check categories populated
    const categoryList = document.getElementById('category-list');
    const buttons = categoryList.querySelectorAll('.cat-btn');
    // Categories: Animal, Fruit, Vegetable (sorted)
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toBe('Animal');
    expect(buttons[1].textContent).toBe('Fruit');
    expect(buttons[2].textContent).toBe('Vegetable');

    // First category should be active and loaded by default
    expect(buttons[0].classList.contains('active')).toBe(true);
    expect(app.getCurrentCategory()).toBe('Animal');
  });

  test('loadCategory updates display', async () => {
    await app.initIndicatorApp('dummy.json');

    // Load "Fruit"
    app.loadCategory('Fruit');

    expect(app.getCurrentCategory()).toBe('Fruit');

    // Check active button
    const categoryList = document.getElementById('category-list');
    const buttons = Array.from(categoryList.querySelectorAll('.cat-btn'));
    const activeBtn = buttons.find(b => b.classList.contains('active'));
    expect(activeBtn.textContent).toBe('Fruit');

    const display = document.getElementById('display-area');
    const groups = display.querySelectorAll('.ind-group');
    // Fruit has types: Berry, Pome (sorted by key? Pome vs Berry)
    // Logic: sortedKeys = Object.keys(groups).sort(...)
    expect(groups.length).toBe(2);
    expect(groups[0].querySelector('.header-label').textContent).toContain('Berry'); // B comes before P
    expect(groups[1].querySelector('.header-label').textContent).toContain('Pome');
  });

  test('setScope updates active state and placeholder', async () => {
     await app.initIndicatorApp('dummy.json');

     app.setScope('category');

     expect(document.getElementById('scope-category').classList.contains('active')).toBe(true);
     expect(document.getElementById('scope-global').classList.contains('active')).toBe(false);
     expect(document.getElementById('ind-search').placeholder).toContain('Filter within current category');

     app.setScope('header');
     expect(document.getElementById('scope-header').classList.contains('active')).toBe(true);
     expect(document.getElementById('ind-search').placeholder).toContain('Filter by section header');
  });

  test('handleSearch global scope', async () => {
    await app.initIndicatorApp('dummy.json');

    // Search for "APPLE"
    const input = document.getElementById('ind-search');
    input.value = "apple";

    app.handleSearch();

    const summary = document.getElementById('result-summary');
    expect(summary.style.display).toBe('block');
    expect(summary.textContent).toContain('1 result across all categories');

    const display = document.getElementById('display-area');
    // Should show 1 group (Fruit -> Pome)
    const groups = display.querySelectorAll('.ind-group');
    expect(groups.length).toBe(1);
    expect(groups[0].querySelector('.ind-list').textContent).toContain('APPLE');
  });

  test('handleSearch category scope', async () => {
    await app.initIndicatorApp('dummy.json');
    app.loadCategory('Animal');
    app.setScope('category');

    // Search for "DOG" (present in Animal)
    const input = document.getElementById('ind-search');
    input.value = "dog";
    app.handleSearch();

    const display = document.getElementById('display-area');
    // Animal has Mammal, Bird, Amphibian. DOG is Mammal.
    // filterWithinCategory hides non-matching items/groups.
    const groups = display.querySelectorAll('.ind-group'); // All groups are still there in DOM

    // Mammal group should be visible
    const mammalGroup = Array.from(groups).find(g => g.querySelector('.header-label').textContent.includes('Mammal'));
    expect(mammalGroup.style.display).not.toBe('none');
    expect(mammalGroup.textContent).toContain('DOG');

    // Bird group should be hidden or have no visible items
    // Implementation: group.style.display = hasVisible ? '' : 'none';
    const birdGroup = Array.from(groups).find(g => g.querySelector('.header-label').textContent.includes('Bird'));
    expect(birdGroup.style.display).toBe('none');
  });

  test('handleSearch header scope', async () => {
    await app.initIndicatorApp('dummy.json');
    app.loadCategory('Animal');
    app.setScope('header');

    // Search for "Mammal"
    const input = document.getElementById('ind-search');
    input.value = "mammal";
    app.handleSearch();

    const display = document.getElementById('display-area');
    const groups = display.querySelectorAll('.ind-group');

    const mammalGroup = Array.from(groups).find(g => g.querySelector('.header-label').textContent.includes('Mammal'));
    expect(mammalGroup.style.display).not.toBe('none');

    const birdGroup = Array.from(groups).find(g => g.querySelector('.header-label').textContent.includes('Bird'));
    expect(birdGroup.style.display).toBe('none');
  });

  test('handles fetch error', async () => {
    // Mock fetch failure
    global.fetch.mockImplementationOnce(() => Promise.resolve({
      ok: false,
      status: 404
    }));

    await app.initIndicatorApp('dummy.json');

    const display = document.getElementById('display-area');
    expect(display.innerHTML).toContain('Error loading data');
    expect(display.innerHTML).toContain('404');
  });

  test('handles invalid JSON', async () => {
      // Mock fetch success but invalid json
      global.fetch.mockImplementationOnce(() => Promise.resolve({
          ok: true,
          text: () => Promise.resolve("INVALID JSON")
      }));

      await app.initIndicatorApp('dummy.json');
      const display = document.getElementById('display-area');
      // The code catches JSON parse error and throws a new error which is caught by the .catch block
      expect(display.innerHTML).toContain('Error loading data');
      expect(display.innerHTML).toContain('Invalid JSON');
  });
});
