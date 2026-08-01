import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { VerifyCodeComponent } from './verify-code.component';

@Component({
  template: ''
})
class TestRouteComponent {}

describe('VerifyCodeComponent', () => {
  let fixture: ComponentFixture<VerifyCodeComponent>;
  let authService: Pick<AuthService, 'verifyCode'>;

  beforeEach(async () => {
    authService = {
      verifyCode: vi.fn().mockReturnValue(of({
        token: 'jwt-token',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        player: {
          id: 'player-1',
          email: 'player@example.com'
        }
      }))
    };

    await TestBed.configureTestingModule({
      imports: [VerifyCodeComponent],
      providers: [
        provideRouter([
          { path: 'play', component: TestRouteComponent }
        ]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ email: 'player@example.com', returnUrl: '/play' })
            }
          }
        },
        { provide: AuthService, useValue: authService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(VerifyCodeComponent);
    fixture.detectChanges();
  });

  it('verifies a code when the native form submit event fires', () => {
    const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const inputs = fixture.nativeElement.querySelectorAll('input') as NodeListOf<HTMLInputElement>;
    inputs[0].value = 'player@example.com';
    inputs[0].dispatchEvent(new Event('input'));
    inputs[1].value = '123456';
    inputs[1].dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const event = new Event('submit', { cancelable: true });
    form.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(authService.verifyCode).toHaveBeenCalledWith('player@example.com', '123456');
    expect(navigateByUrl).toHaveBeenCalledOnce();
    expect(navigateByUrl).toHaveBeenCalledWith('/play');
  });
});
