import { Server, Socket } from 'socket.io';

let ioInstance: Server | null = null;

export const SOCKET_EVENTS = {
  // Server -> Client Broadcasts
  QUEUE_UPDATED: 'queue:updated',
  TICKET_CALLED: 'ticket:called',
  TICKET_SKIPPED: 'ticket:skipped',
  TICKET_CREATED: 'ticket:created',
  
  // Client -> Server Actions
  JOIN_DISPLAY_ROOM: 'room:join_display',
} as const;

export function initQueueSockets(io: Server) {
  ioInstance = io;

  io.on('connection', (socket: Socket) => {
    console.log(`⚡ [Socket.io] Client connected: ${socket.id}`);

    // Allow clients (e.g., Public TV Display) to join a dedicated room
    socket.on(SOCKET_EVENTS.JOIN_DISPLAY_ROOM, () => {
      socket.join('display_board');
      console.log(`📺 [Socket.io] Client ${socket.id} joined 'display_board' room.`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ [Socket.io] Client disconnected: ${socket.id}`);
    });
  });
}

/**
 * Broadcast real-time queue updates to all clients or specific rooms
 */
export function broadcastQueueEvent(event: string, payload: any) {
  if (!ioInstance) {
    console.warn('⚠️ [Socket.io] Server instance not initialized yet.');
    return;
  }
  
  // Emit to all connected sockets
  ioInstance.emit(event, payload);
  console.log(`📡 [Socket.io] Emitted '${event}' broadcast.`);
}