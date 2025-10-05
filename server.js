const express = require('express');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: './public' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
