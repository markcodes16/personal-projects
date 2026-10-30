/** Parse a small JSON API payload without trusting client-supplied Content-Length. */
export class RequestBodyError extends Error {
  readonly status: 400 | 413;
  constructor(status: 400 | 413, message: string) {
    super(message);
    this.name = 'RequestBodyError';
    this.status = status;
  }
}
export type TrainingEnvelope = { kind: 'session' | 'lesson'; data: unknown };

export function trainingEnvelope(value: unknown): TrainingEnvelope | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if ((record.kind !== 'session' && record.kind !== 'lesson') || !('data' in record)) return null;
  return { kind: record.kind, data: record.data };
}

export async function readTrainingJson(request: Request, maxBytes = 20_000): Promise<unknown> {
  const declaredLength = request.headers.get('content-length');
  if (declaredLength !== null && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > maxBytes)) {
    throw new RequestBodyError(413, 'Entry is too large.');
  }
  if (!request.body) throw new RequestBodyError(400, 'Invalid entry.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel();
        throw new RequestBodyError(413, 'Entry is too large.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new RequestBodyError(400, 'Invalid JSON entry.'); }
}
