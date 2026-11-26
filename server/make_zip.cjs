const fs = require('fs');
const path = require('path');
const { ZipArchive } = require('archiver');

const rootDir = path.resolve(__dirname, '..');
const outZip = path.resolve(rootDir, 'TrustVault-Complete.zip');

if (fs.existsSync(outZip)) {
  fs.unlinkSync(outZip);
}

const output = fs.createWriteStream(outZip);
const archive = new ZipArchive({ zlib: { level: 9 } });

output.on('close', () => {
  console.log(`TrustVault-Complete.zip packaged successfully: ${archive.pointer()} total bytes`);
  process.exit(0);
});

archive.on('error', (err) => {
  console.error(err);
  process.exit(1);
});

archive.pipe(output);

const excludeDirs = new Set(['node_modules', '.git', 'dist']);
const excludeFiles = new Set(['TrustVault-Complete.zip', 'make_zip.mjs', 'make_zip.cjs', 'test_zip_mail.cjs']);

function addDirectory(currentDir, relativeBase = '') {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (excludeDirs.has(entry.name)) continue;
      addDirectory(path.join(currentDir, entry.name), path.join(relativeBase, entry.name));
    } else {
      if (excludeFiles.has(entry.name)) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = path.join(relativeBase, entry.name).replace(/\\/g, '/');
      archive.file(fullPath, { name: relPath });
    }
  }
}

addDirectory(rootDir);
archive.finalize();
