import { prisma } from '../database/connect.js';
import slugify from 'slugify';

/**
 * Category Service
 * Handles all business logic related to categories
 */
export class CategoryService {
  /**
   * Create a new category
   * @param {Object} categoryData - The category data
   * @returns {Object} - The created category
   */
  async createCategory(categoryData) {
    const { name, description, imageUrl, parentId, position, isActive } = categoryData;
    
    // Generate slug from name
    const slug = slugify(name, { lower: true, strict: true });
    
    // Check if slug already exists
    const existingCategory = await prisma.category.findUnique({
      where: { slug }
    });
    
    if (existingCategory) {
      throw new Error('Category with this name already exists');
    }
    
    // Check if parent category exists
    if (parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: parentId }
      });
      
      if (!parentCategory) {
        throw new Error('Parent category not found');
      }
    }
    
    // Create the category
    const category = await prisma.category.create({
      data: {
        name,
        slug,
        description,
        imageUrl,
        parentId,
        position: position || 0,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    return category;
  }
  
  /**
   * Get all categories
   * @param {Object} options - Query options
   * @param {Boolean} options.includeInactive - Whether to include inactive categories
   * @param {Boolean} options.onlyRootCategories - Whether to only return root categories
   * @param {Boolean} options.includeDeleted - Whether to include soft deleted categories
   * @returns {Array} - Array of categories
   */
  async getCategories(options = {}) {
    const { includeInactive = false, onlyRootCategories = false, includeDeleted = false } = options;
    
    // Filter conditions
    const where = {};
    
    // Filter by active status
    if (!includeInactive) {
      where.isActive = true;
    }
    
    // Filter by root categories (no parent)
    if (onlyRootCategories) {
      where.parentId = null;
    }
    
    // Filter by deleted status
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    
    // Get categories
    const categories = await prisma.category.findMany({
      where,
      orderBy: [
        { position: 'asc' },
        { name: 'asc' }
      ],
      include: {
        children: {
          where: {
            isActive: !includeInactive ? true : undefined,
            deletedAt: !includeDeleted ? null : undefined
          },
          orderBy: [
            { position: 'asc' },
            { name: 'asc' }
          ]
        }
      }
    });
    
    return categories;
  }
  
  /**
   * Get a category by ID
   * @param {String} categoryId - The category ID
   * @param {Boolean} includeProducts - Whether to include products in the response
   * @returns {Object} - The category
   */
  async getCategoryById(categoryId, includeProducts = false) {
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        parent: true,
        children: {
          where: {
            isActive: true,
            deletedAt: null
          },
          orderBy: [
            { position: 'asc' },
            { name: 'asc' }
          ]
        },
        products: includeProducts ? {
          include: {
            product: {
              where: {
                status: 'ACTIVE',
                deletedAt: null
              }
            }
          }
        } : false
      }
    });
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    return category;
  }
  
  /**
   * Get a category by slug
   * @param {String} slug - The category slug
   * @param {Boolean} includeProducts - Whether to include products in the response
   * @returns {Object} - The category
   */
  async getCategoryBySlug(slug, includeProducts = false) {
    const category = await prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: {
          where: {
            isActive: true,
            deletedAt: null
          },
          orderBy: [
            { position: 'asc' },
            { name: 'asc' }
          ]
        },
        products: includeProducts ? {
          include: {
            product: {
              where: {
                status: 'ACTIVE',
                deletedAt: null
              }
            }
          }
        } : false
      }
    });
    
    if (!category) {
      throw new Error('Category not found');
    }
    
    return category;
  }
  
  /**
   * Update a category
   * @param {String} categoryId - The category ID
   * @param {Object} categoryData - The category data to update
   * @returns {Object} - The updated category
   */
  async updateCategory(categoryId, categoryData) {
    const { name, description, imageUrl, parentId, position, isActive } = categoryData;
    
    // Verify the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });
    
    if (!existingCategory) {
      throw new Error('Category not found');
    }
    
    // If name is changing, generate new slug and check for duplicates
    let slug;
    if (name && name !== existingCategory.name) {
      slug = slugify(name, { lower: true, strict: true });
      
      // Check if slug already exists (excluding this category)
      const duplicateSlug = await prisma.category.findFirst({
        where: { 
          slug,
          id: { not: categoryId }
        }
      });
      
      if (duplicateSlug) {
        throw new Error('Category with this name already exists');
      }
    }
    
    // Check for parent ID changes
    if (parentId && parentId !== existingCategory.parentId) {
      // Prevent setting parent to itself
      if (parentId === categoryId) {
        throw new Error('Category cannot be its own parent');
      }
      
      // Check if parent exists
      const parentCategory = await prisma.category.findUnique({
        where: { id: parentId }
      });
      
      if (!parentCategory) {
        throw new Error('Parent category not found');
      }
      
      // Check for circular references
      if (await this.wouldCreateCycle(categoryId, parentId)) {
        throw new Error('This would create a circular reference in the category hierarchy');
      }
    }
    
    // Update the category
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(parentId !== undefined && { parentId }),
        ...(position !== undefined && { position }),
        ...(isActive !== undefined && { isActive })
      }
    });
    
    return updatedCategory;
  }
  
  /**
   * Delete a category
   * @param {String} categoryId - The category ID
   * @param {Boolean} permanently - Whether to permanently delete the category
   * @returns {Boolean} - Success status
   */
  async deleteCategory(categoryId, permanently = false) {
    // Verify the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        children: true,
        products: true
      }
    });
    
    if (!existingCategory) {
      throw new Error('Category not found');
    }
    
    // Check if category has children
    if (existingCategory.children.length > 0) {
      throw new Error('Cannot delete category with child categories');
    }
    
    // For permanent deletion, need to handle product relations first
    if (permanently) {
      if (existingCategory.products.length > 0) {
        throw new Error('Cannot permanently delete category with associated products');
      }
      
      await prisma.category.delete({
        where: { id: categoryId }
      });
    } else {
      // Soft delete
      await prisma.category.update({
        where: { id: categoryId },
        data: { 
          deletedAt: new Date(),
          isActive: false
        }
      });
    }
    
    return true;
  }
  
  /**
   * Check if setting parentId would create a cycle in the category hierarchy
   * @param {String} categoryId - The category ID
   * @param {String} newParentId - The new parent ID
   * @returns {Boolean} - Whether a cycle would be created
   */
  async wouldCreateCycle(categoryId, newParentId) {
    let currentParentId = newParentId;
    
    while (currentParentId) {
      // If we've looped back to our category, there's a cycle
      if (currentParentId === categoryId) {
        return true;
      }
      
      // Move up to the next parent
      const parent = await prisma.category.findUnique({
        where: { id: currentParentId },
        select: { parentId: true }
      });
      
      if (!parent) {
        break;
      }
      
      currentParentId = parent.parentId;
    }
    
    return false;
  }
} 