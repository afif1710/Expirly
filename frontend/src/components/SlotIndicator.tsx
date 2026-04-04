interface SlotIndicatorProps {
  used: number
  max: number
}

export default function SlotIndicator({ used, max }: SlotIndicatorProps) {
  const percentage = Math.min((used / max) * 100, 100)
  const isFull = used >= max

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-sage-100/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-sage-700">Active Products</span>
        <span
          className={`text-[13px] font-bold ${
            isFull ? 'text-amber-600' : 'text-sage-600'
          }`}
        >
          {used} / {max}
        </span>
      </div>
      <div className="w-full h-2 bg-sage-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${
            isFull ? 'bg-amber-500' : 'bg-sage-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isFull && (
        <p className="text-[11px] text-amber-600 mt-2 font-medium">
          All slots used. Delete expired products to add new ones.
        </p>
      )}
    </div>
  )
}
