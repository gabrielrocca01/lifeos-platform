import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RefreshService {
  // Emette dopo ogni import CSV riuscito
  private _importDone$ = new Subject<void>();
  importDone$ = this._importDone$.asObservable();

  triggerImportDone(): void {
    this._importDone$.next();
  }
}