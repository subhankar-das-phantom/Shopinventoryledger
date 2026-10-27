import { createApp } from './app.js';
import { connectDB, disconnectDB } from './config/db.js';
import { ENV } from './config/env.js';

const startServer = async () => {
  try {
    await connectDB();
    const app = createApp();

    const server = app.listen(ENV.PORT, '0.0.0.0', () => {
      console.log(`===============================================`);
      console.log(`  Shop Inventory Ledger Backend API`);
      console.log(`  Running on: http://0.0.0.0:${ENV.PORT}`);
      console.log(`  Environment: ${ENV.NODE_ENV}`);
      console.log(`===============================================`);
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await disconnectDB();
        console.log('Server and database connections closed cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    console.error('Fatal error during server startup:', error);
    process.exit(1);
  }
};

startServer();
