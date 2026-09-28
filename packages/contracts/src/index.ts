import { z } from 'zod';

// ==========================================
// 1. Color and Garment Config Schemas
// ==========================================

export const ColorSchema = z.object({
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Mã màu hex không hợp lệ'),
  name: z.string().min(1, 'Tên màu không được để trống'),
  family: z.enum(['red', 'blue', 'green', 'yellow', 'white', 'black', 'pink', 'purple', 'neutral', 'pastel']).default('neutral'),
});
export type Color = z.infer<typeof ColorSchema>;

export const VALID_ACCESSORY_IDS = [
  'man_truyen_thong',
  'non_la',
  'chuoi_ngoc',
  'quat_xep',
  'tui_coi',
  'guoc_moc',
] as const;
export type AccessoryId = typeof VALID_ACCESSORY_IDS[number];
export const AccessoryIdEnum = z.enum(VALID_ACCESSORY_IDS);

export const AccessoryItemSchema = z.object({
  id: AccessoryIdEnum,
  name: z.string(),
  category: z.enum(['headwear', 'jewelry', 'handheld', 'footwear', 'bag']),
  description: z.string(),
  culturalNote: z.string().optional(),
});
export type AccessoryItem = z.infer<typeof AccessoryItemSchema>;

export const VALID_COLLARS = ['traditional_high', 'round', 'boat', 'v_neck'] as const;
export const CollarStyleEnum = z.enum(VALID_COLLARS);
export type CollarStyle = z.infer<typeof CollarStyleEnum>;

export const VALID_SLEEVES = ['traditional_long', 'raglan', 'elbow', 'slit'] as const;
export const SleeveStyleEnum = z.enum(VALID_SLEEVES);
export type SleeveStyle = z.infer<typeof SleeveStyleEnum>;

export const VALID_FABRICS = ['silk_ha_dong', 'brocade_hue', 'voile_chiffon', 'linen_modern'] as const;
export const FabricEnum = z.enum(VALID_FABRICS);
export type Fabric = z.infer<typeof FabricEnum>;

export const VALID_PATTERNS = ['plain', 'lotus', 'cloud', 'crane', 'geometric_genz'] as const;
export const PatternEnum = z.enum(VALID_PATTERNS);
export type Pattern = z.infer<typeof PatternEnum>;

export const GarmentConfigSchema = z.object({
  garmentType: z.literal('aodai').default('aodai'),
  primaryColor: ColorSchema,
  pantsColor: ColorSchema,
  collarStyle: CollarStyleEnum.default('traditional_high'),
  sleeveStyle: SleeveStyleEnum.default('traditional_long'),
  fabric: FabricEnum.default('silk_ha_dong'),
  pattern: PatternEnum.default('plain'),
  accessories: z.array(AccessoryIdEnum).default([]),
});
export type GarmentConfig = z.infer<typeof GarmentConfigSchema>;

export const LockStateSchema = z.object({
  primaryColor: z.boolean().default(false),
  pantsColor: z.boolean().default(false),
  collarStyle: z.boolean().default(false),
  sleeveStyle: z.boolean().default(false),
  fabric: z.boolean().default(false),
  pattern: z.boolean().default(false),
  accessories: z.boolean().default(false),
});
export type LockState = z.infer<typeof LockStateSchema>;

// ==========================================
// 2. Events & Styles
// ==========================================

export const EventIdEnum = z.enum(['ky_yeu', 'choi_tet', 'ngay_hoi_truong']);
export type EventId = z.infer<typeof EventIdEnum>;

export const StyleIdEnum = z.enum(['thanh_lich', 'tuoi_tre', 'toi_gian']);
export type StyleId = z.infer<typeof StyleIdEnum>;

export const EventItemSchema = z.object({
  id: EventIdEnum,
  name: z.string(),
  description: z.string(),
  culturalContext: z.string(),
  recommendedStyles: z.array(StyleIdEnum),
  colorPalettes: z.array(z.string()),
});
export type EventItem = z.infer<typeof EventItemSchema>;

export const StyleItemSchema = z.object({
  id: StyleIdEnum,
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
});
export type StyleItem = z.infer<typeof StyleItemSchema>;

// ==========================================
// 3. Look & Lookbook
// ==========================================

export const LookSchema = z.object({
  id: z.string(),
  title: z.string(),
  eventId: EventIdEnum,
  styleId: StyleIdEnum,
  config: GarmentConfigSchema,
  locks: LockStateSchema,
  explanation: z.string().default(''),
  revision: z.number().int().min(1).default(1),
  isDesign: z.boolean().default(false),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Look = z.infer<typeof LookSchema>;

export const LookbookItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  lookId: z.string(),
  revision: z.number().int(),
  snapshotConfig: GarmentConfigSchema,
  eventId: EventIdEnum,
  styleId: StyleIdEnum,
  notes: z.string().default(''),
  createdAt: z.string(),
});
export type LookbookItem = z.infer<typeof LookbookItemSchema>;

// ==========================================
// 4. Command Architecture
// ==========================================

export const CommandActionEnum = z.enum([
  'SET_EVENT',
  'SET_STYLE',
  'SET_PRIMARY_COLOR',
  'SET_PANTS_COLOR',
  'SET_COLLAR',
  'SET_SLEEVE',
  'SET_FABRIC',
  'SET_PATTERN',
  'TOGGLE_ACCESSORY',
  'SET_ACCESSORIES',
  'TOGGLE_LOCK',
  'APPLY_PRESET',
  'RESET_OUTFIT',
  'APPLY_DESIGN',
]);
export type CommandAction = z.infer<typeof CommandActionEnum>;

export const CommandPayloadSchema = z.object({
  commandId: z.string().uuid(),
  lookId: z.string(),
  expectedRevision: z.number().int(),
  action: CommandActionEnum,
  payload: z.record(z.any()),
  timestamp: z.string(),
});
export type CommandPayload = z.infer<typeof CommandPayloadSchema>;

export const CommandResultSchema = z.object({
  success: z.boolean(),
  look: LookSchema,
  newRevision: z.number().int(),
  appliedCommandId: z.string(),
  error: z.string().optional(),
});
export type CommandResult = z.infer<typeof CommandResultSchema>;

// ==========================================
// 5. Culture Cards (Verified Cultural Sources)
// ==========================================

export const CultureCardStatusEnum = z.enum(['published', 'review', 'draft']);
export type CultureCardStatus = z.infer<typeof CultureCardStatusEnum>;

export const CultureCardSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  category: z.enum(['lich_su', 'bieu_tuong', 'chat_lieu', 'phu_kien', 'nghi_thuc']),
  summary: z.string(),
  content: z.string(),
  sourceName: z.string(),
  sourceAuthor: z.string(),
  sourceUrl: z.string().optional(),
  sourceEvidence: z.string(),
  status: CultureCardStatusEnum.default('published'),
  createdAt: z.string(),
});
export type CultureCard = z.infer<typeof CultureCardSchema>;

// ==========================================
// 6. AI Adapter Contracts
// ==========================================

export const AIStatusSchema = z.object({
  configured: z.boolean(),
  mode: z.enum(['mock', 'live']),
  provider: z.string(),
  model: z.string(),
  capabilities: z.object({
    textChat: z.boolean(),
    structuredCommands: z.boolean(),
    imageGen: z.boolean(),
  }),
  message: z.string().optional(),
});
export type AIStatus = z.infer<typeof AIStatusSchema>;

export const AIChatRequestSchema = z.object({
  lookId: z.string(),
  message: z.string().min(1, 'Tin nhắn không được để trống'),
  history: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
    })
  ).default([]),
});
export type AIChatRequest = z.infer<typeof AIChatRequestSchema>;

export const AICitationSchema = z.object({
  title: z.string(),
  source: z.string(),
  ref: z.string(),
});
export type AICitation = z.infer<typeof AICitationSchema>;

export const AIChatResponseSchema = z.object({
  reply: z.string(),
  explanation: z.string().optional(),
  commands: z.array(CommandPayloadSchema).optional(),
  citations: z.array(AICitationSchema).optional(),
  suggestedActionLabel: z.string().optional(),
  mode: z.enum(['mock', 'live']).optional(),
  model: z.string().optional(),
});
export type AIChatResponse = z.infer<typeof AIChatResponseSchema>;

export const StructuredDesignRequestSchema = z.object({
  prompt: z.string(),
  eventId: EventIdEnum,
  styleId: StyleIdEnum,
  baseLookId: z.string().optional(),
});
export type StructuredDesignRequest = z.infer<typeof StructuredDesignRequestSchema>;

export const ConceptTaskSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  status: z.enum(['pending', 'processing', 'completed', 'failed']),
  imageUrl: z.string().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
});
export type ConceptTask = z.infer<typeof ConceptTaskSchema>;
