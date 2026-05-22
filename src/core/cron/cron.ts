import cron from 'node-cron';
import { sendPendingReminders } from '../../modules/quotes/domain/reminder.service';

export function startCronJobs(): void {
  // Cada hora en punto: buscar cotizaciones sin respuesta >24h y enviar recordatorio
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Ejecutando recordatorios de cotizaciones…');
    try {
      await sendPendingReminders();
    } catch (err: any) {
      console.error('[cron] Error en sendPendingReminders:', err?.message);
    }
  });

  console.log('[cron] Jobs registrados: recordatorio cotizaciones (cada hora)');
}
