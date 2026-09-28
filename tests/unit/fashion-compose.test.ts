import { describe, expect, it } from 'vitest';
import { composeFashionPrompt, FASHION_SYSTEM } from '@/engine/presets/fashion';
import { strings } from '@/shared/strings';

const model = JSON.stringify({
  type: 'model',
  summary: 'Nữ châu Á khoảng 25 tuổi',
  face: {
    shape: 'mặt trái xoan, cằm thon nhọn',
    eyes: 'mắt hai mí to, tròng nâu đậm',
    marks: 'nốt ruồi nhỏ dưới mắt trái',
  },
  expression: { smile: 'cười mỉm khép môi', mannerisms: 'hơi nghiêng đầu sang phải' },
  must_keep: ['nốt ruồi dưới mắt trái'],
});

const outfit = JSON.stringify({
  type: 'outfit',
  summary: 'Áo thun tím mận, quần jean ống rộng',
  top: { garment: 'áo thun cổ tròn', color: 'tím mận #7A2E4D', material: 'cotton dày' },
  bottom: { garment: 'quần jean ống rộng', color: 'xanh nhạt #A9C2D9', waist: 'cạp cao' },
  must_keep: ['đường chỉ nổi ở túi quần'],
  negative: ['logo'],
});

const palette = JSON.stringify({
  type: 'palette',
  summary: 'Tông trung tính sang trọng',
  base: '#F5F0E8',
  accent: '#C4A574',
  neutral: '#2C2C2C',
  rule: 'Áo màu nền, quần màu trung tính.',
});

const scene = JSON.stringify({
  type: 'scene',
  summary: 'Phòng khách sáng, gỗ sáng màu',
  subject: { pose: 'đứng nghiêng 3/4, tay trái đút túi', hair: 'búi thấp, mái thưa', skin: 'da trắng hồng, tông ấm' },
  accessories: ['túi da đen cầm tay phải', 'vòng tay bạc mảnh ở cổ tay trái'],
  camera: { shot: 'toàn thân', lens: 'khoảng 50mm' },
  lighting: 'nắng tự nhiên từ cửa sổ bên trái',
  background: 'bàn gỗ bên trái, ghế mây bên phải',
  mood: 'thư thái',
  color_grading: 'ấm, film',
});

describe('composeFashionPrompt', () => {
  it('face + expression from model, top + bottom from outfit, skin and the rest from scene - in that order', () => {
    // Deliberately reverse input order - composer re-sorts by type.
    const prompt = composeFashionPrompt([scene, palette, outfit, model]);
    const iFace = prompt.indexOf('Khuôn mặt (CHỈ');
    const iOutfit = prompt.indexOf('Trang phục');
    const iPalette = prompt.indexOf('Bảng màu');
    const iScene = prompt.indexOf('Bối cảnh');
    expect(iFace).toBeGreaterThan(-1);
    expect(iOutfit).toBeGreaterThan(iFace);
    expect(iPalette).toBeGreaterThan(iOutfit);
    expect(iScene).toBeGreaterThan(iPalette);

    expect(prompt).toContain('CHỈ lấy nét mặt và phong cách biểu cảm từ ảnh người mẫu');
    expect(prompt).toContain('không lấy màu da');
    expect(prompt).toContain('- Cử chỉ khuôn mặt: hơi nghiêng đầu sang phải');
    expect(prompt).toContain('- Làn da: da trắng hồng, tông ấm');
    expect(prompt).toContain('- Dáng mặt: mặt trái xoan, cằm thon nhọn');
    expect(prompt).toContain('- Nốt ruồi, tàn nhang, lúm: nốt ruồi nhỏ dưới mắt trái');
    expect(prompt).toContain('Áo:\n- Loại: áo thun cổ tròn');
    expect(prompt).toContain('Quần/váy:\n- Loại: quần jean ống rộng');
    expect(prompt).toContain('- Tóc: búi thấp, mái thưa');
    expect(prompt).toContain('Phụ kiện: túi da đen cầm tay phải; vòng tay bạc mảnh ở cổ tay trái');
    expect(prompt).toContain('#C4A574');
  });

  it('still composes when some blocks are missing', () => {
    const prompt = composeFashionPrompt([model, outfit]);
    expect(prompt).toContain('Khuôn mặt (CHỈ');
    expect(prompt).toContain('Trang phục');
    expect(prompt).not.toContain('Bảng màu');
    expect(prompt).not.toContain('Bối cảnh');
  });

  it('dress: empty bottom leaves out the Quần/váy section', () => {
    const dress = JSON.stringify({ type: 'outfit', top: { garment: 'đầm maxi hoa nhí' }, bottom: { garment: '' } });
    const prompt = composeFashionPrompt([dress]);
    expect(prompt).toContain('- Loại: đầm maxi hoa nhí');
    expect(prompt).not.toContain('Quần/váy');
  });

  it('throws Vietnamese error on invalid JSON', () => {
    expect(() => composeFashionPrompt(['{not-json', model])).toThrow(strings.fashionJsonInvalid);
  });

  it('strips markdown fences (and prose) before parsing', () => {
    const fenced = 'Here is the model JSON:\n```json\n' + model + '\n```\nThanks!';
    const prompt = composeFashionPrompt([fenced, `\`\`\`\n${outfit}\n\`\`\``]);
    expect(prompt).toContain('Khuôn mặt (CHỈ');
    expect(prompt).toContain('áo thun cổ tròn');
  });

  it('throws when nothing usable remains', () => {
    expect(() => composeFashionPrompt([])).toThrow(strings.fashionComposeEmpty);
    expect(() => composeFashionPrompt([JSON.stringify({ type: 'other', summary: 'x' })])).toThrow(
      strings.fashionComposeEmpty,
    );
  });
});

describe('FASHION_SYSTEM', () => {
  it('mọi skill yêu cầu key tiếng Anh, value tiếng Việt, mô tả cụ thể', () => {
    for (const system of Object.values(FASHION_SYSTEM)) {
      expect(system).toContain('Keep every JSON key in English');
      expect(system).toContain('Write every other string value in Vietnamese');
      expect(system).toContain('Be concrete and specific');
    }
  });

  it('mỗi skill chỉ lấy đúng phần của mình', () => {
    expect(FASHION_SYSTEM.fashionModel).toContain('ONLY the FACE');
    expect(FASHION_SYSTEM.fashionModel).toContain('Ignore skin color');
    expect(FASHION_SYSTEM.fashionScene).toContain('skin color');
    expect(FASHION_SYSTEM.fashionOutfit).toContain('ONLY the CLOTHES');
    expect(FASHION_SYSTEM.fashionScene).toContain('Do NOT describe the face features, facial expression or the clothing');
    expect(FASHION_SYSTEM.fashionScene).toContain('accessories');
  });
});

describe('composeFashionPrompt - chỉnh sửa ảnh bối cảnh', () => {
  it('có ảnh bối cảnh: mở đầu bằng lệnh sửa ảnh, gán vai trò đúng nhãn thật', () => {
    const prompt = composeFashionPrompt([scene, outfit, model], {
      scene: ['Background'],
      model: ['Character'],
      outfit: ['Áo mới'],
    });
    const first = prompt.split('\n')[0]!;
    expect(first).toContain('Chỉnh sửa ảnh [Background]');
    expect(first).toContain('giữ nguyên tư thế, dáng người, tóc, màu da, phụ kiện');
    expect(prompt).toContain('Thay khuôn mặt bằng khuôn mặt trong [Character] (chỉ lấy nét mặt và phong cách biểu cảm; màu da giữ theo [Background]');
    expect(prompt).toContain('Thay áo và quần bằng đúng bộ trang phục trong [Áo mới]');
    expect(prompt).toContain('Không giữ lại khuôn mặt và quần áo của người trong [Background]');
    expect(prompt).not.toContain('Ảnh thời trang editorial');
  });

  it('không có ảnh bối cảnh: giữ cách tạo ảnh mới', () => {
    const prompt = composeFashionPrompt([scene, model], { model: ['Character'] });
    expect(prompt.startsWith('Ảnh thời trang editorial')).toBe(true);
    expect(prompt).not.toContain('Chỉnh sửa ảnh');
  });
});

