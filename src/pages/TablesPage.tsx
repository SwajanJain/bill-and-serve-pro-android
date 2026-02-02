import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UtensilsCrossed, Plus, Edit2, Trash2, Unlock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSettings } from '@/contexts/SettingsContext';
import { usePOS } from '@/contexts/POSContext';
import { TableDialog } from '@/components/tables/TableDialog';
import { AreaDialog } from '@/components/tables/AreaDialog';
import { DeleteConfirmDialog } from '@/components/menu/DeleteConfirmDialog';
import { useToast } from '@/hooks/use-toast';
import { Table, Area } from '@/types';
import { L } from '@/lib/labels';
import { useBackHandler } from '@/hooks/use-back-handler';

export default function TablesPage() {
  const { areas, tables, addArea, updateArea, deleteArea, addTable, updateTable, deleteTable } = useSettings();
  const { selectTable, freeTable, tableOrderMap, activeOrders } = usePOS();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [areaDialogOpen, setAreaDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<Table | null>(null);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'table' | 'area'; id: string; name: string } | null>(null);
  const [freeTableTarget, setFreeTableTarget] = useState<{ tableId: string; name: string } | null>(null);

  // Back button handlers
  useBackHandler('tables-delete-confirm', deleteDialogOpen, () => setDeleteDialogOpen(false), 100);
  useBackHandler('tables-free-confirm', !!freeTableTarget, () => setFreeTableTarget(null), 100);
  useBackHandler('tables-table-dialog', tableDialogOpen, () => setTableDialogOpen(false), 90);
  useBackHandler('tables-area-dialog', areaDialogOpen, () => setAreaDialogOpen(false), 90);

  const handleTableClick = (tableId: string) => {
    selectTable(tableId);
    navigate('/pos');
  };

  const handleAddTable = () => { setEditingTable(null); setTableDialogOpen(true); };
  const handleEditTable = (e: React.MouseEvent, table: Table) => { e.stopPropagation(); setEditingTable(table); setTableDialogOpen(true); };

  const handleDeleteTable = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    if (tableOrderMap.has(table.id)) {
      toast({ title: L.errorCannotDelete, description: L.errorActiveOrder, variant: 'destructive' });
      return;
    }
    setDeleteTarget({ type: 'table', id: table.id, name: table.name });
    setDeleteDialogOpen(true);
  };

  const handleSaveTable = (data: { id?: string; name: string; areaId: string; isActive: boolean }) => {
    if (data.id) {
      // Phase 5.8: Prevent deactivating table with active order
      if (!data.isActive && tableOrderMap.has(data.id)) {
        toast({ title: L.errorCannotDelete, description: L.errorActiveOrder, variant: 'destructive' });
        return;
      }
      updateTable(data.id, data);
      toast({ title: L.tableSaved });
    } else {
      addTable(data);
      toast({ title: L.tableSaved });
    }
  };

  const handleAddArea = () => { setEditingArea(null); setAreaDialogOpen(true); };
  const handleEditArea = (area: Area) => { setEditingArea(area); setAreaDialogOpen(true); };

  const handleDeleteArea = (area: Area) => {
    const tablesInArea = tables.filter(t => t.areaId === area.id);
    if (tablesInArea.length > 0) {
      toast({ title: L.errorCannotDelete, description: `This area has ${tablesInArea.length} tables.`, variant: 'destructive' });
      return;
    }
    setDeleteTarget({ type: 'area', id: area.id, name: area.name });
    setDeleteDialogOpen(true);
  };

  const handleSaveArea = (data: { id?: string; name: string }) => {
    if (data.id) {
      updateArea(data.id, data);
    } else {
      addArea(data);
    }
    toast({ title: L.areaSaved });
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'table') {
      deleteTable(deleteTarget.id);
    } else {
      deleteArea(deleteTarget.id);
    }
    toast({ title: `${deleteTarget.name} deleted` });
    setDeleteDialogOpen(false);
    setDeleteTarget(null);
  };

  const handleFreeTable = (e: React.MouseEvent, table: Table) => {
    e.stopPropagation();
    setFreeTableTarget({ tableId: table.id, name: table.name });
  };

  const handleConfirmFreeTable = () => {
    if (!freeTableTarget) return;
    freeTable(freeTableTarget.tableId);
    toast({ title: L.tableFreed });
    setFreeTableTarget(null);
  };

  // Get order summary for a table
  const getTableOrderSummary = (tableId: string) => {
    const orderId = tableOrderMap.get(tableId);
    if (!orderId) return null;
    const order = activeOrders.find(o => o.id === orderId);
    if (!order) return null;
    return { total: order.grandTotal, items: order.lines.length };
  };

  return (
    <div className="p-3 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h1 className="text-xl sm:text-2xl font-bold">{L.tables}</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleAddArea}>
            <Plus className="h-4 w-4" />{L.addArea}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={handleAddTable}>
            <Plus className="h-4 w-4" />{L.addTable}
          </Button>
        </div>
      </div>

      <div className="space-y-8">
        {areas.map(area => {
          const areaTables = tables.filter(t => t.areaId === area.id);
          const activeTables = areaTables.filter(t => t.isActive);
          const occupiedCount = activeTables.filter(t => tableOrderMap.has(t.id)).length;

          return (
            <div key={area.id}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-lg font-semibold">{area.name}</h2>
                  <Badge variant="secondary">{occupiedCount}/{activeTables.length} {L.occupied}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditArea(area)}>
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteArea(area)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {areaTables.length === 0 ? (
                <p className="text-muted-foreground text-sm py-4">
                  No tables in this area. <Button variant="link" className="px-1" onClick={handleAddTable}>{L.addTable}</Button>
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                  {areaTables.map(table => {
                    const isOccupied = tableOrderMap.has(table.id);
                    const summary = getTableOrderSummary(table.id);

                    return (
                      <div key={table.id} className={`table-card ${isOccupied ? 'occupied' : 'available'} ${!table.isActive ? 'opacity-50' : ''} relative`}>
                        <button
                          onClick={() => table.isActive && handleTableClick(table.id)}
                          disabled={!table.isActive}
                          className="w-full h-full flex flex-col items-center justify-center"
                        >
                          <UtensilsCrossed className={`h-8 w-8 mb-2 ${isOccupied ? 'text-warning' : 'text-muted-foreground'}`} />
                          <span className="text-lg font-bold">{table.name}</span>
                          <span className={`text-sm ${isOccupied ? 'text-warning' : 'text-muted-foreground'}`}>
                            {!table.isActive ? L.inactive : isOccupied ? L.occupied : L.available}
                          </span>
                          {/* Phase 4.9: Show order summary */}
                          {summary && (
                            <span className="text-xs text-warning font-medium mt-1">
                              {'\u20B9'}{summary.total.toFixed(0)} | {summary.items} items
                            </span>
                          )}
                        </button>

                        {/* Always visible buttons */}
                        <div className="absolute top-1 right-1 flex gap-0.5">
                          {isOccupied && (
                            <Button variant="secondary" size="icon" className="h-8 w-8 text-warning" onClick={(e) => handleFreeTable(e, table)} title={L.freeTable}>
                              <Unlock className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="secondary" size="icon" className="h-8 w-8" onClick={(e) => handleEditTable(e, table)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="secondary" size="icon" className="h-8 w-8 text-destructive" onClick={(e) => handleDeleteTable(e, table)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {areas.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">{L.noAreas}</p>
            <Button onClick={handleAddArea}><Plus className="h-4 w-4 mr-2" />{L.addArea}</Button>
          </div>
        )}
      </div>

      <TableDialog open={tableDialogOpen} onOpenChange={setTableDialogOpen} table={editingTable} areas={areas} onSave={handleSaveTable} />
      <AreaDialog open={areaDialogOpen} onOpenChange={setAreaDialogOpen} area={editingArea} onSave={handleSaveArea} />
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={`Delete ${deleteTarget?.type === 'area' ? 'Area' : 'Table'}?`}
        description={`Are you sure you want to delete "${deleteTarget?.name}"?`}
        onConfirm={handleConfirmDelete}
      />
      <DeleteConfirmDialog
        open={!!freeTableTarget}
        onOpenChange={(open) => { if (!open) setFreeTableTarget(null); }}
        title={L.freeTableConfirm}
        description={`${freeTableTarget?.name}: ${L.freeTableDesc}`}
        onConfirm={handleConfirmFreeTable}
      />
    </div>
  );
}
