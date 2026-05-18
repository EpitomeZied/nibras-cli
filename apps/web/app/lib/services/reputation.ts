import { serviceFetch } from '../api-clients/service-fetch';

export type ReputationEvent = {
  id: string;
  delta: number;
  reason: string;
  source?: string;
  createdAt: string;
};

export type MyReputation = {
  total: number;
  weeklyDelta: number;
  monthlyDelta: number;
  rank?: number;
  percentile?: number;
  history?: ReputationEvent[];
};

export async function getMyReputation(): Promise<MyReputation> {
  return serviceFetch<MyReputation>('admin', '/reputation/me', { auth: true });
}
