import { prisma } from '../database/connect.js';
import slugify from 'slugify';

/**
 * Service for department management
 */
export class DepartmentService {
  /**
   * Create a new department
   * @param {Object} departmentData - Department data
   * @returns {Object} Created department
   */
  async createDepartment(departmentData) {
    const { name, description, imageId } = departmentData;
    
    // Create slug from name
    const slug = slugify(name, { lower: true, strict: true });
    
    // Check if department with same name already exists
    const existingDepartment = await prisma.department.findFirst({
      where: {
        OR: [
          { name },
          { slug }
        ]
      }
    });
    
    if (existingDepartment) {
      console.log('Department with this name already exists');
      throw new Error('Department with this name already exists');
    }
    
    // Create department
    const department = await prisma.department.create({
      data: {
        name,
        slug,
        description,
        imageId
      }
    });
    
    return department;
  }
  
  /**
   * Get all departments
   * @returns {Array} Departments
   */
  async getAllDepartments() {
    return await prisma.department.findMany({
      where: {
        deletedAt: null
      },
      orderBy: {
        name: 'asc'
      }
    });
  }
  
  /**
   * Get department by ID
   * @param {String} departmentId - Department ID
   * @returns {Object} Department
   */
  async getDepartmentById(departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      include: {
        categories: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' }
        }
      }
    });
    
    if (!department) {
      throw new Error('Department not found');
    }
    
    return department;
  }
  
  /**
   * Get products by department
   * @param {String} departmentId - Department ID
   * @param {Object} options - Query options
   * @returns {Object} Products and pagination info
   */
  async getProductsByDepartment(departmentId, options = {}) {
    const {
      page = 1,
      limit = 20,
      status,
      category,
      brand,
      search,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;
    
    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });
    
    if (!department) {
      throw new Error('Department not found');
    }
    
    const skip = (page - 1) * limit;
    
    // Build where clause
    const whereClause = {
      departmentId,
      deletedAt: null
    };
    
    if (status) {
      whereClause.status = status;
    }
    
    if (category) {
      whereClause.categories = {
        some: {
          categoryId: category
        }
      };
    }
    
    if (brand) {
      whereClause.brandId = brand;
    }
    
    if (minPrice) {
      whereClause.price = {
        ...whereClause.price,
        gte: parseFloat(minPrice)
      };
    }
    
    if (maxPrice) {
      whereClause.price = {
        ...whereClause.price,
        lte: parseFloat(maxPrice)
      };
    }
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { searchKeywords: { contains: search, mode: 'insensitive' } }
      ];
    }
    
    // Get products with count for pagination
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        skip,
        take: parseInt(limit),
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          images: true,
          variants: true,
          brand: true,
          categories: {
            include: {
              category: true
            }
          }
        }
      }),
      prisma.product.count({
        where: whereClause
      })
    ]);
    
    // Map products to have the exact structure expected by the frontend
    const mappedProducts = products.map(product => {
      // Get the first image as the main image
      const mainImage = product.images.length > 0 ? product.images[0].url : null;
      
      // Map categories
      const category = product.categories.length > 0 
        ? product.categories[0].category.name
        : null;
      
      return {
        ...product,
        image: mainImage || product.featuredImageUrl,
        category,
        inStock: product.status !== 'OUT_OF_STOCK'
      };
    });
    
    return {
      products: mappedProducts,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    };
  }
  
  /**
   * Update department
   * @param {String} departmentId - Department ID
   * @param {Object} updateData - Department update data
   * @returns {Object} Updated department
   */
  async updateDepartment(departmentId, updateData) {
    const { name, description, imageId } = updateData;
    
    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });
    
    if (!department) {
      throw new Error('Department not found');
    }
    
    let updateValues = {};
    
    if (description !== undefined) {
      updateValues.description = description;
    }
    
    // If name is changing, create new slug and check for duplicates
    if (name && name !== department.name) {
      const slug = slugify(name, { lower: true, strict: true });
      
      // Check if another department with this name/slug exists
      const existingDepartment = await prisma.department.findFirst({
        where: {
          OR: [
            { name },
            { slug }
          ],
          id: { not: departmentId }
        }
      });
      
      if (existingDepartment) {
        throw new Error('Department with this name already exists');
      }
      
      updateValues.name = name;
      updateValues.slug = slug;
    }

    if (imageId) {
      updateValues.imageId = imageId;
    }
    
    // Update department
    return await prisma.department.update({
      where: { id: departmentId },
      data: updateValues
    });
  }
  
  /**
   * Delete department (soft delete)
   * @param {String} departmentId - Department ID
   * @returns {Boolean} Success status
   */
  async deleteDepartment(departmentId) {
    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId }
    });
    
    if (!department) {
      throw new Error('Department not found');
    }
    
    // Check if department has products
    const productCount = await prisma.product.count({
      where: {
        departmentId,
        deletedAt: null
      }
    });
    
    if (productCount > 0) {
      throw new Error('Cannot delete department with existing products');
    }
    
    // Soft delete department
    await prisma.department.update({
      where: { id: departmentId },
      data: {
        deletedAt: new Date()
      }
    });
    
    return true;
  }
} 