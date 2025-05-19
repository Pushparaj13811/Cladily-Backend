import { seedDepartments } from './seedDepartments.js';

/**
 * Run all seed functions in sequence
 */
async function runSeeds() {
  console.log('Starting database seeding process...');
  
  try {
    // Seed departments first
    await seedDepartments();
    
    console.log('All seeding completed successfully!');
  } catch (error) {
    console.error('Seeding process failed:', error);
    process.exit(1);
  }
}

// Run the seeds
runSeeds()
  .then(() => {
    console.log('Seeding process completed.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Unexpected error during seeding:', err);
    process.exit(1);
  }); 