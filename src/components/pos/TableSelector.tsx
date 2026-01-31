import React from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { usePOS } from '@/contexts/POSContext';
import { useSettings } from '@/contexts/SettingsContext';
import { L } from '@/lib/labels';

interface TableSelectorProps {
  onTableSelect: (tableId: string) => void;
}

export function TableSelector({ onTableSelect }: TableSelectorProps) {
  const { tableOrderMap } = usePOS();
  const { areas, tables } = useSettings();

  if (areas.length === 0) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        {L.noAreas}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {areas.map(area => {
        const areaTables = tables.filter(t => t.areaId === area.id && t.isActive);

        return (
          <div key={area.id}>
            <h3 className="text-lg font-semibold mb-3 text-muted-foreground">{area.name}</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {areaTables.map(table => {
                const isOccupied = tableOrderMap.has(table.id);

                return (
                  <button
                    key={table.id}
                    onClick={() => onTableSelect(table.id)}
                    className={`table-card ${isOccupied ? 'occupied' : 'available'}`}
                  >
                    <UtensilsCrossed className={`h-6 w-6 mb-2 ${isOccupied ? 'text-warning' : 'text-muted-foreground'}`} />
                    <span className="font-semibold">{table.name}</span>
                    <span className={`text-xs ${isOccupied ? 'text-warning' : 'text-muted-foreground'}`}>
                      {isOccupied ? L.occupied : L.available}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
