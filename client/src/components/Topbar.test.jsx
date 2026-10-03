import { render, screen, fireEvent } from '@testing-library/react';
import Topbar from './Topbar';

function setup(overrides = {}) {
  const props = {
    tab: 'feed',
    setTab: vi.fn(),
    starCount: 0,
    fetchedAt: null,
    loading: false,
    days: 7,
    onRefresh: vi.fn(),
    onSwitchRange: vi.fn(),
    query: '',
    setQuery: vi.fn(),
    isMobile: false,
    ...overrides,
  };
  return { ...render(<Topbar {...props} />), props };
}

test('renders Feed, Starred, Trends and PS Trends tabs in order', () => {
  setup();
  const labels = ['Feed', 'Starred', 'Trends', 'PS Trends'].map(l => screen.getByRole('button', { name: l }));
  for (let i = 1; i < labels.length; i++) {
    expect(labels[i - 1].compareDocumentPosition(labels[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

test('clicking PS Trends calls setTab("ps-trends")', () => {
  const { props } = setup();
  fireEvent.click(screen.getByRole('button', { name: 'PS Trends' }));
  expect(props.setTab).toHaveBeenCalledWith('ps-trends');
});
