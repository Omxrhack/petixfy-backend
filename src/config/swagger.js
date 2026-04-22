const swaggerJsdoc = require('swagger-jsdoc');

const PORT = Number(process.env.PORT) || 3000;

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Vetgo API',
      version: '1.0.0',
      description: 'Backend API for Vetgo',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/authRoutes.js', './src/routes/emergencies.routes.js'],
};

const specs = swaggerJsdoc(options);

module.exports = { specs };
