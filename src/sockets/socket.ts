import type { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { verifyAccessToken } from '../utils/jwt.util';
import { isAllowedOrigin } from '../config/security';
import { verifyActiveSession } from '../middleware/auth.middleware';

let io: SocketIOServer | null = null;

export const initSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin)) {
          callback(null, true);
          return;
        }
        callback(new Error('Origin not allowed by CORS'));
      },
      methods: ['GET', 'POST'],
    },
  });

  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) {
        return next(new Error('No token provided'));
      }
      const decoded = await verifyAccessToken(token);
      await verifyActiveSession(decoded);
      (socket.data as { userId: string }).userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const userId = socket.data.userId as string;
    socket.join(`user:${userId}`);

    socket.on('disconnect', () => {
      // room membership is cleaned up automatically by socket.io on disconnect
    });
  });

  return io;
};

export const emitToUser = (userId: string, event: string, payload: unknown): void => {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
};

export const getIO = (): SocketIOServer | null => io;

export const broadcastEvent = (event: string, payload: unknown): void => {
  if (!io) return;
  io.emit(event, payload);
};
