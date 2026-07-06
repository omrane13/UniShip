import mongoose from 'mongoose';

export interface DBStatus {
  isConnected: boolean;
  uriConfigured: boolean;
  error?: string;
}

let isConnected = false;

export async function connectMongoDB(): Promise<DBStatus> {
  const MONGODB_URI = process.env['MONGODB_URI'];
  if (!MONGODB_URI) {
    console.warn('[Mongoose Connection] MONGODB_URI environment variable is missing. Falling back to In-Memory store.');
    return { isConnected: false, uriConfigured: false };
  }

  if (isConnected) {
    return { isConnected: true, uriConfigured: true };
  }

  try {
    // Prevent multiple connections
    if (mongoose.connection.readyState >= 1) {
      isConnected = true;
      return { isConnected: true, uriConfigured: true };
    }

    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Fast timeout for safety
    });

    isConnected = true;
    console.log('💚 [Mongoose Connection] Connected successfully to MongoDB!');
    return { isConnected: true, uriConfigured: true };
  } catch (error) {
    const err = error as Error;
    console.error('❌ [Mongoose Connection] Failed to connect to MongoDB:', err.message || err);
    isConnected = false;
    return { isConnected: false, uriConfigured: true, error: err.message };
  }
}

export function isMongoEnabled(): boolean {
  return !!process.env['MONGODB_URI'] && isConnected && mongoose.connection.readyState === 1;
}
