// scripts/respaldo-programado.mjs — SCRUM-1525b
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// EL VOLCADO, LANZADO POR ALGUIEN QUE SOBREVIVE A SU MUERTE, Y ENVIADO POR CORREO AL FUNDADOR.
//
// Es el comando de la tarea programada de Railway (decisión del fundador del 13-oct-2026: tarea
// diaria, y el respaldo sale por correo porque el servidor no puede escribir en su disco y el
// correo es lo único que ya está montado). Hace tres cosas, en este orden:
//
//   ① lanza `scripts/backup-dump.mjs` como proceso HIJO, sin tocarle nada;
//   ② busca el fichero que ese hijo ha escrito;
//   ③ lo manda adjunto. Si no puede, manda un correo SIN adjunto que lo dice.
//
// ── POR QUÉ ES UN ENVOLTORIO Y NO UNA FUNCIÓN AL FINAL DE `backup-dump.mjs` ──────────────────
// Medido en SCRUM-1525 (c.19223/c.19224): el volcado puede morir por MEMORIA antes de llegar a
// su techo, y esa muerte no lanza: ABORTA. No pasa por su `catch` y no escribe «backup FALLÓ».
// Un envío metido dentro del propio volcado moriría con él, justo el día que hace falta. Desde
// fuera, esa muerte es un hijo que termina mal, y se puede contar.
//
// 🔴 Lo que esto NO cubre, y no se tapa: si Railway mata el CONTENEDOR entero, o deja de lanzar la
// tarea, este proceso tampoco corre y no sale ningún correo. Por eso la pasada BUENA también
// escribe: el correo diario es el latido, y el día que falta es el aviso.
//
// ── EL ENVÍO NUNCA TUMBA EL VOLCADO ──────────────────────────────────────────────────────────
// El correo se configura y se intenta DESPUÉS de que el hijo haya terminado. Sin variables de
// correo el volcado corre igual; lo que cambia es el código de salida, para que Railway marque
// la pasada en rojo.
//
// ── LOS CÓDIGOS DE SALIDA ────────────────────────────────────────────────────────────────────
//   0  respaldo escrito Y entregado por correo
//   1  HOY NO HAY RESPALDO (el volcado terminó mal, o dijo que bien y no dejó fichero)
//   2  hay respaldo en el disco del contenedor, pero NO ha llegado a nadie (correo sin configurar,
//      envío fallido, o el fichero ya no cabe en un correo). Ese disco se borra: es casi un 1.
//
// ── EL TOPE DEL ADJUNTO ──────────────────────────────────────────────────────────────────────
// Resend documenta 40 MB por correo, contados DESPUÉS de pasar los adjuntos a base64 (leído en su
// documentación el 13-oct-2026; qué contesta al pasarse no lo dice y no se ha probado). El tope
// propio se queda en 15 MiB de fichero, que en base64 son 20 MiB: la mitad de lo de Resend, y por
// debajo de los 25 MB que suelen admitir los buzones (el del fundador no está medido). Por encima
// NO se intenta el envío con adjunto: se manda el aviso sin él. Y desde la mitad del tope el
// asunto lo va diciendo, para que no sea una sorpresa.
//
// Env (las lee el código; aquí no va ningún valor):
//   las de `backup-dump.mjs`   las hereda el hijo tal cual
//   RESEND_API_KEY o SMTP_URL  el canal. Resend primero: SMTP se colgó desde Railway (SCRUM-1114)
//   EMAIL_FROM                 el remitente de la casa
//   BACKUP_EMAIL_DESTINO       a quién llega. Variable NUEVA: la pega el fundador
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { redactarSecretos } from './_db-guard.mjs';
import { ejecutadoDirectamente } from './_puerta-de-entrada.mjs';

export const TOPE_ADJUNTO_BYTES = 15 * 1024 * 1024;
/** Desde esta fracción del tope el asunto avisa de que el fichero se acerca. */
export const FRACCION_DE_AVISO = 0.5;
/** Lo último que dijo el volcado, para el correo. Lo demás ya está en el log de Railway. */
export const COLA_MAX = 2000;
// Un adjunto de megas tarda más que un aviso de texto; el vigía cubre un socket que no cierra.
export const LIMITES = { envioConAdjunto: 120_000, envioDeTexto: 20_000, vigiaTrasVolcado: 300_000 };

export const SALIDA = Object.freeze({ ENTREGADO: 0, SIN_RESPALDO: 1, NO_ENTREGADO: 2 });

/** Qué falta para poder mandar el correo. Puro. No decide si se vuelca: eso corre siempre. */
export function validarCorreo(env) {
  const faltan = [];
  if (!env.RESEND_API_KEY && !env.SMTP_URL) faltan.push('SMTP_URL o RESEND_API_KEY');
  if (!env.BACKUP_EMAIL_DESTINO) faltan.push('BACKUP_EMAIL_DESTINO');
  return { ok: faltan.length === 0, faltan };
}

/** La misma carpeta que usa `backup-dump.mjs`; lo ata un test leyendo su fuente. */
export function carpetaDeRespaldos(env = process.env, cwd = process.cwd()) {
  return env.BACKUP_DIR || path.join(cwd, 'backups');
}

/** Foto de los `.enc` de la carpeta: nombre → tamaño y fecha de modificación. */
export function fotoDeLaCarpeta(dir) {
  const foto = new Map();
  let nombres;
  try { nombres = fs.readdirSync(dir); } catch { return foto; }
  for (const n of nombres.filter((x) => x.endsWith('.enc'))) {
    const s = fs.statSync(path.join(dir, n));
    foto.set(n, { bytes: s.size, mtimeMs: s.mtimeMs });
  }
  return foto;
}

/**
 * El fichero que el volcado ha escrito: el que es NUEVO o ha CAMBIADO respecto a la foto de antes.
 * No vale «el más reciente»: el nombre sólo lleva la fecha, y un fichero de ayer que siguiera ahí
 * saldría enviado como si fuera el de hoy.
 */
export function respaldoEscrito(dir, antes) {
  const cambiados = [...fotoDeLaCarpeta(dir)]
    .filter(([n, d]) => {
      const a = antes.get(n);
      return !a || a.bytes !== d.bytes || a.mtimeMs !== d.mtimeMs;
    })
    .sort((x, y) => y[1].mtimeMs - x[1].mtimeMs);
  if (!cambiados.length) return null;
  const [nombre, d] = cambiados[0];
  return { ruta: path.join(dir, nombre), nombre, bytes: d.bytes };
}

/**
 * Lanza el volcado como hijo y espera. Lo que escribe sale tal cual por la consola de este proceso
 * (Railway lo guarda) y además se conserva la cola. NO lanza nunca: una muerte es un resultado.
 * La cola sola no basta: al morir por memoria, lo último que escribe node son ~40 líneas de pila
 * nativa, y la línea que dice POR QUÉ ha muerto («FATAL ERROR…») queda fuera. Se guarda aparte.
 * En Linux un aborto por memoria llega como señal (`SIGABRT`) y código `null`; en Windows, como
 * código 134. Las dos formas son «terminó mal».
 */
export function lanzarVolcado(rutaGuion, { argsDeNode = [], env = process.env } = {}) {
  return new Promise((resolver) => {
    let cola = '';
    let fatal = '';
    let ventana = '';
    const guardar = (flujo) => (trozo) => {
      flujo.write(trozo);
      const texto = trozo.toString();
      cola = (cola + texto).slice(-COLA_MAX);
      if (!fatal) {
        // La línea puede llegar partida entre dos trozos: se busca sobre lo último visto.
        ventana = (ventana + texto).slice(-(COLA_MAX + texto.length));
        const m = ventana.match(/^.*FATAL ERROR.*$/m);
        if (m) fatal = m[0].trim();
      }
    };
    const conFatal = () => (fatal && !cola.includes(fatal) ? [fatal, '[…]', cola].join('\n') : cola);
    let hijo;
    try {
      hijo = spawn(process.execPath, [...argsDeNode, rutaGuion], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      resolver({ codigo: null, senal: null, cola: `no se pudo lanzar: ${e?.message || e}` });
      return;
    }
    hijo.stdout.on('data', guardar(process.stdout));
    hijo.stderr.on('data', guardar(process.stderr));
    hijo.on('error', (e) => resolver({ codigo: null, senal: null, cola: `no se pudo lanzar: ${e?.message || e}` }));
    hijo.on('close', (codigo, senal) => resolver({ codigo, senal, cola: conFatal() }));
  });
}

const enMB = (bytes) => (bytes / (1024 * 1024)).toFixed(2);
const comoTermino = (v) => (v.senal ? `señal ${v.senal}` : `código ${v.codigo}`);

/**
 * El correo de la pasada (asunto, cuerpo y si lleva adjunto). Puro: es el texto que recibe el
 * fundador, probado sin red. `caso` es uno de:
 *   ENTREGABLE · NO_CABE · SIN_RESPALDO · SIN_FICHERO
 */
export function construirCorreo({ volcado, respaldo, sha256 = null, ahora }) {
  const cabecera = `fecha: ${ahora.toISOString()}`;
  const cola = redactarSecretos(String(volcado.cola || '').trim()) || '(no escribió nada)';

  if (volcado.codigo !== 0) {
    return {
      caso: 'SIN_RESPALDO',
      adjuntar: false,
      asunto: `🔴 [YaQu · respaldo] HOY NO HAY RESPALDO — el volcado terminó con ${comoTermino(volcado)}`,
      cuerpo: `${cabecera}\nEl volcado no ha terminado bien y no hay fichero de hoy.\n`
        + `cómo terminó: ${comoTermino(volcado)}\n`
        + 'Un 134 o un SIGABRT es el proceso muerto por falta de memoria: el volcado ya no cabe en '
        + 'la memoria que tiene la tarea.\n\nlo último que escribió:\n' + cola,
    };
  }
  if (!respaldo) {
    return {
      caso: 'SIN_FICHERO',
      adjuntar: false,
      asunto: '🔴 [YaQu · respaldo] HOY NO HAY RESPALDO — el volcado dijo que bien y no dejó fichero',
      cuerpo: `${cabecera}\nEl volcado terminó con código 0, pero en su carpeta no hay ningún fichero `
        + 'nuevo ni cambiado. No se manda uno viejo en su lugar.\n\nlo último que escribió:\n' + cola,
    };
  }

  const pct = (100 * respaldo.bytes) / TOPE_ADJUNTO_BYTES;
  const medida = `fichero: ${respaldo.nombre}\ntamaño: ${respaldo.bytes} B (${enMB(respaldo.bytes)} MB)\n`
    + `tope del adjunto: ${TOPE_ADJUNTO_BYTES} B (${enMB(TOPE_ADJUNTO_BYTES)} MB) · ocupado: ${pct.toFixed(1)} %`;

  if (respaldo.bytes > TOPE_ADJUNTO_BYTES) {
    return {
      caso: 'NO_CABE',
      adjuntar: false,
      asunto: `🔴 [YaQu · respaldo] HECHO PERO NO ENVIADO — pesa ${enMB(respaldo.bytes)} MB y ya no cabe en un correo`,
      cuerpo: `${cabecera}\n${medida}\n\nEl respaldo de hoy EXISTE, pero sólo en el disco de la tarea, `
        + 'que se borra. No va adjunto porque pasa del tope. Hay que decidir otro destino: mientras '
        + 'tanto no hay copia fuera de Railway.',
    };
  }
  const cerca = respaldo.bytes >= TOPE_ADJUNTO_BYTES * FRACCION_DE_AVISO;
  return {
    caso: 'ENTREGABLE',
    adjuntar: true,
    asunto: `${cerca ? '⚠️' : '✔'} [YaQu · respaldo] ${respaldo.nombre} · ${enMB(respaldo.bytes)} MB · `
      + `${pct.toFixed(1)} % del tope${cerca ? ' — pronto no cabrá en un correo' : ''}`,
    cuerpo: `${cabecera}\n${medida}\nsha256: ${sha256}\n\n`
      + 'El adjunto va cifrado: sin BACKUP_ENCRYPTION_KEY no se puede restaurar. '
      + 'Cómo se restaura: docs/RUNBOOKS.md, §R14.',
  };
}

function conLimite(promesa, ms, etapa) {
  let reloj;
  const vencimiento = new Promise((_, rechazar) => {
    reloj = setTimeout(() => rechazar(new Error(`se agotaron ${ms / 1000}s en la etapa «${etapa}»`)), ms);
  });
  return Promise.race([promesa, vencimiento]).finally(() => clearTimeout(reloj));
}

/**
 * Una pasada entera. Todo lo que toca procesos, disco o red llega INYECTADO.
 * `transporte()` se llama DESPUÉS del volcado y devuelve `{ transportador, faltan }`:
 * `transportador` es `null` si el correo no está configurado, y `faltan` dice entonces qué falta.
 */
export async function ejecutarPasada({
  volcar, foto, buscar, leer, transporte, remitente, destinatario,
  ahora = () => new Date(), limites = LIMITES, traza = () => {},
}) {
  const antes = foto();
  traza('① volcando');
  const volcado = await volcar();
  traza('① volcado terminado', comoTermino(volcado));
  const { transportador, faltan = [] } = await transporte();
  const respaldo = volcado.codigo === 0 ? buscar(antes) : null;

  let contenido = null;
  let sha256 = null;
  if (respaldo && respaldo.bytes <= TOPE_ADJUNTO_BYTES) {
    contenido = leer(respaldo.ruta);
    sha256 = crypto.createHash('sha256').update(contenido).digest('hex');
  }
  const correo = construirCorreo({ volcado, respaldo, sha256, ahora: ahora() });
  const sinRespaldo = correo.caso === 'SIN_RESPALDO' || correo.caso === 'SIN_FICHERO';

  if (!transportador) {
    return {
      exitCode: sinRespaldo ? SALIDA.SIN_RESPALDO : SALIDA.NO_ENTREGADO,
      caso: correo.caso,
      entregado: false,
      rastro: `${correo.asunto} · 🔴 CORREO SIN CONFIGURAR (faltan: ${faltan.join(', ')}): esto no le ha llegado a nadie`,
    };
  }

  const enviar = (asunto, cuerpo, adjuntos, ms, etapa) => conLimite(
    transportador.sendMail({ from: remitente, to: destinatario, subject: asunto, text: cuerpo, ...(adjuntos ? { attachments: adjuntos } : {}) }),
    ms, etapa,
  );

  if (correo.adjuntar) {
    try {
      traza('② enviando el respaldo', `${respaldo.bytes} B`);
      await enviar(correo.asunto, correo.cuerpo, [{ filename: respaldo.nombre, content: contenido }], limites.envioConAdjunto, 'envío con adjunto');
      return { exitCode: SALIDA.ENTREGADO, caso: correo.caso, entregado: true, rastro: `${correo.asunto} · correo ENTREGADO al proveedor` };
    } catch (e) {
      // El adjunto no ha salido. Un correo de texto pesa nada: si lo que falló fue el tamaño o el
      // adjunto, éste sí pasa, y es la diferencia entre «no llegó» y «no llegó y nadie lo sabe».
      const motivo = redactarSecretos(e?.message || String(e));
      traza('🔴 ② el envío con adjunto FALLÓ', motivo);
      const asunto = '🔴 [YaQu · respaldo] HECHO PERO NO ENVIADO — el correo con el adjunto falló';
      const cuerpo = `fecha: ${ahora().toISOString()}\nfichero: ${respaldo.nombre}\ntamaño: ${respaldo.bytes} B\n`
        + `motivo: ${motivo}\n\nEl respaldo de hoy EXISTE, pero sólo en el disco de la tarea, que se borra.`;
      let avisado = false;
      let motivoAviso = '';
      try {
        await enviar(asunto, cuerpo, null, limites.envioDeTexto, 'aviso sin adjunto');
        avisado = true;
      } catch (e2) { motivoAviso = redactarSecretos(e2?.message || String(e2)); }
      return {
        exitCode: SALIDA.NO_ENTREGADO,
        caso: 'NO_LLEGO',
        entregado: false,
        rastro: `${asunto} (${motivo}) · aviso sin adjunto ${avisado ? 'ENTREGADO' : `NO ENTREGADO (${motivoAviso}): esto no le ha llegado a nadie`}`,
      };
    }
  }

  // Sin adjunto: no hay respaldo, o lo hay y no cabe. El correo es el aviso.
  let avisado = false;
  let motivoAviso = '';
  try {
    traza('② avisando', correo.caso);
    await enviar(correo.asunto, correo.cuerpo, null, limites.envioDeTexto, 'aviso sin adjunto');
    avisado = true;
  } catch (e) { motivoAviso = redactarSecretos(e?.message || String(e)); }
  return {
    exitCode: sinRespaldo ? SALIDA.SIN_RESPALDO : SALIDA.NO_ENTREGADO,
    caso: correo.caso,
    entregado: false,
    rastro: `${correo.asunto} · aviso ${avisado ? 'ENTREGADO' : `NO ENTREGADO (${motivoAviso}): esto no le ha llegado a nadie`}`,
  };
}

function trazaDeConsola(etapa, detalle = '') {
  process.stdout.write(`[${new Date().toISOString()}] ${etapa}${detalle ? ' · ' + detalle : ''}\n`);
}

/**
 * El transportador, construido DESPUÉS del volcado y sin poder tumbar nada: si no se puede
 * construir, devuelve por qué. Reusa el de SCRUM-1114 (Resend por HTTPS) y nodemailer para SMTP.
 */
export async function crearTransportador(env) {
  const cfg = validarCorreo(env);
  if (!cfg.ok) return { transportador: null, faltan: cfg.faltan };
  try {
    if (env.RESEND_API_KEY) {
      const { crearTransportadorResend } = await import('./aviso-programado-acreditacion-invoicing-es.mjs');
      return { transportador: crearTransportadorResend(env.RESEND_API_KEY), faltan: [], canal: 'Resend (HTTPS)' };
    }
    const { default: nodemailer } = await import('nodemailer');
    return { transportador: nodemailer.createTransport(env.SMTP_URL), faltan: [], canal: 'SMTP' };
  } catch (e) {
    return { transportador: null, faltan: [`el transportador no se pudo construir: ${redactarSecretos(e?.message || String(e))}`] };
  }
}

async function principal() {
  const dir = carpetaDeRespaldos();
  const rutaVolcado = path.join(path.dirname(fileURLToPath(import.meta.url)), 'backup-dump.mjs');
  trazaDeConsola('=== SCRUM-1525b · respaldo programado ===');

  const salida = await ejecutarPasada({
    volcar: async () => {
      const v = await lanzarVolcado(rutaVolcado);
      // El vigía arranca cuando el volcado YA ha terminado: nunca corta un volcado en marcha.
      const vigia = setTimeout(() => {
        trazaDeConsola('🔴 VIGÍA', `el envío lleva ${LIMITES.vigiaTrasVolcado / 1000}s sin terminar — se corta`);
        process.exit(v.codigo === 0 ? SALIDA.NO_ENTREGADO : SALIDA.SIN_RESPALDO);
      }, LIMITES.vigiaTrasVolcado);
      vigia.unref?.();
      return v;
    },
    foto: () => fotoDeLaCarpeta(dir),
    buscar: (antes) => respaldoEscrito(dir, antes),
    leer: (ruta) => fs.readFileSync(ruta),
    transporte: async () => {
      const listo = await crearTransportador(process.env);
      trazaDeConsola('canal del correo', listo.transportador ? listo.canal : `SIN CONFIGURAR (${listo.faltan.join(', ')})`);
      return listo;
    },
    remitente: process.env.EMAIL_FROM || 'YaQu <no-reply@yaqu.local>',
    destinatario: process.env.BACKUP_EMAIL_DESTINO,
    traza: trazaDeConsola,
  });
  console.log(salida.rastro);
  return salida.exitCode;
}

if (ejecutadoDirectamente(import.meta.url)) {
  principal().then((codigo) => process.exit(codigo));
}
