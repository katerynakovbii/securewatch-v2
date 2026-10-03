import { renderHook, act } from '@testing-library/react';
import { useTrends } from './useTrends.js';

const SAMPLE = {
  lastRunAt: '2026-09-29T06:00:00.000Z',
  trends: [
    { id: 't1', name: 'Deepfake ID fraud', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-29', cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 5, sources: ['A'], articles: [] },
  ],
};

beforeEach(() => {
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE) })
  );
});

test('load() fetches the static JSON and exposes trends + lastRunAt', async () => {
  const { result } = renderHook(() => useTrends());
  await act(async () => { await result.current.load(); });

  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('data/trends.json'));
  expect(result.current.trends).toEqual(SAMPLE.trends);
  expect(result.current.lastRunAt).toBe(SAMPLE.lastRunAt);
  expect(result.current.error).toBe(null);
});

test('refresh() cache-busts the URL', async () => {
  const { result } = renderHook(() => useTrends());
  await act(async () => { await result.current.refresh(); });

  const calledUrl = global.fetch.mock.calls[0][0];
  expect(calledUrl).toMatch(/data\/trends\.json\?t=\d+/);
});

test('sets error when fetch fails', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 500 }));
  const { result } = renderHook(() => useTrends());
  await act(async () => { await result.current.load(); });

  expect(result.current.error).toMatch(/500/);
  expect(result.current.trends).toEqual([]);
});

test('fetches the file it is given', async () => {
  const { result } = renderHook(() => useTrends('trends-physical.json'));
  await act(async () => { await result.current.load(); });

  expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('data/trends-physical.json'));
  expect(result.current.trends).toEqual(SAMPLE.trends);
});

test('treats a 404 (file not generated yet) as empty, not an error', async () => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: false, status: 404 }));
  const { result } = renderHook(() => useTrends('trends-physical.json'));
  await act(async () => { await result.current.load(); });

  expect(result.current.error).toBe(null);
  expect(result.current.trends).toEqual([]);
  expect(result.current.lastRunAt).toBe(null);
  expect(result.current.loading).toBe(false);
});
