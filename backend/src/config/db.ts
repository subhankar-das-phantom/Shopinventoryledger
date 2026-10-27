import mongoose from 'mongoose';
import { ENV } from './env.js';

let isReplicaSet = false;

export const connectDB = async (uri?: string): Promise<typeof mongoose> => {
  const connectionUri = uri || ENV.MONGODB_URI;
  try {
    const conn = await mongoose.connect(connectionUri, {
      autoIndex: true
    });

    console.log(`[MongoDB] Connected to database: ${conn.connection.name} at ${conn.connection.host}:${conn.connection.port}`);

    // Check if connected instance supports replica set transactions
    try {
      const adminDb = conn.connection.db?.admin();
      if (adminDb) {
        const hello = await adminDb.command({ hello: 1 });
        isReplicaSet = Boolean(hello.setName || hello.hosts);
      }
    } catch {
      isReplicaSet = false;
    }

    if (isReplicaSet) {
      console.log(`[MongoDB] Replica set detected. Multi-document ACID transactions enabled.`);
    } else {
      console.log(`[MongoDB] Running in standalone mode. Compensating atomic updates enabled.`);
    }

    return conn;
  } catch (error) {
    console.error('[MongoDB] Connection error:', error);
    throw error;
  }
};

export const disconnectDB = async (): Promise<void> => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected from database.');
  }
};

export const hasReplicaSetSupport = (): boolean => isReplicaSet;
