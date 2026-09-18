import { createRoot } from 'react-dom/client';
import { RunnerApp } from '@/features/runner/RunnerApp';
import '@/styles/globals.css';
import { bootstrapStorage } from '@/storage/repos/settingsRepo';
import { createLogger, setLogOrigin } from '@/shared/log';

setLogOrigin('ui');
const log = createLogger('ui');

function isBenignResizeObserverError(message: string): boolean {
  return (
    message.includes('ResizeObserver loop completed with undelivered notifications') ||
    message.includes('ResizeObserver loop limit exceeded')
  );
}

window.addEventListener('error', (e) => {
  if (isBenignResizeObserverError(e.message)) {
    e.stopImmediatePropagation();
    return;
  }
  log.error(`Uncaught: ${e.message}`, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as unknown;
  log.error(`Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`, reason);
});

void bootstrapStorage().then(() => {
  createRoot(document.getElementById('root')!).render(<RunnerApp />);
});
