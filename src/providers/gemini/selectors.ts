/** Selectors for Gemini */

export const geminiSelectors = {
  authAvatar: [{ css: 'img[alt*="Account" i]' }, { ariaLabel: /google account|account/i }],
  signIn: [{ text: /sign in|đăng nhập/i }],
  newChat: [{ ariaLabel: /new chat|đoạn chat mới/i }, { text: /new chat|đoạn chat mới/i }],
  modelPicker: [{ ariaLabel: /model|fast|pro/i }],
  // Ô chat thật nằm trong <rich-textarea>; extension khác (vd Sider) cũng chèn contenteditable.
  input: [
    { css: 'rich-textarea [contenteditable="true"]' },
    { ariaLabel: /enter a prompt|nhập/i },
    { css: '[contenteditable="true"]' },
  ],
  attachmentPreview: [{ css: 'uploader-file-preview' }],
  send: [{ ariaLabel: /send|gửi/i }, { css: 'button[aria-label*="Send" i]' }],
  stop: [{ ariaLabel: /stop|dừng/i }],
  /** Model reply containers; the driver keeps the outermost, last match. */
  lastResponse: [
    {
      css: 'model-response, [data-message-author-role="model"], .model-response, .response-container, message-content',
    },
  ],
  mediaInResponse: [{ css: 'img[src*="google"], video, a[href*="download"]' }],
  createImageTool: [{ text: /create image|tạo hình|image/i }],
  createVideoTool: [{ text: /create video|tạo video|video/i }],
  errorToast: [{ role: 'alert' }, { text: /can't|unable|policy|limit|quota/i }],
} as const;
