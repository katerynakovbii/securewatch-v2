import { describe, test, expect } from 'vitest';
import { classifyTopic, isRelevant, parseRSS, fixDate, diffNew } from './fetch-news.mjs';

describe('isRelevant', () => {
  test('matches a keyword in the title', () => {
    expect(isRelevant('New access control system launched', '')).toBe(true);
  });
  test('matches a keyword in the summary', () => {
    expect(isRelevant('Product update', 'now with facial recognition')).toBe(true);
  });
  test('returns false with no keyword match', () => {
    expect(isRelevant('Local bakery wins award', 'pastry news')).toBe(false);
  });
});

describe('classifyTopic', () => {
  test('classifies cyber', () => {
    expect(classifyTopic('Ransomware hits vendor', '')).toBe('cyber');
  });
  test('classifies access', () => {
    expect(classifyTopic('New badge reader for turnstiles', '')).toBe('access');
  });
  test('classifies video', () => {
    expect(classifyTopic('New 4K PTZ camera released', '')).toBe('video');
  });
  test('classifies business for acquisitions', () => {
    expect(classifyTopic('Genetec acquires startup for $50 million', '')).toBe('business');
  });
  test('falls back to tech', () => {
    expect(classifyTopic('Company announces new office', '')).toBe('tech');
  });
});

describe('parseRSS', () => {
  test('extracts title, link, summary, pubDate from item blocks', () => {
    const xml = `<rss><channel>
      <item>
        <title>Test Article</title>
        <link>https://example.com/a</link>
        <description>Some <b>summary</b> text</description>
        <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
      </item>
    </channel></rss>`;
    const result = parseRSS(xml, 'TestSource');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Test Article',
      link: 'https://example.com/a',
      summary: 'Some summary text',
      sourceName: 'TestSource',
    });
  });

  test('skips items missing title or link', () => {
    const xml = `<rss><channel><item><description>no title or link</description></item></channel></rss>`;
    expect(parseRSS(xml, 'TestSource')).toHaveLength(0);
  });
});

describe('fixDate', () => {
  test('returns empty string for missing/invalid input', () => {
    expect(fixDate('')).toBe('');
    expect(fixDate('not a date')).toBe('');
  });
  test('formats a valid date as YYYY-MM-DD', () => {
    expect(fixDate('2024-03-15T00:00:00Z')).toBe('2024-03-15');
  });
});

describe('diffNew', () => {
  test('carries over analysis for URLs seen before', () => {
    const fresh = [{ url: 'https://a.test/1', title: 'A' }, { url: 'https://a.test/2', title: 'B' }];
    const known = [{ url: 'https://a.test/1', title: 'A', analysis: 'PRIOR ANALYSIS' }];
    const { merged, newOnes } = diffNew(fresh, known);

    expect(merged.find(a => a.url === 'https://a.test/1').analysis).toBe('PRIOR ANALYSIS');
    expect(newOnes.map(a => a.url)).toEqual(['https://a.test/2']);
  });

  test('treats a known URL with no prior analysis as still new', () => {
    const fresh = [{ url: 'https://a.test/1', title: 'A' }];
    const known = [{ url: 'https://a.test/1', title: 'A' }]; // no .analysis — e.g. prior run's Claude call failed
    const { newOnes } = diffNew(fresh, known);
    expect(newOnes.map(a => a.url)).toEqual(['https://a.test/1']);
  });

  test('with no known articles, everything is new', () => {
    const fresh = [{ url: 'https://a.test/1' }, { url: 'https://a.test/2' }];
    const { newOnes } = diffNew(fresh, []);
    expect(newOnes).toHaveLength(2);
  });
});
