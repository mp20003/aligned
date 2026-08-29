/**
 * Login
 *
 * Passwordless magic-link sign-in. User enters their email, gets a link,
 * clicking it signs them in and Supabase redirects back here with a
 * session. Never collects a password. Shown whenever there is no active
 * session, in place of every other route.
 *
 * Props: none. Talks to Supabase auth directly.
 */

import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleGoogle() {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-6">
      <div className="w-full max-w-sm lg:max-w-md flex flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-2 text-center">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/40">Triova</p>
          <h1 className="font-serif text-3xl lg:text-4xl text-charcoal">Welcome back</h1>
        </div>

        <div className="flex flex-col gap-4">
          {error && <p className="font-sans text-sm text-spiritual text-center">{error}</p>}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full py-3.5 lg:py-4 rounded-2xl bg-white border border-charcoal/15 font-sans text-sm lg:text-base text-charcoal/80 tracking-wide flex items-center justify-center gap-3 hover:bg-white/80 transition-colors disabled:opacity-50"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
            </svg>
            {loading ? 'Redirecting…' : 'Sign in with Google'}
          </button>
          <p className="font-sans text-xs text-charcoal/40 text-center leading-relaxed">
            Your data is private and only visible to you.
          </p>
        </div>
      </div>
    </div>
  )
}
