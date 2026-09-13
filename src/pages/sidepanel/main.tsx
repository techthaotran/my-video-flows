import { createRoot } from 'react-dom/client';
import { SidePanelApp } from '@/features/sidepanel/SidePanelApp';
import '@/styles/globals.css';
import { bootstrapStorage } from '@/storage/repos/settingsRepo';

void bootstrapStorage().then(() => {
  createRoot(document.getElementById('root')!).render(<SidePanelApp />);
});
