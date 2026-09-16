import cron from 'node-cron';
import { sendPendingReminders }         from '../../modules/quotes/domain/reminder.service';
import { sendInvoicePaymentReminders }  from '../../modules/billing/domain/invoiceReminder.service';
import { sendWeeklyDigests }            from '../../modules/messaging/domain/weeklyDigest.service';
import { runLifecycleEmails }           from '../../modules/messaging/domain/lifecycle.service';
import { runMaintenanceProposals }      from '../../modules/maintenance/domain/maintenance.service';
import { avisarSiEntroClienteReal }    from '../../modules/system/domain/avisoPuerta.service'; // SCRUM-390
import { expireQuotes }                 from '../../modules/quotes/domain/expire.service';
import { barrerSellosAlbaran, resumenDelBarrido } from '../../modules/jobs/domain/albaranBarrido';
// SCRUM-475 · los partes de los dos emisores que recorren merchants, y qué avisos deja sin salir un
// job que no llegó a programarse.
import { resumenDelParte, type Aviso } from '../../modules/messaging/domain/avisoConstancia';

/**
 * 🔴 SCRUM-475 · QUÉ QUEDÓ PROGRAMADO DE VERDAD.
 *
 * `startCronJobs` devolvía `void` y cerraba con una línea de PROSA ESCRITA A MANO — *«Jobs
 * registrados: recordatorio cotizaciones…, digest semanal…»*— que afirmaba seis jobs sin haber
 * medido ninguno. Si alguien borra un `cron.schedule`, esa línea sigue diciendo que está. Y lo que
 * se pierde no es un correo: es TODOS los de ese canal, para siempre, sin que nadie lo eche de
 * menos —un resumen semanal que no llega no tiene pantalla donde se vea su ausencia—.
 *
 * Ahora la lista se DERIVA: cada nombre se anota en la misma sentencia que registra su job (ver
 * `programar`), así que no se puede borrar el registro y dejar viva la afirmación.
 */
export interface ParteDeProgramacion {
  programados: string[];
  /** Los avisos de correo que NO van a salir porque su job no quedó montado. */
  avisosSinProgramar: Aviso[];
}

/**
 * Qué avisos del carril de correo se quedan sin salir, dada la lista de jobs que SÍ se montaron.
 *
 * Puro y exportado para poder probarlo EN ROJO sin arrancar ningún cron: con la lista vacía tiene
 * que nombrar los dos, y con la lista real no puede nombrar ninguno. Sin eso sería una comprobación
 * que nunca se dispara y que nadie sabe si funciona.
 */
export function avisosSinProgramar(programados: string[]): Aviso[] {
  const falta = (prefijo: string) => !programados.some((j) => j.startsWith(prefijo));
  const sin: Aviso[] = [];
  if (falta('digest semanal')) sin.push('resumen_semanal');
  if (falta('lifecycle emails')) sin.push('ciclo_de_vida');
  return sin;
}

export function startCronJobs(): ParteDeProgramacion {
  const jobs: string[] = [];
  /**
   * Anota que un job quedó montado. ⚠️ RECIBE LA TAREA YA REGISTRADA, no una función que la
   * registre: así el `cron.schedule(...)` con su callback literal sigue estando donde estaba —el
   * guard de SCRUM-371 lo busca así para comprobar que el barrido de sellos está programado— y la
   * anotación no puede sobrevivir a que alguien borre el registro, porque es su argumento.
   */
  const programar = (nombre: string, _tareaRegistrada: unknown): void => { jobs.push(nombre); };

  // Cada hora en punto: cotizaciones sin respuesta >24h + caducidad A16.2
  programar('recordatorio cotizaciones (cada hora)', cron.schedule('0 * * * *', async () => {
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
  }));

  // Cada día a las 10:00 AM: facturas impagadas con 7 y 14 días
  programar('recordatorio facturas (diario 10:00)', cron.schedule('0 10 * * *', async () => {
    console.log('[cron] Ejecutando recordatorios de facturas impagadas…');
    try {
      await sendInvoicePaymentReminders();
    } catch (err: any) {
      console.error('[cron] Error en sendInvoicePaymentReminders:', err?.message);
    }
  }));

  // Cada día a las 10:00 AM: mantenimientos vencidos → propuesta AL PRO (MANT-1;
  // tras flag por merchant, anti-spam literal de la spec dentro del servicio)
  programar('mantenimientos (diario 10:00)', cron.schedule('0 10 * * *', async () => {
    console.log('[cron] Ejecutando propuestas de mantenimiento…');
    try {
      const r = await runMaintenanceProposals();
      if (r.due) console.log(`[cron] mantenimientos: ${r.proposed}/${r.due} propuestos${r.skipped.length ? ` · skips: ${r.skipped.join('; ')}` : ''}`);
    } catch (err: any) {
      console.error('[cron] Error en runMaintenanceProposals:', err?.message);
    }

      // SCRUM-390 · LA PUERTA DEL PRIMER CLIENTE REAL. Paso APARTE y DESPUÉS: si esto fallara,
      // las propuestas de mantenimiento ya están hechas. `avisarSiEntroClienteReal` NO lanza
      // nunca —devuelve su fallo— porque un vigilante que rompe lo que vigila es peor que no
      // tenerlo. Y va aquí y no en el arranque: la puerta avisa, no frena.
      const puerta = await avisarSiEntroClienteReal();
      if (puerta.fallo) console.error('[cron] puerta cliente real:', puerta.fallo);
      else if (puerta.avisado) console.log(`[cron] puerta cliente real: AVISADO (${puerta.motivo})`);
  }));

  // Lunes a las 9:00 AM: digest semanal por email
  programar('digest semanal (lunes 9:00)', cron.schedule('0 9 * * 1', async () => {
    console.log('[cron] Ejecutando digest semanal…');
    try {
      // 🔴 SCRUM-475 · SE MIRA EL PARTE. Antes esto era `await sendWeeklyDigests();` a secas: el
      // fallo de cada merchant moría dentro del bucle y aquí no llegaba nada. El `catch` de abajo
      // solo veía el fallo que LANZA; el que se DEVUELVE —un correo sin `@`, y el emisor no lanza—
      // no dejaba absolutamente nada.
      const parte = await sendWeeklyDigests();
      const resumen = resumenDelParte(parte);
      if (resumen) console.error('[cron] 🔴 digest semanal:', resumen);
      else console.log(`[cron] digest semanal: ${parte.entregados}/${parte.intentados} entregados`);
    } catch (err: any) {
      console.error('[cron] Error en sendWeeklyDigests:', err?.message);
    }
  }));

  // Cada día a las 8:00 AM: emails del ciclo de vida (día 3/7/12/expirado/inactivo)
  programar('lifecycle emails (diario 8:00)', cron.schedule('0 8 * * *', async () => {
    console.log('[cron] Ejecutando lifecycle emails…');
    try {
      // 🔴 SCRUM-475 · ídem, y aquí era peor: dentro se marcaba `markSent` sobre correos que podían
      // no haber salido, así que el aviso no se volvía a intentar NUNCA. Ver `enviarAvisoDeCiclo`.
      const parte = await runLifecycleEmails();
      const resumen = resumenDelParte(parte);
      if (resumen) console.error('[cron] 🔴 lifecycle emails:', resumen);
      else console.log(`[cron] lifecycle emails: ${parte.entregados}/${parte.intentados} entregados`);
    } catch (err: any) {
      console.error('[cron] Error en runLifecycleEmails:', err?.message);
    }
  }));

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
  programar('sellos de albarán (diario 3:15)', cron.schedule('15 3 * * *', async () => {
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
  }));

  // SCRUM-475 · DERIVADA de lo que se montó, no escrita a mano. La línea de antes enumeraba seis
  // jobs sin haber comprobado ninguno: si alguien borraba un `cron.schedule`, seguía afirmándolo.
  console.log(`[cron] Jobs registrados (${jobs.length}): ${jobs.join(', ')}`);
  return { programados: jobs, avisosSinProgramar: avisosSinProgramar(jobs) };
}
