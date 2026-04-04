import { api } from '../lib/api';
import type { Niche } from '../types';

export const nicheService = {
  list: (): Promise<Niche[]> => api.get('/api/niches'),

  create: (niche_name: string): Promise<Niche> =>
    api.post('/api/niches', { niche_name }),

  delete: (id: string): Promise<{ message: string }> =>
    api.delete(`/api/niches/${id}`),
};
