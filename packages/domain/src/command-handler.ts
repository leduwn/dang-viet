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
} from '@dangviet/contracts';
import { applyRecommendation } from './rules.js';

export function executeCommand(
  currentLook: Look,
  command: CommandPayload
): { ok: true; result: CommandResult } | { ok: false; error: string; statusCode: number } {
  // 1. Revision concurrency check
  if (command.expectedRevision !== currentLook.revision) {
    return {
      ok: false,
      error: `Xung đột phiên bản: Lệnh yêu cầu revision ${command.expectedRevision} nhưng phiên bản hiện tại là ${currentLook.revision}. Hãy làm mới hoặc hoàn tác.`,
      statusCode: 409,
    };
  }

  const nextConfig: GarmentConfig = {
    ...currentLook.config,
    accessories: [...currentLook.config.accessories],
  };
  const nextLocks: LockState = { ...currentLook.locks };
  let nextEventId: EventId = currentLook.eventId;
  let nextStyleId: StyleId = currentLook.styleId;
  let nextExplanation = currentLook.explanation;

  const { action, payload } = command;

  switch (action) {
    case 'SET_EVENT': {
      const eventId = payload.eventId as EventId;
      if (!eventId) {
        return { ok: false, error: 'Thiếu eventId trong payload', statusCode: 400 };
      }
      nextEventId = eventId;
      // Auto recommend when changing event while respecting locks
      const rec = applyRecommendation(nextConfig, nextLocks, nextEventId, nextStyleId);
      Object.assign(nextConfig, rec.config);
      nextExplanation = rec.explanation;
      break;
    }

    case 'SET_STYLE': {
      const styleId = payload.styleId as StyleId;
      if (!styleId) {
        return { ok: false, error: 'Thiếu styleId trong payload', statusCode: 400 };
      }
      nextStyleId = styleId;
      // Auto recommend when changing style while respecting locks
      const rec = applyRecommendation(nextConfig, nextLocks, nextEventId, nextStyleId);
      Object.assign(nextConfig, rec.config);
      nextExplanation = rec.explanation;
      break;
    }

    case 'SET_PRIMARY_COLOR': {
      if (nextLocks.primaryColor && !payload.force) {
        return { ok: false, error: 'Màu áo đang bị khóa', statusCode: 400 };
      }
      const color = payload.color as Color;
      if (!color || !color.hex || !color.name) {
        return { ok: false, error: 'Màu sắc không hợp lệ', statusCode: 400 };
      }
      nextConfig.primaryColor = color;
      break;
    }

    case 'SET_PANTS_COLOR': {
      if (nextLocks.pantsColor && !payload.force) {
        return { ok: false, error: 'Màu quần đang bị khóa', statusCode: 400 };
      }
      const color = payload.color as Color;
      if (!color || !color.hex || !color.name) {
        return { ok: false, error: 'Màu sắc không hợp lệ', statusCode: 400 };
      }
      nextConfig.pantsColor = color;
      break;
    }

    case 'SET_COLLAR': {
      if (nextLocks.collarStyle && !payload.force) {
        return { ok: false, error: 'Kiểu cổ áo đang bị khóa', statusCode: 400 };
      }
      nextConfig.collarStyle = payload.collarStyle as CollarStyle;
      break;
    }

    case 'SET_SLEEVE': {
      if (nextLocks.sleeveStyle && !payload.force) {
        return { ok: false, error: 'Kiểu tay áo đang bị khóa', statusCode: 400 };
      }
      nextConfig.sleeveStyle = payload.sleeveStyle as SleeveStyle;
      break;
    }

    case 'SET_FABRIC': {
      if (nextLocks.fabric && !payload.force) {
        return { ok: false, error: 'Chất liệu vải đang bị khóa', statusCode: 400 };
      }
      nextConfig.fabric = payload.fabric as Fabric;
      break;
    }

    case 'SET_PATTERN': {
      if (nextLocks.pattern && !payload.force) {
        return { ok: false, error: 'Họa tiết đang bị khóa', statusCode: 400 };
      }
      nextConfig.pattern = payload.pattern as Pattern;
      break;
    }

    case 'TOGGLE_ACCESSORY': {
      if (nextLocks.accessories && !payload.force) {
        return { ok: false, error: 'Phụ kiện đang bị khóa', statusCode: 400 };
      }
      const accessoryId = payload.accessoryId as string;
      if (!accessoryId) {
        return { ok: false, error: 'Thiếu accessoryId', statusCode: 400 };
      }
      const index = nextConfig.accessories.indexOf(accessoryId);
      if (index >= 0) {
        nextConfig.accessories.splice(index, 1);
      } else {
        nextConfig.accessories.push(accessoryId);
      }
      break;
    }

    case 'SET_ACCESSORIES': {
      if (nextLocks.accessories && !payload.force) {
        return { ok: false, error: 'Phụ kiện đang bị khóa', statusCode: 400 };
      }
      if (!Array.isArray(payload.accessories)) {
        return { ok: false, error: 'Danh sách phụ kiện không hợp lệ', statusCode: 400 };
      }
      nextConfig.accessories = [...payload.accessories];
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
      const presetConfig = payload.config as GarmentConfig;
      if (!presetConfig) {
        return { ok: false, error: 'Thiếu cấu hình preset', statusCode: 400 };
      }
      // Apply preset values, keeping locked ones if not forced
      if (!nextLocks.primaryColor || payload.force) nextConfig.primaryColor = presetConfig.primaryColor;
      if (!nextLocks.pantsColor || payload.force) nextConfig.pantsColor = presetConfig.pantsColor;
      if (!nextLocks.collarStyle || payload.force) nextConfig.collarStyle = presetConfig.collarStyle;
      if (!nextLocks.sleeveStyle || payload.force) nextConfig.sleeveStyle = presetConfig.sleeveStyle;
      if (!nextLocks.fabric || payload.force) nextConfig.fabric = presetConfig.fabric;
      if (!nextLocks.pattern || payload.force) nextConfig.pattern = presetConfig.pattern;
      if (!nextLocks.accessories || payload.force) nextConfig.accessories = [...presetConfig.accessories];

      if (payload.title) currentLook.title = payload.title;
      if (payload.explanation) nextExplanation = payload.explanation;
      break;
    }

    case 'APPLY_DESIGN': {
      const designConfig = payload.config as GarmentConfig;
      if (!designConfig) {
        return { ok: false, error: 'Thiếu cấu hình thiết kế', statusCode: 400 };
      }
      Object.assign(nextConfig, designConfig);
      if (payload.title) currentLook.title = payload.title;
      if (payload.explanation) nextExplanation = payload.explanation;
      break;
    }

    case 'RESET_OUTFIT': {
      // Reset to default for current event & style while respecting locked attributes
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
