import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { connectDB, disconnectDB } from '../config/db.js';

let mongod: MongoMemoryServer | null = null;

beforeAll(async () => {
  try {
    mongod = await MongoMemoryServer.create({
      instance: {
        dbName: 'shop_test_db'
      }
    });
    const uri = mongod.getUri();
    await connectDB(uri);
  } catch (err) {
    console.warn('[Test Setup] MongoMemoryServer initialization failed, falling back to local MongoDB test database:', err);
    await connectDB('mongodb://localhost:27017/shop_inventory_ledger_test');
  }
});

afterAll(async () => {
  await disconnectDB();
  if (mongod) {
    await mongod.stop();
  }
});

beforeEach(async () => {
  // Clear all collections between test cases for complete isolation
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});
