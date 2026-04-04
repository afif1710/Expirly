import { useState, useEffect, useCallback } from 'react'
import {
  Bell, BellOff, AlertTriangle, Clock, Archive,
  RefreshCw, Trash2
} from 'lucide-react'
import {
  differenceInHours, differenceInDays, differenceInMinutes,
  format, isPast, isToday
} from 'date-fns'
import { productService } from '../services/productService'
import type { Alert } from '../types'

// ── Time chip helper ───────────────────────────────────────────────────────

function timeUntilExpiry(expiry: Date): { label: string; urgent: boolean } {
  const now = new Date()
  if (isPast(expiry)) {
    const daysAgo = differenceInDays(now, expiry)
    const hoursAgo = differenceInHours(now, expiry)
    if (daysAgo >= 1) return { label: `${daysAgo}d ago`, urgent: false }
    return { label: `${hoursAgo}h ago`, urgent: false }
  }
  const totalHours = differenceInHours(expiry, now)
  const totalMins = differenceInMinutes(expiry, now)
  if (totalMins < 60) return { label: `${totalMins}m`, urgent: true }
  if (totalHours < 24) return { label: `${totalHours}h`, urgent: true }
  const days = differenceInDays(expiry, now)
  return { label: `${days}d`, urgent: days <= 2 }
}

// ── Section component ──────────────────────────────────────────────────────

interface SectionProps {
  title: string
  count: number
  accentClass: string
  children: React.ReactNode
}

function AlertSection({ title, count, accentClass, children }: SectionProps) {
  if (count === 0) return null
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span className={`text-[11px] font-bold uppercase tracking-widest ${accentClass}`}>
          {title}
        </span>
        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-white border ${accentClass} opacity-70`}>
          {count}
        </span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  )
}

// ── Alert card ─────────────────────────────────────────────────────────────

interface AlertCardConfig {
  bg: string
  border: string
  iconColor: string
  Icon: React.ElementType
}

const CONFIG: Record<Alert['alert_type'], AlertCardConfig> = {
  expiring_today: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    iconColor: 'text-red-500',
    Icon: AlertTriangle,
  },
  upcoming: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    Icon: Clock,
  },
  expired: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    iconColor: 'text-gray-400',
    Icon: Archive,
  },
}

interface AlertCardProps {
  alert: Alert
}

function AlertCard({ alert }: AlertCardProps) {
  const cfg = CONFIG[alert.alert_type]
  const Icon = cfg.Icon
  const expiry = new Date(alert.expiry_date)
  const { label: timeLabel, urgent } = timeUntilExpiry(expiry)

  return (
    <div
      className={`${cfg.bg} border ${cfg.border} rounded-2xl p-4`}
      data-testid={`alert-card-${alert.alert_type}`}
    >
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 shrink-0 ${cfg.iconColor}`}>
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-sage-900 leading-snug truncate">
            {alert.product_name}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/70 text-sage-600 font-medium border border-sage-200/60">
              {alert.niche_name}
            </span>
            <span className="text-[11px] text-sage-500">
              {isToday(expiry) ? 'Today' : format(expiry, 'MMM d')}
            </span>
          </div>
        </div>

        {/* Time chip */}
        <div
          className={`shrink-0 px-2.5 py-1 rounded-xl text-[12px] font-bold ${
            alert.alert_type === 'expired'
              ? 'bg-gray-100 text-gray-500'
              : urgent
              ? 'bg-red-100 text-red-700'
              : 'bg-amber-100 text-amber-700'
          }`}
          data-testid="time-chip"
        >
          {timeLabel}
        </div>
      </div>

      {/* Expired hint */}
      {alert.alert_type === 'expired' && (
        <p className="text-[11px] text-gray-400 mt-2 ml-7">
          Delete from Dashboard to free up a slot
        </p>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function Alerts() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true)
      const result = await productService.alerts()
      setAlerts(result.alerts || [])
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load alerts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAlerts()
  }, [fetchAlerts])

  if (loading) {
    return (
      <div className="p-5 space-y-4" data-testid="alerts-loading">
        <div className="h-7 w-24 bg-sage-200 rounded-lg animate-pulse" />
        <div className="h-4 w-40 bg-sage-100 rounded animate-pulse" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[72px] bg-sage-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  const today = alerts.filter((a) => a.alert_type === 'expiring_today')
  const upcoming = alerts.filter((a) => a.alert_type === 'upcoming')
  const expired = alerts.filter((a) => a.alert_type === 'expired')
  const hasAny = alerts.length > 0

  return (
    <div className="p-5 space-y-5" data-testid="alerts-page">
      {/* Header */}
      <div className="pt-2 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-sage-900">Reminders</h1>
          <p className="text-[13px] text-sage-500 mt-0.5">
            {hasAny ? `${alerts.length} active reminder${alerts.length !== 1 ? 's' : ''}` : 'All clear'}
          </p>
        </div>
        <button
          onClick={fetchAlerts}
          className="p-2 rounded-xl text-sage-400 hover:text-sage-600 hover:bg-sage-100 transition-colors"
          data-testid="refresh-alerts-btn"
          aria-label="Refresh"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm flex items-center gap-2">
          <AlertTriangle size={16} className="shrink-0" />
          {error}
        </div>
      )}

      {!hasAny ? (
        /* ── All-clear empty state ── */
        <div className="text-center py-14 space-y-3" data-testid="alerts-empty">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sage-100 text-sage-400">
            <BellOff size={30} />
          </div>
          <div>
            <h3 className="text-[16px] font-semibold text-sage-800">No active reminders</h3>
            <p className="text-[13px] text-sage-500 mt-1 max-w-[220px] mx-auto leading-relaxed">
              Reminders appear here once your set reminder time is reached
            </p>
          </div>
          <div className="pt-2 text-[11px] text-sage-400 space-y-1">
            <p>Reminders are based on each product's reminder setting.</p>
            <p>Add products and set expiry dates to get started.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* TODAY */}
          <AlertSection
            title="Expires Today"
            count={today.length}
            accentClass="text-red-500"
          >
            {today.map((a) => <AlertCard key={a.id} alert={a} />)}
          </AlertSection>

          {/* UPCOMING */}
          <AlertSection
            title="Upcoming"
            count={upcoming.length}
            accentClass="text-amber-600"
          >
            {upcoming.map((a) => <AlertCard key={a.id} alert={a} />)}
          </AlertSection>

          {/* EXPIRED */}
          <AlertSection
            title="Already Expired"
            count={expired.length}
            accentClass="text-gray-500"
          >
            {expired.map((a) => <AlertCard key={a.id} alert={a} />)}
          </AlertSection>
        </div>
      )}

      {/* Push notification groundwork note */}
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-sage-50 border border-sage-200/60">
        <Bell size={15} className="text-sage-400 shrink-0" />
        <p className="text-[11px] text-sage-500 leading-relaxed">
          Alerts are shown when you open the app.
          Enable push notifications in <span className="font-semibold">Profile → Notifications</span> to
          get notified when the app is closed (coming soon).
        </p>
      </div>
    </div>
  )
}
