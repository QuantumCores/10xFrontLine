import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { SignInComponent } from './sign-in.component';

@Component({
  template: ''
})
class TestRouteComponent {}

describe('SignInComponent', () => {
  let fixture: ComponentFixture<SignInComponent>;
  let authService: Pick<AuthService, 'requestCode'>;

  beforeEach(async () => {
    authService = {
      requestCode: vi.fn().mockReturnValue(of({ message: 'sent' }))
    };

    await TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        provideRouter([
          { path: 'verify-code', component: TestRouteComponent }
        ]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ returnUrl: '/play' }) } }
        },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SignInComponent);
    fixture.detectChanges();
  });

  it('requests a code when the native form submit event fires', () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'player@example.com';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(authService.requestCode).toHaveBeenCalledWith('player@example.com');
    expect(navigate).toHaveBeenCalledWith(['/verify-code'], {
      queryParams: { email: 'player@example.com', returnUrl: '/play' }
    });
  });
});
