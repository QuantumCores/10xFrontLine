import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { normalizeInternalReturnUrl } from '../../core/auth/auth-recovery.service';

@Component({
  selector: 'app-verify-code',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './verify-code.component.html',
  styleUrl: './verify-code.component.scss'
})
export class VerifyCodeComponent {
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly email = new FormControl(this.route.snapshot.queryParamMap.get('email') ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.email]
  });
  protected readonly code = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(4), Validators.maxLength(16)]
  });
  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly returnUrl = normalizeInternalReturnUrl(
    this.route.snapshot.queryParamMap.get('returnUrl')
  );

  submit(event: SubmitEvent): void {
    event.preventDefault();
    this.email.markAsTouched();
    this.code.markAsTouched();
    if (this.email.invalid || this.code.invalid || this.submitting()) {
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);

    this.authService.verifyCode(this.email.value.trim(), this.code.value.trim()).subscribe({
      next: () => {
        void this.router.navigateByUrl(this.returnUrl);
      },
      error: () => {
        this.errorMessage.set('Invalid or expired sign-in code.');
        this.submitting.set(false);
      }
    });
  }
}
