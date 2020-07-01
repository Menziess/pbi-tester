const readline = require("readline");
const express = require("express");
const path = require('path');
const open = require('open');
const app = express();
const fs = require('fs');

const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 80;

let token = JSON.parse(fs.readFileSync('private/PBIToken.json', 'utf8'));
let report = JSON.parse(fs.readFileSync('public/PBIReport.json', 'utf8'));

// Open prompt, asking number of chrome tabs required
promptOpenUrlInNumerousTabs = (url) => {
  const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  input.question('How many tabs would you like to open?\n', (ans) => {
    const n = parseInt(ans);
    Array(n).fill().forEach((_, i) => {
      open(url, { app: ['chrome'] });
    });
  })
}

serve = () => {

  // Static files
  app.use(express.static('public'))

  // Just the index page
  app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
  });

  // Endpoint for updating token / report definition
  app.get('/set', (req, res) => {

    if (req.query.token) {
      fs.writeFileSync(path.resolve('private/PBIToken.json'), req.query.token);
      token = JSON.parse(req.query.token);
    }
    if (req.query.report) {
      fs.writeFileSync(path.resolve('public/PBIReport.json'), req.query.report);
      report = JSON.parse(req.query.report);
    }

    res.sendStatus(200);
  });

  // Socket connection to gather the metrics
  io.on('connection', (socket) => {
    io.set('transports', ['websocket']);
    console.log('New tab connected');

    socket.emit('config', {
      token: token,
      report: report,
    });

    socket.on('metric', (data) => {
      data.timeStamp = new Date().toISOString();
      const body = JSON.stringify(data) + ',\n';
      fs.appendFile(
        'logs/log.json',
        body,
        (err) => {
          if (err) throw err;
          console.log(body);
        }
      );
    });

    socket.on('disconnect', () => {
      console.log('Tab disconnected');
    });
  });

  // Start server
  http.listen(port, () => {
    const url = `http://localhost:${port}`
    promptOpenUrlInNumerousTabs(url);
    console.log(`listening on ${url}`);
  });
}

serve();
