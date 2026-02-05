import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, Minus, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { usePOS } from '@/contexts/POSContext';
import { MenuItem, OrderLine } from '@/types';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { L } from '@/lib/labels';

export function MenuPanel() {
  const { menuItems, categories, currentOrder, currentOrderReadonlyReason, addItemToOrder, updateLineQty } = usePOS();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const [showLeftScroll, setShowLeftScroll] = useState(false);
  const [showRightScroll, setShowRightScroll] = useState(true);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase());
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory && item.isActive;
    });
  }, [menuItems, search, selectedCategory]);

  // Map of menuItemId -> controllable line when there is exactly one non-noted line.
  // For customized/multiple lines we show aggregate but keep controls disabled to avoid wrong edits.
  const orderQtyMap = useMemo(() => {
    const map = new Map<string, { lineId: string | null; qty: number; adjustable: boolean }>();
    if (currentOrder) {
      const groupedByItem = new Map<string, OrderLine[]>();
      for (const line of currentOrder.lines) {
        const lines = groupedByItem.get(line.menuItemId) || [];
        lines.push(line);
        groupedByItem.set(line.menuItemId, lines);
      }

      for (const [menuItemId, lines] of groupedByItem.entries()) {
        const qty = lines.reduce((sum, line) => sum + line.qty, 0);
        const singlePlainLine = lines.length === 1 && !lines[0].notes;
        map.set(menuItemId, {
          lineId: singlePlainLine ? lines[0].id : null,
          qty,
          adjustable: singlePlainLine,
        });
      }
    }
    return map;
  }, [currentOrder]);

  const updateScrollIndicators = () => {
    const el = categoryScrollRef.current;
    if (el) {
      setShowLeftScroll(el.scrollLeft > 10);
      setShowRightScroll(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
    }
  };

  useEffect(() => {
    const el = categoryScrollRef.current;
    if (el) {
      el.addEventListener('scroll', updateScrollIndicators);
      updateScrollIndicators();
      return () => el.removeEventListener('scroll', updateScrollIndicators);
    }
  }, []);

  const scrollCategories = (direction: 'left' | 'right') => {
    const el = categoryScrollRef.current;
    if (el) {
      el.scrollBy({ left: direction === 'left' ? -150 : 150, behavior: 'smooth' });
    }
  };

  const handleAddItem = async (item: MenuItem) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch (error) {
      void error;
    }
    addItemToOrder(item);
  };

  const handleInlineQty = async (lineId: string, newQty: number) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      void error;
    }
    updateLineQty(lineId, newQty);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Search */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={L.searchMenu}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-secondary border-0 h-12 text-base"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="relative border-b border-border">
        {showLeftScroll && (
          <button onClick={() => scrollCategories('left')} className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-background via-background/80 to-transparent z-10 flex items-center justify-start pl-1">
            <ChevronLeft className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        {showRightScroll && (
          <button onClick={() => scrollCategories('right')} className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-background via-background/80 to-transparent z-10 flex items-center justify-end pr-1">
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        )}
        <div ref={categoryScrollRef} className="flex gap-2 p-3 overflow-x-auto scrollbar-hide">
          <Button size="sm" variant={selectedCategory === null ? 'default' : 'secondary'} onClick={() => setSelectedCategory(null)} className="shrink-0 h-10 px-4">
            All
          </Button>
          {categories.filter(c => c.isActive).map(category => (
            <Button key={category.id} size="sm" variant={selectedCategory === category.id ? 'default' : 'secondary'} onClick={() => setSelectedCategory(category.id)} className="shrink-0 h-10 px-4">
              {category.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto p-3">
        {currentOrderReadonlyReason && (
          <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
            {currentOrderReadonlyReason}
          </div>
        )}
        {filteredItems.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-muted-foreground">
            {menuItems.length === 0 ? L.noMenuItems : L.noItems}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredItems.map(item => {
              const inOrder = orderQtyMap.get(item.id);

              return (
                <div
                  key={item.id}
                  className={`relative bg-card border border-border rounded-xl text-left p-4 transition-all duration-150 ${
                    inOrder ? 'ring-2 ring-primary/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`shrink-0 w-5 h-5 border-2 rounded ${item.isVeg ? 'border-green-600' : 'border-red-600'}`}>
                      <div className={`w-2.5 h-2.5 rounded-full m-auto mt-0.5 ${item.isVeg ? 'bg-green-600' : 'bg-red-600'}`} />
                    </div>
                    <span className="flex-1 text-base font-medium leading-tight truncate">{item.name}</span>
                    <span className="shrink-0 text-lg font-bold text-primary">₹{item.basePrice}</span>
                  </div>

                  {/* Phase 4.4: Inline quantity controls or Add button */}
                  <div className="mt-3">
                    {inOrder ? (
                      inOrder.adjustable ? (
                        <div className="flex items-center justify-center bg-primary/10 rounded-lg">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => inOrder.lineId && handleInlineQty(inOrder.lineId, inOrder.qty - 1)}
                            disabled={inOrder.qty <= 1 || !!currentOrderReadonlyReason}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="w-10 text-center text-lg font-bold text-primary">{inOrder.qty}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => inOrder.lineId && handleInlineQty(inOrder.lineId, inOrder.qty + 1)}
                            disabled={!!currentOrderReadonlyReason}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="outline"
                          className="w-full h-10"
                          onClick={() => handleAddItem(item)}
                          disabled={!!currentOrderReadonlyReason}
                        >
                          + {L.add} ({inOrder.qty})
                        </Button>
                      )
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full h-10"
                        onClick={() => handleAddItem(item)}
                        disabled={!!currentOrderReadonlyReason}
                      >
                        + {L.add}
                      </Button>
                    )}
                    {inOrder && !inOrder.adjustable && (
                      <p className="mt-1 text-center text-xs text-muted-foreground">Multiple/custom lines — edit in cart</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
