import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MODULE_REGISTRY } from '../../shared/components/layout/module-registry';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class DashboardComponent {
  private auth = inject(AuthService);
  user    = this.auth.user;
  modules = MODULE_REGISTRY;
}
