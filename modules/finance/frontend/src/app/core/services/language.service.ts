import { Injectable } from '@angular/core';

export type Lang = 'it';

export const SUPPORTED_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

@Injectable({ providedIn: 'root' })
export class LanguageService {
  init(): void {}
  use(_lang: Lang): void {}
  get current(): Lang { return 'it'; }
}
