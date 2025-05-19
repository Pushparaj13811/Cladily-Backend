import { prisma } from '../database/connect.js';
import slugify from 'slugify';

/**
 * Seed the departments table with initial data
 */
async function seedDepartments() {
  console.log('Beginning Department seeding...');

  const departments = [
    {
      name: 'Menswear',
      description: 'Clothing and accessories for men'
    },
    {
      name: 'Womenswear',
      description: 'Clothing and accessories for women'
    },
    {
      name: 'Kidswear',
      description: 'Clothing and accessories for children'
    }
  ];

  try {
    console.log('Checking existing departments...');
    
    // Create departments one by one, checking for duplicates
    for (const department of departments) {
      const slug = slugify(department.name, { lower: true, strict: true });
      
      // Check if department already exists
      const existingDepartment = await prisma.department.findFirst({
        where: {
          OR: [
            { name: department.name },
            { slug }
          ]
        }
      });
      
      if (existingDepartment) {
        console.log(`Department "${department.name}" already exists. Skipping.`);
        continue;
      }
      
      // Create department
      await prisma.department.create({
        data: {
          name: department.name,
          slug,
          description: department.description
        }
      });
      
      console.log(`Created department: ${department.name}`);
    }
    
    console.log('Department seeding completed successfully!');
  } catch (error) {
    console.error('Error seeding departments:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// If running this script directly
if (process.argv[1] === import.meta.url) {
  seedDepartments()
    .then(() => {
      console.log('Seed process completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('Seed process failed:', err);
      process.exit(1);
    });
}

export { seedDepartments }; 