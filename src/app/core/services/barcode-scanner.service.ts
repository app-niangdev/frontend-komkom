import { Injectable, NgZone, inject } from '@angular/core';
import { Subject } from 'rxjs';

const SOUND_KEY = 'gstock.scanner.sound';

/**
 * Lecteur code-barres USB / Bluetooth en mode clavier : il « tape » le code très vite puis Entrée.
 * Une fois activé, un scan est capté n'importe où sur la page, sauf dans un champ de saisie
 * (le champ dédié, marqué `data-barcode-scan`, est géré par son composant).
 */
@Injectable({ providedIn: 'root' })
export class BarcodeScannerService {
  private readonly zone = inject(NgZone);
  private readonly scanSubject = new Subject<string>();
  readonly scan$ = this.scanSubject.asObservable();

  /** Au-delà de cet écart entre deux touches, ce n'est plus un lecteur mais une frappe humaine. */
  private readonly interKeyMs = 60;
  private readonly minLength = 3;
  private enabled = false;
  private buffer = '';
  private lastKeyAt = 0;
  private audio: AudioContext | null = null;
  private readonly onKeyDown = (event: KeyboardEvent) => this.handleKey(event);

  enable(): void {
    if (!this.enabled) {
      this.enabled = true;
      this.buffer = '';
      document.addEventListener('keydown', this.onKeyDown, true);
    }
  }

  disable(): void {
    if (this.enabled) {
      this.enabled = false;
      this.buffer = '';
      document.removeEventListener('keydown', this.onKeyDown, true);
    }
  }

  /** Scan venant du champ dédié (saisie + Entrée). */
  emit(code: string): void {
    const trimmed = code.trim();
    if (trimmed.length > 0) {
      this.scanSubject.next(trimmed);
    }
  }

  get soundEnabled(): boolean {
    try {
      return localStorage.getItem(SOUND_KEY) !== 'off';
    } catch {
      return true;
    }
  }

  set soundEnabled(on: boolean) {
    try {
      localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch {
      // stockage indisponible (navigation privée) : réglage non mémorisé
    }
  }

  /** Bip court (accepté) ou grave (refusé) : on scanne sans regarder l'écran. */
  beep(ok: boolean): void {
    if (!this.soundEnabled) {
      return;
    }
    try {
      this.audio ??= new AudioContext();
      const oscillator = this.audio.createOscillator();
      const gain = this.audio.createGain();
      oscillator.type = ok ? 'sine' : 'square';
      oscillator.frequency.value = ok ? 1175 : 220;
      gain.gain.value = ok ? 0.08 : 0.05;
      oscillator.connect(gain).connect(this.audio.destination);
      oscillator.start();
      oscillator.stop(this.audio.currentTime + (ok ? 0.09 : 0.28));
    } catch {
      // Web Audio indisponible : pas de son
    }
  }

  private handleKey(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target && (target.hasAttribute('data-barcode-scan') || this.isEditable(target))) {
      return;
    }

    const now = Date.now();
    if (now - this.lastKeyAt > this.interKeyMs) {
      this.buffer = '';
    }
    this.lastKeyAt = now;

    if (event.key === 'Enter') {
      const code = this.buffer.trim();
      this.buffer = '';
      if (code.length >= this.minLength) {
        event.preventDefault();
        event.stopPropagation();
        this.zone.run(() => this.scanSubject.next(code));
      }
      return;
    }

    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      this.buffer += event.key;
    }
  }

  private isEditable(el: HTMLElement): boolean {
    const tag = el.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
  }
}
