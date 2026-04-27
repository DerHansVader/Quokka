import { afterEach, describe, expect, it } from 'vitest';
import { useHoverStore } from './hover';

afterEach(() => {
  useHoverStore.setState({ runId: null });
});

describe('useHoverStore', () => {
  it('starts with no hovered run', () => {
    expect(useHoverStore.getState().runId).toBeNull();
  });

  it('updates the hovered run id', () => {
    useHoverStore.getState().setRunId('run-42');
    expect(useHoverStore.getState().runId).toBe('run-42');
    useHoverStore.getState().setRunId(null);
    expect(useHoverStore.getState().runId).toBeNull();
  });

  it('notifies subscribers when the value changes', () => {
    const seen: (string | null)[] = [];
    const unsub = useHoverStore.subscribe((s) => seen.push(s.runId));

    useHoverStore.getState().setRunId('a');
    useHoverStore.getState().setRunId('b');
    useHoverStore.getState().setRunId(null);

    unsub();
    expect(seen).toEqual(['a', 'b', null]);
  });
});
