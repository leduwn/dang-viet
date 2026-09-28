import { randomUUID } from 'node:crypto';
import {
  type Look,
  type CommandPayload,
  type GarmentConfig,
  type Color,
  type CollarStyle,
  type SleeveStyle,
  type Fabric,
  type Pattern,
  type AccessoryId,
  VALID_ACCESSORY_IDS,
  VALID_COLLARS,
  VALID_SLEEVES,
  VALID_FABRICS,
  VALID_PATTERNS,
  GarmentConfigSchema,
  ColorSchema,
} from '@dangviet/contracts';

export interface ParsedChatResult {
  reply: string;
  explanation?: string;
  commands: CommandPayload[];
  citations?: Array<{ title: string; source: string; ref: string }>;
}

export function extractJsonFromText(rawText: string): any | null {
  if (!rawText) return null;

  // 1. Try markdown ```json ... ``` block
  const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (jsonMatch && jsonMatch[1]) {
    try {
      return JSON.parse(jsonMatch[1]);
    } catch {}
  }

  // 2. Try raw outer curly braces
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(rawText.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  return null;
}

/**
 * Strict parser for AI Model chat response
 * Validates domain constraints, locks, catalogs, and revision sequencing.
 */
export function parseModelChatOutput(rawText: string, currentLook: Look): ParsedChatResult {
  const json = extractJsonFromText(rawText);

  // If output is not JSON, treat it strictly as pure conversational reply
  if (!json || typeof json !== 'object') {
    return {
      reply: rawText.trim(),
      commands: [],
    };
  }

  const reply = typeof json.reply === 'string' && json.reply.trim().length > 0
    ? json.reply.trim()
    : (typeof json.message === 'string' ? json.message.trim() : rawText.trim());
  const explanation = typeof json.explanation === 'string' ? json.explanation.trim() : undefined;

  const commands: CommandPayload[] = [];
  const rawActions = Array.isArray(json.actions) ? json.actions : [];

  // Limit max actions per turn to 3 to prevent malicious or runaway commands
  const boundedActions = rawActions.slice(0, 3);
  let nextExpectedRev = currentLook.revision;

  for (const item of boundedActions) {
    if (!item || typeof item !== 'object' || !item.action || !item.payload) {
      continue;
    }

    const { action, payload } = item;

    // Strict Lock and Catalog enforcement for model-suggested actions:
    switch (action) {
      case 'SET_PRIMARY_COLOR': {
        if (currentLook.locks.primaryColor) continue;
        const parse = ColorSchema.safeParse(payload.color);
        if (!parse.success) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_PRIMARY_COLOR',
          payload: { color: parse.data },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_PANTS_COLOR': {
        if (currentLook.locks.pantsColor) continue;
        const parse = ColorSchema.safeParse(payload.color);
        if (!parse.success) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_PANTS_COLOR',
          payload: { color: parse.data },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_COLLAR': {
        if (currentLook.locks.collarStyle) continue;
        const collar = payload.collarStyle as CollarStyle;
        if (!VALID_COLLARS.includes(collar)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_COLLAR',
          payload: { collarStyle: collar },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_SLEEVE': {
        if (currentLook.locks.sleeveStyle) continue;
        const sleeve = payload.sleeveStyle as SleeveStyle;
        if (!VALID_SLEEVES.includes(sleeve)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_SLEEVE',
          payload: { sleeveStyle: sleeve },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_FABRIC': {
        if (currentLook.locks.fabric) continue;
        const fabric = payload.fabric as Fabric;
        if (!VALID_FABRICS.includes(fabric)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_FABRIC',
          payload: { fabric },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_PATTERN': {
        if (currentLook.locks.pattern) continue;
        const pattern = payload.pattern as Pattern;
        if (!VALID_PATTERNS.includes(pattern)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_PATTERN',
          payload: { pattern },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'TOGGLE_ACCESSORY': {
        if (currentLook.locks.accessories) continue;
        const acc = payload.accessoryId as AccessoryId;
        if (!VALID_ACCESSORY_IDS.includes(acc)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'TOGGLE_ACCESSORY',
          payload: { accessoryId: acc },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_ACCESSORIES': {
        if (currentLook.locks.accessories) continue;
        if (!Array.isArray(payload.accessories)) continue;
        const validAccs = payload.accessories.filter((a: any) => VALID_ACCESSORY_IDS.includes(a));
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_ACCESSORIES',
          payload: { accessories: validAccs },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_EVENT': {
        if (!['ky_yeu', 'choi_tet', 'ngay_hoi_truong'].includes(payload.eventId)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_EVENT',
          payload: { eventId: payload.eventId },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'SET_STYLE': {
        if (!['thanh_lich', 'tuoi_tre', 'toi_gian'].includes(payload.styleId)) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'SET_STYLE',
          payload: { styleId: payload.styleId },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'APPLY_DESIGN': {
        const parse = GarmentConfigSchema.safeParse(payload.config);
        if (!parse.success) continue;
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'APPLY_DESIGN',
          payload: {
            config: parse.data,
            title: typeof payload.title === 'string' ? payload.title : 'Thiết kế AI đề xuất',
            explanation: typeof payload.explanation === 'string' ? payload.explanation : explanation,
          },
          timestamp: new Date().toISOString(),
        });
        break;
      }

      case 'RESET_OUTFIT': {
        commands.push({
          commandId: randomUUID(),
          lookId: currentLook.id,
          expectedRevision: nextExpectedRev++,
          action: 'RESET_OUTFIT',
          payload: {},
          timestamp: new Date().toISOString(),
        });
        break;
      }
    }
  }

  return {
    reply,
    explanation,
    commands,
  };
}

/**
 * Strict parser for AI Model structured design generation
 */
export function parseModelDesignOutput(
  rawText: string,
  fallbackPrompt: string
): { config: GarmentConfig; title: string; explanation: string } | null {
  const json = extractJsonFromText(rawText);
  if (!json || typeof json !== 'object') {
    return null;
  }

  const title = typeof json.title === 'string' && json.title.trim().length > 0
    ? json.title.trim()
    : `Thiết kế: ${fallbackPrompt.slice(0, 30)}`;

  const explanation = typeof json.explanation === 'string' && json.explanation.trim().length > 0
    ? json.explanation.trim()
    : 'Thiết kế Việt phục sáng tạo kết hợp hoa văn và sắc màu đương đại.';

  const parse = GarmentConfigSchema.safeParse(json.config);
  if (!parse.success) {
    return null;
  }

  return {
    title,
    explanation,
    config: parse.data,
  };
}
