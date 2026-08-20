#!/usr/bin/env node
// scripts/comprobar-encargo.mjs — SCRUM-565
//
// ¿HA LLEGADO EL ENCARGO ENTERO? Lo comprueba LA SESIÓN QUE RECIBE, no la que envía.
//
// ── EL HECHO ─────────────────────────────────────────────────────────────────────────────────
// El 20-ago-2026 un encargo llegó con el punto 3 cortado a media frase y el bloque de
// prohibiciones acabando en un «⛔» vacío. Se supo porque la sesión lo declaró. Eso es
// disciplina, no mecanismo.
//
// 🔴 Y el modo de fallo es el peor: **un encargo cortado no PARECE cortado, parece más corto**.
//    Quien lo envía no ve lo que llegó sino lo que escribió, así que no puede saberlo. Y como lo
//    que se corta es EL FINAL, y en esta casa el final es el bloque de restricciones de
//    seguridad, **un encargo truncado es un encargo SIN LAS PROHIBICIONES**.
//
// ── LAS DOS RESPUESTAS SON DISTINTAS, Y CONFUNDIRLAS SERÍA EL DEFECTO ───────────────────────
// ① Falta el marcador final  → TRUNCADO. Es prueba dura: el marcador es lo último que se
//    escribe, así que si no está, falta texto. **Se para.**
// ② El marcador está y un recuento de la cabecera no cuadra → DISCREPANCIA. NO es prueba de
//    corte: la cabecera la escribe una persona y puede equivocarse al contar.
//
// 🔴 ESTO NO ES TEÓRICO: en el PRIMER encargo que llegó con cabecera —el de este mismo ticket—
//    el marcador estaba y decía «4 prohibiciones» habiendo CINCO. Un comprobador que tratara ese
//    desajuste como truncamiento habría mandado parar un encargo completo, en su estreno. Una
//    falsa alarma que se repite es un mecanismo que alguien desactiva.
//
//   Por eso: ① manda parar. ② manda PREGUNTAR — que no es lo mismo que seguir, ni que adivinar
//   lo que falta, que es justo lo que la ficha prohíbe.
//
// ── USO ──────────────────────────────────────────────────────────────────────────────────────
//   node scripts/comprobar-encargo.mjs <fichero>     · o por tubería:  … | node scripts/comprobar-encargo.mjs
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Lo último que se escribe en un encargo. Su ausencia es la prueba dura. */
export const MARCADOR = '=== FIN DEL ENCARGO ===';

/**
 * Los recuentos que la cabecera declara y cómo se cuentan en el cuerpo.
 *
 * Cada uno trae su `cuenta`, para que el contraste sea DERIVADO del texto recibido y no una
 * segunda cifra escrita a mano — que sería el mismo problema con otro nombre.
 */
export const RECUENTOS = [
  {
    clave: 'alcance',
    enCabecera: /(\d+)\s+puntos?\s+de\s+alcance/i,
    // Los puntos numerados que hay DENTRO de la sección de alcance.
    cuenta: (t) => (seccion(t, /^##\s+ALCANCE\s*$/im).match(/^\d+\.\s/gm) || []).length,
    queEs: 'puntos de alcance',
  },
  {
    clave: 'prohibiciones',
    enCabecera: /(\d+)\s+prohibiciones?/i,
    cuenta: (t) => (t.match(/^⛔/gm) || []).length,
    queEs: 'prohibiciones (⛔)',
  },
  {
    clave: 'suelo',
    enCabecera: /(\d+)\s+suelos?/i,
    cuenta: (t) => (t.match(/^##\s+SUELO\s*$/gim) || []).length,
    queEs: 'bloques de SUELO',
  },
  {
    clave: 'seguridad',
    enCabecera: /bloque\s+de\s+restricciones\s+de\s+seguridad\s+con\s+(\d+)\s+líneas/i,
    // Sólo las viñetas de primer nivel: las continuaciones van sangradas y NO son restricciones
    // aparte. Contarlas inflaría el número y haría saltar la alarma en un encargo íntegro.
    cuenta: (t) => (seccion(t, /^##\s+🛑\s+RESTRICCIONES\s+DE\s+SEGURIDAD/im).match(/^-\s/gm) || []).length,
    queEs: 'líneas de restricciones de seguridad',
  },
];

/** El texto desde un encabezado hasta el siguiente `##`, o hasta el final. */
export function seccion(texto, re) {
  const m = re.exec(texto);
  if (!m) return '';
  const desde = m.index + m[0].length;
  const resto = texto.slice(desde);
  const sig = /^##\s/m.exec(resto);
  return sig ? resto.slice(0, sig.index) : resto;
}

/**
 * El veredicto. `TRUNCADO` · `DISCREPANCIA` · `SIN_CABECERA` · `COMPLETO`.
 *
 * 🔴 SUELO: si no hay cabecera de recuento NO se contesta «completo». Se dice que no se ha
 *    podido contrastar, que es otra cosa: un encargo sin cabecera y uno íntegro dan el mismo
 *    silencio y significan cosas distintas.
 */
export function comprobar(texto) {
  const t = String(texto).replace(/\r\n/g, '\n');

  // 🔴 EL MARCADOR TIENE QUE **SER EL FINAL**, NO ESTAR EN ALGUNA PARTE.
  //
  // La primera versión buscaba el marcador en todo el texto y **daba por completo un encargo
  // cortado**. Lo cazó el control al cortar por el punto 3: la propia CABECERA lo cita —«Si no
  // ves «=== FIN DEL ENCARGO ===» al final, PARA Y DILO»— así que lo encontraba en el carácter
  // 144 de 5.130. O sea: el comprobador habría aprobado cualquier encargo truncado del formato
  // nuevo, que son TODOS los que trae cabecera. Inútil exactamente en el caso para el que existe.
  //
  // Se compara la ÚLTIMA línea no vacía con `===`, no con `includes`: «el marcador aparece» y «el
  // mensaje termina en el marcador» son afirmaciones distintas, y sólo la segunda prueba algo.
  const lineas = t.split('\n').map((l) => l.trim()).filter((l) => l !== '');
  const ultima = lineas.length ? lineas[lineas.length - 1] : '';
  const marcador = ultima === MARCADOR;

  const declarados = {};
  for (const r of RECUENTOS) {
    const m = r.enCabecera.exec(t);
    if (m) declarados[r.clave] = Number(m[1]);
  }
  const hayCabecera = Object.keys(declarados).length > 0;

  if (!marcador) {
    // 🔴 LA CABECERA ES LO QUE CONVIERTE «no hay marcador» EN PRUEBA.
    //
    // El truncamiento se lleva EL FINAL, así que la cabecera —que va arriba— SOBREVIVE. Por eso:
    // cabecera sin marcador = el mensaje anunciaba un cierre y el cierre no llegó. Es dura.
    //
    // Sin cabecera no se puede afirmar lo mismo: los encargos del formato viejo no llevan
    // marcador y están enteros. Llamarlos truncados sería una falsa alarma en CADA encargo
    // anterior a hoy, y una alarma que salta siempre es una alarma que alguien apaga.
    if (!hayCabecera) {
      return {
        veredicto: 'SIN_CIERRE',
        parar: false,
        marcador: false,
        desajustes: [],
        mensaje: '🟡 Este encargo no trae cabecera de recuento ni marcador final, así que NO se puede\n'
          + '   comprobar si llegó entero. Es el formato anterior a SCRUM-565.\n'
          + '   Esto NO es «está completo»: es «no hay con qué comprobarlo». Si el texto acaba de\n'
          + '   forma rara —a media frase, o en un «⛔» vacío—, PARA y pídelo con cierre.',
      };
    }
    return {
      veredicto: 'TRUNCADO',
      parar: true,
      marcador: false,
      desajustes: [],
      mensaje: '🔴 EL ENCARGO ANUNCIA UN CIERRE Y EL CIERRE NO HA LLEGADO.\n'
        + '   Trae cabecera de recuento pero no termina en «' + MARCADOR + '».\n'
        + '   El marcador es lo ÚLTIMO que se escribe: si no está, falta texto — y lo que falta es\n'
        + '   el final, donde viven las restricciones de seguridad. PARA y pide el encargo completo.\n'
        + '   NO adivines lo que falta: rellenar huecos de contexto es el patrón que causó esto.',
    };
  }
  if (Object.keys(declarados).length === 0) {
    return {
      veredicto: 'SIN_CABECERA',
      parar: false,
      marcador: true,
      desajustes: [],
      mensaje: '🟡 El marcador final SÍ llega, pero no hay cabecera de recuento que contrastar.\n'
        + '   Esto NO es «completo»: es «no se ha podido comprobar el cuerpo». El marcador sólo\n'
        + '   prueba que llegó el final, no que no falte nada por el medio.',
    };
  }

  const desajustes = [];
  for (const r of RECUENTOS) {
    if (!(r.clave in declarados)) continue;
    const real = r.cuenta(t);
    if (real !== declarados[r.clave]) desajustes.push({ que: r.queEs, dice: declarados[r.clave], hay: real });
  }

  if (desajustes.length === 0) {
    return {
      veredicto: 'COMPLETO', parar: false, marcador: true, desajustes,
      mensaje: '✅ Marcador final presente y los ' + Object.keys(declarados).length
        + ' recuentos de la cabecera cuadran con lo recibido.',
    };
  }

  return {
    veredicto: 'DISCREPANCIA',
    parar: false,
    marcador: true,
    desajustes,
    mensaje: '🟡 El marcador final SÍ llega —o sea que el encargo NO está cortado— pero la cabecera\n'
      + '   y el cuerpo no dicen lo mismo:\n'
      + desajustes.map((d) => `      · ${d.que}: la cabecera dice ${d.dice}, en el cuerpo hay ${d.hay}`).join('\n')
      + '\n   NO es prueba de truncamiento: la cabecera la escribe una persona y contar a mano falla.\n'
      + '   DECLÁRALO en el informe y PREGUNTA cuál manda. No lo ajustes en silencio ni supongas\n'
      + '   qué se perdió.',
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────────────────────
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const f = process.argv[2];
  const texto = f ? fs.readFileSync(f, 'utf8') : fs.readFileSync(0, 'utf8');
  if (!texto.trim()) {
    console.error('🔴 NO SUPE MIRAR: no me ha llegado texto que comprobar.');
    process.exit(2);
  }
  const r = comprobar(texto);
  console.log('veredicto: ' + r.veredicto);
  console.log(r.mensaje);
  // 1 = para. 0 = sigue (aunque haya que declarar la discrepancia).
  process.exit(r.parar ? 1 : 0);
}
