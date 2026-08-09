// zigzag-clock.js — the zigzag dial: an analogue and digital clock for a time
// system of 100 seconds to the minute, 50 minutes to the hour, and 20 hours to
// the day, where the day itself is of ordinary length.
//
// The day holds exactly 100,000 of these seconds, so one of them is exactly
// 864 ms and every conversion below is integer arithmetic: there is no rounding
// anywhere between Date.now() and a rendered angle.
//
// The face is the canonical 10-hour half-day dial — the hour hand turns twice a
// day, hour marks fall every tenth vertex, and a small aperture at the foot of
// the dial stands in for am/pm. The ring is one closed 100-vertex polygon in the
// inward-toothed variant: the outer silhouette is the odd seconds, the notches
// are the minutes, and the deepest notches are the hours. Each hand terminates
// on the radius it reads, and the numerals sit outside the ring, in the annulus
// the inverted geometry leaves empty.
//
// Vanilla JS, no dependencies. Styling lives in _sass/_zigzag-clock.scss.
//
// Embed:  <div id="zigzag-clock"></div>
//         <script defer src="/assets/js/zigzag-clock.js"></script>

(function () {
  'use strict';

  var CONTAINER_ID = 'zigzag-clock';

  // ---------- the time system ----------
  var MS_PER_DAY    = 86400000;
  var SEC_PER_MIN   = 100;
  var MIN_PER_HOUR  = 50;
  var HOURS_PER_DAY = 20;
  var SEC_PER_HOUR  = SEC_PER_MIN * MIN_PER_HOUR;     // 5,000
  var SEC_PER_DAY   = SEC_PER_HOUR * HOURS_PER_DAY;   // 100,000
  var SEC_PER_HALF  = SEC_PER_DAY / 2;                // 50,000
  var MS_PER_SEC    = MS_PER_DAY / SEC_PER_DAY;       // 864, exactly

  // The two halves of the day. Rename both of these together if the fiction
  // ever settles on names for them; the aperture wants a single glyph, and the
  // long form is what a screen reader announces.
  var HALF_GLYPH = ['i', 'ii'];
  var HALF_NAME  = ['first half', 'second half'];

  // ---------- conversions (pure) ----------

  // Seconds elapsed since local midnight, as a fraction. Their day equals ours,
  // so on a 23- or 25-hour local day the second stretches rather than the count
  // gaining or losing a chunk: the dial still reads 19:49:99 immediately before
  // local midnight. dayMs is exactly 86,400,000 on every ordinary day, which is
  // what keeps the second exactly 864 ms.
  function dayCountFrom(now) {
    var midnight = new Date(now);
    midnight.setHours(0, 0, 0, 0);
    var next = new Date(midnight);
    next.setDate(next.getDate() + 1);
    next.setHours(0, 0, 0, 0);                        // zones whose midnight moves
    var dayMs = next - midnight;
    var n = (now - midnight) / dayMs * SEC_PER_DAY;
    return (n % SEC_PER_DAY + SEC_PER_DAY) % SEC_PER_DAY;
  }

  // Split a day count into its fields. hour20 is the 20-hour reading (0–19);
  // hour10 is the half-day reading the dial carries, where hour 0 of each half
  // reads as 10 — the analogue of midnight being 12 on our own clocks.
  function fields(count) {
    var N = Math.floor(count);
    var hour20 = Math.floor(N / SEC_PER_HOUR);
    return {
      count:  N,
      hour20: hour20,
      hour10: (hour20 % 10) === 0 ? 10 : hour20 % 10,
      half:   N < SEC_PER_HALF ? 0 : 1,
      minute: Math.floor(N / SEC_PER_MIN) % MIN_PER_HOUR,
      second: N % SEC_PER_MIN
    };
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) { s = '0' + s; }
    return s;
  }

  // Both minutes and seconds are genuine two-digit fields (they reach 49 and
  // 99), so the padding is structural rather than cosmetic.
  function format(count) {
    var t = fields(count);
    return {
      time:   t.hour10 + ':' + pad(t.minute, 2) + ':' + pad(t.second, 2),
      time20: pad(t.hour20, 2) + ':' + pad(t.minute, 2) + ':' + pad(t.second, 2),
      count:  pad(t.count, 5),
      day:    '0.' + pad(t.count, 5),
      half:   HALF_GLYPH[t.half],
      spoken: t.hour10 + ' hours, ' + t.minute + ' minutes, ' + t.second +
              ' seconds, ' + HALF_NAME[t.half]
    };
  }

  // Degrees clockwise from twelve. The minute coefficient is 360/5000 and the
  // hour 360/50000, both exact. The second and minute hands take the floored
  // count so they are always found on a vertex; the hour hand takes the
  // fraction and so moves continuously.
  function angles(count) {
    var N = Math.floor(count);
    return {
      second: 3.6 * (N % SEC_PER_MIN),
      minute: 0.072 * (N % SEC_PER_HOUR),
      hour:   0.0072 * (count % SEC_PER_HALF)
    };
  }

  // ---------- geometry (pure) ----------
  // Every dimension is a fraction of the face radius R, so one viewBox scales
  // from a favicon to a wall.
  var VIEW = 400, CX = 200, CY = 200, R = 180;
  var F = {
    bezel:    1.000,
    numeral:  0.934,   // outside the ring, between the teeth and the bezel
    second:   0.872,   // outer silhouette: the odd seconds
    minute:   0.772,   // notch: the fifty minute divisions
    hour:     0.700,   // deepest notch: the ten hour divisions
    handHour: 0.489,
    aperture: 0.350,
    tail:     0.100,
    arbor:    0.028
  };
  var W = { hour: 0.033, minute: 0.022, second: 0.009, lozenge: 0.019, crossbar: 0.040 };

  function polar(bearingDeg, radius) {
    var a = bearingDeg * Math.PI / 180;
    return [CX + radius * Math.sin(a), CY - radius * Math.cos(a)];
  }

  // One closed polygon, k = 0…99, vertex k at 3.6k degrees, toothed inwards: the
  // odd vertices form a clean fifty-point outer envelope and the even ones notch
  // in behind it, every tenth notch cut deeper for the hour. Vertex 0 is a deep
  // notch at twelve o'clock, so the face is symmetric about the vertical.
  function ringVertices() {
    var out = [];
    for (var k = 0; k < SEC_PER_MIN; k++) {
      var f = (k % 10 === 0) ? F.hour : (k % 2 === 0 ? F.minute : F.second);
      out.push(polar(k * 3.6, f * R));
    }
    return out;
  }

  // ---------- rendering ----------
  function n2(x) { return Math.round(x * 100) / 100; }
  function pt(p) { return n2(p[0]) + ',' + n2(p[1]); }

  // A tapered hand: tip on the ring radius it reads, base at the arbor.
  function handPolygon(cls, lengthFrac, widthFrac) {
    var hw = widthFrac * R / 2;
    return '<polygon class="' + cls + '" points="' +
      CX + ',' + n2(CY - lengthFrac * R) + ' ' +
      n2(CX + hw) + ',' + CY + ' ' + n2(CX - hw) + ',' + CY + '"/>';
  }

  function dialMarkup() {
    var i, points = [];
    var verts = ringVertices();
    for (i = 0; i < verts.length; i++) { points.push(pt(verts[i])); }

    // Numerals 1–10 outside the hour notches, 10 at the top.
    var numerals = '';
    for (i = 1; i <= 10; i++) {
      var q = polar(i * 36, F.numeral * R);
      numerals += '<text class="zz-numeral" x="' + n2(q[0]) + '" y="' + n2(q[1]) +
        '" text-anchor="middle" dominant-baseline="central">' + i + '</text>';
    }

    var apY = CY + F.aperture * R;

    // The second hand: a shaft with a counterweighted tail, a small crossbar
    // where the shaft crosses the hour radius, and a lozenge tip spanning notch
    // to envelope so it reads against both every other second.
    var peakY = CY - F.second * R;
    var troughY = CY - F.minute * R;
    var waistY = (peakY + troughY) / 2;
    var lhw = W.lozenge * R / 2;
    var chw = W.crossbar * R / 2;
    var barY = CY - F.hour * R;

    return '' +
      '<svg class="zz-dial" viewBox="0 0 ' + VIEW + ' ' + VIEW + '" aria-hidden="true" focusable="false">' +
        '<circle class="zz-face" cx="' + CX + '" cy="' + CY + '" r="' + F.bezel * R + '"/>' +
        '<polygon class="zz-ring" points="' + points.join(' ') + '"/>' +
        '<g class="zz-numerals">' + numerals + '</g>' +
        '<rect class="zz-aperture-box" x="' + (CX - 16) + '" y="' + n2(apY - 10) + '" width="32" height="20" rx="4"/>' +
        '<text class="zz-aperture" x="' + CX + '" y="' + n2(apY) + '" text-anchor="middle" dominant-baseline="central">' + HALF_GLYPH[0] + '</text>' +
        '<g class="zz-hour">' + handPolygon('zz-hand-hour', F.handHour, W.hour) + '</g>' +
        '<g class="zz-minute">' + handPolygon('zz-hand-minute', F.minute, W.minute) + '</g>' +
        '<g class="zz-second">' +
          '<line class="zz-hand-second-shaft" x1="' + CX + '" y1="' + n2(CY + F.tail * R) +
            '" x2="' + CX + '" y2="' + n2(waistY) + '" stroke-width="' + n2(W.second * R) + '"/>' +
          '<line class="zz-hand-second-bar" x1="' + n2(CX - chw) + '" y1="' + n2(barY) +
            '" x2="' + n2(CX + chw) + '" y2="' + n2(barY) + '" stroke-width="' + n2(W.second * R) + '"/>' +
          '<polygon class="zz-hand-second" points="' +
            CX + ',' + n2(peakY) + ' ' + n2(CX + lhw) + ',' + n2(waistY) + ' ' +
            CX + ',' + n2(troughY) + ' ' + n2(CX - lhw) + ',' + n2(waistY) + '"/>' +
        '</g>' +
        '<circle class="zz-arbor" cx="' + CX + '" cy="' + CY + '" r="' + n2(F.arbor * R) + '"/>' +
      '</svg>';
  }

  function readoutMarkup() {
    return '' +
      '<div class="zz-readout" role="timer" aria-live="off" aria-label="Loading the time">' +
        '<div class="zz-time">' +
          '<span class="zz-h">10</span><span class="zz-sep">:</span>' +
          '<span class="zz-m">00</span><span class="zz-sep">:</span>' +
          '<span class="zz-s">00</span>' +
          '<span class="zz-half">' + HALF_GLYPH[0] + '</span>' +
        '</div>' +
      '</div>';
  }

  // ---------- the clock ----------
  function init(container) {
    container.innerHTML = '<div class="zz">' + dialMarkup() + readoutMarkup() + '</div>';

    var q = function (sel) { return container.querySelector(sel); };
    var hourHand   = q('.zz-hour');
    var minuteHand = q('.zz-minute');
    var secondHand = q('.zz-second');
    var aperture   = q('.zz-aperture');
    var readout    = q('.zz-readout');
    var elH = q('.zz-h'), elM = q('.zz-m'), elS = q('.zz-s'), elHalf = q('.zz-half');

    function rotate(el, deg) {
      el.setAttribute('transform', 'rotate(' + deg.toFixed(3) + ' ' + CX + ' ' + CY + ')');
    }

    // The deadbeat step: eased over 90 ms with a small overshoot that settles in
    // a further 60 ms. This is the behaviour that makes the time system
    // perceptible, so it is never swept.
    var STEP_MS = 150, C1 = 1.2, C3 = C1 + 1;
    function easeOutBack(t) {
      var u = t - 1;
      return 1 + C3 * u * u * u + C1 * u * u;
    }

    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var lastSecond = -1, lastMinute = -1, tickAt = 0;

    function frame(ts) {
      // Read the system clock afresh every frame. Elapsed time is never
      // accumulated into a counter: a 60 Hz loop adding 16.67 ms a frame would
      // drift visibly within minutes, and 864 ms does not divide evenly into
      // common frame intervals, so an accumulator would alias against the
      // refresh as well.
      var exact = dayCountFrom(new Date());
      var N = Math.floor(exact);
      var still = reduce.matches;

      if (N !== lastSecond) {
        tickAt = ts;
        lastSecond = N;

        var t = fields(N);
        var f = format(N);

        // Only the second changes on most ticks; the rest are guarded so the
        // browser is not asked to rewrite text that has not moved.
        elS.textContent = pad(t.second, 2);
        if (t.hour20 * MIN_PER_HOUR + t.minute !== lastMinute) {
          lastMinute = t.hour20 * MIN_PER_HOUR + t.minute;
          elM.textContent = pad(t.minute, 2);
          elH.textContent = String(t.hour10);
          elHalf.textContent = f.half;
          aperture.textContent = f.half;
          // Once per fictional minute, not per second: at 69 announcements a
          // minute a live region would be unusable.
          readout.setAttribute('aria-label', f.spoken);
        }

        rotate(minuteHand, angles(N).minute);
        if (still) {
          rotate(hourHand, angles(exact).hour);
          rotate(secondHand, angles(N).second);
        }
      }

      if (!still) {
        rotate(hourHand, angles(exact).hour);
        var base = angles(lastSecond).second;
        var p = Math.min(1, (ts - tickAt) / STEP_MS);
        rotate(secondHand, base - 3.6 + 3.6 * easeOutBack(p));
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (typeof document !== 'undefined') {
    var container = document.getElementById(CONTAINER_ID);
    if (container) { init(container); }
  }

  // Export for Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      MS_PER_SEC: MS_PER_SEC,
      SEC_PER_DAY: SEC_PER_DAY,
      dayCountFrom: dayCountFrom,
      fields: fields,
      format: format,
      angles: angles,
      ringVertices: ringVertices
    };
  }
})();
