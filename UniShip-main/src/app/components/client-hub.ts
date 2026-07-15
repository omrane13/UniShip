import { Component, Input, ChangeDetectionStrategy, signal } from '@angular/core';
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
  
  currentSlide = signal(0);
  slides = [
    {
      title: "Promotions exceptionnelles Fruits & Légumes !",
      desc: "Profitez de -20% sur tous les produits frais bio avec le code BIO20 chez nos partenaires.",
      badge: "OFFRE LIMITÉE",
      bgClass: "from-emerald-600 to-teal-800",
      icon: "local_offer",
      linkText: "Découvrir la sélection"
    },
    {
      title: "Livraison Express garantie localement !",
      desc: "Faites-vous livrer en moins de 30 minutes grâce à notre réseau de livreurs indépendants.",
      badge: "LIVRAISON RAPIDE",
      bgClass: "from-indigo-600 to-violet-850",
      icon: "speed",
      linkText: "Commander maintenant"
    },
    {
      title: "Devenez Partenaire UniShip !",
      desc: "Entreprises, augmentez votre visibilité et profitez de commissions réduites jusqu'à 6%.",
      badge: "PARTENARIAT",
      bgClass: "from-amber-500 to-orange-700",
      icon: "handshake",
      linkText: "Rejoindre le réseau"
    }
  ];

  nextSlide() {
    this.currentSlide.update((val: number) => (val + 1) % this.slides.length);
  }

  prevSlide() {
    this.currentSlide.update((val: number) => (val - 1 + this.slides.length) % this.slides.length);
  }
}
