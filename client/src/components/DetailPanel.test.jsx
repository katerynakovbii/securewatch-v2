import { render, screen } from '@testing-library/react';
import DetailPanel from './DetailPanel';

const base = {
  id: 'https://a.test/1', url: 'https://a.test/1', title: 'Reader launch',
  summary: 'New reader', source: 'SIA', publishedAt: '2026-10-01', topic: 'access',
};
const props = { isStarred: false, onToggleStar: vi.fn(), onClose: vi.fn(), isMobile: false };

test('shows Physical badge when flagged', () => {
  render(<DetailPanel article={{ ...base, physical: true }} {...props} />);
  expect(screen.getByText('Physical')).toBeInTheDocument();
});

test('no Physical badge when not flagged', () => {
  render(<DetailPanel article={base} {...props} />);
  expect(screen.queryByText('Physical')).toBeNull();
});
