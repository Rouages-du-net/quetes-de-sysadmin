// "Install the game", in the footer of the site's pages (src/layouts/Base.astro).
// Chromium-based browsers (Android, desktop) fire `beforeinstallprompt`
// when the page can be installed: the button then shows, and asks the
// browser's own question. Safari on iOS has no such event: there, a short
// disclosure explains "Share, then Add to Home Screen". Nothing shows when
// the game already runs installed, nor without JavaScript.
// The texts are in the page (data-* attributes and the markup of Base.astro).
// Reference: https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event

// What the footer offers.
export type InstallOffer = 'none' | 'button' | 'ios-help';

export interface InstallContext {
  // The game already runs as an installed app.
  standalone: boolean;
  // The browser has offered to install it (a kept `beforeinstallprompt`).
  prompt: boolean;
  // Safari on an iPhone or an iPad (iPadOS says it is a Mac, with a touch screen).
  ios: boolean;
}

export function installOffer({ standalone, prompt, ios }: InstallContext): InstallOffer {
  if (standalone) return 'none';
  if (prompt) return 'button';
  return ios ? 'ios-help' : 'none';
}

export function isIos(userAgent: string, platform: string, touchPoints: number): boolean {
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === 'MacIntel' && touchPoints > 1);
}

// The event Chromium fires (not in TypeScript's DOM types).
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function wireInstall(doc: Document = document) {
  const box = doc.querySelector<HTMLElement>('[data-install]');
  if (!box) return;
  const button = box.querySelector<HTMLButtonElement>('.install-button');
  const help = box.querySelector<HTMLElement>('.install-ios');
  const status = box.querySelector<HTMLElement>('.install-status');
  const standaloneQuery = matchMedia('(display-mode: standalone)');
  const nav = navigator as Navigator & { standalone?: boolean };
  let deferred: InstallPromptEvent | null = null;

  const show = () => {
    const offer = installOffer({
      standalone: standaloneQuery.matches || nav.standalone === true,
      prompt: deferred !== null,
      ios: isIos(nav.userAgent, nav.platform, nav.maxTouchPoints),
    });
    if (button) button.hidden = offer !== 'button';
    if (help) help.hidden = offer !== 'ios-help';
    box.hidden = offer === 'none' && !status?.textContent;
  };
  const say = (text: string | undefined) => {
    if (status && text) status.textContent = text;
  };

  addEventListener('beforeinstallprompt', (event) => {
    // The browser's own mini-infobar would show otherwise: the footer offers it instead.
    event.preventDefault();
    deferred = event as InstallPromptEvent;
    show();
  });
  addEventListener('appinstalled', () => {
    deferred = null;
    say(box.dataset.installed);
    show();
  });
  standaloneQuery.addEventListener('change', show);
  button?.addEventListener('click', async () => {
    const event = deferred;
    if (!event) return;
    // A prompt can be used once only.
    deferred = null;
    await event.prompt();
    const { outcome } = await event.userChoice;
    say(outcome === 'accepted' ? box.dataset.installing : box.dataset.dismissed);
    show();
    // The button is gone: the keyboard focus goes to the message that replaces it.
    if (button?.hidden) status?.focus();
  });
  show();
}
