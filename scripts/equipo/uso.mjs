// scripts/equipo/uso.mjs — SCRUM-899d · el aviso de uso: cuánto queda de la ventana de 5 h de la cuenta
//
//   node uso.mjs escribir [--fichero F]                               ← lo ejecuta el statusLine de Claude Code
//   node uso.mjs leer [--fichero F] [--max-edad-min 10] [--umbral 85] ← lo ejecuta el orquestador
//
// POR QUÉ: la tanda del 17-sep-2026 murió entera a las ~20:30 CEST por el límite de uso de la cuenta, y
// ningún jsonl lleva un aviso previo. El porcentaje SÓLO se ve en el JSON que Claude Code le pasa por stdin
// al statusLine (`rate_limits.five_hour.used_percentage`, `resets_at` en segundos Unix; leído en el binario
// de 2.1.276). Este script lo deja en `%LOCALAPPDATA%\yaqu-equipo\uso.json` para que otro proceso lo lea.
//
// LA CONDICIÓN QUE NO SE NEGOCIA: `leer` sólo contesta VERDE (salida 0) con un dato FRESCO y válido.
// Fichero que no existe, ilegible, sin dato, viejo, con la hora en el futuro o de una ventana que ya se
// reinició → NO_PUDE_MIRAR (salida 2). Nunca verde.
//
// «FRESCO» ES UNA LECTURA NUEVA, NO UN REPINTADO. Claude Code vuelve a ejecutar el statusLine también por
// temporizador (al caducar la caché de prompt o al llegar `resets_at`) SIN haber hablado con la API: el
// porcentaje que pasa entonces es el de la última respuesta, con la hora de ahora. Si se fechara por la
// hora de ejecución, un dato de hace una hora saldría como de hace un segundo. Por eso `leido_en` sólo se
// renueva cuando `cost.total_api_duration_ms` de esa sesión ha CAMBIADO: hubo una llamada a la API nueva.
//
// Sin dependencias ni imports del repo: el fichero se copia tal cual fuera del árbol.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORMATO = 1;
export const UMBRAL_POR_DEFECTO = 85;
export const EDAD_MAXIMA_MIN = 10;
/** Hora del dato por delante del reloj que se tolera antes de desconfiar (misma máquina, mismo reloj). */
export const FUTURO_TOLERADO_MS = 2 * 60 * 1000;
const MAX_SESIONES = 20;

export const SALIDA = { VERDE: 0, AVISO: 1, NO_PUDE_MIRAR: 2 };

export function ficheroPorDefecto(env = process.env) {
  return env.LOCALAPPDATA ? path.join(env.LOCALAPPDATA, 'yaqu-equipo', 'uso.json') : null;
}

const numero = (v) => typeof v === 'number' && Number.isFinite(v);

/** La ventana de `rate_limits` si trae los dos números; si no, null. */
function ventana(v) {
  return v && numero(v.used_percentage) && numero(v.resets_at)
    ? { used_percentage: v.used_percentage, resets_at: v.resets_at }
    : null;
}

function base() {
  return { formato: FORMATO, ultima_llamada: null, vigente: null, sesiones: {} };
}

/** Parte pura de `escribir`: el registro nuevo a partir del anterior y del JSON del statusLine. */
export function registrar(previo, entrada, ahoraMs) {
  const reg = previo && previo.formato === FORMATO && typeof previo.sesiones === 'object' && previo.sesiones !== null
    ? { ...previo, sesiones: { ...previo.sesiones } }
    : base();
  const en = new Date(ahoraMs).toISOString();
  const sesion = typeof entrada?.session_id === 'string' && entrada.session_id ? entrada.session_id : null;
  const apiMs = entrada?.cost?.total_api_duration_ms;
  const cinco = ventana(entrada?.rate_limits?.five_hour);

  reg.ultima_llamada = {
    en,
    sesion,
    version: typeof entrada?.version === 'string' ? entrada.version : null,
    trae_rate_limits: cinco !== null,
    api_ms: numero(apiMs) ? apiMs : null,
  };

  if (cinco && sesion && numero(apiMs) && apiMs > 0) {
    const visto = reg.sesiones[sesion];
    if (!visto || visto.api_ms !== apiMs) {
      reg.sesiones[sesion] = { api_ms: apiMs, leido_en: en };
      reg.vigente = { sesion, leido_en: en, five_hour: cinco, seven_day: ventana(entrada.rate_limits.seven_day) };
    }
  }

  const ids = Object.keys(reg.sesiones);
  if (ids.length > MAX_SESIONES) {
    ids.sort((a, b) => String(reg.sesiones[b].leido_en).localeCompare(String(reg.sesiones[a].leido_en)));
    for (const id of ids.slice(MAX_SESIONES)) delete reg.sesiones[id];
  }
  return reg;
}

/** Lo que se pinta en la barra de estado. */
export function lineaDeEstado(entrada) {
  const cinco = ventana(entrada?.rate_limits?.five_hour);
  if (!cinco) return 'uso 5h: sin dato';
  const d = new Date(cinco.resets_at * 1000);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `uso 5h ${Math.round(cinco.used_percentage)}% · reinicia ${hh}:${mm}`;
}

const noPude = (motivo, extra = {}) => ({ veredicto: 'NO_PUDE_MIRAR', motivo, ...extra });

/** Parte pura de `leer`. `texto` es el contenido del fichero, o null si no se pudo abrir. */
export function juzgar(texto, ahoraMs, { maxEdadMin = EDAD_MAXIMA_MIN, umbral = UMBRAL_POR_DEFECTO } = {}) {
  if (!numero(maxEdadMin) || maxEdadMin <= 0 || !numero(umbral)) return noPude('parámetros inválidos');
  if (texto === null) return noPude('el fichero no existe o no se pudo abrir');
  let reg;
  try { reg = JSON.parse(texto); } catch { return noPude('ilegible: no es JSON'); }
  if (!reg || typeof reg !== 'object' || reg.formato !== FORMATO) return noPude('ilegible: formato desconocido');

  const v = reg.vigente;
  if (!v) {
    const u = reg.ultima_llamada;
    return u && u.trae_rate_limits === false
      ? noPude(`el statusLine corre pero Claude Code no le pasa rate_limits (última ejecución ${u.en}, versión ${u.version})`)
      : noPude('sin lectura vigente');
  }
  const leido = Date.parse(v.leido_en);
  const cinco = ventana(v.five_hour);
  if (!numero(leido) || !cinco) return noPude('ilegible: lectura vigente incompleta');

  const edadMs = ahoraMs - leido;
  const datos = { usado: cinco.used_percentage, reinicia: new Date(cinco.resets_at * 1000).toISOString(),
    leido_en: v.leido_en, edad_min: Math.round(edadMs / 6000) / 10 };
  if (edadMs < -FUTURO_TOLERADO_MS) return noPude('la lectura tiene la hora en el futuro', datos);
  if (edadMs > maxEdadMin * 60 * 1000) return noPude(`lectura vieja: más de ${maxEdadMin} min`, datos);
  if (cinco.resets_at * 1000 <= ahoraMs) return noPude('la ventana de 5 h ya se reinició: el dato es de la anterior', datos);
  if (cinco.used_percentage >= umbral) return { veredicto: 'AVISO', motivo: `uso ${cinco.used_percentage}% ≥ ${umbral}%`, ...datos };
  return { veredicto: 'VERDE', motivo: `uso ${cinco.used_percentage}% < ${umbral}%`, ...datos };
}

function leerTexto(fichero) {
  try { return fs.readFileSync(fichero, 'utf8'); } catch { return null; }
}

function escribirAtomico(fichero, reg) {
  fs.mkdirSync(path.dirname(fichero), { recursive: true });
  const tmp = `${fichero}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(reg, null, 2) + '\n');
    fs.renameSync(tmp, fichero);
  } finally {
    try { fs.unlinkSync(tmp); } catch { /* ya renombrado */ }
  }
}

function leerStdin(msMax = 3000) {
  return new Promise((resolve) => {
    let texto = '';
    const fin = () => { clearTimeout(t); resolve(texto); };
    const t = setTimeout(fin, msMax);
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => { texto += c; });
    process.stdin.on('end', fin);
    process.stdin.on('error', fin);
  });
}

function argumento(nombre) {
  const i = process.argv.indexOf(nombre);
  return i > 0 ? process.argv[i + 1] : undefined;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const orden = process.argv[2];
  const fichero = argumento('--fichero') ?? ficheroPorDefecto();

  if (orden === 'escribir') {
    // El statusLine nunca debe romper la barra: pase lo que pase, pinta una línea y sale con 0.
    let entrada = null;
    try { entrada = JSON.parse(await leerStdin()); } catch { /* entrada ilegible: se pinta «sin dato» */ }
    try {
      if (fichero) {
        let previo = null;
        try { previo = JSON.parse(leerTexto(fichero)); } catch { /* sin previo */ }
        escribirAtomico(fichero, registrar(previo, entrada, Date.now()));
      }
    } catch { /* no se pudo escribir: `leer` lo verá viejo o ausente, que es NO_PUDE_MIRAR */ }
    process.stdout.write(lineaDeEstado(entrada) + '\n');
    process.exit(0);
  } else if (orden === 'leer') {
    const opciones = {};
    if (argumento('--max-edad-min') !== undefined) opciones.maxEdadMin = Number(argumento('--max-edad-min'));
    if (argumento('--umbral') !== undefined) opciones.umbral = Number(argumento('--umbral'));
    const r = fichero
      ? juzgar(leerTexto(fichero), Date.now(), opciones)
      : noPude('no hay LOCALAPPDATA ni --fichero');
    process.stdout.write(JSON.stringify({ ...r, fichero }) + '\n');
    process.exit(SALIDA[r.veredicto]);
  } else {
    console.error('uso: node uso.mjs escribir|leer [--fichero F] [--max-edad-min N] [--umbral P]');
    process.exit(SALIDA.NO_PUDE_MIRAR);
  }
}
