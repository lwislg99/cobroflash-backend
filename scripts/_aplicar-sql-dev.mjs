// scripts/_aplicar-sql-dev.mjs — SCRUM-425
//
// LA PARTE PURA DE `aplicar-sql-dev.mjs`: qué sentencias sabe aplicar la herramienta.
//
// Vive aparte del CLI —mismo patrón que `_guard-conformidad-landing.mjs`— para que su rojo se
// pueda ejercitar SIN ficheros, sin base de datos y sin lanzar Prisma.
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 LISTA BLANCA, NO NEGRA — y el cambio importa más que la lista
//
// La primera versión rechazaba DROP/TRUNCATE/DELETE/UPDATE. **Una lista negra no puede ser
// exhaustiva**, y es literalmente la forma de defecto de esta casa: un guard que solo vigila lo
// que le enseñaron deja pasar lo que no conoce (SCRUM-418, la clave de destino desconocida).
// Bastaba un `ALTER TABLE … DROP CONSTRAINT` partido en dos líneas, o un `ALTER COLUMN … TYPE`
// —que no borra nada y puede reescribir una tabla entera— para pasar por delante.
//
// Al revés: **se ACEPTAN solo las formas que esta herramienta sabe leer, y todo lo demás se
// rechaza, incluido lo que no sepa clasificar.** Lo desconocido no se permite. El día que haga
// falta otra forma se añade aquí a conciencia y con su caso — que es exactamente el momento en
// que alguien debería estar mirando.
//
// ⚠️ Y por qué esto no es paranoia: `--accept-data-loss` **NO protege a `db execute --file`**
// (medido en SCRUM-395). Esa bandera es de `db push`. `db execute` corre lo que le des.

export const PERMITIDAS = Object.freeze([
  { nombre: 'ALTER TABLE … ADD COLUMN', re: /^ALTER\s+TABLE\s+\S+\s+ADD\s+COLUMN\s+(IF\s+NOT\s+EXISTS\s+)?[\s\S]+$/i },
  { nombre: 'CREATE [UNIQUE] INDEX',    re: /^CREATE\s+(UNIQUE\s+)?INDEX\s+(CONCURRENTLY\s+)?(IF\s+NOT\s+EXISTS\s+)?[\s\S]+$/i },
]);

/** Quita comentarios CONSERVANDO las líneas, para que el número que se reporte sea el real. */
export function sinComentarios(sql) {
  const hueco = (m) => m.replace(/[^\n]/g, ' ');
  return String(sql ?? '').replace(/\/\*[\s\S]*?\*\//g, hueco).replace(/--[^\n]*/g, hueco);
}

/**
 * Clasifica cada sentencia del fichero. PURA: recibe el texto, no lo lee del disco.
 *
 * @returns {{permitidas: {linea:number,sentencia:string,forma:string}[], rechazadas: {linea:number,sentencia:string}[]}}
 */
export function clasificarSentencias(sql) {
  const limpio = sinComentarios(sql);
  const permitidas = [];
  const rechazadas = [];
  let pos = 0;
  for (const trozo of limpio.split(';')) {
    const inicio = pos;
    pos += trozo.length + 1; // +1 por el `;` que se comió el split
    const sentencia = trozo.trim().replace(/\s+/g, ' ');
    if (!sentencia) continue;
    // Línea del PRIMER carácter no vacío de la sentencia, no la del `;` anterior.
    const desplazamiento = trozo.length - trozo.replace(/^\s+/, '').length;
    const linea = limpio.slice(0, inicio + desplazamiento).split('\n').length;
    const forma = PERMITIDAS.find((p) => p.re.test(sentencia));
    if (forma) permitidas.push({ linea, sentencia, forma: forma.nombre });
    else rechazadas.push({ linea, sentencia });
  }
  return { permitidas, rechazadas };
}

/**
 * El veredicto completo sobre un texto SQL, con su SUELO dentro.
 *
 * 🔴 Un fichero vacío, o uno del que no se reconoce ni una sentencia, **NO es inofensivo**: es uno
 * que no se ha mirado. «No hay sentencias peligrosas» y «no supe leer» no pueden salir por la
 * misma puerta — es el defecto que este proyecto lleva la semana entera desenterrando.
 *
 * @returns {{ok: true, permitidas: object[]} | {ok: false, motivo: string, mensaje: string, rechazadas?: object[]}}
 */
export function revisar(sql, { ruta = '(texto)' } = {}) {
  if (sql == null) {
    return { ok: false, motivo: 'suelo_ilegible', mensaje: `SUELO: no se pudo leer ${ruta}. «No hay nada peligroso» y «no supe leer» no son lo mismo.` };
  }
  if (!String(sql).trim()) {
    return { ok: false, motivo: 'suelo_vacio', mensaje: `SUELO: ${ruta} está VACÍO. Eso no es «nada que aplicar»: es que no hay nada que mirar.` };
  }
  const { permitidas, rechazadas } = clasificarSentencias(sql);
  if (permitidas.length === 0 && rechazadas.length === 0) {
    return {
      ok: false,
      motivo: 'suelo_sin_sentencias',
      mensaje:
        `SUELO: no se ha reconocido NI UNA sentencia en ${ruta} (${String(sql).length} bytes leídos).\n` +
        '   Si de verdad solo hay comentarios, no hay nada que aplicar. Si no, el clasificador está\n' +
        '   ciego, y aplicar a ciegas es justo lo que esta herramienta existe para no hacer.',
    };
  }
  if (rechazadas.length) {
    const lista = rechazadas.map((r) => `      línea ${r.linea}: ${r.sentencia.slice(0, 120)}`).join('\n');
    return {
      ok: false,
      motivo: 'sentencia_no_permitida',
      rechazadas,
      mensaje:
        `${rechazadas.length} sentencia(s) que esta herramienta NO sabe aplicar:\n${lista}\n\n` +
        '   Solo se aceptan: ' + PERMITIDAS.map((p) => p.nombre).join(' · ') + '.\n' +
        '   LO DESCONOCIDO SE RECHAZA, no se permite: `--accept-data-loss` NO protege a `db execute`\n' +
        '   (SCRUM-395), así que lo que no se sabe leer no se ejecuta.',
    };
  }
  return { ok: true, permitidas };
}
