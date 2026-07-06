import {bootstrapApplication} from '@angular/platform-browser';
import {App} from './app/app';
import {appConfig} from './app/app.config';

if (typeof window !== 'undefined') {
  // Gracefully intercept and suppress MetaMask or Web3 exceptions/promises
  // thrown by browser extensions running within sandboxed preview iframes.
  const isMetaMaskError = (msg: string | null | undefined): boolean => {
    if (!msg) return false;
    const lower = msg.toLowerCase();
    return lower.includes('metamask') || lower.includes('ethereum') || lower.includes('web3');
  };

  window.addEventListener('error', (event) => {
    if (event.message && isMetaMaskError(event.message)) {
      event.preventDefault();
      event.stopPropagation();
      console.warn('[UniShip Sandbox Logger] Intercepted MetaMask browser extension error:', event.message);
    }
  }, true);

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const msg = reason?.message || (reason ? String(reason) : '');
    if (msg && isMetaMaskError(msg)) {
      event.preventDefault();
      event.stopPropagation();
      console.warn('[UniShip Sandbox Logger] Intercepted MetaMask browser extension rejection:', msg);
    }
  }, true);
}

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
