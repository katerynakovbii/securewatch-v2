import { renderHook, act } from '@testing-library/react';
import { useMobile } from './useMobile';

function setWidth(px) {
  Object.defineProperty(window, 'innerWidth', { value: px, writable: true, configurable: true });
}

function fireResize() {
  window.dispatchEvent(new Event('resize'));
}

test('returns true when innerWidth is 375', () => {
  setWidth(375);
  const { result } = renderHook(() => useMobile());
  expect(result.current).toBe(true);
});

test('returns false when innerWidth is 1024', () => {
  setWidth(1024);
  const { result } = renderHook(() => useMobile());
  expect(result.current).toBe(false);
});

test('returns false when innerWidth is exactly 640', () => {
  setWidth(640);
  const { result } = renderHook(() => useMobile());
  expect(result.current).toBe(false);
});

test('updates to false when viewport grows above 640', () => {
  setWidth(375);
  const { result } = renderHook(() => useMobile());
  expect(result.current).toBe(true);
  act(() => { setWidth(1024); fireResize(); });
  expect(result.current).toBe(false);
});

test('updates to true when viewport shrinks below 640', () => {
  setWidth(1024);
  const { result } = renderHook(() => useMobile());
  expect(result.current).toBe(false);
  act(() => { setWidth(375); fireResize(); });
  expect(result.current).toBe(true);
});

test('removes resize listener on unmount', () => {
  const removeSpy = vi.spyOn(window, 'removeEventListener');
  setWidth(375);
  const { unmount } = renderHook(() => useMobile());
  unmount();
  expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function));
  removeSpy.mockRestore();
});
