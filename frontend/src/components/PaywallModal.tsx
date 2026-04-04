import { X, Zap, Check, Lock } from 'lucide-react'

interface PaywallModalProps {
  isOpen: boolean
  onClose: () => void
}

const FREE_FEATURES = [
  '3 active products',
  '4 default categories',
  'Expiry reminders',
  'Barcode scanner',
]

const PREMIUM_FEATURES = [
  'Unlimited products',
  'Unlimited custom categories',
  'All reminder types',
  'Priority support',
  'Early access to new features',
]

export function PaywallModal({ isOpen, onClose }: PaywallModalProps) {
  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Bottom Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl max-w-md mx-auto"
        style={{ animation: 'slideUp 0.25s ease-out' }}
        data-testid="paywall-modal"
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-sage-200" />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* Header row */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center">
                <Lock size={20} className="text-amber-500" />
              </div>
              <div>
                <h2 className="text-[17px] font-bold text-sage-900">Free limit reached</h2>
                <p className="text-[13px] text-sage-500">You're using all 3 free slots</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-sage-400 hover:text-sage-600 hover:bg-sage-100 transition-colors"
              data-testid="paywall-close-btn"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>

          {/* Plan comparison */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            {/* Free plan */}
            <div className="rounded-2xl border border-sage-200 bg-sage-50/60 p-4">
              <p className="text-[11px] font-semibold text-sage-500 uppercase tracking-wider mb-3">Free</p>
              <ul className="space-y-2">
                {FREE_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-sage-600">
                    <Check size={13} className="mt-0.5 shrink-0 text-sage-400" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium plan */}
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50/40 p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-amber-400 text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-xl">
                SOON
              </div>
              <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-3">Premium</p>
              <ul className="space-y-2">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[12px] text-sage-700">
                    <Check size={13} className="mt-0.5 shrink-0 text-amber-500" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* CTA */}
          <button
            disabled
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-amber-100 text-amber-600 font-semibold text-[15px] cursor-not-allowed mb-2"
            data-testid="paywall-upgrade-btn"
          >
            <Zap size={18} />
            Upgrade to Premium
          </button>
          <p className="text-center text-[11px] text-sage-400 mb-3">
            Payments launching soon — stay tuned
          </p>

          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl text-sage-500 text-sm font-medium hover:bg-sage-100 transition-colors"
            data-testid="paywall-maybe-later-btn"
          >
            Maybe Later
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </>
  )
}
