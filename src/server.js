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

// Set port for server
const port = process.env.PORT || 80;
const debug = process.env.DEBUG || false;

// Read reports.json to pre-populate available reports
const reports = () => {
  const reports_path = 'public/reports.json';
  if (!fs.existsSync(reports_path)) return {};
  return JSON.parse(fs.readFileSync(reports_path, 'utf8'));
};

// Keep in-memory database
const db = {
  reports: Object.assign({}, reports(), {
    _: {},
  }),
  token: {},
  active_report: '_',
};

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
    const id = req.params.id;
    if (id == '_') {
      return res.sendStatus(403);
    }
    if (!(id in db.tokens)) {
      return res.sendStatus(404);
    }
    if (id == db.reports.active_report) {
      db.reports.active_report = '_';
    }
    delete db.reports[id];
    res.sendStatus(200);
  });

  // Save report by id
  app.post('/report/:id', jsonparser, (req, res) => {
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
      db.active_report = req.params.id;
      db.token = req.body;

      if (!(db.active_report in db.reports)) {
        return res.sendStatus(404);
      }

      // Trigger refresh on all clients
      io.emit('refresh');

      res.sendStatus(200);
    } catch (e) {
      res.send(e);
    }
  });

  // Stop clients
  app.post('/stop', jsonparser, (_, res) => {
    db.active_report = '_';
    db.token = {};
    // Trigger refresh on all clients
    io.emit('refresh');
    res.sendStatus(200);
  });

  // Socket connection to gather the metrics
  io.on('connection', (socket) => {
    io.set('transports', ['websocket']);
    console.log('New tab connected');

    socket.emit('config', {
      token: db.token,
      report: db.reports[db.active_report],
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
    if (debug) promptOpenUrlInNumerousTabs(url);
    console.log(`listening on ${url}`);
  });
};

serve();
