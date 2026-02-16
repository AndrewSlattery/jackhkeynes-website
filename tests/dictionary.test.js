/**
 * @jest-environment jsdom
 */

// Mock fetch globally
global.fetch = jest.fn();

describe('Borlish Dictionary', () => {
  let Dictionary;
  let mockData;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = `
      <div id="borlish-dictionary" data-fetch-url="/assets/boralverse/borlish-dictionary.json">
        <input type="text" id="dict-search" />
        <button id="clear-search">Clear</button>
        <div id="dict-status"></div>
        <div id="dict-results"></div>
        <input type="radio" name="dict-mode" value="borlish" checked />
        <input type="radio" name="dict-mode" value="english" />
      </div>
    `;

    // Mock Dictionary Data
    mockData = [
      { lx: 'glarb', ge: 'a small creature', ps: 'n' },
      { lx: 'blorp', ge: ['to jump', 'to hop'], ps: 'v' },
      { lx: 'zort', ge: 'sound of a horn', ps: 'interj' }
    ];

    fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    // Mock window.scrollTo
    window.scrollTo = jest.fn();

    // Reset modules to re-execute IIFE
    jest.resetModules();
    Dictionary = require('../assets/js/dictionary.js');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Helper to wait for promises to settle
  const flushPromises = () => new Promise(resolve => setTimeout(resolve, 0));

  test('initializes and fetches data', async () => {
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith('/assets/boralverse/borlish-dictionary.json');

    // Check if status is updated (assuming successful load)
    const status = document.getElementById('dict-status');
    expect(status.textContent).toBe('3 entries.');
  });

  test('searches for a Borlish word', async () => {
    await flushPromises(); // Wait for init

    // Simulate user input
    const input = document.getElementById('dict-search');
    input.value = 'glarb';
    input.dispatchEvent(new Event('input'));

    const status = document.getElementById('dict-status');
    const results = document.getElementById('dict-results');

    expect(status.textContent).toContain('Found 1 match');
    expect(results.innerHTML).toContain('glarb');
    expect(results.innerHTML).toContain('a small creature');
  });

  test('searches for an English word', async () => {
    await flushPromises(); // Wait for init

    // Switch to English mode
    const englishRadio = document.querySelector('input[value="english"]');
    englishRadio.checked = true;
    englishRadio.dispatchEvent(new Event('change'));

    // Search
    const input = document.getElementById('dict-search');
    input.value = 'jump';
    input.dispatchEvent(new Event('input'));

    const results = document.getElementById('dict-results');
    // In English mode, we see the English keyword and links to Borlish words
    expect(results.innerHTML).toContain('jump');
    expect(results.innerHTML).toContain('blorp');
  });

  test('handles strict matching with quotes', async () => {
    await flushPromises(); // Wait for init

    const input = document.getElementById('dict-search');
    input.value = '"glarb"';
    input.dispatchEvent(new Event('input'));

    const results = document.getElementById('dict-results');
    expect(results.innerHTML).toContain('glarb');

    // Test that partial match fails in strict mode
    input.value = '"gla"'; // Should not match 'glarb'
    input.dispatchEvent(new Event('input'));
    expect(results.innerHTML).toBe('');
    expect(document.getElementById('dict-status').textContent).toBe('No matches found.');
  });

  test('clears search', async () => {
     await flushPromises(); // Wait for init
     const input = document.getElementById('dict-search');
     input.value = 'glarb';
     input.dispatchEvent(new Event('input'));

     const clearBtn = document.getElementById('clear-search');
     clearBtn.click();

     expect(input.value).toBe('');
     expect(document.getElementById('dict-status').textContent).toBe('Type to search...');
  });

  test('handles failed fetch', async () => {
    // Override fetch mock for this test
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 404
    });

    // Re-require to trigger init again with failed fetch
    jest.resetModules();
    Dictionary = require('../assets/js/dictionary.js');

    await flushPromises();

    const status = document.getElementById('dict-status');
    expect(status.textContent).toContain('Error loading dictionary');
  });
});
