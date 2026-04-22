require('dotenv').config();

const express = require('express');
const cors = require('cors');
const apiRouter = require('./routes');

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Vetgo API listening on http://localhost:${PORT}`);
  });
}

module.exports = app;
