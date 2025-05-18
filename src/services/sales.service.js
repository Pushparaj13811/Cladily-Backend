import { prisma } from '../database/connect.js';

/**
 * Service for sales analytics and reporting
 */
export class SalesService {
  /**
   * Get product sales analytics
   * @param {string} productId - Product ID
   * @returns {Object} Sales data for product variants
   */
  async getProductSales(productId) {
    if (!productId) {
      throw new Error('Product ID is required');
    }

    // Get order items for this product with completed orders
    const orderItems = await prisma.orderItem.findMany({
      where: {
        productId,
        order: {
          status: 'DELIVERED'
        }
      },
      include: {
        variant: true
      }
    });

    // Get all variants for this product
    const variants = await prisma.productVariant.findMany({
      where: {
        productId
      }
    });

    // Compute sales data for each variant
    const variantSalesMap = {};
    orderItems.forEach(item => {
      const variantId = item.variantId;
      if (!variantSalesMap[variantId]) {
        variantSalesMap[variantId] = {
          totalQuantitySold: 0,
          totalSalesAmount: 0
        };
      }
      variantSalesMap[variantId].totalQuantitySold += item.quantity;
      variantSalesMap[variantId].totalSalesAmount += item.totalPrice;
    });

    // Combine variant data with sales data
    const result = variants.map(variant => ({
      variantId: variant.id,
      name: variant.name,
      options: variant.options,
      inventoryQuantity: variant.inventoryQuantity,
      totalQuantitySold: variantSalesMap[variant.id]?.totalQuantitySold || 0,
      totalSalesAmount: variantSalesMap[variant.id]?.totalSalesAmount || 0
    }));

    return result;
  }

  /**
   * Get overall sales data
   * @param {Object} options - Query options (time range, filters)
   * @returns {Object} Aggregated sales data
   */
  async getSalesOverview(options = {}) {
    const { 
      startDate, 
      endDate, 
      category,
      brand
    } = options;

    // Build the where clause for orders
    const orderWhere = {
      status: 'DELIVERED'
    };

    if (startDate) {
      orderWhere.createdAt = {
        ...orderWhere.createdAt,
        gte: new Date(startDate)
      };
    }

    if (endDate) {
      orderWhere.createdAt = {
        ...orderWhere.createdAt,
        lte: new Date(endDate)
      };
    }

    // Build the where clause for products
    const productWhere = {};

    if (category) {
      productWhere.categories = {
        some: {
          categoryId: category
        }
      };
    }

    if (brand) {
      productWhere.brandId = brand;
    }

    // Get orders and their items
    const orders = await prisma.order.findMany({
      where: orderWhere,
      include: {
        items: {
          include: {
            product: {
              include: {
                categories: {
                  include: {
                    category: true
                  }
                },
                brand: true
              },
              where: productWhere
            }
          }
        }
      }
    });

    // Aggregate sales data by product
    const productSalesMap = {};
    let totalSales = 0;
    let totalItems = 0;

    orders.forEach(order => {
      order.items.forEach(item => {
        if (!item.product) return; // Skip if product doesn't match filters
        
        totalSales += item.totalPrice;
        totalItems += item.quantity;

        const productId = item.productId;
        if (!productSalesMap[productId]) {
          productSalesMap[productId] = {
            productId,
            name: item.product.name,
            totalQuantitySold: 0,
            totalSalesAmount: 0
          };
        }
        productSalesMap[productId].totalQuantitySold += item.quantity;
        productSalesMap[productId].totalSalesAmount += item.totalPrice;
      });
    });

    // Convert map to array and sort by sales amount
    const productSales = Object.values(productSalesMap)
      .sort((a, b) => b.totalSalesAmount - a.totalSalesAmount);

    return {
      totalSales,
      totalItems,
      orderCount: orders.length,
      productSales
    };
  }

  /**
   * Get sales data by time periods
   * @param {string} period - Time period (daily, weekly, monthly, yearly)
   * @param {number} limit - Number of periods to return
   * @returns {Array} Sales data by period
   */
  async getSalesByTimePeriod(period = 'monthly', limit = 12) {
    // Determine grouping format based on period
    let dateFormat;
    let dateField;
    
    switch (period) {
      case 'daily':
        dateFormat = '%Y-%m-%d';
        dateField = 'day';
        break;
      case 'weekly':
        dateFormat = '%Y-W%W';
        dateField = 'week';
        break;
      case 'monthly':
        dateFormat = '%Y-%m';
        dateField = 'month';
        break;
      case 'yearly':
        dateFormat = '%Y';
        dateField = 'year';
        break;
      default:
        dateFormat = '%Y-%m';
        dateField = 'month';
    }

    // Use Prisma's raw query capability for time-based grouping
    const salesByPeriod = await prisma.$queryRaw`
      SELECT 
        date_trunc(${dateField}, "createdAt") as period,
        SUM("total") as sales,
        COUNT(*) as orderCount
      FROM "Order"
      WHERE "status" = 'DELIVERED'
      GROUP BY period
      ORDER BY period DESC
      LIMIT ${limit}
    `;

    return salesByPeriod;
  }

  /**
   * Get sales performance by category
   * @returns {Array} Category sales data
   */
  async getSalesByCategory() {
    // Get all categories
    const categories = await prisma.category.findMany({
      where: {
        isActive: true
      }
    });

    // For each category, get sales data
    const results = await Promise.all(
      categories.map(async (category) => {
        const sales = await prisma.orderItem.findMany({
          where: {
            order: {
              status: 'DELIVERED'
            },
            product: {
              categories: {
                some: {
                  categoryId: category.id
                }
              }
            }
          }
        });

        const totalSales = sales.reduce((sum, item) => sum + item.totalPrice, 0);
        const totalItems = sales.reduce((sum, item) => sum + item.quantity, 0);

        return {
          categoryId: category.id,
          name: category.name,
          totalSales,
          totalItems,
          orderCount: sales.length
        };
      })
    );

    // Sort by total sales
    return results.sort((a, b) => b.totalSales - a.totalSales);
  }
} 