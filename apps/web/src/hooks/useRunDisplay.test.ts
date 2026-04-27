import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRunDisplay } from './useRunDisplay';

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('useRunDisplay', () => {
  it('hydrates saved visibility once the project id resolves', async () => {
    localStorage.setItem(
      'qk:run-display:proj-1',
      JSON.stringify({ 'run-a': { visible: false, color: '#fff' } }),
    );

    // Simulate the page first rendering with no project id (data still loading),
    // then re-rendering with the resolved id — this used to clobber saved state.
    const { result, rerender } = renderHook(
      ({ pid, ids }: { pid: string | undefined; ids: string[] }) =>
        useRunDisplay(pid, ids),
      { initialProps: { pid: undefined, ids: [] } },
    );

    expect(result.current.display).toEqual({});

    rerender({ pid: 'proj-1', ids: ['run-a', 'run-b'] });

    await waitFor(() => {
      expect(result.current.display['run-a']).toEqual({
        visible: false,
        color: '#fff',
      });
    });
    // New runs that weren't in storage get sensible defaults.
    expect(result.current.display['run-b']?.visible).toBe(true);
  });

  it('persists visibility changes back to localStorage', async () => {
    const { result } = renderHook(() => useRunDisplay('proj-2', ['run-x']));

    await waitFor(() => {
      expect(result.current.display['run-x']?.visible).toBe(true);
    });

    act(() => result.current.update('run-x', { visible: false }));

    await waitFor(() => {
      const raw = JSON.parse(localStorage.getItem('qk:run-display:proj-2') || '{}');
      expect(raw['run-x']?.visible).toBe(false);
    });
  });

  it('migrates legacy `wt:` keys forward', async () => {
    localStorage.setItem(
      'wt:run-display:proj-3',
      JSON.stringify({ 'run-z': { visible: false, color: '#abc' } }),
    );

    const { result } = renderHook(() => useRunDisplay('proj-3', ['run-z']));

    await waitFor(() => {
      expect(result.current.display['run-z']).toEqual({
        visible: false,
        color: '#abc',
      });
    });
    expect(localStorage.getItem('wt:run-display:proj-3')).toBeNull();
    expect(localStorage.getItem('qk:run-display:proj-3')).not.toBeNull();
  });
});
