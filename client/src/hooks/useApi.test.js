import { renderHook, act, waitFor } from '@testing-library/react';
import { useNews } from './useApi.js';

const SAMPLE = {
  fetchedAt: '2026-09-29T12:00:00.000Z',
  articles: [
    { id: '1', url: 'https://a.test/1', title: 'Recent', source: 'A', topic: 'ai', publishedAt: new Date().toISOString().slice(0, 10) },
    { id: '2', url: 'https://a.test/2', title: 'Old', source: 'A', topic: 'video', publishedAt: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10) },
  ],
};

beforeEach(() => {
  localStorage.clear();
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE) })
  );
});

test('load() fetches the static JSON and exposes articles + fetchedAt', async () => {
  const { result } = renderHook(() => useNews());
  await act(async () => { await result.current.load(); });

  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('data/articles.json'));
  expect(result.current.fetchedAt).toBe(SAMPLE.fetchedAt);
  expect(result.current.error).toBe(null);
});

test('default 7-day range filters out an article published in 2020', async () => {
  const { result } = renderHook(() => useNews());
  await act(async () => { await result.current.load(); });

  const urls = result.current.articles.map(a => a.url);
  expect(urls).toContain('https://a.test/1');
  expect(urls).not.toContain('https://a.test/2');
});

test('switchRange(30) re-includes the 2020 article without an extra fetch', async () => {
  const { result } = renderHook(() => useNews());
  await act(async () => { await result.current.load(); });
  const callsAfterLoad = global.fetch.mock.calls.length;

  act(() => { result.current.switchRange(30); });

  await waitFor(() => {
    expect(result.current.articles.map(a => a.url)).toContain('https://a.test/2');
  });
  expect(global.fetch.mock.calls.length).toBe(callsAfterLoad); // no new network call
});

test('hides articles with no publish date in every range', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({
    ...SAMPLE,
    articles: [...SAMPLE.articles, { id: '3', url: 'https://a.test/3', title: 'Undated', source: 'CoreWillSoft', topic: 'access', publishedAt: '' }],
  }) }));
  const { result } = renderHook(() => useNews());
  await act(async () => { await result.current.load(); });
  expect(result.current.articles.map(a => a.url)).not.toContain('https://a.test/3');

  act(() => { result.current.switchRange(30); });
  await waitFor(() => {
    expect(result.current.articles.map(a => a.url)).toContain('https://a.test/2');
  });
  expect(result.current.articles.map(a => a.url)).not.toContain('https://a.test/3');
});

test('refresh() cache-busts the URL', async () => {
  const { result } = renderHook(() => useNews());
  await act(async () => { await result.current.refresh(); });

  const calledUrl = global.fetch.mock.calls[0][0];
  expect(calledUrl).toMatch(/data\/articles\.json\?t=\d+/);
});

test('sets error when fetch fails', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
  const { result } = renderHook(() => useNews());
  await act(async () => { await result.current.load(); });

  expect(result.current.error).toMatch(/500/);
});
