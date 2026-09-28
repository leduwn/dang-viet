import {
  type Look,
  type CommandPayload,
  type CommandResult,
  type GarmentConfig,
  type LockState,
  type Color,
  type CollarStyle,
  type SleeveStyle,
  type Fabric,
  type Pattern,
  type EventId,
  type StyleId,
  type BodyShape,
  type GarmentModelId,
  VALID_ACCESSORY_IDS,
  VALID_COLLARS,
  VALID_SLEEVES,
  VALID_FABRICS,
  VALID_PATTERNS,
  VALID_BODY_SHAPES,
  VALID_GARMENT_MODELS,
  GarmentConfigSchema,
} from '@dangviet/contracts';
import { applyRecommendation } from './rules.js';

export function executeCommand(
  currentLook: Look,
  command: CommandPayload
): { ok: true; result: CommandResult } | { ok: false; error: string; statusCode: number; code?: string } {
  // 1. Revision concurrency check
  if (command.expectedRevision !== currentLook.revision) {
    return {
      ok: false,
      code: 'REVISION_CONFLICT',
      error: `Xung đột phiên bản: Lệnh yêu cầu revision ${command.expectedRevision} nhưng phiên bản hiện tại là ${currentLook.revision}. Hãy tải lại trạng thái mới nhất.`,
      statusCode: 409,
    };
  }

  // Pure clones - do NOT mutate currentLook
  const nextConfig: GarmentConfig = {
    ...currentLook.config,
    accessories: [...currentLook.config.accessories],
  };
  const nextLocks: LockState = { ...currentLook.locks };
  let nextTitle = currentLook.title;
  let nextEventId: EventId = currentLook.eventId;
  let nextStyleId: StyleId = currentLook.styleId;
  let nextExplanation = currentLook.explanation;

  const { action, payload } = command;

  switch (action) {
    case 'SET_EVENT': {
      const eventId = payload.eventId as EventId;
      if (!eventId || !['ky_yeu', 'choi_tet', 'ngay_hoi_truong'].includes(eventId)) {
        return { ok: false, error: 'Bối cảnh (eventId) không hợp lệ', statusCode: 400 };
      }
      nextEventId = eventId;
      // Auto recommend when changing event while strictly respecting locks
      const rec = applyRecommendation(nextConfig, nextLocks, nextEventId, nextStyleId);
      Object.assign(nextConfig, rec.config);
      nextExplanation = rec.explanation;
      break;
    }

    case 'SET_STYLE': {
      const styleId = payload.styleId as StyleId;
      if (!styleId || !['thanh_lich', 'tuoi_tre', 'toi_gian'].includes(styleId)) {
        return { ok: false, error: 'Phong cách (styleId) không hợp lệ', statusCode: 400 };
      }
      nextStyleId = styleId;
      // Auto recommend when changing style while strictly respecting locks
      const rec = applyRecommendation(nextConfig, nextLocks, nextEventId, nextStyleId);
      Object.assign(nextConfig, rec.config);
      nextExplanation = rec.explanation;
      break;
    }

    case 'SET_PRIMARY_COLOR': {
      if (nextLocks.primaryColor) {
        return { ok: false, error: 'Màu áo đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const color = payload.color as Color;
      if (!color || !color.hex || !color.name) {
        return { ok: false, error: 'Màu sắc áo không hợp lệ', statusCode: 400 };
      }
      nextConfig.primaryColor = color;
      break;
    }

    case 'SET_PANTS_COLOR': {
      if (nextLocks.pantsColor) {
        return { ok: false, error: 'Màu quần đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const color = payload.color as Color;
      if (!color || !color.hex || !color.name) {
        return { ok: false, error: 'Màu sắc quần không hợp lệ', statusCode: 400 };
      }
      nextConfig.pantsColor = color;
      break;
    }

    case 'SET_COLLAR': {
      if (nextLocks.collarStyle) {
        return { ok: false, error: 'Kiểu cổ áo đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const collar = payload.collarStyle as CollarStyle;
      if (!collar || !VALID_COLLARS.includes(collar)) {
        return { ok: false, error: `Kiểu cổ áo không tồn tại trong danh mục: ${collar}`, statusCode: 400 };
      }
      nextConfig.collarStyle = collar;
      break;
    }

    case 'SET_SLEEVE': {
      if (nextLocks.sleeveStyle) {
        return { ok: false, error: 'Kiểu tay áo đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const sleeve = payload.sleeveStyle as SleeveStyle;
      if (!sleeve || !VALID_SLEEVES.includes(sleeve)) {
        return { ok: false, error: `Kiểu tay áo không tồn tại trong danh mục: ${sleeve}`, statusCode: 400 };
      }
      nextConfig.sleeveStyle = sleeve;
      break;
    }

    case 'SET_FABRIC': {
      if (nextLocks.fabric) {
        return { ok: false, error: 'Chất liệu vải đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const fabric = payload.fabric as Fabric;
      if (!fabric || !VALID_FABRICS.includes(fabric)) {
        return { ok: false, error: `Chất liệu vải không tồn tại trong danh mục: ${fabric}`, statusCode: 400 };
      }
      nextConfig.fabric = fabric;
      break;
    }

    case 'SET_PATTERN': {
      if (nextLocks.pattern) {
        return { ok: false, error: 'Họa tiết đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const pattern = payload.pattern as Pattern;
      if (!pattern || !VALID_PATTERNS.includes(pattern)) {
        return { ok: false, error: `Họa tiết không tồn tại trong danh mục: ${pattern}`, statusCode: 400 };
      }
      nextConfig.pattern = pattern;
      break;
    }

    case 'TOGGLE_ACCESSORY': {
      if (nextLocks.accessories) {
        return { ok: false, error: 'Phụ kiện đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const accessoryId = payload.accessoryId as string;
      if (!accessoryId || !VALID_ACCESSORY_IDS.includes(accessoryId as any)) {
        return { ok: false, error: `Phụ kiện không tồn tại trong danh mục: ${accessoryId}`, statusCode: 400 };
      }
      const index = nextConfig.accessories.indexOf(accessoryId as any);
      if (index >= 0) {
        nextConfig.accessories.splice(index, 1);
      } else {
        nextConfig.accessories.push(accessoryId as any);
      }
      break;
    }

    case 'SET_ACCESSORIES': {
      if (nextLocks.accessories) {
        return { ok: false, error: 'Phụ kiện đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      if (!Array.isArray(payload.accessories)) {
        return { ok: false, error: 'Danh sách phụ kiện không hợp lệ', statusCode: 400 };
      }
      for (const acc of payload.accessories) {
        if (!VALID_ACCESSORY_IDS.includes(acc)) {
          return { ok: false, error: `Phụ kiện không tồn tại trong danh mục: ${acc}`, statusCode: 400 };
        }
      }
      nextConfig.accessories = [...payload.accessories];
      break;
    }

    case 'SET_BODY_SHAPE': {
      if (nextLocks.bodyShape) {
        return { ok: false, error: 'Vóc dáng đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const bodyShape = payload.bodyShape as BodyShape;
      if (!bodyShape || !VALID_BODY_SHAPES.includes(bodyShape)) {
        return { ok: false, error: `Vóc dáng không hợp lệ trong danh mục: ${bodyShape}`, statusCode: 400 };
      }
      nextConfig.bodyShape = bodyShape;
      break;
    }

    case 'SET_GARMENT_MODEL': {
      if (nextLocks.modelId) {
        return { ok: false, error: 'Mẫu áo dài đang bị khóa, không thể thay đổi', statusCode: 400 };
      }
      const modelId = payload.modelId as GarmentModelId;
      if (!modelId || !VALID_GARMENT_MODELS.includes(modelId)) {
        return { ok: false, error: `Mẫu áo dài không hợp lệ trong danh mục: ${modelId}`, statusCode: 400 };
      }
      nextConfig.modelId = modelId;
      break;
    }

    case 'TOGGLE_LOCK': {
      const field = payload.field as keyof LockState;
      if (field in nextLocks) {
        nextLocks[field] = !nextLocks[field];
      } else {
        return { ok: false, error: `Thuộc tính khóa ${String(field)} không tồn tại`, statusCode: 400 };
      }
      break;
    }

    case 'APPLY_PRESET': {
      const presetConfig = payload.config;
      const parse = GarmentConfigSchema.safeParse(presetConfig);
      if (!parse.success) {
        return { ok: false, error: 'Cấu hình preset không hợp lệ theo chuẩn trang phục', statusCode: 400 };
      }
      const validPreset = parse.data;

      // Rule: Always preserve locked attributes! Never bypass locks.
      if (!nextLocks.primaryColor) nextConfig.primaryColor = validPreset.primaryColor;
      if (!nextLocks.pantsColor) nextConfig.pantsColor = validPreset.pantsColor;
      if (!nextLocks.collarStyle) nextConfig.collarStyle = validPreset.collarStyle;
      if (!nextLocks.sleeveStyle) nextConfig.sleeveStyle = validPreset.sleeveStyle;
      if (!nextLocks.fabric) nextConfig.fabric = validPreset.fabric;
      if (!nextLocks.pattern) nextConfig.pattern = validPreset.pattern;
      if (!nextLocks.accessories) nextConfig.accessories = [...validPreset.accessories];
      if (!nextLocks.bodyShape && validPreset.bodyShape) nextConfig.bodyShape = validPreset.bodyShape;
      if (!nextLocks.modelId && validPreset.modelId) nextConfig.modelId = validPreset.modelId;

      if (payload.title) nextTitle = String(payload.title);
      if (payload.explanation) nextExplanation = String(payload.explanation);
      break;
    }

    case 'APPLY_DESIGN': {
      const designConfig = payload.config;
      const parse = GarmentConfigSchema.safeParse(designConfig);
      if (!parse.success) {
        return { ok: false, error: 'Cấu hình thiết kế không hợp lệ theo chuẩn trang phục', statusCode: 400 };
      }
      const validDesign = parse.data;

      // Rule: Always preserve locked attributes! Never bypass locks.
      if (!nextLocks.primaryColor) nextConfig.primaryColor = validDesign.primaryColor;
      if (!nextLocks.pantsColor) nextConfig.pantsColor = validDesign.pantsColor;
      if (!nextLocks.collarStyle) nextConfig.collarStyle = validDesign.collarStyle;
      if (!nextLocks.sleeveStyle) nextConfig.sleeveStyle = validDesign.sleeveStyle;
      if (!nextLocks.fabric) nextConfig.fabric = validDesign.fabric;
      if (!nextLocks.pattern) nextConfig.pattern = validDesign.pattern;
      if (!nextLocks.accessories) nextConfig.accessories = [...validDesign.accessories];
      if (!nextLocks.bodyShape && validDesign.bodyShape) nextConfig.bodyShape = validDesign.bodyShape;
      if (!nextLocks.modelId && validDesign.modelId) nextConfig.modelId = validDesign.modelId;

      if (payload.title) nextTitle = String(payload.title);
      if (payload.explanation) nextExplanation = String(payload.explanation);
      if (payload.eventId) nextEventId = payload.eventId as EventId;
      if (payload.styleId) nextStyleId = payload.styleId as StyleId;
      break;
    }

    case 'RESET_OUTFIT': {
      // Reset to default for current event & style while strictly respecting locked attributes
      const rec = applyRecommendation(nextConfig, nextLocks, nextEventId, nextStyleId);
      Object.assign(nextConfig, rec.config);
      nextExplanation = rec.explanation;
      break;
    }

    default:
      return { ok: false, error: `Hành động không hỗ trợ: ${action}`, statusCode: 400 };
  }

  const newRevision = currentLook.revision + 1;
  const updatedLook: Look = {
    ...currentLook,
    title: nextTitle,
    eventId: nextEventId,
    styleId: nextStyleId,
    config: nextConfig,
    locks: nextLocks,
    explanation: nextExplanation,
    revision: newRevision,
    updatedAt: new Date().toISOString(),
  };

  return {
    ok: true,
    result: {
      success: true,
      look: updatedLook,
      newRevision,
      appliedCommandId: command.commandId,
    },
  };
}
