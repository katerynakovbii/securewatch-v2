import { TOPICS, PHYSICAL_BADGE_STYLE, filterArticles, topicCounts } from './utils.js';

const articles = [
  { title: 'Reader launch', summary: '', source: 'SIA',  topic: 'access',   physical: true  },
  { title: 'NVR update',    summary: '', source: 'Axis', topic: 'video',    physical: true  },
  { title: 'Camera CVE',    summary: '', source: 'THN',  topic: 'cyber',    physical: true  },
  { title: 'Ransomware',    summary: '', source: 'THN',  topic: 'cyber',    physical: false },
  { title: 'Old article',   summary: '', source: 'SIA',  topic: 'business'                 },
];

test('Physical Security is the second topic, right after All', () => {
  expect(Object.keys(TOPICS).slice(0, 2)).toEqual(['all', 'physical']);
  expect(TOPICS.physical).toEqual({ label: 'Physical Security', color: '#4fffb0' });
});

test('exports a badge style', () => {
  expect(PHYSICAL_BADGE_STYLE).toHaveProperty('color');
});

test('physical filter returns flagged articles across topics', () => {
  const titles = filterArticles(articles, { topic: 'physical', query: '' }).map(a => a.title);
  expect(titles).toEqual(['Reader launch', 'NVR update', 'Camera CVE']);
});

test('physical filter combines with search query', () => {
  const titles = filterArticles(articles, { topic: 'physical', query: 'nvr' }).map(a => a.title);
  expect(titles).toEqual(['NVR update']);
});

test('data without physical field yields empty physical view', () => {
  const legacy = [{ title: 'A', summary: '', source: 'S', topic: 'video' }];
  expect(filterArticles(legacy, { topic: 'physical', query: '' })).toEqual([]);
  expect(topicCounts(legacy).physical).toBe(0);
});

test('regular topic filter unchanged', () => {
  const titles = filterArticles(articles, { topic: 'cyber', query: '' }).map(a => a.title);
  expect(titles).toEqual(['Camera CVE', 'Ransomware']);
});

test('topicCounts adds physical without disturbing per-topic counts', () => {
  const c = topicCounts(articles);
  expect(c.all).toBe(5);
  expect(c.physical).toBe(3);
  expect(c.cyber).toBe(2);
  expect(c.access).toBe(1);
  expect(c.business).toBe(1);
});
