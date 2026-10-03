import { describe, test, expect } from 'vitest';
import { classifyTopic, isRelevant, isPhysicalSecurity, parseRSS, fixDate, diffNew } from './fetch-news.mjs';

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

describe('isPhysicalSecurity', () => {
  test.each([
    ['access control', 'New mobile credential reader for access control', ''],
    ['video', 'Milestone adds AI search to its VMS', ''],
    ['nvr', 'New 32-channel NVR announced', ''],
    ['perimeter', 'Fence detection upgrade for utility substations', ''],
    ['alarms', 'Alarm monitoring central station adds video verification', ''],
    ['ops', 'Schools deploy gunshot detection', ''],
    ['vendor', 'Genetec launches new release', ''],
    ['cyber on device', 'Critical CVE in Hikvision NVR firmware', ''],
    ['perimeter PIDS', 'Airport upgrades perimeter intrusion detection system', ''],
    ['guard phrase plus physical term', 'Broken access control in door controller firmware', ''],
    ['summary only', 'Product update', 'adds support for PTZ cameras'],
  ])('physical: %s', (_label, title, summary) => {
    expect(isPhysicalSecurity(title, summary)).toBe(true);
  });

  test.each([
    ['ransomware', 'Ransomware hits hospital network', ''],
    ['web app access control', 'Broken access control flaw in web app', ''],
    ['CVE wording', 'Improper access control in Jenkins plugin', ''],
    ['network perimeter', 'Network perimeter firewall bypassed', ''],
    ['lockbit', 'LockBit gang claims attack', ''],
    ['raises alarm', 'Report raises alarm over phishing', ''],
    ['spyware surveillance', 'Spyware used for government surveillance', ''],
    ['virtual machines', 'Attackers encrypt ESXi VMs', ''],
    ['ciso', 'Chief Information Security Officer resigns after breach', ''],
    ['network IDS', 'New intrusion detection system for cloud workloads', ''],
    ['IAM', 'Identity and access management startup raises seed', ''],
  ])('not physical: %s', (_label, title, summary) => {
    expect(isPhysicalSecurity(title, summary)).toBe(false);
  });

  test('handles missing summary', () => {
    expect(isPhysicalSecurity('Verkada ships new camera')).toBe(true);
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

  test('skips items with a non-http(s) link scheme', () => {
    const xml = `<rss><channel>
      <item>
        <title>Bad Link</title>
        <link>javascript:alert(1)</link>
      </item>
    </channel></rss>`;
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

  test('retains a previously-known article missing from the fresh fetch if still within the age window', () => {
    const fresh = [{ url: 'https://a.test/1', title: 'A', publishedAt: '2026-09-28' }];
    const known = [
      { url: 'https://a.test/1', title: 'A', publishedAt: '2026-09-28' },
      { url: 'https://a.test/old-but-fresh', title: 'Old', publishedAt: '2026-09-15', analysis: 'X' },
    ];
    const { merged } = diffNew(fresh, known);
    expect(merged.find(a => a.url === 'https://a.test/old-but-fresh')).toBeTruthy();
  });

  test('drops a previously-known article missing from the fresh fetch once it ages past the window', () => {
    const fresh = [{ url: 'https://a.test/1', title: 'A', publishedAt: '2026-09-28' }];
    const known = [
      { url: 'https://a.test/1', title: 'A', publishedAt: '2026-09-28' },
      { url: 'https://a.test/too-old', title: 'TooOld', publishedAt: '2026-01-01', analysis: 'X' },
    ];
    const { merged } = diffNew(fresh, known);
    expect(merged.find(a => a.url === 'https://a.test/too-old')).toBeFalsy();
  });

  test('sets physical on fresh and retained articles', () => {
    const today = new Date().toISOString().slice(0, 10);
    const fresh = [{ url: 'https://a.test/1', title: 'New NVR from Hanwha Vision', summary: '' }];
    const known = [
      { url: 'https://a.test/2', title: 'Ransomware hits hospital', summary: '', publishedAt: today, analysis: 'X' },
      { url: 'https://a.test/3', title: 'Turnstile rollout at stadium', summary: '', publishedAt: today, analysis: 'Y' },
    ];
    const { merged } = diffNew(fresh, known);
    const byUrl = Object.fromEntries(merged.map(a => [a.url, a.physical]));
    expect(byUrl).toEqual({
      'https://a.test/1': true,
      'https://a.test/2': false,
      'https://a.test/3': true,
    });
  });

  test('newOnes share object identity with merged so later analysis lands in output', () => {
    const fresh = [{ url: 'https://a.test/1', title: 'Access control update', summary: '' }];
    const { merged, newOnes } = diffNew(fresh, []);
    newOnes[0].analysis = 'LATER';
    expect(merged[0].analysis).toBe('LATER');
    expect(merged[0].physical).toBe(true);
  });

  test('articles without a title get physical false', () => {
    const { merged } = diffNew([{ url: 'https://a.test/1' }], []);
    expect(merged[0].physical).toBe(false);
  });
});
