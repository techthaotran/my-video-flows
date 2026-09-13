import { defineManifest } from '@crxjs/vite-plugin';
import pkg from './package.json';

/** Public key cố định → extension ID ổn định giữa các lần load unpacked */
const EXTENSION_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoss2N/2CfAnEDESX7ZQFMwLWMyry9eiYC8+pfMPBTgBK/utS5y+DUgFYKWYjhSSuIF/WvPiWaarEy25WVojO3gbf2aLpSQsiLK/Odt8Wkm4j76OD7t0NijrAVq0pC9s+5f0APAIe9U8lkEuLemDJ26Ds2a43Odk003oFfvG/4CFQvE9mbNrMsg3sMpAaCR4QvOKhV0Dp9wqd86AXCERjRM0e1tWLLSrukCSSDMplrNw6XHZdn1v9xfBa3dSKmeRWGxJtzWxFHRolAK9kPE/9poY07tTG2elRTlDss1WEbGVAcCAFyWdR3cVFG7NGqB7qryFsCg05N9CHAHf6nyhhdQIDAQAB';

export default defineManifest({
  manifest_version: 3,
  name: 'My X Flows',
  description: 'Chạy workflow node-based trên Google Flow và Gemini',
  version: pkg.version,
  key: EXTENSION_KEY,
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  side_panel: {
    default_path: 'src/pages/sidepanel/index.html',
  },
  action: {
    default_title: 'My X Flows',
    default_icon: {
      '16': 'public/icons/icon16.png',
      '48': 'public/icons/icon48.png',
      '128': 'public/icons/icon128.png',
    },
  },
  icons: {
    '16': 'public/icons/icon16.png',
    '48': 'public/icons/icon48.png',
    '128': 'public/icons/icon128.png',
  },
  permissions: [
    'sidePanel',
    'storage',
    'unlimitedStorage',
    'downloads',
    'alarms',
    'scripting',
    'offscreen',
    'notifications',
    'tabs',
  ],
  host_permissions: [
    'https://flow.google.com/*',
    'https://flow-content.google/*',
    'https://labs.google/*',
    'https://gemini.google.com/*',
  ],
  content_scripts: [
    {
      matches: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
      js: ['src/providers/flow/injected/captcha.ts'],
      run_at: 'document_start',
      // @ts-expect-error CRXJS Manifest types omit MV3 content_scripts.world
      world: 'MAIN',
    },
    {
      matches: ['https://flow.google.com/*', 'https://labs.google/fx/*'],
      js: ['src/content/flow/index.ts'],
      run_at: 'document_start',
    },
    {
      matches: ['https://gemini.google.com/*'],
      js: ['src/content/gemini/index.ts'],
      run_at: 'document_idle',
    },
  ],
  web_accessible_resources: [
    {
      resources: ['assets/*'],
      matches: [
        'https://flow.google.com/*',
        'https://labs.google/*',
        'https://gemini.google.com/*',
      ],
    },
  ],
});
