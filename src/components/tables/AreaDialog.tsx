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
import { Area } from '@/types';

const areaSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

type AreaFormData = z.infer<typeof areaSchema>;

interface AreaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area?: Area | null;
  onSave: (data: AreaFormData & { id?: string }) => void;
}

export function AreaDialog({
  open,
  onOpenChange,
  area,
  onSave,
}: AreaDialogProps) {
  const isEditing = !!area;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AreaFormData>({
    resolver: zodResolver(areaSchema),
    defaultValues: {
      name: '',
    },
  });

  useEffect(() => {
    if (area) {
      reset({ name: area.name });
    } else {
      reset({ name: '' });
    }
  }, [area, reset]);

  const onSubmit = (data: AreaFormData) => {
    onSave({ ...data, id: area?.id });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Area' : 'Add New Area'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Area Name</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g., Main Hall, Garden"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">{isEditing ? 'Save Changes' : 'Add Area'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
