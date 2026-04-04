import { Snowflake, Package, Pill, Sparkles, Folder, Trash2 } from 'lucide-react'
import type { Niche } from '../types'

const nicheIcons: Record<string, React.ComponentType<{ size?: number }>> = {
  Fridge: Snowflake,
  Pantry: Package,
  Medicine: Pill,
  Cosmetics: Sparkles,
}

interface NicheCardProps {
  niche: Niche
  onDelete?: (id: string) => void
  onClick?: (niche: Niche) => void
  selected?: boolean
}

export default function NicheCard({ niche, onDelete, onClick, selected }: NicheCardProps) {
  const Icon = nicheIcons[niche.niche_name] || Folder

  return (
    <div
      onClick={() => onClick?.(niche)}
      data-testid={`niche-card-${niche.niche_name.toLowerCase().replace(/\s+/g, '-')}`}
      className={`bg-white rounded-2xl shadow-sm border p-4 transition-all duration-200 hover:shadow-md ${
        selected
          ? 'border-sage-500 ring-2 ring-sage-500/20 bg-sage-50/50'
          : 'border-sage-100/80'
      } ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${
              selected ? 'bg-sage-500 text-white' : 'bg-sage-100 text-sage-600'
            }`}
          >
            <Icon size={20} />
          </div>
          <div>
            <h3 className="font-semibold text-sage-900 text-[15px]">{niche.niche_name}</h3>
            <p className="text-[12px] text-sage-500 mt-0.5">
              {niche.product_count} product{niche.product_count !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {niche.niche_type === 'custom' && niche.product_count === 0 && onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDelete(niche.id)
            }}
            className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  )
}
