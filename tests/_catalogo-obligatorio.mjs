// tests/_catalogo-obligatorio.mjs — SCRUM-1387 ②
//
// El catálogo del meta-guard (los tests que exportan `MUTACIONES_QUE_ME_TUMBAN`) es destino OBLIGATORIO
// de todo banco de mutación NUEVO. Lo decidió el fundador en el comentario 18016 de SCRUM-1387
// (2-oct-2026): sólo hacia adelante, los que ya estaban fuera como lista declarada que MENGUA, y el
// rojo NOMBRA el banco y el fichero.
//
// QUÉ ES UN BANCO Y QUÉ ES «FUERA»: la misma definición que el censo de SCRUM-1394
// (`docs/master/evidencias/SCRUM-1394/bancos.mjs`), que es la que el fundador tuvo delante al decidir.
//   · banco  = una carpeta de `docs/evidencias/` o `docs/master/evidencias/` con algún fichero con
//              «mut» en el nombre;
//   · guion  = de ésos, los `.mjs` (o `.mjs.txt`);
//   · fuera  = tiene guion y NINGUNO nombra el catálogo.
// ⚠️ ES UNA HEURÍSTICA DE TEXTO, y se dice aquí porque es el límite del guard: un banco cuyos ficheros
// no lleven «mut» en el nombre no existe para él, y un guion que sólo MENCIONE el catálogo cuenta
// como dentro. No compara mutación a mutación.
//
// Puro a propósito: `clasificar` recibe un listado en memoria, así sus controles se fabrican sin
// escribir un solo fichero.
import fs from 'node:fs';
import path from 'node:path';

export const CARPETAS_DE_EVIDENCIAS = ['docs/evidencias', 'docs/master/evidencias'];

const NOMBRA_EL_CATALOGO = /MUTACIONES_QUE_ME_TUMBAN|censoDeDeclaraciones|mutacionesDeclaradas/;

/** Todos los ficheros con «mut» en el nombre bajo las carpetas de evidencias: `{ ruta, texto }`. */
export function leerFicherosDeMutacion(raiz) {
  const out = [];
  const andar = (rel) => {
    const abs = path.join(raiz, rel);
    if (!fs.existsSync(abs)) return;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const hijo = rel + '/' + e.name;
      if (e.isDirectory()) andar(hijo);
      else if (/mut/i.test(e.name)) {
        const esGuion = /\.mjs(\.txt)?$/.test(e.name);
        out.push({ ruta: hijo, texto: esGuion ? fs.readFileSync(path.join(raiz, hijo), 'utf8') : '' });
      }
    }
  };
  for (const c of CARPETAS_DE_EVIDENCIAS) andar(c);
  return out;
}

/** De un listado `{ ruta, texto }`, las carpetas con banco y cuáles están fuera del catálogo. */
export function clasificar(ficheros) {
  const carpetas = new Map();
  for (const f of ficheros) {
    const d = f.ruta.slice(0, f.ruta.lastIndexOf('/'));
    carpetas.set(d, [...(carpetas.get(d) || []), f]);
  }
  const bancos = [];
  for (const [carpeta, suyos] of [...carpetas].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const guiones = suyos.filter((f) => /\.mjs(\.txt)?$/.test(f.ruta));
    const usaCatalogo = guiones.some((g) => NOMBRA_EL_CATALOGO.test(g.texto));
    const fuera = guiones.length > 0 && !usaCatalogo;
    bancos.push({ carpeta, guiones: guiones.map((g) => g.ruta), fuera });
  }
  return { ficheros: ficheros.length, bancos, fuera: bancos.filter((b) => b.fuera) };
}

/** Las dos mitades del trinquete: lo que está fuera sin declarar, y lo declarado que ya no está fuera. */
export function juicio({ fuera, declaradas }) {
  const nombres = new Set(declaradas);
  const estan = new Set(fuera.map((b) => b.carpeta));
  const sinDeclarar = fuera.filter((b) => !nombres.has(b.carpeta));
  const sobran = declaradas.filter((d) => !estan.has(d));
  return { sinDeclarar, sobran };
}

/**
 * LA LISTA QUE SÓLO MENGUA (c.18016 de SCRUM-1387). ⛔ AQUÍ NO SE AÑADE NADA: un banco nuevo se
 * REGISTRA —el test del ticket exporta `MUTACIONES_QUE_ME_TUMBAN` y el guion las toma de ahí—.
 *
 * Empieza en 23 y no en los 18 que el fundador tuvo delante el 2-oct: entre su decisión y este guard
 * nadie la construyó, y entraron más (medido el 7-oct-2026 sobre `6536e63e`; el detalle, en
 * `docs/master/SCRUM-1387.md`).
 *
 *   · `motivo`  por qué está: «anterior» = ya estaba en `main` cuando se decidió; «posterior» = entró
 *               después de la decisión y antes de que existiera este guard.
 *   · `retira`  el puesto del área del ticket, LEÍDA de sus etiquetas de Jira el 7-oct-2026. Donde el
 *               ticket no lleva etiqueta de área se dice; no se ha inventado ninguno. En las carpetas
 *               con letra (`864c`, `876f`, `908c`) se leyó el ticket del número.
 *   · `desde`   la fecha en que ENTRÓ EN ESTA LISTA. ⚠️ NO es un plazo: el c.18016 no fija ninguno.
 */
export const FUERA_DECLARADOS = [
  { carpeta: 'docs/evidencias/scrum1317', motivo: 'anterior', retira: 'J4', desde: '2026-10-07' },
  { carpeta: 'docs/evidencias/scrum1338', motivo: 'anterior', retira: 'J4', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/SCRUM-1324', motivo: 'anterior', retira: 'J6', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/SCRUM-1345', motivo: 'anterior', retira: 'J6', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/SCRUM-1486', motivo: 'posterior', retira: 'S3', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/SCRUM-876f', motivo: 'posterior', retira: 'sin etiqueta de área en Jira (SCRUM-876)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/SCRUM-912', motivo: 'anterior', retira: 'S1', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/SCRUM-917', motivo: 'anterior', retira: 'S4', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1304', motivo: 'anterior', retira: 'J1', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1326', motivo: 'anterior', retira: 'sin etiqueta de área en Jira (SCRUM-1326, equipo de Javier)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1327', motivo: 'anterior', retira: 'J1', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1330', motivo: 'anterior', retira: 'J1', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1333', motivo: 'anterior', retira: 'J1', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1340', motivo: 'anterior', retira: 'J4', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1344', motivo: 'anterior', retira: 'J4', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1392', motivo: 'posterior', retira: 'sin etiqueta de área en Jira (SCRUM-1392, equipo de Javier)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum1395', motivo: 'posterior', retira: 'sin etiqueta de área en Jira (SCRUM-1395, equipo de Javier)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum864', motivo: 'anterior', retira: 'sin etiqueta de área en Jira (SCRUM-864)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum864c', motivo: 'anterior', retira: 'sin etiqueta de área en Jira (SCRUM-864)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum908c', motivo: 'anterior', retira: 'J6', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum920', motivo: 'anterior', retira: 'sin etiqueta de área en Jira (SCRUM-920)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum933', motivo: 'anterior', retira: 'sin etiqueta de área en Jira (SCRUM-933)', desde: '2026-10-07' },
  { carpeta: 'docs/master/evidencias/scrum982', motivo: 'anterior', retira: 'S2', desde: '2026-10-07' },
];

/** El techo de la lista. Baja con ella; no sube (c.18016). */
export const TECHO_DE_LA_LISTA = 23;
