import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

export const ENV = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '5000', 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/shop_inventory_ledger',
  JWT_SECRET: process.env.JWT_SECRET || 'fallback_development_secret_do_not_use_in_prod_123456789',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173'
};
