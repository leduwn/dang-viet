import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

console.log('--- DÁNG VIỆT - KIỂM TRA MÔI TRƯỜNG (DOCTOR) ---');

let hasError = false;

// 1. Node.js version
const nodeVersion = process.versions.node;
const [major] = nodeVersion.split('.').map(Number);
if (major < 20) {
  console.error(`[FAIL] Node.js phiên bản >= 20 yêu cầu, hiện tại: v${nodeVersion}`);
  hasError = true;
} else {
  console.log(`[OK] Node.js v${nodeVersion} (hỗ trợ node:sqlite và ES Modules)`);
}

// 2. Check node:sqlite
try {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE test(id INT);');
  console.log('[OK] node:sqlite hoạt động chuẩn xác');
} catch (err) {
  console.error('[FAIL] Không thể nạp node:sqlite:', err.message);
  hasError = true;
}

// 3. Check directories
const requiredDirs = [
  'apps/web',
  'apps/server',
  'packages/contracts',
  'packages/domain',
  'content',
  'assets/templates',
  'migrations',
  'scripts',
  'docs',
];
for (const dir of requiredDirs) {
  if (fs.existsSync(dir)) {
    console.log(`[OK] Thư mục: ${dir}`);
  } else {
    console.error(`[FAIL] Thiếu thư mục: ${dir}`);
    hasError = true;
  }
}

// 4. Check content files
const requiredFiles = [
  'content/events.json',
  'content/styles.json',
  'content/colors.json',
  'content/catalog.json',
  'content/presets.json',
  'content/culture-cards.json',
  'migrations/001_initial.sql',
];
for (const f of requiredFiles) {
  if (fs.existsSync(f)) {
    console.log(`[OK] Tệp dữ liệu: ${f}`);
  } else {
    console.error(`[FAIL] Thiếu tệp: ${f}`);
    hasError = true;
  }
}

// 5. Check ports
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (err) => {
      resolve({ port, free: false, error: err.code });
    });
    server.once('listening', () => {
      server.close();
      resolve({ port, free: true });
    });
    server.listen(port, '127.0.0.1');
  });
}

const p3001 = await checkPort(3001);
const p5173 = await checkPort(5173);

if (p3001.free) {
  console.log('[OK] Cổng 3001 (Server API) khả dụng');
} else {
  console.log(`[WARN] Cổng 3001 đang bận (${p3001.error}), kiểm tra nếu tiến trình cũ đang chạy`);
}

if (p5173.free) {
  console.log('[OK] Cổng 5173 (Vite Web) khả dụng');
} else {
  console.log(`[WARN] Cổng 5173 đang bận (${p5173.error}), Vite sẽ tự chọn cổng kế tiếp`);
}

if (hasError) {
  console.error('\n[KẾT QUẢ] Phát hiện lỗi cấu hình cần xử lý trước khi chạy.');
  process.exit(1);
} else {
  console.log('\n[KẾT QUẢ] Môi trường đáp ứng đầy đủ điều kiện để phát triển và chạy ứng dụng Dáng Việt.');
}
