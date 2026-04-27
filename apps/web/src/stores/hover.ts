import { create } from 'zustand';

interface HoverState {
  /** Run currently hovered in any sidebar/plot — used to highlight the same run everywhere. */
  runId: string | null;
  setRunId: (id: string | null) => void;
}

export const useHoverStore = create<HoverState>((set) => ({
  runId: null,
  setRunId: (id) => set({ runId: id }),
}));
