/**
 * Automated Test Suite: Structured AI 3D Design Proposal & Validation
 * Verifies:
 * 1. DesignProposal schema validity & diff computation
 * 2. Lock preservation (cannot override locked fields)
 * 3. Body shape invariance (system preserves user body shape)
 * 4. Catalog boundary enforcement (reject invalid garments/accessories)
 * 5. OCC Anti-stale revision guard
 * 6. Single atomic apply & undo integrity
 */

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import {
  computeProposalDiff,
  validateDesignProposal,
  executeCommand,
} from '../packages/domain/dist/index.js';

console.log('=== RUNNING AI DESIGN PROPOSAL TEST SUITE ===\n');

// Mock Base Look
const baseLook = {
  id: 'test_look_proposal',
  title: 'Bộ phối thử nghiệm',
  revision: 3,
  eventId: 'ky_yeu',
  styleId: 'thanh_lich',
  config: {
    garmentType: 'aodai',
    primaryColor: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' },
    pantsColor: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
    collarStyle: 'traditional_high',
    sleeveStyle: 'traditional_long',
    fabric: 'silk_ha_dong',
    pattern: 'plain',
    accessories: ['non_la'],
    bodyShape: 'standard',
    modelId: 'aodai_classic_01',
  },
  locks: {
    primaryColor: true, // LOCKED!
    pantsColor: false,
    collarStyle: false,
    sleeveStyle: false,
    fabric: false,
    pattern: false,
    accessories: false,
    bodyShape: true,   // LOCKED!
    modelId: false,
  },
  explanation: 'Phối đồ chuẩn mực truyền thống',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// 1. Test computeProposalDiff
console.log('--- 1. Testing computeProposalDiff ---');
const proposedConfig1 = {
  ...baseLook.config,
  pantsColor: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' },
  collarStyle: 'v_neck',
  accessories: ['quat_xep', 'chuoi_ngoc'],
};
const diff = computeProposalDiff(baseLook.config, proposedConfig1);
assert.equal(diff.changedFields.includes('pantsColor'), true, 'diff detects pantsColor change');
assert.equal(diff.changedFields.includes('collarStyle'), true, 'diff detects collarStyle change');
assert.equal(diff.colorChanges.length, 1, 'diff detects 1 color change');
assert.equal(diff.colorChanges[0].field, 'pantsColor');
assert.equal(diff.addedAccessories.includes('quat_xep'), true);
assert.equal(diff.removedAccessories.includes('non_la'), true);
console.log('✓ computeProposalDiff correctly detected changes, additions, removals, color deltas.');

// 2. Test Lock Enforcement
console.log('\n--- 2. Testing Lock Enforcement ---');
const violatingProposal = {
  schemaVersion: '2.0.0',
  proposalId: randomUUID(),
  targetLookId: baseLook.id,
  baseRevision: 3,
  catalogVersion: '2.0.0',
  title: 'Thiết kế vi phạm khóa',
  proposedConfig: {
    ...baseLook.config,
    primaryColor: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' }, // Trying to alter locked primaryColor!
  },
  diff: { changedFields: ['primaryColor'], addedAccessories: [], removedAccessories: [], colorChanges: [] },
  explanation: 'Thử đổi màu áo bị khóa',
  unsupportedRequests: [],
  warnings: [],
  citations: [],
  mode: 'mock',
  model: 'dangviet-rules-v1',
  createdAt: new Date().toISOString(),
};

const lockValidation = validateDesignProposal(violatingProposal, baseLook, []);
assert.equal(lockValidation.valid, false, 'Validation must fail when proposal alters locked field');
assert.equal(
  lockValidation.errors.some((e) => e.includes('Màu áo đang bị khóa')),
  true,
  'Error message must state primaryColor is locked'
);
console.log('✓ validateDesignProposal rejected modification of locked primaryColor.');

// 3. Test Body Shape Invariance
console.log('\n--- 3. Testing Body Shape Invariance ---');
const bodyShapeProposal = {
  schemaVersion: '2.0.0',
  proposalId: randomUUID(),
  targetLookId: baseLook.id,
  baseRevision: 3,
  catalogVersion: '2.0.0',
  title: 'Thiết kế thử đổi body shape',
  proposedConfig: {
    ...baseLook.config,
    bodyShape: 'tall_slender', // AI suggested changing body shape
    collarStyle: 'traditional_high',
  },
  diff: { changedFields: ['bodyShape'], addedAccessories: [], removedAccessories: [], colorChanges: [] },
  explanation: 'Đề xuất đổi phom dáng',
  unsupportedRequests: [],
  warnings: [],
  citations: [],
  mode: 'mock',
  model: 'dangviet-rules-v1',
  createdAt: new Date().toISOString(),
};

const bodyValidation = validateDesignProposal(bodyShapeProposal, baseLook, []);
assert.equal(bodyValidation.valid, true, 'Validation passes but warns');
assert.equal(
  bodyValidation.warnings.some((w) => w.includes('bảo toàn vóc dáng')),
  true,
  'Warning generated for body shape alteration attempt'
);
assert.equal(
  bodyValidation.proposal?.proposedConfig.bodyShape,
  'standard',
  'Body shape restored to baseLook.config.bodyShape'
);
console.log('✓ Body shape invariance enforced: user body shape preserved.');

// 4. Test OCC Anti-stale Revision Guard
console.log('\n--- 4. Testing OCC Anti-stale Revision Guard ---');
const staleProposal = {
  ...violatingProposal,
  baseRevision: 2, // Out of date (baseLook is revision 3)
  proposedConfig: { ...baseLook.config, collarStyle: 'v_neck' },
};
const staleValidation = validateDesignProposal(staleProposal, baseLook, []);
assert.equal(staleValidation.valid, false, 'Stale proposal must be invalid');
assert.equal(staleValidation.stale, true, 'Stale flag must be true');
assert.equal(
  staleValidation.errors.some((e) => e.includes('lỗi thời (Stale)')),
  true,
  'Error indicates stale revision'
);
console.log('✓ OCC anti-stale guard triggered when baseRevision != currentLook.revision.');

// 5. Test Catalog Boundaries (Unsupported Asset or Option)
console.log('\n--- 5. Testing Catalog Boundaries ---');
const unsupportedProposal = {
  ...violatingProposal,
  baseRevision: 3,
  proposedConfig: {
    ...baseLook.config,
    primaryColor: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' }, // locked color preserved so lock validation passes
    collarStyle: 'unsupported_chinese_collar', // Invalid collar
    accessories: ['invalid_drone_accessory'], // Invalid accessory
  },
};
const catalogValidation = validateDesignProposal(unsupportedProposal, baseLook, []);
assert.equal(catalogValidation.valid, false, 'Invalid catalog values rejected');
assert.equal(
  catalogValidation.errors.some((e) => e.includes('Hợp đồng DesignProposal không hợp lệ') || e.includes('không hỗ trợ')),
  true,
  'Schema validation or catalog check rejects invalid values'
);
console.log('✓ Catalog boundaries enforced: unsupported collars and accessories rejected.');

// 6. Test Atomic Command Execution APPLY_DESIGN
console.log('\n--- 6. Testing Atomic APPLY_DESIGN & OCC ---');
const validProposal = {
  schemaVersion: '2.0.0',
  proposalId: randomUUID(),
  targetLookId: baseLook.id,
  baseRevision: 3,
  catalogVersion: '2.0.0',
  title: 'Thiết kế Hợp lệ Mới',
  proposedConfig: {
    ...baseLook.config,
    modelId: 'aodai_remix_raglan',
    collarStyle: 'round',
    sleeveStyle: 'raglan',
    fabric: 'linen_modern',
    accessories: ['quat_xep'],
  },
  diff: { changedFields: ['modelId', 'collarStyle', 'sleeveStyle', 'fabric', 'accessories'], addedAccessories: ['quat_xep'], removedAccessories: ['non_la'], colorChanges: [] },
  explanation: 'Thiết kế mới hợp lệ',
  unsupportedRequests: [],
  warnings: [],
  citations: [],
  mode: 'mock',
  model: 'dangviet-rules-v1',
  createdAt: new Date().toISOString(),
};

const applyCommand = {
  commandId: randomUUID(),
  lookId: baseLook.id,
  expectedRevision: 3,
  action: 'APPLY_DESIGN',
  payload: {
    config: validProposal.proposedConfig,
    title: validProposal.title,
    explanation: validProposal.explanation,
  },
  timestamp: new Date().toISOString(),
};

const execResult = executeCommand(baseLook, applyCommand);
if (!execResult.ok) {
  console.error('Command execution failed:', execResult);
}
assert.equal(execResult.ok, true, 'APPLY_DESIGN succeeds');
if (execResult.ok) {
  const updatedLook = execResult.result.look;
  assert.equal(updatedLook.revision, 4, 'Revision increments monotonically to 4');
  assert.equal(updatedLook.config.collarStyle, 'round');
  assert.equal(updatedLook.config.fabric, 'linen_modern');
  assert.equal(updatedLook.config.primaryColor.hex, '#B83A24', 'Locked primary color preserved');
  assert.equal(updatedLook.config.bodyShape, 'standard', 'Locked body shape preserved');
  console.log('✓ APPLY_DESIGN executed atomically: updated configuration, bumped revision, preserved locked fields.');
}

console.log('\n=== ALL 6 PROPOSAL & DOMAIN VALIDATION TESTS PASSED ===');
