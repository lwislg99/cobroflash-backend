import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT || 3000);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'cobroflash-backend', version: '0.1.0' });
});

app.listen(PORT, () => {
  console.log(`CobroFlash API listening on http://localhost:${PORT}`);
});
