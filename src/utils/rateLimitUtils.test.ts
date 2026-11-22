import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRateLimitError,
  isRetryableModelError,
  isTransientServiceError,
  LruCache,
  selectModelPlan,
} from './rateLimitUtils';

test('LruCache stores values, refreshes recency, and evicts oldest entry', () => {
  const cache = new LruCache<string>(2);
  cache.set('a', '1');
  cache.set('b', '2');
  assert.equal(cache.get('a'), '1'); // 'a' becomes most recently used
  cache.set('c', '3'); // evicts 'b'
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), '1');
  assert.equal(cache.get('c'), '3');
  assert.equal(cache.size, 2);
});

test('error classifiers distinguish rate-limit and transient 503 errors', () => {
  assert.equal(isRateLimitError(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}')), true);
  assert.equal(isRateLimitError(new Error('Quota exceeded')), true);
  assert.equal(isTransientServiceError(new Error('{"error":{"code":503,"status":"UNAVAILABLE"}}')), true);
  assert.equal(isRetryableModelError(new Error('RESOURCE_EXHAUSTED')), true);
  assert.equal(isRetryableModelError(new Error('API_KEY_INVALID')), false);
});

test('selectModelPlan routes to fallback first while primary model is cooling down', () => {
  const normal = selectModelPlan({
    primaryModel: 'gemini-4-hydrogen',
    fallbackModel: 'gemini-3.1-flash-lite',
    primaryCooldownUntil: 0,
    now: 1000,
  });
  assert.equal(normal[0].model, 'gemini-4-hydrogen');
  assert.equal(normal[1].model, 'gemini-3.1-flash-lite');

  const cooling = selectModelPlan({
    primaryModel: 'gemini-4-hydrogen',
    fallbackModel: 'gemini-3.1-flash-lite',
    primaryCooldownUntil: 50_000,
    now: 10_000,
  });
  assert.equal(cooling[0].model, 'gemini-3.1-flash-lite');
  assert.equal(cooling[1].model, 'gemini-4-hydrogen');
});
