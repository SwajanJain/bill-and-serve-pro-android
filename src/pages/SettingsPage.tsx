import React, { useState, useEffect, useRef } from 'react';
import { Store, Users, Receipt, Shield, Plus, Edit2, Trash2, Save, Upload, X } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/SettingsContext';
import { UserDialog } from '@/components/settings/UserDialog';
import { DeleteConfirmDialog } from '@/components/menu/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { User, UserRole } from '@/types';
import { L } from '@/lib/labels';
import { useBackHandler } from '@/hooks/use-back-handler';

const roleLabels: Record<UserRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  cashier: 'Cashier',
};

export default function SettingsPage() {
  const { users, settings, addUser, updateUser, deleteUser, updateSettings } = useSettings();
  const { toast } = useToast();

  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [localSettings, setLocalSettings] = useState(settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 200;
        let w = img.width;
        let h = img.height;
        if (w > maxSize || h > maxSize) {
          if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
          else { w = Math.round(w * maxSize / h); h = maxSize; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h);
        const base64 = canvas.toDataURL('image/png');
        setLocalSettings(prev => ({ ...prev, logo: base64 }));
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset so same file can be re-selected
    e.target.value = '';
  };

  // Back button handlers
  useBackHandler('settings-delete-confirm', deleteDialogOpen, () => setDeleteDialogOpen(false), 100);
  useBackHandler('settings-user-dialog', userDialogOpen, () => setUserDialogOpen(false), 90);

  // Phase 1.5: Sync local state when settings change externally
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleAddUser = () => { setEditingUser(null); setUserDialogOpen(true); };
  const handleEditUser = (user: User) => { setEditingUser(user); setUserDialogOpen(true); };

  const handleDeleteUser = (user: User) => {
    if (user.role === 'owner') {
      toast({ title: L.errorCannotDelete, description: 'Owner account cannot be deleted.', variant: 'destructive' });
      return;
    }
    setDeleteTarget({ id: user.id, name: user.name });
    setDeleteDialogOpen(true);
  };

  const handleSaveUser = (data: { id?: string; name: string; email: string; phone?: string; pin?: string; role: UserRole; isActive: boolean }) => {
    // Phase 5.2: Duplicate PIN check
    if (data.pin) {
      const existingUser = users.find(u => u.pin === data.pin && u.id !== data.id);
      if (existingUser) {
        toast({ title: L.errorDuplicatePin, variant: 'destructive' });
        return;
      }
    }

    if (data.id) {
      updateUser(data.id, data);
    } else {
      addUser(data);
    }
    toast({ title: L.userSaved });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteUser(deleteTarget.id);
    toast({ title: `${deleteTarget.name} deleted` });
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  // Phase 5.1: Validate before saving
  const validateSettings = () => {
    const errs: Record<string, string> = {};
    if (!localSettings.name.trim()) errs.name = L.errorNameRequired;
    if (localSettings.phone && !/^\d{10}$/.test(localSettings.phone)) errs.phone = L.errorPhoneRequired;
    if (localSettings.gstEnabled) {
      if (localSettings.defaultTaxRate < 0 || localSettings.defaultTaxRate > 28) errs.tax = L.errorTaxRange;
      if (localSettings.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(localSettings.gstin)) errs.gstin = 'Invalid GSTIN format';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Phase 1.5: Single "Save All" button
  const handleSaveAll = () => {
    if (!validateSettings()) return;
    updateSettings(localSettings);
    toast({ title: L.settingsSaved });
  };

  return (
    <div className="p-3 sm:p-6 max-w-4xl">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">{L.settings}</h1>
        <Button onClick={handleSaveAll} size="sm" className="gap-1.5 h-10 sm:h-12">
          <Save className="h-4 w-4 sm:h-5 sm:w-5" />
          {L.saveAll}
        </Button>
      </div>

      <div className="space-y-6">
        {/* Restaurant Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {L.restaurantDetails}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Logo upload */}
            <div className="flex items-center gap-4">
              {localSettings.logo ? (
                <img src={localSettings.logo} alt="Logo" className="w-[60px] h-[60px] rounded object-cover border" />
              ) : (
                <div className="w-[60px] h-[60px] rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                  <Store className="h-6 w-6" />
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => logoInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />{L.uploadLogo}
                </Button>
                {localSettings.logo && (
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5 text-destructive" onClick={() => setLocalSettings(prev => ({ ...prev, logo: undefined }))}>
                    <X className="h-4 w-4" />{L.removeLogo}
                  </Button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Restaurant Name *</Label>
                <Input value={localSettings.name} onChange={(e) => setLocalSettings(prev => ({ ...prev, name: e.target.value }))} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label>Phone (10 digits)</Label>
                <Input value={localSettings.phone} onChange={(e) => setLocalSettings(prev => ({ ...prev, phone: e.target.value }))} />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input value={localSettings.address} onChange={(e) => setLocalSettings(prev => ({ ...prev, address: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* Tax & Timing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {L.taxSettings}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>{L.gstEnabled}</Label>
                <p className="text-sm text-muted-foreground">{L.gstEnabledDesc}</p>
              </div>
              <Switch checked={localSettings.gstEnabled} onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, gstEnabled: checked }))} />
            </div>

            {localSettings.gstEnabled && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Default GST Rate (%) (0-28)</Label>
                    <Input type="number" value={localSettings.defaultTaxRate} onChange={(e) => setLocalSettings(prev => ({ ...prev, defaultTaxRate: Number(e.target.value) }))} />
                    {errors.tax && <p className="text-sm text-destructive">{errors.tax}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN</Label>
                    <Input value={localSettings.gstin} onChange={(e) => setLocalSettings(prev => ({ ...prev, gstin: e.target.value.toUpperCase() }))} />
                    {errors.gstin && <p className="text-sm text-destructive">{errors.gstin}</p>}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Show tax breakdown on bill</Label>
                    <p className="text-sm text-muted-foreground">Display CGST/SGST separately</p>
                  </div>
                  <Switch checked={localSettings.showTaxBreakdown} onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, showTaxBreakdown: checked }))} />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>{L.closingTime}</Label>
              <Input type="time" value={localSettings.closingTime || '23:00'} onChange={(e) => setLocalSettings(prev => ({ ...prev, closingTime: e.target.value }))} />
            </div>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" />{L.userManagement}</CardTitle>
              <Button onClick={handleAddUser} size="sm" className="gap-1.5"><Plus className="h-4 w-4" />Add Staff</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className={`flex items-center justify-between gap-2 p-3 bg-secondary/50 rounded-lg ${!user.isActive ? 'opacity-50' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{user.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{user.email} {user.pin ? `| PIN: ${user.pin}` : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant={user.isActive ? 'default' : 'secondary'} className="hidden sm:inline-flex">{roleLabels[user.role]}</Badge>
                    {!user.isActive && <Badge variant="outline" className="hidden sm:inline-flex">Inactive</Badge>}
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEditUser(user)}><Edit2 className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => handleDeleteUser(user)} disabled={user.role === 'owner'}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />{L.security}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cashier Discount Limit (%)</Label>
              <Input type="number" value={localSettings.cashierDiscountLimit} onChange={(e) => setLocalSettings(prev => ({ ...prev, cashierDiscountLimit: Number(e.target.value) }))} className="max-w-xs" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Require reason for cancellation</Label>
              </div>
              <Switch checked={localSettings.requireCancelReason} onCheckedChange={(checked) => setLocalSettings(prev => ({ ...prev, requireCancelReason: checked }))} />
            </div>
          </CardContent>
        </Card>
      </div>

      <UserDialog open={userDialogOpen} onOpenChange={setUserDialogOpen} user={editingUser} onSave={handleSaveUser} />
      <DeleteConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title="Delete User?" description={`Are you sure you want to delete "${deleteTarget?.name}"?`} onConfirm={handleConfirmDelete} />
    </div>
  );
}
