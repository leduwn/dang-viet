import {
  type Look,
  type Color,
  type CollarStyle,
  type SleeveStyle,
  type Fabric,
  type Pattern,
  type AccessoryId,
  type GarmentModelId,
  type GarmentConfig,
  type AIImageStylePreset,
  type AIImageParsedDetails,
  getModelCapability,
} from '@dangviet/contracts';

// Curated color palette dictionary with Vietnamese keywords and hex mappings
interface ColorEntry {
  hex: string;
  name: string;
  family: Color['family'];
  keywords: string[];
}

const COLOR_DICTIONARY: ColorEntry[] = [
  { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green', keywords: ['xanh ngọc', 'ngọc bích', 'ngọc', 'xanh ngọc bích'] },
  { hex: '#70A9A1', name: 'Xanh thiên thanh', family: 'blue', keywords: ['xanh thiên thanh', 'thiên thanh', 'xanh da trời', 'xanh nhạt'] },
  { hex: '#1F4E5B', name: 'Xanh cố đô trầm', family: 'blue', keywords: ['xanh cố đô', 'xanh đậm', 'xanh dương', 'xanh navy', 'xanh lam', 'lam'] },
  { hex: '#E8A598', name: 'Hồng sen phấn', family: 'pink', keywords: ['hồng sen', 'sen phấn', 'hồng phấn', 'hồng', 'màu hồng'] },
  { hex: '#B83A24', name: 'Đỏ son hoàng gia', family: 'red', keywords: ['đỏ son', 'đỏ hoàng gia', 'đỏ nhung', 'đỏ', 'màu đỏ', 'đỏ tươi'] },
  { hex: '#E5A93C', name: 'Vàng hoàng yến', family: 'yellow', keywords: ['vàng hoàng yến', 'vàng tươi', 'vàng óng', 'vàng', 'màu vàng'] },
  { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white', keywords: ['trắng tinh khôi', 'trắng tinh', 'trắng sáng', 'trắng', 'màu trắng'] },
  { hex: '#F8F5EE', name: 'Trắng sứ ngà', family: 'white', keywords: ['trắng sứ', 'trắng ngà', 'màu kem', 'be'] },
  { hex: '#1E1B18', name: 'Đen tuyền dạ hội', family: 'black', keywords: ['đen tuyền', 'đen dạ hội', 'đen huyền', 'đen', 'màu đen'] },
  { hex: '#5D3A68', name: 'Tím huế trầm', family: 'purple', keywords: ['tím huế', 'tím', 'màu tím', 'tím hoa cà'] },
];

/**
 * Match a color from text given an optional preference context (e.g. for pants vs shirt).
 */
function extractColorFromText(text: string, contextTarget: 'shirt' | 'pants'): Color | null {
  const lower = text.toLowerCase();

  // If looking specifically for pants color
  if (contextTarget === 'pants') {
    const pantsMatch = lower.match(/quần\s+(?:màu\s+)?([a-zà-ỹ\s]+?)(?:,|$|\.|\bcổ\b|\btay\b|\bvải\b|\bchất\b|\bhoa\b)/i);
    if (pantsMatch) {
      const segment = pantsMatch[1].trim();
      for (const entry of COLOR_DICTIONARY) {
        if (entry.keywords.some((kw) => segment.includes(kw))) {
          return { hex: entry.hex, name: entry.name, family: entry.family };
        }
      }
    }
  }

  // If looking for shirt color
  if (contextTarget === 'shirt') {
    const shirtMatch = lower.match(/(?:áo|áo dài)\s+(?:màu\s+)?([a-zà-ỹ\s]+?)(?:,|$|\.|\bquần\b|\bcổ\b|\btay\b|\bvải\b|\bchất\b|\bhoa\b)/i);
    if (shirtMatch) {
      const segment = shirtMatch[1].trim();
      for (const entry of COLOR_DICTIONARY) {
        if (entry.keywords.some((kw) => segment.includes(kw))) {
          return { hex: entry.hex, name: entry.name, family: entry.family };
        }
      }
    }
  }

  // General fallback search
  for (const entry of COLOR_DICTIONARY) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { hex: entry.hex, name: entry.name, family: entry.family };
    }
  }

  return null;
}

/**
 * Stage 1: Parse Vietnamese natural description into normalized structured configuration.
 * Adheres strictly to locked attributes in baseLook and domain model capabilities.
 */
export function parseImagePrompt(
  inputPrompt: string,
  baseLook?: Look,
  selectedStyle?: AIImageStylePreset,
  customConfig?: GarmentConfig
): AIImageParsedDetails {
  const text = inputPrompt.toLowerCase();
  const warnings: string[] = [];
  const unsupportedRequests: string[] = [];
  const preservedLocks: string[] = [];
  const refConfig = baseLook?.config || customConfig;

  // 1. Model detection: Traditional vs Remix Raglan
  let garmentModel: GarmentModelId = 'aodai_traditional_v2';
  if (text.includes('cách tân') || text.includes('remix') || text.includes('ngắn tà') || text.includes('tà lửng')) {
    garmentModel = 'aodai_remix_raglan';
  } else if (refConfig?.modelId) {
    garmentModel = refConfig.modelId;
  }

  const capability = getModelCapability(garmentModel);

  // 2. Collar Style
  let collarStyle: CollarStyle = 'traditional_high';
  if (text.includes('cổ tròn')) {
    collarStyle = 'round';
  } else if (text.includes('cổ thuyền')) {
    collarStyle = 'boat';
  } else if (text.includes('cổ chữ v') || text.includes('cổ v')) {
    collarStyle = 'v_neck';
  } else if (text.includes('cổ cao') || text.includes('cổ đứng') || text.includes('cổ trụ') || text.includes('cổ 4.2cm')) {
    collarStyle = 'traditional_high';
  } else if (refConfig?.collarStyle) {
    collarStyle = refConfig.collarStyle;
  }

  // Collar capability validation
  if (!capability.supportedCollars.includes(collarStyle)) {
    unsupportedRequests.push(
      capability.incompatibleOptionMessages[collarStyle] ||
        `Mẫu ${capability.name} không hỗ trợ kiểu cổ ${collarStyle}. Tự động áp dụng cổ tương thích.`
    );
    collarStyle = capability.supportedCollars[0];
  }

  // Collar lock check
  if (baseLook?.locks.collarStyle) {
    collarStyle = baseLook.config.collarStyle;
    preservedLocks.push('collarStyle');
    warnings.push('Kiểu cổ áo đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // 3. Sleeve Style
  let sleeveStyle: SleeveStyle = 'traditional_long';
  if (text.includes('tay raglan') || text.includes('raglan')) {
    sleeveStyle = 'raglan';
  } else if (text.includes('tay lửng') || text.includes('tay 3/4') || text.includes('tay cộc')) {
    sleeveStyle = 'elbow';
  } else if (text.includes('tay xẻ') || text.includes('xẻ tà tay')) {
    sleeveStyle = 'slit';
  } else if (text.includes('tay dài') || text.includes('dài tay')) {
    sleeveStyle = 'traditional_long';
  } else if (refConfig?.sleeveStyle) {
    sleeveStyle = refConfig.sleeveStyle;
  }

  // Sleeve capability validation
  if (!capability.supportedSleeves.includes(sleeveStyle)) {
    unsupportedRequests.push(
      capability.incompatibleOptionMessages[sleeveStyle] ||
        `Mẫu ${capability.name} không hỗ trợ kiểu tay ${sleeveStyle}. Tự động áp dụng tay tương thích.`
    );
    sleeveStyle = capability.supportedSleeves[0];
  }

  // Sleeve lock check
  if (baseLook?.locks.sleeveStyle) {
    sleeveStyle = baseLook.config.sleeveStyle;
    preservedLocks.push('sleeveStyle');
    warnings.push('Kiểu tay áo đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // 4. Fabric
  let fabric: Fabric = 'silk_ha_dong';
  if (text.includes('gấm') || text.includes('gấm huế') || text.includes('dệt nổi')) {
    fabric = 'brocade_hue';
  } else if (text.includes('voan') || text.includes('tơ voan') || text.includes('trong mờ') || text.includes('chiffon')) {
    fabric = 'voile_chiffon';
  } else if (text.includes('đũi') || text.includes('linen') || text.includes('vải đũi') || text.includes('thô mộc')) {
    fabric = 'linen_modern';
  } else if (text.includes('lụa') || text.includes('lụa hà đông') || text.includes('lụa vạn phúc')) {
    fabric = 'silk_ha_dong';
  } else if (refConfig?.fabric) {
    fabric = refConfig.fabric;
  }

  if (!capability.supportedFabrics.includes(fabric)) {
    fabric = capability.supportedFabrics[0];
  }

  if (baseLook?.locks.fabric) {
    fabric = baseLook.config.fabric;
    preservedLocks.push('fabric');
    warnings.push('Chất liệu vải đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // 5. Pattern
  let pattern: Pattern = 'plain';
  if (text.includes('hoa sen') || text.includes('thêu sen') || text.includes('sen')) {
    pattern = 'lotus';
  } else if (text.includes('vân mây') || text.includes('mây ngũ sắc') || text.includes('mây')) {
    pattern = 'cloud';
  } else if (text.includes('chim hạc') || text.includes('hạc phi thiên') || text.includes('hạc')) {
    pattern = 'crane';
  } else if (text.includes('kỷ hà') || text.includes('geometric') || text.includes('gen z')) {
    pattern = 'geometric_genz';
  } else if (text.includes('trơn') || text.includes('vải trơn') || text.includes('không hoa văn')) {
    pattern = 'plain';
  } else if (refConfig?.pattern) {
    pattern = refConfig.pattern;
  }

  if (!capability.supportedPatterns.includes(pattern)) {
    pattern = capability.supportedPatterns[0];
  }

  if (baseLook?.locks.pattern) {
    pattern = baseLook.config.pattern;
    preservedLocks.push('pattern');
    warnings.push('Họa tiết đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // 6. Colors: Primary Shirt Color
  let primaryColor: Color = { hex: '#2E8B7A', name: 'Xanh ngọc bích', family: 'green' };
  const shirtColorMatch = extractColorFromText(inputPrompt, 'shirt');
  if (shirtColorMatch) {
    primaryColor = shirtColorMatch;
  } else if (refConfig?.primaryColor) {
    primaryColor = refConfig.primaryColor;
  }

  if (baseLook?.locks.primaryColor) {
    primaryColor = baseLook.config.primaryColor;
    preservedLocks.push('primaryColor');
    warnings.push('Màu áo chính đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // 7. Colors: Pants Color
  let pantsColor: Color = { hex: '#FFFFFF', name: 'Trắng tinh khôi', family: 'white' };
  const pantsColorMatch = extractColorFromText(inputPrompt, 'pants');
  if (pantsColorMatch) {
    pantsColor = pantsColorMatch;
  } else if (refConfig?.pantsColor) {
    pantsColor = refConfig.pantsColor;
  }

  if (baseLook?.locks.pantsColor) {
    pantsColor = baseLook.config.pantsColor;
    preservedLocks.push('pantsColor');
    warnings.push('Màu quần lụa đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // 8. Accessories extraction
  const accessories: AccessoryId[] = [];
  if (text.includes('mấn') || text.includes('khăn đóng')) accessories.push('man_truyen_thong');
  if (text.includes('nón lá') || text.includes('nón')) accessories.push('non_la');
  if (text.includes('chuỗi ngọc') || text.includes('ngọc trai') || text.includes('vòng cổ ngọc')) accessories.push('chuoi_ngoc');
  if (text.includes('quạt') || text.includes('quạt xếp') || text.includes('quạt giấy')) accessories.push('quat_xep');
  if (text.includes('túi cói') || text.includes('túi')) accessories.push('tui_coi');
  if (text.includes('guốc') || text.includes('guốc mộc')) accessories.push('guoc_moc');

  // If no accessory mentioned in text, fallback to refConfig accessories
  if (accessories.length === 0 && refConfig?.accessories) {
    accessories.push(...refConfig.accessories);
  }

  // Handle accessory locks
  if (baseLook?.locks.accessories) {
    accessories.length = 0;
    accessories.push(...baseLook.config.accessories);
    preservedLocks.push('accessories');
    warnings.push('Phụ kiện đang bị khóa nên giữ nguyên theo bản phối.');
  }

  // Filter against capability
  const validAccessories = accessories.filter((acc) => capability.supportedAccessories.includes(acc));

  // 9. Background context extraction
  let backgroundContext = 'Sân trường rợp bóng cây cổ kính trong ngày chụp ảnh kỷ yếu thanh xuân';
  if (text.includes('hội an') || text.includes('phố cổ')) {
    backgroundContext = 'Phố cổ Hội An với những bức tường vàng rêu phong cổ kính và đèn lồng lung linh';
  } else if (text.includes('chùa') || text.includes('đền') || text.includes('trấn quốc') || text.includes('cố đô') || text.includes('huế')) {
    backgroundContext = 'Không gian cổ kính trang nghiêm của đền chùa cố đô với kiến trúc cung đình rường cột uy nghi';
  } else if (text.includes('hồ gươm') || text.includes('hà nội') || text.includes('cầu thê húc')) {
    backgroundContext = 'Ven bờ Hồ Gươm liễu rủ thơ mộng với cầu Thê Húc son đỏ phản chiếu mặt nước';
  } else if (text.includes('tết') || text.includes('xuân') || text.includes('hoa đào') || text.includes('hoa mai')) {
    backgroundContext = 'Không khí Tết rực rỡ với cành đào phai mùa xuân và câu đối đỏ truyền thống';
  } else if (text.includes('studio') || text.includes('nền trơn') || text.includes('tối giản')) {
    backgroundContext = 'Studio thời trang phông nền màu kem tối giản với ánh sáng mềm mại';
  } else if (text.includes('sen') || text.includes('đầm sen') || text.includes('hồ sen')) {
    backgroundContext = 'Bên hồ sen mùa hạ ngát hương với những búp sen hồng e ấp nở';
  } else if (text.includes('sân trường') || text.includes('kỷ yếu')) {
    backgroundContext = 'Sân trường rợp bóng cây cổ kính trong ngày chụp ảnh kỷ yếu thanh xuân';
  }

  // 10. Pose extraction
  let pose = 'Dáng đứng thanh lịch, tự nhiên, thần thái tự tin, nét mặt dịu dàng duyên dáng';
  if (text.includes('cầm quạt')) {
    pose = 'Đứng duyên dáng, một tay khẽ cầm quạt xếp che nghiêng e ấp';
  } else if (text.includes('cầm nón') || text.includes('ôm nón')) {
    pose = 'Đứng nghiêng sườn duyên dáng, tay nâng chiếc nón lá quai thao thanh thoát';
  } else if (text.includes('ôm hoa') || text.includes('cầm hoa')) {
    pose = 'Đứng duyên dáng hai tay ôm nhẹ bó hoa sen tươi ngát hương';
  }

  const parsedStyle: AIImageStylePreset = selectedStyle || 'elegant_fashion_2d';

  return {
    garmentModel,
    primaryColor,
    pantsColor,
    collarStyle,
    sleeveStyle,
    fabric,
    pattern,
    accessories: validAccessories,
    backgroundContext,
    pose,
    imageStyle: parsedStyle,
    unsupportedRequests,
    warnings,
    preservedLocks,
  };
}

/**
 * Stage 2: Build detailed Ao Dai Image Prompt for AI generation model.
 * Enforces authentic Vietnamese Ao Dai anatomy and rejects qipao/hanbok/kimono traits.
 */
export function buildAoDaiImagePrompt(
  parsed: AIImageParsedDetails,
  options: { stylePreset?: AIImageStylePreset } = {}
): string {
  const style = options.stylePreset || parsed.imageStyle || 'elegant_fashion_2d';
  const isRemix = parsed.garmentModel === 'aodai_remix_raglan';

  // 1. Core Subject & Identity
  const subjectLine =
    'Full-body 2D fashion illustration of an authentic elegant young Vietnamese woman wearing a traditional Vietnamese Ao Dai outfit (Áo dài Việt Nam).';

  // 2. Garment Structure & Cultural Authenticity (Anti-Qipao Rules)
  let structurePrompt = '';
  if (isRemix) {
    structurePrompt = [
      'Modern Vietnamese Ao Dai Remix (áo dài cách tân phong cách Gen Z):',
      '- Bodice: tailored upper body with contemporary graceful fit.',
      '- Tunic Flaps: exactly TWO distinct split flaps (front flap and back flap) falling gracefully just below the knees, with high side slits extending up to the natural waistline.',
      '- Lower Garment: SEPARATE wide-leg flowing silk culottes trousers (quần lụa) worn underneath the tunic, reaching down to ankles.',
      '- IMPORTANT CULTURAL MANDATE: This is an authentic Vietnamese Ao Dai, NOT a Chinese Qipao or Cheongsam (which is a one-piece skirt without pants and with thigh slits). Must visibly show the two split tunic panels draped over separate flowing silk trousers.',
    ].join(' ');
  } else {
    structurePrompt = [
      'Traditional Vietnamese Ao Dai (Áo dài truyền thống Việt Nam):',
      '- Bodice: slender, fitted form-hugging tunic bodice accentuating natural graceful posture.',
      '- Tunic Flaps: exactly TWO distinct long split flaps (tà trước và tà sau) cascading down past knees to foot instep, with authentic high side waist slits.',
      '- Lower Garment: SEPARATE loose-fitting, flowing wide-leg silk trousers (quần dài chấm gót) worn underneath, floor-length drape.',
      '- IMPORTANT CULTURAL MANDATE: This is strictly an authentic Vietnamese Ao Dai with trousers, NOT a Chinese Qipao / Cheongsam dress, NOT a Japanese kimono, NOT a Korean hanbok. The two split flaps floating over wide silk trousers are an absolute cultural requirement.',
    ].join(' ');
  }

  // 3. Collar and Sleeve Anatomy
  let collarDesc = 'standing mandarin high collar (cổ cao truyền thống 4.2cm) snug around the slender neck';
  if (parsed.collarStyle === 'round') collarDesc = 'soft rounded open neckline (cổ tròn thanh thoát)';
  if (parsed.collarStyle === 'boat') collarDesc = 'elegant horizontal boat neckline (cổ thuyền kiêu sa)';
  if (parsed.collarStyle === 'v_neck') collarDesc = 'contemporary V-neckline (cổ V cách tân)';

  let sleeveDesc = 'full-length tailored slender sleeves (tay dài truyền thống)';
  if (parsed.sleeveStyle === 'raglan') sleeveDesc = 'classic diagonal raglan cut sleeves offering seamless shoulder drape';
  if (parsed.sleeveStyle === 'elbow') sleeveDesc = 'chic 3/4 length elbow sleeves revealing delicate wrists';
  if (parsed.sleeveStyle === 'slit') sleeveDesc = 'stylized side-slit sleeves with tasteful contemporary edge';

  // 4. Fabric Texture & Palette
  const shirtColorName = parsed.primaryColor?.name || 'Xanh ngọc bích';
  const shirtHex = parsed.primaryColor?.hex || '#2E8B7A';
  const pantsColorName = parsed.pantsColor?.name || 'Trắng tinh khôi';
  const pantsHex = parsed.pantsColor?.hex || '#FFFFFF';

  let fabricDesc = 'luxurious smooth Ha Dong mulberry silk with delicate fluid sheen';
  if (parsed.fabric === 'brocade_hue') fabricDesc = 'imperial Hue brocade with rich jacquard weave and subtle golden undertones';
  if (parsed.fabric === 'voile_chiffon') fabricDesc = 'delicate translucent chiffon voile layers creating ethereal visual depth';
  if (parsed.fabric === 'linen_modern') fabricDesc = 'crisp raw artisanal linen weave with organic matte texture';

  let patternDesc = 'immaculate plain unadorned fabric highlighting the purity of the color';
  if (parsed.pattern === 'lotus') patternDesc = 'delicate stylized lotus flower embroidery floating along the chest and tunic flap';
  if (parsed.pattern === 'cloud') patternDesc = 'imperial Nguyen dynasty swirling auspicious cloud motifs woven into the fabric';
  if (parsed.pattern === 'crane') patternDesc = 'graceful soaring celestial crane embroidery splayed across the front flap';
  if (parsed.pattern === 'geometric_genz') patternDesc = 'contemporary Gen Z Remix geometric diamond star patterns blending heritage and youth culture';

  // 5. Accessories
  const accList: string[] = [];
  if (parsed.accessories?.includes('man_truyen_thong')) accList.push('traditional Vietnamese royal crown headpiece (mấn nhung đội đầu)');
  if (parsed.accessories?.includes('non_la')) accList.push('traditional Vietnamese conical leaf hat (nón lá quai thao)');
  if (parsed.accessories?.includes('chuoi_ngoc')) accList.push('dignified natural pearl necklace strand draped on the chest');
  if (parsed.accessories?.includes('quat_xep')) accList.push('silk folding fan held gracefully in hand');
  if (parsed.accessories?.includes('tui_coi')) accList.push('artisan woven straw tote bag');
  if (parsed.accessories?.includes('guoc_moc')) accList.push('lacquered wooden clogs (guốc mộc)');

  const accessoryLine = accList.length > 0 ? `Accessories: ${accList.join(', ')}.` : '';

  // 6. Character Demeanor, Pose, and Setting
  const characterLine = `The young Vietnamese woman has beautiful natural Asian facial features, warm smile, neat glossy dark hair, slender neck, graceful hands with natural fingers, standing in an elegant pose (${parsed.pose || 'graceful standing posture'}).`;
  const settingLine = `Setting & Environment: ${parsed.backgroundContext || 'Clean aesthetic studio background with soft ambient natural light'}.`;

  // 7. Visual Art Style Directive
  let styleLine = '';
  switch (style) {
    case 'digital_painting_2d':
      styleLine =
        'Style: High-end 2D digital painting, luminous painterly brushwork, cinematic rim lighting, rich color harmony, anime-couture aesthetic, fine art finish, masterwork.';
      break;
    case 'modern_watercolor_2d':
      styleLine =
        'Style: Modern contemporary watercolor illustration on archival textured paper, fluid color washes, translucent flowing pigments, delicate ink contours, expressive fine art.';
      break;
    case 'flat_vector_2d':
      styleLine =
        'Style: Clean flat vector fashion illustration, crisp graphic silhouettes, bold harmonious palette, modern editorial look, immaculate vector precision.';
      break;
    case 'elegant_fashion_2d':
    default:
      styleLine =
        'Style: Sophisticated high-fashion 2D editorial illustration, elegant clean lines, polished colors, full-body portrait without cropping, pristine high resolution, no watermarks, no distorted hands, no extra limbs, no text.';
      break;
  }

  // Construct assembled prompt
  return [
    subjectLine,
    structurePrompt,
    `Tunic Color: ${shirtColorName} (HEX ${shirtHex}).`,
    `Trousers Color: ${pantsColorName} (HEX ${pantsHex}).`,
    `Collar: ${collarDesc}.`,
    `Sleeves: ${sleeveDesc}.`,
    `Fabric Material: ${fabricDesc}.`,
    `Pattern & Embroidery: ${patternDesc}.`,
    accessoryLine,
    characterLine,
    settingLine,
    styleLine,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * Build prompt for Face-Referenced 2D Ao Dai generation (Section C & D).
 * Preserves facial features, hairstyle, skin tone, and approximate age from input photo.
 * Synthesizes full-body standing/sitting pose wearing authentic Ao Dai outfit.
 */
export function buildFaceReferencedAoDaiPrompt(
  parsed: AIImageParsedDetails,
  options: {
    facePreservation?: boolean;
    backgroundSetting?: string;
    poseStyle?: string;
    stylePreset?: AIImageStylePreset;
  } = {}
): string {
  const basePrompt = buildAoDaiImagePrompt(parsed, { stylePreset: options.stylePreset });

  const facePreserveDirectives = [
    'CRITICAL MULTIMODAL REFERENCE INSTRUCTION:',
    '1. Examine the face in the reference photo with extreme care: preserve the subject\'s distinctive facial likeness, facial bone structure, eye shape, nose, lips, smile, skin undertone, natural hairstyle, gender, and approximate age.',
    '2. Do NOT replace this face with a generic fantasy face. The person in the output illustration must be instantly recognizable as the same individual from the reference image.',
    '3. Clothe this individual from head to toe in the specified authentic Vietnamese Ao Dai outfit, wearing the two-split tunic flaps over separate wide-leg silk trousers.',
  ];

  if (options.poseStyle) {
    if (options.poseStyle === 'full_body_standing') {
      facePreserveDirectives.push('4. Synthesize a full-body standing pose showing the full silhouette from head to toe, with graceful posture.');
    } else if (options.poseStyle === 'full_body_sitting') {
      facePreserveDirectives.push('4. Synthesize a full-body seated pose on an elegant wooden chair, tunic draping naturally over silk trousers.');
    } else if (options.poseStyle === 'three_quarter') {
      facePreserveDirectives.push('4. Synthesize an artistic three-quarter view from knees up, highlighting tunic embroidery and posture.');
    }
  } else {
    facePreserveDirectives.push('4. Synthesize a full-body 2D standing posture displaying the complete outfit from head to shoes.');
  }

  if (options.backgroundSetting) {
    if (options.backgroundSetting === 'studio_minimal') {
      facePreserveDirectives.push('5. Environment: High-end minimalist photo studio with seamless backdrop and soft ambient studio lighting.');
    } else if (options.backgroundSetting === 'hanoi_ancient') {
      facePreserveDirectives.push('5. Environment: Historic Hanoi / Hoi An ancient street with mossy golden walls, wooden shutters, and paper lanterns.');
    } else if (options.backgroundSetting === 'hue_palace') {
      facePreserveDirectives.push('5. Environment: Majestic Hue imperial citadel or ancient pagoda courtyard with carved wooden pillars and lotus stone urns.');
    } else if (options.backgroundSetting === 'lotus_pond') {
      facePreserveDirectives.push('5. Environment: Peaceful summer lotus pond with blooming pink lotus flowers and verdant pads.');
    } else if (options.backgroundSetting === 'solid_color') {
      facePreserveDirectives.push('5. Environment: Clean solid color studio aesthetic background with subtle vignette.');
    }
  }

  return `${facePreserveDirectives.join(' ')} ${basePrompt}`;
}

/**
 * Build prompt for Conversational Multi-Turn Image Refinement (Section E).
 * Retains parent image characteristics and applies delta modifications.
 */
export function buildConversationalRefinementPrompt(
  parentPrompt: string,
  instruction: string,
  options: {
    backgroundSetting?: string;
    poseStyle?: string;
    stylePreset?: AIImageStylePreset;
  } = {}
): string {
  const refinementDirectives = [
    'CONVERSATIONAL IMAGE REFINEMENT (MULTI-TURN ITERATION):',
    'Look at the previous image provided in the conversation context.',
    'Maintain the EXACT same character identity, face, hairstyle, facial expressions, and overall art style from the previous image.',
    `User refinement instruction: "${instruction.trim()}".`,
    'Apply ONLY the requested changes while keeping all other elements of the Vietnamese Ao Dai garment (two separate flaps over wide-leg trousers), lighting, and pose consistent.',
    'Do NOT convert into Qipao, Kimono, or Hanbok.',
  ];

  if (options.backgroundSetting) {
    refinementDirectives.push(`Update background setting to: ${options.backgroundSetting}.`);
  }
  if (options.poseStyle) {
    refinementDirectives.push(`Update pose style to: ${options.poseStyle}.`);
  }

  return `${refinementDirectives.join(' ')} Reference context: ${parentPrompt}`;
}
