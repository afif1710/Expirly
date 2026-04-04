import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Package,
  ScanLine,
  Search,
  CheckCircle2,
  Info,
  Loader2,
} from 'lucide-react'
import { nicheService } from '../services/nicheService'
import { productService } from '../services/productService'
import { lookupBarcode } from '../services/openFoodFactsService'
import { BarcodeScanner } from '../components/BarcodeScanner'
import { PaywallModal } from '../components/PaywallModal'
import NicheCard from '../components/NicheCard'
import type { Niche } from '../types'
import { REMINDER_OPTIONS } from '../lib/utils'

type LookupStatus = 'idle' | 'loading' | 'found' | 'not_found' | 'error'

export default function AddProduct() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [niches, setNiches] = useState<Niche[]>([])
  const [selectedNiche, setSelectedNiche] = useState<Niche | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [productName, setProductName] = useState('')
  const [productType, setProductType] = useState('')
  const [barcode, setBarcode] = useState('')
  const [purchaseDate, setPurchaseDate] = useState('')
  const [productionDate, setProductionDate] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [reminderOffset, setReminderOffset] = useState(24)

  // Barcode scan & lookup state
  const [scannerOpen, setScannerOpen] = useState(false)
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [autoFilled, setAutoFilled] = useState(false)
  const [foundBrand, setFoundBrand] = useState('')
  const [showPaywall, setShowPaywall] = useState(false)

  const fetchNiches = useCallback(async () => {
    try {
      setLoading(true)
      const result = await nicheService.list()
      setNiches(result)
    } catch (err: any) {
      setError(err.message || 'Failed to load categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchNiches()
  }, [fetchNiches])

  const handleSelectNiche = (niche: Niche) => {
    setSelectedNiche(niche)
    setStep(2)
  }

  // ── Barcode lookup ─────────────────────────────────────────────────
  const runLookup = async (barcodeValue: string) => {
    if (!barcodeValue.trim()) return
    setLookupStatus('loading')
    setAutoFilled(false)
    setFoundBrand('')
    try {
      const result = await lookupBarcode(barcodeValue.trim())
      if (result && result.product_name) {
        setProductName(result.product_name)
        setFoundBrand(result.brand || '')
        setAutoFilled(true)
        setLookupStatus('found')
      } else {
        setLookupStatus('not_found')
      }
    } catch {
      setLookupStatus('error')
    }
  }

  const handleBarcodeDetected = async (detectedBarcode: string) => {
    setScannerOpen(false)
    setBarcode(detectedBarcode)
    setLookupStatus('idle')
    await runLookup(detectedBarcode)
  }

  const handleManualLookup = () => {
    if (barcode.trim()) runLookup(barcode.trim())
  }

  const handleBarcodeChange = (value: string) => {
    setBarcode(value)
    // Clear lookup state when barcode is edited manually
    setLookupStatus('idle')
    setAutoFilled(false)
    setFoundBrand('')
  }

  // ── Form submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedNiche) return
    setError('')

    if (!productName.trim()) {
      setError('Product name is required')
      return
    }
    if (!expiryDate) {
      setError('Expiry date is required')
      return
    }

    setSubmitting(true)
    try {
      const data: any = {
        niche_id: selectedNiche.id,
        product_name: productName.trim(),
        expiry_date: new Date(expiryDate).toISOString(),
        reminder_offset_hours: reminderOffset,
      }
      if (productType.trim()) data.product_type = productType.trim()
      if (barcode.trim()) data.barcode = barcode.trim()
      if (purchaseDate) data.purchase_date = new Date(purchaseDate).toISOString()
      if (productionDate) data.production_date = new Date(productionDate).toISOString()

      await productService.create(data)
      navigate('/', { replace: true })
    } catch (err: any) {
      const msg: string = err.message || 'Failed to add product'
      // Intercept free-tier limit error → show paywall instead of raw error
      if (msg.toLowerCase().includes('free tier') || msg.toLowerCase().includes('maximum') || msg.toLowerCase().includes('limit') || msg.includes('403')) {
        setShowPaywall(true)
      } else {
        setError(msg)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const getMinDateTime = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

  // ── Loading skeleton ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-5 space-y-4">
        <div className="h-8 w-48 bg-sage-200 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-sage-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Barcode scanner modal */}
      {scannerOpen && (
        <BarcodeScanner
          onDetected={handleBarcodeDetected}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {/* Paywall modal */}
      <PaywallModal isOpen={showPaywall} onClose={() => setShowPaywall(false)} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-center gap-3 pt-2 mb-6">
          <button
            onClick={() => (step === 2 ? setStep(1) : navigate(-1))}
            className="p-2 -ml-2 rounded-xl text-sage-600 hover:bg-sage-100 transition-colors"
            data-testid="back-btn"
          >
            <ChevronLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-sage-900">Add Product</h1>
            <p className="text-[13px] text-sage-500 mt-0.5">
              {step === 1 ? 'Select a category' : `${selectedNiche?.niche_name} · Details`}
            </p>
          </div>
        </div>

        {error && (
          <div
            className="p-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium mb-4"
            data-testid="form-error"
          >
            {error}
          </div>
        )}

        {/* ── Step 1: Select Niche ──────────────────────────────── */}
        {step === 1 && (
          <div data-testid="step-1-niche-select">
            {niches.length === 0 ? (
              <div className="text-center py-12">
                <Package size={40} className="mx-auto text-sage-300 mb-3" />
                <p className="text-sage-500">No categories found. Create one first.</p>
                <button
                  onClick={() => navigate('/niches')}
                  className="mt-4 px-4 py-2 rounded-xl bg-sage-500 text-white text-sm font-medium"
                  data-testid="go-to-niches-btn"
                >
                  Go to Categories
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {niches.map((niche) => (
                  <NicheCard
                    key={niche.id}
                    niche={niche}
                    onClick={handleSelectNiche}
                    selected={selectedNiche?.id === niche.id}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 2: Product Details ───────────────────────────── */}
        {step === 2 && selectedNiche && (
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="product-details-form">

            {/* ── Barcode scan section ── */}
            <div className="rounded-2xl border border-sage-200 bg-sage-50/60 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-sage-700">Barcode</span>
                <span className="text-[11px] text-sage-400">optional</span>
              </div>

              {/* Scan button */}
              <button
                type="button"
                onClick={() => setScannerOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-sage-300 bg-white text-sage-700 text-sm font-medium hover:bg-sage-50 active:scale-[0.99] transition-all"
                data-testid="scan-barcode-btn"
              >
                <ScanLine size={18} className="text-sage-500" />
                Scan Barcode with Camera
              </button>

              {/* Manual barcode input + lookup */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => handleBarcodeChange(e.target.value)}
                  placeholder="Or type barcode number"
                  className="flex-1 px-3 py-2.5 rounded-xl border border-sage-200 bg-white text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[14px]"
                  data-testid="barcode-input"
                />
                <button
                  type="button"
                  onClick={handleManualLookup}
                  disabled={!barcode.trim() || lookupStatus === 'loading'}
                  className="px-3 py-2.5 rounded-xl border border-sage-300 bg-white text-sage-600 hover:bg-sage-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  data-testid="lookup-btn"
                  title="Look up product name"
                >
                  {lookupStatus === 'loading' ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Search size={16} />
                  )}
                </button>
              </div>

              {/* Lookup status feedback */}
              {lookupStatus === 'found' && (
                <div
                  className="flex items-start gap-2 text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2"
                  data-testid="lookup-success"
                >
                  <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                  <span className="text-xs leading-relaxed">
                    Product found{foundBrand ? ` · ${foundBrand}` : ''} — name filled in below
                  </span>
                </div>
              )}
              {lookupStatus === 'not_found' && (
                <div
                  className="flex items-start gap-2 text-sage-500 bg-sage-100 rounded-xl px-3 py-2"
                  data-testid="lookup-not-found"
                >
                  <Info size={15} className="mt-0.5 shrink-0" />
                  <span className="text-xs leading-relaxed">
                    Not in food database — please enter the product name manually
                  </span>
                </div>
              )}
              {lookupStatus === 'error' && (
                <div className="flex items-start gap-2 text-amber-600 bg-amber-50 rounded-xl px-3 py-2">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  <span className="text-xs leading-relaxed">
                    Couldn't reach food database — please enter the name manually
                  </span>
                </div>
              )}
            </div>

            {/* ── Product Name ── */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1.5">
                Product Name <span className="text-red-400">*</span>
                {autoFilled && (
                  <span className="ml-2 text-[11px] text-emerald-600 font-normal bg-emerald-50 px-1.5 py-0.5 rounded-full">
                    auto-filled
                  </span>
                )}
              </label>
              <input
                type="text"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value)
                  setAutoFilled(false)
                }}
                placeholder="e.g., Organic Milk"
                required
                maxLength={100}
                className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[15px]"
                data-testid="product-name-input"
              />
            </div>

            {/* ── Product Type ── */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1.5">
                Product Type
              </label>
              <input
                type="text"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                placeholder="e.g., Dairy, Supplement"
                className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white text-sage-900 placeholder-sage-400 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[15px]"
                data-testid="product-type-input"
              />
            </div>

            {/* ── Expiry Date ── */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1.5">
                Expiry Date <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                min={getMinDateTime()}
                required
                className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white text-sage-900 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[15px]"
                data-testid="expiry-date-input"
              />
            </div>

            {/* ── Purchase Date ── */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1.5">
                Purchase Date
              </label>
              <input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white text-sage-900 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[15px]"
                data-testid="purchase-date-input"
              />
            </div>

            {/* ── Production Date ── */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-1.5">
                Production Date
              </label>
              <input
                type="date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-sage-200 bg-white text-sage-900 focus:outline-none focus:ring-2 focus:ring-sage-500/30 focus:border-sage-400 transition-all text-[15px]"
                data-testid="production-date-input"
              />
            </div>

            {/* ── Reminder Timing ── */}
            <div>
              <label className="block text-sm font-medium text-sage-700 mb-2">
                Remind Me
              </label>
              <div className="space-y-2" data-testid="reminder-options">
                {REMINDER_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      reminderOffset === option.value
                        ? 'border-sage-500 bg-sage-50 ring-1 ring-sage-500/20'
                        : 'border-sage-200 hover:border-sage-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="reminder"
                      value={option.value}
                      checked={reminderOffset === option.value}
                      onChange={() => setReminderOffset(option.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                        reminderOffset === option.value ? 'border-sage-500' : 'border-sage-300'
                      }`}
                    >
                      {reminderOffset === option.value && (
                        <div className="w-2.5 h-2.5 rounded-full bg-sage-500" />
                      )}
                    </div>
                    <span className="text-sm text-sage-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* ── Submit ── */}
            <div className="pt-2 pb-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-sage-500 text-white font-semibold text-[15px] hover:bg-sage-600 active:scale-[0.99] transition-all disabled:opacity-60 shadow-sm flex items-center justify-center gap-2"
                data-testid="submit-product-btn"
              >
                {submitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Adding…
                  </>
                ) : (
                  <>
                    Add Product
                    <ChevronRight size={18} />
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-sage-400 text-center pb-4">
              Product details cannot be edited after saving. Only the reminder timing can be changed.
            </p>
          </form>
        )}
      </div>
    </>
  )
}
