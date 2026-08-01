import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { normalizeInternalReturnUrl } from '../../core/auth/auth-recovery.service';

@Component({
  selector: 'app-sign-in',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './sign-in.component.html',
  styleUrl: './sign-in.component.scss'
})
export class SignInComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly email = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email]
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly returnUrl = normalizeInternalReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl')
  );

  submit(event: SubmitEvent): void {
    event.preventDefault();
    this.email.markAsTouched();
    if (this.email.invalid || this.submitting()) {
      return;
    }

    const email = this.email.value.trim();
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.requestCode(email).subscribe({
      next: () => {
        void this.router.navigate(['/verify-code'], {
          queryParams: {
            email,
            returnUrl: this.returnUrl
          }
        });
      },
      error: () => {
        this.errorMessage.set('Unable to request a sign-in code. Try again.');
        this.submitting.set(false);
      }
    });
  }
}
