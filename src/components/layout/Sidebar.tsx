import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  UtensilsCrossed,
  Settings,
  LogOut,
  Menu as MenuIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { L } from '@/lib/labels';

const navItems = [
  { path: '/dashboard', label: L.dashboard, icon: LayoutDashboard, permission: 'reports.view' },
  { path: '/pos', label: L.pos, icon: ShoppingCart, permission: 'pos.create' },
  { path: '/tables', label: L.tables, icon: UtensilsCrossed, permission: 'tables.view' },
  { path: '/menu', label: L.menu, icon: MenuIcon, permission: 'menu.manage' },
  { path: '/settings', label: L.settings, icon: Settings, permission: 'settings.manage' },
];

export function Sidebar() {
  const location = useLocation();
  const { user, logout, hasPermission } = useAuth();

  const visibleItems = navItems.filter(item => 
    hasPermission(item.permission) || item.permission === '*'
  );

  return (
    <div className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen">
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-foreground">
          RestaurantPOS
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Quick • Reliable • Simple
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start gap-3',
                  isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.name.split(' ').map(n => n[0]).join('')}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role || ''}</p>
          </div>
        </div>
        <Button 
          variant="outline" 
          className="w-full gap-2"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Logout
        </Button>
      </div>
    </div>
  );
}
