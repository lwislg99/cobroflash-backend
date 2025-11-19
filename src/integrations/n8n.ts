// src/integrations/n8n.ts
import axios from 'axios';
import { config } from '../core/config/env';

export async function emitToN8n(
  kind: 'paid' | 'failed' | 'expired',
  payload: any,
) {
  const map = {
    paid: config.N8N_ONPAID_URL,
    failed: config.N8N_ONFAILED_URL,
    expired: config.N8N_ONEXPIRED_URL,
  } as const;

  const url = map[kind];
  if (!url) return;

  try {
    await axios.post(url, payload, {
      headers: config.N8N_TOKEN
        ? { Authorization: `Bearer ${config.N8N_TOKEN}` }
        : undefined,
      timeout: 10_000,
    });
  } catch (e: any) {
    console.error(`[n8n emit ${kind}]`, e?.message || e);
  }
}
