/**
 * @jest-environment jsdom
 */

// Mock jQuery
const mockJQueryObj = {
  DataTable: jest.fn(() => ({
      column: jest.fn(),
      search: jest.fn(),
      draw: jest.fn()
  })),
  on: jest.fn(),
  ready: jest.fn((callback) => callback && callback()), // Execute callback immediately to cover initialization code if possible
  fadeIn: jest.fn(),
  hide: jest.fn(),
  eq: jest.fn(),
  index: jest.fn(),
  focus: jest.fn(),
  select: jest.fn()
};

const mockJQuery = jest.fn(() => mockJQueryObj);
// Attach properties if accessed directly on $
mockJQuery.fn = {};

global.$ = mockJQuery;
global.jQuery = mockJQuery;

const { wildcardToRegex } = require('../database.js');

describe('wildcardToRegex', () => {
  test('returns empty string for empty input', () => {
    expect(wildcardToRegex('')).toBe('');
    expect(wildcardToRegex(null)).toBe('');
    expect(wildcardToRegex(undefined)).toBe('');
  });

  test('escapes special regex characters', () => {
    // special chars: \ ^ $ | ? + ( ) [ ] { }
    expect(wildcardToRegex('a+b')).toBe('a\\+b');
    expect(wildcardToRegex('(a|b)')).toBe('\\(a\\|b\\)');
    expect(wildcardToRegex('[abc]')).toBe('\\[abc\\]');
  });

  test('converts . to [^ ]', () => {
    expect(wildcardToRegex('P.PP.R')).toBe('P[^ ]PP[^ ]R');
  });

  test('converts * to .*', () => {
    expect(wildcardToRegex('a*b')).toBe('a.*b');
  });

  test('handles anchors " at start', () => {
    expect(wildcardToRegex('"start')).toBe('^start');
  });

  test('handles anchors " at end', () => {
    expect(wildcardToRegex('end"')).toBe('end$');
  });

  test('handles anchors " at both ends', () => {
    expect(wildcardToRegex('"exact"')).toBe('^exact$');
  });

  test('handles wildcards mixed with anchors', () => {
    expect(wildcardToRegex('"starts*with"')).toBe('^starts.*with$');
  });

  test('does not treat " in middle as anchor', () => {
    expect(wildcardToRegex('mid"dle')).toBe('mid"dle');
  });

  test('handles single quote anchor', () => {
    expect(wildcardToRegex('"')).toBe('^');
  });

  test('handles double quote empty anchor', () => {
    expect(wildcardToRegex('""')).toBe('^$');
  });
});
