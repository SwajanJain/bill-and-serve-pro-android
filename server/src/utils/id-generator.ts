import { randomUUID } from 'crypto';
import { db } from '../db/index.js';
import { sequences } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export function generateId(): string {
  return randomUUID();
}

export function generateOrderNumber(): string {
  const today = new Date().toISOString().split('T')[0];

  // Get or reset sequence
  const seq = db.select().from(sequences).where(eq(sequences.name, 'order_number')).get();

  let currentValue = 1;

  if (seq) {
    if (seq.lastResetDate !== today && seq.resetDaily) {
      // Reset for new day
      db.update(sequences)
        .set({ currentValue: 1, lastResetDate: today })
        .where(eq(sequences.name, 'order_number'))
        .run();
      currentValue = 1;
    } else {
      // Increment
      currentValue = seq.currentValue + 1;
      db.update(sequences)
        .set({ currentValue })
        .where(eq(sequences.name, 'order_number'))
        .run();
    }
  } else {
    // Create sequence if it doesn't exist
    db.insert(sequences)
      .values({ name: 'order_number', currentValue: 1, prefix: 'ORD', resetDaily: true, lastResetDate: today })
      .run();
  }

  const dateStr = today.replace(/-/g, '');
  return `ORD-${dateStr}-${String(currentValue).padStart(3, '0')}`;
}

export function generateKOTNumber(): string {
  const today = new Date().toISOString().split('T')[0];

  // Get or reset sequence
  const seq = db.select().from(sequences).where(eq(sequences.name, 'kot_number')).get();

  let currentValue = 1;

  if (seq) {
    if (seq.lastResetDate !== today && seq.resetDaily) {
      // Reset for new day
      db.update(sequences)
        .set({ currentValue: 1, lastResetDate: today })
        .where(eq(sequences.name, 'kot_number'))
        .run();
      currentValue = 1;
    } else {
      // Increment
      currentValue = seq.currentValue + 1;
      db.update(sequences)
        .set({ currentValue })
        .where(eq(sequences.name, 'kot_number'))
        .run();
    }
  } else {
    // Create sequence if it doesn't exist
    db.insert(sequences)
      .values({ name: 'kot_number', currentValue: 1, prefix: 'KOT', resetDaily: true, lastResetDate: today })
      .run();
  }

  const time = new Date();
  const timeStr = `${String(time.getHours()).padStart(2, '0')}${String(time.getMinutes()).padStart(2, '0')}`;
  return `KOT-${timeStr}-${String(currentValue).padStart(2, '0')}`;
}
