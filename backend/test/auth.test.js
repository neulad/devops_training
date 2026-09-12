import test from 'node:test';
import assert from 'node:assert/strict';
import { createSession, hashPassword, readSession, validateNickname, verifyPassword } from '../src/auth.js';

test('accepts safe nicknames and rejects invalid ones', () => {
  assert.equal(validateNickname('mira_7'), true);
  assert.equal(validateNickname('ab'), false);
  assert.equal(validateNickname('name with spaces'), false);
  assert.equal(validateNickname('x'.repeat(33)), false);
});

test('hashes passwords with bcrypt and verifies them', async () => {
  const hash = await hashPassword('correct horse battery staple');
  assert.notEqual(hash, 'correct horse battery staple');
  assert.equal(await verifyPassword('correct horse battery staple', hash), true);
  assert.equal(await verifyPassword('wrong password', hash), false);
});

test('creates a session containing the user identity', () => {
  const token = createSession({ id: 42, nickname: 'mira_7' });
  const session = readSession(token);
  assert.equal(session.sub, '42');
  assert.equal(session.nickname, 'mira_7');
});
