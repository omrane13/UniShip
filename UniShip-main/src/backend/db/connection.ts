import mongoose from 'mongoose';

export interface DBStatus {
  isConnected: boolean;
  uriConfigured: boolean;
  error?: string;
  isLocalFallback?: boolean;
}

let isConnected = false;
let usingLocalFallback = false;

// Helper to delay execution
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function connectMongoDB(): Promise<DBStatus> {
  const MONGODB_URI = process.env['MONGODB_URI'];
  if (!MONGODB_URI) {
    console.warn('[Mongoose Connection] MONGODB_URI environment variable is missing. Falling back to In-Memory store.');
    return { isConnected: false, uriConfigured: false };
  }

  if (isConnected) {
    return { isConnected: true, uriConfigured: true, isLocalFallback: usingLocalFallback };
  }

  // Prevent multiple connections
  if (mongoose.connection.readyState >= 1) {
    isConnected = true;
    return { isConnected: true, uriConfigured: true, isLocalFallback: usingLocalFallback };
  }

  const maxRetries = 3;
  let lastError: Error | null = null;

  // 1. Attempt connection to Atlas/Configured URI with retries
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`📡 [Mongoose Connection] Connecting to MongoDB (Attempt ${attempt}/${maxRetries})...`);
      
      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000, // Timeout fast for server selection
        connectTimeoutMS: 5000,         // Timeout fast for socket connection
        maxPoolSize: 10,                // Avoid opening 100 default sockets (reduces handshake overhead)
        minPoolSize: 1,
        family: 4,                      // FORCE IPv4 — fixes slow DNS resolution/timeouts on Windows & certain networks
      });

      isConnected = true;
      usingLocalFallback = false;
      console.log('💚 [Mongoose Connection] Connected successfully to MongoDB Atlas / Configured database!');
      return { isConnected: true, uriConfigured: true, isLocalFallback: false };
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ [Mongoose Connection] Attempt ${attempt} failed: ${lastError.message || lastError}`);
      if (attempt < maxRetries) {
        console.log(`⏱️ Retrying in 2 seconds...`);
        await delay(2000);
      }
    }
  }

  // 2. Fallback attempt to a local MongoDB server (if local instance is running)
  const LOCAL_MONGODB_URI = 'mongodb://127.0.0.1:27017/uniship';
  if (MONGODB_URI !== LOCAL_MONGODB_URI) {
    try {
      console.log(`🔌 [Mongoose Connection] Atlas connection failed. Attempting local MongoDB fallback (${LOCAL_MONGODB_URI})...`);
      
      // Close any broken connection attempts
      await mongoose.disconnect();

      await mongoose.connect(LOCAL_MONGODB_URI, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 2000,
        maxPoolSize: 10,
        minPoolSize: 1,
        family: 4, // Force IPv4
      });

      isConnected = true;
      usingLocalFallback = true;
      console.log('🧡 [Mongoose Connection] Connected successfully to local fallback MongoDB database!');
      return { isConnected: true, uriConfigured: true, isLocalFallback: true };
    } catch (localError) {
      const localErr = localError as Error;
      console.error('❌ [Mongoose Connection] Local MongoDB fallback also failed:', localErr.message || localErr);
    }
  }

  console.error('❌ [Mongoose Connection] All MongoDB connection attempts failed. Falling back to In-Memory store.');
  isConnected = false;
  usingLocalFallback = false;
  return { isConnected: false, uriConfigured: true, error: lastError?.message || 'Connection failed' };
}

export function isMongoEnabled(): boolean {
  return !!process.env['MONGODB_URI'] && isConnected && mongoose.connection.readyState === 1;
}

