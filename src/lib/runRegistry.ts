type RunRecord = { abort: () => void; status: 'running' | 'stopped' };

declare global {
  // eslint-disable-next-line no-var
  var __RUNS__: Map<string, RunRecord> | undefined;
}

export const RUNS: Map<string, RunRecord> = (globalThis.__RUNS__ ??= new Map());
