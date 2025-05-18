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
        
        // Get database stats manually for MySQL
        const connectionStats = await prisma.$queryRaw`SHOW STATUS WHERE Variable_name IN 
            ('Threads_connected', 'Connections', 'Max_used_connections', 'Threads_running', 'Max_connections')`;

        // Convert array of rows to an object
        const stats = {};
        connectionStats.forEach(row => {
            stats[row.Variable_name] = row.Value;
        });
        
        console.log("\n📊 DATABASE CONNECTION");
        console.log(`📁 Database: ${dbName[0].database_name}`);
        console.log(`🔄 MySQL Version: ${dbVersion[0].version}`);
        console.log(`🔌 Connection Pool:`);
        console.log(`   - Total Connections: ${stats.Connections || 0}`);
        console.log(`   - Active: ${stats.Threads_connected || 0}`);
        console.log(`   - Running: ${stats.Threads_running || 0}`);
        console.log(`   - Max Used: ${stats.Max_used_connections || 0}`);
        console.log(`   - Max Allowed: ${stats.Max_connections || 0}`);
        
        // Also try to get Prisma metrics if available
        try {
            const metrics = await prisma.$metrics.json();
            if (metrics && metrics.pools && metrics.pools.length > 0) {
                const pool = metrics.pools[0];
                console.log(`🔌 Prisma Connection Pool:`);
                console.log(`   - Total Requests: ${pool.counters?.totalConnectionRequests || 0}`);
                console.log(`   - Active: ${pool.gauges?.activeConnections || 0}`);
                console.log(`   - Idle: ${pool.gauges?.idleConnections || 0}`);
                console.log(`   - Max: ${pool.gauges?.maxConnections || 0}`);
            }
        } catch (metricsError) {
            // Silent fail on metrics - we already have MySQL stats
        }
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
            
            // Wait a moment for metrics to fully initialize
            setTimeout(async () => {
                // Display system information
                await displaySystemInfo();
            }, 1000);
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
