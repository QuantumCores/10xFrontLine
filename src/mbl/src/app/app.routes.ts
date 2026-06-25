import { Routes } from '@angular/router';

import { SignInComponent } from './auth/sign-in/sign-in.component';
import { VerifyCodeComponent } from './auth/verify-code/verify-code.component';
import { authGuard } from './core/auth/auth.guard';
import { ProtectedPlaceholderComponent } from './protected/protected-placeholder.component';

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
    component: ProtectedPlaceholderComponent,
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
