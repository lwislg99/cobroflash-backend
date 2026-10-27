// docs/master/evidencias/SCRUM-1520/corte-del-informe.mjs — SCRUM-1520 · LA COLA QUE NO LLEGA, FABRICADA.
//
// Se carga con `--import` desde `NODE_OPTIONS`. No hace NADA salvo en el proceso HIJO de `node --test`
// (el que ejecuta un fichero de tests y le manda su informe al padre por la salida estándar) y sólo
// si ese hijo ejecuta el fichero de la siembra. Ahí envuelve `process.stdout.write` y, a partir del
// mensaje que se le indique, DEJA DE ENTREGAR: lo que el hijo cree haber escrito no llega al padre.
//
// Es lo que SCRUM-1405 midió en Linux (el hijo sale con bytes pendientes en su canal) visto desde el
// padre: un informe al que le falta la cola. NO es el mismo mecanismo —aquí la cola se tira a
// propósito, allí se pierde al salir— y por eso lo que mide este banco es qué hace el PADRE con un
// informe truncado y de dónde sale el código, no por qué se trunca.
//
//   CORTE_FICHERO   trozo de la ruta del fichero cuyo informe se corta (obligatorio para actuar)
//   CORTE_EN        `<tipo>|<trozo del nombre>` del mensaje donde cae el corte (p. ej. `test:start|caso 22 `)
//   CORTE_MODO      `antes` (ese mensaje ya no llega) · `despues` (es el último que llega) ·
//                   `mitad` (llega su primera mitad en bytes)
//   CORTE_SALIDA    si es `0`, además fuerza el código de salida del hijo a 0 (la pieza que se quita
//                   para ver cuál trabaja). Cualquier otro valor: no se toca.
//   CORTE_ACTA      fichero JSON donde el hijo deja escrito qué hizo y con qué código salió
import { deserialize } from 'node:v8';
import { writeFileSync } from 'node:fs';

const fichero = process.env.CORTE_FICHERO;
const esElHijo = process.env.NODE_TEST_CONTEXT === 'child-v8'
  && fichero && process.argv.some((a) => a.replaceAll('\\', '/').includes(fichero));

if (esElHijo) {
  const [tipoDelCorte, nombreDelCorte] = (process.env.CORTE_EN || '|').split('|');
  const modo = process.env.CORTE_MODO || 'antes';
  const hayCorte = Boolean(process.env.CORTE_EN);
  const escribir = process.stdout.write.bind(process.stdout);
  const mensajes = [];
  let cortado = false;
  let entregados = 0;
  let perdidos = 0;

  process.stdout.write = function escribirConCorte(trozo, codificacion, hecho) {
    if (typeof codificacion === 'function') { hecho = codificacion; codificacion = undefined; }
    const bytes = typeof trozo === 'string' ? Buffer.from(trozo, codificacion) : Buffer.from(trozo.buffer, trozo.byteOffset, trozo.byteLength);
    // Un mensaje del informe: cabecera de v8 (2) + longitud (4) + el valor con su cabecera.
    let tipo = 'ILEGIBLE';
    let nombre = '';
    try {
      const m = deserialize(bytes.subarray(6));
      tipo = String(m.type);
      nombre = String(m.data?.name ?? '');
    } catch { /* no era un mensaje entero: se apunta como ILEGIBLE y el banco lo cuenta */ }
    const apunte = { tipo, nombre, bytes: bytes.length, llega: bytes.length };
    mensajes.push(apunte);

    if (!cortado && hayCorte && tipo === tipoDelCorte && nombre.includes(nombreDelCorte)) {
      cortado = true;
      apunte.corte = modo;
      if (modo === 'despues') { entregados += bytes.length; return escribir(bytes, hecho); }
      if (modo === 'mitad') {
        const media = Math.floor(bytes.length / 2);
        apunte.llega = media;
        entregados += media;
        perdidos += bytes.length - media;
        return escribir(bytes.subarray(0, media), hecho);
      }
      apunte.llega = 0;
      perdidos += bytes.length;
      if (hecho) process.nextTick(hecho);
      return true;
    }
    if (cortado) {
      apunte.llega = 0;
      perdidos += bytes.length;
      if (hecho) process.nextTick(hecho);
      return true;
    }
    entregados += bytes.length;
    return escribir(bytes, hecho);
  };

  process.on('exit', (codigo) => {
    const forzado = process.env.CORTE_SALIDA === '0';
    if (forzado) process.exitCode = 0;
    if (process.env.CORTE_ACTA) {
      writeFileSync(process.env.CORTE_ACTA, JSON.stringify({
        codigoPropio: codigo, forzadoACero: forzado, hayCorte, cortado, entregados, perdidos, mensajes,
      }));
    }
  });
}
