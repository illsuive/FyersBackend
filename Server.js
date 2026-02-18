const express = require('express');
const dotenv = require('dotenv');
const { router: fyersRouter, setIO } = require('./Fyers.js');
const data = require('./dummy.js');
const { createServer } = require('http');
const { Server } = require('socket.io');
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});


setIO(io);


const PORT = process.env.PORT || 4000;

app.get('/', (req, res) => {
    let CE = data.filter((item)=> item.option_type === 'CE') ;
    let PE = data.filter((item)=> item.option_type === 'PE') ;
  res.json({
    callOption : CE,
    putOption : PE
  })
});

app.use(express.json());
app.use('/api/fyers', fyersRouter);

// app.listen(PORT, '127.0.0.1' , () => {
//   console.log(`Server running at http://127.0.0.1:${PORT}`);
//   console.log(`Login URL: http://127.0.0.1:${PORT}/api/fyers/login`);
// });

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Login URL: http://localhost:${PORT}/api/fyers/login`);
});