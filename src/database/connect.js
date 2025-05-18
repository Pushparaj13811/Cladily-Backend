import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'pretty',
});

/**
 * Connect to the database
 * @returns {Promise<void>}
 */
const connect = async () => {
  try {
    await prisma.$connect();
  } catch (error) {
    console.error(`Error connecting to database: ${error.message}`);
    throw error;
  }
};

/**
 * Disconnect from the database
 * @returns {Promise<void>}
 */
export const disconnect = async () => {
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error(`Error disconnecting from database: ${error.message}`);
    throw error;
  }
};

export default connect;
