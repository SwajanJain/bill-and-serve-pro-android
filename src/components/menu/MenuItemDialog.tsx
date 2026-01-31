import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MenuItem, Category } from '@/types';
import { useSettings } from '@/contexts/SettingsContext';

const menuItemSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  categoryId: z.string().min(1, 'Category is required'),
  basePrice: z.number().min(0, 'Price must be positive'),
  taxRatePercent: z.number().min(0).max(100),
  isVeg: z.boolean(),
  isActive: z.boolean(),
});

type MenuItemFormData = z.infer<typeof menuItemSchema>;

interface MenuItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: MenuItem | null;
  categories: Category[];
  onSave: (data: MenuItemFormData & { id?: string }) => void;
}

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  categories,
  onSave,
}: MenuItemDialogProps) {
  const isEditing = !!item;
  const { settings } = useSettings();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<MenuItemFormData>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      basePrice: 0,
      taxRatePercent: 5,
      isVeg: true,
      isActive: true,
    },
  });

  const isVeg = watch('isVeg');
  const isActive = watch('isActive');
  const categoryId = watch('categoryId');

  useEffect(() => {
    if (item) {
      reset({
        name: item.name,
        categoryId: item.categoryId,
        basePrice: item.basePrice,
        taxRatePercent: item.taxRatePercent,
        isVeg: item.isVeg,
        isActive: item.isActive,
      });
    } else {
      reset({
        name: '',
        categoryId: categories[0]?.id || '',
        basePrice: 0,
        taxRatePercent: 5,
        isVeg: true,
        isActive: true,
      });
    }
  }, [item, categories, reset]);

  const onSubmit = (data: MenuItemFormData) => {
    onSave({ ...data, id: item?.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Item' : 'Add New Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Item Name</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g., Butter Chicken"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={categoryId}
              onValueChange={(value) => setValue('categoryId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-sm text-destructive">{errors.categoryId.message}</p>
            )}
          </div>

          <div className={`grid ${settings.gstEnabled ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
            <div className="space-y-2">
              <Label htmlFor="basePrice">Price (₹)</Label>
              <Input
                id="basePrice"
                type="number"
                step="0.01"
                {...register('basePrice', { valueAsNumber: true })}
              />
              {errors.basePrice && (
                <p className="text-sm text-destructive">{errors.basePrice.message}</p>
              )}
            </div>

            {settings.gstEnabled && (
              <div className="space-y-2">
                <Label htmlFor="taxRatePercent">Tax Rate (%)</Label>
                <Input
                  id="taxRatePercent"
                  type="number"
                  step="0.1"
                  {...register('taxRatePercent', { valueAsNumber: true })}
                />
                {errors.taxRatePercent && (
                  <p className="text-sm text-destructive">{errors.taxRatePercent.message}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch
                id="isVeg"
                checked={isVeg}
                onCheckedChange={(checked) => setValue('isVeg', checked)}
              />
              <Label htmlFor="isVeg" className="flex items-center gap-2">
                <span className={`veg-indicator ${isVeg ? 'veg' : 'non-veg'}`} />
                {isVeg ? 'Vegetarian' : 'Non-Vegetarian'}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
              />
              <Label htmlFor="isActive">{isActive ? 'Active' : 'Inactive'}</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Add Item'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
