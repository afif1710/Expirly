import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Clock, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

/**
 * OAuth callback handler.
 * Supabase PKCE flow redirects here after Google authentication.
 * The Supabase client (detectSessionInUrl: true) automatically exchanges
 * the code for a session. We just wait for it and redirect.
 */
export default function AuthCallback() {
  const navigate = useNavigate()
  const [error, setError] = useState('')

  useEffect(() => {
    let done = false

    // Handle the code exchange for PKCE flow
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))

      // Check for errors from Supabase/Google
      const errorDesc =
        params.get('error_description') ||
        hashParams.get('error_description') ||
        params.get('error')
      if (errorDesc) {
        setError(decodeURIComponent(errorDesc))
        return
      }

      // Try to exchange code for session (PKCE)
      const code = params.get('code')
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
        if (exchangeError) {
          setError(exchangeError.message)
          return
        }
      }

      // Wait for session to be established
      const { data: { session } } = await supabase.auth.getSession()
      if (session && !done) {
        done = true
        navigate('/', { replace: true })
        return
      }
    }

    handleCallback()

    // Also listen for the auth state change (backup)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !done) {
          done = true
          navigate('/', { replace: true })
        }
      }
    )

    // Timeout fallback: if no session after 10s, show error
    const timeout = setTimeout(() => {
      if (!done) {
        setError('Sign-in timed out. Please try again.')
      }
    }, 10000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [navigate])

  if (error) {
    return (
      <div className="min-h-screen bg-sage-50 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 text-red-500 mb-2">
            <Clock size={28} />
          </div>
          <h2 className="text-lg font-semibold text-sage-900">Sign-in failed</h2>
          <p className="text-sm text-sage-600">{error}</p>
          <button
            onClick={() => navigate('/login', { replace: true })}
            className="px-6 py-2.5 rounded-xl bg-sage-500 text-white text-sm font-medium hover:bg-sage-600 transition-colors"
            data-testid="back-to-login-btn"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-sage-50 flex flex-col items-center justify-center px-6">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-sage-500 text-white shadow-lg shadow-sage-500/20">
          <Clock size={28} strokeWidth={2} />
        </div>
        <div className="flex items-center gap-2 text-sage-600 text-sm">
          <Loader2 size={16} className="animate-spin" />
          <span>Signing you in…</span>
        </div>
      </div>
    </div>
  )
}
