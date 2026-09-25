// scripts/aviso-programado-acreditacion-invoicing-es.mjs — SCRUM-1109
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD DE SCRUM-1097 CORRIENDO SOLO, Y AVISANDO — NO SOLO ESCRIBIENDO EN UN LOG QUE NADIE ABRE.
//
// `guard-acreditacion-invoicing-es.mjs` mide si algún merchant ES real está acreditado para
// facturar con efectos fiscales. Medirlo una vez, a mano, no basta: un guard que hay que acordarse
// de lanzar no acredita nada. Este script es el envoltorio que invoca la tarea programada de
// Railway (infraestructura que decide el fundador — aquí solo van el script, el aviso y el
// registro). No reimplementa la medición: IMPORTA `medirAcreditacion` y el auto-check AST del
// guard original, para que un cambio futuro en el guard se herede aquí sin duplicar lógica.
//
// ── MISMO CONTRATO DE BANDERA QUE EL GUARD BASE, Y POR QUÉ ──────────────────────────────────
// `--staging` (`DATABASE_URL_STAGING`) / `--prod-ro` (`DATABASE_URL_PROD_RO`, rol `yaqu_lectura`,
// solo lectura verificada a nivel de Postgres — SCRUM-1097). Sin bandera no hay destino por
// defecto: apuntar a producción es una decisión que se declara, nunca un olvido. La tarea
// programada de Railway se despliega con `--prod-ro` fijo en su comando — esa es la ÚNICA vez que
// alguien elige la bandera; a partir de ahí corre sola. `--staging` existe para poder verlo en
// ROJO de verdad (A23 #8) sin tocar producción, igual que hizo SCRUM-1097.
//
// ── POR QUÉ EL AVISO ES UN EMAIL, Y POR QUÉ «SIN CONFIGURAR» NO ES SILENCIO ─────────────────
// Reutiliza `SMTP_URL`/`EMAIL_FROM` — el mismo transporte que ya usa `src/integrations/mailer.ts`
// en producción — para no crear un canal ni un secreto nuevos. Pero NO reutiliza su patrón de
// «sin `SMTP_URL`, `streamTransport` en memoria y no rompe nada»: ese fallback es correcto en
// dev, y sería exactamente el defecto que este ticket existe para cerrar si corriera aquí — un
// aviso que «se envía» sin llegar a nadie es indistinguible de un éxito hasta que hace falta de
// verdad. Aquí, sin `SMTP_URL`, sin `EMAIL_FROM` o sin destinatario
// (`AVISO_ACREDITACION_EMAIL_DESTINO`, variable NUEVA — la pega el fundador) el script se declara
// CIEGO (exit 2) antes de tocar la base: no hay pasada sin poder avisar de su resultado.
//
// ── EL «RASTRO» ES EL MISMO AVISO, NO UN FICHERO NUEVO ──────────────────────────────────────
// «Rastro de cada pasada» (fecha, host sin credencial, consulta exacta, recuento) y «que el
// resultado llegue a alguien» son la MISMA obligación resuelta con el MISMO mecanismo: cada
// pasada manda un email, limpia o no, con esos cuatro datos en el cuerpo. El histórico de esa
// bandeja de entrada ES el registro — no un log de Railway que, por la propia razón de este
// ticket, nadie abre. La misma línea sale también por stdout (Railway la guarda igual), como red
// secundaria, nunca como la única.
//
// ── LOS TRES VEREDICTOS DEL GUARD, EXTENDIDOS CON UNA CUARTA CAUSA DE CEGUERA ────────────────
// `0` limpio Y avisado · `1` HALLAZGO (se intenta avisar siempre; manda igual aunque el envío
// falle — Railway ya marca la pasada en rojo por el exit code) · `2` CIEGO, que aquí cubre CUATRO
// causas: sin bandera / configuración de aviso incompleta, host inesperado, no se pudo medir
// (igual que el guard original), O la medición fue limpia pero el email NO se entregó. Este
// último caso es deliberado: un «0» que no llegó a nadie no se puede llamar visto — es la misma
// trampa que nombra `puesto-j6.md` («un cero sin ningún caso conocido delante no se puede
// juzgar»), aplicada al aviso en vez de a la consulta.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import {
  medirAcreditacion,
  verificarSoloLecturaEstructural,
  MERCHANT_DEMO_ID,
  FLAG_INVOICING_ES,
  TIPOS_FISCALES,
} from './guard-acreditacion-invoicing-es.mjs';
import { describirBD, parseBDSegura, PROD_HOST, STAGING_HOST } from './_db-guard.mjs';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

export const CONSULTA_TEXTO =
  `merchants WHERE country='ES' AND id<>${MERCHANT_DEMO_ID} AND ` +
  `(flags.${FLAG_INVOICING_ES}=true OR EXISTS invoice.type IN (${TIPOS_FISCALES.join(',')}))`;

/** Qué variables hacen falta para poder medir Y avisar. Puro: recibe un `env` cualquiera. */
export function validarConfiguracion(env, claveDB) {
  const faltan = [];
  if (!env[claveDB]) faltan.push(claveDB);
  if (!env.SMTP_URL) faltan.push('SMTP_URL');
  if (!env.AVISO_ACREDITACION_EMAIL_DESTINO) faltan.push('AVISO_ACREDITACION_EMAIL_DESTINO');
  return { ok: faltan.length === 0, faltan };
}

/** El host de la URL de BD, comparado contra el esperado. Puro: no imprime ni toca la red. */
export function validarHost(url, hostEsperado) {
  const p = parseBDSegura(url);
  if (!p) return { ok: false, motivo: 'URL de BD ilegible' };
  if (p.host !== hostEsperado) return { ok: false, motivo: `host «${p.host}», se esperaba «${hostEsperado}»` };
  return { ok: true };
}

/**
 * Construye el aviso (asunto + cuerpo) a partir del resultado de `medirAcreditacion`. Puro:
 * mismo texto que verá el destinatario, probado sin red ni email real.
 */
export function construirAviso({ resultado, host, ahora }) {
  const cabecera = `fecha: ${ahora.toISOString()}\nhost: ${host}\nconsulta: ${CONSULTA_TEXTO}`;

  if (resultado.ciego) {
    return {
      limpio: false,
      ciego: true,
      asunto: '🔴 [YaQu · SCRUM-1097] CIEGO — no se pudo medir la acreditación INVOICING_ES',
      cuerpo: `${cabecera}\nrecuento: (sin medir)\nmotivo: ${resultado.motivo}`,
    };
  }
  if (resultado.filas.length > 0) {
    const ids = resultado.filas.map((f) => f.id).join(', ');
    return {
      limpio: false,
      ciego: false,
      asunto: `🔴 [YaQu · SCRUM-1097] HALLAZGO — ${resultado.filas.length} merchant(es) acreditado(s) sin deber estarlo`,
      cuerpo: `${cabecera}\nsuelo: ${resultado.floor} merchant(s) ES no-demo\nrecuento: ${resultado.filas.length}\nmerchant id(s): ${ids}`,
    };
  }
  return {
    limpio: true,
    ciego: false,
    asunto: `✔ [YaQu · SCRUM-1097] limpio — 0/${resultado.floor} merchant(s) ES acreditados`,
    cuerpo: `${cabecera}\nsuelo: ${resultado.floor} merchant(s) ES no-demo\nrecuento: 0`,
  };
}

/**
 * Una pasada completa: auto-check AST del guard original → medir → avisar → decidir el exit
 * code. Todo lo que toca red o disco llega INYECTADO (`prisma`, `transportador`, `ahora`,
 * `rutaGuard`), como `preview-migracion.mjs` y el propio guard de SCRUM-1097: la lógica entera
 * se prueba sin BD ni SMTP reales.
 */
// ═══════════════════════════════════════════════════════════════════════════════════
// SCRUM-1112 · TRAZA Y LÍMITES — por qué existen
//
// Medido en Railway los días 24 y 25-sep-2026: tres ejecuciones de 27 min, 15 min y
// 1 h 46 min, sin correo y CON LOS LOGS VACÍOS. Este script hace UNA consulta de solo
// lectura: debería tardar segundos.
//
// 🔴 Dos defectos que se tapaban el uno al otro:
//   ① NINGÚN timeout. `medirAcreditacion` y `sendMail` podían esperar para siempre.
//   ② TODO se imprimía al FINAL. Si colgaba antes, no salía ni una línea — así que el
//      log no decía dónde se había quedado. Una hora y tres cuartos de silencio.
//
// 🔴 Y eso derrota el propósito del guard. SCRUM-1109 exige que «un cero medido y un cero
// por ceguera no salgan iguales» — pero cubría «no pude medir» y NO cubría «me quedé
// colgado», que produce el MISMO silencio y encima cuesta horas de máquina.
//
// **Un guard colgado no avisa de nada, y encima figura como instalado.**
// ═══════════════════════════════════════════════════════════════════════════════════

/** Escribe YA, no al final. Es lo que convierte un cuelgue en un diagnóstico. */
export function traza(etapa, detalle = '') {
  process.stdout.write(`[${new Date().toISOString()}] ${etapa}${detalle ? ' · ' + detalle : ''}\n`);
}

/** Límites en segundos. Generosos para una consulta de solo lectura, ridículos frente a 1 h 46. */
export const LIMITES = { medicion: 20_000, envio: 20_000, total: 90_000 };

/**
 * Corre `promesa` con tope. Si vence, lanza un error que NOMBRA LA ETAPA — porque
 * «timeout» a secas no dice si fue la base o el correo, que es justo lo que hay que saber.
 */
export function conLimite(promesa, ms, etapa) {
  let reloj;
  const vencimiento = new Promise((_, rechazar) => {
    reloj = setTimeout(() => {
      const e = new Error(`⏱ se agotaron ${ms / 1000}s en la etapa «${etapa}»`);
      e.etapa = etapa;
      rechazar(e);
    }, ms);
  });
  return Promise.race([promesa, vencimiento]).finally(() => clearTimeout(reloj));
}

export async function ejecutarPasada({ prisma, transportador, remitente, destinatario, rutaGuard, host, ahora = () => new Date() }) {
  const auto = verificarSoloLecturaEstructural(rutaGuard);
  if (auto.prohibidos.length) {
    return {
      exitCode: 2,
      rastro: '🔴 el guard importado llama a un método de Prisma fuera de la lista blanca — '
        + `ABORTADO sin conectar (${auto.prohibidos.map((p) => `línea ${p.linea}: ${p.metodo}`).join('; ')})`,
      avisoEnviado: false,
    };
  }

  traza('① midiendo', 'conectando y consultando');
  let resultado;
  try {
    resultado = await conLimite(medirAcreditacion(prisma), LIMITES.medicion, 'medicion');
  } catch (e) {
    // 🔴 No se puede tratar como «cero»: no se ha medido nada. Sale por el camino de CIEGO.
    traza('🔴 ① FALLÓ', e.message);
    return {
      exitCode: 2,
      rastro: `🔴 CIEGO — no se pudo medir contra ${host}: ${e.message}. No se afirma nada.`,
      avisoEnviado: false,
    };
  }
  traza('① medido', `filas: ${resultado && resultado.hallazgos ? resultado.hallazgos.length : '?'}`);
  const aviso = construirAviso({ resultado, host, ahora: ahora() });

  let avisoEnviado = false;
  let errorEnvio = null;
  try {
    traza('② enviando aviso', `a ${destinatario ? 'destinatario configurado' : '(SIN DESTINATARIO)'}`);
    await conLimite(
      transportador.sendMail({ from: remitente, to: destinatario, subject: aviso.asunto, text: aviso.cuerpo }),
      LIMITES.envio, 'envio',
    );
    traza('② aviso entregado');
    avisoEnviado = true;
  } catch (e) {
    errorEnvio = e && e.message ? e.message : 'fallo desconocido al enviar';
  }

  const rastro = `${aviso.asunto} · aviso ${avisoEnviado ? 'ENTREGADO' : `NO ENTREGADO (${errorEnvio})`}`;

  if (!aviso.ciego && aviso.limpio && !avisoEnviado) {
    // Un "0" que no llegó a nadie no se puede llamar visto (ver cabecera del fichero).
    return { exitCode: 2, rastro: `${rastro} — un 0 sin aviso entregado se trata como CIEGO`, avisoEnviado };
  }
  if (aviso.ciego) return { exitCode: 2, rastro, avisoEnviado };
  if (!aviso.limpio) return { exitCode: 1, rastro, avisoEnviado }; // HALLAZGO: manda igual aunque el aviso falle
  return { exitCode: 0, rastro, avisoEnviado };
}

async function principal() {
  const args = process.argv.slice(2);
  let claveDB, hostEsperado;
  if (args.includes('--staging')) { claveDB = 'DATABASE_URL_STAGING'; hostEsperado = STAGING_HOST; }
  else if (args.includes('--prod-ro')) { claveDB = 'DATABASE_URL_PROD_RO'; hostEsperado = PROD_HOST; }
  else {
    console.error('Uso: node scripts/aviso-programado-acreditacion-invoicing-es.mjs --staging | --prod-ro');
    console.error('Sin bandera no hay destino por defecto: apuntar a producción es una decisión,');
    console.error('nunca un olvido. La tarea programada de Railway se despliega con --prod-ro fijo.');
    return 2;
  }

  const cfg = validarConfiguracion(process.env, claveDB);
  if (!cfg.ok) {
    console.log(`\n🔴 CIEGO — faltan variables: ${cfg.faltan.join(', ')}. No se mide nada y no se afirma nada.`);
    return 2;
  }

  const url = process.env[claveDB];
  const h = validarHost(url, hostEsperado);
  if (!h.ok) {
    console.log(`\n⛔ ${h.motivo} — ABORTADO. Un host inesperado no se trata como "probablemente el que toca".`);
    return 2;
  }

  // Nunca `new URL('./x.mjs', import.meta.url)` para componer una ruta: SCRUM-195/414 vigilan
  // TODO `new URL` de scripts/ (no solo el de una URL de BD), y esta misma máquina tiene un
  // ESPACIO en la ruta de usuario que `new URL(...).pathname` no decodifica (`censo-alcanzabilidad.mjs`).
  const rutaGuard = path.join(path.dirname(fileURLToPath(import.meta.url)), 'guard-acreditacion-invoicing-es.mjs');
  // 🔴 La cabecera va AQUÍ, antes de tocar nada. Si el proceso muere después, al menos
  // el log dice contra qué destino lo intentaba — que es lo que faltó los días 24 y 25.
  traza('=== SCRUM-1109 · aviso programado de acreditación INVOICING_ES ===');
  traza('destino', `[${claveDB}] → ${describirBD(url)}`);

  // Vigía general: si algo se queda colgado por debajo de los límites de etapa (un socket
  // abierto que impide salir, por ejemplo), el proceso muere igual y CON código != 0.
  const vigia = setTimeout(() => {
    traza('🔴 VIGÍA', `el proceso lleva ${LIMITES.total / 1000}s y no ha terminado — se corta`);
    process.exit(2);
  }, LIMITES.total);
  vigia.unref?.();

  const prisma = new PrismaClient({ datasourceUrl: url.trim().replace(/^['"]|['"]$/g, '') });
  const transportador = nodemailer.createTransport(process.env.SMTP_URL);

  let salida;
  try {
    salida = await ejecutarPasada({
      prisma,
      transportador,
      remitente: process.env.EMAIL_FROM || 'YaQu <no-reply@yaqu.local>',
      destinatario: process.env.AVISO_ACREDITACION_EMAIL_DESTINO,
      rutaGuard,
      host: describirBD(url),
    });
  } finally {
    await prisma.$disconnect().catch(() => {});
  }

  clearTimeout(vigia);
  console.log(salida.rastro);
  return salida.exitCode;
}

if (ejecutadoDirectamente(import.meta.url)) {
  principal().then((codigo) => process.exit(codigo));
}
