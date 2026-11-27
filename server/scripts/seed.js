const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const config = require('../src/config');
const User = require('../src/models/User');
const Document = require('../src/models/Document');
const AccessRequest = require('../src/models/AccessRequest');
const Audit = require('../src/models/Audit');
const { hashPassword, sha256 } = require('../src/lib/crypto');
const { recordAudit, GENESIS_PREV_HASH } = require('../src/lib/auditLedger');

async function seed() {
  try {
    console.log('[TrustVault Seeder] Connecting to MongoDB:', config.mongoUri);
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
    console.log('[TrustVault Seeder] Connected.');

    // Clear old data
    await User.deleteMany({});
    await Document.deleteMany({});
    await AccessRequest.deleteMany({});
    await Audit.deleteMany({});
    console.log('[TrustVault Seeder] Cleared existing collections.');

    // Default seed accounts (no external secrets file required)
    const accountsData = {
      password: process.env.SEED_DEFAULT_PASSWORD || 'TrustVault@2026',
      pin: '482915',
      accounts: [
        { name: 'Pooja Matheshwaran', email: 'poojamatheshwaran6363@gmail.com', role: 'admin' },
        { name: 'Dr. Priya Raman', email: 'priya.raman@trustvault.demo', role: 'verifier' },
        { name: 'Rahul Sharma', email: 'rahul.23mx301@trustvault.demo', role: 'student', roll: '23MX301' }
      ]
    };

    const hashedPassword = await hashPassword(accountsData.password || 'TrustVault@2026');

    // Create Genesis block in audit ledger
    await recordAudit({
      action: 'LEDGER_INIT',
      detail: 'TrustVault Zero-Knowledge Cryptographic Audit Ledger Initialized (Genesis Block)',
      userName: 'System Administrator',
      fileHash: sha256('TRUSTVAULT_GENESIS_ROOT_HASH_2026')
    });

    console.log('[TrustVault Seeder] Seeding users...');
    const createdUsers = [];
    for (const acc of accountsData.accounts) {
      const u = await User.create({
        name: acc.name,
        email: acc.email.toLowerCase(),
        password: hashedPassword,
        role: acc.role,
        roll: acc.roll || '',
        batch: acc.roll ? (acc.roll.startsWith('23') ? '23MX' : '24MX') : '2023-2025',
        dept: acc.role === 'admin' ? 'Central Examination & Verification Cell' : 'Department of Computer Applications',
        phone: '+91 98765 43210',
        hasVaultPin: true,
        vaultPin: accountsData.pin || '482915',
        totpSecret: acc.secret || '',
        backupCodes: acc.backup || []
      });
      createdUsers.push(u);
    }
    console.log(`[TrustVault Seeder] Created ${createdUsers.length} user accounts.`);

    // Pick Rahul Sharma (Student) and Dr. Priya Raman (Verifier)
    const rahul = createdUsers.find((u) => u.email.includes('rahul')) || createdUsers.find((u) => u.role === 'student');
    const priya = createdUsers.find((u) => u.email.includes('priya')) || createdUsers.find((u) => u.role === 'verifier');

    if (rahul) {
      console.log('[TrustVault Seeder] Seeding sample verified documents for Rahul Sharma...');
      const sampleDocs = [
        {
          userId: rahul._id,
          title: 'PAN Card',
          type: 'pan',
          originalName: 'PAN-card.png',
          numberMasked: 'ABCDE1234F',
          size: 245760,
          mime: 'image/png',
          status: 'verified',
          fileHash: sha256('MOCK_FILE_PAN_RAHUL'),
          autoCheck: {
            passed: true,
            details: 'Income Tax Department PAN format validated (ABCDE1234F).',
            score: 98
          }
        },
        {
          userId: rahul._id,
          title: 'Aadhaar Card',
          type: 'aadhaar',
          originalName: 'Aadhaar-front.png',
          numberMasked: '•••• •••• 9012',
          size: 450560,
          mime: 'image/png',
          status: 'verified',
          fileHash: sha256('MOCK_FILE_AADHAAR_RAHUL'),
          autoCheck: {
            passed: true,
            details: 'UIDAI Verhoeff algorithm checksum passed. First 8 digits masked.',
            score: 100
          }
        },
        {
          userId: rahul._id,
          title: '10th Marksheet',
          type: 'tenth',
          originalName: 'Class-10-Marksheet.pdf',
          numberMasked: '10M-84920',
          size: 512000,
          mime: 'application/pdf',
          status: 'verified',
          fileHash: sha256('MOCK_FILE_10TH_RAHUL'),
          autoCheck: {
            passed: true,
            details: 'Board examination registration and school authority seal verified.',
            score: 95
          }
        },
        {
          userId: rahul._id,
          title: '12th Marksheet',
          type: 'twelfth',
          originalName: 'Class-12-Marksheet.pdf',
          numberMasked: '12M-99124',
          size: 532480,
          mime: 'application/pdf',
          status: 'verified',
          fileHash: sha256('MOCK_FILE_12TH_RAHUL'),
          autoCheck: {
            passed: true,
            details: 'Higher Secondary Board register and cut-off percentage verified.',
            score: 96
          }
        }
      ];

      for (const docData of sampleDocs) {
        const d = await Document.create(docData);
        await recordAudit({
          action: 'DOCUMENT_UPLOAD',
          detail: `Uploaded & verified ${d.title} (${d.numberMasked})`,
          userId: rahul._id,
          userName: rahul.name,
          fileHash: d.fileHash
        });
      }
    }

    if (rahul && priya) {
      console.log('[TrustVault Seeder] Seeding access request...');
      await AccessRequest.create({
        studentId: rahul._id,
        facultyId: priya._id,
        types: ['pan', 'aadhaar', 'tenth'],
        granted: ['pan', 'aadhaar'],
        reason: 'MCA Placement Verification - TCS Drive 2026',
        status: 'approved',
        requestedAt: new Date(Date.now() - 2 * 86400000),
        respondedAt: new Date(Date.now() - 1 * 86400000),
        expiresAt: new Date(Date.now() + 5 * 86400000)
      });

      await recordAudit({
        action: 'ACCESS_APPROVED',
        detail: `Student ${rahul.name} approved document access for ${priya.name}`,
        userId: rahul._id,
        userName: rahul.name
      });
    }

    console.log('[TrustVault Seeder] Database seeded successfully!');
    process.exit(0);
  } catch (err) {
    console.error('[TrustVault Seeder] Error seeding database:', err.message);
    process.exit(1);
  }
}

seed();

