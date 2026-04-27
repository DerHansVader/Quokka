import { create } from 'zustand';

export interface SamplePeek {
  runId: string;
  runLabel: string;
  runColor: string;
  step: number;
  /** Anchor in viewport coords — used to position the popover near the cursor. */
  anchor: { x: number; y: number };
}

interface SamplePeekState {
  peek: SamplePeek | null;
  open: (peek: SamplePeek) => void;
  close: () => void;
}

export const useSamplePeekStore = create<SamplePeekState>((set) => ({
  peek: null,
  open: (peek) => set({ peek }),
  close: () => set({ peek: null }),
}));
