/**
 * 3D Asset Validator Script
 * Powered by official Khronos Group glTF-Validator
 *
 * Verifies all 13 3D GLB assets in apps/web/public/models:
 * - Full Khronos glTF 2.0 compliance check
 * - Detailed issue reporting (errors, warnings, infos, hints)
 * - Morph targets and capability compatibility
 * - Exports per-asset JSON validation reports to reports/gltf-validation/
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import validator from 'gltf-validator';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');
const MODELS_DIR = path.join(ROOT_DIR, 'apps/web/public/models');
const REPORTS_DIR = path.join(ROOT_DIR, 'reports/gltf-validation');

if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

console.log('======================================================================');
console.log('  DÁNG VIỆT - KHRONOS GROUP glTF 2.0 OFFICIAL VALIDATOR SUITE');
console.log('======================================================================\n');
console.log(`[Validator] Models directory: ${MODELS_DIR}`);
console.log(`[Validator] Reports directory: ${REPORTS_DIR}\n`);

function collectGlbFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectGlbFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.glb')) {
      files.push(fullPath);
    }
  }
  return files;
}

const allGlbFiles = collectGlbFiles(MODELS_DIR);
console.log(`Tìm thấy ${allGlbFiles.length} tệp GLB cần kiểm định:\n`);

const summaryResults = [];

for (const filePath of allGlbFiles) {
  const relPath = path.relative(MODELS_DIR, filePath).replace(/\\/g, '/');
  const fileBuffer = fs.readFileSync(filePath);
  const fileSize = fileBuffer.length;

  const validationResult = await validator.validateBytes(new Uint8Array(fileBuffer), {
    maxIssues: 50,
    ignoredIssues: [],
  });

  const { issues, info } = validationResult;
  const numErrors = issues.numErrors || 0;
  const numWarnings = issues.numWarnings || 0;
  const numInfos = issues.numInfos || 0;

  const assetSummary = {
    file: relPath,
    fullPath: filePath,
    sizeBytes: fileSize,
    sizeFormatted: `${(fileSize / 1024).toFixed(1)} KB`,
    status: numErrors === 0 ? (numWarnings === 0 ? 'PASS' : 'WARNING') : 'ERROR',
    numErrors,
    numWarnings,
    numInfos,
    version: info.version,
    generator: info.generator || 'Unknown',
    drawCallCount: info.drawCallCount,
    totalVertexCount: info.totalVertexCount,
    totalTriangleCount: info.totalTriangleCount,
    hasMorphTargets: !!info.hasMorphTargets,
    messages: issues.messages || [],
  };

  summaryResults.push(assetSummary);

  // Write individual report JSON
  const safeReportName = relPath.replace(/\//g, '__').replace(/\.glb$/, '.json');
  const reportPath = path.join(REPORTS_DIR, safeReportName);
  fs.writeFileSync(reportPath, JSON.stringify(validationResult, null, 2), 'utf8');

  // Format terminal output
  const statusBadge = assetSummary.status === 'PASS'
    ? '\x1b[32m[PASS]\x1b[0m'
    : assetSummary.status === 'WARNING'
    ? '\x1b[33m[WARN]\x1b[0m'
    : '\x1b[31m[FAIL]\x1b[0m';

  console.log(
    `  ${statusBadge} ${relPath.padEnd(36)} | ${assetSummary.sizeFormatted.padStart(9)} | Err: ${numErrors} | Warn: ${numWarnings} | Info: ${numInfos} | Gen: ${assetSummary.generator.slice(0, 28)}`
  );

  if (issues.messages && issues.messages.length > 0) {
    for (const msg of issues.messages) {
      if (msg.severity === 0) {
        console.log(`       \x1b[31m[ERROR]\x1b[0m ${msg.code}: ${msg.message} (pointer: ${msg.pointer})`);
      } else if (msg.severity === 1) {
        console.log(`       \x1b[33m[WARN]\x1b[0m ${msg.code}: ${msg.message} (pointer: ${msg.pointer})`);
      }
    }
  }
}

// Write summary report JSON
const summaryPath = path.join(REPORTS_DIR, 'summary.json');
fs.writeFileSync(summaryPath, JSON.stringify(summaryResults, null, 2), 'utf8');

const totalPassed = summaryResults.filter((r) => r.status === 'PASS').length;
const totalWarn = summaryResults.filter((r) => r.status === 'WARNING').length;
const totalFail = summaryResults.filter((r) => r.status === 'ERROR').length;

console.log('\n======================================================================');
console.log(`  TỔNG KẾT KHRONOS glTF VALIDATOR:`);
console.log(`  - Tổng số assets: ${summaryResults.length}`);
console.log(`  - PASS hoàn toàn: ${totalPassed}/${summaryResults.length}`);
console.log(`  - WARNING:        ${totalWarn}/${summaryResults.length}`);
console.log(`  - ERROR:          ${totalFail}/${summaryResults.length}`);
console.log(`  - Báo cáo JSON chi tiết lưu tại: ${REPORTS_DIR}`);
console.log('======================================================================\n');
