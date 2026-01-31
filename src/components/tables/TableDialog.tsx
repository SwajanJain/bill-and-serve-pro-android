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
import { Table, Area } from '@/types';

const tableSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  areaId: z.string().min(1, 'Area is required'),
  isActive: z.boolean(),
});

type TableFormData = z.infer<typeof tableSchema>;

interface TableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: Table | null;
  areas: Area[];
  onSave: (data: TableFormData & { id?: string }) => void;
}

export function TableDialog({
  open,
  onOpenChange,
  table,
  areas,
  onSave,
}: TableDialogProps) {
  const isEditing = !!table;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<TableFormData>({
    resolver: zodResolver(tableSchema),
    defaultValues: {
      name: '',
      areaId: '',
      isActive: true,
    },
  });

  const isActive = watch('isActive');
  const areaId = watch('areaId');

  useEffect(() => {
    if (table) {
      reset({
        name: table.name,
        areaId: table.areaId,
        isActive: table.isActive,
      });
    } else {
      reset({
        name: '',
        areaId: areas[0]?.id || '',
        isActive: true,
      });
    }
  }, [table, areas, reset]);

  const onSubmit = (data: TableFormData) => {
    onSave({ ...data, id: table?.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Table' : 'Add New Table'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Table Name/Number</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g., T1, Table 5"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">Area</Label>
            <Select
              value={areaId}
              onValueChange={(value) => setValue('areaId', value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select area" />
              </SelectTrigger>
              <SelectContent>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.areaId && (
              <p className="text-sm text-destructive">{errors.areaId.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="isActive"
              checked={isActive}
              onCheckedChange={(checked) => setValue('isActive', checked)}
            />
            <Label htmlFor="isActive">{isActive ? 'Active' : 'Inactive'}</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Add Table'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
