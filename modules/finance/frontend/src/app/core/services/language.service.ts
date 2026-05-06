import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Lang = 'it' | 'en' | 'de' | 'es';

export const SUPPORTED_LANGS: { code: Lang; label: string; flag: string }[] = [
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'en', label: 'English',  flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch',  flag: '🇩🇪' },
  { code: 'es', label: 'Español',  flag: '🇪🇸' },
];

const STORAGE_KEY = 'finance_os_lang';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);

  init(): void {
    this.translate.addLangs(['it', 'en', 'de', 'es']);
    this.translate.setDefaultLang('it');
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    const browserLang = this.translate.getBrowserLang() as Lang | undefined;
    const lang: Lang =
      saved ?? (browserLang && ['it','en','de','es'].includes(browserLang) ? browserLang : 'it');
    this.translate.use(lang);
  }

  use(lang: Lang): void {
    this.translate.use(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }

  get current(): Lang {
    return this.translate.currentLang as Lang ?? 'it';
  }
}
