/** Selectors for Gemini */

export const geminiSelectors = {
  authAvatar: [{ css: 'img[alt*="Account" i]' }, { ariaLabel: /google account|account/i }],
  signIn: [{ text: /sign in|đăng nhập/i }],
  newChat: [{ ariaLabel: /new chat|đoạn chat mới/i }, { text: /new chat|đoạn chat mới/i }],
  modelPicker: [{ ariaLabel: /model|fast|pro/i }],
  input: [{ css: '[contenteditable="true"]' }, { css: 'rich-textarea' }, { ariaLabel: /enter a prompt|nhập/i }],
  attach: [{ ariaLabel: /upload|attach|image|thêm/i }],
  fileInput: [{ css: 'input[type="file"]' }],
  send: [{ ariaLabel: /send|gửi/i }, { css: 'button[aria-label*="Send" i]' }],
  stop: [{ ariaLabel: /stop|dừng/i }],
  lastResponse: [{ css: 'message-content, .model-response, [data-response]' }],
  mediaInResponse: [{ css: 'img[src*="google"], video, a[href*="download"]' }],
  createImageTool: [{ text: /create image|tạo hình|image/i }],
  createVideoTool: [{ text: /create video|tạo video|video/i }],
  errorToast: [{ role: 'alert' }, { text: /can't|unable|policy|limit|quota/i }],
} as const;
