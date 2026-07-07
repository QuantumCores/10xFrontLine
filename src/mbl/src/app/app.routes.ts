import { Routes } from '@angular/router';

import { SignInComponent } from './auth/sign-in/sign-in.component';
import { VerifyCodeComponent } from './auth/verify-code/verify-code.component';
import { authGuard } from './core/auth/auth.guard';
import { PhaserGameComponent } from './play/phaser-game.component';

export const routes: Routes = [
  {
    path: 'sign-in',
    component: SignInComponent
  },
  {
    path: 'verify-code',
    component: VerifyCodeComponent
  },
  {
    path: 'play',
    component: PhaserGameComponent,
    canActivate: [authGuard]
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'play'
  },
  {
    path: '**',
    redirectTo: 'play'
  }
];
