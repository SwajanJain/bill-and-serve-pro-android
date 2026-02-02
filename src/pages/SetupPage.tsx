import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Plus, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { storage } from '@/lib/storage';
import { L } from '@/lib/labels';
import { User, Area, Table, Category, MenuItem, RestaurantSettings } from '@/types';
import { mockUsers, defaultSettings } from '@/data/mockData';

const generateId = () => crypto.randomUUID();

export default function SetupPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1: Restaurant details
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantPhone, setRestaurantPhone] = useState('');
  const [restaurantAddress, setRestaurantAddress] = useState('');
  const [gstin, setGstin] = useState('');

  // Step 2: Tax & timing
  const [gstEnabled, setGstEnabled] = useState(false);
  const [taxRate, setTaxRate] = useState(5);
  const [closingTime, setClosingTime] = useState('23:00');

  // Step 3: Areas & tables
  const [areas, setAreas] = useState<Area[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [newAreaName, setNewAreaName] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [selectedAreaId, setSelectedAreaId] = useState('');

  // Step 4: Menu
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newItemIsVeg, setNewItemIsVeg] = useState(true);

  // Step 5: Change PIN
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinError, setPinError] = useState('');

  // Check if setup already completed
  useEffect(() => {
    const checkSetup = async () => {
      const isComplete = await storage.isSetupComplete();
      if (isComplete) {
        navigate('/login', { replace: true });
      }
    };
    checkSetup();
  }, [navigate]);

  const totalSteps = 5;

  const handleSkipSetup = async () => {
    // Save defaults and mark setup complete — owner keeps PIN 1234
    await Promise.all([
      storage.saveRestaurantSettings(defaultSettings),
      storage.saveUsers(mockUsers),
      storage.saveAreas([]),
      storage.saveTables([]),
      storage.saveCategories([]),
      storage.saveMenuItems([]),
      storage.markSetupComplete(),
    ]);
    navigate('/login', { replace: true });
  };

  const handleAddArea = () => {
    if (!newAreaName.trim()) return;
    const area: Area = { id: generateId(), name: newAreaName.trim() };
    setAreas(prev => [...prev, area]);
    if (!selectedAreaId) setSelectedAreaId(area.id);
    setNewAreaName('');
  };

  const handleRemoveArea = (id: string) => {
    setAreas(prev => prev.filter(a => a.id !== id));
    setTables(prev => prev.filter(t => t.areaId !== id));
    if (selectedAreaId === id) {
      setSelectedAreaId(areas.find(a => a.id !== id)?.id || '');
    }
  };

  const handleAddTable = () => {
    if (!newTableName.trim() || !selectedAreaId) return;
    const table: Table = { id: generateId(), areaId: selectedAreaId, name: newTableName.trim(), isActive: true };
    setTables(prev => [...prev, table]);
    setNewTableName('');
  };

  const handleRemoveTable = (id: string) => {
    setTables(prev => prev.filter(t => t.id !== id));
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat: Category = { id: generateId(), name: newCategoryName.trim(), sortOrder: categories.length, isActive: true };
    setCategories(prev => [...prev, cat]);
    if (!selectedCategoryId) setSelectedCategoryId(cat.id);
    setNewCategoryName('');
  };

  const handleRemoveCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    setMenuItems(prev => prev.filter(i => i.categoryId !== id));
    if (selectedCategoryId === id) {
      setSelectedCategoryId(categories.find(c => c.id !== id)?.id || '');
    }
  };

  const handleAddItem = () => {
    if (!newItemName.trim() || !newItemPrice || !selectedCategoryId) return;
    const item: MenuItem = {
      id: generateId(),
      categoryId: selectedCategoryId,
      name: newItemName.trim(),
      basePrice: Number(newItemPrice),
      taxRatePercent: taxRate,
      isVeg: newItemIsVeg,
      isActive: true,
    };
    setMenuItems(prev => [...prev, item]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleRemoveItem = (id: string) => {
    setMenuItems(prev => prev.filter(i => i.id !== id));
  };

  const handleFinishSetup = async () => {
    if (newPin.length !== 4 || newPin !== confirmPin) {
      setPinError(L.pinMismatch);
      return;
    }
    if (newPin === '1234') {
      setPinError('PIN cannot be 1234');
      return;
    }

    // Save restaurant settings
    const settings: RestaurantSettings = {
      ...defaultSettings,
      name: restaurantName || 'My Restaurant',
      phone: restaurantPhone,
      address: restaurantAddress,
      gstEnabled,
      gstin: gstEnabled ? gstin : '',
      defaultTaxRate: gstEnabled ? taxRate : 0,
      closingTime,
    };

    // Update owner PIN
    const updatedUsers: User[] = mockUsers.map(u => ({
      ...u,
      pin: u.role === 'owner' ? newPin : u.pin,
      forcePasswordChange: false,
    }));

    // Save everything
    await Promise.all([
      storage.saveRestaurantSettings(settings),
      storage.saveUsers(updatedUsers),
      storage.saveAreas(areas),
      storage.saveTables(tables),
      storage.saveCategories(categories),
      storage.saveMenuItems(menuItems),
      storage.markSetupComplete(),
    ]);

    navigate('/login', { replace: true });
  };

  const canGoNext = () => {
    switch (step) {
      case 1: return restaurantName.trim().length > 0;
      case 2: return true;
      case 3: return true; // areas/tables are optional
      case 4: return true; // menu is optional
      case 5: return newPin.length === 4 && confirmPin.length === 4;
      default: return false;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg">
        <div className="flex justify-end px-6 pt-4">
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleSkipSetup}>
            {L.skip} &rarr;
          </Button>
        </div>
        <CardHeader className="text-center pt-0">
          {step === 1 && (
            <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
              <UtensilsCrossed className="h-8 w-8 text-primary" />
            </div>
          )}
          <CardTitle className="text-xl">
            {step === 1 && L.setupWelcome}
            {step === 2 && L.setupStep2}
            {step === 3 && L.setupStep3}
            {step === 4 && L.setupStep4}
            {step === 5 && L.setupStep5}
          </CardTitle>
          <CardDescription>
            Step {step} of {totalSteps}
          </CardDescription>
          {/* Progress bar */}
          <div className="flex gap-1 mt-3">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} className={`flex-1 h-1.5 rounded-full ${i < step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Restaurant Info */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <Label>Restaurant Name *</Label>
                <Input value={restaurantName} onChange={e => setRestaurantName(e.target.value)} placeholder="e.g., Shree Bhojanalaya" />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input value={restaurantPhone} onChange={e => setRestaurantPhone(e.target.value)} placeholder="e.g., 9876543210" inputMode="numeric" maxLength={10} />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input value={restaurantAddress} onChange={e => setRestaurantAddress(e.target.value)} placeholder="e.g., Main Road, Ganjbasoda" />
              </div>
            </>
          )}

          {/* Step 2: Tax & Timing */}
          {step === 2 && (
            <>
              <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                <div>
                  <Label>{L.gstEnabled}</Label>
                  <p className="text-sm text-muted-foreground">{L.gstEnabledDesc}</p>
                </div>
                <Switch checked={gstEnabled} onCheckedChange={setGstEnabled} />
              </div>

              {gstEnabled && (
                <>
                  <div className="space-y-2">
                    <Label>Default GST Rate (%)</Label>
                    <Input type="number" value={taxRate} onChange={e => setTaxRate(Number(e.target.value))} min={0} max={28} />
                    <p className="text-xs text-muted-foreground">Most restaurants use 5%</p>
                  </div>
                  <div className="space-y-2">
                    <Label>GSTIN (optional)</Label>
                    <Input value={gstin} onChange={e => setGstin(e.target.value)} placeholder="e.g., 23XXXXX1234X1Z5" maxLength={15} />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label>{L.closingTime}</Label>
                <Input type="time" value={closingTime} onChange={e => setClosingTime(e.target.value)} />
                <p className="text-xs text-muted-foreground">App will auto-logout staff after this time</p>
              </div>
            </>
          )}

          {/* Step 3: Areas & Tables */}
          {step === 3 && (
            <>
              <div className="space-y-2">
                <Label>Add Area</Label>
                <div className="flex gap-2">
                  <Input value={newAreaName} onChange={e => setNewAreaName(e.target.value)} placeholder="e.g., Ground Floor" onKeyDown={e => e.key === 'Enter' && handleAddArea()} />
                  <Button onClick={handleAddArea} disabled={!newAreaName.trim()}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              {areas.length > 0 && (
                <div className="space-y-2">
                  <Label>Areas</Label>
                  <div className="flex flex-wrap gap-2">
                    {areas.map(area => (
                      <div key={area.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${selectedAreaId === area.id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`} onClick={() => setSelectedAreaId(area.id)}>
                        {area.name}
                        <button onClick={e => { e.stopPropagation(); handleRemoveArea(area.id); }} className="ml-1 p-1.5 opacity-60 hover:opacity-100 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedAreaId && (
                <div className="space-y-2">
                  <Label>Add Table to "{areas.find(a => a.id === selectedAreaId)?.name}"</Label>
                  <div className="flex gap-2">
                    <Input value={newTableName} onChange={e => setNewTableName(e.target.value)} placeholder="e.g., T1" onKeyDown={e => e.key === 'Enter' && handleAddTable()} />
                    <Button onClick={handleAddTable} disabled={!newTableName.trim()}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {tables.filter(t => t.areaId === selectedAreaId).map(table => (
                      <div key={table.id} className="flex items-center gap-1 px-3 py-1.5 bg-secondary rounded-lg text-sm">
                        {table.name}
                        <button onClick={() => handleRemoveTable(table.id)} className="ml-1 p-1.5 opacity-60 hover:opacity-100 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {areas.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add areas like "Ground Floor", "First Floor", "Terrace"
                </p>
              )}
            </>
          )}

          {/* Step 4: Menu */}
          {step === 4 && (
            <>
              <div className="space-y-2">
                <Label>Add Category</Label>
                <div className="flex gap-2">
                  <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="e.g., Main Course" onKeyDown={e => e.key === 'Enter' && handleAddCategory()} />
                  <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}><Plus className="h-4 w-4" /></Button>
                </div>
              </div>

              {categories.length > 0 && (
                <div className="space-y-2">
                  <Label>Categories</Label>
                  <div className="flex flex-wrap gap-2">
                    {categories.map(cat => (
                      <div key={cat.id} className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm cursor-pointer ${selectedCategoryId === cat.id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`} onClick={() => setSelectedCategoryId(cat.id)}>
                        {cat.name}
                        <button onClick={e => { e.stopPropagation(); handleRemoveCategory(cat.id); }} className="ml-1 p-1.5 opacity-60 hover:opacity-100 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedCategoryId && (
                <div className="space-y-2">
                  <Label>Add Item to "{categories.find(c => c.id === selectedCategoryId)?.name}"</Label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input value={newItemName} onChange={e => setNewItemName(e.target.value)} placeholder="Item name" className="flex-1" />
                    <div className="flex gap-2">
                      <Input type="number" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} placeholder="Price" className="w-24" inputMode="numeric" />
                      <Button variant="outline" size="icon" onClick={() => setNewItemIsVeg(!newItemIsVeg)} title={newItemIsVeg ? 'Veg' : 'Non-Veg'}>
                        <div className={`w-4 h-4 border-2 rounded ${newItemIsVeg ? 'border-green-600 bg-green-600' : 'border-red-600 bg-red-600'}`} />
                      </Button>
                      <Button onClick={handleAddItem} disabled={!newItemName.trim() || !newItemPrice}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <div className="space-y-1 mt-2">
                    {menuItems.filter(i => i.categoryId === selectedCategoryId).map(item => (
                      <div key={item.id} className="flex items-center justify-between px-3 py-2 bg-secondary rounded-lg text-sm">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 border rounded ${item.isVeg ? 'border-green-600 bg-green-100' : 'border-red-600 bg-red-100'}`} />
                          <span>{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{'\u20B9'}{item.basePrice}</span>
                          <button onClick={() => handleRemoveItem(item.id)} className="p-1.5 opacity-60 hover:opacity-100 rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add categories like "Starters", "Main Course", "Beverages"
                </p>
              )}
            </>
          )}

          {/* Step 5: Change PIN */}
          {step === 5 && (
            <>
              <p className="text-sm text-muted-foreground">{L.changePinDesc}</p>
              <div className="space-y-2">
                <Label>{L.newPin}</Label>
                <Input type="text" inputMode="numeric" maxLength={4} value={newPin} onChange={e => { setNewPin(e.target.value.replace(/\D/g, '')); setPinError(''); }} placeholder="Enter 4-digit PIN" className="text-center text-2xl tracking-widest" />
              </div>
              <div className="space-y-2">
                <Label>{L.confirmPin}</Label>
                <Input type="text" inputMode="numeric" maxLength={4} value={confirmPin} onChange={e => { setConfirmPin(e.target.value.replace(/\D/g, '')); setPinError(''); }} placeholder="Confirm PIN" className="text-center text-2xl tracking-widest" />
              </div>
              {pinError && <p className="text-sm text-destructive">{pinError}</p>}
            </>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-4">
            {step > 1 && (
              <Button variant="outline" className="flex-1 h-12" onClick={() => setStep(s => s - 1)}>
                {L.previous}
              </Button>
            )}
            {step < totalSteps ? (
              <Button className="flex-1 h-12" onClick={() => setStep(s => s + 1)} disabled={!canGoNext()}>
                {L.next}
              </Button>
            ) : (
              <Button className="flex-1 h-12 gap-2" onClick={handleFinishSetup} disabled={!canGoNext()}>
                <Check className="h-5 w-5" />
                {L.finishSetup}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
