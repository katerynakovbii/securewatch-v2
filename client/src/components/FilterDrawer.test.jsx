import { render, screen, fireEvent } from '@testing-library/react';
import FilterDrawer from './FilterDrawer';

vi.mock('../utils.js', () => ({
  TOPICS: {
    all:  { label: 'All articles', color: '#6b7280' },
    tech: { label: 'Technology',   color: '#94a3b8' },
    ai:   { label: 'AI & Analytics', color: '#60a5fa' },
  },
  SORT_OPTIONS: [
    { value: 'newest', label: 'Newest first' },
    { value: 'oldest', label: 'Oldest first' },
  ],
}));

const mockProps = {
  open: true,
  onClose: vi.fn(),
  topic: 'all',
  setTopic: vi.fn(),
  sort: 'newest',
  setSort: vi.fn(),
  counts: { all: 42, tech: 12, ai: 8 },
};

beforeEach(() => vi.clearAllMocks());

test('renders nothing when open is false', () => {
  const { container } = render(<FilterDrawer {...mockProps} open={false} />);
  expect(container.firstChild).toBeNull();
});

test('renders topic buttons when open', () => {
  render(<FilterDrawer {...mockProps} />);
  expect(screen.getByText('All articles')).toBeInTheDocument();
  expect(screen.getByText('Technology')).toBeInTheDocument();
  expect(screen.getByText('AI & Analytics')).toBeInTheDocument();
});

test('renders sort select when open', () => {
  render(<FilterDrawer {...mockProps} />);
  expect(screen.getByRole('combobox')).toBeInTheDocument();
  expect(screen.getByText('Newest first')).toBeInTheDocument();
});

test('calls onClose when backdrop clicked', () => {
  const onClose = vi.fn();
  const { container } = render(<FilterDrawer {...mockProps} onClose={onClose} />);
  fireEvent.click(container.firstChild);
  expect(onClose).toHaveBeenCalled();
});

test('calls onClose when close button clicked', () => {
  const onClose = vi.fn();
  render(<FilterDrawer {...mockProps} onClose={onClose} />);
  fireEvent.click(screen.getByRole('button', { name: /close/i }));
  expect(onClose).toHaveBeenCalled();
});

test('calls setTopic and onClose when a topic button is clicked', () => {
  const setTopic = vi.fn();
  const onClose = vi.fn();
  render(<FilterDrawer {...mockProps} setTopic={setTopic} onClose={onClose} />);
  fireEvent.click(screen.getByText('Technology'));
  expect(setTopic).toHaveBeenCalledWith('tech');
  expect(onClose).toHaveBeenCalled();
});

test('calls setSort when sort option changes', () => {
  const setSort = vi.fn();
  render(<FilterDrawer {...mockProps} setSort={setSort} />);
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'oldest' } });
  expect(setSort).toHaveBeenCalledWith('oldest');
});

test('shows article counts next to topics', () => {
  render(<FilterDrawer {...mockProps} />);
  expect(screen.getByText('42')).toBeInTheDocument();
  expect(screen.getByText('12')).toBeInTheDocument();
});
