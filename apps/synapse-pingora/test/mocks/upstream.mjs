import http from 'node:http';

const server = http.createServer((req, res) => {
  const method = req.method;
  const url = req.url;
  console.log(`${new Date().toISOString()} ${method} ${url}`);

  // Simulate a standard API response
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    path: url,
    method: method,
    timestamp: new Date().toISOString()
  }));
});

const port = process.env.PORT || 8081;
server.listen(port, () => {
  console.log(`Mock upstream listening on port ${port}`);
});
