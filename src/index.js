import dotenv from "dotenv";
import connect, { disconnect, prisma } from "./database/connect.js";
import { app } from "./app.js";
import redisManager from "./utils/redisClient.js";
import { performance } from "perf_hooks";

// Load environment variables
dotenv.config({
    path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
});

// Server instance
let server;

// Display system information
const displaySystemInfo = async () => {
    console.log("\n=== CLADILY SERVER INFORMATION ===");
    console.log(`🚀 Server running on port: ${process.env.PORT || 8000}`);
    console.log(`🌐 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🕒 Server started at: ${new Date().toLocaleString()}`);

    // Display database connection info
    try {
        // Use MySQL compatible queries instead of PostgreSQL
        const dbVersion = await prisma.$queryRaw`SELECT VERSION() as version`;
        const dbName = await prisma.$queryRaw`SELECT DATABASE() as database_name`;
        
        // Properly access Prisma metrics
        const metrics = await prisma.$metrics.json();
        const pool = metrics?.pools?.[0] || {};
        
        console.log("\n📊 DATABASE CONNECTION");
        console.log(`📁 Database: ${dbName[0].database_name}`);
        console.log(`🔄 MySQL Version: ${dbVersion[0].version}`);
        console.log(`🔌 Connection Pool:`);
        console.log(`   - Total Connections: ${pool?.counters?.totalConnectionRequests || 'N/A'}`);
        console.log(`   - Active: ${pool?.gauges?.activeConnections || 0}`);
        console.log(`   - Idle: ${pool?.gauges?.idleConnections || 0}`);
        console.log(`   - Max: ${pool?.gauges?.maxConnections || 'N/A'}`);
        console.log(`   - Wait Time: ${pool?.histograms?.waitTimeMicros?.p99 ? `${(pool.histograms.waitTimeMicros.p99/1000).toFixed(2)}ms (p99)` : 'N/A'}`);
    } catch (error) {
        console.log("\n📊 DATABASE CONNECTION");
        console.log(`❌ Unable to fetch detailed DB info: ${error.message}`);
    }

    // Display Redis connection info
    try {
        const redisClient = await redisManager.getClient();
        const info = await redisClient.info();
        const parsedInfo = info.split('\r\n').reduce((acc, line) => {
            const parts = line.split(':');
            if (parts.length === 2) {
                acc[parts[0]] = parts[1];
            }
            return acc;
        }, {});

        console.log("\n📊 REDIS CONNECTION");
        console.log(`🔄 Redis Version: ${parsedInfo.redis_version || "Unknown"}`);
        console.log(`🧠 Used Memory: ${parsedInfo.used_memory_human || "Unknown"}`);
        console.log(`🔌 Connected Clients: ${parsedInfo.connected_clients || "Unknown"}`);
        console.log(`📈 Total Connections Received: ${parsedInfo.total_connections_received || "Unknown"}`);
    } catch (error) {
        console.log("\n📊 REDIS CONNECTION");
        console.log(`❌ Unable to fetch detailed Redis info: ${error.message}`);
    }
    
    console.log("\n===================================\n");
};

// Connect to database and start server
const startServer = async () => {
    try {
        const startTime = performance.now();
        
        // Connect to database
        await connect();
        console.log("✅ Database connected successfully");
        
        // Connect to Redis
        await redisManager.connect();
        console.log("✅ Redis client connected successfully");
        
        const endTime = performance.now();
        const connectionTime = (endTime - startTime).toFixed(2);
        
        // Start server
        server = app.listen(process.env.PORT || 8000, async () => {
            console.log(`✅ Server is running on port ${process.env.PORT || 8000}`);
            console.log(`⚡ Services initialized in ${connectionTime}ms`);
            
            // Display system information
            await displaySystemInfo();
        });

        // Handle graceful shutdown
        setupGracefulShutdown();
    } catch (error) {
        console.error(`❌ Failed to start server: ${error.message}`);
        process.exit(1);
    }
};

// Graceful shutdown handlers
const setupGracefulShutdown = () => {
    // Handle SIGTERM signal (e.g., from Kubernetes)
    process.on('SIGTERM', async () => {
        console.log('SIGTERM received. Shutting down gracefully...');
        await gracefulShutdown();
    });

    // Handle SIGINT signal (e.g., Ctrl+C)
    process.on('SIGINT', async () => {
        console.log('SIGINT received. Shutting down gracefully...');
        await gracefulShutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
        console.error('Uncaught Exception:', error);
        await gracefulShutdown(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        await gracefulShutdown(1);
    });
};

// Graceful shutdown function
const gracefulShutdown = async (exitCode = 0) => {
    try {
        // Close server first to stop accepting new connections
        if (server) {
            await new Promise((resolve) => {
                server.close(resolve);
                console.log('✅ HTTP server closed');
            });
        }

        // Close Redis connection
        try {
            await redisManager.disconnect();
            console.log('✅ Redis connection closed');
        } catch (error) {
            console.error(`❌ Error closing Redis connection: ${error.message}`);
        }

        // Disconnect from database
        await disconnect();
        console.log('✅ Database connection closed');
        
        console.log('✅ Graceful shutdown completed');
    } catch (error) {
        console.error(`❌ Error during graceful shutdown: ${error.message}`);
        exitCode = 1;
    } finally {
        process.exit(exitCode);
    }
};

// Start the server
startServer();
