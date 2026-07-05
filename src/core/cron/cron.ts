import cron from 'node-cron';
import { sendPendingReminders }         from '../../modules/quotes/domain/reminder.service';
import { sendInvoicePaymentReminders }  from '../../modules/billing/domain/invoiceReminder.service';
import { sendWeeklyDigests }            from '../../modules/messaging/domain/weeklyDigest.service';
import { runLifecycleEmails }           from '../../modules/messaging/domain/lifecycle.service';
import { runMaintenanceProposals }      from '../../modules/maintenance/domain/maintenance.service';
import { expireQuotes }                 from '../../modules/quotes/domain/expire.service';

export function startCronJobs(): void {
  // Cada hora en punto: cotizaciones sin respuesta >24h + caducidad A16.2
  cron.schedule('0 * * * *', async () => {
    console.log('[cron] Ejecutando recordatorios de cotizaciones…');
    try {
      await expireQuotes(); // A16.2: sent+validUntil pasado → expired (antes de recordar)
    } catch (err: any) {
      console.error('[cron] Error en expireQuotes:', err?.message);
    }
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

  // Cada día a las 10:00 AM: mantenimientos vencidos → propuesta AL PRO (MANT-1;
  // tras flag por merchant, anti-spam literal de la spec dentro del servicio)
  cron.schedule('0 10 * * *', async () => {
    console.log('[cron] Ejecutando propuestas de mantenimiento…');
    try {
      const r = await runMaintenanceProposals();
      if (r.due) console.log(`[cron] mantenimientos: ${r.proposed}/${r.due} propuestos${r.skipped.length ? ` · skips: ${r.skipped.join('; ')}` : ''}`);
    } catch (err: any) {
      console.error('[cron] Error en runMaintenanceProposals:', err?.message);
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

  // Cada día a las 8:00 AM: emails del ciclo de vida (día 3/7/12/expirado/inactivo)
  cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Ejecutando lifecycle emails…');
    try {
      await runLifecycleEmails();
    } catch (err: any) {
      console.error('[cron] Error en runLifecycleEmails:', err?.message);
    }
  });

  console.log('[cron] Jobs registrados: recordatorio cotizaciones (cada hora), recordatorio facturas (diario 10:00), mantenimientos (diario 10:00), lifecycle emails (diario 8:00), digest semanal (lunes 9h)');
}
