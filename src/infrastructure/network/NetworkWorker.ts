export type NetworkWorkerMessage =
  | { type: 'PARSE_JSON'; id: string; payload: string }
  | { type: 'STRINGIFY_JSON'; id: string; payload: unknown };

self.onmessage = (e: MessageEvent<NetworkWorkerMessage>) => {
  try {
    if (e.data.type === 'PARSE_JSON') {
      const parsed = JSON.parse(e.data.payload);
      self.postMessage({ id: e.data.id, result: parsed });
    } else if (e.data.type === 'STRINGIFY_JSON') {
      const str = JSON.stringify(e.data.payload);
      self.postMessage({ id: e.data.id, result: str });
    }
  } catch (err) {
    self.postMessage({ id: e.data.id, error: err instanceof Error ? err.message : String(err) });
  }
};
