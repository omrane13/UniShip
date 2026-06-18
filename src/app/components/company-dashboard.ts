import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { App } from '../app';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-company-dashboard',
  imports: [CommonModule, MatIconModule],
  templateUrl: './company-dashboard.html',
})
export class CompanyDashboard {
  @Input({ required: true }) app!: App;
}
