import axios from 'axios';
import { config } from '../config/env';

export async function emitN8N(kind: 'paid' | 'failed' | 'expired', payload: any) {
  const map = {
    paid: config.N8N_ONPAID_URL,
    failed: config.N8N_ONFAILED_URL,
    expired: config.N8N_ONEXPIRED_URL,
  } as const;

  const url = map[kind];
  if (!url) return;

  await axios.post(url, payload, {
    headers: config.N8N_TOKEN ? { Authorization: `Bearer ${config.N8N_TOKEN}` } : undefined,
    timeout: 10_000,
  });
}
