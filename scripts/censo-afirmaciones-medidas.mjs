// scripts/censo-afirmaciones-medidas.mjs — SCRUM-880b
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// UNA AFIRMACIÓN CON EL SELLO «MEDIDO» Y SIN FECHA DE CADUCIDAD ES LA FORMA MÁS CONVINCENTE
// QUE TIENE UN DATO VIEJO DE SEGUIR PARECIENDO CIERTO.
//
// Sale de un hallazgo de SCRUM-880: `CLAUDE.md` regla 3 afirma, marcada como **REGISTRO MEDIDO**
// del 10-ago-2026, que los cuatro worktrees llevan tres variables de entorno. En `cobroflash-b4`
// faltan dos. La medición era cierta el día que se hizo; hoy no lo es, y el sello sigue puesto.
//
// ⛔ ESTE SCRIPT NO ARREGLA NI RE-FECHA NADA. Lista y clasifica (regla 9). Re-fechar la de los
// cuatro worktrees exige medir los cuatro, y desde aquí sólo se ve uno.
//
// ── LA POBLACIÓN, DECLARADA ────────────────────────────────────────────────────────────────
//
// `CLAUDE.md` y `docs/equipo/*.md`. NO se mira `docs/master/` ni el máster: ahí las mediciones
// son el REGISTRO de un trabajo concreto —una foto fechada de su día, que es lo que deben ser—,
// mientras que en estos dos sitios son INSTRUCCIONES VIVAS que alguien lee para decidir hoy.
//
// ⚠️ El criterio es una marca de medición en la línea, y va acotado a propósito: se busca la
// palabra como PALABRA (no dentro de otra) y se descuentan las líneas que sólo EXPLICAN cómo se
// mide —el imperativo «mide», «hay que medir»— porque una instrucción no es una afirmación.
// ═══════════════════════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';

export const FUENTES = Object.freeze(['CLAUDE.md', 'docs/equipo']);

/** La marca: participio de medición. Una afirmación que se presenta como comprobada. */
const MARCA = /\b(medid[oa]s?|censad[oa]s?|contad[oa]s?|comprobad[oa]s?|verificad[oa]s?)\b/i;

/**
 * 🔴 LO QUE NO ES UNA AFIRMACIÓN MEDIDA, y se descuenta declarándolo:
 *  · el ENCABEZADO o la instrucción («cómo se mide aquí», «hay que medirlo»): manda hacer algo,
 *    no afirma un estado;
 *  · la línea de una TABLA cuya celda es el comando: es el instrumento, no el dato;
 *  · la propia palabra dentro de una ruta o un identificador (`afirmaciones-verificadas.md`).
 */
const ES_INSTRUCCION = /\b(hay que|habrá que|se mide|cómo se mide|mídelo|medir|remídelo|re-fech|vuelve a medir|quien lo vuelva)\b/i;

export function ficherosFuente(raiz) {
  const fuera = [];
  for (const f of FUENTES) {
    const abs = path.join(raiz, f);
    if (!fs.existsSync(abs)) continue;
    if (fs.statSync(abs).isDirectory()) {
      for (const n of fs.readdirSync(abs)) if (n.endsWith('.md')) fuera.push(`${f}/${n}`);
    } else fuera.push(f);
  }
  return fuera.sort();
}

/**
 * 🔴 LOS DOS EJES QUE DECIDEN SI UNA AFIRMACIÓN PUEDE CADUCAR EN SILENCIO.
 *
 * ① ¿LLEVA FECHA? Una medida fechada dice «esto era así el día X»: envejece, pero lo dice ella
 *    sola. Una sin fecha se lee como presente para siempre.
 * ② ¿LLEVA CON QUÉ VOLVER A PREGUNTARLO? Un comando, un fichero, una ruta. Sin eso, la única
 *    forma de saber si sigue siendo cierta es reconstruir la medición desde cero — y nadie lo
 *    hace.
 *
 * ⚠️ NINGUNO DE LOS DOS ES SUFICIENTE, y el caso que abrió esto lo demuestra: la regla 3 de
 * `CLAUDE.md` **lleva fecha** (10-ago-2026) y **aun así caducó**, porque afirma un estado en
 * PRESENTE («los cuatro worktrees llevan…») que el lector toma por vigente. La fecha protege del
 * olvido, no de la lectura.
 */
const LLEVA_FECHA = /\b\d{1,2}-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)-\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/i;
const LLEVA_CON_QUE_VOLVER = /`[^`]*(npm |node |git |grep |ls |\.mjs|\.md|\.ts|\.json)[^`]*`/;

/** Cada línea con marca de medición, con su fichero, su número y su texto. */
export function censar(raiz) {
  const ficheros = ficherosFuente(raiz);
  const filas = [];
  let instrucciones = 0;
  let enRuta = 0;
  for (const f of ficheros) {
    const lineas = fs.readFileSync(path.join(raiz, f), 'utf8').split('\n');
    lineas.forEach((l, i) => {
      if (!MARCA.test(l)) return;
      // La palabra dentro de un nombre de fichero no es una afirmación.
      const sinRutas = l.replace(/[\w./-]*(medid|censad|contad|comprobad|verificad)[\w./-]*\.md/gi, ' ');
      if (!MARCA.test(sinRutas)) { enRuta += 1; return; }
      if (ES_INSTRUCCION.test(l)) { instrucciones += 1; return; }
      filas.push({ fichero: f, linea: i + 1, texto: l.trim(), fecha: LLEVA_FECHA.test(l), comando: LLEVA_CON_QUE_VOLVER.test(l) });
    });
  }
  return { ficheros: ficheros.length, filas, descontadasInstruccion: instrucciones, descontadasEnRuta: enRuta };
}

if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) {
  const c = censar(process.cwd());
  console.log(`población: ${c.ficheros} ficheros fuente · ${c.filas.length} afirmaciones con marca `
    + `de medición (descontadas: ${c.descontadasInstruccion} instrucciones · ${c.descontadasEnRuta} `
    + 'la palabra dentro de un nombre de fichero)');
  const n=(p)=>c.filas.filter(p).length;
  console.log('  ejes: ' + n((f)=>f.fecha) + ' con fecha · ' + n((f)=>!f.fecha) + ' SIN FECHA · ' + n((f)=>f.comando) + ' con con-que-volver · ' + n((f)=>!f.fecha && !f.comando) + ' 🔴 NI FECHA NI COMANDO');
  let actual = '';
  for (const f of c.filas) {
    if (f.fichero !== actual) { actual = f.fichero; console.log(`\n── ${actual}`); }
    console.log(`  ${String(f.linea).padStart(4)} ${f.fecha ? 'F' : '·'}${f.comando ? 'C' : '·'} ${f.texto.slice(0, 120)}`);
  }
}
