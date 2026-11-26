# TrustVault 🔐
### Full-Stack Digital Identity & Document Verification Portal
**Built with Node.js, Express.js, MongoDB (Mongoose), and React 19**

TrustVault is an enterprise-grade academic digital identity and document verification portal. It empowers students, faculty verifiers, and administrative audit officers to store, review, and verify academic records with cryptographic SHA-256 tamper-evident audit trails.

---

## 🏛️ Full-Stack System Architecture

```text
TrustVault/
├── server/                         # Backend (Node.js & Express.js REST API)
│   ├── src/
│   │   ├── models/                 # Mongoose Database Schemas
│   │   │   ├── User.js             # User profiles, passwords, TOTP & PINs
│   │   │   ├── Document.js         # Vault docs, MIME, metadata, SHA-256 hashes
│   │   │   ├── AccessRequest.js    # Student consent & faculty access permissions
│   │   │   ├── Audit.js            # Cryptographic SHA-256 blockchain audit ledger
│   │   │   └── Share.js            # Time-limited public external view links
│   │   ├── routes/                 # Express API Endpoint Handlers
│   │   │   ├── auth.js             # Sign-in, 1-Click Demo Login, JWT, PIN, Profile
│   │   │   ├── documents.js        # Upload, Verhoeff/PAN checks, watermarking
│   │   │   ├── records.js          # Faculty student search, batch reviews & requests
│   │   │   ├── access.js           # Student consent approvals & revocations
│   │   │   ├── shares.js           # Time-limited external shares & views
│   │   │   └── admin.js            # Admin stats, user controls & ledger verification
│   │   ├── middleware/             # JWT authentication & role authorization guards
│   │   ├── lib/                    # Cryptographic hashing & Verhoeff algorithms
│   │   ├── config.js               # Environment configuration loader
│   │   └── index.js                # Express app entry & MongoDB connection
│   ├── scripts/
│   │   └── seed.js                 # Database seeder populating demo data
│   ├── .env                        # Server configuration (PORT, MONGO_URI, JWT_SECRET)
│   └── package.json
│
├── client/                         # Frontend (React 19 + Vite + Tailwind CSS)
│   ├── src/
│   │   ├── pages/                  # Responsive views (Dashboard, Documents, Records, etc.)
│   │   ├── components/             # Reusable UI components & dialogs
│   │   ├── lib/api.js              # Full-stack API client with graceful offline fallback
│   │   └── main.jsx
│   ├── vite.config.js              # Proxy config: /api -> http://localhost:5000
│   └── package.json
│
├── demo-accounts.json              # Reference student, faculty & admin credentials
├── package.json                    # Root runner orchestrating concurrent execution
└── Start TrustVault.bat            # 1-Click Windows full-stack launcher
```

---

## ⚡ 1-Click Demo Logins

No manual typing required! Visit the **Sign In** screen and click any of the **1-Click Demo Login** buttons:

| Role | 1-Click Demo Button | Default Password | What You Can Test |
| :--- | :--- | :--- | :--- |
| **🎓 Student** | Click `🎓 Student` | `TrustVault@2026` | Upload identity/academic documents, view validation scores, approve faculty consent requests, manage vault PIN |
| **👩‍🏫 Faculty** | Click `👩‍🏫 Faculty` | `TrustVault@2026` | Batch student search (`23MX`), request required certificates, review verified credentials, mark approvals |
| **🛡️ Administrator** | Click `🛡️ Admin` | `TrustVault@2026` | Inspect institute-wide activity, verify SHA-256 tamper-evident ledger integrity, manage accounts |

> **Vault PIN (all demo accounts):** `482915`

---

## 🚀 How to Run the Project

### Option 1: 1-Click Windows Launcher (Easiest)
Double-click `Start TrustVault.bat`. It will start both the Express backend and React frontend concurrently and open `http://localhost:5173` in your browser.

### Option 2: From Terminal / Command Prompt
1. Run both frontend and backend concurrently:
   ```bash
   npm run dev
   ```
2. Or run each component individually:
   - **Backend API only:**
     ```bash
     npm run server
     ```
     Runs on `http://localhost:5000/api`
   - **Frontend only:**
     ```bash
     npm run client
     ```
     Runs on `http://localhost:5173`

---

## 🗄️ MongoDB Setup & Seeding

1. **MongoDB Connection**:
   The backend connects to MongoDB via Mongoose using the connection string in `server/.env`:
   ```env
   PORT=5000
   MONGO_URI=mongodb://127.0.0.1:27017/trustvault
   JWT_SECRET=trustvault_super_secret_jwt_key_2026_secured
   CLIENT_ORIGIN=http://localhost:5173
   ```
   *(You can also paste a MongoDB Atlas cloud URI into `MONGO_URI`)*.

2. **Seed the Database with Demo Data**:
   To pre-populate users, sample verified documents, consent requests, and initial blockchain ledger entries into MongoDB, run:
   ```bash
   npm run seed
   ```

---

## 🛡️ Core Technologies & Security Features

- **Backend**: Node.js & Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT tokens with bcrypt password hashing
- **Cryptographic Audit Ledger**: SHA-256 blockchain-style chaining (`prevHash` + `data` -> `hash`) with 1-click integrity verification
- **Aadhaar Verification**: UIDAI-compliant Verhoeff checksum algorithm and digit masking
- **PAN Verification**: Income Tax Department alphanumeric pattern recognition
- **Frontend**: React 19, Vite, Tailwind CSS, Lucide Icons
- **Fault-Tolerant Hybrid Sync**: Frontend calls the Express backend via `/api`; if MongoDB/backend is offline, it seamlessly falls back to self-contained demo storage without interruption.
