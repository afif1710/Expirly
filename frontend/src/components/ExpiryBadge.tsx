interface ExpiryBadgeProps {
  status: 'fresh' | 'expiring_soon' | 'expired'
}

const statusConfig = {
  fresh: {
    label: 'Fresh',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
  },
  expiring_soon: {
    label: 'Expiring Soon',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
  },
  expired: {
    label: 'Expired',
    bg: 'bg-red-50',
    text: 'text-red-600',
    dot: 'bg-red-500',
  },
}

export default function ExpiryBadge({ status }: ExpiryBadgeProps) {
  const config = statusConfig[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${config.bg} ${config.text}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  )
}
