/** Selectors for Google Flow — cập nhật khi UI đổi; có thể ghi đè bằng remote config */

export const flowSelectors = {
  authAvatar: [{ css: 'img[alt*="Account" i]' }, { ariaLabel: /account|profile|avatar/i }],
  signIn: [
    { role: 'button', name: /^(sign in|đăng nhập|log in)$/i },
    { text: /^(sign in|đăng nhập|log in)$/i },
  ],
  newProject: [
    { role: 'button', name: /new project|dự án mới|create project|tạo dự án/i },
    { text: /new project|dự án mới|create project|tạo dự án/i },
    { ariaLabel: /new project|dự án mới/i },
  ],
  modeDropdown: [{ ariaLabel: /mode|cách tạo/i }, { text: /text.to.video|frames|ingredients/i }],
  /** Tab/chip chọn loại output trên prompt bar */
  outputVideo: [
    { role: 'button', name: /^(video|vidéo)$/i },
    { role: 'tab', name: /^(video|vidéo)$/i },
    { text: /^(video|vidéo)$/i },
    { ariaLabel: /^(video|vidéo)$/i },
  ],
  outputImage: [
    { role: 'button', name: /^(image|ảnh|photo|imagen)$/i },
    { role: 'tab', name: /^(image|ảnh|photo|imagen)$/i },
    { text: /^(image|ảnh|photo|imagen)$/i },
    { ariaLabel: /^(image|ảnh|photo)$/i },
  ],
  framesMode: [
    { role: 'button', name: /frames|frame|ảnh đầu|start.?end/i },
    { text: /frames|frame to video|ảnh đầu/i },
  ],
  ingredientsMode: [
    { role: 'button', name: /ingredients|ingredient|thành phần|reference/i },
    { text: /ingredients|ingredient|thành phần/i },
  ],
  modelPicker: [{ ariaLabel: /model|mô hình/i }],
  aspectRatio: [{ ariaLabel: /aspect|tỷ lệ/i }],
  promptInput: [
    { placeholder: /prompt|describe|mô tả|ý tưởng|scene|what do you want/i },
    { ariaLabel: /prompt|describe|mô tả|ý tưởng/i },
    { role: 'textbox', name: /prompt|describe|mô tả/i },
    { css: 'textarea:not([disabled]):not([aria-hidden="true"])' },
    { css: '[contenteditable="true"]:not([aria-hidden="true"])' },
    { css: '[role="textbox"]' },
  ],
  generateButton: [
    { role: 'button', name: /^(generate|tạo|créer|create)$/i },
    { ariaLabel: /^(generate|tạo|créer)$/i },
    { text: /^(generate|tạo|créer)$/i },
    { role: 'button', name: /generate|tạo video|tạo ảnh|create video|create image/i },
    { css: 'button[type="submit"]' },
  ],
  fileInput: [{ css: 'input[type="file"]' }],
  addMedia: [
    { ariaLabel: /add|upload|ingredient|frame|media|thêm|reference/i },
    { text: /upload|add image|add video|add media|thêm/i },
    { role: 'button', name: /upload|add image|add video|ingredient|frame/i },
  ],
  resultGrid: [{ css: '[class*="grid"], [class*="gallery"], [class*="result"], main' }],
  resultItem: [{ css: 'video, img[src*="blob"], img[src*="google"]' }],
  /** Gallery / history / project media (pick existing assets) */
  mediaLibrary: [
    { css: '[class*="gallery"]' },
    { css: '[class*="history"]' },
    { css: '[class*="project"]' },
    { css: '[class*="grid"]' },
    { css: 'main' },
  ],
  mediaLibraryItem: [
    { css: 'video[src]' },
    { css: 'img[src*="google"]' },
    { css: 'img[src*="blob"]' },
    { css: 'img[src*="lh3"]' },
    { css: 'img[src*="ggpht"]' },
  ],
  progress: [{ text: /%/ }, { ariaLabel: /progress|generating/i }],
  errorToast: [{ role: 'alert' }, { text: /policy|quota|credit|limit|error|lỗi/i }],
  download: [{ text: /download|tải/i }, { ariaLabel: /download/i }],
} as const;

export type FlowSelectorKey = keyof typeof flowSelectors;
