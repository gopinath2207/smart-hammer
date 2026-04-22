import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';
let socket = null;

export const connectSocket = (token) => {
  if (socket?.connected) return socket;

  socket = io(SOCKET_URL, {
    auth             : { token },
    transports       : ['websocket'],
    reconnection     : true,
    reconnectionAttempts : 5,
    reconnectionDelay    : 1000,
  });

  socket.on('connect',       () => console.log('Socket connected:', socket.id));
  socket.on('disconnect',    () => console.log('Socket disconnected'));
  socket.on('connect_error', (err) => console.error('Socket error:', err.message));

  return socket;
};

export const getSocket      = () => socket;
export const disconnectSocket = () => {
  if (socket) { socket.disconnect(); socket = null; }
};