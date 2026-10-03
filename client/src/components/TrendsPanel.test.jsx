import { render, screen, fireEvent } from '@testing-library/react';
import TrendsPanel from './TrendsPanel';

const CONFIRMED = { id: 'c1', name: 'Confirmed Trend', status: 'confirmed', firstDetected: '2026-09-01', lastActive: '2026-09-29', cooledAt: null, rationale: 'r', signalTypes: [], articleCount: 5, sources: ['A'], articles: [] };
const EMERGING  = { id: 'e1', name: 'Emerging Trend',  status: 'emerging',  firstDetected: '2026-09-20', lastActive: '2026-09-27', cooledAt: null, rationale: 'r', signalTypes: ['velocity'], articleCount: 2, sources: ['B'], articles: [] };
const COOLED    = { id: 'k1', name: 'Cooled Trend',    status: 'cooled',    firstDetected: '2026-08-01', lastActive: '2026-08-10', cooledAt: '2026-08-11', rationale: 'r', signalTypes: [], articleCount: 4, sources: ['C'], articles: [] };

function setup(overrides = {}) {
  const props = {
    trends: [CONFIRMED, EMERGING, COOLED],
    loading: false,
    error: null,
    lastRunAt: '2026-09-29T06:00:00.000Z',
    onRetry: vi.fn(),
    isMobile: false,
    ...overrides,
  };
  return { ...render(<TrendsPanel {...props} />), props };
}

test('renders active trends but not cooled ones by default', () => {
  setup();
  expect(screen.getByText('Confirmed Trend')).toBeInTheDocument();
  expect(screen.getByText('Emerging Trend')).toBeInTheDocument();
  expect(screen.queryByText('Cooled Trend')).not.toBeInTheDocument();
});

test('shows the archive toggle with the cooled count', () => {
  setup();
  expect(screen.getByText('▾ Archive (1)')).toBeInTheDocument();
});

test('clicking the archive toggle reveals cooled trends', () => {
  setup();
  fireEvent.click(screen.getByText('▾ Archive (1)'));
  expect(screen.getByText('Cooled Trend')).toBeInTheDocument();
});

test('shows an empty state when there are no active trends', () => {
  setup({ trends: [COOLED] });
  expect(screen.getByText('No active trends detected yet.')).toBeInTheDocument();
});

test('shows the error state and wires the retry button', () => {
  const onRetry = vi.fn();
  setup({ error: 'HTTP 500', trends: [], onRetry });
  expect(screen.getByText('Failed to load trends')).toBeInTheDocument();
  fireEvent.click(screen.getByText('↻ Retry'));
  expect(onRetry).toHaveBeenCalled();
});

test('shows a loading state', () => {
  setup({ loading: true });
  expect(screen.getByText('LOADING TRENDS')).toBeInTheDocument();
});

test('shows the default empty message when there are no active trends', () => {
  setup({ trends: [] });
  expect(screen.getByText('No active trends detected yet.')).toBeInTheDocument();
});

test('shows custom emptyText when given and there are no active trends', () => {
  setup({ trends: [], emptyText: 'No physical security trends detected yet — detection runs daily.' });
  expect(screen.getByText('No physical security trends detected yet — detection runs daily.')).toBeInTheDocument();
  expect(screen.queryByText('No active trends detected yet.')).not.toBeInTheDocument();
});
