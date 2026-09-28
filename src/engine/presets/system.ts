/**
 * System prompt (skill) mặc định theo preset Prompt. Không phụ thuộc runtime SW nên
 * editor dùng chung để hiện ô Skill.
 */
import { FASHION_SYSTEM } from '@/engine/presets/fashion';

const PRESET_LABEL_RULE =
  ' Keep every [Label] tag and every "[Label]: description" block exactly as written. ' +
  'Do not insert flow-content.google URLs or media ids into the text.';

const PRESET_SYSTEM: Record<string, string> = {
  enhance: 'Enhance and improve the following prompt for generative AI video/image.' + PRESET_LABEL_RULE,
  analyzeImage: 'Analyze the provided image(s) in detail.' + PRESET_LABEL_RULE,
  script: 'Write a short video script based on the inputs.' + PRESET_LABEL_RULE,
  summarize: 'Summarize the following content concisely.' + PRESET_LABEL_RULE,
  translate: 'Translate the following content to Vietnamese.' + PRESET_LABEL_RULE,
  brainstorm: 'Brainstorm creative ideas based on the inputs.' + PRESET_LABEL_RULE,
  custom: '',
  ...FASHION_SYSTEM,
};

/** Skill mặc định của preset; rỗng khi preset không gọi Gemini (custom, fashionCompose). */
export function defaultPromptSystem(preset: string): string {
  return PRESET_SYSTEM[preset] ?? '';
}

/** Skill của node ghi đè mặc định của preset; preset không gọi Gemini giữ nguyên (rỗng). */
export function promptSystem(data: { preset: string; systemPrompt?: string }): string {
  const fallback = defaultPromptSystem(data.preset);
  if (!fallback) return '';
  return data.systemPrompt?.trim() || fallback;
}
