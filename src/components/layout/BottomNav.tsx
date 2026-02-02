import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  UtensilsCrossed,
  MoreHorizontal,
  LayoutDashboard,
  Menu as MenuIcon,
  Settings,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { L } from '@/lib/labels';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useBackHandler } from '@/hooks/use-back-handler';

// All nav items — split into primary/more dynamically based on role
const allNavItems = [
  { path: '/pos', label: L.pos, icon: ShoppingCart, permission: 'pos.create', primaryFor: ['owner', 'manager', 'cashier'] },
  { path: '/tables', label: L.tables, icon: UtensilsCrossed, permission: 'tables.view', primaryFor: ['owner', 'manager', 'cashier'] },
  { path: '/dashboard', label: L.dashboard, icon: LayoutDashboard, permission: 'pos.create', primaryFor: ['owner', 'manager'] },
  { path: '/menu', label: L.menu, icon: MenuIcon, permission: 'menu.manage', primaryFor: [] },
  { path: '/settings', label: L.settings, icon: Settings, permission: 'settings.manage', primaryFor: [] },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasPermission } = useAuth();
  const [showMore, setShowMore] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Back button handlers
  useBackHandler('nav-logout-confirm', showLogoutConfirm, () => setShowLogoutConfirm(false), 100);
  useBackHandler('nav-more-sheet', showMore, () => setShowMore(false), 80);

  const userRole = user?.role || 'cashier';

  const visibleTabs = allNavItems.filter(
    (item) => item.primaryFor.includes(userRole) && (hasPermission(item.permission) || item.permission === '*')
  );

  const visibleMoreItems = allNavItems.filter(
    (item) => !item.primaryFor.includes(userRole) && (hasPermission(item.permission) || item.permission === '*')
  );

  const handleLogout = () => {
    setShowMore(false);
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    logout();
  };

  const handleMoreItemClick = (path: string) => {
    setShowMore(false);
    navigate(path);
  };

  const isMoreActive = visibleMoreItems.some((item) => location.pathname === item.path);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {visibleTabs.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center flex-1 h-full px-2 transition-colors',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <item.icon className={cn('h-6 w-6', isActive && 'text-primary')} />
                <span className={cn('text-xs mt-1', isActive && 'font-medium')}>
                  {item.label}
                </span>
              </Link>
            );
          })}

          <button
            onClick={() => setShowMore(true)}
            className={cn(
              'flex flex-col items-center justify-center flex-1 h-full px-2 transition-colors',
              isMoreActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <MoreHorizontal className={cn('h-6 w-6', isMoreActive && 'text-primary')} />
            <span className={cn('text-xs mt-1', isMoreActive && 'font-medium')}>
              {L.more}
            </span>
          </button>
        </div>
      </nav>

      <Sheet open={showMore} onOpenChange={setShowMore}>
        <SheetContent side="bottom" className="h-auto max-h-[80vh] rounded-t-2xl">
          <SheetHeader className="pb-4">
            <SheetTitle className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-sm font-medium">
                    {user?.name.split(' ').map((n) => n[0]).join('')}
                  </span>
                </div>
                <div>
                  <p className="font-medium text-left">{user?.name}</p>
                  <p className="text-xs text-muted-foreground capitalize text-left">
                    {user?.role}
                  </p>
                </div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-3 pb-4">
            {visibleMoreItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => handleMoreItemClick(item.path)}
                  className={cn(
                    'flex flex-col items-center justify-center p-4 rounded-xl transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary hover:bg-secondary/80'
                  )}
                >
                  <item.icon className="h-6 w-6 mb-2" />
                  <span className="text-sm font-medium">{item.label}</span>
                </button>
              );
            })}
          </div>

          <Button
            variant="outline"
            className="w-full h-12 gap-2 text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5" />
            {L.logout}
          </Button>
        </SheetContent>
      </Sheet>

      {/* Logout confirmation */}
      <AlertDialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <AlertDialogContent className="max-w-[90vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>{L.logout}</AlertDialogTitle>
            <AlertDialogDescription>{L.logoutConfirm}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="h-12">{L.cancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLogout}
              className="h-12 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {L.logout}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
