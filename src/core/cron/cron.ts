import cron from 'node-cron';
import { sendPendingReminders }         from '../../modules/quotes/domain/reminder.service';
import { sendInvoicePaymentReminders }  from '../../modules/billing/domain/invoiceReminder.service';
import { sendWeeklyDigests }            from '../../modules/messaging/domain/weeklyDigest.service';
import { runLifecycleEmails }           from '../../modules/messaging/domain/lifecycle.service';
import { runMaintenanceProposals }      from '../../modules/maintenance/domain/maintenance.service';
import { expireQuotes }                 from '../../modules/quotes/domain/expire.service';
import { barrerSellosAlbaran, resumenDelBarrido } from '../../modules/jobs/domain/albaranBarrido';

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

  // SCRUM-371 · Cada día a las 3:15: barrido de los SELLOS de los albaranes firmados.
  //
  // Va en el cron y no en un comando porque un verificador que solo corre cuando alguien se acuerda
  // de lanzarlo es «verde porque nadie lo ejecuta»: la misma clase de garantía muda que SCRUM-369
  // vino a cerrar. Aquí corre solo, todos los días, tenga o no alguien la pregunta en la cabeza.
  //
  // A las 3:15 porque no manda nada a nadie —solo LEE y escribe una línea de log—, así que no toca
  // horas tranquilas ni compite con los cinco de arriba, que sí envían.
  //
  // ⚠️ NO ARREGLA NADA. Si un sello no cuadra, se declara en el log con su número y su merchant y
  // ahí se queda: lo firmado no se toca ni siquiera para arreglarlo (espíritu de la regla 29).
  cron.schedule('15 3 * * *', async () => {
    try {
      const informe = await barrerSellosAlbaran();
      const resumen = resumenDelBarrido(informe);
      // Un hallazgo NO se susurra en un console.log entre otras veinte líneas; y «no se pudo mirar»
      // tampoco es una noticia neutra: es que el barrido no encontró nada que comprobar.
      if (informe.conclusion === 'hay_hallazgos') console.error('[cron] 🔴', resumen);
      else if (informe.conclusion === 'no_se_pudo_mirar') console.warn('[cron] ⚠️', resumen);
      else console.log('[cron]', resumen);
    } catch (err: any) {
      console.error('[cron] Error en barrerSellosAlbaran:', err?.message);
    }
  });

  console.log('[cron] Jobs registrados: recordatorio cotizaciones (cada hora), recordatorio facturas (diario 10:00), mantenimientos (diario 10:00), lifecycle emails (diario 8:00), digest semanal (lunes 9h), sellos de albarán (diario 3:15)');
}
