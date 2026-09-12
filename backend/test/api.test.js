import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app } from '../src/server.js';

test('protects the file list from unauthenticated requests', async () => {
  const response = await request(app).get('/api/files');
  assert.equal(response.status, 401);
  assert.deepEqual(response.body, { error: 'Authentication required' });
});

test('logout clears the session cookie without requiring authentication', async () => {
  const response = await request(app).post('/api/auth/logout');
  assert.equal(response.status, 204);
});
