import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const saltRounds = 12;
const nicknamePattern = /^[a-zA-Z0-9_-]{3,32}$/;

export function validateNickname(nickname) {
  return typeof nickname === 'string' && nicknamePattern.test(nickname);
}

export function getJwtSecret() {
  return process.env.JWT_SECRET || 'development-only-change-me';
}

export async function hashPassword(password) {
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function createSession(user) {
  return jwt.sign({ sub: String(user.id), nickname: user.nickname }, getJwtSecret(), { expiresIn: '7d' });
}

export function readSession(token) {
  return jwt.verify(token, getJwtSecret());
}
