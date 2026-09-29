import { describe, test, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  windowArticles, shouldRun, mergeTrends, pruneTrends,
  sanitizeClusters, callClaude, run,
} from './detect-trends.mjs';

describe('windowArticles', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');

  test('keeps an article published within the window', () => {
    const articles = [{ url: 'a', publishedAt: '2026-09-20' }];
    expect(windowArticles(articles, 14, now)).toHaveLength(1);
  });

  test('drops an article published before the window', () => {
    const articles = [{ url: 'a', publishedAt: '2026-09-01' }];
    expect(windowArticles(articles, 14, now)).toHaveLength(0);
  });

  test('drops an article with no publishedAt', () => {
    const articles = [{ url: 'a', publishedAt: '' }];
    expect(windowArticles(articles, 14, now)).toHaveLength(0);
  });
});

describe('shouldRun', () => {
  const now = new Date('2026-09-29T12:00:00.000Z');

  test('true when lastRunAt is null', () => {
    expect(shouldRun(null, now)).toBe(true);
  });

  test('false when lastRunAt is the same UTC day', () => {
    expect(shouldRun('2026-09-29T01:00:00.000Z', now)).toBe(false);
  });

  test('true when lastRunAt is a prior UTC day', () => {
    expect(shouldRun('2026-09-28T23:59:00.000Z', now)).toBe(true);
  });

  test('force=true always returns true', () => {
    expect(shouldRun('2026-09-29T01:00:00.000Z', now, true)).toBe(true);
  });

  test('true when lastRunAt is not a parseable date', () => {
    expect(shouldRun('not-a-date', new Date('2026-09-29'))).toBe(true);
  });
});

describe('mergeTrends', () => {
  const today = '2026-09-29';

  test('creates a new trend record for an unmatched cluster', () => {
    const clusters = [{
      id: null, name: 'Deepfake ID fraud', status: 'emerging',
      rationale: 'Two vendors flagged this.', signalTypes: ['source_authority'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'HID', publishedAt: '2026-09-20' }],
    }];
    const result = mergeTrends(clusters, [], today);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      name: 'Deepfake ID fraud', status: 'emerging',
      firstDetected: today, lastActive: today, cooledAt: null,
      signalTypes: ['source_authority'], articleCount: 1, sources: ['HID'],
    });
    expect(result[0].id).toBeTruthy();
  });

  test('updates a matched existing trend, appending deduped article evidence', () => {
    const existing = [{
      id: 'deepfake-id-fraud', name: 'Deepfake ID fraud', status: 'emerging',
      firstDetected: '2026-09-15', lastActive: '2026-09-20', cooledAt: null,
      rationale: 'old rationale', signalTypes: ['source_authority'],
      articleCount: 1, sources: ['HID'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'HID', publishedAt: '2026-09-15' }],
    }];
    const clusters = [{
      id: 'deepfake-id-fraud', name: 'Deepfake ID fraud', status: 'emerging',
      rationale: 'new rationale', signalTypes: ['velocity'],
      articles: [
        { url: 'https://a.test/1', title: 'A', source: 'HID', publishedAt: '2026-09-15' },
        { url: 'https://a.test/2', title: 'B', source: 'SIA', publishedAt: '2026-09-28' },
      ],
    }];
    const result = mergeTrends(clusters, existing, today);

    expect(result).toHaveLength(1);
    expect(result[0].lastActive).toBe(today);
    expect(result[0].firstDetected).toBe('2026-09-15');
    expect(result[0].articleCount).toBe(2);
    expect(result[0].sources.sort()).toEqual(['HID', 'SIA']);
    expect(result[0].rationale).toBe('new rationale');
    expect(result[0].signalTypes.sort()).toEqual(['source_authority', 'velocity']);
  });

  test('promotes emerging to confirmed when the cluster says confirmed and thresholds are met', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'emerging', firstDetected: '2026-09-15', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: ['velocity'], articleCount: 1, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-15' }],
    }];
    const clusters = [{
      id: 't1', name: 'X', status: 'confirmed', rationale: 'now confirmed', signalTypes: [],
      articles: [
        { url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-15' },
        { url: 'https://a.test/2', title: 'B', source: 'B', publishedAt: '2026-09-20' },
        { url: 'https://a.test/3', title: 'C', source: 'A', publishedAt: '2026-09-22' },
        { url: 'https://a.test/4', title: 'D', source: 'C', publishedAt: '2026-09-25' },
      ],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result[0].status).toBe('confirmed');
    // signalTypes retained as historical record, not cleared on promotion
    expect(result[0].signalTypes).toEqual(['velocity']);
  });

  test('does not promote to confirmed when the cluster claims confirmed but article/source thresholds are not met', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'emerging', firstDetected: '2026-09-15', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: ['velocity'], articleCount: 1, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-15' }],
    }];
    const clusters = [{
      id: 't1', name: 'X', status: 'confirmed', rationale: 'claims confirmed but thin', signalTypes: [],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-15' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result[0].status).toBe('emerging');
  });

  test('does not create a new trend as confirmed when the cluster claims confirmed but article/source thresholds are not met', () => {
    const clusters = [{
      id: null, name: 'Weak Claim', status: 'confirmed', rationale: 'claims confirmed but thin',
      signalTypes: [],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'OnlyOne', publishedAt: today }],
    }];
    const result = mergeTrends(clusters, [], today);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('emerging');
  });

  test('never demotes a confirmed trend back to emerging', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 4, sources: ['A', 'B'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const clusters = [{
      id: 't1', name: 'X', status: 'emerging', rationale: 'weaker this run', signalTypes: ['velocity'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result[0].status).toBe('confirmed');
  });

  test('cools an existing non-cooled trend absent from this run\'s clusters', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-15',
      cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 4, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const result = mergeTrends([], existing, today);
    expect(result[0].status).toBe('cooled');
    expect(result[0].cooledAt).toBe(today);
    expect(result[0].lastActive).toBe('2026-09-15'); // unchanged
  });

  test('leaves an already-cooled trend untouched and does not re-stamp it', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'cooled', firstDetected: '2026-08-01', lastActive: '2026-08-10',
      cooledAt: '2026-08-11', rationale: 'r', signalTypes: [], articleCount: 4, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-08-01' }],
    }];
    const result = mergeTrends([], existing, today);
    expect(result[0]).toEqual(existing[0]);
  });

  test('a cluster referencing an id that is cooled (or unknown) creates a new trend rather than reviving it', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'cooled', firstDetected: '2026-08-01', lastActive: '2026-08-10',
      cooledAt: '2026-08-11', rationale: 'r', signalTypes: [], articleCount: 1, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-08-01' }],
    }];
    const clusters = [{
      id: 't1', name: 'X reborn', status: 'emerging', rationale: 'back again', signalTypes: ['velocity'],
      articles: [{ url: 'https://a.test/2', title: 'B', source: 'A', publishedAt: '2026-09-28' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    expect(result).toHaveLength(2);
    const revived = result.find(t => t.name === 'X reborn');
    expect(revived.status).toBe('emerging');
    expect(revived.id).not.toBe('t1');
    const stillCooled = result.find(t => t.id === 't1');
    expect(stillCooled.status).toBe('cooled');
  });

  test('generates distinct ids for two new trends with colliding slugs', () => {
    const clusters = [
      { id: null, name: 'Same Name', status: 'emerging', rationale: 'r1', signalTypes: ['velocity'], articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: today }] },
      { id: null, name: 'Same Name', status: 'emerging', rationale: 'r2', signalTypes: ['velocity'], articles: [{ url: 'https://a.test/2', title: 'B', source: 'B', publishedAt: today }] },
    ];
    const result = mergeTrends(clusters, [], today);
    expect(result).toHaveLength(2);
    expect(result[0].id).not.toBe(result[1].id);
  });

  test('confirm-bump uses the cluster\'s own evidence, not lifetime accumulated evidence (Fix 4)', () => {
    const existing = [{
      id: 't1', name: 'X', status: 'emerging', firstDetected: '2026-09-01', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 3, sources: ['A', 'B', 'C'],
      articles: [
        { url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' },
        { url: 'https://a.test/2', title: 'B', source: 'B', publishedAt: '2026-09-05' },
        { url: 'https://a.test/3', title: 'C', source: 'C', publishedAt: '2026-09-10' },
      ],
    }];
    const clusters = [{
      id: 't1', name: 'X', status: 'confirmed', rationale: 'claims confirmed off one new article',
      signalTypes: [],
      articles: [{ url: 'https://a.test/4', title: 'D', source: 'D', publishedAt: '2026-09-28' }],
    }];
    const result = mergeTrends(clusters, existing, today);
    // 4 accumulated total, but the cluster's own evidence is only 1 article —
    // doesn't meet CONFIRMED_MIN_ARTICLES, so status must stay emerging.
    expect(result[0].status).toBe('emerging');
    expect(result[0].articleCount).toBe(4);
  });

  test('duplicate cluster ids in one run do not collide (Fix 5)', () => {
    const existing = [{
      id: 'existing-1', name: 'X', status: 'emerging', firstDetected: '2026-09-01', lastActive: '2026-09-20',
      cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 1, sources: ['A'],
      articles: [{ url: 'https://a.test/1', title: 'A', source: 'A', publishedAt: '2026-09-01' }],
    }];
    const clusters = [
      {
        id: 'existing-1', name: 'X', status: 'emerging', rationale: 'first dup',
        signalTypes: [],
        articles: [{ url: 'https://a.test/2', title: 'B', source: 'B', publishedAt: '2026-09-20' }],
      },
      {
        id: 'existing-1', name: 'X copy', status: 'emerging', rationale: 'second dup',
        signalTypes: [],
        articles: [{ url: 'https://a.test/3', title: 'C', source: 'C', publishedAt: '2026-09-21' }],
      },
    ];
    const result = mergeTrends(clusters, existing, today);
    expect(result).toHaveLength(2);
    const merged = result.find(t => t.id === 'existing-1');
    expect(merged.articles.map(a => a.url)).toContain('https://a.test/1');
    expect(merged.articles.map(a => a.url)).toContain('https://a.test/2');
    const newOne = result.find(t => t.id !== 'existing-1');
    expect(newOne).toBeTruthy();
    expect(newOne.articles.map(a => a.url)).toEqual(['https://a.test/3']);
  });
});

describe('sanitizeClusters', () => {
  const inWindow = [
    { url: 'https://a.test/1', title: 'Real title 1', source: 'HID', publishedAt: '2026-09-20' },
    { url: 'https://a.test/2', title: 'Real title 2', source: 'SIA', publishedAt: '2026-09-21' },
  ];

  test('drops articles with urls not present in the article window, sources fields from corpus, and filters junk signalTypes', () => {
    const clusters = [{
      id: null, name: 'Cluster', status: 'emerging', rationale: 'r',
      signalTypes: ['velocity', 'made-up-signal'],
      articles: [
        { url: 'https://a.test/1', title: 'Hallucinated title', source: 'Wrong Source', publishedAt: '2099-01-01' },
        { url: 'https://a.test/nonexistent', title: 'Fabricated', source: 'Nobody', publishedAt: '2026-09-20' },
      ],
    }];
    const [result] = sanitizeClusters(clusters, inWindow);

    expect(result.articles).toHaveLength(1);
    expect(result.articles[0]).toEqual({
      url: 'https://a.test/1', title: 'Real title 1', source: 'HID', publishedAt: '2026-09-20',
    });
    expect(result.signalTypes).toEqual(['velocity']);
  });
});

describe('pruneTrends', () => {
  const today = '2026-09-29';

  test('keeps a cooled trend within the retention window', () => {
    const trends = [{ id: 't1', status: 'cooled', cooledAt: '2026-09-01' }];
    expect(pruneTrends(trends, today, 365)).toHaveLength(1);
  });

  test('drops a cooled trend past the retention window', () => {
    const trends = [{ id: 't1', status: 'cooled', cooledAt: '2025-01-01' }];
    expect(pruneTrends(trends, today, 365)).toHaveLength(0);
  });

  test('never prunes a non-cooled trend regardless of age', () => {
    const trends = [{ id: 't1', status: 'confirmed', cooledAt: null, firstDetected: '2020-01-01' }];
    expect(pruneTrends(trends, today, 365)).toHaveLength(1);
  });
});

describe('callClaude', () => {
  test('returns null (not []) when response text is undefined', async () => {
    const anthropic = { messages: { create: async () => ({ content: [{ text: undefined }] }) } };
    const result = await callClaude(anthropic, [], []);
    expect(result).toBeNull();
  });

  test('returns null (not []) when response text fails to parse as JSON', async () => {
    const anthropic = { messages: { create: async () => ({ content: [{ text: 'not json' }] }) } };
    const result = await callClaude(anthropic, [], []);
    expect(result).toBeNull();
  });
});

describe('run() guard paths (Fix 1)', () => {
  const trendsPath = path.join(process.cwd(), 'client', 'public', 'data', 'trends.json');

  test('returns the existing archive unchanged, without writing, when no apiKey is set', async () => {
    const before = JSON.parse(await readFile(trendsPath, 'utf8'));
    const result = await run({ apiKey: undefined, now: new Date() });
    const after = JSON.parse(await readFile(trendsPath, 'utf8'));

    expect(result.trends).toEqual(before.trends);
    expect(after).toEqual(before);
  });

  test('returns the existing archive unchanged, without writing, when the article window is empty', async () => {
    const before = JSON.parse(await readFile(trendsPath, 'utf8'));
    const result = await run({ apiKey: 'fake', now: new Date('2030-01-01T00:00:00Z') });
    const after = JSON.parse(await readFile(trendsPath, 'utf8'));

    expect(result.trends).toEqual(before.trends);
    expect(after).toEqual(before);
  });
});
