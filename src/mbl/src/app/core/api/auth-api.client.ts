import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api-base-url';

export interface RequestCodeRequest {
  email: string;
}

export interface RequestCodeResponse {
  message: string;
}

export interface VerifyCodeRequest {
  email: string;
  code: string;
}

export interface AuthPlayerResponse {
  id: string;
  email: string;
}

export interface VerifyCodeResponse {
  token: string;
  expiresAt: string;
  player: AuthPlayerResponse;
}

@Injectable({
  providedIn: 'root'
})
export class AuthApiClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  requestCode(request: RequestCodeRequest): Observable<RequestCodeResponse> {
    return this.http.post<RequestCodeResponse>(`${this.apiBaseUrl}/auth/request-code`, request);
  }

  verifyCode(request: VerifyCodeRequest): Observable<VerifyCodeResponse> {
    return this.http.post<VerifyCodeResponse>(`${this.apiBaseUrl}/auth/verify-code`, request);
  }
}
