import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import type { App } from '../app';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-client-hub',
  imports: [CommonModule, MatIconModule],
  templateUrl: './client-hub.html',
})
export class ClientHub {
  @Input({ required: true }) app!: App;
}
