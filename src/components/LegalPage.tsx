/**
 * LegalPage
 *
 * Shared reading-page shell for Privacy Policy / Terms of Service. Reachable
 * both signed out (linked from Login) and signed in (linked from Settings),
 * so it never assumes a session or an onboarded user.
 */

import { useNavigate } from 'react-router'
import type { ReactNode } from 'react'

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen max-w-md lg:max-w-2xl mx-auto px-6 lg:px-10 pt-12 lg:pt-16 pb-16 flex flex-col gap-8" style={{ background: '#0f0f1a' }}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="font-sans text-xs lg:text-sm uppercase tracking-widest text-white/30">Triova</p>
          <h1 className="font-serif text-2xl lg:text-4xl text-white">{title}</h1>
          <p className="font-sans text-xs text-white/50 mt-1">Last updated {updated}</p>
        </div>
        <button
          onClick={() => navigate(-1)}
          className="font-sans text-xs lg:text-sm text-white/50 underline underline-offset-4 hover:text-white/80 transition-colors flex-shrink-0"
        >
          Back
        </button>
      </div>

      <div className="flex flex-col gap-6 font-sans text-sm lg:text-base text-white/55 leading-relaxed [&_h2]:font-serif [&_h2]:text-lg [&_h2]:lg:text-xl [&_h2]:text-white/85 [&_h2]:mt-2 [&_p]:leading-relaxed [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_a]:underline [&_a]:underline-offset-4 [&_a]:text-white/70">
        {children}
      </div>
    </div>
  )
}
