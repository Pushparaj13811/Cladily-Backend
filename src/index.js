import dotenv from "dotenv";
import connect, { disconnect } from "./database/connect.js";
import { app } from "./app.js";

// Load environment variables
dotenv.config({
    path: process.env.NODE_ENV === "test" ? ".env.test" : ".env",
});

// Server instance
let server;

// Connect to database and start server
const startServer = async () => {
    try {
        // Connect to database
        await connect();

        // Start server
        server = app.listen(process.env.PORT || 8000, () => {
            console.log(`Server is running on port ${process.env.PORT || 8000}`);
        });

        // Handle graceful shutdown
        setupGracefulShutdown();
    } catch (error) {
        console.error(`Failed to start server: ${error.message}`);
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
                console.log('HTTP server closed');
            });
        }

        // Disconnect from database
        await disconnect();
        
        console.log('Graceful shutdown completed');
    } catch (error) {
        console.error(`Error during graceful shutdown: ${error.message}`);
        exitCode = 1;
    } finally {
        process.exit(exitCode);
    }
};

// Start the server
startServer();
