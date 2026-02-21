# SyncSpace

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-Express%205-green.svg)
![MongoDB](https://img.shields.io/badge/MongoDB-Database-green.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Real%20Time-black.svg)
![Vite](https://img.shields.io/badge/Vite-Bundler-purple.svg)
![TailwindCSS](https://img.shields.io/badge/Tailwind-CSS-blue.svg)

SyncSpace is a production-grade, AI-powered multi-tenant collaboration platform built from the ground up for high-performance engineering and product teams. It combines robust real-time Kanban board management with cutting-edge local and cloud AI intelligence.

## 🚀 Features

- **Multi-tenant Architecture:** Secure workspace isolation with role-based access control (Owner, Admin, Member).
- **Real-time Collaboration:** Live updates for tasks, boards, and comments powered by Socket.io.
- **Premium Design System:** A highly responsive, Tailwind CSS-powered UI engineered for speed, aesthetics, and accessibility across all devices.
- **AI Workspace Intelligence:** 
  - Automated Sprint Reports
  - Personalized 24-hour Standups
  - Smart Task Assignee Suggestions
  - AI-generated Task Descriptions
- **Drag & Drop Workflows:** Seamless Kanban column and task management with `@hello-pangea/dnd`.

## 🛠 Tech Stack & Architecture

- **Frontend:** React 18, Vite, Tailwind CSS, React Router, Axios
- **Backend:** Node.js, Express.js 5, MongoDB (Mongoose), Socket.io
- **AI Integration:** Google GenAI (Gemini 2.0 Flash) with Groq (Llama 3.3-70B) fallback strategies.
- **Security:** JWT authentication, bcrypt password hashing, `express-rate-limit`, `helmet`.

### 🧠 AI Architecture

Our AI features utilize a dual-provider strategy to ensure high availability and responsiveness. 
- **Primary:** Google Gemini 2.0 Flash is used for complex contextual analysis like comprehensive sprint reports and detailed task generation.
- **Fallback/Fast Path:** Groq (Llama 3.3-70B) provides ultra-low latency responses for real-time task suggestions and quick daily standup summaries.

## 📁 Folder Structure

```
SyncSpace/
├── client/                 # React Frontend
│   ├── public/
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Route components
│   │   ├── context/        # React Context (Auth, Socket)
│   │   ├── services/       # API integration
│   │   └── styles/         # Tailwind & global CSS
├── server/                 # Node/Express Backend
│   ├── models/             # Mongoose Schemas
│   ├── routes/             # API Endpoints
│   ├── services/           # AI and Business Logic
│   ├── middleware/         # Auth & Validation
│   └── index.js            # Entry Point
└── ...
```

## 🔐 Security

- **Authentication:** Stateless JWTs with secure HTTP-only cookies (in production).
- **Authorization:** Role-Based Access Control (RBAC) ensuring data boundary integrity between tenants.
- **Data Protection:** Passwords securely hashed with bcrypt. All sensitive configuration managed via environment variables.

## 🚢 Deployment

### Frontend (Vercel)
The React client is configured for Vercel deployment as a Single Page Application (SPA). A `client/vercel.json` ensures that React Router paths are correctly rewritten.

### Backend (Render)
The Node/Express backend is ready for Render. A `render.yaml` configuration is included to spin up the `syncspace-api` web service automatically.

## ⚙️ Setup Instructions

1. **Clone and Install**
   ```bash
   git clone https://github.com/tdk-netsec14/sync-space.git
   cd sync-space
   npm install
   cd client && npm install
   ```
2. **Environment Variables**
   Create a `.env` in the `server` directory (see `server/.env.example`):
   ```env
   PORT=5000
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   CLIENT_URL=http://localhost:5173
   GEMINI_API_KEY=your_gemini_key
   GROQ_API_KEY=your_groq_key
   ```
3. **Run Development Mode**
   Start the backend:
   ```bash
   cd server
   npm run dev
   ```
   Start the frontend (in a new terminal):
   ```bash
   cd client && npm run dev
   ```

## 🎨 Design Philosophy
SyncSpace employs the custom "Obsidian Command" design palette—featuring deep slate backgrounds, crisp indigo accents, and clean, geometric sans-serif typography. Every interaction is optimized for reduced cognitive load and maximum developer productivity.

## 🤝 Contribution

We welcome contributions! Please follow our established coding standards and submit pull requests to the `main` branch. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
