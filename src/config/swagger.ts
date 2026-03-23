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
      {
        url: 'https://api.kiddovalley.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        AdminKey: {
          type: 'apiKey',
          in: 'header',
          name: 'x-admin-key',
          description: 'Admin API key for protected endpoints',
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
      },
    },
    tags: [
      {
        name: 'Public - Categories',
        description: 'Public category endpoints (no authentication)',
      },
      {
        name: 'Admin - Categories',
        description: 'Admin category management (requires x-admin-key)',
      },
      {
        name: 'Public - Products',
        description: 'Public product endpoints (no authentication)',
      },
      {
        name: 'Admin - Products',
        description: 'Admin product management (requires x-admin-key)',
      },
      {
        name: 'System',
        description: 'System health and test endpoints',
      },
    ],
  },
  apis: ['./src/routes/**/*.ts', './src/controllers/**/*.ts'], // Path to API files
};

export const swaggerSpec = swaggerJsdoc(options);