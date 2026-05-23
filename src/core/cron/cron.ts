import cron from 'node-cron';
import { sendPendingReminders }         from '../../modules/quotes/domain/reminder.service';
import { sendInvoicePaymentReminders }  from '../../modules/billing/domain/invoiceReminder.service';
import { sendWeeklyDigests }            from '../../modules/messaging/domain/weeklyDigest.service';

export function startCronJobs(): void {
  // Cada hora en punto: cotizaciones sin respuesta >24h
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Ejecutando recordatorios de cotizaciones…');
    try {
      await sendPendingReminders();
    } catch (err: any) {
      console.error('[cron] Error en sendPendingReminders:', err?.message);
    }
  });

  // Cada día a las 10:00 AM: facturas impagadas con 7 y 14 días
  cron.schedule('0 10 * * *', async () => {
    console.log('[cron] Ejecutando recordatorios de facturas impagadas…');
    try {
      await sendInvoicePaymentReminders();
    } catch (err: any) {
      console.error('[cron] Error en sendInvoicePaymentReminders:', err?.message);
    }
  });

  // Lunes a las 9:00 AM: digest semanal por email
  cron.schedule('0 9 * * 1', async () => {
    console.log('[cron] Ejecutando digest semanal…');
    try {
      await sendWeeklyDigests();
    } catch (err: any) {
      console.error('[cron] Error en sendWeeklyDigests:', err?.message);
    }
  });

  console.log('[cron] Jobs registrados: recordatorio cotizaciones (cada hora), recordatorio facturas (diario 10:00), digest semanal (lunes 9h)');
}
