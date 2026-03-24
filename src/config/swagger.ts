import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Kiddo Valley API',
      version: '1.0.0',
      description: 'API documentation for Kiddo Valley Supermarket POS System',
      contact: {
        name: 'Kiddo Valley Support',
        email: 'support@kiddovalley.com',
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token: Bearer &lt;token&gt;'
        },
      },
      schemas: {
        Category: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'Baby Products' },
            slug: { type: 'string', example: 'baby-products' },
            productCount: { type: 'integer', example: 24 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        Image: {
          type: 'object',
          properties: {
            imgUrl: {
              type: 'string',
              example: 'https://picsum.photos/id/20/400/300',
              description: 'Image URL'
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: { type: 'integer', example: 1 },
            barcode: { type: 'string', example: '8901234567890' },
            name: { type: 'string', example: 'Baby Diapers Large' },
            slug: { type: 'string', example: 'baby-diapers-large' },
            videoUrl: { type: 'string', nullable: true, example: 'https://youtube.com/watch?v=123' },
            images: {
              type: 'array',
              items: { $ref: '#/components/schemas/Image' },
              description: 'Product images (required)',
              example: [
                { imgUrl: 'https://picsum.photos/id/20/400/300' },
                { imgUrl: 'https://picsum.photos/id/21/400/300' }
              ]
            },
            isForceOrder: { type: 'boolean', example: true },
            forceOrderPriority: { type: 'integer', example: 1 },
            categoryId: { type: 'integer', example: 1 },
            category: { $ref: '#/components/schemas/Category' },
            buyingPrice: { type: 'number', example: 450 },
            sellingPrice: { type: 'number', example: 550 },
            hasDiscount: { type: 'boolean', example: false },
            discountPercent: { type: 'number', nullable: true, example: null },
            stockQuantity: { type: 'integer', example: 100 },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateProductDto: {
          type: 'object',
          required: ['barcode', 'name', 'categoryId', 'buyingPrice', 'sellingPrice', 'images'],
          properties: {
            barcode: { type: 'string', example: '8901234567890' },
            name: { type: 'string', example: 'Baby Diapers Large' },
            categoryId: { type: 'integer', example: 1 },
            buyingPrice: { type: 'number', example: 450 },
            sellingPrice: { type: 'number', example: 550 },
            videoUrl: { type: 'string', example: 'https://youtube.com/watch?v=123' },
            images: {
              type: 'array',
              items: { $ref: '#/components/schemas/Image' },
              description: 'Product images (at least one required)',
              example: [
                { imgUrl: 'https://picsum.photos/id/20/400/300' },
                { imgUrl: 'https://picsum.photos/id/21/400/300' }
              ]
            },
            isForceOrder: { type: 'boolean', default: false },
            forceOrderPriority: { type: 'integer', default: 0 },
            hasDiscount: { type: 'boolean', default: false },
            discountPercent: { type: 'number', nullable: true },
            stockQuantity: { type: 'integer', default: 0 },
          },
        },
        UpdateProductDto: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              example: 'Updated Product Name',
              description: 'Product name (min 2, max 100 characters)'
            },
            barcode: {
              type: 'string',
              example: '8901234567899',
              description: 'Product barcode (must be unique)'
            },
            sellingPrice: {
              type: 'number',
              example: 600,
              description: 'Selling price to customers'
            },
            buyingPrice: {
              type: 'number',
              example: 500,
              description: 'Cost price'
            },
            stockQuantity: {
              type: 'integer',
              example: 150,
              description: 'Available stock quantity'
            },
            images: {
              type: 'array',
              items: { $ref: '#/components/schemas/Image' },
              description: 'Product images (if provided, must have at least one image)',
              example: [
                { imgUrl: 'https://picsum.photos/id/22/400/300' },
                { imgUrl: 'https://picsum.photos/id/23/400/300' }
              ]
            },
            videoUrl: {
              type: 'string',
              example: 'https://youtube.com/watch?v=updated123',
              description: 'Optional video URL'
            },
            isForceOrder: {
              type: 'boolean',
              description: 'Mark as force order product'
            },
            forceOrderPriority: {
              type: 'integer',
              description: 'Priority (higher = appears first)'
            },
            hasDiscount: {
              type: 'boolean',
              description: 'Has discount?'
            },
            discountPercent: {
              type: 'number',
              description: 'Discount percentage (if hasDiscount is true)'
            },
            categoryId: {
              type: 'integer',
              description: 'Category ID'
            }
          },
        },
        CreateCategoryDto: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string', example: 'Baby Products' },
          },
        },
        UpdateCategoryDto: {
          type: 'object',
          properties: {
            name: { type: 'string', example: 'Premium Baby Products' },
          },
        },
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Operation successful' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string', example: 'Error message' },
          },
        },
        LoginRequest: {
          type: 'object',
          required: ['usernameOrEmail', 'password'],
          properties: {
            usernameOrEmail: { type: 'string', example: 'admin' },
            password: { type: 'string', example: 'admin123' },
          },
        },
        AuthResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            message: { type: 'string', example: 'Login successful' },
            accessToken: { type: 'string' },
            refreshToken: { type: 'string' },
            user: {
              type: 'object',
              properties: {
                id: { type: 'integer' },
                username: { type: 'string' },
                name: { type: 'string' },
                email: { type: 'string' },
                role: { type: 'string' },
              },
            },
          },
        },
      },
    },
    tags: [
      {
        name: 'Admin Auth',
        description: 'Admin authentication endpoints',
      },
      {
        name: 'Admin - Categories',
        description: 'Admin category management (requires Bearer token)',
      },
      {
        name: 'Admin - Products',
        description: 'Admin product management (requires Bearer token)',
      },
      {
        name: 'Public - Categories',
        description: 'Public category endpoints (no authentication)',
      },
      {
        name: 'Public - Products',
        description: 'Public product endpoints (no authentication)',
      },
      {
        name: 'System',
        description: 'System health and test endpoints',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);