import {
  type EventId,
  type StyleId,
  type GarmentConfig,
  type LockState,
  type Color,
  type AccessoryId,
  type CollarStyle,
  type SleeveStyle,
  type Fabric,
  type Pattern,
} from '@dangviet/contracts';

export interface StyleRule {
  eventId: EventId;
  styleId: StyleId;
  recommendedCollars: CollarStyle[];
  recommendedSleeves: SleeveStyle[];
  recommendedFabrics: Fabric[];
  recommendedPatterns: Pattern[];
  recommendedAccessories: AccessoryId[];
  recommendedColors: { primary: Color; pants: Color }[];
  aestheticRationale: string;
}

export const STYLE_RULES: StyleRule[] = [
  // 1. Chụp ảnh kỷ yếu
  {
    eventId: 'ky_yeu',
    styleId: 'thanh_lich',
    recommendedCollars: ['traditional_high', 'round'],
    recommendedSleeves: ['traditional_long', 'raglan'],
    recommendedFabrics: ['silk_ha_dong'],
    recommendedPatterns: ['plain', 'lotus'],
    recommendedAccessories: ['chuoi_ngoc', 'non_la'],
    recommendedColors: [
      {
        primary: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
        pants: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
      },
      {
        primary: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
        pants: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
      },
    ],
    aestheticRationale: 'Nữ sinh chụp kỷ yếu ưu tiên phom dáng chuẩn mực, cổ cao kín đáo và sắc trắng sứ thuần khiết nhằm lưu giữ nét đẹp thanh xuân nguyên bản.',
  },
  {
    eventId: 'ky_yeu',
    styleId: 'tuoi_tre',
    recommendedCollars: ['boat', 'round'],
    recommendedSleeves: ['raglan', 'elbow'],
    recommendedFabrics: ['voile_chiffon', 'silk_ha_dong'],
    recommendedPatterns: ['plain', 'lotus'],
    recommendedAccessories: ['quat_xep', 'tui_coi'],
    recommendedColors: [
      {
        primary: { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' },
        pants: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
      },
      {
        primary: { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' },
        pants: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
      },
    ],
    aestheticRationale: 'Tạo dấu ấn cá tính trong bộ ảnh kỷ yếu bằng các gam pastel thiên thanh hoặc hồng phấn nhẹ, tà áo voan bay bổng khi chuyển động ngoài sân trường.',
  },
  {
    eventId: 'ky_yeu',
    styleId: 'toi_gian',
    recommendedCollars: ['round', 'traditional_high'],
    recommendedSleeves: ['traditional_long'],
    recommendedFabrics: ['linen_modern', 'silk_ha_dong'],
    recommendedPatterns: ['plain'],
    recommendedAccessories: ['non_la'],
    recommendedColors: [
      {
        primary: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
        pants: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' },
      },
    ],
    aestheticRationale: 'Phối áo trắng cùng quần đen gợi nhớ tà áo dài nữ sinh Sài Gòn, Hà Nội đầu thế kỷ 20, đường cắt tối giản không phụ kiện rườm rà.',
  },

  // 2. Đi chơi Tết
  {
    eventId: 'choi_tet',
    styleId: 'thanh_lich',
    recommendedCollars: ['traditional_high'],
    recommendedSleeves: ['traditional_long', 'raglan'],
    recommendedFabrics: ['brocade_hue', 'silk_ha_dong'],
    recommendedPatterns: ['cloud', 'lotus'],
    recommendedAccessories: ['man_truyen_thong', 'quat_xep'],
    recommendedColors: [
      {
        primary: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' },
        pants: { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' },
      },
      {
        primary: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' },
        pants: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
      },
    ],
    aestheticRationale: 'Dạo xuân ngày đầu năm mang đậm không khí tưng bừng với gấm dệt vân mây, sắc đỏ son và vàng hoàng yến mang lại cát tường, an khang.',
  },
  {
    eventId: 'choi_tet',
    styleId: 'tuoi_tre',
    recommendedCollars: ['boat', 'round'],
    recommendedSleeves: ['elbow', 'slit'],
    recommendedFabrics: ['silk_ha_dong', 'voile_chiffon'],
    recommendedPatterns: ['crane', 'plain'],
    recommendedAccessories: ['quat_xep', 'tui_coi'],
    recommendedColors: [
      {
        primary: { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow' },
        pants: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
      },
      {
        primary: { hex: '#D1495B', name: 'Đỏ thắm hoa đào', family: 'red' },
        pants: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
      },
    ],
    aestheticRationale: 'Phong cách Tết năng động cho các buổi chúc Tết bạn bè, tay lửng thoải mái di chuyển và phụ kiện túi cói mộc mạc hợp trào lưu Gen Z.',
  },
  {
    eventId: 'choi_tet',
    styleId: 'toi_gian',
    recommendedCollars: ['round'],
    recommendedSleeves: ['traditional_long'],
    recommendedFabrics: ['linen_modern'],
    recommendedPatterns: ['plain'],
    recommendedAccessories: ['tui_coi', 'guoc_moc'],
    recommendedColors: [
      {
        primary: { hex: '#1F4E5B', name: 'Xanh cố đô trầm', family: 'blue' },
        pants: { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black' },
      },
      {
        primary: { hex: '#6E473B', name: 'Nâu đất phù sa', family: 'neutral' },
        pants: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
      },
    ],
    aestheticRationale: 'Đi lễ chùa thanh tịnh với tông xanh cố đô hoặc nâu trầm mộc mạc, chất liệu đũi tự nhiên tạo cảm giác thư thái và an yên.',
  },

  // 3. Ngày hội trường
  {
    eventId: 'ngay_hoi_truong',
    styleId: 'thanh_lich',
    recommendedCollars: ['traditional_high'],
    recommendedSleeves: ['traditional_long', 'raglan'],
    recommendedFabrics: ['brocade_hue'],
    recommendedPatterns: ['cloud', 'lotus'],
    recommendedAccessories: ['man_truyen_thong', 'quat_xep'],
    recommendedColors: [
      {
        primary: { hex: '#1F4E5B', name: 'Xanh cố đô trầm', family: 'blue' },
        pants: { hex: '#F4D06F', name: 'Vàng mỡ gà', family: 'yellow' },
      },
      {
        primary: { hex: '#5D3A68', name: 'Tím huế trầm', family: 'purple' },
        pants: { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' },
      },
    ],
    aestheticRationale: 'Trình diễn văn hóa trường học đòi hỏi diện mạo trang trọng, kết hợp gấm Huế hoa văn vân mây gợi nhớ nét đẹp cung đình rạng rỡ.',
  },
  {
    eventId: 'ngay_hoi_truong',
    styleId: 'tuoi_tre',
    recommendedCollars: ['v_neck', 'boat'],
    recommendedSleeves: ['slit', 'elbow'],
    recommendedFabrics: ['voile_chiffon'],
    recommendedPatterns: ['geometric_genz'],
    recommendedAccessories: ['quat_xep', 'tui_coi'],
    recommendedColors: [
      {
        primary: { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' },
        pants: { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink' },
      },
      {
        primary: { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red' },
        pants: { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue' },
      },
    ],
    aestheticRationale: 'Bản sắc Việt phục Remix: phối màu color-block tương phản mạnh mẽ, cổ chữ V và tay xẻ tôn nét tự tin phá cách của thế hệ trẻ.',
  },
  {
    eventId: 'ngay_hoi_truong',
    styleId: 'toi_gian',
    recommendedCollars: ['round'],
    recommendedSleeves: ['elbow'],
    recommendedFabrics: ['linen_modern'],
    recommendedPatterns: ['plain'],
    recommendedAccessories: ['tui_coi', 'guoc_moc'],
    recommendedColors: [
      {
        primary: { hex: '#6E473B', name: 'Nâu đất phù sa', family: 'neutral' },
        pants: { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white' },
      },
    ],
    aestheticRationale: 'Tôn vinh nguồn cội lao động qua sắc nâu đất phù sa và vải đũi mộc mạc, đưa văn hóa dân gian gần gũi vào không gian học đường.',
  },
];

export function getRuleFor(eventId: EventId, styleId: StyleId): StyleRule {
  const match = STYLE_RULES.find((r) => r.eventId === eventId && r.styleId === styleId);
  if (match) return match;
  return STYLE_RULES[0];
}

/**
 * Apply styling rules with Respect for Locked attributes
 */
export function applyRecommendation(
  currentConfig: GarmentConfig,
  locks: LockState,
  eventId: EventId,
  styleId: StyleId
): { config: GarmentConfig; explanation: string } {
  const rule = getRuleFor(eventId, styleId);
  const colorPair = rule.recommendedColors[0];

  const newConfig: GarmentConfig = {
    garmentType: 'aodai',
    primaryColor: locks.primaryColor ? currentConfig.primaryColor : colorPair.primary,
    pantsColor: locks.pantsColor ? currentConfig.pantsColor : colorPair.pants,
    collarStyle: locks.collarStyle ? currentConfig.collarStyle : (rule.recommendedCollars[0] as any),
    sleeveStyle: locks.sleeveStyle ? currentConfig.sleeveStyle : (rule.recommendedSleeves[0] as any),
    fabric: locks.fabric ? currentConfig.fabric : (rule.recommendedFabrics[0] as any),
    pattern: locks.pattern ? currentConfig.pattern : (rule.recommendedPatterns[0] as any),
    accessories: locks.accessories ? currentConfig.accessories : [...rule.recommendedAccessories],
    bodyShape: locks.bodyShape ? currentConfig.bodyShape : (currentConfig.bodyShape || 'standard'),
    modelId: locks.modelId ? currentConfig.modelId : (currentConfig.modelId || 'aodai_classic_01'),
  };

  return {
    config: newConfig,
    explanation: rule.aestheticRationale,
  };
}
