import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildApiUrl,
  isHtmlPayload,
  parseJsonResponse,
} from './translationApi';

test('buildApiUrl handles same-origin, custom base URLs, and /api prefix deduplication cleanly', () => {
  assert.equal(buildApiUrl('/api/translate/cues', ''), '/api/translate/cues');
  assert.equal(buildApiUrl('/api/translate/stream', '/api'), '/api/translate/stream');
  assert.equal(
    buildApiUrl('/api/translate/stream', 'https://api.zaban.example/api/'),
    'https://api.zaban.example/api/translate/stream'
  );
  assert.equal(
    buildApiUrl('/api/translate/cues', 'https://api.zaban.example/'),
    'https://api.zaban.example/api/translate/cues'
  );
  assert.equal(
    buildApiUrl('api/health', 'https://api.zaban.example///'),
    'https://api.zaban.example/api/health'
  );
});

test('isHtmlPayload detects lowercase doctype, html tags, and html content-type', () => {
  assert.equal(isHtmlPayload('<!doctype html><html><body></body></html>', 'text/plain'), true);
  assert.equal(isHtmlPayload('  <html><body>404</body></html>', null), true);
  assert.equal(isHtmlPayload('anything', 'text/html; charset=utf-8'), true);
  assert.equal(isHtmlPayload('{"ok":true}', 'application/json'), false);
});

test('parseJsonResponse parses valid JSON responses', async () => {
  const res = new Response(JSON.stringify({ ok: true, count: 3 }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await parseJsonResponse<{ ok: boolean; count: number }>(res, 'Request failed');
  assert.deepEqual(data, { ok: true, count: 3 });
});

test('parseJsonResponse surfaces JSON API error messages on non-2xx responses', async () => {
  const res = new Response(JSON.stringify({ error: 'Rate limit reached.' }), {
    status: 429,
    headers: { 'Content-Type': 'application/json' },
  });
  await assert.rejects(
    () => parseJsonResponse(res, 'Fallback error'),
    /Rate limit reached\./
  );
});

test('parseJsonResponse turns HTML doctype responses into an actionable message instead of JSON SyntaxError', async () => {
  const html404 = new Response('<!doctype html><html><body>Not found</body></html>', {
    status: 404,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
  await assert.rejects(
    () => parseJsonResponse(html404, 'Subtitle batch translation failed'),
    /returned an HTML page instead of JSON/
  );

  const html200 = new Response('<!doctype html><div id="root"></div>', {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  });
  await assert.rejects(
    () => parseJsonResponse(html200, 'Subtitle batch translation failed'),
    /returned an HTML page instead of JSON/
  );
});
