import { render, screen } from '@testing-library/react';
import ArticleCard from './ArticleCard';

const base = {
  id: 'https://a.test/1', url: 'https://a.test/1', title: 'Reader launch',
  summary: 'New reader', source: 'SIA', publishedAt: '2026-10-01', topic: 'access',
};
const props = { selected: false, isStarred: false, onSelect: vi.fn(), onToggleStar: vi.fn() };

test('shows Physical badge alongside topic tag when flagged', () => {
  render(<ArticleCard article={{ ...base, physical: true }} {...props} />);
  expect(screen.getByText('Physical')).toBeInTheDocument();
  expect(screen.getByText('Access Control')).toBeInTheDocument();
});

test('no Physical badge when not flagged or field missing', () => {
  const { rerender } = render(<ArticleCard article={{ ...base, physical: false }} {...props} />);
  expect(screen.queryByText('Physical')).toBeNull();
  rerender(<ArticleCard article={base} {...props} />);
  expect(screen.queryByText('Physical')).toBeNull();
});
