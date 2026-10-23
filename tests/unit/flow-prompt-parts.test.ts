import { describe, expect, it } from 'vitest';
import { MODEL_AI_ORIGIN_NOTE, REFERENCE_LIST_HEADER } from '@/engine/resolver';
import { buildReferencePromptParts, formatPartsForLog } from '@/providers/flow/rpc/promptParts';

const CHAR = '5ef8278f-a08d-4b30-a45c-bdd946b37427';
const OUTFIT = 'fcf16651-14f3-4335-9557-0a808bd11946';
const BG = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const CHAR_NOTE = `(${MODEL_AI_ORIGIN_NOTE}) `;

describe('buildReferencePromptParts', () => {
  it('anchors first [Label] in narrative; later repeats stay as text', () => {
    const prompt =
      `Video dọc 9:16 dài 4 giây.\n` +
      `[Model] mặc [Outfit] đi bộ về phía máy quay, [Model] khẽ mỉm cười.\n\n` +
      `${REFERENCE_LIST_HEADER}\n` +
      `[Model]: Cô gái Đông Á 20-25 tuổi, tóc đen ngang vai.\n\n` +
      `[Outfit]: Blazer linen màu kem, quần jeans ống rộng xanh nhạt.`;

    const { parts, mediaIds } = buildReferencePromptParts(prompt, [
      { label: 'Model', mediaId: CHAR },
      { label: 'Outfit', mediaId: OUTFIT },
    ]);

    expect(mediaIds).toEqual([CHAR, OUTFIT]);
    expect(parts).toEqual([
      { type: 'text', text: `Video dọc 9:16 dài 4 giây.\n${CHAR_NOTE}` },
      { type: 'image', mediaId: CHAR, name: 'Model' },
      { type: 'text', text: ' mặc ' },
      { type: 'image', mediaId: OUTFIT, name: 'Outfit' },
      {
        type: 'text',
        text:
          ` đi bộ về phía máy quay, [Model] khẽ mỉm cười.\n\n` +
          `${REFERENCE_LIST_HEADER}\n` +
          `[Model]: Cô gái Đông Á 20-25 tuổi, tóc đen ngang vai.\n\n` +
          `[Outfit]: Blazer linen màu kem, quần jeans ống rộng xanh nhạt.`,
      },
    ]);
  });

  it('anchors in the reference-list line when label only appears there', () => {
    const prompt =
      `A quiet street.\n\n${REFERENCE_LIST_HEADER}\n[Model]: portrait.\n\n[Outfit]: coat.`;
    const { parts, mediaIds } = buildReferencePromptParts(prompt, [
      { label: 'Model', mediaId: CHAR },
      { label: 'Outfit', mediaId: OUTFIT },
    ]);
    expect(mediaIds).toEqual([CHAR, OUTFIT]);
    expect(parts[0]).toEqual({
      type: 'text',
      text: `A quiet street.\n\n${REFERENCE_LIST_HEADER}\n${CHAR_NOTE}`,
    });
    expect(parts[1]).toEqual({ type: 'image', mediaId: CHAR, name: 'Model' });
    expect(parts[2]).toEqual({ type: 'text', text: ': portrait.\n\n' });
    expect(parts[3]).toEqual({ type: 'image', mediaId: OUTFIT, name: 'Outfit' });
    expect(parts[4]).toEqual({ type: 'text', text: ': coat.' });
  });

  it('appends and anchors a ref that never appears in the prompt', () => {
    const { parts, mediaIds } = buildReferencePromptParts('Just a walk.', [
      { label: 'Model', mediaId: CHAR },
    ]);
    expect(mediaIds).toEqual([CHAR]);
    expect(parts).toEqual([
      { type: 'text', text: `Just a walk.\n${CHAR_NOTE}` },
      { type: 'image', mediaId: CHAR, name: 'Model' },
    ]);
  });

  it('matches labels case-insensitively and collapses whitespace', () => {
    const { parts } = buildReferencePromptParts('[ model ] walks', [
      { label: 'Model', mediaId: CHAR },
    ]);
    expect(parts[0]).toEqual({ type: 'text', text: CHAR_NOTE });
    expect(parts[1]).toEqual({ type: 'image', mediaId: CHAR, name: 'Model' });
    expect(parts[2]).toEqual({ type: 'text', text: ' walks' });
  });

  it('starts with Model AI-origin note then image when prompt begins with [Model]', () => {
    const { parts } = buildReferencePromptParts('[Model] walks', [
      { label: 'Model', mediaId: CHAR },
    ]);
    expect(parts[0]).toEqual({ type: 'text', text: CHAR_NOTE });
    expect(parts[1]?.type).toBe('image');
    expect(parts.every((p) => p.type !== 'text' || p.text.length > 0)).toBe(true);
  });

  it('keeps unknown labels as text and reports them', () => {
    const { parts, unknownLabels } = buildReferencePromptParts(
      '[Model] in [Background]',
      [{ label: 'Model', mediaId: CHAR }],
    );
    expect(unknownLabels).toEqual(['Background']);
    expect(parts.some((p) => p.type === 'text' && p.text.includes('[Background]'))).toBe(true);
  });

  it('anchors Background like Model when both are ordered refs', () => {
    const { parts, mediaIds, unknownLabels } = buildReferencePromptParts(
      '[Model] walks in [Background]',
      [
        { label: 'Model', mediaId: CHAR },
        { label: 'Background', mediaId: BG },
      ],
    );
    expect(unknownLabels).toEqual([]);
    expect(mediaIds).toEqual([CHAR, BG]);
    expect(parts).toEqual([
      { type: 'text', text: CHAR_NOTE },
      { type: 'image', mediaId: CHAR, name: 'Model' },
      { type: 'text', text: ' walks in ' },
      { type: 'image', mediaId: BG, name: 'Background' },
    ]);
  });

  it('text parts never contain flow CDN urls or ref media ids', () => {
    const prompt = `[Model] walks\n\n${REFERENCE_LIST_HEADER}\n[Model]: face.`;
    const { parts } = buildReferencePromptParts(prompt, [
      { label: 'Model', mediaId: CHAR },
    ]);
    for (const p of parts) {
      if (p.type !== 'text') continue;
      expect(p.text).not.toMatch(/flow-content\.google/);
      expect(p.text).not.toContain(CHAR);
    }
  });

  it('formatPartsForLog shows image anchors', () => {
    const log = formatPartsForLog([
      { type: 'text', text: 'hi ' },
      { type: 'image', mediaId: CHAR, name: 'Model' },
    ]);
    expect(log).toContain('⟦ảnh [Model]');
    expect(log).toContain('5ef8278f…');
  });
});
