import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { App } from '../app';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-admin-dashboard',
  imports: [CommonModule, MatIconModule],
  templateUrl: './admin-dashboard.html',
})
export class AdminDashboard {
  @Input({ required: true }) app!: App;
}
