const jwt = require('jsonwebtoken');

const initSocket = (httpServer) => {
  const { Server } = require('socket.io');

  const io = new Server(httpServer, {
    cors: {
      origin      : process.env.CLIENT_URL,
      methods     : ['GET', 'POST'],
      credentials : true,
    },
    pingTimeout  : 60000,
    pingInterval : 25000,
  });

  // ─────────────────────────────────────────────
  // Auth Middleware — verify JWT on connect
  // ─────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        socket.user = null;
        return next();
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded;
      next();
    } catch (err) {
      socket.user = null;
      next();
    }
  });

  // ─────────────────────────────────────────────
  // Connection Handler
  // ─────────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(
      `Socket connected: ${socket.id} | User: ${socket.user?.username || 'guest'}`
    );

    // ── Join personal room for private notifications ──
    if (socket.user) {
      socket.join(`user:${socket.user.user_id}`);
      console.log(`${socket.user.username} joined personal room`);
    }

    // ── Join auction room ──
    socket.on('auction:join', (auctionId) => {
      socket.join(`auction:${auctionId}`);
      console.log(`Socket ${socket.id} joined auction:${auctionId}`);

      // Broadcast updated viewer count to room
      const roomSize =
        io.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 0;
      io.to(`auction:${auctionId}`).emit('auction:viewers', {
        auction_id : auctionId,
        viewers    : roomSize,
      });
    });

    // ── Leave auction room ──
    socket.on('auction:leave', (auctionId) => {
      socket.leave(`auction:${auctionId}`);
      console.log(`Socket ${socket.id} left auction:${auctionId}`);

      const roomSize =
        io.sockets.adapter.rooms.get(`auction:${auctionId}`)?.size || 0;
      io.to(`auction:${auctionId}`).emit('auction:viewers', {
        auction_id : auctionId,
        viewers    : roomSize,
      });
    });

    // ── Bid typing indicator ──
    socket.on('bid:typing', (auctionId) => {
      socket.to(`auction:${auctionId}`).emit('bid:typing', {
        username : socket.user?.username || 'Someone',
      });
    });

    // ── Disconnect ──
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

module.exports = { initSocket };