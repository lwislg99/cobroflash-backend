import nodemailer from 'nodemailer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { outboxDir } from '../lib/dirs';

export function createMailer() {
  if (config.SMTP_URL) {
    return nodemailer.createTransport(config.SMTP_URL);
  }
  return nodemailer.createTransport({
    streamTransport: true,
    newline: 'unix',
    buffer: true,
  });
}

export async function saveEml(message: any, fileName: string) {
  // @ts-ignore
  if (message?.message?.createReadStream) {
    // @ts-ignore
    const stream = message.message.createReadStream();
    const file = path.join(outboxDir, fileName);

    await new Promise<void>((resolve, reject) => {
      const ws = fs.createWriteStream(file);
      stream.pipe(ws);
      ws.on('finish', resolve);
      ws.on('error', reject);
    });

    return `/outbox/${fileName}`;
  }
  return null;
}
