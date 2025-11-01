import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Home, MessageCircle, Users, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function MainLayout({ user, onLogout }) {
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: 'Feed', testId: 'nav-feed' },
    { path: '/messages', icon: MessageCircle, label: 'Messages', testId: 'nav-messages' },
    { path: '/friends', icon: Users, label: 'Friends', testId: 'nav-friends' },
    { path: '/profile', icon: User, label: 'Profile', testId: 'nav-profile' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="glass-effect sticky top-0 z-50 border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <h1 
            className="text-3xl font-bold cursor-pointer" 
            style={{ 
              fontFamily: 'Space Grotesk, sans-serif',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}
            onClick={() => navigate('/')}
            data-testid="logo"
          >
            Zoq
          </h1>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user?.profile_pic} />
                <AvatarFallback>{user?.username?.[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="font-medium text-gray-700">{user?.username}</span>
            </div>
            <Button 
              data-testid="logout-button"
              variant="ghost" 
              size="icon" 
              onClick={onLogout}
              className="hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-6">
        <div className="flex gap-6">
          {/* Sidebar Navigation */}
          <aside className="w-64 sticky top-20 h-fit">
            <nav className="glass-effect rounded-2xl p-4 space-y-2">
              {navItems.map(({ path, icon: Icon, label, testId }) => (
                <NavLink
                  key={path}
                  to={path}
                  data-testid={testId}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive
                        ? 'text-white'
                        : 'text-gray-700 hover:bg-gray-100'
                    }`
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                  } : {}}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{label}</span>
                </NavLink>
              ))}
            </nav>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 max-w-3xl">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}