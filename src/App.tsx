import { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { POSProvider } from "@/contexts/POSContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import POSPage from "./pages/POSPage";
import TablesPage from "./pages/TablesPage";
import MenuPage from "./pages/MenuPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import NotFound from "./pages/NotFound";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { L } from "@/lib/labels";
import { BackButtonProvider } from "@/contexts/BackButtonContext";

function ProtectedRoute({ children, permission }: { children: React.ReactNode; permission?: string }) {
  const { user, isLoading, hasPermission } = useAuth();
  const { toast } = useToast();
  const hasShownToast = useRef(false);

  const permissionDenied = !isLoading && !!user && !!permission && !hasPermission(permission);

  useEffect(() => {
    if (permissionDenied && !hasShownToast.current) {
      hasShownToast.current = true;
      toast({ title: L.permissionDenied, variant: 'destructive' });
    }
  }, [permissionDenied, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (permissionDenied) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}

const AppRoutes = () => (
  <BackButtonProvider>
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/" element={<ProtectedRoute><SettingsProvider><POSProvider><AppLayout /></POSProvider></SettingsProvider></ProtectedRoute>}>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="pos" element={<POSPage />} />
        <Route path="tables" element={<TablesPage />} />
        <Route path="menu" element={<ProtectedRoute permission="menu.manage"><MenuPage /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute permission="settings.manage"><SettingsPage /></ProtectedRoute>} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  </BackButtonProvider>
);

const App = () => (
  <TooltipProvider>
    <OfflineIndicator />
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
