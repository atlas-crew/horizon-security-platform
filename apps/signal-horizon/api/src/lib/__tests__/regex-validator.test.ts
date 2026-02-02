/**
 * Tests for ReDoS (Regular Expression Denial of Service) Prevention
 */

import { describe, test, expect } from 'vitest';
import {
  isRegexSafe,
  createSafeRegex,
  testRegexWithTimeout,
  zodRegexSafeRefinement,
  zodRegexSafeSuperRefine,
  MAX_REGEX_LENGTH,
  REDOS_PATTERNS,
  FORBIDDEN_SEQUENCES,
} from '../regex-validator.js';

describe('regex-validator', () => {
  describe('isRegexSafe', () => {
    describe('safe patterns', () => {
      test('allows simple literal patterns', () => {
        const result = isRegexSafe('error');
        expect(result.safe).toBe(true);
      });

      test('allows alternation without quantifiers', () => {
        const result = isRegexSafe('error|warning|info');
        expect(result.safe).toBe(true);
      });

      test('allows character classes', () => {
        const result = isRegexSafe('[a-zA-Z0-9]+');
        expect(result.safe).toBe(true);
      });

      test('allows simple quantifiers', () => {
        const result = isRegexSafe('error.*timeout');
        expect(result.safe).toBe(true);
      });

      test('allows bounded quantifiers', () => {
        const result = isRegexSafe('[0-9]{1,5}');
        expect(result.safe).toBe(true);
      });

      test('allows simple groups without nested quantifiers', () => {
        const result = isRegexSafe('(error|warning)');
        expect(result.safe).toBe(true);
      });

      test('allows word boundaries', () => {
        const result = isRegexSafe('\\berror\\b');
        expect(result.safe).toBe(true);
      });

      test('allows common log pattern: IP address', () => {
        const result = isRegexSafe('\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}');
        expect(result.safe).toBe(true);
      });

      test('allows common log pattern: timestamp', () => {
        const result = isRegexSafe('\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}');
        expect(result.safe).toBe(true);
      });

      test('allows common log pattern: HTTP method', () => {
        const result = isRegexSafe('(GET|POST|PUT|DELETE|PATCH)');
        expect(result.safe).toBe(true);
      });
    });

    describe('dangerous patterns (ReDoS)', () => {
      test('rejects nested quantifiers: (a+)+', () => {
        const result = isRegexSafe('(a+)+');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('nested quantifiers');
      });

      test('rejects nested quantifiers: (a*)*', () => {
        const result = isRegexSafe('(a*)*');
        expect(result.safe).toBe(false);
      });

      test('rejects nested quantifiers: (a+)*', () => {
        const result = isRegexSafe('(a+)*');
        expect(result.safe).toBe(false);
      });

      test('rejects alternation with quantifier: (a|b)+', () => {
        const result = isRegexSafe('(a|b)+');
        expect(result.safe).toBe(false);
      });

      test('rejects alternation with quantifier: (a|a)+', () => {
        const result = isRegexSafe('(a|a)+');
        expect(result.safe).toBe(false);
      });

      test('rejects backreference with quantifier: \\1+', () => {
        const result = isRegexSafe('(a)\\1+');
        expect(result.safe).toBe(false);
      });

      test('rejects adjacent quantified wildcards: .*.*', () => {
        const result = isRegexSafe('.*.*');
        expect(result.safe).toBe(false);
      });

      test('rejects adjacent quantified wildcards: .+.+', () => {
        const result = isRegexSafe('.+.+');
        expect(result.safe).toBe(false);
      });

      test('rejects (.+)+', () => {
        const result = isRegexSafe('(.+)+');
        expect(result.safe).toBe(false);
      });

      test('rejects (.*)+', () => {
        const result = isRegexSafe('(.*)+');
        expect(result.safe).toBe(false);
      });

      test('rejects complex evil pattern: (a+)+b', () => {
        const result = isRegexSafe('(a+)+b');
        expect(result.safe).toBe(false);
      });

      test('rejects character class quantified pairs: [a-z]*[a-z]*', () => {
        const result = isRegexSafe('[a-z]*[a-z]*');
        expect(result.safe).toBe(false);
      });
    });

    describe('forbidden sequences', () => {
      test('rejects positive lookahead: (?=pattern)', () => {
        const result = isRegexSafe('foo(?=bar)');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('forbidden sequence');
        expect(result.triggeredBy).toBe('(?=');
      });

      test('rejects negative lookahead: (?!pattern)', () => {
        const result = isRegexSafe('foo(?!bar)');
        expect(result.safe).toBe(false);
        expect(result.triggeredBy).toBe('(?!');
      });

      test('rejects positive lookbehind: (?<=pattern)', () => {
        const result = isRegexSafe('(?<=foo)bar');
        expect(result.safe).toBe(false);
        expect(result.triggeredBy).toBe('(?<=');
      });

      test('rejects negative lookbehind: (?<!pattern)', () => {
        const result = isRegexSafe('(?<!foo)bar');
        expect(result.safe).toBe(false);
        expect(result.triggeredBy).toBe('(?<!');
      });

      test('rejects named groups: (?<name>pattern)', () => {
        const result = isRegexSafe('(?<name>foo)');
        expect(result.safe).toBe(false);
        expect(result.triggeredBy).toBe('(?<');
      });

      test('rejects atomic groups: (?>pattern)', () => {
        const result = isRegexSafe('(?>foo)');
        expect(result.safe).toBe(false);
        expect(result.triggeredBy).toBe('(?>');
      });

      test('rejects recursion: (?R)', () => {
        const result = isRegexSafe('a(?R)?b');
        expect(result.safe).toBe(false);
        expect(result.triggeredBy).toBe('(?R)');
      });
    });

    describe('length limits', () => {
      test('rejects patterns exceeding max length', () => {
        const longPattern = 'a'.repeat(MAX_REGEX_LENGTH + 1);
        const result = isRegexSafe(longPattern);
        expect(result.safe).toBe(false);
        expect(result.reason).toContain(`maximum length of ${MAX_REGEX_LENGTH}`);
      });

      test('allows patterns at max length', () => {
        const maxPattern = 'a'.repeat(MAX_REGEX_LENGTH);
        const result = isRegexSafe(maxPattern);
        expect(result.safe).toBe(true);
      });

      test('rejects empty patterns', () => {
        const result = isRegexSafe('');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Empty pattern');
      });
    });

    describe('invalid regex syntax', () => {
      test('rejects invalid regex: unclosed group', () => {
        const result = isRegexSafe('(abc');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Invalid regex syntax');
      });

      test('rejects invalid regex: unclosed character class', () => {
        const result = isRegexSafe('[abc');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Invalid regex syntax');
      });

      test('rejects invalid regex: dangling quantifier', () => {
        const result = isRegexSafe('*abc');
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Invalid regex syntax');
      });
    });
  });

  describe('createSafeRegex', () => {
    test('returns RegExp for safe patterns', () => {
      const regex = createSafeRegex('error|warning');
      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.test('error occurred')).toBe(true);
    });

    test('returns null for unsafe patterns', () => {
      const regex = createSafeRegex('(a+)+');
      expect(regex).toBeNull();
    });

    test('returns null for invalid patterns', () => {
      const regex = createSafeRegex('(unclosed');
      expect(regex).toBeNull();
    });

    test('uses case-insensitive flag by default', () => {
      const regex = createSafeRegex('error');
      expect(regex?.test('ERROR')).toBe(true);
      expect(regex?.test('Error')).toBe(true);
    });

    test('respects custom flags', () => {
      const regex = createSafeRegex('error', '');
      expect(regex?.test('ERROR')).toBe(false);
      expect(regex?.test('error')).toBe(true);
    });
  });

  describe('testRegexWithTimeout', () => {
    test('returns true for matching input', () => {
      const regex = /error/i;
      const result = testRegexWithTimeout(regex, 'An error occurred');
      expect(result).toBe(true);
    });

    test('returns false for non-matching input', () => {
      const regex = /error/i;
      const result = testRegexWithTimeout(regex, 'All systems normal');
      expect(result).toBe(false);
    });

    test('handles very long input by truncating', () => {
      const regex = /test/;
      const longInput = 'a'.repeat(20000);
      const result = testRegexWithTimeout(regex, longInput);
      // Should complete without hanging (tests truncation logic)
      expect(result).toBe(false);
    });

    test('matches in truncated portion of long input', () => {
      const regex = /aaaa/;
      const longInput = 'a'.repeat(20000);
      const result = testRegexWithTimeout(regex, longInput);
      expect(result).toBe(true);
    });
  });

  describe('zodRegexSafeRefinement', () => {
    test('returns true for safe patterns', () => {
      expect(zodRegexSafeRefinement('error|warning')).toBe(true);
    });

    test('returns false for unsafe patterns', () => {
      expect(zodRegexSafeRefinement('(a+)+')).toBe(false);
    });

    test('returns false for invalid patterns', () => {
      expect(zodRegexSafeRefinement('(unclosed')).toBe(false);
    });
  });

  describe('zodRegexSafeSuperRefine', () => {
    test('does not add issue for safe patterns', () => {
      const issues: { code: 'custom'; message: string }[] = [];
      const ctx = { addIssue: (issue: { code: 'custom'; message: string }) => issues.push(issue) };
      zodRegexSafeSuperRefine('error|warning', ctx);
      expect(issues).toHaveLength(0);
    });

    test('adds issue for unsafe patterns', () => {
      const issues: { code: 'custom'; message: string }[] = [];
      const ctx = { addIssue: (issue: { code: 'custom'; message: string }) => issues.push(issue) };
      zodRegexSafeSuperRefine('(a+)+', ctx);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('nested quantifiers');
    });

    test('adds issue for forbidden sequences', () => {
      const issues: { code: 'custom'; message: string }[] = [];
      const ctx = { addIssue: (issue: { code: 'custom'; message: string }) => issues.push(issue) };
      zodRegexSafeSuperRefine('foo(?=bar)', ctx);
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('forbidden sequence');
    });
  });

  describe('constants', () => {
    test('MAX_REGEX_LENGTH is reasonable', () => {
      expect(MAX_REGEX_LENGTH).toBe(500);
    });

    test('REDOS_PATTERNS is non-empty', () => {
      expect(REDOS_PATTERNS.length).toBeGreaterThan(0);
    });

    test('FORBIDDEN_SEQUENCES contains lookahead/lookbehind', () => {
      expect(FORBIDDEN_SEQUENCES).toContain('(?=');
      expect(FORBIDDEN_SEQUENCES).toContain('(?!');
      expect(FORBIDDEN_SEQUENCES).toContain('(?<=');
      expect(FORBIDDEN_SEQUENCES).toContain('(?<!');
    });
  });

  describe('real-world attack patterns', () => {
    test('blocks classic ReDoS: ^(a+)+$', () => {
      const result = isRegexSafe('^(a+)+$');
      expect(result.safe).toBe(false);
    });

    test('blocks nested quantifier with wildcard: (.*a)+', () => {
      // Quantified wildcard inside quantified group causes ReDoS
      const result = isRegexSafe('(.*a)+');
      expect(result.safe).toBe(false);
    });

    test('blocks URL ReDoS variant: ^(http|https)://[^/]*(/.*)*.', () => {
      const result = isRegexSafe('^(http|https)://[^/]*(/.*)*.');
      expect(result.safe).toBe(false);
    });

    test('allows safe email pattern alternative', () => {
      // Simple email pattern without nested quantifiers
      const result = isRegexSafe('[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}');
      expect(result.safe).toBe(true);
    });

    test('allows safe URL pattern alternative', () => {
      // Simple URL pattern without nested quantifiers
      const result = isRegexSafe('https?://[^\\s]+');
      expect(result.safe).toBe(true);
    });
  });
});
