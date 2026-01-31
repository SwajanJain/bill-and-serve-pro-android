import React, { useState } from 'react';
import { Plus, Edit2, Trash2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePOS } from '@/contexts/POSContext';
import { Badge } from '@/components/ui/badge';
import { MenuItemDialog } from '@/components/menu/MenuItemDialog';
import { CategoryDialog } from '@/components/menu/CategoryDialog';
import { DeleteConfirmDialog } from '@/components/menu/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { MenuItem, Category } from '@/types';
import { L } from '@/lib/labels';

export default function MenuPage() {
  const { menuItems, categories, activeOrders, addMenuItem, updateMenuItem, deleteMenuItem, addCategory, updateCategory, deleteCategory } = usePOS();
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'item' | 'category'; id: string; name: string } | null>(null);

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const itemsByCategory = categories.reduce((acc, category) => {
    acc[category.id] = filteredItems.filter(item => item.categoryId === category.id);
    return acc;
  }, {} as Record<string, typeof menuItems>);

  const handleAddItem = () => { setEditingItem(null); setItemDialogOpen(true); };
  const handleEditItem = (item: MenuItem) => { setEditingItem(item); setItemDialogOpen(true); };

  // Phase 5.3: Block deletion if item in active order
  const handleDeleteItem = (item: MenuItem) => {
    const inActiveOrder = activeOrders.some(o =>
      o.status !== 'cancelled' && o.status !== 'paid' && o.lines.some(l => l.menuItemId === item.id)
    );
    if (inActiveOrder) {
      toast({ title: L.errorCannotDelete, description: L.errorItemInOrder, variant: 'destructive' });
      return;
    }
    setDeleteTarget({ type: 'item', id: item.id, name: item.name });
    setDeleteDialogOpen(true);
  };

  const handleAddCategory = () => { setEditingCategory(null); setCategoryDialogOpen(true); };
  const handleEditCategory = (category: Category) => { setEditingCategory(category); setCategoryDialogOpen(true); };

  const handleDeleteCategory = (category: Category) => {
    const itemsInCategory = menuItems.filter(item => item.categoryId === category.id);
    if (itemsInCategory.length > 0) {
      toast({ title: L.errorCannotDelete, description: `This category has ${itemsInCategory.length} items.`, variant: 'destructive' });
      return;
    }
    setDeleteTarget({ type: 'category', id: category.id, name: category.name });
    setDeleteDialogOpen(true);
  };

  const handleSaveItem = (data: { id?: string; name: string; categoryId: string; basePrice: number; taxRatePercent: number; isVeg: boolean; isActive: boolean }) => {
    if (data.id) { updateMenuItem(data.id, data); } else { addMenuItem(data); }
    toast({ title: L.itemAdded });
  };

  const handleSaveCategory = (data: { id?: string; name: string; sortOrder: number; isActive: boolean }) => {
    if (data.id) { updateCategory(data.id, data); } else { addCategory(data); }
    toast({ title: 'Category saved' });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'item') { deleteMenuItem(deleteTarget.id); } else { deleteCategory(deleteTarget.id); }
    toast({ title: `${deleteTarget.name} deleted` });
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">{L.menuManagement}</h1>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={handleAddCategory}><Plus className="h-4 w-4" />{L.addCategory}</Button>
          <Button className="gap-2" onClick={handleAddItem}><Plus className="h-4 w-4" />{L.addItem}</Button>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={L.searchMenu} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          <Button size="sm" variant={selectedCategory === null ? 'default' : 'outline'} onClick={() => setSelectedCategory(null)}>All</Button>
          {categories.map(cat => (
            <Button key={cat.id} size="sm" variant={selectedCategory === cat.id ? 'default' : 'outline'} onClick={() => setSelectedCategory(cat.id)}>
              {cat.name}
            </Button>
          ))}
        </div>
      </div>

      {menuItems.length === 0 && categories.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-4">{L.noMenuItems}</p>
          <Button onClick={handleAddCategory}><Plus className="h-4 w-4 mr-2" />{L.addCategory}</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {categories.filter(cat => !selectedCategory || cat.id === selectedCategory).map(category => {
            const items = itemsByCategory[category.id] || [];
            return (
              <Card key={category.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{category.name}</span>
                      <Badge variant="secondary">{items.length} items</Badge>
                      {!category.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditCategory(category)}><Edit2 className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteCategory(category)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {items.length === 0 ? (
                    <p className="text-muted-foreground text-sm py-4 text-center">
                      No items. <Button variant="link" className="px-1" onClick={handleAddItem}>{L.addItem}</Button>
                    </p>
                  ) : (
                    <div className="divide-y divide-border">
                      {items.map(item => (
                        <div key={item.id} className="flex items-center justify-between py-3">
                          <div className="flex items-center gap-3">
                            <div className={`shrink-0 w-5 h-5 border-2 rounded ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                              <div className={`w-2.5 h-2.5 rounded-full m-auto mt-0.5 ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                            </div>
                            <div>
                              <p className="font-medium">{item.name}</p>
                              <p className="text-sm text-muted-foreground">Tax: {item.taxRatePercent}% GST</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-semibold">{'\u20B9'}{item.basePrice}</span>
                            <Badge variant={item.isActive ? 'default' : 'secondary'}>{item.isActive ? 'Active' : 'Inactive'}</Badge>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditItem(item)}><Edit2 className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteItem(item)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <MenuItemDialog open={itemDialogOpen} onOpenChange={setItemDialogOpen} item={editingItem} categories={categories} onSave={handleSaveItem} />
      <CategoryDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} category={editingCategory} onSave={handleSaveCategory} />
      <DeleteConfirmDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} title={`Delete ${deleteTarget?.type === 'category' ? 'Category' : 'Item'}?`} description={`Are you sure you want to delete "${deleteTarget?.name}"?`} onConfirm={handleConfirmDelete} />
    </div>
  );
}
