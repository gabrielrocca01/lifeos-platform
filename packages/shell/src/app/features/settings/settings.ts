import { Component, inject } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  template: `
    <div style="padding: 48px 40px; color: #fff">
      <h1 style="font-size: 24px; margin-bottom: 8px">Impostazioni</h1>
      <p style="color: #555">{{ user()?.email }}</p>
    </div>
  `,
})
export class SettingsComponent {
  user = inject(AuthService).user;
}
