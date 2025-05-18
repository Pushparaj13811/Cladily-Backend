import pkg from '@prisma/client';
const { PrismaClient } = pkg;

/**
 * PrismaClient singleton instance
 * Ensures a single connection pool is used across the application
 */

// Create global variable to maintain prisma instance across hot reloads in development
const globalForPrisma = global;
globalForPrisma.prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// Export singleton instance
const prisma = globalForPrisma.prisma;

/**
 * Connect to the database with the Prisma client
 */
const connect = async () => {
  try {
    await prisma.$connect();
    console.log('Database :: Prisma :: Connection :: Successful');
    return prisma;
  } catch (error) {
    console.error(`Error :: Database :: Prisma :: Connection :: Failed :: ${error}`);
    process.exit(1);
  }
};

/**
 * Disconnect from the database
 */
export const disconnect = async () => {
  try {
    await prisma.$disconnect();
    console.log('Database :: Prisma :: Disconnected');
  } catch (error) {
    console.error(`Error :: Database :: Prisma :: Disconnect :: Failed :: ${error}`);
    process.exit(1);
  }
};

export { prisma };
export default connect;
