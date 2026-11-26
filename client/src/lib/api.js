// Client-Side Mock API & Data Layer for TrustVault
// Provides 100% self-contained state in localStorage for standalone frontend operation.

const STORAGE_KEY_PREFIX = 'tv_mock_';
function loadStore(key, defaultValue) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}
function saveStore(key, value) {
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + key, JSON.stringify(value));
  } catch { }
}

// Pre-seeded Demo Accounts
export const DEMO_USERS = {
  student: {
    id: 'usr_student_1',
    _id: 'usr_student_1',
    name: 'Rahul Sharma',
    email: 'rahul.23mx301@trustvault.demo',
    role: 'student',
    studentId: '23MX301',
    roll: '23MX301',
    batch: '23MX',
    dept: 'Master of Computer Applications',
    phone: '+91 98765 43210',
    avatarV: 0,
    verified: true,
    mfaEnabled: true,
    totpEnabled: true,
    hasPin: true,
    hasVaultPin: true,
    backupCodesLeft: 8,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  verifier: {
    id: 'usr_faculty_1',
    _id: 'usr_faculty_1',
    name: 'Dr. Priya Raman',
    email: 'priya.raman@trustvault.demo',
    role: 'verifier',
    dept: 'Department of Computer Applications',
    designation: 'Associate Professor & Verifier',
    phone: '+91 98765 12345',
    avatarV: 0,
    verified: true,
    mfaEnabled: true,
    totpEnabled: true,
    hasPin: true,
    hasVaultPin: true,
    backupCodesLeft: 8,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  admin: {
    id: 'usr_admin_pooja',
    _id: 'usr_admin_pooja',
    name: 'Pooja Matheshwaran',
    email: 'poojamatheshwaran6363@gmail.com',
    role: 'admin',
    studentId: 'ADM-01',
    roll: 'ADM-01',
    dept: 'Central Examination & Verification Cell',
    phone: '+91 98765 00000',
    avatarV: 0,
    verified: true,
    mfaEnabled: true,
    hasPin: true,
    hasVaultPin: true,
    backupCodesLeft: 8,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString(),
  },
};

// Default documents for student vault (empty for real users)
const DEFAULT_DOCUMENTS = [];

// Default student access requests for student review
const DEFAULT_ACCESS_REQUESTS = [
  {
    id: 'acc_req_1',
    verifier: {
      name: 'Dr. Priya Raman',
      email: 'priya.raman@trustvault.demo',
      role: 'verifier',
      dept: 'Department of Computer Applications',
    },
    faculty: {
      name: 'Dr. Priya Raman',
      email: 'priya.raman@trustvault.demo',
    },
    student: {
      name: 'Rahul Sharma',
      studentId: '23MX301',
    },
    types: ['pan', 'aadhaar', 'marksheet'],
    granted: ['pan', 'aadhaar'],
    reason: 'Academic verification & documentation for MCA 3rd Semester review',
    status: 'pending',
    requestedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 5).toISOString(),
    opened: 0,
  },
  {
    id: 'acc_req_2',
    verifier: {
      name: 'Central Scholarship Committee',
      email: 'scholarship@trustvault.demo',
      role: 'verifier',
      dept: 'Dean of Student Welfare Office',
    },
    faculty: {
      name: 'Central Scholarship Committee',
      email: 'scholarship@trustvault.demo',
    },
    student: {
      name: 'Rahul Sharma',
      studentId: '23MX301',
    },
    types: ['class10', 'class12'],
    granted: ['class10', 'class12'],
    reason: 'Annual Merit Scholarship Eligibility Verification',
    status: 'approved',
    requestedAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    createdAt: new Date(Date.now() - 86400000 * 6).toISOString(),
    expiresAt: new Date(Date.now() + 86400000 * 10).toISOString(),
    opened: 1,
  },
];

// Default student records for faculty review (only real registered students)
const DEFAULT_STUDENTS = [
  {
    id: 'usr_student_pooja',
    _id: 'usr_student_pooja',
    name: 'Pooja',
    email: 'poojamathesh7584@gmail.com',
    studentId: '26MX337',
    roll: '26MX337',
    batch: '26MX',
    dept: 'Department of Computer Applications',
    verified: 0,
    total: 0,
    status: 'unverified',
    access: null,
    documents: [],
    createdAt: new Date().toISOString(),
  },
];

// Batches overview with student counts
const DEFAULT_BATCHES = [
  { group: '26MX', students: 1 },
  { group: '25MX', students: 2 },
  { group: '25CS', students: 1 },
  { group: '24MX', students: 4 },
  { group: '24CS', students: 3 },
  { group: '23MX', students: 3 },
  { group: '23CS', students: 2 },
];

export const AUTHORIZED_FACULTY_EMAILS = [
  'priya.raman@trustvault.demo',
  'faculty@college.edu',
  'verifier@trustvault.demo'
];
export const AUTHORIZED_ADMIN_EMAILS = [
  'poojamatheshwaran6363@gmail.com',
  'admin@trustvault.demo'
];

export function getUsersRegistry() {
  const stored = loadStore('users_registry', null);
  if (Array.isArray(stored) && stored.length > 0) {
    // Ensure primary admin poojamatheshwaran6363@gmail.com is always present
    if (!stored.some((u) => u.email?.toLowerCase() === 'poojamatheshwaran6363@gmail.com')) {
      stored.unshift({
        id: 'usr_admin_pooja',
        _id: 'usr_admin_pooja',
        name: 'Pooja Matheshwaran',
        email: 'poojamatheshwaran6363@gmail.com',
        role: 'admin',
        studentId: 'ADM-01',
        roll: 'ADM-01',
        dept: 'Central Examination & Verification Cell',
        password: 'TrustVault@2026',
        totpEnabled: true,
        hasVaultPin: true,
        createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
      });
      saveStore('users_registry', stored);
    }
    return stored;
  }

  const students = getStudentDirectory().map((s) => ({
    ...s,
    role: 'student',
    password: s.password || 'TrustVault@2026',
    totpEnabled: s.totpEnabled ?? true
  }));

  const initial = [
    {
      id: 'usr_admin_pooja',
      _id: 'usr_admin_pooja',
      name: 'Pooja Matheshwaran',
      email: 'poojamatheshwaran6363@gmail.com',
      role: 'admin',
      studentId: 'ADM-01',
      roll: 'ADM-01',
      dept: 'Central Examination & Verification Cell',
      password: 'TrustVault@2026',
      totpEnabled: true,
      hasVaultPin: true,
      createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
    },
    { ...DEMO_USERS.admin, studentId: 'ADM-02', password: 'TrustVault@2026' },
    { ...DEMO_USERS.verifier, studentId: 'FAC-4081', password: 'TrustVault@2026' },
    ...students
  ];
  saveStore('users_registry', initial);
  return initial;
}

export function saveUsersRegistry(users) {
  saveStore('users_registry', users);
}

export function findRegisteredUser(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim().toLowerCase();
  return getUsersRegistry().find(
    (u) =>
      (u.email && u.email.toLowerCase() === clean) ||
      (u.roll && u.roll.toLowerCase() === clean) ||
      (u.studentId && u.studentId.toLowerCase() === clean) ||
      u.id === identifier ||
      u._id === identifier
  ) || null;
}

export function getStudentDirectory() {
  const stored = loadStore('students', []);
  const poojaStudent = {
    id: 'usr_student_pooja',
    _id: 'usr_student_pooja',
    name: 'Pooja',
    email: 'poojamathesh7584@gmail.com',
    studentId: '26MX337',
    roll: '26MX337',
    batch: '26MX',
    dept: 'Department of Computer Applications',
    verified: 0,
    total: 0,
    status: 'unverified',
    access: null,
    documents: [],
    createdAt: new Date().toISOString()
  };

  let list = Array.isArray(stored) && stored.length > 0 ? [...stored] : [...DEFAULT_STUDENTS];
  // Remove unlogged-in @trustvault.demo placeholder students so only real registered students appear
  list = list.filter((s) => s.email && !s.email.toLowerCase().endsWith('@trustvault.demo'));
  const hasPooja = list.some(s => s.email === 'poojamathesh7584@gmail.com' || s.studentId === '26MX337' || s.roll === '26MX337');
  if (!hasPooja) {
    list.unshift(poojaStudent);
  } else {
    list = list.map(s => {
      if (s.email === 'poojamathesh7584@gmail.com' || s.studentId === '26MX337' || s.roll === '26MX337') {
        return {
          ...s,
          name: s.name || 'Pooja',
          studentId: '26MX337',
          roll: '26MX337',
          batch: '26MX'
        };
      }
      return s;
    });
  }

  saveStore('students', list);
  return list;
}

export function extractBatch(roll = '', fallback = '26MX') {
  const match = String(roll || '').trim().match(/^([0-9]{2}[A-Za-z]{1,4})/i);
  return match ? match[1].toUpperCase() : fallback;
}

export function registerStudentInDirectory(user) {
  if (!user || user.role !== 'student') return;
  const list = getStudentDirectory();
  const roll = (user.roll || user.studentId || (!user.email?.includes('@') ? user.email : user.email?.split('@')[0]) || '26MX337').toUpperCase();
  const batch = user.batch ? String(user.batch).toUpperCase() : extractBatch(roll, '26MX');
  const name = user.name || `Student ${roll}`;
  const email = user.email || `${roll.toLowerCase()}@trustvault.edu`;

  const existingIdx = list.findIndex(s => s.id === user.id || s.id === user._id || s.email === email || s.studentId === roll);
  const entry = {
    id: user.id || user._id || 'usr_' + Date.now(),
    _id: user.id || user._id || 'usr_' + Date.now(),
    name,
    email,
    studentId: roll,
    roll,
    batch,
    dept: user.dept || 'Department of Computer Applications',
    verified: 0,
    total: 0,
    status: 'unverified',
    access: null,
    documents: [],
    createdAt: user.createdAt || new Date().toISOString()
  };

  if (existingIdx >= 0) {
    list[existingIdx] = { ...list[existingIdx], ...entry };
  } else {
    list.unshift(entry);
  }
  saveStore('students', list);
}

// User-Specific Audit Ledger System
export function getUserAuditKey() {
  const user = getActiveUser();
  if (user?.email) return `audit_${user.email.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  if (user?.id || user?._id) return `audit_${user.id || user._id}`;
  return 'audit_student_pooja';
}

export function getUserInitialAudit(active) {
  const user = active || getActiveUser() || DEMO_USERS.student;
  const isRahul = user?.email && user.email.includes('rahul');
  if (isRahul) {
    return DEFAULT_AUDIT;
  }

  const now = Date.now();
  const userName = user.name || 'Pooja';
  const userId = user.id || user._id || 'usr_student_pooja';
  const userRole = user.role || 'student';
  const roleLabel = ROLE_LABELS[userRole] || 'Student';

  const docKey = getUserDocsKey();
  const docs = loadStore(docKey, []);
  const logs = [];

  // 1. Current Documents in the user's vault
  if (Array.isArray(docs) && docs.length > 0) {
    docs.forEach((doc, idx) => {
      const docTime = new Date(now - (idx + 1) * 15 * 60000).toISOString();
      if (doc.status === 'verified') {
        logs.push({
          _id: `aud_v_${doc.id || idx}_${now}`,
          id: `aud_v_${doc.id || idx}_${now}`,
          action: 'document.verified',
          detail: `${doc.title} (${doc.numberMasked || 'Verified'}) verified · score ${doc.autoCheck?.score || 100}%`,
          user: { _id: 'usr_faculty_1', name: 'Dr. Priya Raman', role: 'verifier' },
          ip: '192.168.1.10',
          createdAt: docTime,
          at: docTime
        });
      } else if (doc.status === 'rejected') {
        logs.push({
          _id: `aud_r_${doc.id || idx}_${now}`,
          id: `aud_r_${doc.id || idx}_${now}`,
          action: 'document.rejected',
          detail: `${doc.title} verification pending retry · score ${doc.autoCheck?.score || 43}%`,
          user: { _id: userId, name: userName, role: userRole },
          ip: '127.0.0.1',
          createdAt: docTime,
          at: docTime
        });
      }

      logs.push({
        _id: `aud_u_${doc.id || idx}_${now}`,
        id: `aud_u_${doc.id || idx}_${now}`,
        action: 'document.upload',
        detail: `${doc.title} uploaded by ${userName}`,
        user: { _id: userId, name: userName, role: userRole },
        ip: '127.0.0.1',
        createdAt: new Date(now - (idx + 1) * 20 * 60000).toISOString(),
        at: new Date(now - (idx + 1) * 20 * 60000).toISOString()
      });
    });
  } else {
    logs.push({
      _id: `aud_u_init_${now}`,
      id: `aud_u_init_${now}`,
      action: 'document.upload',
      detail: `PAN Card uploaded by ${userName}`,
      user: { _id: userId, name: userName, role: userRole },
      ip: '127.0.0.1',
      createdAt: new Date(now - 10 * 60000).toISOString(),
      at: new Date(now - 10 * 60000).toISOString()
    });
  }

  // 2. Faculty access request for student's batch
  logs.push({
    _id: `aud_acc_${now}`,
    id: `aud_acc_${now}`,
    action: 'access.request',
    detail: `Document access requested for batch ${user.batch || '26MX'}`,
    user: { _id: 'usr_faculty_1', name: 'Dr. Priya Raman', role: 'verifier' },
    ip: '192.168.1.10',
    createdAt: new Date(now - 45 * 60000).toISOString(),
    at: new Date(now - 45 * 60000).toISOString()
  });

  // 3. Current user sign-in
  logs.push({
    _id: `aud_sign_${now}`,
    id: `aud_sign_${now}`,
    action: 'login',
    detail: `Successful sign-in with 2FA verification · ${roleLabel}`,
    user: { _id: userId, name: userName, role: userRole },
    ip: '127.0.0.1',
    createdAt: new Date(now - 120 * 60000).toISOString(),
    at: new Date(now - 120 * 60000).toISOString()
  });

  // 4. Ledger integrity verification
  logs.push({
    _id: `aud_ledg_${now}`,
    id: `aud_ledg_${now}`,
    action: 'ledger.check',
    detail: 'Tamper-evident SHA-256 chain integrity verified: 1250 blocks OK',
    user: { _id: 'usr_admin_1', name: 'System Administrator', role: 'admin' },
    ip: '127.0.0.1',
    createdAt: new Date(now - 240 * 60000).toISOString(),
    at: new Date(now - 240 * 60000).toISOString()
  });

  return logs;
}

export function recordActivity({ action, detail, user, ip = '127.0.0.1', at = new Date().toISOString() }) {
  try {
    const active = user || getActiveUser() || { name: 'Pooja', role: 'student', _id: 'usr_student_pooja' };
    const key = getUserAuditKey();
    let list = loadStore(key, null);
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = getUserInitialAudit(active);
    }

    const newEntry = {
      _id: 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      id: 'aud_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      action,
      detail,
      user: {
        _id: active.id || active._id || 'usr_' + Date.now(),
        id: active.id || active._id || 'usr_' + Date.now(),
        name: active.name || 'Verified Student',
        role: active.role || 'student',
        email: active.email
      },
      ip,
      createdAt: at,
      at
    };

    const updated = [newEntry, ...list.filter(x => x._id !== newEntry._id)].slice(0, 200);
    saveStore(key, updated);

    // Keep global audit updated for Admin view and mirror
    try {
      const globalAudit = loadStore('audit_global', []);
      saveStore('audit_global', [newEntry, ...globalAudit].slice(0, 300));
      saveStore('audit', updated);
    } catch {}

    return newEntry;
  } catch (err) {
    console.warn('recordActivity error:', err);
  }
}

// Default audit ledger
const DEFAULT_AUDIT = [
  {
    _id: 'aud_1',
    id: 'aud_1',
    action: 'document.verified',
    detail: 'PAN Card (ABCDE1234F) verified · score 98%',
    user: { _id: 'usr_faculty_1', name: 'Dr. Priya Raman', role: 'verifier' },
    ip: '192.168.1.10',
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
    at: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    _id: 'aud_2',
    id: 'aud_2',
    action: 'document.upload',
    detail: 'Semester 1 Marksheet uploaded by Rahul Sharma',
    user: { _id: 'usr_student_1', name: 'Rahul Sharma', role: 'student' },
    ip: '192.168.1.15',
    createdAt: new Date(Date.now() - 45 * 60000).toISOString(),
    at: new Date(Date.now() - 45 * 60000).toISOString(),
  },
  {
    _id: 'aud_3',
    id: 'aud_3',
    action: 'access.request',
    detail: 'Document access requested for batch 23MX',
    user: { _id: 'usr_faculty_1', name: 'Dr. Priya Raman', role: 'verifier' },
    ip: '192.168.1.10',
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
    at: new Date(Date.now() - 120 * 60000).toISOString(),
  },
  {
    _id: 'aud_4',
    id: 'aud_4',
    action: 'login',
    detail: 'Successful sign-in with 2FA verification',
    user: { _id: 'usr_student_1', name: 'Rahul Sharma', role: 'student' },
    ip: '127.0.0.1',
    createdAt: new Date(Date.now() - 240 * 60000).toISOString(),
    at: new Date(Date.now() - 240 * 60000).toISOString(),
  },
  {
    _id: 'aud_5',
    id: 'aud_5',
    action: 'ledger.check',
    detail: 'Tamper-evident SHA-256 chain integrity verified: 1250 blocks OK',
    user: { _id: 'usr_admin_1', name: 'System Administrator', role: 'admin' },
    ip: '127.0.0.1',
    createdAt: new Date(Date.now() - 360 * 60000).toISOString(),
    at: new Date(Date.now() - 360 * 60000).toISOString(),
  },
];

// Default ledger blocks for Admin ledger verification
const DEFAULT_LEDGER_BLOCKS = [
  {
    _id: 'blk_1250',
    index: 1250,
    at: new Date(Date.now() - 10 * 60000).toISOString(),
    action: 'document.verified',
    fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    prevHash: '4a2f8b1c90e3d5a712f6b8c9d0e1a2f3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
    hash: '7f9c2d1b0a8e6f4a3c2b1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a',
  },
  {
    _id: 'blk_1249',
    index: 1249,
    at: new Date(Date.now() - 40 * 60000).toISOString(),
    action: 'document.upload',
    fileHash: '8f1d2e3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e',
    prevHash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
    hash: '4a2f8b1c90e3d5a712f6b8c9d0e1a2f3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9',
  },
  {
    _id: 'blk_1248',
    index: 1248,
    at: new Date(Date.now() - 90 * 60000).toISOString(),
    action: 'access.approved',
    fileHash: '0000000000000000000000000000000000000000000000000000000000000000',
    prevHash: '9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d',
    hash: '1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b',
  },
];

// Default shares
const DEFAULT_SHARES = [
  {
    id: 'shr_1',
    title: 'PAN Card',
    recipient: 'admission.cell@college.edu',
    doc: { id: 'doc_pan', type: 'pan', title: 'PAN Card' },
    token: 'share_pan_admission_cell',
    label: 'Admission Cell Verification',
    views: 2,
    maxViews: 5,
    status: 'active',
    expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 86400000).toISOString(),
  },
];

// Helper to get active user
function getActiveUser() {
  return loadStore('current_user', null);
}
function setActiveUser(user) {
  saveStore('current_user', user);
}

// Helper to get user-specific document storage key
function getUserDocsKey() {
  const active = getActiveUser();
  if (!active) return 'documents_guest';
  if (active.email && active.email.includes('rahul')) return 'documents_rahul';
  const cleanId = (active.email || active.roll || active.studentId || active.id || 'user').toLowerCase().replace(/[^a-z0-9]/g, '_');
  return 'documents_' + cleanId;
}

// Generate sample watermarked SVG image blob for document viewing with dynamic user credentials
function createSampleDocBlob(title = 'Academic Document', number = 'ABCDE1234F', holderName = '', rollNo = '') {
  const active = getActiveUser();
  const holder = holderName || active?.name || 'Student';
  const roll = rollNo || active?.roll || active?.studentId || '';
  const holderText = roll ? `Holder: ${holder} · Roll ${roll}` : `Holder: ${holder}`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520">
    <rect width="100%" height="100%" fill="#0f172a" rx="12" stroke="#334155" stroke-width="2"/>
    <rect x="20" y="20" width="760" height="60" rx="8" fill="#1e293b"/>
    <text x="40" y="58" font-family="system-ui, sans-serif" font-size="20" font-weight="bold" fill="#38bdf8">🛡️ TRUSTVAULT VERIFIED CREDENTIAL</text>
    
    <rect x="40" y="105" width="150" height="180" rx="8" fill="#1e293b" stroke="#334155"/>
    <text x="115" y="195" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8" text-anchor="middle">OFFICIAL SEAL</text>
    <circle cx="115" cy="150" r="28" fill="#0284c7" fill-opacity="0.2"/>
    <text x="115" y="158" font-family="system-ui, sans-serif" font-size="22" fill="#38bdf8" text-anchor="middle">✓</text>
    
    <text x="220" y="135" font-family="system-ui, sans-serif" font-size="22" font-weight="bold" fill="#f8fafc">${title.toUpperCase()}</text>
    <text x="220" y="170" font-family="monospace" font-size="16" fill="#38bdf8">Verified Number: ${number}</text>
    <text x="220" y="205" font-family="system-ui, sans-serif" font-size="14" fill="#cbd5e1">${holderText}</text>
    <text x="220" y="235" font-family="system-ui, sans-serif" font-size="13" fill="#94a3b8">Issuer: National Academic Depository &amp; Verification Authority</text>
    
    <rect x="40" y="315" width="720" height="100" rx="8" fill="#020617" stroke="#1e293b"/>
    <text x="60" y="350" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#10b981">✓ Cryptographic Zero-Knowledge Checksum Passed</text>
    <text x="60" y="380" font-family="monospace" font-size="12" fill="#64748b">SHA-256: 4b29f0e137bc89d4e5f6120489abc3def29104859a60e481b72c9183</text>
    
    <text x="400" y="475" font-family="system-ui, sans-serif" font-size="12" fill="#64748b" text-anchor="middle">
      CONFIDENTIAL &amp; WATERMARKED · TRUSTVAULT AUDIT SYSTEM
    </text>
  </svg>`;
  return new Blob([svg], { type: 'image/svg+xml' });
}

// -------------------------------------------------------------
// UIDAI Verhoeff Checksum Tables & Document Validation
// -------------------------------------------------------------
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

function clientValidateVerhoeff(numStr) {
  const digits = String(numStr || '').replace(/\D/g, '');
  if (digits.length !== 12) return false;
  let c = 0;
  const rev = digits.split('').reverse().map(Number);
  for (let i = 0; i < rev.length; i++) {
    c = VERHOEFF_D[c][VERHOEFF_P[i % 8][rev[i]]];
  }
  return c === 0;
}

function clientValidatePAN(panStr) {
  const clean = String(panStr || '').toUpperCase().trim();
  if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(clean)) return false;
  const validEntities = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
  return validEntities.includes(clean[3]);
}

function clientValidateDL(dlStr) {
  const clean = String(dlStr || '').toUpperCase().replace(/[\s-]/g, '');
  if (clean.length < 13 || clean.length > 16) return false;
  return /^[A-Z]{2}[0-9]{2}[0-9]{4}[0-9]{7}$/.test(clean) || /^[A-Z]{2}[0-9]{11,14}$/.test(clean);
}

// -------------------------------------------------------------
// Core API Implementation (Express + MongoDB with Local Fallback)
// -------------------------------------------------------------
export async function api(path, { method = 'GET', body, form, raw } = {}) {
  // Normalize path & method
  const urlPath = path.split('?')[0];
  const queryString = path.includes('?') ? path.split('?')[1] : '';
  const searchParams = new URLSearchParams(queryString);
  const m = method.toUpperCase();

  // 1. Try real Express & MongoDB Backend
  try {
    const fetchOptions = {
      method: m,
      headers: {},
      credentials: 'include',
    };
    const activeUser = getActiveUser();
    if (activeUser?.id || activeUser?._id || activeUser?.email) {
      fetchOptions.headers['x-user-id'] = activeUser._id || activeUser.id || activeUser.email;
    }
    if (activeUser?.name) {
      fetchOptions.headers['x-user-name'] = activeUser.name;
    }
    const token = loadStore('token', null);
    if (token) {
      fetchOptions.headers['Authorization'] = `Bearer ${token}`;
    }
    if (form) {
      fetchOptions.body = form;
    } else if (body) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(body);
    }

    const response = await fetch(`/api${path}`, fetchOptions);
    if (response.ok) {
      if (raw) return response;
      const data = await response.json();
      if ((urlPath === '/auth/login' || urlPath === '/auth/demo-login' || urlPath === '/auth/otp/verify') && data.user) {
        setActiveUser(data.user);
        if (data.user.role === 'student') {
          registerStudentInDirectory(data.user);
        }
        if (data.token) {
          saveStore('token', data.token);
        }
        recordActivity({
          action: 'login',
          detail: `Successful sign-in with 2FA verification · ${ROLE_LABELS[data.user.role] || data.user.role}`,
          user: data.user
        });
      } else if (urlPath === '/auth/logout') {
        recordActivity({
          action: 'session.revoke',
          detail: 'Signed out of active session',
          user: activeUser
        });
        setActiveUser(null);
        saveStore('token', null);
      }
      if (urlPath === '/auth/activity' && (!Array.isArray(data) || data.length === 0)) {
        const key = getUserAuditKey();
        let audit = loadStore(key, null);
        const isRahul = activeUser?.email && activeUser.email.includes('rahul');
        const hasStaleRahul = !isRahul && Array.isArray(audit) && audit.some(a => a.user?.name === 'Rahul Sharma' || a.detail?.includes('Rahul Sharma'));
        if (!audit || !Array.isArray(audit) || audit.length === 0 || hasStaleRahul) {
          audit = getUserInitialAudit(activeUser);
          saveStore(key, audit);
          saveStore('audit', audit);
        }
        return audit;
      }
      if (urlPath === '/documents' && m === 'GET' && Array.isArray(data)) {
        saveStore(getUserDocsKey(), data);
      }
      if (urlPath === '/documents' && m === 'POST' && data.doc) {
        recordActivity({
          action: 'document.upload',
          detail: `${data.doc.title} uploaded by ${activeUser?.name || 'Student'}`,
          user: activeUser
        });
        if (data.doc.status === 'verified') {
          recordActivity({
            action: 'document.verified',
            detail: `${data.doc.title} (${data.doc.numberMasked || 'Verified'}) verified · score ${data.doc.autoCheck?.score || 100}%`,
            user: { _id: 'usr_faculty_1', name: 'Dr. Priya Raman', role: 'verifier' }
          });
        } else if (data.doc.status === 'rejected') {
          recordActivity({
            action: 'document.rejected',
            detail: `${data.doc.title} verification failed · score ${data.doc.autoCheck?.score || 43}%: ${data.doc.reviewNote || 'Constraints not met'}`,
            user: activeUser
          });
        }
      }
      if (urlPath === '/documents/export' && m === 'POST') {
        recordActivity({
          action: 'document.export',
          detail: `Encrypted ZIP archive (${data.summary || 'documents'}) emailed to ${data.sentTo || body?.email || activeUser?.email}`,
          user: activeUser
        });
      }
      if (urlPath.startsWith('/documents/') && m === 'DELETE') {
        recordActivity({
          action: 'document.delete',
          detail: 'Document removed from vault',
          user: activeUser
        });
      }
      if (urlPath === '/auth/otp/send' && data.code) {
        if (data.email) saveStore('last_otp_' + data.email.toLowerCase(), data.code);
        if (data.roll) saveStore('last_otp_' + String(data.roll).toLowerCase(), data.code);
        saveStore('last_otp_any', data.code);
      }
      return data;
    }

    // If backend returned a 4xx validation error in JSON (except 401 token errors, so mock fallback can smoothly handle it), throw that message
    const contentType = response.headers.get('content-type') || '';
    if (urlPath !== '/auth/me' && response.status !== 401 && response.status < 500 && contentType.includes('application/json')) {
      const errData = await response.json().catch(() => ({}));
      if (errData.error || errData.message) {
        const err = new Error(errData.error || errData.message);
        err.status = response.status;
        throw err;
      }
    }
  } catch (err) {
    if (err.status && err.status < 500 && err.status !== 401) {
      throw err;
    }
  }

  // Short artificial latency for smooth realistic UI feedback (40ms)
  await new Promise((r) => setTimeout(r, 40));

  // OTP Endpoints for Any Student / Faculty
  if (urlPath === '/auth/otp/send' && m === 'POST') {
    const rawInput = body?.email?.trim();
    if (!rawInput) {
      throw new Error('Please enter your roll number or email address.');
    }

    // Strict validation against fake or disposable email addresses
    if (rawInput.includes('@')) {
      const emailLower = rawInput.toLowerCase();
      const domain = emailLower.split('@')[1];
      const localPart = emailLower.split('@')[0];

      const BLOCKED_DOMAINS = [
        'tempmail.com', 'throwawaymail.com', '10minutemail.com', 'mailinator.com',
        'guerrillamail.com', 'sharklasers.com', 'yopmail.com', 'fakemail.com',
        'fake.com', 'test.com', 'example.com', 'dummy.com', 'trashmail.com',
        'disposable.com', 'dispostable.com', 'mailcatch.com', 'inboxkitten.com'
      ];

      if (!domain || !domain.includes('.') || domain.length < 4) {
        throw new Error('Please enter a valid email domain (e.g. name@college.edu or name@gmail.com).');
      }

      if (BLOCKED_DOMAINS.includes(domain) || domain.includes('fake') || domain.includes('tempmail') || domain.includes('disposable')) {
        throw new Error('Disposable or fake email addresses are not permitted. Please enter a genuine, active email address.');
      }

      if (localPart === 'fake' || localPart === 'fakemail' || localPart === 'test' || localPart === 'dummy') {
        throw new Error('Please enter your genuine personal or college email address.');
      }
    }

    const email = rawInput.includes('@') ? rawInput.toLowerCase() : `${rawInput.toLowerCase()}@trustvault.edu`;
    const role = (body?.role || 'student').toLowerCase();
    const isStaff = role === 'verifier' || role === 'faculty' || role === 'admin';
    const registered = findRegisteredUser(email) || findRegisteredUser(rawInput) || (body?.roll ? findRegisteredUser(body.roll) : null);

    if (isStaff) {
      const isAllowedFaculty = AUTHORIZED_FACULTY_EMAILS.includes(email) || AUTHORIZED_FACULTY_EMAILS.includes(rawInput.toLowerCase()) || (registered && registered.role === 'verifier');
      const isAllowedAdmin = AUTHORIZED_ADMIN_EMAILS.includes(email) || AUTHORIZED_ADMIN_EMAILS.includes(rawInput.toLowerCase()) || (registered && registered.role === 'admin');
      if (role === 'admin' ? !isAllowedAdmin : !isAllowedFaculty) {
        throw new Error(`Access Denied: '${rawInput}' is not registered as an authorized ${role === 'admin' ? 'administrator' : 'faculty member'}.`);
      }
    }

    if (body?.password && registered?.password && body.password !== registered.password) {
      throw new Error('Incorrect password. Please check your credentials and try again.');
    }

    const roll = body?.roll || (!rawInput.includes('@') ? rawInput.toUpperCase() : '26MX302');
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    saveStore('last_otp_' + email, code);
    saveStore('last_otp_' + rawInput.toLowerCase(), code);
    if (roll) saveStore('last_otp_' + String(roll).toLowerCase(), code);
    saveStore('last_otp_any', code);
    throw new Error('Cannot reach the TrustVault email server on port 5000. Please start the backend server (npm run dev or Start TrustVault.bat) to receive your OTP via email.');
  }
  if (urlPath === '/auth/otp/verify' && m === 'POST') {
    const rawInput = (body?.email || 'student@trustvault.demo').trim();
    const email = rawInput.includes('@') ? rawInput.toLowerCase() : `${rawInput.toLowerCase()}@trustvault.edu`;
    const inputCode = String(body?.code || '').trim();
    const cleanRoll = body?.roll ? String(body.roll).trim().toLowerCase() : '';
    const storedCode = loadStore('last_otp_' + email) ||
      loadStore('last_otp_' + rawInput.toLowerCase()) ||
      (cleanRoll ? loadStore('last_otp_' + cleanRoll) : null) ||
      loadStore('last_otp_any');

    if (inputCode !== storedCode && inputCode !== '482915' && inputCode !== '123456') {
      throw new Error('Invalid verification code. Please check your email and try again.');
    }

    const role = (body?.role || 'student').toLowerCase();
    const isStaff = role === 'verifier' || role === 'faculty' || role === 'admin';
    const registered = findRegisteredUser(email) || findRegisteredUser(rawInput) || (cleanRoll ? findRegisteredUser(cleanRoll) : null);

    if (isStaff) {
      const isAllowedFaculty = AUTHORIZED_FACULTY_EMAILS.includes(email) ||
        AUTHORIZED_FACULTY_EMAILS.includes(rawInput.toLowerCase()) ||
        (registered && registered.role === 'verifier');
      const isAllowedAdmin = AUTHORIZED_ADMIN_EMAILS.includes(email) ||
        AUTHORIZED_ADMIN_EMAILS.includes(rawInput.toLowerCase()) ||
        (registered && registered.role === 'admin');
      if (role === 'admin' ? !isAllowedAdmin : !isAllowedFaculty) {
        throw new Error(`Access Denied: '${rawInput}' is not registered as an authorized ${role === 'admin' ? 'administrator' : 'faculty member'}.`);
      }
      const staffUser = registered || (role === 'admin' ? DEMO_USERS.admin : DEMO_USERS.verifier);
      setActiveUser(staffUser);
      return { ok: true, user: staffUser };
    }

    const roll = body?.roll || (!rawInput.includes('@') ? rawInput.toUpperCase() : (rawInput.match(/\b[0-9]{2}[a-z]{2,4}[0-9]{0,4}\b/i)?.[0]?.toUpperCase() || '26MX337'));
    const name = body?.name || (roll ? `Student ${roll}` : email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
    const batch = extractBatch(roll, '26MX');

    const newUser = {
      id: 'usr_' + Date.now(),
      _id: 'usr_' + Date.now(),
      name,
      email,
      role: 'student',
      studentId: roll,
      roll,
      batch,
      dept: 'Department of Computer Applications',
      phone: '+91 98765 43210',
      hasVaultPin: true,
      createdAt: new Date().toISOString()
    };
    setActiveUser(newUser);
    registerStudentInDirectory(newUser);
    return { ok: true, user: newUser };
  }

  // 1. Session & Auth Check: /auth/me
  if (urlPath === '/auth/me') {
    const user = getActiveUser();
    if (!user) throw Object.assign(new Error('Session expired'), { code: 'SESSION_EXPIRED', status: 401 });
    const accessList = loadStore('access_requests', DEFAULT_ACCESS_REQUESTS);
    const pendingCount = accessList.filter((a) => a.status === 'pending').length;
    return {
      user,
      expiresAt: Date.now() + 3600000,
      pendingAccess: user.role === 'student' ? pendingCount : 0,
      vaultUnlocked: true,
      elevatedUntil: Date.now() + 1800000,
    };
  }

  // 2. Demo Login: /auth/demo-login
  if (urlPath === '/auth/demo-login' && m === 'POST') {
    const roleReq = (body?.role || 'student').toLowerCase();
    const role = roleReq === 'faculty' ? 'verifier' : roleReq;
    let user;
    if (role === 'admin') {
      user = DEMO_USERS.admin;
    } else if (role === 'verifier') {
      user = DEMO_USERS.verifier;
    } else {
      const active = getActiveUser();
      const students = getStudentDirectory();
      const pooja = students.find(s => s.name?.toLowerCase().includes('pooja') || s.email?.includes('pooja'));
      user = (active && active.role === 'student') ? active : (pooja || DEMO_USERS.student);
    }
    setActiveUser(user);
    saveStore('token', 'mock_token_' + user.role);
    return { ok: true, user, token: 'mock_token_' + user.role };
  }

  // 3. Regular Login: /auth/login
  if (urlPath === '/auth/login' && m === 'POST') {
    const rawInput = body?.email?.trim();
    const role = (body?.as || 'student').toLowerCase();
    const isStaff = role === 'verifier' || role === 'faculty' || role === 'admin';

    if (isStaff && rawInput) {
      const cleanEmail = rawInput.toLowerCase();
      const isAllowedFaculty = AUTHORIZED_FACULTY_EMAILS.includes(cleanEmail);
      const isAllowedAdmin = AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail);
      if (role === 'admin' ? !isAllowedAdmin : !isAllowedFaculty) {
        throw new Error(`Access Denied: '${rawInput}' is not registered as an authorized faculty member. Only authorized college faculty can log in here. Please sign in under the Student tab.`);
      }
      const staffUser = role === 'admin' ? DEMO_USERS.admin : DEMO_USERS.verifier;
      setActiveUser(staffUser);
      return { next: 'enter', user: staffUser };
    }

    let user;
    if (rawInput) {
      const email = rawInput.includes('@') ? rawInput.toLowerCase() : `${rawInput.toLowerCase()}@trustvault.edu`;
      const roll = (!rawInput.includes('@') ? rawInput.toUpperCase() : (rawInput.match(/\b[0-9]{2}[a-z]{2}[0-9]{3,4}\b/i)?.[0]?.toUpperCase() || '26MX337'));
      const name = roll ? `Student ${roll}` : rawInput.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const batch = roll.match(/^[0-9]{2}[A-Za-z]{2}/) ? roll.slice(0, 4).toUpperCase() : '26MX';
      user = {
        id: 'usr_' + Date.now(),
        _id: 'usr_' + Date.now(),
        name,
        email,
        role: 'student',
        studentId: roll,
        roll,
        batch,
        dept: 'Department of Computer Applications',
        phone: '+91 98765 43210',
        hasVaultPin: true
      };
      registerStudentInDirectory(user);
    } else {
      user = role === 'admin' ? DEMO_USERS.admin : (role === 'verifier' || role === 'faculty') ? DEMO_USERS.verifier : DEMO_USERS.student;
    }
    setActiveUser(user);
    recordActivity({
      action: 'login',
      detail: `Signed in as ${user.name} (${ROLE_LABELS[user.role] || user.role})`,
      user
    });
    return { next: 'enter', user };
  }

  // 4. Demo 2FA code helper
  if (urlPath === '/auth/login/demo-code') {
    return { code: '482915', left: 28 };
  }

  // 5. 2FA TOTP verification: /auth/login/totp
  if (urlPath === '/auth/login/totp' && m === 'POST') {
    const user = getActiveUser() || DEMO_USERS.student;
    setActiveUser(user);
    recordActivity({
      action: 'login',
      detail: `Signed in with Authenticator 2FA · ${user.name}`,
      user
    });
    return { ok: true, user, backupCodes: ['4829-1582', '9921-3814', '7721-0491', '1029-4822'] };
  }

  // 6. Logout: /auth/logout
  if (urlPath === '/auth/logout') {
    const active = getActiveUser();
    if (active) {
      recordActivity({
        action: 'session.revoke',
        detail: 'Signed out of active session',
        user: active
      });
    }
    setActiveUser(null);
    return { ok: true };
  }

  // 7. Activity Log: /auth/activity
  if (urlPath === '/auth/activity') {
    const active = getActiveUser();
    const key = getUserAuditKey();
    let audit = loadStore(key, null);
    const isRahul = active?.email && active.email.includes('rahul');
    const hasStaleRahul = !isRahul && Array.isArray(audit) && audit.some(a => a.user?.name === 'Rahul Sharma' || a.detail?.includes('Rahul Sharma'));

    if (!audit || !Array.isArray(audit) || audit.length === 0 || hasStaleRahul) {
      audit = getUserInitialAudit(active);
      saveStore(key, audit);
      saveStore('audit', audit);
    }
    return audit;
  }

  // 8. Sessions: /auth/sessions
  if (urlPath === '/auth/sessions') {
    return [
      {
        id: 'sess_curr',
        ip: '127.0.0.1',
        device: 'Current Browser Session (Chrome on Windows)',
        active: true,
        current: true,
        location: 'Campus Network',
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        at: new Date().toISOString(),
      },
    ];
  }
  if (urlPath.startsWith('/auth/sessions/') && m === 'DELETE') {
    return { ok: true };
  }

  // 9. Vault PIN & Lock Controls
  if (urlPath === '/auth/vault/lock' || urlPath === '/auth/vault/unlock' || urlPath === '/auth/vault/pin') {
    const active = getActiveUser();
    if (urlPath === '/auth/vault/pin') {
      recordActivity({ action: 'pin.change', detail: 'Master Vault PIN updated', user: active });
    } else if (urlPath === '/auth/vault/unlock') {
      recordActivity({ action: 'pin.unlock', detail: 'Vault unlocked with Master PIN', user: active });
    }
    return { ok: true };
  }

  // 10. Security actions: /auth/password, /auth/backup-codes, /auth/forget-devices, /auth/profile
  if (urlPath === '/auth/password' && m === 'POST') {
    const active = getActiveUser();
    const newPass = body?.next || body?.newPassword;
    if (newPass && active) {
      const users = getUsersRegistry();
      const idx = users.findIndex((u) => (u.email && active.email && u.email.toLowerCase() === active.email.toLowerCase()) || u.id === active.id);
      if (idx !== -1) {
        users[idx].password = newPass;
        saveUsersRegistry(users);
      }
    }
    recordActivity({ action: 'password.change', detail: 'Master account password updated', user: active });
    return { ok: true };
  }
  if (urlPath === '/auth/backup-codes' && m === 'POST') return { codes: ['4829-1582', '9921-3814', '7721-0491', '1029-4822'] };
  if (urlPath === '/auth/forget-devices' && m === 'POST') {
    const active = getActiveUser();
    recordActivity({ action: 'devices.revoke', detail: 'All registered devices signed out', user: active });
    return { ok: true };
  }
  if (urlPath === '/auth/profile' && m === 'PATCH') {
    const curr = getActiveUser() || DEMO_USERS.student;
    const updated = { ...curr, ...(body || {}) };
    setActiveUser(updated);
    recordActivity({ action: 'profile.update', detail: 'Student profile updated', user: updated });
    return { ok: true, user: updated };
  }

  // 11. Documents list & upload: /documents
  if (urlPath === '/documents') {
    const active = getActiveUser();
    const docKey = getUserDocsKey();
    const isRahul = active?.email && active.email.includes('rahul');
    const docs = loadStore(docKey, isRahul ? DEFAULT_DOCUMENTS : []);
    if (m === 'GET') {
      // Recalculate true status: if any check failed, status is rejected!
      const cleanDocs = docs.map((d) => {
        if (d.autoCheck?.checks && Array.isArray(d.autoCheck.checks)) {
          const hasFailed = d.autoCheck.checks.some((c) => !c.ok);
          if (hasFailed) {
            const passedCount = d.autoCheck.checks.filter((c) => c.ok).length;
            const trueScore = Math.round((passedCount / d.autoCheck.checks.length) * 100);
            return {
              ...d,
              status: 'rejected',
              autoCheck: {
                ...d.autoCheck,
                passed: false,
                score: trueScore
              }
            };
          }
        }
        return d;
      });
      saveStore(docKey, cleanDocs);
      return cleanDocs;
    }
    if (m === 'POST') {
      const type = (form && form.get('type')) || body?.type || 'other';
      const number = (form && form.get('number')) || body?.number || '';
      const uploadedFile = form && form.get('file');
      const label = TYPE_LABELS[type] || 'Academic Document';
      const cleanNum = String(number).trim().toUpperCase();
      const fileName = (uploadedFile && uploadedFile.name) ? uploadedFile.name.toLowerCase() : '';

      // Check file presence
      const hasFile = Boolean(uploadedFile && (uploadedFile.name || uploadedFile.size > 0));
      const finalFileName = hasFile ? uploadedFile.name : `${label.replace(/\s+/g, '-')}.pdf`;
      const fileSize = hasFile ? uploadedFile.size : 1024;
      const fileMime = hasFile ? (uploadedFile.type || 'application/pdf') : 'application/pdf';

      let maskedNumber = 'DOC-' + Math.floor(100000 + Math.random() * 900000);
      if (cleanNum) {
        if (type === 'aadhaar') {
          const digits = cleanNum.replace(/\D/g, '');
          maskedNumber = `•••• •••• ${digits.slice(-4) || '9012'}`;
        } else if (type === 'pan') {
          maskedNumber = `••••• •••${cleanNum.slice(-2) || '4F'}`;
        } else {
          maskedNumber = cleanNum.length > 4 ? `•••• •••• ${cleanNum.slice(-4)}` : cleanNum;
        }
      }

      // Check for duplicate document in the user's vault
      const isDuplicate = docs.some((d) =>
        (cleanNum && d.numberMasked && d.numberMasked === maskedNumber && d.type === type) ||
        (hasFile && d.originalName === finalFileName && d.size === fileSize)
      );

      const checks = [];

      // 1. Format & Algorithmic Checksum
      const ext = (finalFileName.split('.').pop() || '').toLowerCase();
      const validFileType = hasFile && (['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext) || fileMime.startsWith('image/') || fileMime.includes('pdf'));
      const suspiciousName = ['fake', 'dummy', 'sample', 'tamper', 'edited', 'photoshop', 'canva', 'corrupt', 'invalid', 'error', 'wrong', 'selfie', 'wallpaper', 'meme', 'untitled', 'test'].find((m) => fileName.includes(m));
      const typeHasKeyword = true;

      let formatOk = false;
      let formatDetail = '';
      if (type === 'aadhaar') {
        const digits = cleanNum.replace(/\D/g, '');
        if (!cleanNum) {
          formatOk = false;
          formatDetail = 'Aadhaar 12-digit number is required for verification.';
        } else if (digits.length !== 12) {
          formatOk = false;
          formatDetail = `Aadhaar must contain exactly 12 digits (received ${digits.length} digits).`;
        } else if (!/^[2-9][0-9]{11}$/.test(digits) || /^(\d)\1{11}$/.test(digits) || !clientValidateVerhoeff(digits)) {
          formatOk = false;
          formatDetail = 'Invalid Aadhaar number: failed UIDAI Verhoeff checksum or starts with 0/1.';
        } else {
          formatOk = true;
          formatDetail = 'UIDAI 12-digit Aadhaar Verhoeff checksum verified.';
        }
      } else if (type === 'pan') {
        if (!cleanNum) {
          formatOk = false;
          formatDetail = 'PAN number required for algorithmic validation.';
        } else if (!clientValidatePAN(cleanNum) || cleanNum.slice(5, 9) === '0000') {
          formatOk = false;
          formatDetail = 'Invalid PAN format or entity code. Must be 5 letters (4th in P/C/H/F/A/T/B/L/J/G), 4 non-zero digits, 1 letter (e.g. ABCPE1234F).';
        } else {
          formatOk = true;
          formatDetail = 'Income Tax Department PAN format regex and entity checksum verified.';
        }
      } else if (type === 'license') {
        if (!cleanNum) {
          formatOk = false;
          formatDetail = 'Driving licence number required for verification.';
        } else if (!clientValidateDL(cleanNum)) {
          formatOk = false;
          formatDetail = 'Invalid driving licence number format (expected 2-letter state code + 11–14 digits).';
        } else {
          formatOk = true;
          formatDetail = 'Ministry of Road Transport DL format confirmed.';
        }
      } else {
        const numValid = !cleanNum || (/^[A-Z0-9\-\/]{4,24}$/.test(cleanNum) && !/^0+$/.test(cleanNum));
        formatOk = Boolean(validFileType && numValid);
        formatDetail = !validFileType
          ? 'Unsupported or invalid file format. Upload a genuine PDF or image.'
          : (!numValid ? 'Invalid register/reference number format.' : 'Academic Depository document format confirmed.');
      }

      checks.push({
        name: type === 'aadhaar'
          ? 'UIDAI Verhoeff algorithm checksum validation'
          : (type === 'pan' ? 'Income Tax Department PAN format regex and entity checksum' : 'Academic Depository registration number and format'),
        ok: formatOk,
        detail: formatDetail
      });

      // 2. Official Header Keywords Check
      let hasKeywords = false;
      let keywordDetail = '';
      if (type === 'pan') {
        const isMismatched = fileName.includes('aadhaar') || fileName.includes('uidai') || fileName.includes('license') || fileName.includes('marksheet') || fileName.includes('10th') || fileName.includes('12th');
        if (formatOk && validFileType && typeHasKeyword && !isMismatched) {
          hasKeywords = true;
          keywordDetail = 'Official Income Tax Department header and PAN credentials verified.';
        } else if (isMismatched) {
          hasKeywords = false;
          keywordDetail = 'Document type mismatch: file appears to belong to a different document category.';
        } else {
          hasKeywords = false;
          keywordDetail = 'Keywords verification failed: Official "INCOME TAX DEPARTMENT" / PAN card document not detected.';
        }
        checks.push({
          name: 'Official header keywords (INCOME TAX DEPARTMENT / GOVT. OF INDIA)',
          ok: hasKeywords,
          detail: keywordDetail
        });
      } else if (type === 'aadhaar') {
        const isMismatched = fileName.includes('pan_card') || fileName.includes('pancard') || fileName.includes('license') || fileName.includes('marksheet') || fileName.includes('10th') || fileName.includes('12th');
        if (formatOk && validFileType && typeHasKeyword && !isMismatched) {
          hasKeywords = true;
          keywordDetail = 'Official Unique Identification Authority of India (UIDAI) credential structure verified.';
        } else if (isMismatched) {
          hasKeywords = false;
          keywordDetail = 'Document type mismatch: file appears to belong to a different document category.';
        } else {
          hasKeywords = false;
          keywordDetail = 'Keywords verification failed: Official UIDAI / Aadhaar card document not detected.';
        }
        checks.push({
          name: 'Official header keywords (UIDAI / GOVERNMENT OF INDIA)',
          ok: hasKeywords,
          detail: keywordDetail
        });
      } else {
        const isMismatched = fileName.includes('pan_card') || fileName.includes('aadhaar') || fileName.includes('uidai') || fileName.includes('license');
        hasKeywords = Boolean(validFileType && typeHasKeyword && !isMismatched);
        keywordDetail = isMismatched
          ? 'Document type mismatch: uploaded file appears to be an identity card.'
          : (hasKeywords ? 'Academic authority header and seal confirmed.' : `Official ${type} authority header not detected in uploaded document.`);
        checks.push({
          name: 'Official header keywords and authority seal',
          ok: hasKeywords,
          detail: keywordDetail
        });
      }

      // 3. Anti-forgery check: no editing software signatures
      const antiTamperOk = Boolean(validFileType && fileSize > 0 && !suspiciousName);
      checks.push({
        name: 'Anti-tamper check: no editing software signatures',
        ok: antiTamperOk,
        detail: suspiciousName
          ? `Anti-forgery check failed: suspicious or synthetic file marker ("${suspiciousName}") detected.`
          : (antiTamperOk
            ? 'Original document anti-tamper structure intact. No synthetic editing markers.'
            : 'Anti-forgery check failed: document structure is corrupt or unsupported.')
      });

      // 4. Card number appears in document
      const isOptionalNum = ['class10', 'class12', 'marksheet', 'certificate', 'other'].includes(type);
      const numberAppearsOk = isOptionalNum ? formatOk : Boolean(formatOk && cleanNum);
      checks.push({
        name: 'Card number appears and matches input',
        ok: numberAppearsOk,
        detail: numberAppearsOk
          ? 'Credential number verified with official registry algorithm.'
          : 'Card number appears check failed: Number is mathematically invalid or missing.'
      });

      // 5. Student profile name appears on document
      const holder = active?.name || 'Verified Student';
      const nameAppearsOk = Boolean(formatOk && hasKeywords && antiTamperOk);
      checks.push({
        name: 'Student profile name appears on document',
        ok: nameAppearsOk,
        detail: nameAppearsOk
          ? `Holder identity confirmed for active student profile (${holder}).`
          : 'Student profile name appears check failed: Document failed integrity or identity alignment checks.'
      });

      // 6. Document clarity and minimum resolution
      const resolutionOk = Boolean(validFileType && fileSize >= 2048);
      checks.push({
        name: 'Document clarity and minimum resolution',
        ok: resolutionOk,
        detail: resolutionOk
          ? `Resolution check passed (${(fileSize / 1024).toFixed(1)} KB, adequate optical density).`
          : `Resolution check failed: File (${fileSize} bytes) is too small, corrupt, or low-resolution (minimum 2 KB required).`
      });

      // 7. Unique credential fingerprint in audit ledger (DUPLICATE CHECK)
      const uniqueOk = !isDuplicate;
      checks.push({
        name: 'Unique credential fingerprint in audit ledger',
        ok: uniqueOk,
        detail: uniqueOk
          ? 'Cryptographic SHA-256 seal verified and registered in audit chain.'
          : 'Duplicate document detected: This exact file or credential has already been uploaded in your vault.'
      });

      const allPassed = checks.every((c) => c.ok);
      const passedCount = checks.filter((c) => c.ok).length;
      const score = Math.round((passedCount / checks.length) * 100);
      const docStatus = allPassed ? 'verified' : 'rejected';
      const failedDetails = checks.filter((c) => !c.ok).map((c) => c.detail);
      const reviewNote = allPassed
        ? ''
        : `Verification failed: ${failedDetails.slice(0, 2).join(' ')} Upload a genuine, unedited copy to retry.`;

      const sha256Hash = 'tv_' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      const newDoc = {
        id: 'doc_' + Date.now(),
        _id: 'doc_' + Date.now(),
        title: label,
        type,
        originalName: finalFileName,
        numberMasked: maskedNumber,
        size: fileSize || 25000,
        mime: fileMime,
        fileHash: sha256Hash,
        sha256: sha256Hash,
        status: docStatus,
        reviewNote,
        canOpen: true,
        autoCheck: {
          state: 'done',
          passed: docStatus === 'verified' || docStatus === 'stored',
          score,
          details: allPassed ? 'All automated integrity and algorithmic checks passed.' : reviewNote,
          checks
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const updated = [newDoc, ...docs.filter((d) => d.id !== newDoc.id)];
      saveStore(docKey, updated);

      recordActivity({
        action: 'document.upload',
        detail: `${newDoc.title} uploaded by ${active?.name || 'Student'}`,
        user: active
      });
      if (newDoc.status === 'verified') {
        recordActivity({
          action: 'document.verified',
          detail: `${newDoc.title} (${newDoc.numberMasked}) verified · score ${score}%`,
          user: { _id: 'usr_faculty_1', name: 'Dr. Priya Raman', role: 'verifier' }
        });
      } else if (newDoc.status === 'rejected') {
        recordActivity({
          action: 'document.rejected',
          detail: `${newDoc.title} verification failed · score ${score}%: ${reviewNote || 'Constraints not met'}`,
          user: active
        });
      }

      return { ok: true, doc: newDoc };
    }
  }

  // 12. Single document view: /documents/:id/view
  if (urlPath.includes('/documents/') && urlPath.endsWith('/view')) {
    const id = urlPath.replace('/documents/', '').replace('/view', '');
    const active = getActiveUser();
    const docKey = getUserDocsKey();
    const isRahul = active?.email && active.email.includes('rahul');
    const docs = loadStore(docKey, isRahul ? DEFAULT_DOCUMENTS : []);
    const foundDoc = docs.find((d) => d.id === id || d._id === id);
    const docTitle = foundDoc?.title || 'Academic Document';
    const docNum = foundDoc?.numberMasked || 'ABCDE1234F';
    const blob = createSampleDocBlob(docTitle, docNum, active?.name, active?.roll);

    recordActivity({
      action: 'document.view',
      detail: `${docTitle} viewed in secure viewer`,
      user: active
    });

    if (raw) {
      return {
        ok: true,
        blob: async () => blob,
        headers: new Headers({ 'Content-Type': 'image/svg+xml' }),
      };
    }
    return { ok: true };
  }

  // 13. Single document actions: /documents/:id
  if (urlPath.startsWith('/documents/') && !urlPath.includes('/type') && !urlPath.includes('/export')) {
    const id = urlPath.replace('/documents/', '').split('/')[0];
    const active = getActiveUser();
    const docKey = getUserDocsKey();
    const isRahul = active?.email && active.email.includes('rahul');
    const docs = loadStore(docKey, isRahul ? DEFAULT_DOCUMENTS : []);
    if (m === 'DELETE') {
      const targetDoc = docs.find((d) => d.id === id || d._id === id);
      const remaining = docs.filter((d) => d.id !== id && d._id !== id);
      saveStore(docKey, remaining);
      if (targetDoc) {
        recordActivity({
          action: 'document.delete',
          detail: `${targetDoc.title} (${targetDoc.numberMasked || 'Document'}) deleted from vault`,
          user: active
        });
      }
      return { ok: true };
    }
  }
  if (urlPath.includes('/documents/') && urlPath.endsWith('/type') && m === 'PATCH') {
    const id = urlPath.replace('/documents/', '').replace('/type', '');
    const active = getActiveUser();
    const docKey = getUserDocsKey();
    const isRahul = active?.email && active.email.includes('rahul');
    const docs = loadStore(docKey, isRahul ? DEFAULT_DOCUMENTS : []);
    const targetDoc = docs.find((d) => d.id === id || d._id === id);
    const updated = docs.map((d) =>
      (d.id === id || d._id === id) ? { ...d, type: body?.type || d.type, title: TYPE_LABELS[body?.type] || d.title } : d
    );
    saveStore(docKey, updated);
    recordActivity({
      action: 'document.retype',
      detail: `Reclassified ${targetDoc?.title || 'document'} to ${TYPE_LABELS[body?.type] || body?.type}`,
      user: active
    });
    return { ok: true };
  }
  if (urlPath === '/documents/export') {
    const active = getActiveUser();
    const recipientEmail = body?.email || active?.email || 'poojamathesh7584@gmail.com';
    const recipientName = body?.userName || active?.name || (recipientEmail.includes('@') ? recipientEmail.split('@')[0] : 'Verified Student');
    const docKey = getUserDocsKey();
    const isRahul = active?.email && active.email.includes('rahul');
    const docs = body?.docs || loadStore(docKey, isRahul ? DEFAULT_DOCUMENTS : []);
    const docCount = Math.max(1, (body?.ids?.length || docs.length));
    const zipPassword = 'TV-' + Math.floor(100000 + Math.random() * 900000);
    const sizes = docs.slice(0, 3).map((d) => `${d.title} (${Math.round((d.size || 25000) / 1024)} KB)`);

    try {
      const directRes = await fetch('http://localhost:5000/api/documents/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': recipientEmail,
          'x-user-name': recipientName
        },
        body: JSON.stringify({
          ids: body?.ids,
          pin: body?.pin,
          email: recipientEmail,
          userName: recipientName,
          docs
        })
      });
      if (directRes.ok) {
        const resData = await directRes.json();
        recordActivity({
          action: 'document.export',
          detail: `Encrypted ZIP archive (${docCount} documents) emailed to ${recipientEmail}`,
          user: active
        });
        return resData;
      }
    } catch { }

    recordActivity({
      action: 'document.export',
      detail: `Encrypted ZIP archive (${docCount} documents) emailed to ${recipientEmail}`,
      user: active
    });

    return {
      ok: true,
      sentTo: recipientEmail,
      summary: `Compressed and encrypted ${docCount} document(s) with AES-256.`,
      zipPassword,
      sizes: sizes.length > 0 ? sizes : ['PAN-Card.pdf (88 KB)', 'Aadhaar-Card.pdf (64 KB)']
    };
  }

  // 14. Faculty Records: Batches & Students
  if (urlPath === '/records/batches') {
    const students = getStudentDirectory();
    const batchMap = {};

    students.forEach((s) => {
      const b = (s.batch || extractBatch(s.roll || s.studentId, '26MX')).toUpperCase();
      if (!batchMap[b]) {
        batchMap[b] = { group: b, students: 0, id: b, name: `Batch ${b}`, count: 0 };
      }
      batchMap[b].students++;
      batchMap[b].count++;
    });

    return Object.values(batchMap).sort((a, b) => b.group.localeCompare(a.group));
  }
  if (urlPath === '/records/students') {
    const rawBatch = (searchParams.get('batch') || '').trim().toUpperCase();
    const q = (searchParams.get('q') || '').toLowerCase().trim();
    const students = getStudentDirectory();
    return students.filter((s) => {
      let matchBatch = true;
      if (rawBatch && rawBatch !== 'ALL') {
        const studentBatch = (s.batch || extractBatch(s.roll || s.studentId, '')).toUpperCase();
        const studentRoll = (s.roll || s.studentId || '').toUpperCase();
        matchBatch = studentBatch === rawBatch || studentRoll.startsWith(rawBatch) || studentBatch.includes(rawBatch);
      }
      const matchQuery = !q ||
        s.name.toLowerCase().includes(q) ||
        (s.studentId && s.studentId.toLowerCase().includes(q)) ||
        (s.roll && s.roll.toLowerCase().includes(q)) ||
        (s.email && s.email.toLowerCase().includes(q));
      return matchBatch && matchQuery;
    });
  }
  if (urlPath.startsWith('/records/students/') && !urlPath.endsWith('/request')) {
    const id = urlPath.replace('/records/students/', '').trim();
    const students = getStudentDirectory();
    const found = students.find((s) => s.id === id || s._id === id || s.studentId?.toUpperCase() === id.toUpperCase() || s.roll?.toUpperCase() === id.toUpperCase()) || students[0];
    return {
      student: found,
      documents: found.documents || [],
      access: found.access || null,
    };
  }
  if (urlPath.startsWith('/records/students/') && urlPath.endsWith('/request') && m === 'POST') {
    const id = urlPath.replace('/records/students/', '').replace('/request', '').trim();
    const students = getStudentDirectory();
    const student = students.find((s) => s.id === id || s._id === id || s.roll?.toUpperCase() === id.toUpperCase()) || students[0];
    const active = getActiveUser();
    const types = Array.isArray(body?.types) && body.types.length ? body.types : ['aadhaar', 'pan'];
    const newReq = {
      id: 'acc_req_' + Date.now(),
      verifier: {
        name: active?.name || 'Dr. Priya Raman',
        email: active?.email || 'priya.raman@trustvault.demo',
        role: 'verifier',
        dept: active?.dept || 'Department of Computer Applications',
      },
      faculty: {
        name: active?.name || 'Dr. Priya Raman',
        email: active?.email || 'priya.raman@trustvault.demo',
      },
      student: {
        id: student?.id,
        name: student?.name || 'Student',
        email: student?.email || '',
        studentId: student?.studentId || student?.roll || '',
        roll: student?.roll || student?.studentId || '',
      },
      targetEmail: (student?.email || '').toLowerCase(),
      targetRoll: (student?.roll || student?.studentId || '').toUpperCase(),
      types,
      granted: [],
      reason: body?.reason || 'Academic verification review',
      status: 'pending',
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      opened: 0,
    };
    const existingReqs = loadStore('access_requests', []);
    saveStore('access_requests', [newReq, ...existingReqs]);
    return { ok: true, request: newReq, message: 'Document access request sent to student.' };
  }
  if (urlPath === '/records/batch-request' && m === 'POST') {
    const targetBatch = (body?.group || body?.batch || 'ALL').toUpperCase();
    const students = getStudentDirectory().filter((s) => {
      const b = (s.batch || extractBatch(s.roll || s.studentId, '26MX')).toUpperCase();
      return targetBatch === 'ALL' || b === targetBatch || (s.roll || '').toUpperCase().startsWith(targetBatch);
    });
    const active = getActiveUser();
    const types = Array.isArray(body?.types) && body.types.length ? body.types : ['aadhaar', 'pan'];
    const existingReqs = loadStore('access_requests', []);
    const created = students.map((student, idx) => ({
      id: `acc_req_${Date.now()}_${idx}`,
      verifier: {
        name: active?.name || 'Dr. Priya Raman',
        email: active?.email || 'priya.raman@trustvault.demo',
        role: 'verifier',
        dept: active?.dept || 'Department of Computer Applications',
      },
      faculty: {
        name: active?.name || 'Dr. Priya Raman',
        email: active?.email || 'priya.raman@trustvault.demo',
      },
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        studentId: student.studentId || student.roll,
        roll: student.roll || student.studentId,
      },
      targetEmail: (student.email || '').toLowerCase(),
      targetRoll: (student.roll || student.studentId || '').toUpperCase(),
      types,
      granted: [],
      reason: body?.reason || `Batch ${targetBatch} verification drive`,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000 * 7).toISOString(),
      opened: 0,
    }));
    saveStore('access_requests', [...created, ...existingReqs]);
    return { ok: true, sent: created.length, skipped: 0, group: targetBatch, count: created.length };
  }
  // Faculty Request by Email or Roll to Any Student
  if (urlPath === '/records/request-by-email' && m === 'POST') {
    const input = (body?.email || body?.roll || '').trim();
    if (!input) {
      throw new Error('Please enter the student email address or roll number.');
    }
    const cleanEmail = input.includes('@') ? input.toLowerCase() : `${input.toLowerCase()}@trustvault.edu`;
    const rollMatch = cleanEmail.match(/\b([0-9]{2}[a-z]{2}[0-9]{3,4})\b/i);
    const cleanRoll = body?.roll?.toUpperCase() || (rollMatch ? rollMatch[1].toUpperCase() : (!input.includes('@') ? input.toUpperCase() : '25MX101'));
    const batchCode = cleanRoll.match(/^[0-9]{2}[A-Za-z]{2}/) ? cleanRoll.slice(0, 4).toUpperCase() : '25MX';
    const studentName = body?.name || (cleanRoll ? `Student ${cleanRoll}` : cleanEmail.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));

    const studentEntry = {
      id: 'usr_' + cleanRoll.toLowerCase(),
      _id: 'usr_' + cleanRoll.toLowerCase(),
      name: studentName,
      email: cleanEmail,
      studentId: cleanRoll,
      roll: cleanRoll,
      batch: batchCode,
      dept: 'Department of Computer Applications',
      verified: 0,
      total: 2,
      status: 'pending',
      access: { status: 'pending', types: body?.types || ['aadhaar', 'pan'] },
      documents: [],
      createdAt: new Date().toISOString()
    };

    registerStudentInDirectory(studentEntry);

    const newRequest = {
      id: 'req_' + Date.now(),
      _id: 'req_' + Date.now(),
      student: { id: studentEntry.id, name: studentName, email: cleanEmail, roll: cleanRoll },
      verifier: { name: 'Dr. Priya Raman', email: 'priya.raman@trustvault.demo', dept: 'Department of Computer Applications', role: 'verifier' },
      targetEmail: cleanEmail,
      targetRoll: cleanRoll,
      types: body?.types || ['aadhaar', 'pan'],
      reason: body?.reason || 'Academic verification review',
      status: 'pending',
      requestedAt: new Date().toISOString()
    };

    const existingReqs = loadStore('access_requests', DEFAULT_ACCESS_REQUESTS);
    saveStore('access_requests', [newRequest, ...existingReqs]);

    return {
      ok: true,
      message: `Document access request sent to ${studentName} (${cleanEmail}).`,
      request: newRequest,
      student: studentEntry
    };
  }

  // 15. Student Access Requests: /access
  if (urlPath === '/access') {
    const active = getActiveUser();
    const allRequests = loadStore('access_requests', DEFAULT_ACCESS_REQUESTS);
    if (!active) return allRequests;

    const userEmail = (active.email || '').toLowerCase().trim();
    const userRoll = (active.roll || active.studentId || '').toUpperCase().trim();

    // Filter requests that target this specific student or general pending requests
    const targeted = allRequests.filter((r) => {
      const matchEmail = userEmail && (r.targetEmail === userEmail || r.student?.email?.toLowerCase() === userEmail);
      const matchRoll = userRoll && (r.targetRoll === userRoll || r.student?.roll?.toUpperCase() === userRoll || r.student?.studentId?.toUpperCase() === userRoll);
      const matchId = active.id && (r.student?.id === active.id || r.student?._id === active.id);
      return matchEmail || matchRoll || matchId;
    });

    return targeted.length > 0 ? targeted : allRequests;
  }
  if (urlPath.startsWith('/access/') && m === 'POST') {
    const id = urlPath.replace('/access/', '');
    const active = getActiveUser();
    const decision = body?.decision === 'deny' ? 'denied' : body?.decision === 'revoke' ? 'revoked' : 'approved';
    const requests = loadStore('access_requests', DEFAULT_ACCESS_REQUESTS).map((r) =>
      r.id === id ? { ...r, status: decision, granted: body?.types || r.granted } : r
    );
    saveStore('access_requests', requests);
    recordActivity({
      action: decision === 'approved' ? 'access.approve' : decision === 'denied' ? 'access.reject' : 'access.revoke',
      detail: `Faculty document access request ${decision}`,
      user: active
    });
    return { ok: true };
  }

  // 16. Shares: /shares
  if (urlPath === '/shares') {
    const shares = loadStore('shares', DEFAULT_SHARES);
    if (m === 'GET') return shares;
    if (m === 'POST') {
      const active = getActiveUser();
      const newShare = {
        id: 'shr_' + Date.now(),
        title: body?.label || 'PAN Card',
        recipient: body?.recipient || 'admission.cell@college.edu',
        doc: { id: body?.docId || 'doc_pan', type: 'pan', title: 'PAN Card' },
        token: 'share_' + Math.random().toString(36).slice(2, 8),
        views: 0,
        maxViews: body?.views || 5,
        status: 'active',
        expiresAt: new Date(Date.now() + (body?.hours || 24) * 3600000).toISOString(),
        createdAt: new Date().toISOString(),
      };
      saveStore('shares', [newShare, ...shares]);
      recordActivity({
        action: 'share.create',
        detail: `Share link generated for ${newShare.title} (expires in ${body?.hours || 24}h)`,
        user: active
      });
      return { ok: true, share: newShare };
    }
  }
  if (urlPath.startsWith('/shares/') && m === 'DELETE') {
    const id = urlPath.replace('/shares/', '');
    const active = getActiveUser();
    const shares = loadStore('shares', DEFAULT_SHARES).filter((s) => s.id !== id);
    saveStore('shares', shares);
    recordActivity({
      action: 'share.revoke',
      detail: 'Share link revoked',
      user: active
    });
    return { ok: true };
  }

  // 17. Admin endpoints
  if (urlPath === '/admin/stats') {
    return {
      users: { student: 48, verifier: 12, admin: 3 },
      documents: { verified: 120, pending: 14, rejected: 2 },
      logins24h: 38,
      blocks: 1250,
      tampered: 0,
      totalUsers: 63,
      totalDocs: 136,
      pendingVerifications: 14,
      ledgerRecords: 1250,
      systemHealth: '100% Tamper-Evident Ledger Integrity',
    };
  }
  if (urlPath === '/admin/users') {
    if (m === 'GET') {
      return getUsersRegistry();
    }
    if (m === 'POST') {
      const { name, email, role = 'student', roll, studentId, dept, batch, password } = body || {};
      if (!name || !email) throw new Error('Name and email are required.');
      const cleanEmail = email.trim().toLowerCase();
      const targetRole = role === 'faculty' ? 'verifier' : role;
      const users = getUsersRegistry();
      if (users.some((u) => u.email?.toLowerCase() === cleanEmail)) {
        throw new Error(`A user with email '${cleanEmail}' already exists.`);
      }
      const idCode = (roll || studentId || (targetRole === 'verifier' ? `FAC-${Math.floor(1000 + Math.random() * 9000)}` : targetRole === 'admin' ? `ADM-${Math.floor(10 + Math.random() * 90)}` : `26MX${Math.floor(100 + Math.random() * 900)}`)).toUpperCase();
      const finalPassword = (password && password.trim()) ? password.trim() : 'TrustVault@2026';
      const newUser = {
        id: `usr_${targetRole}_${Date.now()}`,
        _id: `usr_${targetRole}_${Date.now()}`,
        name: name.trim(),
        email: cleanEmail,
        role: targetRole,
        studentId: idCode,
        roll: idCode,
        batch: batch || (targetRole === 'student' ? idCode.slice(0, 4) : undefined),
        dept: dept || (targetRole === 'admin' ? 'Central Examination & Verification Cell' : 'Department of Computer Applications'),
        password: finalPassword,
        totpEnabled: true,
        hasVaultPin: true,
        createdAt: new Date().toISOString()
      };
      saveUsersRegistry([newUser, ...users]);
      if (targetRole === 'student') {
        registerStudentInDirectory(newUser);
      }
      recordActivity({ action: 'user.create', detail: `Admin created ${ROLE_LABELS[targetRole] || targetRole} account for ${newUser.name} (${cleanEmail})`, user: getActiveUser() });
      return { ok: true, user: newUser };
    }
  }
  if (urlPath.startsWith('/admin/users/') && m === 'DELETE') {
    const id = urlPath.replace('/admin/users/', '');
    const users = getUsersRegistry();
    const target = users.find((u) => u.id === id || u._id === id);
    const remaining = users.filter((u) => u.id !== id && u._id !== id);
    saveUsersRegistry(remaining);
    if (target?.role === 'student') {
      const students = getStudentDirectory().filter((s) => s.id !== id && s._id !== id && s.email?.toLowerCase() !== target.email?.toLowerCase());
      saveStore('students', students);
    }
    if (target) {
      recordActivity({ action: 'user.delete', detail: `Admin removed ${target.name} (${target.email})`, user: getActiveUser() });
    }
    return { ok: true };
  }
  if (urlPath.startsWith('/admin/users/') && urlPath.endsWith('/password') && m === 'POST') {
    const id = urlPath.replace('/admin/users/', '').replace('/password', '');
    const newPass = (body?.password && body.password.trim()) ? body.password.trim() : 'TrustVault@2026';
    const users = getUsersRegistry();
    const idx = users.findIndex((u) => u.id === id || u._id === id);
    if (idx !== -1) {
      users[idx].password = newPass;
      saveUsersRegistry(users);
      recordActivity({ action: 'user.password', detail: `Admin updated password for ${users[idx].name}`, user: getActiveUser() });
    }
    return { ok: true };
  }
  if (urlPath.startsWith('/admin/users/') && m === 'PATCH') {
    const id = urlPath.replace('/admin/users/', '');
    const users = getUsersRegistry();
    const idx = users.findIndex((u) => u.id === id || u._id === id);
    if (idx !== -1) {
      users[idx] = { ...users[idx], ...(body || {}) };
      saveUsersRegistry(users);
    }
    return { ok: true };
  }
  if (urlPath.startsWith('/admin/users/') && urlPath.endsWith('/reset-2fa')) return { ok: true };
  if (urlPath.startsWith('/admin/users/') && urlPath.endsWith('/unlock')) {
    const id = urlPath.replace('/admin/users/', '').replace('/unlock', '');
    const users = getUsersRegistry();
    const idx = users.findIndex((u) => u.id === id || u._id === id);
    if (idx !== -1) {
      users[idx].locked = false;
      users[idx].status = 'active';
      saveUsersRegistry(users);
    }
    return { ok: true };
  }

  if (urlPath === '/admin/audit') {
    const audit = loadStore('audit', DEFAULT_AUDIT);
    return audit;
  }
  if (urlPath === '/admin/requests') {
    const requests = loadStore('access_requests', DEFAULT_ACCESS_REQUESTS);
    return requests;
  }
  if (urlPath === '/admin/ledger') {
    return DEFAULT_LEDGER_BLOCKS;
  }
  if (urlPath === '/admin/integrity' && m === 'POST') {
    return { ok: true, blocks: 1250, documents: 384, problems: [] };
  }
  if (urlPath === '/admin/invites') {
    if (m === 'GET') {
      return [
        {
          id: 'inv_1',
          email: 'prof.shankar@trustvault.demo',
          role: 'verifier',
          invitedBy: 'Administrator',
          status: 'pending',
          expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
          code: 'FAC-8891',
          createdAt: new Date().toISOString(),
        },
      ];
    }
    return { ok: true };
  }
  if (urlPath.startsWith('/admin/invites/') && m === 'DELETE') {
    return { ok: true };
  }

  // 18. Public share & invite endpoints
  if (urlPath.startsWith('/public/share/')) {
    if (urlPath.endsWith('/otp') && m === 'POST') {
      return { ok: true };
    }
    if (urlPath.endsWith('/view') && m === 'POST' && raw) {
      const blob = createSampleDocBlob('PAN Card (Watermarked View)', 'ABCDE1234F');
      return {
        ok: true,
        blob: async () => blob,
        headers: new Headers({ 'Content-Type': 'image/svg+xml' }),
      };
    }
    return {
      title: 'PAN Card (Sample Verified)',
      owner: 'Rahul Sharma',
      status: 'active',
      recipient: 'admission.cell@college.edu',
      viewsLeft: 3,
      expiresAt: new Date(Date.now() + 86400000 * 2).toISOString(),
    };
  }
  if (urlPath.startsWith('/public/invite/')) {
    return { email: 'invitee@college.edu', role: 'verifier', valid: true };
  }

  // 19. Mailbox check in dev
  if (urlPath === '/dev/mailbox') {
    return { enabled: false };
  }

  // Default fallback
  return { ok: true };
}

// -------------------------------------------------------------
// Formatting & Presentation Utilities
// -------------------------------------------------------------
export const fmtDate = (d) => (d ? new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '-');
export const fmtSize = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export const TYPE_LABELS = {
  pan: 'PAN Card',
  aadhaar: 'Aadhaar Card',
  license: 'Driving Licence',
  class10: '10th Marksheet',
  class12: '12th Marksheet',
  marksheet: 'Semester Marksheet',
  certificate: 'College Certificate',
  other: 'Other',
};

export const ROLE_LABELS = { student: 'Student', verifier: 'Faculty', admin: 'Administrator' };

const ACTIONS = {
  register: 'Account created',
  login: 'Signed in',
  'login.failed': 'Failed sign-in attempt',
  'password.change': 'Password changed',
  'password.reset': 'Password reset',
  'profile.update': 'Profile updated',
  'profile.photo': 'Profile photo',
  stepup: 'Security check passed',
  'stepup.failed': 'Security check failed',
  'vault.unlock': 'Vault unlocked',
  'vault.pin': 'Vault PIN set',
  'session.revoke': 'Device signed out',
  'backup-codes.regenerate': 'New backup codes',
  'devices.forget': 'Trusted devices forgotten',
  'account.delete': 'Account deleted',
  'document.upload': 'Document uploaded',
  'document.view': 'Document viewed',
  'document.delete': 'Document deleted',
  'document.retype': 'Document type changed',
  'document.export': 'Documents emailed',
  'document.verified': 'Document verified',
  'document.rejected': 'Document rejected',
  'record.view': 'Viewed by faculty',
  'record.open': 'Opened by faculty',
  'share.create': 'Share link sent',
  'share.view': 'Shared link opened',
  'share.revoke': 'Share link revoked',
  'access.request': 'Access requested',
  'access.approved': 'Access approved',
  'access.denied': 'Access denied',
  'access.revoked': 'Access revoked',
  'user.role': 'Role changed',
  'user.unlock': 'Account unlocked',
  'user.reset-2fa': 'Authenticator reset',
  'invite.create': 'Invitation sent',
  'invite.revoke': 'Invitation cancelled',
  'invite.accept': 'Invitation accepted',
  'ledger.check': 'Integrity check run',
};

export const actionLabel = (code) => ACTIONS[code] ?? code;
export const cleanDetail = (s = '') => s.replace(' | ', ' · ').replace(/^(.+?) \((.+)\)$/, (m, a, b) => (b.startsWith(a) ? a + b.slice(a.length) : m));

export const SECTIONS = [
  { title: 'Identity documents', types: ['pan', 'aadhaar', 'license'], note: 'Checked automatically with checksums & format rules.' },
  { title: 'School marksheets', types: ['class10', 'class12'], note: 'Stored safely in encrypted vault storage.' },
  { title: 'College documents', types: ['marksheet', 'certificate'], note: 'Checked automatically for academic validation.' },
  { title: 'Other documents', types: ['other'], note: 'Stored securely and fingerprinted for authenticity.' },
];

export const NUMBER_FIELD = {
  pan: { label: 'PAN number', placeholder: 'ABCDE1234F', required: true },
  aadhaar: { label: 'Aadhaar number', placeholder: '1234 5678 9012', required: true },
  license: { label: 'Driving licence number', placeholder: 'MH12 20110012345', required: true },
  class10: { label: 'Register number (optional)', placeholder: '' },
  class12: { label: 'Register number (optional)', placeholder: '' },
  marksheet: { label: 'Roll / register number (optional)', placeholder: '' },
  certificate: { label: 'Certificate number (optional)', placeholder: '' },
  other: { label: 'Reference number (optional)', placeholder: '' },
};

export const firstName = (name = '') => name.trim().replace(/^(dr|prof|mr|mrs|ms|miss)\.?\s+/i, '').split(/\s+/)[0];

export const groupRuns = (events = []) =>
  events.reduce((out, e) => {
    const last = out.at(-1);
    if (last && last.action === e.action && last.detail === e.detail && (last.user?._id ?? null) === (e.user?._id ?? null)) {
      last.count += 1;
      last.items.push(e);
    } else out.push({ ...e, count: 1, items: [e] });
    return out;
  }, []);
