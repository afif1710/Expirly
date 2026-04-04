import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const REMINDER_OPTIONS = [
  { label: '1 hour before', value: 1 },
  { label: '6 hours before', value: 6 },
  { label: '12 hours before', value: 12 },
  { label: '1 day before', value: 24 },
  { label: '2 days before', value: 48 },
  { label: '3 days before', value: 72 },
  { label: '1 week before', value: 168 },
  { label: '2 weeks before', value: 336 },
  { label: '1 month before', value: 720 },
] as const;
