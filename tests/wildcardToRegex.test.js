const assert = require('assert');
const { wildcardToRegex } = require('../assets/js/database.js');

console.log('Running tests for wildcardToRegex...');

// Test 1: Empty input
assert.strictEqual(wildcardToRegex(''), '');

// Test 2: Basic string
assert.strictEqual(wildcardToRegex('apple'), 'apple');

// Test 3: Wildcard .
// . becomes [^ ] (any non-space character)
assert.strictEqual(wildcardToRegex('a.b'), 'a[^ ]b');

// Test 4: Wildcard *
// * becomes .* (any sequence of characters)
assert.strictEqual(wildcardToRegex('a*b'), 'a.*b');

// Test 5: Anchors
// " at start becomes ^
// " at end becomes $
assert.strictEqual(wildcardToRegex('"start'), '^start');
assert.strictEqual(wildcardToRegex('end"'), 'end$');
assert.strictEqual(wildcardToRegex('"both"'), '^both$');

// Test 6: Escaping special characters
// These characters should be escaped: \ ^ $ | ? + ( ) [ ] { }
const specialChars = '\\^$|?+()[]{}';
// logic: replace(/([\\^$|?+()[\]{}])/g, '\\$1')
// \ -> \\
// ^ -> \^
// $ -> \$
// | -> \|
// ? -> \?
// + -> \+
// ( -> \(
// ) -> \)
// [ -> \[
// ] -> \]
// { -> \{
// } -> \}
const expectedEscaped = '\\\\\\^\\$\\|\\?\\+\\(\\)\\[\\]\\{\\}';
assert.strictEqual(wildcardToRegex(specialChars), expectedEscaped);

// Test 7: Combinations
assert.strictEqual(wildcardToRegex('a.b*c"'), 'a[^ ]b.*c$');

// Test 8: Verify Regex Safety
// Ensure user cannot inject character classes
assert.strictEqual(wildcardToRegex('[a-z]'), '\\[a-z\\]');

// Ensure user cannot inject groups
assert.strictEqual(wildcardToRegex('(a|b)'), '\\(a\\|b\\)');

// Ensure user cannot inject quantifiers (except * which we handle)
assert.strictEqual(wildcardToRegex('a+'), 'a\\+');
assert.strictEqual(wildcardToRegex('a?'), 'a\\?');
assert.strictEqual(wildcardToRegex('a{3}'), 'a\\{3\\}');

// Test 9: Quote handling in middle
// " in the middle should be treated as literal " (not escaped by regex replacement, but also not anchor)
// The regex replacement does NOT list " as a special character to escape.
// Is " special in regex? No.
assert.strictEqual(wildcardToRegex('a"b'), 'a"b');
// " at start but not end
assert.strictEqual(wildcardToRegex('"a"b'), '^a"b');
// " at end but not start
assert.strictEqual(wildcardToRegex('a"b"'), 'a"b$');

console.log('All tests passed!');
