# TrustVault — College Digital Identity & Document Verification Portal

TrustVault is a full-stack web application (**React + Vite + Node.js + Express + MongoDB Atlas**) built for colleges to securely verify, store, and share student academic and identity credentials with strict role-based access control, email OTP two-factor authentication, automated document verification, and a tamper-evident SHA-256 audit ledger.

---

## Key Features

### 1. Authentication & Security
- **Student-Only Self-Registration (`/register`)**: Students sign up with their full name, college roll/register number, valid email address, and strong password (min 8 characters, `bcryptjs` hashed).
- **Email + Password + Email OTP Login (`/login`)**:
  - **Step 1**: Student, Faculty, or Admin enters their email and password.
  - **Step 2**: A 6-digit OTP is generated (`crypto.randomInt`) and sent to the user's registered email via SMTP (stored in MongoDB with a 10-minute TTL).
  - **5-Attempt Lockout**: 5 consecutive wrong OTP attempts automatically lock the account in MongoDB. Only the **Administrator** can unlock a locked account.
- **Hardened Backend**: `helmet` security headers, strict CORS, per-IP rate limiting, JWT HTTP-only cookies + Bearer auth, and zero plaintext JSON log/user stores.

### 2. Roles & Permissions
- **Student**:
  - Upload identity & college documents (**PAN Card, Aadhaar Card, Driving Licence, 10th Marksheet, 12th Marksheet, Semester Marksheet, Degree Certificate, College Certificate, Income Certificate, Community Certificate, Other**).
  - Automated verification checks: format/checksum validation (Verhoeff for Aadhaar, PAN entity regex, DL regex), official header keyword extraction (OCR / PDF text), anti-tamper metadata scan, holder name/number matching, resolution check, and duplicate SHA-256 hash detection.
  - **View with Watermark**: Verified documents open with an overlay watermark (`TRUSTVAULT · email`) and full verification metadata (status, score, SHA-256 fingerprint).
  - **Password-Protected ZIP Export**: Export **verified** documents as an AES-256 encrypted ZIP file emailed to the student's registered email, encrypted using the student's **TrustVault login password**.
  - **Consent-Driven Access Control**: Receive notifications when faculty request documents (with reason) and choose to **Approve** or **Deny** specific document types.
- **Faculty (`verifier`)**:
  - Provisioned by the Administrator (login email & password assigned by Admin).
  - Request documents from an **entire batch** or a **specific student** by email/roll number with a purpose/reason.
  - View **only verified** documents for which the student has granted **consent** (approved & unexpired). Every view is logged in the audit ledger.
  - Dynamic **Student Records** & **Batches** view that automatically reflects newly registered students and batches.
- **Administrator (`poojamatheshwaran6363@gmail.com`)**:
  - Create Faculty, Student, or Admin accounts and assign login emails & passwords.
  - Update user details (name, roll/ID, department, role), reset passwords, remove users, and **unlock** OTP-locked accounts.
  - Inspect the **SHA-256 Audit Ledger**, run cryptographic integrity checks, and view **Activity Logs** stored in MongoDB.
  - **Privacy Enforced**: Administrators cannot view or access student documents.

---

## Project Structure

```text
TrustVault-main/
├── client/                  # React + Vite + Tailwind CSS frontend
│   └── src/
│       ├── components/      # UI kit, 3D Wallet, DocViewer, Layout
│       ├── lib/             # API client, AuthProvider, utilities
│       └── pages/           # Landing, Login/Register, Dashboard, Documents, Access, Shares, Activity, Security, Records, Admin
├── server/                  # Node.js + Express + Mongoose backend
│   ├── scripts/seed.js      # Database seeder
│   └── src/
│       ├── lib/             # crypto, auditLedger, activityLogger, otpStore, mailer, verify (OCR/checksums)
│       ├── middleware/      # JWT authMiddleware & requireRole
│       ├── models/          # User, Document, Audit, ActivityLog, OTP, AccessRequest, Share
│       └── routes/          # auth, documents, records, access, shares, admin
└── package.json             # Root scripts (dev, server, client, seed, build)
```

---

## Setup & Running Locally

### 1. Prerequisites
- **Node.js** v18+
- **MongoDB Atlas** cluster (or local MongoDB)
- **Gmail App Password** (or SMTP credentials) in `server/.env` for Email OTP & ZIP delivery

### 2. Configure Environment (`server/.env`)
```env
PORT=5000
MONGO_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/trustvault?retryWrites=true&w=majority
JWT_SECRET=your_32_plus_char_secret_key
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development

SMTP_SERVICE=gmail
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM="TrustVault Verification" <your_email@gmail.com>
```

> **MongoDB Atlas Network Access**: Make sure your current IP address (or `0.0.0.0/0` for development) is whitelisted in **Atlas → Security → Network Access** and that the cluster is active.

### 3. Install Dependencies
```powershell
npm install
npm install --prefix server
npm install --prefix client
```

### 4. Seed Initial Database (Admin, Sample Faculty & Student)
```powershell
npm run seed
```
Primary Admin created: `poojamatheshwaran6363@gmail.com`

### 5. Run the Application
```powershell
npm run dev
```
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:5000/api
- **Health Check**: http://localhost:5000/api/health
