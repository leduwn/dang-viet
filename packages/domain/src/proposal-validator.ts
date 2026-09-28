/**
 * Design Proposal Validator Module
 * Validates structured AI 3D outfit proposals against domain state, capabilities, locks, and OCC revision.
 */

import {
  type DesignProposal,
  type Look,
  type GarmentConfig,
  type ProposalDiff,
  type ValidateProposalResponse,
  DesignProposalSchema,
  VALID_ACCESSORY_IDS,
  VALID_COLLARS,
  VALID_SLEEVES,
  VALID_FABRICS,
  VALID_PATTERNS,
  VALID_GARMENT_MODELS,
  VALID_BODY_SHAPES,
} from '@dangviet/contracts';

/**
 * Computes deep field differences between current committed config and proposed config
 */
export function computeProposalDiff(current: GarmentConfig, proposed: GarmentConfig): ProposalDiff {
  const changedFields: string[] = [];
  const colorChanges: Array<{ field: string; from: string; to: string }> = [];

  if (current.primaryColor.hex !== proposed.primaryColor.hex) {
    changedFields.push('primaryColor');
    colorChanges.push({
      field: 'primaryColor',
      from: current.primaryColor.hex,
      to: proposed.primaryColor.hex,
    });
  }

  if (current.pantsColor.hex !== proposed.pantsColor.hex) {
    changedFields.push('pantsColor');
    colorChanges.push({
      field: 'pantsColor',
      from: current.pantsColor.hex,
      to: proposed.pantsColor.hex,
    });
  }

  if (current.collarStyle !== proposed.collarStyle) {
    changedFields.push('collarStyle');
  }

  if (current.sleeveStyle !== proposed.sleeveStyle) {
    changedFields.push('sleeveStyle');
  }

  if (current.fabric !== proposed.fabric) {
    changedFields.push('fabric');
  }

  if (current.pattern !== proposed.pattern) {
    changedFields.push('pattern');
  }

  if (current.modelId !== proposed.modelId) {
    changedFields.push('modelId');
  }

  if (current.bodyShape !== proposed.bodyShape) {
    changedFields.push('bodyShape');
  }

  const currentAcc = new Set(current.accessories);
  const proposedAcc = new Set(proposed.accessories);

  const addedAccessories = proposed.accessories.filter((a) => !currentAcc.has(a));
  const removedAccessories = current.accessories.filter((a) => !proposedAcc.has(a));

  if (addedAccessories.length > 0 || removedAccessories.length > 0) {
    changedFields.push('accessories');
  }

  return {
    changedFields,
    addedAccessories,
    removedAccessories,
    colorChanges,
  };
}

/**
 * Strict server-side validation of an AI DesignProposal
 */
export function validateDesignProposal(
  proposal: DesignProposal,
  currentLook: Look,
  publishedCultureCardSlugs: string[] = []
): ValidateProposalResponse {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Schema Validation
  const schemaParse = DesignProposalSchema.safeParse(proposal);
  if (!schemaParse.success) {
    errors.push(`Hợp đồng DesignProposal không hợp lệ: ${schemaParse.error.message}`);
    return { valid: false, stale: false, errors, warnings };
  }

  // 2. Anti-stale Revision Guard (OCC)
  if (proposal.baseRevision !== currentLook.revision) {
    errors.push(
      `Đề xuất thiết kế bị lỗi thời (Stale): Thiết kế được sinh dựa trên phiên bản v${proposal.baseRevision}, nhưng Look hiện tại đã ở phiên bản v${currentLook.revision}. Vui lòng tạo lại đề xuất.`
    );
    return { valid: false, stale: true, errors, warnings };
  }

  // 3. Target Look Integrity
  if (proposal.targetLookId !== currentLook.id) {
    errors.push(`Mã Look đích (${proposal.targetLookId}) không khớp với Look hiện tại (${currentLook.id})`);
    return { valid: false, stale: false, errors, warnings };
  }

  const { proposedConfig } = proposal;

  // 4. Attribute Locks Enforcement
  // AI MUST NOT overwrite user-locked attributes!
  if (currentLook.locks.primaryColor && proposedConfig.primaryColor.hex !== currentLook.config.primaryColor.hex) {
    errors.push('Màu áo đang bị khóa, đề xuất AI không được phép thay đổi');
  }
  if (currentLook.locks.pantsColor && proposedConfig.pantsColor.hex !== currentLook.config.pantsColor.hex) {
    errors.push('Màu quần đang bị khóa, đề xuất AI không được phép thay đổi');
  }
  if (currentLook.locks.collarStyle && proposedConfig.collarStyle !== currentLook.config.collarStyle) {
    errors.push('Kiểu cổ áo đang bị khóa, đề xuất AI không được phép thay đổi');
  }
  if (currentLook.locks.sleeveStyle && proposedConfig.sleeveStyle !== currentLook.config.sleeveStyle) {
    errors.push('Kiểu tay áo đang bị khóa, đề xuất AI không được phép thay đổi');
  }
  if (currentLook.locks.fabric && proposedConfig.fabric !== currentLook.config.fabric) {
    errors.push('Chất liệu vải đang bị khóa, đề xuất AI không được phép thay đổi');
  }
  if (currentLook.locks.pattern && proposedConfig.pattern !== currentLook.config.pattern) {
    errors.push('Họa tiết đang bị khóa, đề xuất AI không được phép thay đổi');
  }
  if (currentLook.locks.accessories) {
    const currSet = new Set(currentLook.config.accessories);
    const propSet = new Set(proposedConfig.accessories);
    if (currSet.size !== propSet.size || ![...currSet].every((x) => propSet.has(x))) {
      errors.push('Phụ kiện đang bị khóa, đề xuất AI không được phép thay đổi');
    }
  }

  // 5. Body Shape Invariance
  // AI MUST NOT alter user body shape
  if (proposedConfig.bodyShape !== currentLook.config.bodyShape) {
    warnings.push('AI đề xuất đổi vóc dáng nhưng hệ thống tự động bảo toàn vóc dáng của người dùng.');
    proposedConfig.bodyShape = currentLook.config.bodyShape;
  }

  // 6. Capabilities & Catalog Boundary Checks
  if (!VALID_GARMENT_MODELS.includes(proposedConfig.modelId)) {
    errors.push(`Mẫu áo không tồn tại trong danh mục: ${proposedConfig.modelId}`);
  }
  if (!VALID_BODY_SHAPES.includes(proposedConfig.bodyShape)) {
    errors.push(`Vóc dáng không hợp lệ: ${proposedConfig.bodyShape}`);
  }
  if (!VALID_COLLARS.includes(proposedConfig.collarStyle)) {
    errors.push(`Kiểu cổ áo không hỗ trợ: ${proposedConfig.collarStyle}`);
  }
  if (!VALID_SLEEVES.includes(proposedConfig.sleeveStyle)) {
    errors.push(`Kiểu tay áo không hỗ trợ: ${proposedConfig.sleeveStyle}`);
  }
  if (!VALID_FABRICS.includes(proposedConfig.fabric)) {
    errors.push(`Chất liệu vải không hỗ trợ: ${proposedConfig.fabric}`);
  }
  if (!VALID_PATTERNS.includes(proposedConfig.pattern)) {
    errors.push(`Họa tiết không hỗ trợ: ${proposedConfig.pattern}`);
  }
  for (const acc of proposedConfig.accessories) {
    if (!VALID_ACCESSORY_IDS.includes(acc)) {
      errors.push(`Phụ kiện không có trong danh mục 3D: ${acc}`);
    }
  }

  // 7. Cultural Citation Sources Check
  // Citations must reference published cultural cards
  if (proposal.citations && proposal.citations.length > 0 && publishedCultureCardSlugs.length > 0) {
    const allowedSet = new Set(publishedCultureCardSlugs);
    for (const cite of proposal.citations) {
      if (cite.ref && !allowedSet.has(cite.ref)) {
        warnings.push(`Trích dẫn văn hóa '${cite.ref}' chưa nằm trong danh mục đã xuất bản.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    stale: false,
    errors,
    warnings,
    proposal: errors.length === 0 ? proposal : undefined,
  };
}
