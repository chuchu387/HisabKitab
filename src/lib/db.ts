import mongoose from "mongoose";

mongoose.set("autoIndex", false);
mongoose.set("autoCreate", false);

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } | undefined;
}

global.mongooseCache ??= { conn: null, promise: null };

function withDefaultDatabase(uri: string) {
  const databaseName = process.env.MONGODB_DB_NAME ?? "HisabKitab";
  try {
    const parsed = new URL(uri);
    if ((parsed.protocol === "mongodb:" || parsed.protocol === "mongodb+srv:") && (!parsed.pathname || parsed.pathname === "/")) {
      parsed.pathname = `/${databaseName}`;
      return parsed.toString();
    }
  } catch {
    return uri;
  }
  return uri;
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }
  if (global.mongooseCache?.conn) return global.mongooseCache.conn;
  global.mongooseCache!.promise ??= mongoose.connect(withDefaultDatabase(MONGODB_URI), {
    bufferCommands: false,
    autoIndex: false,
    autoCreate: false,
    maxPoolSize: 10,
    minPoolSize: 0,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 30000
  });
  global.mongooseCache!.conn = await global.mongooseCache!.promise;
  return global.mongooseCache!.conn;
}
