import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { storage } from '@/lib/storage';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, isLoading } = useAuth();
  const [setupChecked, setSetupChecked] = useState(false);
  const [setupComplete, setSetupComplete] = useState(true);

  useEffect(() => {
    const check = async () => {
      const complete = await storage.isSetupComplete();
      setSetupComplete(complete);
      setSetupChecked(true);
    };
    check();
  }, []);

  if (isLoading || !setupChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!setupComplete) {
    return <Navigate to="/setup" replace />;
  }

  if (user) {
    return <Navigate to="/pos" replace />;
  }

  return <Navigate to="/login" replace />;
};

export default Index;
