// Borlish Word of the Day — picks a deterministic daily entry from the
// dictionary, restricted to entries that carry at least one usable example
// sentence. Stable across reloads within the same UTC day; rotates at 00:00 UTC.
(function () {
  'use strict';

  var PS_LABELS = {
    'n': 'noun',
    'r v': 'verb (-r)',
    'ar v': 'verb (-ar)',
    'ir1 v': 'verb (-ir, group 1)',
    'ir2 v': 'verb (-ir, group 2)',
    'v rfl': 'reflexive verb',
    'adj': 'adjective',
    'adv': 'adverb',
    'prep': 'preposition',
    'conj': 'conjunction',
    'det': 'determiner',
    'exc': 'exclamation',
    'interj': 'interjection',
    'pron': 'pronoun',
    'article': 'article',
    'num': 'numeral',
    'question word': 'question word'
  };

  function psLabel(ps) {
    return ps ? (PS_LABELS[ps] || ps) : '';
  }

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // Complete examples from the entry's own senses (not its subentries, whose
  // examples illustrate a different headword).
  function usableExamples(entry) {
    var senses = entry.senses || [];
    var usable = [];
    for (var s = 0; s < senses.length; s++) {
      var examples = senses[s].examples || [];
      for (var i = 0; i < examples.length; i++) {
        var ex = examples[i];
        if (ex && ex.vernacular && ex.english) usable.push(ex);
      }
    }
    return usable;
  }

  // Pick a stable example from the entry. We choose deterministically so a
  // multi-example entry shows the same example all day, but if the entry is
  // picked again on a future day, a different example may surface.
  function pickExample(entry, daySeed) {
    var usable = usableExamples(entry);
    if (!usable.length) return null;
    return usable[daySeed % usable.length];
  }

  function entryHasUsableExample(entry) {
    return usableExamples(entry).length > 0;
  }

  function dayIndex() {
    var now = new Date();
    var utcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Math.floor(utcMs / 86400000);
  }

  // Knuth multiplicative hash so that consecutive days don't land on adjacent
  // dictionary entries (which would cluster around the same letter).
  function hashDay(day) {
    return (day * 2654435761) >>> 0;
  }

  function psHtml(ps) {
    return ps ? '<span class="wotd-ps">' + escapeHtml(psLabel(ps)) + '</span>' : '';
  }

  // One line per sense; the part of speech moves onto each line when the
  // entry has more than one.
  function glossesHtml(senses) {
    var html = '';
    for (var i = 0; i < senses.length; i++) {
      var ge = (senses[i].ge || []).join(', ');
      html += '<div class="wotd-gloss">'
        + (senses.length > 1 ? psHtml(senses[i].ps) + ' ' : '')
        + escapeHtml(ge) + '</div>';
    }
    return '<div class="wotd-glosses">' + html + '</div>';
  }

  function render(container, entry, dictUrl) {
    var body = container.querySelector('#wotd-body');
    if (!body) return;

    var day = dayIndex();
    var example = pickExample(entry, day);
    var senses = entry.senses || [];

    var headword = escapeHtml(entry.lx);
    var hm = entry._displayHm || entry.hm;
    var hmHtml = hm ? ' <span class="wotd-hm">' + escapeHtml(hm) + '</span>' : '';
    var headPsHtml = senses.length === 1 ? psHtml(senses[0].ps) : '';
    var glossHtml = glossesHtml(senses);

    var exampleHtml = '';
    if (example) {
      exampleHtml =
        '<div class="wotd-example">' +
          '<div class="wotd-example-vernacular">' + escapeHtml(example.vernacular) + '</div>' +
          '<div class="wotd-example-english">' + escapeHtml(example.english) + '</div>' +
        '</div>';
    }

    // First paragraph only; the full etymology is a click away.
    var etymHtml = '';
    if (entry.et) {
      etymHtml = '<div class="wotd-etym"><span class="wotd-etym-label">Etymology:</span> ' +
        escapeHtml(String(entry.et).split(/\n{2,}/)[0]) + '</div>';
    }

    var linkHref = dictUrl + '#q=' + encodeURIComponent('"' + entry.lx + '"');
    var linkHtml = '<a class="wotd-link" href="' + linkHref + '">View in dictionary &rarr;</a>';

    body.innerHTML =
      '<div class="wotd-headword-row">' +
        '<span class="wotd-headword">' + headword + '</span>' + hmHtml + ' ' + headPsHtml +
      '</div>' +
      glossHtml +
      exampleHtml +
      etymHtml +
      linkHtml;
  }

  function showError(container, msg) {
    var body = container.querySelector('#wotd-body');
    if (body) body.innerHTML = '<p class="wotd-error">' + escapeHtml(msg) + '</p>';
  }

  async function init() {
    var container = document.getElementById('wotd');
    if (!container) return;
    var fetchUrl = container.getAttribute('data-fetch-url');
    var dictUrl = container.getAttribute('data-dict-url') || '/boralverse/borlish-dictionary/';
    if (!fetchUrl) {
      showError(container, 'No dictionary URL configured.');
      return;
    }
    try {
      var response = await fetch(fetchUrl);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var data = await response.json();
      var eligible = [];
      for (var i = 0; i < data.length; i++) {
        if (entryHasUsableExample(data[i])) eligible.push(data[i]);
      }
      if (!eligible.length) {
        showError(container, 'No entries with example sentences found.');
        return;
      }
      var idx = hashDay(dayIndex()) % eligible.length;
      render(container, eligible[idx], dictUrl);
    } catch (e) {
      showError(container, 'Could not load dictionary: ' + e.message);
      console.error(e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
