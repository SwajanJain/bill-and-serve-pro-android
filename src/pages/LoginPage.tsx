import React, { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { UtensilsCrossed, Loader2, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { L } from '@/lib/labels';

export default function LoginPage() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const { user, pinLogin } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Phase 2.4: Prevent /login access while logged in
  if (user) {
    return <Navigate to="/pos" replace />;
  }

  const handlePinSubmitWithPin = async (pinValue: string) => {
    setLoading(true);
    try {
      const success = await pinLogin(pinValue);
      if (success) {
        try {
          await Haptics.impact({ style: ImpactStyle.Medium });
        } catch (e) {}
        navigate('/pos');
      } else {
        try {
          await Haptics.impact({ style: ImpactStyle.Heavy });
        } catch (e) {}
        toast({
          title: L.loginFailed,
          description: L.invalidPin,
          variant: 'destructive',
        });
        setPin('');
      }
    } catch (error) {
      toast({
        title: L.loginFailed,
        description: L.errorGeneric,
        variant: 'destructive',
      });
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  const handlePinInput = async (digit: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}

    if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);
      if (newPin.length === 4) {
        setTimeout(() => {
          handlePinSubmitWithPin(newPin);
        }, 100);
      }
    }
  };

  const handleBackspace = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setPin(pin.slice(0, -1));
  };

  const handleClear = async () => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (e) {}
    setPin('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <UtensilsCrossed className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">{L.appName}</CardTitle>
          <CardDescription>{L.enterPin}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PIN Display */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((index) => (
              <div
                key={index}
                className={`w-14 h-16 border-2 rounded-lg flex items-center justify-center text-3xl font-bold transition-colors ${
                  pin.length > index
                    ? 'border-primary bg-primary/10'
                    : 'border-muted'
                }`}
              >
                {pin.length > index ? '\u25CF' : ''}
              </div>
            ))}
          </div>

          {/* Number Pad */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <Button
                key={digit}
                variant="outline"
                size="lg"
                className="h-16 text-2xl font-semibold"
                onClick={() => handlePinInput(String(digit))}
                disabled={loading || pin.length >= 4}
              >
                {digit}
              </Button>
            ))}
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-sm font-medium"
              onClick={handleClear}
              disabled={loading || pin.length === 0}
            >
              Clear
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16 text-2xl font-semibold"
              onClick={() => handlePinInput('0')}
              disabled={loading || pin.length >= 4}
            >
              0
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-16"
              onClick={handleBackspace}
              disabled={loading || pin.length === 0}
            >
              <Delete className="h-6 w-6" />
            </Button>
          </div>

          {loading && (
            <div className="flex justify-center mt-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
