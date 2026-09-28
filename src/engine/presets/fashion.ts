/**
 * Fashion analysis presets + pure prompt composer.
 * Kept out of executors.ts so promptExecutor only looks up maps (SOLID-S).
 */

import { strings } from '@/shared/strings';
import { extractJsonPayload } from '@/shared/utils';

export const FASHION_PRESETS = [
  'fashionScene',
  'fashionModel',
  'fashionOutfit',
  'fashionColor',
] as const;
export type FashionPreset = (typeof FASHION_PRESETS)[number];

const CONCRETE =
  ' Be concrete and specific, never generic: name exact colors (with an approximate hex), materials, textures, ' +
  'shapes, sizes, counts and positions (left/right, foreground/background). ' +
  'Do not use vague words like "đẹp", "sang trọng", "thời trang" without saying what makes it so. ' +
  'Each value is 1-3 complete, easy-to-read sentences.';

const JSON_ONLY =
  ' Respond with a single JSON object only - no markdown fences, no commentary.' +
  ' Keep every JSON key in English exactly as listed and keep the "type" value as the English literal given.' +
  ' Write every other string value in Vietnamese (hex colors stay as hex codes).';

export const FASHION_SYSTEM: Record<FashionPreset, string> = {
  fashionScene:
    'You analyze a fashion photo to reuse as the SCENE of a new photo: everything except the face and the clothes. ' +
    'Describe the person in the photo (pose, body angle, hands, gaze direction, hair, skin color) and every accessory ' +
    '(jewelry, bag, hat, glasses, belt, shoes, watch...), plus camera, lighting, background and colors. ' +
    'Do NOT describe the face features, facial expression or the clothing (top, bottom, dress, jacket) - they come from other references. ' +
    'Return JSON with keys: type ("scene"), summary (string), ' +
    'subject (object with keys pose, hands, gaze, hair, body, skin - skin tone, undertone and texture of the visible skin), ' +
    'accessories (string[] - one entry per item with color, material and where it is worn), ' +
    'camera (object with keys shot, angle, lens, framing), lighting (string), ' +
    'background (string - list props with their positions), mood (string), color_grading (string).' +
    CONCRETE +
    JSON_ONLY,

  fashionModel:
    'You analyze ONLY the FACE of the model in the image(s): facial features and the way the face expresses, ' +
    'to recreate the exact same face in a new photo. ' +
    'Ignore skin color, hair, body, clothing, pose and background (skin color comes from the scene). ' +
    'Return JSON with keys: type ("model"), summary (string), ' +
    'face (object with keys shape, forehead, eyebrows, eyes, nose, lips, cheeks, jaw_chin, marks - moles/freckles/dimples with their positions, ethnicity_age), ' +
    'expression (object with keys default_expression, smile, eye_expression, mannerisms - typical facial gestures such as head tilt, raised brow, lip press), ' +
    'must_keep (string[] of the most distinctive face details that must stay identical).' +
    CONCRETE +
    JSON_ONLY,

  fashionOutfit:
    'You analyze ONLY the CLOTHES in the image(s): the top and the bottom garments, to dress a model in exactly these clothes. ' +
    'Ignore the person, accessories, shoes and background. For a dress or jumpsuit, describe it in top and set bottom to "". ' +
    'Return JSON with keys: type ("outfit"), summary (string), ' +
    'top (object with keys garment, color, material, fit, neckline, sleeves, details), ' +
    'bottom (object with keys garment, color, material, fit, length, waist, details), ' +
    'must_keep (string[] of details that must stay identical, e.g. prints, logos, buttons, stitching), ' +
    'negative (string[] of things to avoid adding).' +
    CONCRETE +
    JSON_ONLY,

  fashionColor:
    'You design ONE fashion color palette from the style described in the user instruction ' +
    '(e.g. sang trọng / trẻ đẹp / năng động). Do not invent multiple palettes. ' +
    'Return JSON with keys: type ("palette"), summary (string), base (hex), accent (hex), neutral (hex), ' +
    'rule (short sentence how to apply the palette to the top and bottom).' +
    CONCRETE +
    JSON_ONLY,
};

type FashionBlockType = 'scene' | 'model' | 'outfit' | 'palette';

export type FashionRefRole = 'scene' | 'model' | 'outfit';

/** Vai trò của ảnh đi qua từng preset phân tích. */
export const FASHION_REF_ROLE: Partial<Record<string, FashionRefRole>> = {
  fashionScene: 'scene',
  fashionModel: 'model',
  fashionOutfit: 'outfit',
};

/** Nhãn `[Label]` của ảnh tham chiếu theo vai trò (lấy từ node Asset thật). */
export type FashionRefLabels = Partial<Record<FashionRefRole, string[]>>;

/** Khuôn mặt + trang phục là ràng buộc cứng nên đứng trước; bối cảnh (phần lớn ảnh) đứng sau. */
const BLOCK_ORDER: FashionBlockType[] = ['model', 'outfit', 'palette', 'scene'];

interface FashionBlock {
  type: FashionBlockType;
  summary?: string;
  [key: string]: unknown;
}

function safeParseBlock(raw: string): FashionBlock | null {
  const trimmed = extractJsonPayload(raw);
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(strings.fashionJsonInvalid);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(strings.fashionJsonInvalid);
  }
  const type = (parsed as { type?: unknown }).type;
  if (type !== 'scene' && type !== 'model' && type !== 'outfit' && type !== 'palette') {
    return null;
  }
  return parsed as FashionBlock;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Nhãn tiếng Việt cho key JSON (key giữ tiếng Anh); key lạ giữ nguyên. */
const LABELS: Record<string, string> = {
  shape: 'Dáng mặt',
  forehead: 'Trán',
  eyebrows: 'Lông mày',
  eyes: 'Mắt',
  nose: 'Mũi',
  lips: 'Môi',
  cheeks: 'Má',
  jaw_chin: 'Hàm và cằm',
  ethnicity_age: 'Nét người và độ tuổi',
  marks: 'Nốt ruồi, tàn nhang, lúm',
  default_expression: 'Biểu cảm thường',
  smile: 'Nụ cười',
  eye_expression: 'Ánh mắt',
  mannerisms: 'Cử chỉ khuôn mặt',
  skin: 'Làn da',
  garment: 'Loại',
  color: 'Màu',
  material: 'Chất liệu',
  fit: 'Phom dáng',
  neckline: 'Cổ áo',
  sleeves: 'Tay áo',
  length: 'Độ dài',
  waist: 'Cạp',
  details: 'Chi tiết',
  pose: 'Tư thế',
  hands: 'Tay',
  gaze: 'Hướng nhìn',
  hair: 'Tóc',
  body: 'Dáng người',
  shot: 'Cỡ cảnh',
  angle: 'Góc máy',
  lens: 'Ống kính',
  framing: 'Bố cục',
};

/** Các dòng "Nhãn: giá trị" của một object con (face, skin, top...). */
function objectLines(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => text(v))
    .map(([k, v]) => `- ${LABELS[k] ?? k}: ${text(v)}`);
}

function section(title: string, lines: string[]): string {
  const body = lines.filter(Boolean);
  return body.length ? [title, ...body].join('\n') : '';
}

function listLine(label: string, value: unknown): string {
  const items = asStringList(value);
  return items.length ? `${label}: ${items.join('; ')}` : '';
}

function renderModel(block: FashionBlock): string {
  return section(
    'Khuôn mặt (CHỈ lấy nét mặt và phong cách biểu cảm từ ảnh người mẫu tham chiếu - giữ giống hệt; không lấy màu da, tóc, trang phục, bối cảnh của ảnh đó):',
    [
      text(block.summary),
      ...objectLines(block.face),
      ...objectLines(block.expression),
      listLine('Bắt buộc giữ', block.must_keep),
    ],
  );
}

function renderOutfit(block: FashionBlock): string {
  const top = objectLines(block.top);
  const bottom = objectLines(block.bottom);
  return section('Trang phục (thay toàn bộ quần áo trong bối cảnh bằng đúng bộ này):', [
    text(block.summary),
    top.length ? 'Áo:' : '',
    ...top,
    bottom.length ? 'Quần/váy:' : '',
    ...bottom,
    listLine('Bắt buộc giữ', block.must_keep),
    listLine('Tránh', block.negative),
  ]);
}

function renderPalette(block: FashionBlock): string {
  return section('Bảng màu cho trang phục:', [
    text(block.summary),
    text(block.base) ? `Màu nền: ${text(block.base)}` : '',
    text(block.accent) ? `Màu nhấn: ${text(block.accent)}` : '',
    text(block.neutral) ? `Màu trung tính: ${text(block.neutral)}` : '',
    text(block.rule) ? `Cách phối: ${text(block.rule)}` : '',
  ]);
}

function renderScene(block: FashionBlock): string {
  return section('Bối cảnh (giữ theo ảnh bối cảnh: tư thế, tóc, màu da, phụ kiện, máy ảnh, ánh sáng, phông nền):', [
    text(block.summary),
    ...objectLines(block.subject),
    listLine('Phụ kiện', block.accessories),
    ...objectLines(block.camera),
    text(block.lighting) ? `Ánh sáng: ${text(block.lighting)}` : '',
    text(block.background) ? `Phông nền: ${text(block.background)}` : '',
    text(block.mood) ? `Cảm xúc: ${text(block.mood)}` : '',
    text(block.color_grading) ? `Chỉnh màu: ${text(block.color_grading)}` : '',
  ]);
}

const tag = (label: string) => `[${label}]`;

/**
 * Có ảnh bối cảnh → sửa trên chính ảnh đó (giữ tư thế, phụ kiện, bố cục) và chỉ thay
 * mặt + quần áo, mỗi ảnh tham chiếu một vai trò rõ ràng. Không có → undefined (tạo ảnh mới).
 */
function editInstruction(labels: FashionRefLabels): string | undefined {
  const scene = labels.scene?.[0];
  if (!scene) return undefined;
  const faces = labels.model ?? [];
  const outfits = labels.outfit ?? [];
  return [
    `Chỉnh sửa ảnh ${tag(scene)}, ảnh chân thực như ảnh chụp, chi tiết cao: giữ nguyên tư thế, dáng người, tóc, màu da, phụ kiện, góc máy, ánh sáng và phông nền của ảnh này.`,
    faces.length
      ? `- Thay khuôn mặt bằng khuôn mặt trong ${faces.map(tag).join(', ')} (chỉ lấy nét mặt và phong cách biểu cảm; màu da giữ theo ${tag(scene)}; không lấy tóc, quần áo, bối cảnh).`
      : '',
    outfits.length
      ? `- Thay áo và quần bằng đúng bộ trang phục trong ${outfits.map(tag).join(', ')} (chỉ lấy quần áo, không lấy người mặc).`
      : '',
    `- Không giữ lại khuôn mặt và quần áo của người trong ${tag(scene)}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

const RENDERERS: Record<FashionBlockType, (b: FashionBlock) => string> = {
  model: renderModel,
  outfit: renderOutfit,
  palette: renderPalette,
  scene: renderScene,
};

/**
 * Pure composer: parse fashion JSON blocks and render a fixed Vietnamese prompt.
 * Face + skin come only from the model block, top + bottom only from the outfit block;
 * the scene block supplies everything else (pose, hair, accessories, camera, light, background).
 */
export function composeFashionPrompt(texts: string[], labels: FashionRefLabels = {}): string {
  const byType = new Map<FashionBlockType, FashionBlock>();
  for (const raw of texts) {
    const block = safeParseBlock(raw);
    if (!block) continue;
    byType.set(block.type, block);
  }
  if (!byType.size) throw new Error(strings.fashionComposeEmpty);

  const sections: string[] = [
    editInstruction(labels) ?? 'Ảnh thời trang editorial, chân thực như ảnh chụp, chi tiết cao.',
  ];
  for (const type of BLOCK_ORDER) {
    const block = byType.get(type);
    if (!block) continue;
    const rendered = RENDERERS[type](block);
    if (rendered) sections.push(rendered);
  }
  return sections.join('\n\n');
}
