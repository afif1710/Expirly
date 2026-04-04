import { useState, useEffect, useCallback } from 'react'
import { Plus, Layers } from 'lucide-react'
import { nicheService } from '../services/nicheService'
import NicheCard from '../components/NicheCard'
import Modal from '../components/Modal'
import type { Niche } from '../types'

export default function Niches() {
  const [niches, setNiches] = useState<Niche[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [newNicheName, setNewNicheName] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState('')

  const fetchNiches = useCallback(async () => {
    try {
      setLoading(true)
      const result = await nicheService.list()
      setNiches(result)
      setError('')
    } catch (err: any) {
      setError(err.message || 'Failed to load niches')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNiches()
  }, [fetchNiches])

  const handleCreate = async () => {
    if (!newNicheName.trim()) return
    setCreateError('')
    setCreateLoading(true)
    try {
      await nicheService.create(newNicheName.trim())
      setNewNicheName('')
      setShowCreate(false)
      await fetchNiches()
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create niche')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this custom niche?')) return
    try {
      await nicheService.delete(id)
      await fetchNiches()
    } catch (err: any) {
      alert(err.message)
    }
  }

  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-8 w-32 bg-sage-200 rounded-lg animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-sage-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold text-sage-900">Categories</h1>
          <p className="text-[13px] text-sage-500 mt-0.5">Organize your products</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sage-500 text-white text-sm font-medium hover:bg-sage-600 active:scale-[0.98] transition-all shadow-sm"
        >
          <Plus size={16} />
          New
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{error}</div>
      )}

      {/* Niche List */}
      {niches.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sage-100 text-sage-400 mb-4">
            <Layers size={32} />
          </div>
          <h3 className="text-lg font-semibold text-sage-800">No categories</h3>
          <p className="text-sm text-sage-500 mt-1">Categories will appear after registration</p>
        </div>
      ) : (
        <div className="space-y-3">
          {niches.map((niche) => (
            <NicheCard
              key={niche.id}
              niche={niche}
              onDelete={niche.niche_type === 'custom' ? handleDelete : undefined}
            />
          ))}
        </div>
      )}

      {/* Create Niche Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false)
          setNewNicheName('')
          setCreateError('')
        }}
        title="New Category"
      >
        <div className="space-y-4">
          {createError && (
            <div className="p-3 rounded-xl bg-red-50 text-red-600 text-sm">{createError}</div>
          )}
          <div>
            <label className="block text-sm font-medium text-sage-700 mb-1.5">
              Category Name
            </label>
            <input
              type="text"
              value={newNicheName}
              onChange={(e) => setNewNicheName(e.target.value)}
              placeholder="e.g., Baby Products"
              maxLength={50}
              autoFocus
              className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[15px]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={createLoading || !newNicheName.trim()}
            className="w-full py-3 rounded-xl bg-sage-500 text-white font-semibold text-sm hover:bg-sage-600 active:scale-[0.99] transition-all disabled:opacity-60 shadow-sm"
          >
            {createLoading ? 'Creating...' : 'Create Category'}
          </button>
        </div>
      </Modal>
    </div>
  )
}
