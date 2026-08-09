/**
 * @jest-environment jsdom
 */

// Round-trip and geometry assertions for the zigzag dial's time system.
// The clock's own module guard means requiring it here renders nothing: there
// is no #zigzag-clock container in this DOM, so only the pure helpers load.

const clock = require('../assets/js/zigzag-clock.js');

describe('the time system', () => {
  test('a second is exactly 864 ms and a day exactly 100,000 of them', () => {
    expect(clock.MS_PER_SEC).toBe(864);
    expect(clock.SEC_PER_DAY).toBe(100000);
    expect(clock.MS_PER_SEC * clock.SEC_PER_DAY).toBe(86400000);
  });

  test.each([
    [0,     '00:00:00', '10:00:00', '00000'],
    [38241, '07:32:41', '7:32:41',  '38241'],
    [99999, '19:49:99', '9:49:99',  '99999'],
  ])('count %i reads as %s', (N, time20, time, count) => {
    const f = clock.format(N);
    expect(f.time20).toBe(time20);
    expect(f.time).toBe(time);
    expect(f.count).toBe(count);
  });

  test('the worked example decomposes as 5000h + 100m + s', () => {
    const t = clock.fields(38241);
    expect(t.hour20 * 5000 + t.minute * 100 + t.second).toBe(38241);
    expect([t.hour20, t.minute, t.second]).toEqual([7, 32, 41]);
  });

  test('hour 0 of each half reads as 10 on the half-day face', () => {
    expect(clock.fields(0).hour10).toBe(10);
    expect(clock.fields(50000).hour10).toBe(10);
    expect(clock.fields(0).half).toBe(0);
    expect(clock.fields(49999).half).toBe(0);
    expect(clock.fields(50000).half).toBe(1);
  });

  test('the day count is the fraction of the day in hundred-thousandths', () => {
    expect(clock.format(38241).day).toBe('0.38241');
  });
});

describe('the day count from a real time', () => {
  const at = (h, m, s, ms = 0) => {
    const d = new Date(2026, 5, 15);     // an ordinary June day
    d.setHours(h, m, s, ms);
    return d;
  };

  test('midnight is 0 and the day is exhausted a second before the next', () => {
    expect(clock.dayCountFrom(at(0, 0, 0))).toBe(0);
    expect(Math.floor(clock.dayCountFrom(at(23, 59, 59, 999)))).toBe(99999);
  });

  test('the worked example: 09:10:40.224 local is count 38241', () => {
    expect(Math.floor(clock.dayCountFrom(at(9, 10, 40, 224)))).toBe(38241);
    expect(clock.format(clock.dayCountFrom(at(9, 10, 40, 224))).time).toBe('7:32:41');
  });

  test('noon is exactly halfway, so the half-day indicator turns over there', () => {
    expect(clock.dayCountFrom(at(12, 0, 0))).toBe(50000);
    expect(clock.fields(clock.dayCountFrom(at(12, 0, 0))).half).toBe(1);
  });
});

describe('angles', () => {
  test('every hand starts at twelve and the coefficients are exact', () => {
    expect(clock.angles(0)).toEqual({ second: 0, minute: 0, hour: 0 });
    expect(clock.angles(50).second).toBeCloseTo(180, 9);      // half a minute
    expect(clock.angles(2500).minute).toBeCloseTo(180, 9);    // half an hour
    expect(clock.angles(25000).hour).toBeCloseTo(180, 9);     // half a half-day
  });

  test('the second and minute hands step together, the hour hand does not', () => {
    // Mid-second: both stepped hands hold their vertex, the hour hand moves on.
    expect(clock.angles(41.5).second).toBe(clock.angles(41).second);
    expect(clock.angles(41.5).minute).toBe(clock.angles(41).minute);
    expect(clock.angles(41.5).hour).toBeGreaterThan(clock.angles(41).hour);
  });

  test('the hour hand turns twice a day on the half-day face', () => {
    expect(clock.angles(49999.999).hour).toBeCloseTo(360, 3);
    expect(clock.angles(50000).hour).toBe(0);
  });
});

describe('the ring', () => {
  const verts = clock.ringVertices();

  test('has one vertex per second, none doubled or missing', () => {
    expect(verts).toHaveLength(100);
  });

  test('vertex 0 sits exactly at twelve o\'clock', () => {
    expect(verts[0][0]).toBeCloseTo(200, 9);
    expect(verts[0][1]).toBeCloseTo(200 - 0.944 * 180, 9);
  });

  test('radii alternate: long peak every tenth, then peak and trough', () => {
    const radius = ([x, y]) => Math.hypot(x - 200, y - 200);
    verts.forEach((v, k) => {
      const want = (k % 10 === 0) ? 0.944 : (k % 2 === 0 ? 0.872 : 0.772);
      expect(radius(v)).toBeCloseTo(want * 180, 9);
    });
  });

  test('is symmetric about the vertical axis, so the polygon closes cleanly', () => {
    for (let k = 1; k < 50; k++) {
      expect(verts[k][0] - 200).toBeCloseTo(200 - verts[100 - k][0], 9);
      expect(verts[k][1]).toBeCloseTo(verts[100 - k][1], 9);
    }
  });
});
