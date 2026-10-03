import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

const trend = (id, name) => ({
  id, name, status: 'emerging', firstDetected: '2026-10-01', lastActive: '2026-10-03', cooledAt: null,
  rationale: 'r', signalTypes: [], articleCount: 1, sources: ['S'], articles: [],
});

function mockFetch({ physical }) {
  global.fetch = vi.fn(url => {
    if (url.includes('trends-physical.json')) {
      return Promise.resolve(physical === 404
        ? { ok: false, status: 404 }
        : { ok: true, status: 200, json: () => Promise.resolve({ lastRunAt: null, trends: physical }) });
    }
    if (url.includes('trends.json')) {
      return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ lastRunAt: null, trends: [trend('g1', 'General Cyber Trend')] }) });
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ articles: [], fetchedAt: null }) });
  });
}

beforeEach(() => { localStorage.clear(); });

test('PS Trends tab shows only physical trends; Trends tab only general ones', async () => {
  mockFetch({ physical: [trend('p1', 'Physical Access Trend')] });
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'PS Trends' }));
  expect(await screen.findByText('Physical Access Trend')).toBeInTheDocument();
  expect(screen.queryByText('General Cyber Trend')).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Trends' }));
  expect(await screen.findByText('General Cyber Trend')).toBeInTheDocument();
  expect(screen.queryByText('Physical Access Trend')).not.toBeInTheDocument();
});

test('PS Trends tab shows the PS empty state when trends-physical.json is missing', async () => {
  mockFetch({ physical: 404 });
  render(<App />);

  fireEvent.click(screen.getByRole('button', { name: 'PS Trends' }));
  expect(await screen.findByText('No physical security trends detected yet — detection runs daily.')).toBeInTheDocument();
});
