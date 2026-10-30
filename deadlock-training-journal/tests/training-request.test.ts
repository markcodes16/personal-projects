import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readTrainingJson, RequestBodyError, trainingEnvelope } from '../app/api/training/request.ts';

const request = (payload: string) =>
  new Request('https://example.test/api/training', { method: 'POST', body: payload });

test('accepts session and lesson envelopes', () => {
  assert.deepEqual(trainingEnvelope({ kind: 'lesson', data: { id: 1 } }), { kind: 'lesson', data: { id: 1 } });
  assert.deepEqual(trainingEnvelope({ kind: 'session', data: 0 }), { kind: 'session', data: 0 });
});
test('rejects null, arrays, unsupported kinds, and missing payload', () => {
  for (const input of [null, [], 'bad', 42, {}, { kind: 'other', data: {} }, { kind: 'lesson' }])
    assert.equal(trainingEnvelope(input), null);
});
test('reads valid JSON', async () => {
  assert.deepEqual(await readTrainingJson(request('{"kind":"lesson","data":{"id":1}}')),
    { kind: 'lesson', data: { id: 1 } });
});
test('malformed JSON returns controlled 400', async () => {
  await assert.rejects(readTrainingJson(request('{broken')),
    (error: unknown) => error instanceof RequestBodyError && error.status === 400);
});
test('oversized actual body returns 413', async () => {
  await assert.rejects(readTrainingJson(request('x'.repeat(20_001))),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413);
});
test('oversized declared length returns 413', async () => {
  const fake = new Request(request('{}'), { headers: { 'content-length': '20001' } });
  await assert.rejects(readTrainingJson(fake),
    (error: unknown) => error instanceof RequestBodyError && error.status === 413);
});
test('invalid UTF-8 returns 400', async () => {
  const bad = new Request('https://example.test/api/training',
    { method: 'POST', body: new Uint8Array([0xc3, 0x28]) });
  await assert.rejects(readTrainingJson(bad),
    (error: unknown) => error instanceof RequestBodyError && error.status === 400);
});
