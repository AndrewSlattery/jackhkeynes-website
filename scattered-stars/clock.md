---
layout: page
title: The Zigzag Dial
permalink: /scattered-stars/clock/
description: A live clock in metric time — 100 seconds to the minute, 50 minutes to the hour, 20 hours to the day
---

A clock for a time system of 100 seconds to the minute, 50 minutes to the hour
and 20 hours to the day, where the day itself is of ordinary length. It is
showing the current time, converted from yours.

<div id="zigzag-clock"></div>

<script defer src="{{ '/assets/js/zigzag-clock.js' | relative_url }}"></script>

The speed control runs the clock fast, which is the only practical way to watch
the hour hand move: at ×100 a whole day goes by in about a quarter of an hour.

## The units

| Unit | Contains | Real duration |
|---|---|---|
| 1 second | — | 0.864 s exactly |
| 1 minute | 100 seconds | 1 min 26.4 s |
| 1 hour | 50 minutes | 1 h 12 min |
| 1 day | 20 hours | 24 h |

The day holds exactly 100,000 seconds, which is the single most useful fact in
the system — every other conversion follows from it, and none of them rounds.
The tick rate works out at exactly 625/9 beats per minute; set a metronome to 69
for a close approximation.

## Reading the dial

The ring is a single closed polygon of a hundred vertices, and each hand
terminates on the radius it reads:

- **The hundred vertices are the seconds**, 3.6° apart. The second hand's
  lozenge tip spans peak to trough so that it reads convincingly against both —
  a plain straight hand appears to fall short every other second.
- **The fifty outward peaks are the minutes**, 7.2° apart, which the minute hand
  reaches into.
- **The ten long peaks are the hours**, 36° apart. This is the half-day face,
  the direct analogue of our twelve-hour clock, so the hour hand goes round
  twice a day and the aperture at the foot of the dial shows which half you are
  in — marked *i* and *ii* here, for want of names. That hour hand turns once
  every twelve real hours, which is incidentally the exact rate of our own.

Because ten is even, every hour mark falls on a minute peak and the alternation
stays symmetric. Parity is legible too: a glance tells you whether the second
count is even or odd, which is worth knowing in a base-100 system where halving
is the natural first operation.

Half past is 25 minutes and causes no trouble. A quarter past would be 12.5
minutes, so it does not exist — the vernacular runs on fifths and tenths
instead, *ten past* for a fifth of an hour and *five past* for a tenth. Quarters
survive only at the level of the day, since 20 divides by four.

## The day count

The five digits under the readout are the same instant written as a plain count
of seconds since midnight, from `00000` to `99999`. Because the day is exactly
100,000 seconds long, that count is also the fraction of the day elapsed in
hundred-thousandths: `38241` is 38.241% of the way through, and is the same
moment as 7:32:41. It takes no separators, and durations in it add without
carrying — which makes it the natural format for anything machine-facing.
