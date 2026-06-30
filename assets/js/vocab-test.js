// vocab-test.js — adaptive-ready vocabulary-size test (calibration version)
// Administers the curated rounds, fits a guessing-floor sigmoid to the per-round
// scores, and reports an estimated vocabulary size. Vanilla JS, no dependencies.
//
// Embed:  <div id="vocab-test-app" data-json-url="/assets/data/vocab-test-data.json"></div>
//         <script defer src="/assets/js/vocab-test.js"></script>
// Or set window.VOCAB_TEST_DATA before this script runs (used by preview.html).

(function () {
  'use strict';

  var CONTAINER_ID = 'vocab-test-app';

  // round number -> human label (by P(known) target)
  var ROUND_META = {
    90: 'Everyday words',
    70: 'Common words',
    50: 'Less common words',
    30: 'Rare words'
  };

  var CSS =
    '.vt{max-width:640px;margin:0 auto;line-height:1.6;}' +
    '.vt-card{background:var(--vt-card,#fff);border:1px solid var(--vt-border,#e8e8e8);border-radius:10px;padding:26px 28px;}' +
    '.vt-muted{color:var(--vt-muted,#6b6b6b);}' +
    '.vt-h{font-size:1.5em;font-weight:600;margin:0 0 12px;}' +
    '.vt-progress{height:6px;background:var(--vt-track,#ececec);border-radius:3px;overflow:hidden;margin-bottom:8px;}' +
    '.vt-progress-fill{height:100%;background:var(--vt-accent,#3f8a4f);width:0;transition:width .25s ease;}' +
    '.vt-counter{font-size:.82em;color:var(--vt-muted,#6b6b6b);margin-bottom:18px;}' +
    '.vt-word{font-size:2em;font-weight:600;margin:4px 0 0;word-break:break-word;}' +
    '.vt-pos{color:var(--vt-muted,#6b6b6b);font-style:italic;margin:0 0 20px;}' +
    '.vt-options{display:flex;flex-direction:column;gap:9px;}' +
    '.vt-option{text-align:left;padding:12px 15px;border:1px solid var(--vt-border,#e8e8e8);border-radius:8px;' +
      'background:var(--vt-option-bg,#fff);cursor:pointer;font:inherit;color:inherit;transition:background .12s,border-color .12s;}' +
    '.vt-option:hover{background:var(--vt-accent-soft,#eef6ef);border-color:var(--vt-accent,#3f8a4f);}' +
    '.vt-option:disabled{cursor:default;opacity:.55;}' +
    '.vt-btn{display:inline-block;padding:11px 24px;background:var(--vt-accent,#3f8a4f);color:var(--vt-btn-fg,#fff);border:none;' +
      'border-radius:8px;font:inherit;font-size:1em;cursor:pointer;}' +
    '.vt-btn:hover{filter:brightness(1.06);}' +
    '.vt-btn-ghost{background:none;color:var(--vt-accent,#3f8a4f);border:1px solid var(--vt-accent,#3f8a4f);}' +
    '.vt-result-num{font-size:2.7em;font-weight:700;color:var(--vt-accent,#3f8a4f);line-height:1.05;}' +
    '.vt-table{width:100%;border-collapse:collapse;margin:18px 0;font-size:.93em;}' +
    '.vt-table th,.vt-table td{padding:7px 8px;border-bottom:1px solid var(--vt-border,#e8e8e8);text-align:left;}' +
    '.vt-table th{font-weight:600;}' +
    '.vt-table td.vt-r,.vt-table th.vt-r{text-align:right;}' +
    '.vt-chart{width:100%;height:auto;display:block;margin:6px 0 4px;}' +
    '.vt-chart .vt-curve{fill:none;stroke:var(--vt-accent,#3f8a4f);stroke-width:2.5;}' +
    '.vt-chart .vt-dot{fill:var(--vt-accent,#3f8a4f);}' +
    '.vt-chart .vt-cross{stroke:var(--vt-accent,#3f8a4f);stroke-dasharray:4 3;opacity:.5;}' +
    '.vt-chart .vt-axis{stroke:var(--vt-axis,#ddd);}' +
    '.vt-chart .vt-grid{stroke:var(--vt-grid,#eee);}' +
    '.vt-chart .vt-floor{stroke:var(--vt-floor,#ccc);stroke-dasharray:3 3;}' +
    '.vt-chart .vt-tickmark{stroke:var(--vt-tickmark,#bbb);}' +
    '.vt-chart .vt-tick{fill:var(--vt-tick,#888);}' +
    '.vt-note{font-size:.82em;color:var(--vt-muted,#6b6b6b);margin-top:16px;}' +
    '.vt-center{text-align:center;}';

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

  function injectStyles() {
    if (document.getElementById('vt-styles')) return;
    var s = document.createElement('style');
    s.id = 'vt-styles';
    s.textContent = CSS;
    document.head.appendChild(s);
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
  function buildQuestions(data) {
    var qs = [];
    data.rounds.forEach(function (rd, ri) {
      rd.items.forEach(function (it) {
        var opts = it.options.map(function (o, i) { return { text: o, correct: i === it.answer }; });
        shuffle(opts);
        qs.push({ ri: ri, round: rd.round, zipf: rd.target_zipf, word: it.word, pos: it.pos, options: opts });
      });
    });
    return shuffle(qs);
  }

  function start(root, data) {
    var state = { data: data, questions: buildQuestions(data), i: 0, answers: [] };
    intro(root, state);
  }

  function intro(root, state) {
    var n = state.questions.length;
    root.innerHTML =
      '<div class="vt"><div class="vt-card vt-center">' +
      '<h2 class="vt-h">How big is your English vocabulary?</h2>' +
      '<p class="vt-muted" style="max-width:460px;margin:0 auto 20px;">' +
      'You\'ll see ' + n + ' words, from everyday to rare. For each, pick the definition you think is right ' +
      '&mdash; <strong>guess if you\'re unsure</strong>. Takes about five minutes; your estimate appears at the end.</p>' +
      '<button class="vt-btn" id="vt-begin">Begin</button>' +
      '</div></div>';
    root.querySelector('#vt-begin').addEventListener('click', function () { question(root, state); });
  }

  function question(root, state) {
    if (state.i >= state.questions.length) { return results(root, state); }
    var q = state.questions[state.i];
    var pct = Math.round(state.i / state.questions.length * 100);

    root.innerHTML =
      '<div class="vt"><div class="vt-card">' +
      '<div class="vt-progress"><div class="vt-progress-fill" style="width:' + pct + '%"></div></div>' +
      '<div class="vt-counter">Word ' + (state.i + 1) + ' of ' + state.questions.length + '</div>' +
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
        state.answers.push({ ri: q.ri, correct: !!opt.correct });
        state.i++;
        question(root, state);
      });
      box.appendChild(btn);
    });
    var first = box.querySelector('.vt-option');
    if (first) first.focus();
  }

  function results(root, state) {
    var data = state.data, c = data.guessing_c || 0.1;

    // per-round scores, ordered by descending Zipf (easy -> hard)
    var byRound = {};
    state.answers.forEach(function (ans) {
      var rd = data.rounds[ans.ri];
      var key = ans.ri;
      if (!byRound[key]) byRound[key] = { round: rd.round, zipf: rd.target_zipf, k: 0, n: 0 };
      byRound[key].n++;
      if (ans.correct) byRound[key].k++;
    });
    var rounds = Object.keys(byRound).map(function (k) { return byRound[k]; });
    rounds.sort(function (x, y) { return y.zipf - x.zipf; });

    var fit = fitSigmoid(rounds, c);
    var curve = data.zipf_curve;
    var vocab = vocabAt(curve, fit.b);
    var vLo = vocabAt(curve, fit.bHi);   // higher crossover -> fewer words
    var vHi = vocabAt(curve, fit.bLo);

    var disp = roundTo(vocab, vocab > 20000 ? 1000 : 500);
    var rows = rounds.map(function (r) {
      var label = ROUND_META[r.round] || ('Zipf ' + r.zipf);
      return '<tr><td>' + esc(label) + '</td><td class="vt-r">' + r.k + ' / ' + r.n + '</td></tr>';
    }).join('');

    root.innerHTML =
      '<div class="vt"><div class="vt-card vt-center">' +
      '<div class="vt-muted">Estimated vocabulary</div>' +
      '<div class="vt-result-num">&asymp; ' + commas(disp) + ' words</div>' +
      '<div class="vt-muted" style="margin-top:6px;">roughly ' + commas(roundTo(vLo, 500)) + '&ndash;' +
        commas(roundTo(vHi, 500)) + ', of about ' + commas(data.total_attested) + ' in current use</div>' +
      renderChart(fit, c, rounds, curve) +
      '<table class="vt-table"><thead><tr><th>Band</th><th class="vt-r">Your score</th></tr></thead>' +
        '<tbody>' + rows + '</tbody></table>' +
      '<button class="vt-btn vt-btn-ghost" id="vt-again">Try again</button>' +
      '<p class="vt-note">A 40-word estimate from four calibration bands, fitted with a guessing-corrected ' +
        'curve. Treat it as a ballpark, not a precise count.</p>' +
      '</div></div>';

    root.querySelector('#vt-again').addEventListener('click', function () {
      state.questions = buildQuestions(data); state.i = 0; state.answers = [];
      question(root, state);
    });
  }

  // ---------- results chart (inline SVG) ----------
  function renderChart(fit, c, rounds, curve) {
    var W = 400, H = 220, padL = 38, padR = 14, padT = 14, padB = 30;
    var zMax = 7.5, zMin = -0.5;
    var pw = W - padL - padR, ph = H - padT - padB;
    function X(z) { return padL + (zMax - z) / (zMax - zMin) * pw; }
    function Y(p) { return padT + (1 - p) * ph; }

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

    var xticks = [['common', 6.5], ['', 4.5], ['', 2.5], ['rare', 0.5]].map(function (t) {
      var x = X(t[1]).toFixed(1);
      return '<line class="vt-tickmark" x1="' + x + '" y1="' + (H - padB) + '" x2="' + x + '" y2="' + (H - padB + 4) +
        '"></line>' + (t[0] ? '<text class="vt-tick" x="' + x + '" y="' + (H - padB + 16) +
        '" font-size="10" text-anchor="middle">' + t[0] + '</text>' : '');
    }).join('');

    return '<svg class="vt-chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
      'aria-label="Your fitted probability-correct curve across word rarity.">' +
      '<line class="vt-axis" x1="' + padL + '" y1="' + Y(0) + '" x2="' + (W - padR) + '" y2="' + Y(0) + '"></line>' +
      '<line class="vt-grid" x1="' + padL + '" y1="' + Y(1) + '" x2="' + (W - padR) + '" y2="' + Y(1) + '"></line>' +
      '<line class="vt-axis" x1="' + padL + '" y1="' + padT + '" x2="' + padL + '" y2="' + (H - padB) + '"></line>' +
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
    injectStyles();
    if (window.VOCAB_TEST_DATA) { start(root, window.VOCAB_TEST_DATA); return; }
    var url = root.getAttribute('data-json-url');
    if (!url) { root.innerHTML = '<p class="vt-muted">No data source configured.</p>'; return; }
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).then(function (d) { start(root, d); })
      .catch(function (e) {
        root.innerHTML = '<p class="vt-muted">Could not load the test (' + esc(e.message) + ').</p>';
      });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
