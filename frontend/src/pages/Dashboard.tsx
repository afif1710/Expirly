import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, RefreshCw, Package, Zap } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { productService } from '../services/productService'
import ProductCard from '../components/ProductCard'
import SlotIndicator from '../components/SlotIndicator'
import Modal from '../components/Modal'
import { PaywallModal } from '../components/PaywallModal'
import type { Product, DashboardData } from '../types'
import { REMINDER_OPTIONS } from '../lib/utils'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [selectedOffset, setSelectedOffset] = useState(24)
  const [actionLoading, setActionLoading] = useState(false)
  const [reminderSaved, setReminderSaved] = useState(false)
  const [showPaywall, setShowPaywall] = useState(false)

  const handleAddClick = () => {
    if (stats && stats.slots_used >= stats.max_slots) {
      setShowPaywall(true)
    } else {
      navigate('/add')
    }
  }

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true)
      const result = await productService.dashboard()
      setData(result)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Delete this expired product? This will free up one slot.')) return
    try {
      setActionLoading(true)
      await productService.delete(productId)
      await fetchDashboard()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  const handleEditReminder = (product: Product) => {
    setEditingProduct(product)
    setSelectedOffset(product.reminder_offset_hours)
  }

  const handleSaveReminder = async () => {
    if (!editingProduct) return
    try {
      setActionLoading(true)
      await productService.updateReminder(editingProduct.id, {
        reminder_offset_hours: selectedOffset,
      })
      setReminderSaved(true)
      await fetchDashboard()
      setTimeout(() => {
        setReminderSaved(false)
        setEditingProduct(null)
      }, 1200)
    } catch (err: any) {
      setError(err.message || 'Failed to update reminder')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 w-40 bg-sage-200 rounded-lg animate-pulse" />
        <div className="h-20 bg-sage-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-sage-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-sage-100 rounded-2xl animate-pulse" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={fetchDashboard}
            className="px-4 py-2 rounded-xl bg-sage-500 text-white text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const stats = data?.stats
  const hasProducts = data && data.products.length > 0

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-sage-900">
            Hi, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-[13px] text-sage-500 mt-0.5">Track your products</p>
        </div>
        <button
          onClick={fetchDashboard}
          className="p-2.5 rounded-xl bg-white border border-sage-100 text-sage-500 hover:text-sage-700 hover:bg-sage-50 transition-colors"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Slot Indicator */}
      {stats && <SlotIndicator used={stats.slots_used} max={stats.max_slots} />}

      {/* At-limit upgrade banner */}
      {stats && stats.slots_used >= stats.max_slots && (
        <button
          onClick={() => setShowPaywall(true)}
          className="w-full flex items-center justify-between px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 hover:bg-amber-100 active:scale-[0.99] transition-all"
          data-testid="upgrade-banner-btn"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center">
              <Zap size={16} className="text-amber-500" />
            </div>
            <div className="text-left">
              <p className="text-[13px] font-semibold text-amber-800">All 3 free slots used</p>
              <p className="text-[11px] text-amber-600">Upgrade for unlimited tracking</p>
            </div>
          </div>
          <span className="text-[12px] font-semibold text-amber-700 bg-amber-100 px-2.5 py-1 rounded-lg">
            Upgrade
          </span>
        </button>
      )}

      {/* Empty State */}
      {!hasProducts && (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sage-100 text-sage-400 mb-4">
            <Package size={32} />
          </div>
          <h3 className="text-lg font-semibold text-sage-800">No products yet</h3>
          <p className="text-sm text-sage-500 mt-1 mb-6">
            Start by adding your first product to track
          </p>
          <button
            onClick={handleAddClick}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sage-500 text-white text-sm font-semibold hover:bg-sage-600 transition-colors shadow-sm"
            data-testid="empty-add-btn"
          >
            <Plus size={18} />
            Add Product
          </button>
        </div>
      )}

      {/* Expiring Soon Section */}
      {data && data.expiring_soon.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-amber-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            Expiring Soon ({data.expiring_soon.length})
          </h2>
          <div className="space-y-3">
            {data.expiring_soon.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEditReminder={handleEditReminder}
              />
            ))}
          </div>
        </section>
      )}

      {/* Fresh/Active Section */}
      {data && data.fresh && data.fresh.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-sage-700 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Active ({data.fresh.length})
          </h2>
          <div className="space-y-3">
            {data.fresh.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEditReminder={handleEditReminder}
              />
            ))}
          </div>
        </section>
      )}

      {/* Expired Section */}
      {data && data.expired.length > 0 && (
        <section>
          <h2 className="text-[15px] font-semibold text-red-600 mb-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Expired ({data.expired.length})
          </h2>
          <div className="space-y-3">
            {data.expired.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Edit Reminder Modal */}
      <Modal
        isOpen={!!editingProduct}
        onClose={() => setEditingProduct(null)}
        title="Edit Reminder"
      >
        {editingProduct && (
          <div className="space-y-4">
            <p className="text-sm text-sage-600">
              Editing reminder for <span className="font-semibold text-sage-800">{editingProduct.product_name}</span>
            </p>
            <div className="space-y-2">
              {REMINDER_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedOffset === option.value
                      ? 'border-sage-500 bg-sage-50 ring-1 ring-sage-500/20'
                      : 'border-sage-200 hover:border-sage-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="reminder"
                    value={option.value}
                    checked={selectedOffset === option.value}
                    onChange={() => setSelectedOffset(option.value)}
                    className="sr-only"
                  />
                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      selectedOffset === option.value
                        ? 'border-sage-500'
                        : 'border-sage-300'
                    }`}
                  >
                    {selectedOffset === option.value && (
                      <div className="w-2.5 h-2.5 rounded-full bg-sage-500" />
                    )}
                  </div>
                  <span className="text-sm text-sage-700">{option.label}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleSaveReminder}
              disabled={actionLoading || reminderSaved}
              className={`w-full py-3 rounded-xl font-semibold text-sm active:scale-[0.99] transition-all shadow-sm ${
                reminderSaved
                  ? 'bg-emerald-500 text-white'
                  : 'bg-sage-500 text-white hover:bg-sage-600 disabled:opacity-60'
              }`}
              data-testid="save-reminder-btn"
            >
              {reminderSaved ? 'Saved!' : actionLoading ? 'Saving…' : 'Save Reminder'}
            </button>
          </div>
        )}
      </Modal>

      {/* Paywall Modal */}
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />
    </div>
  )
}
