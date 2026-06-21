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
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    setLoading(false)
    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-beige flex items-center justify-center px-6">
      <div className="w-full max-w-sm lg:max-w-md flex flex-col gap-6 lg:gap-8">
        <div className="flex flex-col gap-2 text-center">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-charcoal/40">Triova</p>
          <h1 className="font-serif text-3xl lg:text-4xl text-charcoal">Welcome back</h1>
        </div>

        {sent ? (
          <div className="bg-white/50 rounded-2xl px-5 py-6 text-center">
            <p className="font-serif text-lg text-charcoal leading-relaxed">Check your email</p>
            <p className="font-sans text-sm text-charcoal/50 mt-2">
              We sent a sign-in link to {email}. Open it on this device to continue.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full bg-white/50 rounded-xl px-4 py-3.5 lg:py-4 font-sans text-base text-charcoal placeholder:text-charcoal/30 border border-charcoal/10 focus:outline-none focus:border-charcoal/30"
            />
            {error && <p className="font-sans text-sm text-spiritual">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 lg:py-4 rounded-2xl bg-charcoal text-beige font-sans text-sm lg:text-base tracking-wide disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send sign-in link'}
            </button>
            <p className="font-sans text-xs text-charcoal/40 text-center leading-relaxed">
              No password. We'll email you a link that signs you in instantly.
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
