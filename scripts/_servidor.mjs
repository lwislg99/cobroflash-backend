// scripts/_servidor.mjs — SCRUM-620
//
// DÓNDE SE DECIDE CÓMO LEVANTA SU SERVIDOR UN GUARD. Hermano de `_navegador.mjs`, y por el mismo
// motivo exacto: hasta hoy no había ningún sitio donde eso se decidiera.
//
// ── EL DEFECTO QUE CIERRA ────────────────────────────────────────────────────────────────────
// Los nueve guards de navegador levantan un servidor propio para servirse sus páginas, y **los
// nueve lo creaban en su propio fichero: cero módulo común** (medido en SCRUM-620). Ninguno
// trataba el fallo de `listen`, así que un puerto ocupado subía como `Unhandled 'error' event` →
// `exit 1` → y la puerta lo pintaba **`rojo(1)`**, que es el código de «HE ENCONTRADO UN DEFECTO».
//
// O sea: «no pude medir» contado como «hay un defecto». Es la mentira peor de las dos, porque
// manda a alguien a buscar en el CSS algo que está bien; y cuando no lo encuentre, la conclusión
// cómoda es «este guard falla solo» — que es cómo se desactiva una protección buena.
//
// Y no es un caso raro: el caso real (SCRUM-617) fueron sockets en `TIME_WAIT` de **la pasada
// anterior del propio guard**. Cualquiera que itere sobre un arreglo lanza la cadena dos veces
// seguidas.
//
// ── EL VOCABULARIO, QUE YA EXISTÍA ───────────────────────────────────────────────────────────
//     0 · midió
//     1 · encontró un defecto
//     2 · NO SUPE MIRAR ............ no hay navegador          (`_navegador.mjs`)
//     3 · NO PUDE ARRANCARLO ....... lo hay y no levanta       (`_navegador.mjs`)
//     4 · NO PUDE LEVANTAR MI SERVIDOR ... aquí
//
// 🔴 EL 4 NO REUSA EL 3, y es deliberado: el fallo del navegador y el del servidor SE PARECEN, y
// que se parezcan es justo lo que hay que impedir que se confunda. Con códigos distintos el log
// dice qué capa falló sin que nadie lea una traza.
//
// ── LO QUE ESTO NO HACE ──────────────────────────────────────────────────────────────────────
// 🔴 NO REINTENTA Y NO ESPERA a que el puerto se libere. Un guard que reintenta hasta que le sale
//    bien es un guard que ya no puede decir que algo está roto.
// 🔴 NO elige el puerto. Quién lo elige es del llamante; esto sólo levanta y DICE LA VERDAD si no
//    puede. Son dos cosas distintas y mezclarlas fue lo que hizo falta desenredar.
import { SALIDA_NO_ENCONTRADO, SALIDA_NO_ARRANCA } from './_navegador.mjs';

/** No pude levantar mi servidor. Distinto de 2, de 3 y de «he encontrado un defecto» (1). */
export const SALIDA_SIN_SERVIDOR = 4;

// Suelo de coherencia: si alguien iguala dos códigos, los diagnósticos vuelven a ser el mismo y
// este módulo pierde su razón de existir. Se comprueba al cargar, no en un test lejano.
if (SALIDA_SIN_SERVIDOR === SALIDA_NO_ENCONTRADO || SALIDA_SIN_SERVIDOR === SALIDA_NO_ARRANCA
    || SALIDA_SIN_SERVIDOR === 1 || SALIDA_SIN_SERVIDOR === 0) {
  console.error('🔴 los códigos de salida han dejado de ser distintos; el diagnóstico no vale.');
  process.exit(SALIDA_SIN_SERVIDOR);
}

/**
 * Levanta `srv` y devuelve **el puerto REAL** — que con `puerto = 0` no es el que pediste, sino el
 * que te dio el sistema. Se devuelve siempre para que el llamante no tenga que saber cuál de los
 * dos casos es.
 *
 * Si `listen` falla POR LO QUE SEA —no sólo `EADDRINUSE`— para con `SALIDA_SIN_SERVIDOR` y lo dice
 * con sus palabras. El `once('error')` va ANTES del `listen`: el evento puede llegar en el mismo
 * tick y engancharlo después lo perdería, que es cómo se convierte en `Unhandled 'error' event`.
 */
export function levantarServidor(srv, puerto, host) {
  return new Promise((ok) => {
    srv.once('error', (e) => {
      const donde = `${host ? host + ':' : ''}${puerto}`;
      console.error('🔴 NO PUDE LEVANTAR MI SERVIDOR.');
      console.error(`   puerto pedido: ${donde}${e && e.code ? '   ·   ' + e.code : ''}`);
      if (e && e.code === 'EADDRINUSE') {
        console.error('   Está ocupado. Puede ser OTRO proceso, o pueden ser los sockets de TU');
        console.error('   PASADA ANTERIOR todavía en TIME_WAIT — pasa al lanzar la cadena dos');
        console.error('   veces seguidas, que es lo que hace cualquiera que esté iterando.');
      }
      console.error(`   Esto NO es «he encontrado un defecto» (eso sale con 1) ni un problema del`);
      console.error(`   navegador (2 y 3): el guard NO HA LLEGADO A MEDIR NADA, así que su silencio`);
      console.error('   no significa que esté todo bien.');
      console.error(`   Detalle: ${e && e.message ? e.message : e}`);
      process.exit(SALIDA_SIN_SERVIDOR);
    });
    const alEscuchar = () => ok(srv.address().port);
    if (host) srv.listen(puerto, host, alEscuchar);
    else srv.listen(puerto, alEscuchar);
  });
}
