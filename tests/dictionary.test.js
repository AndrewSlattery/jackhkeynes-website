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

    // Mock Dictionary Data (shape produced by _plugins/dictionary_generator.rb)
    mockData = [
      { lx: 'glarb', senses: [{ ps: 'n', ge: ['a small creature'] }] },
      { lx: 'cart', hm: '1', senses: [{ ps: 'n', ge: ['card'] }] },
      { lx: 'cart', hm: '2', senses: [{ ps: 'adj', ge: ['dear'] }] },
      { lx: 'blorp', senses: [{ ps: 'ar v', ge: ['to jump', 'to hop'] }] },
      { lx: 'zort', senses: [{ ps: 'interj', ge: ['sound of a horn'] }] },
      {
        lx: 'a tug',
        senses: [
          { ps: 'adv', ge: ['for fun'] },
          {
            ps: 'adj', ue: ['archaic'], ge: ['friendly'],
            examples: [{ vernacular: 'Masctig a tug.', english: 'Friendly tickets.' }]
          }
        ],
        et: 'First paragraph.\n\nSecond paragraph.',
        mn: ['cart1', 'nowhere']
      },
      {
        lx: 'alant',
        senses: [{ ps: 'n', ge: ['arrival'] }],
        subentries: [{ lx: 'alant a haun', senses: [{ ps: 'n', ge: ['landfall'] }], et: 'collocation' }]
      },
      { lx: 'Aost', senses: [{ ps: 'n', ge: ['August'] }], sd: ['Months'] }
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
    expect(status.textContent).toBe('8 entries.');
  });

  const search = (query, mode = 'borlish') => {
    const radio = document.querySelector(`input[value="${mode}"]`);
    if (!radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change'));
    }
    const input = document.getElementById('dict-search');
    input.value = query;
    input.dispatchEvent(new Event('input'));
    return document.getElementById('dict-results');
  };

  test('renders each part of speech as its own sense', async () => {
    await flushPromises();
    const results = search('"a tug"');

    const senses = results.querySelectorAll('.dict-sense');
    expect(senses.length).toBe(2);
    expect(senses[0].querySelector('.dict-ps').textContent).toBe('adv');
    expect(senses[0].textContent).toContain('for fun');
    expect(senses[0].textContent).not.toContain('friendly');
    expect(senses[1].querySelector('.dict-ps').textContent).toBe('adj');
    expect(senses[1].querySelector('.dict-usage').textContent).toBe('archaic');
    // The example belongs to the adjective sense only
    expect(senses[0].querySelector('.dict-example')).toBeNull();
    expect(senses[1].querySelector('.dict-example').textContent).toContain('Friendly tickets.');
  });

  test('single-sense entries show the part of speech beside the headword', async () => {
    await flushPromises();
    const results = search('"zort"');

    expect(results.querySelector('.dict-headword-line .dict-ps').textContent).toBe('interj');
    expect(results.querySelector('.dict-senses')).toBeNull();
  });

  test('renders etymology paragraphs', async () => {
    await flushPromises();
    const results = search('"a tug"');

    const meta = results.querySelector('.dict-meta');
    expect(meta.textContent).toContain('First paragraph.');
    expect(meta.querySelector('.dict-para').textContent).toBe('Second paragraph.');
  });

  test('resolves numbered cross-references to homonyms', async () => {
    await flushPromises();
    const results = search('"a tug"');

    const links = results.querySelectorAll('.mn-link');
    expect(links[0].innerHTML).toBe('cart<sup>1</sup>');
    expect(links[0].getAttribute('data-ref')).toBe('cart');
    expect(links[0].classList.contains('mn-dead')).toBe(false);
    expect(links[1].classList.contains('mn-dead')).toBe(true);
  });

  test('finds subentries by their own headword and nests them in the entry', async () => {
    await flushPromises();
    const results = search('"alant a haun"');

    expect(document.getElementById('dict-status').textContent).toBe('Found 1 match.');
    expect(results.querySelector('.dict-lx').textContent).toBe('alant');
    const sub = results.querySelector('.dict-subentry');
    expect(sub.querySelector('.dict-sub-lx').textContent).toBe('alant a haun');
    expect(sub.textContent).toContain('landfall');
    expect(sub.textContent).toContain('collocation');
  });

  test('English results show the part of speech of the matching sense', async () => {
    await flushPromises();
    const results = search('"friendly"', 'english');

    const ref = results.querySelector('.english-refs');
    expect(ref.querySelector('.mn-link').textContent).toBe('a tug');
    expect(ref.querySelector('.ref-ps').textContent).toBe('(adj)');
  });

  test('English results link to subentries', async () => {
    await flushPromises();
    const results = search('landfall', 'english');

    expect(results.querySelector('.mn-link').getAttribute('data-ref')).toBe('alant a haun');
  });

  test('semantic domain tags list every entry in the domain', async () => {
    await flushPromises();
    const results = search('"aost"');

    results.querySelector('.sd-link').click();
    expect(document.getElementById('dict-status').textContent)
      .toBe('Showing 1 entry in the domain "Months".');
    expect(window.location.hash).toBe('#domain=Months');
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
