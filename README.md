# Filebox

A small private file-sharing SPA for practicing a production Docker deployment.

## Architecture
- `frontend/`: React + Vite SPA served by nginx.
- `backend/`: Express API with bcrypt password hashing and HTTP-only cookie sessions.
- `backend/migrations/`: numbered PostgreSQL migrations for users and file metadata.
- PostgreSQL stores accounts and metadata; uploaded file bytes live in the persistent `uploads` Docker volume.

Files are limited to 20 MB by both nginx and the backend.

## Local development

1. Copy `.env.example` to `.env` and set a long random `JWT_SECRET`.
2. Export the variables before running Node locally: `set -a; source .env; set +a`.
3. Run migrations: `cd backend && npm install && npm run migrate`.
4. Start the API: `npm run dev`.
5. In another terminal, run `cd frontend && npm install && npm run dev`.
6. Open the Vite URL shown in the terminal.
7. Test if everything works

The Vite development server proxies `/api` to `http://localhost:8000`.

## Docker deployment

Create a root `.env` with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `JWT_SECRET`, then run:

```sh
docker compose up --build
```

The database healthcheck completes before the backend starts. The backend applies all pending migrations before starting the API. Nginx serves the SPA and proxies `/api/` to the backend.

## Tests

Backend tests cover nickname validation, bcrypt hashing and verification, and signed session claims:

```sh
cd backend
npm test
```
