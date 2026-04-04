import { api } from '../lib/api';
import type { Product, DashboardData } from '../types';

export const productService = {
  list: (params?: { niche_id?: string; status?: string }): Promise<Product[]> => {
    const searchParams = new URLSearchParams();
    if (params?.niche_id) searchParams.set('niche_id', params.niche_id);
    if (params?.status) searchParams.set('status', params.status);
    const query = searchParams.toString();
    return api.get(`/api/products${query ? `?${query}` : ''}`);
  },

  get: (id: string): Promise<Product> => api.get(`/api/products/${id}`),

  create: (data: {
    niche_id: string;
    product_name: string;
    barcode?: string;
    product_type?: string;
    purchase_date?: string;
    production_date?: string;
    expiry_date: string;
    reminder_offset_hours: number;
  }): Promise<Product> => api.post('/api/products', data),

  updateReminder: (
    id: string,
    data: { reminder_offset_hours?: number; reminder_at?: string }
  ): Promise<Product> => api.patch(`/api/products/${id}/reminder`, data),

  delete: (id: string): Promise<{ message: string }> =>
    api.delete(`/api/products/${id}`),

  dashboard: (): Promise<DashboardData> => api.get('/api/dashboard'),

  alerts: (): Promise<{ alerts: any[]; count: number }> => api.get('/api/alerts'),
};
