// scripts/_clasificador-sql.mjs — SCRUM-395
//
// ¿ESTE FICHERO DE SQL PUEDE EJECUTARSE CONTRA UNA BASE, O DESTRUYE ALGO?
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// DE DÓNDE SALE
//
// El 7-ago-2026, durante la migración de C5, `prisma migrate diff` propuso BORRAR las cuatro
// columnas recién aplicadas, porque otra sesión había movido el worktree a una rama cuyo
// `schema.prisma` no las declara. Lo único que lo paró fue que una persona leyera el SQL y
// clasificara las sentencias a mano.
//
// 🔴 Y LA BANDERA QUE CREÍAMOS TENER NO CUBRE ESTA RUTA: `--accept-data-loss` protege a
// `db push`. Nosotros aplicamos con `prisma db execute --file`, que ejecuta el fichero TAL CUAL.
// Un `DROP COLUMN` explícito se ejecuta sin preguntar, con bandera o sin ella. Un paso manual no
// es una barrera: es una costumbre, y el día que alguien tiene prisa no está.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 POR QUÉ ESTO NO ES UN `grep DROP`
//
// Un guard de texto acaba vigilando la EXPLICACIÓN en vez del código (SCRUM-349). Ya mordió el
// mismo día: el auditor improvisado de una sesión se cazó a sí mismo porque la palabra «DROPs»
// estaba en un comentario suyo.
//
// Así que aquí se PARSEA: se retiran comentarios (`--` y `/* */`) y literales de cadena, se
// parte en sentencias por `;` **fuera** de cadenas, y se clasifica cada una por su FORMA. Una
// palabra dentro de un comentario o de un literal no puede disparar nada, y una sentencia
// peligrosa no puede esconderse detrás de un comentario.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LA REGLA: SE RECHAZA POR DEFECTO
//
// No hay lista negra de formas peligrosas — hay lista BLANCA de formas seguras. Todo lo que no
// se reconoce como aditivo se rechaza, incluido lo que no se supo parsear. Es el suelo: «no
// encontré nada peligroso» y «no supe mirar» dan el mismo verde y significan lo contrario, y
// aquí el segundo borra datos.
import crypto from 'node:crypto';

export const PERMITIDA = 'permitida';
export const RECHAZADA = 'rechazada';
export const AUTORIZADA = 'autorizada';

/**
 * Quita comentarios y neutraliza literales, respetando la posición para poder dar la LÍNEA.
 *
 * Los literales de cadena y los identificadores entre comillas se sustituyen por un relleno del
 * mismo tamaño: así una sentencia como `INSERT INTO t VALUES ('DROP COLUMN x')` no dispara nada,
 * y los números de línea siguen siendo los del fichero original.
 */
export function desnudar(sql) {
  const s = String(sql ?? '');
  let out = '';
  let i = 0;
  let sinCerrar = null;
  while (i < s.length) {
    const c = s[i];
    const d = s[i + 1];
    // Comentario de línea
    if (c === '-' && d === '-') {
      while (i < s.length && s[i] !== '\n') { out += ' '; i++; }
      continue;
    }
    // Comentario de bloque
    if (c === '/' && d === '*') {
      const fin = s.indexOf('*/', i + 2);
      if (fin < 0) { sinCerrar = 'comentario de bloque `/*` sin cerrar'; while (i < s.length) { out += s[i] === '\n' ? '\n' : ' '; i++; } break; }
      for (; i < fin + 2; i++) out += s[i] === '\n' ? '\n' : ' ';
      continue;
    }
    // Literal de cadena. '' dentro de la cadena es un apóstrofo escapado, no el cierre.
    if (c === "'") {
      out += ' '; i++;
      let cerrada = false;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") { out += '  '; i += 2; continue; }
        if (s[i] === "'") { out += ' '; i++; cerrada = true; break; }
        out += s[i] === '\n' ? '\n' : ' '; i++;
      }
      if (!cerrada) { sinCerrar = "literal de cadena `'` sin cerrar"; break; }
      continue;
    }
    // Identificador entrecomillado: se CONSERVA (es un nombre, no texto libre), sin las comillas.
    if (c === '"') {
      out += ' '; i++;
      let cerrada = false;
      while (i < s.length) {
        if (s[i] === '"' && s[i + 1] === '"') { out += '  '; i += 2; continue; }
        if (s[i] === '"') { out += ' '; i++; cerrada = true; break; }
        out += s[i]; i++;
      }
      if (!cerrada) { sinCerrar = 'identificador `"` sin cerrar'; break; }
      continue;
    }
    out += c; i++;
  }
  return { desnudo: out, sinCerrar };
}

/** Parte en sentencias por `;`, sobre el texto YA desnudo, conservando la línea de inicio. */
export function partirSentencias(desnudo) {
  const fuera = [];
  let actual = '';
  let linea = 1;
  let lineaInicio = 1;
  let vistoAlgo = false;
  for (let i = 0; i < desnudo.length; i++) {
    const c = desnudo[i];
    if (c === ';') {
      if (actual.trim()) fuera.push({ sql: actual.trim(), linea: lineaInicio });
      actual = ''; vistoAlgo = false;
      continue;
    }
    if (!vistoAlgo && c.trim()) { lineaInicio = linea; vistoAlgo = true; }
    if (c === '\n') linea++;
    actual += c;
  }
  if (actual.trim()) fuera.push({ sql: actual.trim(), linea: lineaInicio });
  return fuera;
}

/** Huella de una sentencia, para que una autorización valga SOLO para ella. */
export function huellaDeSentencia(sqlDesnudo) {
  const norm = String(sqlDesnudo).replace(/\s+/g, ' ').trim().toUpperCase();
  return crypto.createHash('sha256').update(norm).digest('hex').slice(0, 12);
}

const PALABRA = (t) => new RegExp(`(^|[^A-Z0-9_])${t}([^A-Z0-9_]|$)`);

/**
 * Clasifica UNA sentencia ya desnuda. Devuelve `{ veredicto, motivo, forma }`.
 *
 * Lista BLANCA: si la forma no se reconoce como aditiva, se rechaza. Nunca al revés.
 */
export function clasificarSentencia(sqlDesnudo) {
  const t = String(sqlDesnudo).replace(/\s+/g, ' ').trim().toUpperCase();
  if (!t) return { veredicto: RECHAZADA, forma: 'vacía', motivo: 'sentencia vacía' };

  // ── Formas destructivas, nombradas una a una ──────────────────────────────
  if (/^DROP\b/.test(t)) return { veredicto: RECHAZADA, forma: 'DROP', motivo: 'DROP: destruye un objeto y sus datos' };
  if (PALABRA('DROP').test(t)) return { veredicto: RECHAZADA, forma: 'DROP', motivo: 'contiene DROP (p. ej. `ALTER TABLE … DROP COLUMN`): destruye datos' };
  if (PALABRA('RENAME').test(t)) return { veredicto: RECHAZADA, forma: 'RENAME', motivo: 'RENAME: el código que use el nombre viejo deja de funcionar' };
  if (/^TRUNCATE\b/.test(t)) return { veredicto: RECHAZADA, forma: 'TRUNCATE', motivo: 'TRUNCATE: vacía la tabla' };
  if (/^DELETE\b/.test(t)) return { veredicto: RECHAZADA, forma: 'DELETE', motivo: 'DELETE: borra filas' };
  // ALTER COLUMN … TYPE (cambiar el tipo de una columna existente) — distinto de ALTER TYPE de un enum.
  // ⚠️ El identificador puede venir ENTRECOMILLADO: por `clasificarFichero` llega ya desnudo (sin
  // comillas), pero `clasificarSentencia` es pública y se la puede llamar con el SQL crudo. Sin
  // admitir la comilla, ese caso caía igual —lo atrapaba la lista blanca— pero con el motivo
  // genérico «no reconocida», que no dice al lector QUÉ tiene de peligroso. Lo cazó su test.
  if (/\bALTER\s+(COLUMN\s+)?["A-Z0-9_]+\s+(SET\s+DATA\s+)?TYPE\b/.test(t) && /^ALTER\s+TABLE\b/.test(t)) {
    return { veredicto: RECHAZADA, forma: 'ALTER COLUMN TYPE', motivo: 'cambia el tipo de una columna existente: puede truncar o fallar sobre los datos que ya hay' };
  }

  // ── Formas aditivas ───────────────────────────────────────────────────────
  if (/^ALTER\s+TABLE\b/.test(t)) {
    // Una ALTER TABLE puede llevar varias acciones separadas por comas.
    const cuerpo = t.replace(/^ALTER\s+TABLE\s+(IF\s+EXISTS\s+)?[A-Z0-9_."]+\s*/, '');
    const acciones = partirAcciones(cuerpo);
    if (acciones.length === 0) return { veredicto: RECHAZADA, forma: 'ALTER TABLE', motivo: 'no se reconoció ninguna acción dentro del ALTER TABLE' };
    for (const a of acciones) {
      if (!/^ADD\s+(COLUMN\s+)?/.test(a)) {
        return { veredicto: RECHAZADA, forma: 'ALTER TABLE', motivo: `acción no reconocida como aditiva: «${a.slice(0, 60)}»` };
      }
      const notNull = PALABRA('NOT NULL'.replace(' ', '\\s+')).test(a) || /\bNOT\s+NULL\b/.test(a);
      const tieneDefault = /\bDEFAULT\b/.test(a);
      if (notNull && !tieneDefault) {
        return {
          veredicto: RECHAZADA,
          forma: 'ADD COLUMN NOT NULL sin DEFAULT',
          motivo: `NOT NULL sin DEFAULT en «${a.slice(0, 60)}»: falla en seco si la tabla ya tiene filas`,
        };
      }
    }
    return { veredicto: PERMITIDA, forma: `ADD COLUMN ×${acciones.length}`, motivo: 'solo añade columnas (nullable o con DEFAULT)' };
  }
  if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/.test(t)) return { veredicto: PERMITIDA, forma: 'CREATE INDEX', motivo: 'crea un índice: no toca datos' };
  if (/^CREATE\s+TABLE\b/.test(t)) return { veredicto: PERMITIDA, forma: 'CREATE TABLE', motivo: 'crea una tabla nueva' };
  if (/^CREATE\s+TYPE\b/.test(t)) return { veredicto: PERMITIDA, forma: 'CREATE TYPE', motivo: 'crea un tipo nuevo' };
  if (/^ALTER\s+TYPE\b/.test(t) && /\bADD\s+VALUE\b/.test(t)) return { veredicto: PERMITIDA, forma: 'ALTER TYPE ADD VALUE', motivo: 'añade un valor a un enum: aditivo' };
  if (/^COMMENT\s+ON\b/.test(t)) return { veredicto: PERMITIDA, forma: 'COMMENT ON', motivo: 'solo documenta' };

  // ── SUELO ─────────────────────────────────────────────────────────────────
  return {
    veredicto: RECHAZADA,
    forma: 'DESCONOCIDA',
    motivo: 'forma no reconocida. Se rechaza POR DEFECTO: «no la reconozco» no puede valer como «es segura»',
  };
}

/** Parte el cuerpo de un ALTER TABLE en acciones, respetando los paréntesis. */
function partirAcciones(cuerpo) {
  const out = [];
  let prof = 0, actual = '';
  for (const c of cuerpo) {
    if (c === '(') prof++;
    if (c === ')') prof--;
    if (c === ',' && prof === 0) { if (actual.trim()) out.push(actual.trim()); actual = ''; continue; }
    actual += c;
  }
  if (actual.trim()) out.push(actual.trim());
  return out;
}

/**
 * Clasifica un fichero entero.
 *
 * `autorizaciones`: lista de `{ huella, motivo, autorizadaPor }`. Es NOMINAL — vale para ESA
 * sentencia y ninguna otra. No existe ningún interruptor global a propósito: un «sí a todo» se
 * pone una vez «para salir del paso» y se queda para siempre.
 */
export function clasificarFichero(texto, { autorizaciones = [] } = {}) {
  const { desnudo, sinCerrar } = desnudar(texto);
  if (sinCerrar) {
    return {
      ok: false,
      motivoGlobal: `🔴 NO SE PUDO PARSEAR EL FICHERO: ${sinCerrar}. No se ejecuta nada: «no supe leerlo» no es «no tiene nada peligroso».`,
      sentencias: [],
      rechazadas: [],
    };
  }
  const trozos = partirSentencias(desnudo);
  const hayContenido = desnudo.trim().length > 0;
  if (trozos.length === 0) {
    return {
      ok: false,
      motivoGlobal: hayContenido
        ? '🔴 EL FICHERO TIENE CONTENIDO PERO NO SE RECONOCIÓ NINGUNA SENTENCIA. No se ejecuta: es el caso de «no supe mirar».'
        : '🔴 EL FICHERO NO TIENE NINGUNA SENTENCIA (está vacío o es todo comentarios). Aplicar un fichero vacío es una operación que nadie ha pedido.',
      sentencias: [],
      rechazadas: [],
    };
  }

  const porHuella = new Map(autorizaciones.map((a) => [String(a.huella).toLowerCase(), a]));
  const sentencias = trozos.map((s, n) => {
    const huella = huellaDeSentencia(s.sql);
    const c = clasificarSentencia(s.sql);
    const aut = c.veredicto === RECHAZADA ? porHuella.get(huella) : null;
    if (aut) {
      return { n: n + 1, linea: s.linea, sql: s.sql, huella, veredicto: AUTORIZADA, forma: c.forma,
        motivo: `RECHAZADA por «${c.motivo}», pero AUTORIZADA nominalmente: ${aut.motivo} (por ${aut.autorizadaPor})` };
    }
    return { n: n + 1, linea: s.linea, sql: s.sql, huella, ...c };
  });
  const rechazadas = sentencias.filter((s) => s.veredicto === RECHAZADA);
  return { ok: rechazadas.length === 0, sentencias, rechazadas, motivoGlobal: null };
}

/** El informe legible. No imprime nada: lo devuelve, para que un test pueda afirmarlo. */
export function informe(r) {
  if (r.motivoGlobal) return r.motivoGlobal;
  const lineas = [`[clasificador] ${r.sentencias.length} sentencia(s):`];
  for (const s of r.sentencias) {
    const icono = s.veredicto === PERMITIDA ? '✅' : s.veredicto === AUTORIZADA ? '🟡' : '🔴';
    lineas.push(`  ${icono} línea ${s.linea} · ${s.forma} · ${s.huella}`);
    lineas.push(`     ${s.sql.replace(/\s+/g, ' ').slice(0, 100)}`);
    if (s.veredicto !== PERMITIDA) lineas.push(`     → ${s.motivo}`);
  }
  if (r.rechazadas.length) {
    lineas.push('');
    lineas.push(`🔴 ${r.rechazadas.length} SENTENCIA(S) RECHAZADA(S). NO se ejecuta el fichero.`);
    lineas.push('   Para autorizar UNA de ellas hay que declararla por su huella, con motivo y');
    lineas.push('   nombre de quien autoriza. No hay interruptor global: cada sentencia, una vez.');
  }
  return lineas.join('\n');
}
