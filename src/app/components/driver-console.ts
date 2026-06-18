import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { App } from '../app';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-driver-console',
  imports: [CommonModule, MatIconModule],
  templateUrl: './driver-console.html',
})
export class DriverConsole {
  @Input({ required: true }) app!: App;
}
