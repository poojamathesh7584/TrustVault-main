const mongoose = require('mongoose');
const config = require('../src/config');

async function inspectDb() {
  try {
    console.log('[TrustVault DB Inspector] Connecting to MongoDB Atlas...');
    await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 7000 });
    const db = mongoose.connection.db;
    console.log(`[TrustVault DB Inspector] Connected to database: "${db.databaseName}"\n`);

    const collections = await db.listCollections().toArray();
    if (!collections.length) {
      console.log('No collections found in this database yet. Run "npm run seed" to initialize.');
      process.exit(0);
    }

    console.log('=== Collections Overview ===');
    for (const col of collections.sort((a, b) => a.name.localeCompare(b.name))) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`- ${col.name.padEnd(18)} : ${count} document(s)`);
    }

    console.log('\n=== Latest Records (Sanitized) ===');
    const previewConfig = [
      { name: 'users', projection: { password: 0, vaultPin: 0, totpSecret: 0, backupCodes: 0 } },
      { name: 'documents', projection: { fileData: 0 } },
      { name: 'activitylogs', projection: {} },
      { name: 'audits', projection: {} },
      { name: 'accessrequests', projection: {} },
      { name: 'shares', projection: {} },
      { name: 'otps', projection: { code: 0, recentCodes: 0 } }
    ];

    for (const item of previewConfig) {
      const exists = collections.some((c) => c.name === item.name);
      if (!exists) continue;
      const docs = await db.collection(item.name)
        .find({}, { projection: item.projection })
        .sort({ _id: -1 })
        .limit(3)
        .toArray();
      console.log(`\n[${item.name}] (showing up to 3 latest):`);
      if (!docs.length) {
        console.log('  (empty)');
      } else {
        console.log(JSON.stringify(docs, null, 2));
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('[TrustVault DB Inspector] Error:', err.message);
    process.exit(1);
  }
}

inspectDb();
