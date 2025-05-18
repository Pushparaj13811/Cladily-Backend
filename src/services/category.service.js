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
    const {
      name,
      slug,
      description,
      parentId,
      isActive,
      isVisible,
      metaTitle,
      metaDescription,
      metaKeywords,
      imageUrl,
      iconUrl,
      position
    } = categoryData;

    // Generate slug from name if not provided
    const categorySlug = slug || slugify(name, { lower: true, strict: true });

    // Check if slug already exists
    const existingSlug = await prisma.category.findUnique({
      where: { slug: categorySlug }
    });

    if (existingSlug) {
      throw new Error(slug ? 'Category with this slug already exists' : 'Category with this name already exists');
    }

    // Check if parent category exists
    let path = '/';
    let level = 0;

    if (parentId) {
      const parentCategory = await prisma.category.findUnique({
        where: { id: parentId }
      });

      if (!parentCategory) {
        throw new Error('Parent category not found');
      }

      // Set path and level based on parent
      path = `${parentCategory.path}${parentId}/`;
      level = parentCategory.level + 1;
    }

    // Create the category
    const category = await prisma.category.create({
      data: {
        name,
        slug: categorySlug,
        description,
        parent: parentId,
        path,
        level,
        isActive: isActive !== undefined ? isActive : true,
        isVisible: isVisible !== undefined ? isVisible : true,
        metaTitle,
        metaDescription,
        metaKeywords,
        imageUrl,
        iconUrl,
        position: position || 0
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
        { position: 'desc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            children: true,
            products: true
          }
        }
      }
    });

    // Add child and product counts
    return categories.map(category => ({
      ...category,
      childrenCount: category._count.children,
      productsCount: category._count.products,
      _count: undefined
    }));
  }

  /**
   * Get category hierarchy as a tree structure
   * @param {Object} options - Query options
   * @param {Boolean} options.includeInactive - Whether to include inactive categories
   * @param {Boolean} options.includeDeleted - Whether to include soft deleted categories
   * @returns {Array} - Hierarchical array of categories
   */
  async getCategoryHierarchy(options = {}) {
    const { includeInactive = false, includeDeleted = false } = options;

    // Get all categories first
    const allCategories = await this.getCategories({
      includeInactive,
      includeDeleted
    });

    // Create a map for quick lookups
    const categoryMap = new Map();
    allCategories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    });

    // Build the hierarchy
    const rootCategories = [];

    for (const category of allCategories) {
      const categoryWithChildren = categoryMap.get(category.id);

      if (!category.parentId) {
        // This is a root category
        rootCategories.push(categoryWithChildren);
      } else if (categoryMap.has(category.parentId)) {
        // Add as child to parent
        const parent = categoryMap.get(category.parentId);
        parent.children.push(categoryWithChildren);
      } else {
        // Parent doesn't exist or is filtered out, add as root
        rootCategories.push(categoryWithChildren);
      }
    }

    return rootCategories;
  }

  /**
   * Get only root categories (categories without parents)
   * @param {Object} options - Query options
   * @param {Boolean} options.includeInactive - Whether to include inactive categories
   * @param {Boolean} options.includeDeleted - Whether to include soft deleted categories
   * @returns {Array} - Array of root categories
   */
  async getRootCategories(options = {}) {
    const { includeInactive = false, includeDeleted = false } = options;

    // Filter conditions
    const where = {
      parentId: null
    };

    // Filter by active status
    if (!includeInactive) {
      where.isActive = true;
    }

    // Filter by deleted status
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    // Get categories
    const rootCategories = await prisma.category.findMany({
      where,
      orderBy: [
        { position: 'desc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            children: true,
            products: true
          }
        }
      }
    });

    // Add child and product counts
    return rootCategories.map(category => ({
      ...category,
      childrenCount: category._count.children,
      productsCount: category._count.products,
      _count: undefined
    }));
  }

  /**
   * Get subcategories for a specific parent category
   * @param {String} parentId - Parent category ID
   * @param {Object} options - Query options
   * @param {Boolean} options.includeInactive - Whether to include inactive categories
   * @param {Boolean} options.includeDeleted - Whether to include soft deleted categories
   * @returns {Array} - Array of subcategories
   */
  async getSubcategories(parentId, options = {}) {
    const { includeInactive = false, includeDeleted = false } = options;

    // Verify the parent exists
    const parentExists = await prisma.category.findUnique({
      where: { id: parentId }
    });

    if (!parentExists) {
      throw new Error('Parent category not found');
    }

    // Filter conditions
    const where = {
      parentId
    };

    // Filter by active status
    if (!includeInactive) {
      where.isActive = true;
    }

    // Filter by deleted status
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    // Get subcategories
    const subcategories = await prisma.category.findMany({
      where,
      orderBy: [
        { position: 'desc' },
        { name: 'asc' }
      ],
      include: {
        _count: {
          select: {
            children: true,
            products: true
          }
        }
      }
    });

    // Add child and product counts
    return subcategories.map(category => ({
      ...category,
      childrenCount: category._count.children,
      productsCount: category._count.products,
      _count: undefined
    }));
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
            { position: 'desc' },
            { name: 'asc' }
          ],
          include: {
            _count: {
              select: {
                children: true,
                products: true
              }
            }
          }
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
        } : false,
        _count: {
          select: {
            children: true,
            products: true
          }
        }
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Add counts to the main category and child categories
    const result = {
      ...category,
      childrenCount: category._count.children,
      productsCount: category._count.products,
      _count: undefined,
      children: category.children.map(child => ({
        ...child,
        childrenCount: child._count.children,
        productsCount: child._count.products,
        _count: undefined
      }))
    };

    return result;
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
            { position: 'desc' },
            { name: 'asc' }
          ],
          include: {
            _count: {
              select: {
                children: true,
                products: true
              }
            }
          }
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
        } : false,
        _count: {
          select: {
            children: true,
            products: true
          }
        }
      }
    });

    if (!category) {
      throw new Error('Category not found');
    }

    // Add counts to the main category and child categories
    const result = {
      ...category,
      childrenCount: category._count.children,
      productsCount: category._count.products,
      _count: undefined,
      children: category.children.map(child => ({
        ...child,
        childrenCount: child._count.children,
        productsCount: child._count.products,
        _count: undefined
      }))
    };

    return result;
  }

  /**
   * Update a category
   * @param {String} categoryId - The category ID
   * @param {Object} categoryData - The category data to update
   * @returns {Object} - The updated category
   */
  async updateCategory(categoryId, categoryData) {
    const {
      name,
      slug,
      description,
      parentId,
      isActive,
      isVisible,
      metaTitle,
      metaDescription,
      metaKeywords,
      imageUrl,
      iconUrl,
      position
    } = categoryData;

    // Verify the category exists
    const existingCategory = await prisma.category.findUnique({
      where: { id: categoryId }
    });

    if (!existingCategory) {
      throw new Error('Category not found');
    }

    // If name or slug is changing, check for duplicates
    let categorySlug = existingCategory.slug;

    if (slug && slug !== existingCategory.slug) {
      categorySlug = slug;

      // Check if slug already exists (excluding this category)
      const duplicateSlug = await prisma.category.findFirst({
        where: {
          slug: categorySlug,
          id: { not: categoryId }
        }
      });

      if (duplicateSlug) {
        throw new Error('Category with this slug already exists');
      }
    } else if (name && name !== existingCategory.name && !slug) {
      // Generate new slug from name
      categorySlug = slugify(name, { lower: true, strict: true });

      // Check if slug already exists (excluding this category)
      const duplicateSlug = await prisma.category.findFirst({
        where: {
          slug: categorySlug,
          id: { not: categoryId }
        }
      });

      if (duplicateSlug) {
        throw new Error('Category with this name already exists');
      }
    }

    // Check for parent ID changes and path updates
    let path = existingCategory.path;
    let level = existingCategory.level;

    if (parentId !== undefined && parentId !== existingCategory.parentId) {
      // Prevent setting parent to itself
      if (parentId === categoryId) {
        throw new Error('Category cannot be its own parent');
      }

      if (parentId === null) {
        // Moving to root level
        path = '/';
        level = 0;
      } else {
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

        // Set path and level based on parent
        path = `${parentCategory.path}${parentId}/`;
        level = parentCategory.level + 1;
      }

      // Update paths for all children recursively
      await this.updateChildrenPaths(categoryId, path, level);
    }

    // Update the category
    const updatedCategory = await prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(name && { name }),
        ...(categorySlug !== existingCategory.slug && { slug: categorySlug }),
        ...(description !== undefined && { description }),
        ...(parentId !== undefined && { parent: parentId ? { connect: { id: parentId } } : undefined, }),
        ...(path !== existingCategory.path && { slug: categorySlug }),
        ...(level !== existingCategory.level && { level }),
        ...(isActive !== undefined && { isActive }),
        ...(isVisible !== undefined && { isVisible }),
        ...(metaTitle !== undefined && { metaTitle }),
        ...(metaDescription !== undefined && { metaDescription }),
        ...(metaKeywords !== undefined && { metaKeywords }),
        ...(imageUrl !== undefined && { imageUrl }),
        ...(iconUrl !== undefined && { iconUrl }),
        ...(position !== undefined && { position })
      },
      include: {
        _count: {
          select: {
            children: true,
            products: true
          }
        }
      }
    });

    // Add counts to the result
    const result = {
      ...updatedCategory,
      childrenCount: updatedCategory._count.children,
      productsCount: updatedCategory._count.products,
      _count: undefined
    };

    return result;
  }

  /**
   * Update paths for all children of a category recursively
   * @param {String} categoryId - Parent category ID
   * @param {String} parentPath - New parent path
   * @param {Number} parentLevel - New parent level
   */
  async updateChildrenPaths(categoryId, parentPath, parentLevel) {
    // Get all immediate children
    const children = await prisma.category.findMany({
      where: { parentId: categoryId }
    });

    for (const child of children) {
      // Calculate new path and level
      const childPath = `${parentPath}${categoryId}/`;
      const childLevel = parentLevel + 1;

      // Update child
      await prisma.category.update({
        where: { id: child.id },
        data: {
          path: childPath,
          level: childLevel
        }
      });

      // Recursively update this child's children
      await this.updateChildrenPaths(child.id, childPath, childLevel);
    }
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
          isActive: false,
          isVisible: false
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