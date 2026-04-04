import { useLocation, useNavigate } from 'react-router-dom'
import { Home, Layers, Plus, Bell, User } from 'lucide-react'

const tabs = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/niches', icon: Layers, label: 'Niches' },
  { path: '/add', icon: Plus, label: 'Add', isSpecial: true },
  { path: '/alerts', icon: Bell, label: 'Alerts' },
  { path: '/profile', icon: User, label: 'Profile' },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-sage-100 z-50 safe-area-inset-bottom">
      <div className="max-w-md mx-auto flex items-center justify-around h-16 px-2">
        {tabs.map((tab) => {
          const isActive = tab.path === '/' 
            ? location.pathname === '/'
            : location.pathname.startsWith(tab.path)
          const Icon = tab.icon

          if (tab.isSpecial) {
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="flex items-center justify-center w-14 h-14 -mt-5 rounded-full bg-sage-500 text-white shadow-lg shadow-sage-500/30 active:scale-95 transition-all duration-150 hover:bg-sage-600"
              >
                <Icon size={28} strokeWidth={2.5} />
              </button>
            )
          }

          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors duration-150 ${
                isActive ? 'text-sage-600' : 'text-gray-400'
              }`}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              <span className={`text-[10px] mt-0.5 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
