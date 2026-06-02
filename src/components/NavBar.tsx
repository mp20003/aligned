import { NavLink, useLocation } from 'react-router'

const LINKS = [
  {
    to: '/today',
    label: 'Today',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
    ),
  },
  {
    to: '/history',
    label: 'History',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <path d="M3 9h18" />
        <path d="M8 2v4M16 2v4" />
        <path d="M7 13h2M11 13h2M15 13h2M7 17h2M11 17h2" />
      </svg>
    ),
  },
  {
    to: '/score',
    label: 'Pulse',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 12 L6 12 L8 8 L9 12 L10.5 4 L12 18 L13 12 L15 10 L17 12 L22 12" />
      </svg>
    ),
  },
]

export default function NavBar() {
  const { pathname } = useLocation()
  if (pathname === '/onboarding') return null

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-beige border-t border-charcoal/8 max-w-md mx-auto">
      <div className="flex justify-around items-center py-3 px-6">
        {LINKS.map(({ to, label, icon }) => {
          const active = pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 transition-colors ${
                active ? 'text-charcoal' : 'text-charcoal/30'
              }`}
            >
              {icon(active)}
              <span className="font-sans text-xs">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
