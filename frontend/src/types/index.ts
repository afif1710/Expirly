export interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
  max_active_products: number;
}

export interface AuthResponse {
  user: User;
  token: string;
}

export interface Niche {
  id: string;
  user_id: string;
  niche_name: string;
  niche_type: 'default' | 'custom';
  created_at: string;
  product_count: number;
}

export interface Product {
  id: string;
  user_id: string;
  niche_id: string;
  niche_name: string;
  product_name: string;
  barcode: string | null;
  product_type: string | null;
  purchase_date: string | null;
  production_date: string | null;
  expiry_date: string;
  reminder_at: string;
  reminder_offset_hours: number;
  status: 'active' | 'expired';
  expiry_status: 'fresh' | 'expiring_soon' | 'expired';
  created_at: string;
}

export interface DashboardStats {
  total_active: number;
  expiring_soon: number;
  expired: number;
  max_slots: number;
  slots_used: number;
  slots_available: number;
}

export interface DashboardData {
  stats: DashboardStats;
  products: Product[];
  expiring_soon: Product[];
  fresh: Product[];
  expired: Product[];
}

export interface Alert {
  id: string;
  product_id: string;
  product_name: string;
  niche_name: string;
  expiry_date: string;
  reminder_at: string;
  alert_type: 'upcoming' | 'expiring_today' | 'expired';
  message: string;
}
