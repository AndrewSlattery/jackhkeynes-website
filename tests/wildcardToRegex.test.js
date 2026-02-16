const test = require('node:test');
const assert = require('node:assert');
const wildcardToRegex = require('../assets/js/database.js');

test('wildcardToRegex - empty input', () => {
  assert.strictEqual(wildcardToRegex(''), '');
  assert.strictEqual(wildcardToRegex(null), '');
  assert.strictEqual(wildcardToRegex(undefined), '');
});

test('wildcardToRegex - basic string', () => {
  assert.strictEqual(wildcardToRegex('clue'), 'clue');
  assert.strictEqual(wildcardToRegex('answer123'), 'answer123');
});

test('wildcardToRegex - wildcards', () => {
  assert.strictEqual(wildcardToRegex('P.PP.R'), 'P[^ ]PP[^ ]R');
  assert.strictEqual(wildcardToRegex('A*B'), 'A.*B');
  assert.strictEqual(wildcardToRegex('*.'), '.*[^ ]');
});

test('wildcardToRegex - anchors', () => {
  assert.strictEqual(wildcardToRegex('"start'), '^start');
  assert.strictEqual(wildcardToRegex('end"'), 'end$');
  assert.strictEqual(wildcardToRegex('"both"'), '^both$');
  assert.strictEqual(wildcardToRegex('"'), '^');
  assert.strictEqual(wildcardToRegex('""'), '^$');
});

test('wildcardToRegex - escaping metacharacters', () => {
  assert.strictEqual(wildcardToRegex('^$|?+()[]{}'), '\\^\\$\\|\\?\\+\\(\\)\\[\\]\\{\\}');
  assert.strictEqual(wildcardToRegex('\\'), '\\\\');
});

test('wildcardToRegex - combination', () => {
  assert.strictEqual(wildcardToRegex('"P.PP.R"'), '^P[^ ]PP[^ ]R$');
  assert.strictEqual(wildcardToRegex('"A*B (C+D)?"'), '^A.*B \\(C\\+D\\)\\?$');
});
