# SyncSpace 🚀

![Build Status](https://img.shields.io/github/actions/workflow/status/yourusername/syncspace/ci.yml?branch=main)
![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)

SyncSpace is an AI-powered project management and team collaboration workspace featuring real-time socket updates, automated sprint reporting, and intelligent task generation.

## 📋 Prerequisites
- **Node.js** v20+
- **MongoDB** v6+ (or use the provided Docker Compose file)
- **Git**

## ⚙️ Environment Variables
Create `.env` files in both the `server/` and `client/` directories based on the `.example` templates.

### Server (`server/.env`)
| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | Yes | `development`, `test`, or `production` |
| `PORT` | Yes | Port for the Express API (default: 5000) |
| `MONGO_URI` | Yes | Connection string to MongoDB |
| `CLIENT_URL` | Yes | The URL of the frontend for CORS and Cookies |
| `JWT_ACCESS_SECRET` | Yes | Secret for signing short-lived access tokens |
| `JWT_REFRESH_SECRET`| Yes | Secret for signing long-lived refresh tokens |
| `CSRF_SECRET` | Yes | Secret for CSRF token hashing |
| `AI_ENABLED` | No | Set to `false` to disable AI routes entirely |
| `GEMINI_API_KEY` | Yes* | Primary AI API Key (Google) |
| `GROQ_API_KEY` | Yes* | Fallback AI API Key (Groq) |

### Client (`client/.env`)
| Variable | Required | Description |
|---|---|---|
| `VITE_API_URL` | Yes | Full URL to the backend API |
| `VITE_API_PREFIX` | Yes | Base API prefix (e.g., `/api/v1`) |

## 🚀 Deployment Steps

### Local Development (Docker Orchestrated)
The easiest way to run the backend stack locally is via Docker:
```bash
# Start the Node.js API and MongoDB container
docker-compose up -d --build

# In a separate terminal, start the frontend
cd client && npm run dev
```

### Production Hosting
- **Frontend (Vercel):** Connect your repository to Vercel and set the Root Directory to `client`. The provided `vercel.json` automatically handles SPA routing fallbacks.
- **Backend (Render):** Connect your repository to Render. The provided `render.yaml` Blueprint will automatically detect the backend, configure the build commands, and prompt you for the required environment secrets.

## 🤝 Contributing
Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our code of conduct, branch naming, and the process for submitting Pull Requests.
