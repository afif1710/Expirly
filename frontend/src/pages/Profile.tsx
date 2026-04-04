import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { LogOut, User, Shield, Clock, Zap, Bell, BellOff, BellRing, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { PaywallModal } from '../components/PaywallModal'
import { useNotificationPermission } from '../hooks/useNotificationPermission'

const PREF_KEY = 'expirly_notif_prefs'

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || '{}')
  } catch { return {} }
}

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [avatarUrl, setAvatarUrl] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)
  const {
    permission,
    requestPermission,
    ensurePushSubscription,
    isSupported,
    isGranted,
    isDenied,
    subscriptionStatus,
    subscriptionError,
  } = useNotificationPermission()
  const [requestingPerm, setRequestingPerm] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata || {}
      setAvatarUrl(meta.avatar_url || meta.picture || '')
    })
  }, [])

  const handleLogout = async () => {
    if (window.confirm('Sign out of Expirly?')) {
      await logout()
      navigate('/login', { replace: true })
    }
  }

  const handleRequestPermission = async () => {
    setRequestingPerm(true)
    const result = await requestPermission()
    let subscribed = result !== 'granted'

    if (result === 'granted') {
      subscribed = await ensurePushSubscription()
    }

    setRequestingPerm(false)

    if (subscribed) {
      const prefs = loadPrefs()
      localStorage.setItem(PREF_KEY, JSON.stringify({ ...prefs, push_enabled: true }))
    }
  }

  const permLabel = () => {
    if (!isSupported) return { text: 'Not supported', color: 'text-gray-400', Icon: BellOff }
    if (subscriptionStatus === 'registering') {
      return { text: 'Setting up push...', color: 'text-sage-500', Icon: Bell }
    }
    if (isGranted && subscriptionStatus === 'error') {
      return { text: 'Permission granted, setup failed', color: 'text-amber-600', Icon: BellOff }
    }
    if (isGranted) return { text: 'Enabled', color: 'text-emerald-600', Icon: BellRing }
    if (isDenied) return { text: 'Blocked in browser', color: 'text-red-500', Icon: BellOff }
    return { text: 'Not enabled', color: 'text-sage-500', Icon: Bell }
  }

  const { text: permText, color: permColor, Icon: PermIcon } = permLabel()

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="pt-2">
        <h1 className="text-xl font-bold text-sage-900">Profile</h1>
        <p className="text-[13px] text-sage-500 mt-0.5">Account settings</p>
      </div>

      {/* User Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-sage-100/80 p-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={user?.name || 'Avatar'}
              referrerPolicy="no-referrer"
              className="w-14 h-14 rounded-2xl object-cover ring-2 ring-sage-100"
              data-testid="user-avatar-img"
              onError={() => setAvatarUrl('')}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-2xl bg-sage-100 flex items-center justify-center"
              data-testid="user-avatar-placeholder"
            >
              {user?.name ? (
                <span className="text-xl font-semibold text-sage-600">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              ) : (
                <User size={28} className="text-sage-500" />
              )}
            </div>
          )}
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-sage-900 truncate">{user?.name}</h2>
            <p className="text-[13px] text-sage-500 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Plan Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-sage-100/80 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Shield size={20} className="text-sage-500" />
            <h3 className="text-[15px] font-semibold text-sage-900">Free Plan</h3>
          </div>
          <span className="text-[11px] font-medium text-sage-400 bg-sage-100 px-2 py-0.5 rounded-full">
            {user?.max_active_products || 3} products
          </span>
        </div>
        <p className="text-[13px] text-sage-600 mb-3">
          Track up to <span className="font-semibold">{user?.max_active_products || 3} active products</span>.
          Delete expired ones to free slots.
        </p>
        <button
          onClick={() => setShowPaywall(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 active:scale-[0.99] transition-all"
          data-testid="profile-upgrade-btn"
        >
          <Zap size={16} className="text-amber-500" />
          Upgrade to Premium
        </button>
      </div>

      {/* Notification Preferences */}
      <div className="bg-white rounded-2xl shadow-sm border border-sage-100/80 p-5 space-y-3">
        <div className="flex items-center gap-3">
          <Bell size={20} className="text-sage-500" />
          <h3 className="text-[15px] font-semibold text-sage-900">Notifications</h3>
        </div>

        {/* Push permission row */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-2.5">
            <PermIcon size={16} className={permColor} />
            <div>
              <p className="text-[13px] font-medium text-sage-800">Push notifications</p>
              <p className={`text-[11px] ${permColor}`} data-testid="push-notification-status-text">{permText}</p>
            </div>
          </div>
          {!isGranted && !isDenied && isSupported && (
            <button
              onClick={handleRequestPermission}
              disabled={requestingPerm}
              className="px-3 py-1.5 rounded-xl bg-sage-100 text-sage-700 text-[12px] font-semibold hover:bg-sage-200 active:scale-[0.97] transition-all disabled:opacity-50"
              data-testid="enable-push-btn"
            >
              {requestingPerm ? 'Asking…' : 'Enable'}
            </button>
          )}
          {isDenied && (
            <span className="text-[11px] text-sage-400">Allow in browser settings</span>
          )}
          {isGranted && (
            <span
              className="text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full"
              data-testid="push-notification-active-badge"
            >
              Active
            </span>
          )}
        </div>

        {subscriptionError && (
          <p className="text-[11px] text-amber-600" data-testid="push-notification-error-text">
            {subscriptionError}
          </p>
        )}

        <div className="border-t border-sage-100 pt-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-sage-700">Reminder delivery</p>
              <p className="text-[11px] text-sage-400 mt-0.5" data-testid="reminder-delivery-status-text">
                {subscriptionStatus === 'subscribed'
                  ? 'In-app alerts active · Browser push subscription saved'
                  : 'In-app alerts active · Browser push setup available'}
              </p>
            </div>
            <ChevronRight size={16} className="text-sage-300" />
          </div>
        </div>
      </div>

      {/* App Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-sage-100/80 p-5">
        <div className="flex items-center gap-3 mb-2">
          <Clock size={20} className="text-sage-500" />
          <h3 className="text-[15px] font-semibold text-sage-900">About Expirly</h3>
        </div>
        <p className="text-[13px] text-sage-600">Version 2.0 · Google Sign-In active</p>
        <p className="text-[11px] text-sage-400 mt-1">
          Track product expiry dates and get reminded before they expire.
        </p>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        data-testid="logout-btn"
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-200 text-red-600 font-semibold text-[15px] hover:bg-red-50 active:scale-[0.99] transition-all"
      >
        <LogOut size={18} />
        Sign Out
      </button>

      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  )
}
