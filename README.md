# Production Server and Deployment

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-Deployment-2088FF?logo=githubactions&logoColor=white)](https://github.com/features/actions)
[![DuckDNS](https://img.shields.io/badge/DuckDNS-DNS-orange)](https://www.duckdns.org/)
[![nginx](https://img.shields.io/badge/nginx-Reverse%20Proxy-009639?logo=nginx&logoColor=white)](https://nginx.org/)
[![Let's Encrypt](https://img.shields.io/badge/Let's%20Encrypt-TLS-003A70?logo=letsencrypt&logoColor=white)](https://letsencrypt.org/)
[![Certbot](https://img.shields.io/badge/Certbot-ACME-2E8555)](https://certbot.eff.org/)
[![UFW](https://img.shields.io/badge/UFW-Firewall-333333)](https://help.ubuntu.com/community/UFW)
[![Fail2ban](https://img.shields.io/badge/Fail2ban-Brute--Force%20Protection-8A2BE2)](https://www.fail2ban.org/)

This project is deployed to a Linux server with Docker Compose. The public hostname points to the server through DuckDNS, nginx is the public reverse proxy, and GitHub Actions updates the application over SSH.

## Screenshots

### GitHub Actions deployment

<img width="1126" height="568" alt="image" src="https://github.com/user-attachments/assets/5eb55590-7011-412e-85ef-49dbd61f4234" />
<img width="1083" height="534" alt="image" src="https://github.com/user-attachments/assets/04e6a153-0299-46da-bce5-b7498b16833e" />


### Docker Compose services
<img width="334" height="80" alt="image" src="https://github.com/user-attachments/assets/289f5407-2e59-4e10-913f-40c8b9148075" />

### Firewall
<img width="385" height="184" alt="image" src="https://github.com/user-attachments/assets/1be99c44-0508-4630-b5d2-bfc380e44102" />


## Video explanation

The recorded deployment explanation is available here:

[![Watch the deployment explanation](https://img.youtube.com/vi/gKYbQm7ih0M/hqdefault.jpg)](https://youtu.be/gKYbQm7ih0M)

## Deployment architecture

The request path is:

```text
client -> DuckDNS -> server firewall -> nginx -> backend container -> PostgreSQL
```

Docker Compose runs three services:

- PostgreSQL stores application data in the persistent `pgdata` volume.
- The backend container runs pending migrations and then starts the API.
- nginx publishes ports `80` and `443`, serves the application, and proxies `/api/` to the backend.

Only nginx is exposed to the Internet. PostgreSQL and the backend are reachable through the internal Compose network, not through public host ports.

## DuckDNS

[DuckDNS](https://www.duckdns.org/) provides a free DNS record such as `test-devops.duckdns.org` that points to the server's public IP address. The hostname is used consistently by the nginx `server_name` directive, the TLS certificate issued by Let's Encrypt, the client URL, and the ACME HTTP-01 challenge.

Create the DuckDNS subdomain, set its public IPv4 address, and update it whenever the server IP changes. A dynamic DNS updater is useful when the ISP changes the address.

## Initial server setup

The examples below assume a fresh Ubuntu server and a deployment directory of `/srv/devops_training`.

Install Git, Docker, and the Compose plugin using the official Docker instructions. Then create a dedicated non-root deployment user:

```sh
sudo adduser deploy
sudo usermod -aG docker deploy
sudo mkdir -p /srv/devops_training
sudo chown -R deploy:deploy /srv/devops_training
```

Log in as `deploy` for application work. Group membership may require logging out and in again before the `docker` command works without `sudo`.

Clone the repository and create the root `.env` file. It is intentionally not committed to Git:

```sh
git clone <repository-url> /srv/devops_training
cd /srv/devops_training
```

```dotenv
POSTGRES_USER=app
POSTGRES_PASSWORD=<long-random-password>
POSTGRES_DB=app
JWT_SECRET=<long-random-secret>
```

Start the stack after nginx certificate paths have been prepared:

```sh
docker compose up -d --build
docker compose ps
docker compose logs -f
```

The backend waits for PostgreSQL to become healthy, runs migrations, and then starts the API. `pgdata` and `uploads` survive container recreation because they are named Docker volumes.

## SSH: key authentication and no root login

The server should use SSH keys instead of passwords, and SSH should reject direct root login. Generate a dedicated deployment key on the administrative machine:

```sh
ssh-keygen -t ed25519 -f ~/.ssh/github_actions_deploy -C github-actions-deploy
ssh-copy-id -i ~/.ssh/github_actions_deploy.pub deploy@<server-ip>
```

The private key stays outside the repository. GitHub Actions receives it as an encrypted repository secret. The public key is added to `/home/deploy/.ssh/authorized_keys` on the server.

<img width="955" height="529" alt="image" src="https://github.com/user-attachments/assets/d284db19-3545-4f96-850d-f94e32f0338d" />


In `/etc/ssh/sshd_config`, use settings equivalent to:

```text
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
AllowUsers deploy
```

Validate the configuration before restarting SSH, and keep the current session open while testing a second connection:

```sh
sudo sshd -t
sudo systemctl restart ssh
ssh -i ~/.ssh/github_actions_deploy deploy@<server-ip>
```

“No password” refers to SSH authentication, not to the GitHub Actions connection being unauthenticated: Actions proves its identity with the encrypted private key and the server verifies the matching public key. The `deploy` user can run Docker through the Docker group, while root access is reserved for separately controlled administrative access through `sudo`.

## GitHub Actions deployment

The workflow in `.github/workflows/deploy.yml` runs on pushes to `main`. It uses `appleboy/ssh-action` to connect to the server and executes:

```sh
cd /srv/devops_training
git pull
docker compose up -d --build
```

Configure these repository secrets:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | Server IP address or DNS hostname |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | Complete contents of `github_actions_deploy` |

The server must already contain the repository, have access to pull it, and have a valid `.env` file. GitHub Actions does not copy database credentials to the server; those remain in the server-side `.env` file.

After the first manual deployment succeeds, a normal release is:

```sh
git add .
git commit -m "Deploy change"
git push origin main
```

Inspect a deployment on the server with:

```sh
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100
```

## Docker and Docker Compose

The root `docker-compose.yml` defines the service relationships and persistent data:

- `db` uses PostgreSQL 16 and has a healthcheck with `pg_isready`.
- `backend` depends on a healthy database and receives its connection string from environment variables.
- nginx publishes `80:80` and `443:443` and mounts the Let's Encrypt certificates read-only.

Useful operational commands:

```sh
docker compose up -d --build
docker compose down
docker compose restart backend
docker compose logs -f
docker volume ls
```

Do not use `docker compose down -v` on a production server unless deleting the database and uploaded files is intentional.

## nginx reverse proxy

nginx is the only public application endpoint. Its configuration serves the ACME challenge path from `/var/www/certbot`, redirects normal HTTP requests from port 80 to HTTPS, terminates TLS on port 443, proxies `/api/` to `http://backend:8000`, and enforces a 20 MB request limit.

The `Host`, client IP, forwarded IP chain, and original protocol are passed to the backend with proxy headers. The backend should therefore trust these headers only when traffic comes through the known nginx proxy.

## TLS with Certbot and the ACME HTTP-01 challenge

TLS is the accurate term for the modern protocol; “SSL certificate” is common legacy terminology. Certbot obtains and renews a certificate from Let's Encrypt. Let's Encrypt is a certificate authority, and it uses the ACME protocol to automate certificate issuance.

The challenge configured here is the **ACME HTTP-01 challenge**. Certbot places a token under `/.well-known/acme-challenge/<token>`. Let's Encrypt requests that URL over HTTP, and nginx serves the token from `/var/www/certbot`, proving control of the hostname. Port 80 must be reachable during issuance and renewal; all other HTTP traffic is redirected to HTTPS.

The nginx container mounts these paths read-only:

```text
/etc/letsencrypt:/etc/letsencrypt:ro
/var/www/certbot:/var/www/certbot:ro
```

On the server, Certbot needs write access to the same challenge directory and certificate directory. A typical first issuance uses webroot mode while nginx is running:

```sh
sudo certbot certonly --webroot \
	-w /var/www/certbot \
	-d test-devops.duckdns.org
docker compose restart
```

Test renewal without changing the live certificate:

```sh
sudo certbot renew --dry-run
```

After a real renewal, reload or restart nginx so it reads the new certificate. Automate this with a systemd timer or cron job. Certificate files and private keys must never be committed to Git.

## UFW firewall

UFW should allow only the services required for administration and public HTTPS:

```sh
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Do not expose PostgreSQL (`5432`) or the backend port (`8000`) in UFW or Compose. Confirm that a second SSH session works before enabling a restrictive firewall policy.

## Verification checklist

- DuckDNS resolves the hostname to the current public IP.
- SSH works for `deploy` with the private key, while root and password login are disabled.
- UFW allows ports 22, 80, and 443 only as required.
- `docker compose ps` shows healthy, running services.
- `https://test-devops.duckdns.org` presents a valid certificate.
- `sudo certbot renew --dry-run` succeeds.
- GitHub Actions can deploy a push to `main`.
- PostgreSQL and the backend port are not publicly reachable.
