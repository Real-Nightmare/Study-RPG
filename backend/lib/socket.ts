import { Server as SocketIOServer } from 'socket.io';
import { verifyToken } from '@/lib/auth';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initializeSocket(server: any) {
  io = new SocketIOServer(server, {
    cors: {
      origin: process.env.CORS_ORIGIN?.split(',') || ['*'],
      credentials: true,
    },
    path: '/socket.io',
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error'));
    }
    const payload = verifyToken(token);
    if (!payload) {
      return next(new Error('Authentication error'));
    }
    socket.data.user = payload;
    next();
  });

  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id} (user: ${socket.data.user?.sub || 'unauthenticated'})`);
  });

  return io;
}
