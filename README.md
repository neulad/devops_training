# Opsboard

A mildly complex production operations dashboard for practicing a real VPS deployment path.

## Architecture

- `frontend/`: React + Vite static bundle. Build it with `npm run build`; deploy `frontend/dist/` as static files.
- `backend/`: Node.js + Express JSON API. It never serves frontend files.
- `backend/migrations/`: SQL migrations and seed data.
- PostgreSQL is external. The app only needs a connection string supplied through `DATABASE_URL`.

## Local development

1. Create a database and copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. Run migrations: `cd backend && npm install && npm run migrate`.
4. Start the API: `npm run dev`.
5. In a second terminal, run `cd frontend && npm install && npm run dev`.
6. Open the Vite URL shown in the terminal. Vite proxies `/api` to `http://localhost:8000`.

## VPS deployment shape

Build the frontend on the deployment host or CI and let nginx serve `frontend/dist/` as its document root. Run the backend as a long-lived Node process on a private localhost port, with `DATABASE_URL` and `PORT` in its environment. Configure nginx to serve the frontend and proxy only `/api/` to the backend. Run `npm run migrate` during releases before restarting the API.

The UI exercises both read and write paths: it loads service health, incidents, deployments, and database health, and the Resolve action updates an incident through `PATCH /api/incidents/:id`.
