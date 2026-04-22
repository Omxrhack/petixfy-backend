require('dotenv').config();

const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const apiRouter = require('./routes');
const { specs } = require('./config/swagger');
const { AppError } = require('./utils/AppError');
const { globalErrorHandler } = require('./middleware/globalErrorHandler');
const { startRealtimeListeners } = require('./services/realtimeService');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
app.use('/api', apiRouter);

app.use((req, res, next) => {
  next(new AppError('Not found', 404));
});

app.use(globalErrorHandler);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Vetgo API listening on http://localhost:${PORT}`);
    startRealtimeListeners();
  });
}

module.exports = app;
