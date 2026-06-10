<div align="center">
  <img src="https://img.shields.io/badge/Status-Active-success.svg" alt="Status" />
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License" />
  <img src="https://img.shields.io/badge/Stack-MERN-purple.svg" alt="Stack" />
  <img src="https://img.shields.io/badge/AI-Gemini%20%7C%20Groq-orange.svg" alt="AI Features" />
  <br />
  <h1>🚀 SyncSpace</h1>
  <p><strong>A modern, real-time, AI-powered project management and collaboration workspace.</strong></p>
</div>

<br />

SyncSpace is a highly responsive, real-time collaboration platform designed for modern teams. It combines the visual organization of Kanban boards with the power of real-time WebSocket communication and intelligent AI assistance to streamline workflows.

---

## ✨ Features

- **Real-Time Collaboration**: Instant updates across all connected clients via Socket.IO. See who is currently active in your workspace with live presence indicators.
- **Drag-and-Drop Kanban**: Intuitive task management with smooth drag-and-drop interactions across customizable columns.
- **AI-Powered Workflows**:
  - Automatically generate task descriptions based on titles.
  - Smart assignee suggestions based on workspace context.
  - Workspace-level AI insights and analytics using Google Gemini and Groq models.
- **Advanced Authentication**: Secure, seamless login system using JWTs. Features short-lived access tokens stored in memory/localStorage and long-lived HTTP-only refresh cookies.
- **Workspace & Role Management**: Create isolated workspaces, invite members via shareable links, and manage permissions (Owner, Admin, Member).
- **Enterprise-Grade Security**: Protected against NoSQL injections, XSS attacks (via Helmet CSP), and brute-force attempts (via Express Rate Limiter).

---

## 🛠️ Technology Stack

### Frontend (Client)
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + custom UI variables
- **Animations**: Framer Motion
- **Drag & Drop**: `@hello-pangea/dnd`
- **Networking**: Axios (with automated silent token refresh interceptors)
- **WebSockets**: `socket.io-client`

### Backend (Server)
- **Runtime**: Node.js & Express.js
- **Database**: MongoDB (Mongoose ORM)
- **Real-Time**: Socket.IO
- **AI Integration**: `@google/genai` (Gemini) & `groq-sdk` (Llama/Mixtral)
- **Security**: `helmet`, `express-rate-limit`, `express-mongo-sanitize`, `hpp`, `bcryptjs`

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (Local or Atlas cluster)

### 1. Clone the repository
```bash
git clone https://github.com/tdk-netsec14/sync-space.git
cd sync-space
```

### 2. Setup the Backend
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory using the provided template:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_ACCESS_SECRET=generate_a_random_secure_string
JWT_REFRESH_SECRET=generate_another_secure_string
CLIENT_URL=http://localhost:3000

# Optional AI Keys (Leave blank to disable AI features)
GEMINI_API_KEY=your_gemini_key
GROQ_API_KEY=your_groq_key
AI_ENABLED=true
```
Start the backend development server:
```bash
npm run dev
```

### 3. Setup the Frontend
Open a new terminal window:
```bash
cd client
npm install
```
Create a `.env` file in the `client` directory:
```env
VITE_API_URL=http://localhost:5000
VITE_API_PREFIX=/api/v1
```
Start the frontend development server:
```bash
npm run dev
```

The application will now be running at `http://localhost:3000`.

---

## 🌍 Deployment Architecture

SyncSpace is designed to be easily deployed across decoupled services:

1. **Database**: MongoDB Atlas (Serverless Database)
2. **Backend**: Render (Web Service)
3. **Frontend**: Vercel (Static Web Hosting)

*Note on Production Cookies: SyncSpace utilizes cross-domain authentication (`vercel.app` frontend communicating with an `onrender.com` backend). To support this, HTTP-only refresh cookies are configured with `SameSite=None; Secure` in production environments.*

---

## 🤝 Contributing

We welcome contributions! Please follow these guidelines:
1. **Branch Naming**: Use the format `type/feature-name` (e.g., `feat/add-dark-mode`, `fix/login-bug`).
2. **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) (e.g., `feat: added AI task generation`, `fix: corrected typo in API`).
3. **Pull Requests**: Open a PR against the `main` branch with a clear description of the changes made.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
