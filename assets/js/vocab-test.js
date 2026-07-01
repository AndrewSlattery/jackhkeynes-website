// vocab-test.js — adaptive-ready vocabulary-size test (calibration version)
// Administers the curated rounds (in order, easy -> rare), fits a guessing-floor
// sigmoid to the per-round scores, and reports an estimated vocabulary size.
// "Skip to Round 5" runs a standalone mini-mode over just the rarest round,
// reporting only the score and missed words (no vocab estimate/chart).
// Vanilla JS, no dependencies. Styling lives in _sass/_vocab-test.scss.
// All copy lives in _data/vocab_test_text.yml (served as vocab-test-text.json) —
// this file only supplies the dynamic values it's templated with.
//
// Embed:  <div id="vocab-test-app" data-json-url="/assets/data/vocab-test-data.json"
//              data-text-url="/assets/data/vocab-test-text.json"></div>
//         <script defer src="/assets/js/vocab-test.js"></script>
// Or set window.VOCAB_TEST_DATA / window.VOCAB_TEST_TEXT before this script runs
// to skip the corresponding fetch.

(function () {
  'use strict';

  var CONTAINER_ID = 'vocab-test-app';

  // ---------- utilities ----------
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function commas(n) { return Math.round(n).toLocaleString('en-US'); }
  function roundTo(n, step) { return Math.round(n / step) * step; }

  // Fills {name}-style placeholders in a copy string, e.g. fmt('Word {i} of {n}', {i:1,n:40}).
  function fmt(str, vars) {
    return String(str).replace(/\{(\w+)\}/g, function (_, k) {
      return (vars && vars[k] != null) ? vars[k] : '';
    });
  }

  // ---------- model ----------
  function pCorrect(z, b, a, c) {
    return c + (1 - c) / (1 + Math.exp(-a * (z - b)));
  }

  // MAP fit of (b, a) on a grid from per-round binomial scores.
  function fitSigmoid(rounds, c) {
    var best = -Infinity, bb = 2.3, ba = 2.0;
    var maxLLperB = {};
    for (var b = -1; b <= 7.0001; b += 0.1) {
      var bkey = b.toFixed(2), bmax = -Infinity;
      for (var a = 0.3; a <= 5.0001; a += 0.1) {
        var ll = 0;
        for (var i = 0; i < rounds.length; i++) {
          var r = rounds[i];
          var p = pCorrect(r.zipf, b, a, c);
          p = Math.min(1 - 1e-9, Math.max(1e-9, p));
          ll += r.k * Math.log(p) + (r.n - r.k) * Math.log(1 - p);
        }
        // weak priors keep the fit sane with only a few points
        ll += -0.5 * Math.pow((b - 2.3) / 2.0, 2) - 0.5 * Math.pow((a - 2.0) / 1.5, 2);
        if (ll > bmax) bmax = ll;
        if (ll > best) { best = ll; bb = b; ba = a; }
      }
      maxLLperB[bkey] = bmax;
    }
    var bLo = bb, bHi = bb;
    for (var k in maxLLperB) {
      if (maxLLperB[k] >= best - 1.92) {            // ~95% profile interval (1 df)
        var v = parseFloat(k);
        if (v < bLo) bLo = v;
        if (v > bHi) bHi = v;
      }
    }
    return { b: bb, a: ba, bLo: bLo, bHi: bHi };
  }

  function vocabAt(curve, z) {
    if (z <= curve[0][0]) return curve[0][1];
    if (z >= curve[curve.length - 1][0]) return curve[curve.length - 1][1];
    for (var i = 1; i < curve.length; i++) {
      if (curve[i][0] >= z) {
        var z0 = curve[i - 1][0], c0 = curve[i - 1][1], z1 = curve[i][0], c1 = curve[i][1];
        return c0 + (c1 - c0) * (z - z0) / (z1 - z0);
      }
    }
    return curve[curve.length - 1][1];
  }

  // ---------- flow ----------
  function buildQuestions(data, roundsList) {
    // Keep the rounds in their curated order (easy -> rare). Shuffle only the
    // items within each round, plus each question's answer options.
    // roundsList lets a caller run a subset of rounds (e.g. the Round 5 mini-mode).
    var list = roundsList || data.rounds;
    var qs = [];
    list.forEach(function (rd) {
      shuffle(rd.items.slice()).forEach(function (it) {
        var opts = it.options.map(function (o, i) { return { text: o, correct: i === it.answer }; });
        shuffle(opts);
        qs.push({ round: rd.round, zipf: rd.target_zipf, word: it.word, pos: it.pos, options: opts });
      });
    });
    return qs;
  }

  function start(root, data, text) {
    var state = {
      data: data, text: text, questions: buildQuestions(data), i: 0, answers: [],
      mode: 'full', miniRounds: null
    };
    intro(root, state);
  }

  function intro(root, state) {
    var t = state.text.intro;
    var n = state.questions.length;
    root.innerHTML =
      '<div class="vt"><div class="vt-card vt-center">' +
      '<h2 class="vt-h">' + esc(t.heading) + '</h2>' +
      '<p class="vt-muted" style="max-width:460px;margin:0 auto 20px;">' +
        esc(fmt(t.blurb, { n: n })) + '</p>' +
      '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
        '<button class="vt-btn" id="vt-begin">' + esc(t.begin_btn) + '</button>' +
        '<button class="vt-btn vt-btn-ghost" id="vt-skip-r5">' + esc(t.skip_btn) + '</button>' +
      '</div>' +
      '</div></div>';
    root.querySelector('#vt-begin').addEventListener('click', function () { question(root, state); });
    root.querySelector('#vt-skip-r5').addEventListener('click', function () {
      var r5 = state.data.rounds.filter(function (rd) { return rd.round === 10; });
      if (!r5.length) return;
      state.mode = 'mini';
      state.miniRounds = r5;
      state.questions = buildQuestions(state.data, r5);
      state.i = 0; state.answers = [];
      question(root, state);
    });
  }

  function question(root, state) {
    if (state.i >= state.questions.length) { return results(root, state); }
    var q = state.questions[state.i];
    var t = state.text.question;
    var pct = Math.round(state.i / state.questions.length * 100);

    root.innerHTML =
      '<div class="vt"><div class="vt-card">' +
      '<div class="vt-progress"><div class="vt-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="vt-counter">' + esc(fmt(t.counter, { i: state.i + 1, n: state.questions.length })) + '</div>' +
      '<div class="vt-word">' + esc(q.word) + '</div>' +
      '<div class="vt-pos">' + esc(q.pos) + '</div>' +
      '<div class="vt-options" id="vt-options"></div>' +
      '</div></div>';

    var box = root.querySelector('#vt-options');
    q.options.forEach(function (opt) {
      var btn = document.createElement('button');
      btn.className = 'vt-option';
      btn.type = 'button';
      btn.textContent = opt.text;
      btn.addEventListener('click', function () {
        box.querySelectorAll('.vt-option').forEach(function (b) { b.disabled = true; });
        var right = q.options.filter(function (o) { return o.correct; })[0];
        state.answers.push({
          round: q.round, zipf: q.zipf, word: q.word, pos: q.pos, correct: !!opt.correct,
          chosen: opt.text, answer: right ? right.text : ''
        });
        state.i++;
        question(root, state);
      });
      box.appendChild(btn);
    });
    var first = box.querySelector('.vt-option');
    if (first) first.focus();
  }

  function results(root, state) {
    var data = state.data, t = state.text.results;

    // per-round scores, ordered by descending Zipf (easy -> hard)
    var byRound = {};
    state.answers.forEach(function (ans) {
      var key = ans.round;
      if (!byRound[key]) byRound[key] = { round: ans.round, zipf: ans.zipf, k: 0, n: 0 };
      byRound[key].n++;
      if (ans.correct) byRound[key].k++;
    });
    var rounds = Object.keys(byRound).map(function (k) { return byRound[k]; });
    rounds.sort(function (x, y) { return y.zipf - x.zipf; });
    var rows = rounds.map(function (r) {
      var label = state.text.rounds[r.round] || ('Zipf ' + r.zipf);
      return '<tr><td>' + esc(label) + '</td><td class="vt-r">' + r.k + ' / ' + r.n + '</td></tr>';
    }).join('');
    var table =
      '<table class="vt-table"><thead><tr><th>' + esc(t.table_band_header) + '</th>' +
        '<th class="vt-r">' + esc(t.table_score_header) + '</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>';

    var summary;
    if (state.mode === 'mini') {
      // Round 5 mini-mode: just the score, no fitted vocab estimate or chart.
      summary = '<div class="vt-muted">' + esc(t.mini_label) + '</div>' + table;
    } else {
      var c = data.guessing_c || 0.1;
      var fit = fitSigmoid(rounds, c);
      var curve = data.zipf_curve;
      var vocab = vocabAt(curve, fit.b);
      var disp = roundTo(vocab, vocab > 20000 ? 1000 : 500);
      summary =
        '<div class="vt-muted">' + esc(t.full_label) + '</div>' +
        '<div class="vt-result-num">&asymp; ' + commas(disp) + ' words</div>' +
        renderChart(fit, c, rounds, curve, state.text.chart) +
        table;
    }

    root.innerHTML =
      '<div class="vt">' +
      '<div class="vt-card vt-center">' + summary + '</div>' +
      renderReview(state) +
      '<div class="vt-center" style="margin-top:18px;">' +
        '<button class="vt-btn vt-btn-ghost" id="vt-again">' + esc(t.again_btn) + '</button>' +
      '</div>' +
      '</div>';

    root.querySelector('#vt-again').addEventListener('click', function () {
      state.questions = buildQuestions(data, state.mode === 'mini' ? state.miniRounds : null);
      state.i = 0; state.answers = [];
      question(root, state);
    });
  }

  // ---------- missed-answers review ----------
  function renderReview(state) {
    var t = state.text.review;
    var misses = state.answers.filter(function (a) { return !a.correct; });
    if (!misses.length) {
      return '<div class="vt-card vt-review vt-center" style="margin-top:14px;">' +
        '<p class="vt-muted" style="margin:0;">' + esc(fmt(t.perfect, { n: state.answers.length })) +
        '</p></div>';
    }
    var items = misses.map(function (a) {
      return '<li class="vt-review-item">' +
        '<div class="vt-review-word">' + esc(a.word) +
          ' <span class="vt-review-pos">' + esc(a.pos) + '</span></div>' +
        '<div class="vt-review-line"><span class="vt-ans-correct">' + esc(t.correct_label) + '</span>' +
          '<span>' + esc(a.answer) + '</span></div>' +
        '<div class="vt-review-line vt-review-chosen"><span class="vt-ans-wrong">' + esc(t.chosen_label) + '</span>' +
          '<span>' + esc(a.chosen) + '</span></div>' +
        '</li>';
    }).join('');
    return '<div class="vt-card vt-review" style="margin-top:14px;">' +
      '<h3 class="vt-review-h">' + esc(fmt(t.missed_header, { n: misses.length })) + '</h3>' +
      '<ul class="vt-review-list">' + items + '</ul></div>';
  }

  // ---------- results chart (inline SVG) ----------
  function renderChart(fit, c, rounds, curve, t) {
    var W = 400, H = 220, padL = 56, padR = 14, padT = 14, padB = 30;
    var zMax = 7.5, zMin = -0.5;
    var pw = W - padL - padR, ph = H - padT - padB;
    function X(z) { return padL + (zMax - z) / (zMax - zMin) * pw; }
    function Y(p) { return padT + (1 - p) * ph; }
    var yMid = (padT + (H - padB)) / 2;   // vertical centre of the plot area

    var pts = [];
    for (var z = zMax; z >= zMin - 0.001; z -= 0.2) {
      pts.push(X(z).toFixed(1) + ',' + Y(pCorrect(z, fit.b, fit.a, c)).toFixed(1));
    }
    var floorY = Y(c).toFixed(1);
    var crossX = X(fit.b).toFixed(1);

    var dots = rounds.map(function (r) {
      return '<circle class="vt-dot" cx="' + X(r.zipf).toFixed(1) + '" cy="' + Y(r.k / r.n).toFixed(1) +
        '" r="4.5"></circle>';
    }).join('');

    var xticks = [[t.x_axis_common_label, 6.5], ['', 4.5], ['', 2.5], [t.x_axis_rare_label, 0.5]].map(function (tk) {
      var x = X(tk[1]).toFixed(1);
      return '<line class="vt-tickmark" x1="' + x + '" y1="' + (H - padB) + '" x2="' + x + '" y2="' + (H - padB + 4) +
        '"></line>' + (tk[0] ? '<text class="vt-tick" x="' + x + '" y="' + (H - padB + 16) +
        '" font-size="10" text-anchor="middle">' + esc(tk[0]) + '</text>' : '');
    }).join('');

    return '<svg class="vt-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="' + esc(t.aria_label) + '">' +
      '<line class="vt-axis" x1="' + padL + '" y1="' + Y(0) + '" x2="' + (W - padR) + '" y2="' + Y(0) + '"></line>' +
      '<line class="vt-grid" x1="' + padL + '" y1="' + Y(1) + '" x2="' + (W - padR) + '" y2="' + Y(1) + '"></line>' +
      '<line class="vt-axis" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '"></line>' +
      '<text class="vt-tick" x="13" y="' + yMid + '" font-size="10" text-anchor="middle" ' +
        'transform="rotate(-90 13 ' + yMid + ')">' + esc(t.y_axis_label) + '</text>' +
      '<text class="vt-tick" x="' + (padL - 6) + '" y="' + (Y(1) + 3) + '" font-size="10" text-anchor="end">100%</text>' +
      '<text class="vt-tick" x="' + (padL - 6) + '" y="' + (Y(0.5) + 3) + '" font-size="10" text-anchor="end">50%</text>' +
      '<text class="vt-tick" x="' + (padL - 6) + '" y="' + (Y(0) + 3) + '" font-size="10" text-anchor="end">0%</text>' +
      '<line class="vt-floor" x1="' + padL + '" y1="' + floorY + '" x2="' + (W - padR) + '" y2="' + floorY + '"></line>' +
      '<line class="vt-cross" x1="' + crossX + '" y1="' + padT + '" x2="' + crossX + '" y2="' + (H - padB) + '"></line>' +
      '<polyline class="vt-curve" points="' + pts.join(' ') + '"></polyline>' +
      dots + xticks +
      '</svg>';
  }

  // ---------- init ----------
  function init() {
    var root = document.getElementById(CONTAINER_ID);
    if (!root) return;

    function loadJSON(url) {
      return fetch(url).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      });
    }
    function loadText() {
      if (window.VOCAB_TEST_TEXT) return Promise.resolve(window.VOCAB_TEST_TEXT);
      var textUrl = root.getAttribute('data-text-url');
      if (!textUrl) return Promise.reject(new Error('No text source configured.'));
      return loadJSON(textUrl);
    }
    function fail(e) {
      root.innerHTML = '<p class="vt-muted">Could not load the test (' + esc(e.message) + ').</p>';
    }

    if (window.VOCAB_TEST_DATA) {
      loadText().then(function (text) { start(root, window.VOCAB_TEST_DATA, text); }).catch(fail);
      return;
    }
    var dataUrl = root.getAttribute('data-json-url');
    if (!dataUrl) { root.innerHTML = '<p class="vt-muted">No data source configured.</p>'; return; }

    Promise.all([loadJSON(dataUrl), loadText()])
      .then(function (r) { start(root, r[0], r[1]); })
      .catch(fail);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
