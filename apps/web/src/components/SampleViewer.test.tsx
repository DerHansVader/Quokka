import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SampleViewer } from './SampleViewer';
import { api } from '../lib/api';

vi.mock('../lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const getMock = vi.mocked(api.get);

function renderViewer() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={qc}>
      <SampleViewer runId="run-1" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('SampleViewer', () => {
  it('shows a loading state before resolved-empty samples', async () => {
    let resolveKeys!: (keys: string[]) => void;
    getMock.mockReturnValueOnce(new Promise((resolve) => { resolveKeys = resolve; }));

    renderViewer();

    expect(screen.getByText('Loading samples...')).toBeTruthy();

    resolveKeys([]);
    await waitFor(() => {
      expect(screen.getByText('No samples logged yet')).toBeTruthy();
    });
  });

  it('shows an error state when sample keys fail to load', async () => {
    getMock.mockRejectedValueOnce(new Error('nope'));

    renderViewer();

    await waitFor(() => {
      expect(screen.getByText('Could not load samples')).toBeTruthy();
    });
  });

  it('distinguishes loading sample details from empty details', async () => {
    let resolveSamples!: (samples: unknown[]) => void;
    getMock
      .mockResolvedValueOnce(['eval/sample'])
      .mockReturnValueOnce(new Promise((resolve) => { resolveSamples = resolve; }));

    renderViewer();

    await waitFor(() => {
      expect(screen.getByText('Loading sample details...')).toBeTruthy();
    });

    resolveSamples([]);
    await waitFor(() => {
      expect(screen.getByText('No samples for this key')).toBeTruthy();
    });
  });
});
