import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';

let io: SocketIOServer | null = null;

export interface KOTCreatedEvent {
  id: string;
  orderId: string;
  kotNumber: string;
  tableName: string | null;
  orderType: string;
  lines: Array<{
    id: string;
    menuItemName: string;
    qty: number;
    notes: string | null;
  }>;
  createdAt: Date;
}

export interface KOTUpdatedEvent {
  id: string;
  status: 'new' | 'preparing' | 'ready';
  updatedAt: Date;
}

export interface OrderUpdatedEvent {
  id: string;
  orderNumber: string;
  status: string;
  subtotal: number;
  taxTotal: number;
  grandTotal: number;
}

export interface TableUpdatedEvent {
  id: string;
  name: string;
  currentOrderId: string | null;
}

export function setupSocketIO(server: HTTPServer): SocketIOServer {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Join rooms based on client type
    socket.on('join:kitchen', () => {
      socket.join('kitchen');
      console.log(`👨‍🍳 Client ${socket.id} joined kitchen room`);
    });

    socket.on('join:pos', () => {
      socket.join('pos');
      console.log(`💳 Client ${socket.id} joined POS room`);
    });

    socket.on('leave:kitchen', () => {
      socket.leave('kitchen');
    });

    socket.on('leave:pos', () => {
      socket.leave('pos');
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

export function getIO(): SocketIOServer {
  if (!io) {
    throw new Error('Socket.io not initialized. Call setupSocketIO first.');
  }
  return io;
}

// Helper functions to emit events
export function emitKOTCreated(data: KOTCreatedEvent) {
  if (io) {
    io.to('kitchen').emit('kot:created', data);
    io.to('pos').emit('kot:created', data);
  }
}

export function emitKOTUpdated(data: KOTUpdatedEvent) {
  if (io) {
    io.to('kitchen').emit('kot:updated', data);
    io.to('pos').emit('kot:updated', data);
  }
}

export function emitOrderUpdated(data: OrderUpdatedEvent) {
  if (io) {
    io.to('pos').emit('order:updated', data);
  }
}

export function emitTableUpdated(data: TableUpdatedEvent) {
  if (io) {
    io.to('pos').emit('table:updated', data);
  }
}
