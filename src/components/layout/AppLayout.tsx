import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useStore } from '../../store/useStore'
import {
  LayoutDashboard, ArrowRightLeft, ShieldCheck, Settings, Bell, LogOut, ChevronRight,
} from 'lucide-react'

export default function AppLayout() {
  const { user, notifications, logout } = useStore()
  const nav = useNavigate()
  const unread = notifications.filter(n => !n.read).length

  const links = [
    { to: '/app/dashboard',   icon: LayoutDashboard,  label: 'Dashboard'   },
    { to: '/app/transfer',    icon: ArrowRightLeft,   label: 'Transfers'   },
    { to: '/app/compliance',  icon: ShieldCheck,      label: 'Compliance'  },
    { to: '/app/settings',    icon: Settings,         label: 'Settings'    },
  ]

  const handleLogout = () => { logout(); nav('/') }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0B1C2C' }}>

      {/* SIDEBAR — desktop */}
      <aside className="hidden lg:flex flex-col w-64 border-r" style={{ background: '#071420', borderColor: 'rgba(201,150,58,0.15)' }}>
        {/* Logo */}
        <div className="px-6 py-5 border-b" style={{ borderColor: 'rgba(201,150,58,0.15)' }}>
          <a href="/" className="font-head text-xl font-bold tracking-widest uppercase" style={{ color: '#E8B86D', fontFamily: "'Cormorant Garamond', serif" }}>
            Repaihub
          </a>
          <div className="text-xs mt-0.5" style={{ color: '#8BA0B4' }}>NRO Remittance</div>
        </div>

        {/* User pill */}
        <div className="px-4 py-3 mx-4 mt-4 rounded" style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.15)' }}>
          <div className="text-sm font-semibold" style={{ color: '#FAF6F0' }}>{user?.name || 'User'}</div>
          <div className="text-xs mt-0.5" style={{ color: '#8BA0B4' }}>{user?.email}</div>
          {user?.canadaBankVerified && user.indiaNROVerified && (
            <div className="flex items-center gap-1 mt-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#27AE60' }}></span>
              <span className="text-xs" style={{ color: '#27AE60' }}>KYC Verified</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 mt-4 space-y-1">
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 text-sm font-medium transition-all rounded ${
                  isActive
                    ? 'text-gold-light'
                    : 'text-muted hover:text-cream'
                }`
              }
              style={({ isActive }) => isActive
                ? { background: 'rgba(201,150,58,0.1)', color: '#E8B86D', borderRadius: '4px' }
                : { color: '#8BA0B4', borderRadius: '4px' }
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* FX Rate ticker */}
        <div className="px-4 mb-2">
          <div className="px-4 py-3 rounded text-xs" style={{ background: '#132233', border: '1px solid rgba(201,150,58,0.15)', color: '#8BA0B4' }}>
            <span className="block text-xs tracking-widest uppercase" style={{ color: '#C9963A' }}>Live FX</span>
            <span className="text-base font-semibold mt-0.5 block" style={{ color: '#FAF6F0', fontFamily: "'DM Sans', sans-serif" }}>
              1 CAD = ₹63.42
            </span>
            <span className="text-xs" style={{ color: '#8BA0B4' }}>Updated just now</span>
          </div>
        </div>

        {/* Logout */}
        <div className="px-4 pb-5 border-t pt-4" style={{ borderColor: 'rgba(201,150,58,0.15)' }}>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 text-sm transition-colors rounded"
            style={{ color: '#8BA0B4', background: 'transparent', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#FAF6F0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#8BA0B4')}
          >
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-4 border-b" style={{ background: '#071420', borderColor: 'rgba(201,150,58,0.15)' }}>
          {/* Mobile logo */}
          <a href="/" className="lg:hidden font-head text-lg font-bold tracking-widest uppercase" style={{ color: '#E8B86D', fontFamily: "'Cormorant Garamond', serif" }}>
            Repaihub
          </a>
          <div className="hidden lg:block" />

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <button
              className="relative p-2 rounded transition-colors"
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#8BA0B4' }}
              onClick={() => nav('/app/settings#notifications')}
            >
              <Bell size={18} />
              {unread > 0 && (
                <span
                  className="absolute top-1 right-1 w-4 h-4 flex items-center justify-center text-xs font-bold rounded-full"
                  style={{ background: '#C9963A', color: '#0B1C2C', fontSize: '9px' }}
                >
                  {unread}
                </span>
              )}
            </button>

            {/* New Transfer CTA */}
            <button
              className="hidden sm:flex items-center gap-2 px-4 py-2 text-xs font-semibold tracking-widest uppercase transition-all"
              style={{ background: '#C9963A', color: '#0B1C2C', border: 'none', cursor: 'pointer' }}
              onClick={() => nav('/app/new-transfer')}
              onMouseEnter={e => (e.currentTarget.style.background = '#E8B86D')}
              onMouseLeave={e => (e.currentTarget.style.background = '#C9963A')}
            >
              New Transfer <ChevronRight size={14} />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: '#0B1C2C' }}>
          <Outlet />
        </main>

        {/* MOBILE BOTTOM NAV */}
        <nav className="lg:hidden flex border-t" style={{ background: '#071420', borderColor: 'rgba(201,150,58,0.15)' }}>
          {links.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className="flex-1 flex flex-col items-center py-3 gap-1 text-xs transition-colors"
              style={({ isActive }) => ({ color: isActive ? '#E8B86D' : '#8BA0B4' })}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
