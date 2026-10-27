import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDB, disconnectDB } from '../config/db.js';

// Each test worker thread gets its own isolated database name
const workerId = process.env.VITEST_POOL_ID || String(process.pid);
const TEST_DB_URI = `mongodb://localhost:27017/shop_ledger_test_${workerId}`;

beforeAll(async () => {
  await connectDB(TEST_DB_URI);
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    try {
      await mongoose.connection.db.dropDatabase();
    } catch {
      // Ignore drop error on teardown
    }
  }
  await disconnectDB();
});

beforeEach(async () => {
  // Clear all collections between test cases for complete test isolation
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});
