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
    label: 'Triova',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" strokeLinecap="round">
        <path d="M 11,2 A 9,9 0 0,1 18.79,15.5" stroke="#1D9E75" strokeWidth={active ? 2 : 1.5} />
        <path d="M 18.79,15.5 A 9,9 0 0,1 3.21,15.5" stroke="#7F77DD" strokeWidth={active ? 2 : 1.5} />
        <path d="M 3.21,15.5 A 9,9 0 0,1 11,2" stroke="#D85A30" strokeWidth={active ? 2 : 1.5} />
      </svg>
    ),
  },
]

export default function NavBar() {
  const { pathname } = useLocation()
  if (pathname === '/onboarding' || pathname === '/settings') return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 max-w-md mx-auto lg:max-w-sm lg:bottom-8 lg:rounded-2xl border-t lg:border"
      style={{
        background: 'rgba(15,15,26,0.85)',
        borderColor: 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex justify-around items-center py-3 lg:py-4 px-6 lg:px-8">
        {LINKS.map(({ to, label, icon }) => {
          const active = pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={`flex flex-col items-center gap-1 lg:gap-1.5 transition-all duration-150 hover:scale-110 active:scale-95 ${
                active ? 'text-white' : 'text-white/25 hover:text-white/55'
              }`}
            >
              <span className="lg:scale-125">{icon(active)}</span>
              <span className="font-sans text-xs lg:text-sm">{label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
