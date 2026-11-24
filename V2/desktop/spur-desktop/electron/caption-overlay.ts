import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

export interface CaptionView {
  label: string;
  committed: string;
  partial: string;
}

/** A passive window separate from the main renderer that owns microphone capture. */
export class CaptionOverlay {
  private window?: BrowserWindow;
  private view: CaptionView | null = null;
  private displayId?: number;
  private loaded = false;
  private disposed = false;

  update(view: CaptionView | null): void {
    if (this.disposed) return;
    if (!view) {
      if (this.view) {
        this.window?.hide();
        if (this.loaded) this.window?.webContents.send('spur:caption', null);
      }
      this.view = null;
      this.displayId = undefined;
      return;
    }

    // The overlay only displays the latest lines; the full transcript stays in the app.
    const next = { label: view.label.slice(0, 140), committed: view.committed.slice(-900), partial: view.partial.slice(-900) };
    if (this.window && next.label === this.view?.label && next.committed === this.view.committed && next.partial === this.view.partial) return;
    const opening = this.view === null;
    this.view = next;
    if (opening) this.displayId = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).id;
    if (!this.window) {
      this.create();
      this.position();
    } else if (opening) this.position();
    if (this.loaded) this.render();
  }

  private position = (): void => {
    if (!this.window || !this.view) return;
    const display = screen.getAllDisplays().find(item => item.id === this.displayId)
      ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    this.displayId = display.id;
    const area = display.workArea;
    const width = Math.max(1, Math.min(536, area.width - 24));
    this.window.setBounds({ x: Math.round(area.x + (area.width - width) / 2), y: area.y + 8, width, height: 120 });
  };

  private create(): void {
    const window = this.window = new BrowserWindow({
      title: 'Spur live captions', width: 536, height: 120, frame: false, show: false,
      transparent: true, backgroundColor: '#00000000', hasShadow: false, resizable: false,
      alwaysOnTop: true, focusable: false, skipTaskbar: true,
      ...(process.platform === 'darwin' ? { type: 'panel', fullscreenable: false } : {}),
      webPreferences: {
        preload: path.join(__dirname, 'caption-preload.cjs'), sandbox: true,
        contextIsolation: true, nodeIntegration: false, backgroundThrottling: false,
      },
    });
    if (process.platform === 'darwin') {
      window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true, skipTransformProcessType: true });
    }
    window.setIgnoreMouseEvents(true);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    screen.on('display-added', this.position);
    screen.on('display-removed', this.position);
    screen.on('display-metrics-changed', this.position);
    window.once('closed', () => {
      screen.off('display-added', this.position);
      screen.off('display-removed', this.position);
      screen.off('display-metrics-changed', this.position);
      this.window = undefined;
      this.loaded = false;
    });
    window.webContents.on('render-process-gone', () => { if (!window.isDestroyed()) window.destroy(); });
    void window.loadURL('spur://app/captions.html').then(() => {
      if (window.isDestroyed()) return;
      this.loaded = true;
      this.render();
    }).catch(() => { if (!window.isDestroyed()) window.destroy(); });
  }

  private render(): void {
    if (!this.window || !this.view) return;
    this.window.webContents.send('spur:caption', this.view);
    if (!this.window.isVisible()) this.window.showInactive();
  }

  dispose(): void {
    this.disposed = true;
    this.view = null;
    this.window?.destroy();
  }
}
