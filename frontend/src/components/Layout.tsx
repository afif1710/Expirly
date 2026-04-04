import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'

export default function Layout() {
  return (
    <div className="min-h-screen bg-sage-50 flex flex-col">
      <main className="flex-1 pb-20 overflow-y-auto">
        <div className="max-w-md mx-auto w-full">
          <Outlet />
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
