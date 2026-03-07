# Docker Deployment Guide - Smart Yard Monitoring System

This guide covers how to run the Smart Yard Monitoring System using Docker containers.

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Docker Compose v2.x or later
- At least 4GB RAM available for containers

## Quick Start

### 1. Build and Start All Services

```bash
# From project root directory
docker compose up --build
```

This will:
- Build the frontend React application
- Build the backend Node.js API server
- Pull MongoDB 6 image
- Start all services with proper networking

### 2. Access the Application

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:5000/api  |
| MongoDB  | mongodb://localhost:27017  |

### 3. Stop Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes (WARNING: deletes database data)
docker compose down -v
```

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    Docker Network: smartyard-network           │
├────────────────────┬───────────────────┬──────────────────────┤
│                    │                   │                      │
│  ┌──────────────┐  │  ┌─────────────┐  │  ┌────────────────┐  │
│  │   Frontend   │  │  │   Backend   │  │  │    MongoDB     │  │
│  │   (Nginx)    │──┼─▶│   (Node)    │──┼─▶│   (Mongo 6)    │  │
│  │   :80        │  │  │   :5000     │  │  │   :27017       │  │
│  └──────────────┘  │  └─────────────┘  │  └────────────────┘  │
│         │          │                   │          │           │
└─────────┼──────────┴───────────────────┴──────────┼───────────┘
          │                                         │
    localhost:3000                           mongo-data volume
```

## Service Details

### Frontend Container
- **Image**: Node 20 (build) + Nginx Alpine (serve)
- **Port**: 3000 → 80
- **Features**:
  - Multi-stage build for optimized image size
  - Nginx reverse proxy to backend
  - React SPA routing support
  - Gzip compression enabled

### Backend Container
- **Image**: Node 20 Alpine
- **Port**: 5000
- **Features**:
  - Health check endpoint: `/api/health`
  - Non-root user for security
  - Automatic restart on failure

### MongoDB Container
- **Image**: MongoDB 6
- **Port**: 27017
- **Features**:
  - Persistent data volume
  - Health check via mongosh ping

## Environment Variables

Copy the example environment file to customize:

```bash
cp .env.docker.example .env.docker
```

### Backend Environment Variables

| Variable            | Default                          | Description              |
|---------------------|----------------------------------|--------------------------|
| `NODE_ENV`          | `production`                     | Node environment         |
| `PORT`              | `5000`                           | Backend server port      |
| `MONGODB_URI`       | `mongodb://mongo:27017/smartyard`| MongoDB connection string|
| `FRONTEND_URL`      | `http://frontend:80`             | For CORS configuration   |
| `QR_EXPIRATION_MINUTES` | `15`                         | QR code validity period  |

### Frontend Environment Variables

| Variable            | Default  | Description                    |
|---------------------|----------|--------------------------------|
| `VITE_API_BASE_URL` | `/api`   | API base URL (proxied by nginx)|

## Development with Docker

### Rebuild Single Service

```bash
# Rebuild only backend
docker compose build backend
docker compose up backend

# Rebuild only frontend
docker compose build frontend
docker compose up frontend
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongo
```

### Access Container Shell

```bash
# Backend
docker exec -it smartyard-backend sh

# MongoDB
docker exec -it smartyard-mongo mongosh
```

### Seed Database

```bash
# Run seed script inside backend container
docker exec -it smartyard-backend npm run seed
```

## Production Deployment

### Using External MongoDB

For production, use MongoDB Atlas or a dedicated MongoDB server:

```yaml
# In docker-compose.yml, update backend environment:
environment:
  MONGODB_URI: mongodb+srv://user:pass@cluster.mongodb.net/smartyard
```

### Enable MongoDB Authentication

```yaml
# In docker-compose.yml, update mongo service:
mongo:
  environment:
    MONGO_INITDB_ROOT_USERNAME: admin
    MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD}

# Update backend connection string:
backend:
  environment:
    MONGODB_URI: mongodb://admin:${MONGO_ROOT_PASSWORD}@mongo:27017/smartyard?authSource=admin
```

### SSL/HTTPS Setup

For production HTTPS, add a reverse proxy (Traefik, Caddy, or nginx-proxy) in front of the frontend container.

## Troubleshooting

### Container Won't Start

```bash
# Check container logs
docker compose logs backend
docker compose logs frontend

# Check container status
docker compose ps
```

### Database Connection Failed

1. Ensure MongoDB container is healthy: `docker compose ps`
2. Check MongoDB logs: `docker compose logs mongo`
3. Verify network connectivity: `docker network inspect smartyard-network`

### Frontend Can't Reach Backend

1. Nginx proxies `/api` requests to `http://backend:5000`
2. Ensure backend health check passes
3. Check nginx logs: `docker exec smartyard-frontend cat /var/log/nginx/error.log`

### Reset Everything

```bash
# Stop all containers, remove volumes, rebuild
docker compose down -v
docker compose up --build
```

## Health Checks

All services include health checks:

| Service  | Endpoint                   | Command                                |
|----------|----------------------------|----------------------------------------|
| Backend  | `GET /api/health`          | `curl -f http://localhost:5000/api/health` |
| Frontend | `GET /health`              | `wget --spider http://localhost:80/health` |
| MongoDB  | `mongosh ping`             | `mongosh --eval "db.adminCommand('ping')"` |

## Pipeline Verification

After starting containers, verify the pipeline works:

1. ✅ Access frontend: http://localhost:3000
2. ✅ Health check: http://localhost:3000/api/health
3. ✅ Start session via UI
4. ✅ RFID/FastTag scan creates session
5. ✅ QR code generated
6. ✅ GPS tracking works
7. ✅ Zone transitions logged
8. ✅ Alerts appear in dashboard
9. ✅ Fleet overview shows trucks
10. ✅ Map visualization works

## Files Created

```
project-root/
├── docker-compose.yml          # Main orchestration file
├── .env.docker.example         # Environment template
├── client/
│   ├── Dockerfile              # Frontend multi-stage build
│   ├── nginx.conf              # Nginx configuration
│   └── .dockerignore           # Build exclusions
└── server/
    ├── Dockerfile              # Backend image
    └── .dockerignore           # Build exclusions
```
