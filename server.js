const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = {}; // roomId => [userId]
const hosts = {}; // roomId => host socket.id

io.on('connection', socket => {
  console.log('🔌 مستخدم متصل:', socket.id);

  socket.on('join-room', (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = [];
      hosts[roomId] = socket.id;
    }

    rooms[roomId].push(socket.id);

    // إعلام المستخدم بدوره
    socket.emit('you-are', {
      role: (socket.id === hosts[roomId]) ? 'host' : 'participant'
    });

    // إعلام الآخرين بانضمام مستخدم جديد
    socket.to(roomId).emit('user-connected', socket.id);

    // عند إرسال عرض (offer)
    socket.on('offer', ({ to, offer }) => {
      io.to(to).emit('offer', { from: socket.id, offer });
    });

    // عند إرسال إجابة (answer)
    socket.on('answer', ({ to, answer }) => {
      io.to(to).emit('answer', { from: socket.id, answer });
    });

    // عند إرسال مرشح ICE
    socket.on('ice-candidate', ({ to, candidate }) => {
      io.to(to).emit('ice-candidate', { from: socket.id, candidate });
    });

    // عند قطع الاتصال
    socket.on('disconnect', () => {
      const room = Object.keys(rooms).find(r => rooms[r].includes(socket.id));
      if (room) {
        rooms[room] = rooms[room].filter(id => id !== socket.id);
        socket.to(room).emit('user-disconnected', socket.id);

        // إذا خرج المدير، نحول الإدارة لأول متصل
        if (hosts[room] === socket.id) {
          hosts[room] = rooms[room][0] || null;
          if (hosts[room]) {
            io.to(hosts[room]).emit('you-are', { role: 'host' });
          }
        }

        // إذا الغرفة أصبحت فارغة نحذفها
        if (rooms[room].length === 0) {
          delete rooms[room];
          delete hosts[room];
        }
      }
    });
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`🚀 سيرفر تموز يعمل على المنفذ ${PORT}`);
});
