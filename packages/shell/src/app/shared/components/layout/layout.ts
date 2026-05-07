import { Component, inject } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { MODULE_REGISTRY } from './module-registry';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './layout.html',
  styleUrl: './layout.scss',
})
export class LayoutComponent {
  private auth = inject(AuthService);
  toast = inject(ToastService);

  user    = this.auth.user;
  modules = MODULE_REGISTRY;

  logout() { this.auth.logout(); }
}
