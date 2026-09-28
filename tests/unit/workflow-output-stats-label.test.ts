import { describe, expect, it } from 'vitest';
import { PROMPT_PRESETS } from '@/shared/schema';
import { promptPresetLabel, strings } from '@/shared/strings';

describe('Phase 4 GUI strings / presets', () => {
  it('PROMPT_PRESETS includes fashion presets', () => {
    expect(PROMPT_PRESETS).toContain('fashionScene');
    expect(PROMPT_PRESETS).toContain('fashionCompose');
  });

  it('output stats empty and counted labels', () => {
    expect(strings.workflowOutputEmpty).toBe('0 ảnh');
    expect(strings.workflowOutputStats(5, 2)).toBe('5 ảnh · 2 video');
    expect(strings.promptReused).toBe('Dùng lại');
    expect(strings.promptFresh).toBe('Mới phân tích');
  });

  it('promptPresetLabel covers every PROMPT_PRESETS key in Vietnamese', () => {
    for (const preset of PROMPT_PRESETS) {
      const label = promptPresetLabel(preset);
      expect(label).not.toBe(preset);
      expect(label.length).toBeGreaterThan(0);
    }
    expect(promptPresetLabel('fashionScene')).toBe(strings.presetFashionScene);
    expect(promptPresetLabel('custom')).toBe(strings.presetCustom);
  });
});
