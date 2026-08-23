import express from 'express';
import dotenv from 'dotenv';
import { startSendOtpConsumer } from './consumer.js';
dotenv.config({ path: ['../.env', '.env'] });

startSendOtpConsumer();
const app = express();

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'mail' });
});

app.listen(process.env.PORT , () => {
    console.log(`Mail service is running on port ${process.env.PORT}`);
});
