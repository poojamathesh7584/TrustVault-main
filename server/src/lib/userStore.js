const fs = require('fs');
const path = require('path');

const USERS_FILE = path.join(__dirname, '..', '..', 'data', 'usersStore.json');

const DEFAULT_USERS = [
  {
    id: 'usr_admin_pooja',
    _id: 'usr_admin_pooja',
    name: 'Pooja Matheshwaran',
    email: 'poojamatheshwaran6363@gmail.com',
    role: 'admin',
    studentId: 'ADM-01',
    roll: 'ADM-01',
    dept: 'Central Examination & Verification Cell',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'TrustVault@2026',
    status: 'active',
    totpEnabled: true,
    hasVaultPin: true,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
  },
  {
    id: 'usr_admin_1',
    _id: 'usr_admin_1',
    name: 'System Administrator',
    email: 'admin@trustvault.demo',
    role: 'admin',
    studentId: 'ADM-02',
    roll: 'ADM-02',
    dept: 'Central Examination & Verification Cell',
    password: process.env.DEFAULT_ADMIN_PASSWORD || 'TrustVault@2026',
    status: 'active',
    totpEnabled: true,
    hasVaultPin: true,
    createdAt: new Date(Date.now() - 90 * 86400000).toISOString()
  },
  {
    id: 'usr_faculty_1',
    _id: 'usr_faculty_1',
    name: 'Dr. Priya Raman',
    email: 'priya.raman@trustvault.demo',
    role: 'verifier',
    studentId: 'FAC-4081',
    roll: 'FAC-4081',
    dept: 'Department of Computer Applications',
    password: process.env.DEFAULT_FACULTY_PASSWORD || 'TrustVault@2026',
    status: 'active',
    totpEnabled: true,
    hasVaultPin: true,
    createdAt: new Date(Date.now() - 60 * 86400000).toISOString()
  },
  {
    id: 'usr_student_pooja',
    _id: 'usr_student_pooja',
    name: 'Pooja',
    email: 'poojamathesh7584@gmail.com',
    role: 'student',
    studentId: '26MX337',
    roll: '26MX337',
    batch: '26MX',
    dept: 'Department of Computer Applications',
    password: process.env.DEFAULT_STUDENT_PASSWORD || 'TrustVault@2026',
    status: 'active',
    totpEnabled: true,
    hasVaultPin: true,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString()
  }
];

function ensureDir() {
  const dir = path.dirname(USERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function getAllUsers() {
  try {
    ensureDir();
    if (!fs.existsSync(USERS_FILE)) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
      return [...DEFAULT_USERS];
    }
    const data = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    if (!Array.isArray(data) || data.length === 0) {
      fs.writeFileSync(USERS_FILE, JSON.stringify(DEFAULT_USERS, null, 2));
      return [...DEFAULT_USERS];
    }
    // Ensure primary admin poojamatheshwaran6363@gmail.com is always present
    if (!data.some((u) => u.email?.toLowerCase() === 'poojamatheshwaran6363@gmail.com')) {
      data.unshift(DEFAULT_USERS[0]);
      fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
    }
    return data;
  } catch {
    return [...DEFAULT_USERS];
  }
}

function saveAllUsers(users) {
  try {
    ensureDir();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  } catch {}
}

function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = String(identifier).trim().toLowerCase();
  const users = getAllUsers();
  return users.find(
    (u) =>
      (u.email && u.email.toLowerCase() === clean) ||
      (u.roll && u.roll.toLowerCase() === clean) ||
      (u.studentId && u.studentId.toLowerCase() === clean) ||
      u.id === identifier ||
      u._id === identifier
  ) || null;
}

module.exports = {
  DEFAULT_USERS,
  getAllUsers,
  saveAllUsers,
  findUserByIdentifier
};
