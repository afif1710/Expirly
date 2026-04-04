import { formatDistanceToNow, format, isPast } from 'date-fns'
import { Clock, Trash2, Bell } from 'lucide-react'
import type { Product } from '../types'
import ExpiryBadge from './ExpiryBadge'

interface ProductCardProps {
  product: Product
  onDelete?: (id: string) => void
  onEditReminder?: (product: Product) => void
}

export default function ProductCard({ product, onDelete, onEditReminder }: ProductCardProps) {
  const expiryDate = new Date(product.expiry_date)
  const isExpired = isPast(expiryDate)

  const borderColor = {
    fresh: 'border-l-emerald-400',
    expiring_soon: 'border-l-amber-400',
    expired: 'border-l-red-400',
  }[product.expiry_status]

  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border border-sage-100/80 border-l-4 ${borderColor} p-4 transition-all duration-200 hover:shadow-md`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sage-900 truncate text-[15px]">
            {product.product_name}
          </h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-sage-100 text-sage-700 font-medium">
              {product.niche_name}
            </span>
            <ExpiryBadge status={product.expiry_status} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[13px] text-sage-600">
        <Clock size={14} className="shrink-0" />
        <span>
          {isExpired ? 'Expired ' : 'Expires '}
          {formatDistanceToNow(expiryDate, { addSuffix: true })}
        </span>
      </div>

      <div className="mt-1 text-[11px] text-sage-400">
        {format(expiryDate, 'MMM d, yyyy \u00b7 h:mm a')}
      </div>

      {product.product_type && (
        <div className="mt-1 text-[11px] text-sage-400">
          Type: {product.product_type}
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        {!isExpired && onEditReminder && (
          <button
            onClick={() => onEditReminder(product)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-sage-600 bg-sage-50 rounded-xl hover:bg-sage-100 active:scale-[0.98] transition-all"
          >
            <Bell size={13} />
            Edit Reminder
          </button>
        )}
        {isExpired && onDelete && (
          <button
            onClick={() => onDelete(product.id)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 active:scale-[0.98] transition-all"
          >
            <Trash2 size={13} />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}
