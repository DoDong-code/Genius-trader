const http = require('node:http');
const { handleFundApi, sendJson } = require('./api/fund');
const { getDatabase, databasePath, closeDatabase } = require('./database/db');

function createServer() {
  getDatabase();
  return http.createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    try {
      if (url.pathname === '/api/health') {
        sendJson(response, 200, {
          success: true,
          service: 'fund-data',
          database: databasePath(),
          time: new Date().toISOString()
        });
        return;
      }
      if (await handleFundApi(request, response, url)) return;
      sendJson(response, 404, { success: false, error: '接口不存在' });
    } catch (error) {
      console.error('[api]', request.method, url.pathname, error);
      sendJson(response, error.statusCode || 500, {
        success: false,
        error: error.message || '服务器内部错误'
      });
    }
  });
}

function startServer(port = Number(process.env.FUND_API_PORT || 3002)) {
  const server = createServer();
  server.listen(port, '127.0.0.1', () => {
    console.log(`[fund-api] http://localhost:${port}`);
    console.log(`[fund-api] sqlite: ${databasePath()}`);
  });
  const shutdown = () => {
    server.close(() => {
      closeDatabase();
      process.exit(0);
    });
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return server;
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createServer,
  startServer
};
