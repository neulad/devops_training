import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { query } from './db.js';
import { createSession, hashPassword, readSession, validateNickname, verifyPassword } from './auth.js';

export const app = express();
const port = Number(process.env.PORT || 8000);
const uploadDir = process.env.UPLOAD_DIR || '/tmp/opsboard-uploads';
const maxFileSize = 20 * 1024 * 1024;

if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) throw new Error('JWT_SECRET is required in production');

await fs.mkdir(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: maxFileSize },
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

function setSession(response, user) {
  response.cookie('session', createSession(user), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function requireAuth(request, response, next) {
  try {
    const token = request.cookies.session;
    if (!token) return response.status(401).json({ error: 'Authentication required' });
    request.user = readSession(token);
    next();
  } catch {
    response.status(401).json({ error: 'Authentication required' });
  }
}

app.get('/api/health', async (_request, response) => {
  try {
    await query('SELECT 1');
    response.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    response.status(503).json({ status: 'degraded', database: 'unavailable', detail: error.message });
  }
});

app.post('/api/auth/register', async (request, response, next) => {
  const { nickname, password } = request.body;
  if (!validateNickname(nickname)) return response.status(400).json({ error: 'Nickname must be 3-32 letters, numbers, hyphens, or underscores' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) return response.status(400).json({ error: 'Password must be 8-72 characters' });
  try {
    const passwordHash = await hashPassword(password);
    const result = await query('INSERT INTO users (nickname, password_hash) VALUES ($1, $2) RETURNING id, nickname', [nickname, passwordHash]);
    setSession(response, result.rows[0]);
    response.status(201).json({ user: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') return response.status(409).json({ error: 'Nickname is already taken' });
    next(error);
  }
});

app.post('/api/auth/login', async (request, response, next) => {
  const { nickname, password } = request.body;
  try {
    const result = await query('SELECT id, nickname, password_hash FROM users WHERE nickname = $1', [nickname]);
    const user = result.rows[0];
    if (!user || !(await verifyPassword(password || '', user.password_hash))) return response.status(401).json({ error: 'Invalid nickname or password' });
    setSession(response, user);
    response.json({ user: { id: user.id, nickname: user.nickname } });
  } catch (error) {
    next(error);
  }
});

app.post('/api/auth/logout', (_request, response) => {
  response.clearCookie('session');
  response.status(204).end();
});

app.get('/api/auth/me', requireAuth, (request, response) => {
  response.json({ user: { id: request.user.sub, nickname: request.user.nickname } });
});

app.get('/api/files', requireAuth, async (request, response, next) => {
  try {
    const result = await query(`SELECT id, original_name, mime_type, size_bytes, created_at
      FROM files WHERE user_id = $1 ORDER BY created_at DESC`, [request.user.sub]);
    response.json({ files: result.rows });
  } catch (error) {
    next(error);
  }
});

app.post('/api/files', requireAuth, upload.single('file'), async (request, response, next) => {
  if (!request.file) return response.status(400).json({ error: 'Choose a file to upload' });
  const id = crypto.randomUUID();
  try {
    await query(`INSERT INTO files (id, user_id, original_name, stored_name, mime_type, size_bytes)
      VALUES ($1, $2, $3, $4, $5, $6)`, [id, request.user.sub, request.file.originalname, path.basename(request.file.filename), request.file.mimetype || 'application/octet-stream', request.file.size]);
    response.status(201).json({ file: { id, original_name: request.file.originalname, size_bytes: request.file.size, mime_type: request.file.mimetype } });
  } catch (error) {
    await fs.rm(request.file.path, { force: true });
    next(error);
  }
});

app.get('/api/files/:id/download', requireAuth, async (request, response, next) => {
  try {
    const result = await query('SELECT original_name, stored_name FROM files WHERE id = $1 AND user_id = $2', [request.params.id, request.user.sub]);
    if (!result.rowCount) return response.status(404).json({ error: 'File not found' });
    response.download(path.join(uploadDir, result.rows[0].stored_name), result.rows[0].original_name);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/files/:id', requireAuth, async (request, response, next) => {
  try {
    const result = await query('DELETE FROM files WHERE id = $1 AND user_id = $2 RETURNING stored_name', [request.params.id, request.user.sub]);
    if (!result.rowCount) return response.status(404).json({ error: 'File not found' });
    await fs.rm(path.join(uploadDir, result.rows[0].stored_name), { force: true });
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((error, _request, response, _next) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return response.status(413).json({ error: 'Files must be smaller than 20 MB' });
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
});

if (process.env.NODE_ENV !== 'test') app.listen(port, () => console.log(`Filebox API listening on port ${port}`));
