// app/api/test-connection/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";

export async function GET() {
  const results: any = {
    steps: [],
    env: {
      hasMongoUri: !!process.env.MONGODB_URI,
      uriPrefix: process.env.MONGODB_URI
        ? process.env.MONGODB_URI.substring(0, 20) + "..."
        : "not set",
    },
  };

  try {
    // Step 1: Check if URI exists
    if (!process.env.MONGODB_URI) {
      results.steps.push({
        step: "Environment Variable",
        success: false,
        error: "MONGODB_URI is not set in .env.local",
      });
      return NextResponse.json(results, { status: 500 });
    }
    results.steps.push({ step: "Environment Variable", success: true });

    // Step 2: Try to resolve the hostname
    const uri = process.env.MONGODB_URI;
    const hostname = uri.split("@")[1]?.split("/")[0] || "unknown";

    results.steps.push({
      step: "Hostname Resolution",
      hostname,
      success: true,
    });

    // Step 3: Try to connect
    results.steps.push({
      step: "MongoDB Connection",
      status: "attempting",
    });

    // Disconnect if already connected
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    // Connect with promise
    await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000,
    });

    results.steps.push({
      step: "MongoDB Connection",
      success: true,
      readyState: mongoose.connection.readyState,
      dbName: mongoose.connection.name || "unknown",
      host: mongoose.connection.host || "unknown",
    });

    // Step 4: Check if we can list collections
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db
        .listCollections()
        .toArray();
      results.steps.push({
        step: "Database Access",
        success: true,
        collectionCount: collections.length,
        collections: collections.map((c) => c.name),
      });
    } else {
      results.steps.push({
        step: "Database Access",
        success: false,
        error: "Database object not available",
      });
    }

    results.success = true;
  } catch (error: any) {
    results.success = false;
    results.error = {
      name: error.name,
      message: error.message,
      code: error.code,
    };
  } finally {
    // Don't disconnect, keep alive for subsequent requests
    // await mongoose.disconnect();
  }

  return NextResponse.json(results);
}
