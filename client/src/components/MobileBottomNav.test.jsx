import { render, screen, fireEvent } from '@testing-library/react';
import MobileBottomNav from './MobileBottomNav';

function setup(overrides = {}) {
  const props = {
    tab: 'feed',
    setTab: vi.fn(),
    starCount: 0,
    filterDrawerOpen: false,
    setFilterDrawerOpen: vi.fn(),
    hasActiveFilter: false,
    ...overrides,
  };
  return { ...render(<MobileBottomNav {...props} />), props };
}

test('renders Feed, Filter, and Starred labels', () => {
  setup();
  expect(screen.getByText('Feed')).toBeInTheDocument();
  expect(screen.getByText('Filter')).toBeInTheDocument();
  expect(screen.getByText('Starred')).toBeInTheDocument();
});

test('tapping Feed calls setTab("feed") and setFilterDrawerOpen(false)', () => {
  const setTab = vi.fn();
  const setFilterDrawerOpen = vi.fn();
  setup({ tab: 'starred', filterDrawerOpen: true, setTab, setFilterDrawerOpen });
  fireEvent.click(screen.getByText('Feed'));
  expect(setTab).toHaveBeenCalledWith('feed');
  expect(setFilterDrawerOpen).toHaveBeenCalledWith(false);
});

test('tapping Starred calls setTab("starred") and setFilterDrawerOpen(false)', () => {
  const setTab = vi.fn();
  const setFilterDrawerOpen = vi.fn();
  setup({ filterDrawerOpen: true, setTab, setFilterDrawerOpen });
  fireEvent.click(screen.getByText('Starred'));
  expect(setTab).toHaveBeenCalledWith('starred');
  expect(setFilterDrawerOpen).toHaveBeenCalledWith(false);
});

test('tapping Filter opens drawer when closed', () => {
  const setFilterDrawerOpen = vi.fn();
  setup({ filterDrawerOpen: false, setFilterDrawerOpen });
  fireEvent.click(screen.getByText('Filter'));
  expect(setFilterDrawerOpen).toHaveBeenCalledWith(true);
});

test('tapping Filter closes drawer when open', () => {
  const setFilterDrawerOpen = vi.fn();
  setup({ filterDrawerOpen: true, setFilterDrawerOpen });
  fireEvent.click(screen.getByText('Filter'));
  expect(setFilterDrawerOpen).toHaveBeenCalledWith(false);
});

test('shows star count badge when starCount > 0', () => {
  setup({ starCount: 7 });
  expect(screen.getByText('7')).toBeInTheDocument();
});

test('does not show badge when starCount is 0', () => {
  const { container } = setup({ starCount: 0 });
  expect(container.querySelector('[data-testid="star-badge"]')).not.toBeInTheDocument();
});

test('shows green dot when hasActiveFilter is true', () => {
  const { container } = setup({ hasActiveFilter: true });
  expect(container.querySelector('[data-testid="filter-dot"]')).toBeInTheDocument();
});

test('does not show green dot when hasActiveFilter is false', () => {
  const { container } = setup({ hasActiveFilter: false });
  expect(container.querySelector('[data-testid="filter-dot"]')).not.toBeInTheDocument();
});
