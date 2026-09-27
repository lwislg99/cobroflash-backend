// tests/_uso-banco.mjs — SCRUM-999 · fixture de `uso.mjs` para bancos que lanzan `orquestador-arranque.mjs`
//
// `orquestador-arranque.mjs` ahora pregunta a `uso.mjs leer` antes de lanzar (SCRUM-999), y
// `uso.mjs` SIEMPRE lee `%LOCALAPPDATA%\yaqu-equipo\uso.json` salvo que se le pase `--fichero`
// (que orquestador-arranque.mjs no le pasa: en producción quiere el dato REAL de la máquina).
// Sin aislar `LOCALAPPDATA`, un banco leería el uso.json de ESTA máquina — hoy AVISO al 88 % — y
// el veredicto del test cambiaría según cuánta cuota le quede a la cuenta en el momento de correr
// la tanda. Es la misma familia de defecto que las cuatro rondas de CI de #1806: un test que
// promete determinismo y en realidad depende del entorno.

import fs from 'node:fs';
import path from 'node:path';

/** La carpeta que hace de `%LOCALAPPDATA%` para el banco. */
export function localAppData(dir) {
  return path.join(dir, 'localappdata');
}

/**
 * Escribe un `uso.json` en la forma que `juzgar()` de `uso.mjs` sabe leer, dentro del
 * `LOCALAPPDATA` aislado de `dir`.
 * @param {string} dir         el `dir` del banco (temporal)
 * @param {number|null} usado  porcentaje usado (0-100), o `null` para dejar SIN lectura vigente
 *                             (`uso.mjs leer` contesta NO_PUDE_MIRAR, como una máquina recién instalada)
 * @param {object} [o]
 * @param {number} [o.edadMin] minutos de antigüedad de la lectura (por defecto, recién leída)
 */
export function escribirUso(dir, usado, { edadMin = 0 } = {}) {
  const carpeta = path.join(localAppData(dir), 'yaqu-equipo');
  fs.mkdirSync(carpeta, { recursive: true });
  const fichero = path.join(carpeta, 'uso.json');
  if (usado === null) {
    fs.writeFileSync(fichero, JSON.stringify({ formato: 1, ultima_llamada: null, vigente: null, sesiones: {} }));
    return fichero;
  }
  const leido = new Date(Date.now() - edadMin * 60_000).toISOString();
  const reg = {
    formato: 1,
    sesiones: {},
    ultima_llamada: { en: leido, sesion: 'banco', version: 'banco', trae_rate_limits: true, api_ms: 1 },
    vigente: {
      sesion: 'banco',
      leido_en: leido,
      five_hour: { used_percentage: usado, resets_at: Math.floor(Date.now() / 1000) + 3600 },
      seven_day: null,
    },
  };
  fs.writeFileSync(fichero, JSON.stringify(reg));
  return fichero;
}
