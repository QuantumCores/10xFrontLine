import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { API_BASE_URL } from './api-base-url';

export type MatchOutcome = 'Victory' | 'Defeat';

export interface CompletedResultRequest {
  clientMatchId: string;
  outcome: MatchOutcome;
  durationSeconds: number;
  completedAt: string;
  finalScore: number;
  finalFrontlinePosition: number;
}

export interface CompletedResultResponse {
  resultId: string;
  clientMatchId: string;
  outcome: MatchOutcome;
  savedAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResultsApiClient {
  private readonly http = inject(HttpClient);
  private readonly apiBaseUrl = inject(API_BASE_URL);

  saveCompletedResult(request: CompletedResultRequest): Observable<CompletedResultResponse> {
    return this.http.post<CompletedResultResponse>(`${this.apiBaseUrl}/results`, request);
  }
}
