const readline = require('readline');
const express = require('express');
const path = require('path');
const open = require('open');
const app = express();
const fs = require('fs');

const http = require('http').Server(app);
const io = require('socket.io')(http);
const bodyparser = require('body-parser');
const jsonparser = bodyparser.json();

const port = process.env.PORT || 80;
const db = {};

// Open prompt, asking number of chrome tabs required (for local testing)
promptOpenUrlInNumerousTabs = (url) => {
  const input = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  input.question('How many tabs would you like to open?\n', (ans) => {
    const n = parseInt(ans);
    Array(n)
      .fill()
      .forEach((_, i) => {
        open(url, { app: ['chrome'] });
      });
  });
};

serve = () => {
  // Static files
  app.use(express.static('public'));

  // Just the index page
  app.get('/', (req, res) => {
    res.sendFile(path.resolve('index.html'));
  });

  // Get saved reports
  app.get('/report', (_, res) => {
    res.send(db.reports || {});
  });

  // Remove report by id
  app.delete('/report/:id', (req, res) => {
    delete db.reports[req.params.id];
    res.sendStatus(200);
  });

  // Save report by id
  app.post('/report/:id', jsonparser, (req, res) => {
    if (!db.reports) {
      db.reports = {};
    }
    try {
      db.reports[req.params.id] = req.body;
      res.sendStatus(200);
    } catch (e) {
      res.send(e);
    }
  });

  // Send token to start test run for given report id
  app.post('/start/:id', jsonparser, (req, res) => {
    try {
      db.token = req.body;
      console.log('Sent new token & report');
      io.emit('config', {
        token: db.token,
        report: db.reports[req.params.id],
      });
      res.sendStatus(200);
    } catch (e) {
      res.send(e);
    }
  });

  // Socket connection to gather the metrics
  io.on('connection', (socket) => {
    io.set('transports', ['websocket']);
    console.log('New tab connected');

    socket.emit('config', {
      token: db.token,
      report: db.report,
    });

    socket.on('metric', (data) => {
      data.timeStamp = new Date().toISOString();
      const body = JSON.stringify(data) + ',\n';
      fs.appendFile('logs/log.json', body, (err) => {
        if (err) throw err;
        console.log(body);
      });
    });

    socket.on('disconnect', () => {
      console.log('Tab disconnected');
    });
  });

  // Start server
  http.listen(port, () => {
    const url = `http://localhost:${port}`;
    promptOpenUrlInNumerousTabs(url);
    console.log(`listening on ${url}`);
  });
};

serve();
