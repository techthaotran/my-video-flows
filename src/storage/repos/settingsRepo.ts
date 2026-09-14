import { db } from '@/storage/db';
import type { AppSettings } from '@/shared/schema';
import { AppSettingsSchema } from '@/shared/schema';
import { workspaceRepo } from '@/storage/repos/workspaceRepo';
import { templateRepo } from '@/storage/repos/templateRepo';
import { ensurePersist } from '@/storage/db';

const SETTINGS_KEY = 'appSettings';
const UI_STATE_KEY = 'uiState';

export interface UiState {
  subTab: 'templates' | 'workflows';
  filter: string;
  search: string;
}

export async function getSettings(): Promise<AppSettings> {
  const raw = await chrome.storage.local.get(SETTINGS_KEY);
  return AppSettingsSchema.parse(raw[SETTINGS_KEY] ?? {});
}

export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = AppSettingsSchema.parse({ ...current, ...patch });
  await chrome.storage.local.set({ [SETTINGS_KEY]: next });
  return next;
}

export async function getUiState(): Promise<UiState> {
  const raw = await chrome.storage.local.get(UI_STATE_KEY);
  return {
    subTab: 'workflows',
    filter: 'all',
    search: '',
    ...(raw[UI_STATE_KEY] as Partial<UiState> | undefined),
  };
}

export async function setUiState(patch: Partial<UiState>): Promise<void> {
  const current = await getUiState();
  await chrome.storage.local.set({ [UI_STATE_KEY]: { ...current, ...patch } });
}

export async function bootstrapStorage(): Promise<void> {
  await ensurePersist();
  await workspaceRepo.ensureDefault();
  await templateRepo.syncBuiltIns();
}

export { db };
