// scripts/_backup-nucleo.mjs — SCRUM-242
//
// LA PARTE DEL BACKUP QUE SE PUEDE PROBAR SIN BASE DE DATOS.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UN BACKUP QUE NO SE HA RESTAURADO NUNCA NO ES UN BACKUP
//
// Ésa es la regla del ticket y es la que decide el diseño entero de este fichero. Un volcado que
// EXISTE no prueba nada: puede estar truncado, puede ser de una base equivocada, puede haberse
// escrito con un `pg_dump` incompatible con el servidor y contener la mitad de las tablas. Las
// tres cosas producen un fichero con bytes dentro y fecha de hoy.
//
// Por eso aquí hay TRES veredictos y no dos, y el del medio es el que evita la mentira:
//
//   VERIFICADO      · se restauró en una base vacía y el recuento de tablas CUADRA.
//   NO_VERIFICADO   · el volcado se hizo y se puede LEER, pero nadie lo ha restaurado. **No se
//                     puede llamar backup todavía**, y el script lo dice y sale con error.
//   CIEGO           · ni siquiera se pudo comprobar (falta binario, falta base de pruebas…).
//
// «No pude comprobarlo» y «está bien» tienen que ser distinguibles, que es la lección de
// `leerTipoRetencion` y de `leerRecargoDelCliente` aplicada a otra cosa.
//
// ⚠️ AQUÍ NO ENTRA NINGUNA CADENA DE CONEXIÓN. Este módulo trabaja con recuentos y con la salida
// del inventario; las URLs se manejan en el orquestador y solo a través de `_db-guard.mjs`.

export const VERIFICADO = 'VERIFICADO';
export const NO_VERIFICADO = 'NO_VERIFICADO';
export const CIEGO = 'CIEGO';

/**
 * Las tablas que declara el INVENTARIO de un volcado (`pg_restore --list`).
 *
 * Leer el inventario es una lectura de verdad del fichero —lo abre, lo descomprime y recorre su
 * tabla de contenidos—, no un `existsSync`. Un volcado truncado o corrupto falla aquí.
 *
 * Formato de cada línea de interés: `<id>; <oid> <oid> TABLE <esquema> <nombre> <dueño>`
 */
export function tablasDelInventario(salida) {
  if (typeof salida !== 'string' || salida.trim() === '') return null; // no se pudo leer: null ≠ 0
  const tablas = new Set();
  for (const linea of salida.split(/\r?\n/)) {
    if (linea.startsWith(';')) continue; // comentarios de cabecera del propio inventario
    // `TABLE DATA` es el CONTENIDO; `TABLE` a secas es la DEFINICIÓN. Se cuentan las definiciones.
    //
    // ⚠️ El `(?!DATA\b)` no es cosmético: sin él, `TABLE DATA public merchants` casaba igual y
    // capturaba `DATA`+`public` como si fueran esquema y tabla. El recuento salía inflado —y podía
    // cuadrar con el origen por casualidad, que es la peor forma de estar mal—. Lo cazó el control
    // positivo del propio lector.
    const m = linea.match(/^\s*\d+;\s+\d+\s+\d+\s+TABLE\s+(?!DATA\b)(\S+)\s+(\S+)/);
    if (m) tablas.add(`${m[1]}.${m[2]}`);
  }
  return tablas;
}

/**
 * El veredicto. PURO: entran tres recuentos y sale qué se puede afirmar.
 *
 * @param {number|null} enOrigen  tablas contadas en la base de origen (`null` = no se pudo)
 * @param {Set|null}    enVolcado tablas que declara el inventario del volcado (`null` = ilegible)
 * @param {number|null} enDestino tablas tras restaurar en la base vacía (`null` = no se restauró)
 */
export function veredictoDelBackup(enOrigen, enVolcado, enDestino) {
  if (enOrigen === null || enOrigen === undefined) {
    return { estado: CIEGO, motivo: 'no se pudo contar las tablas de la base de origen' };
  }
  if (enVolcado === null || enVolcado === undefined) {
    return { estado: CIEGO, motivo: 'el volcado no se pudo LEER (inventario vacío o ilegible)' };
  }
  const nVolcado = enVolcado instanceof Set ? enVolcado.size : Number(enVolcado);
  if (nVolcado === 0) {
    return { estado: CIEGO, motivo: 'el volcado no declara ni una tabla: existe pero no sirve' };
  }
  if (nVolcado !== enOrigen) {
    return {
      estado: CIEGO,
      motivo: `el volcado declara ${nVolcado} tablas y la base de origen tiene ${enOrigen}`,
    };
  }
  if (enDestino === null || enDestino === undefined) {
    return {
      estado: NO_VERIFICADO,
      motivo: 'el volcado se puede leer, pero NO se ha restaurado en ninguna base: '
        + 'un backup que no se ha restaurado nunca no es un backup',
    };
  }
  if (enDestino !== enOrigen) {
    return {
      estado: CIEGO,
      motivo: `la restauración dejó ${enDestino} tablas y el origen tiene ${enOrigen}`,
    };
  }
  return { estado: VERIFICADO, motivo: `restaurado y cuadrado: ${enDestino} tablas` };
}

/**
 * El destino externo, DECLARADO POR VARIABLE DE ENTORNO Y NO ELEGIDO AQUÍ.
 *
 * 🛑 Contratar un almacenamiento es coste recurrente (regla 36) y lo decide el fundador. Este
 * script deja el fichero listo y dice a dónde iría; **no sube nada** mientras no haya destino, y
 * cuando lo haya, tampoco elige cuál: lee el que le digan.
 *
 * `BACKUP_DESTINO_TIPO` — `s3` | `r2` | `local` … el nombre lo pone quien lo contrate.
 * `BACKUP_DESTINO_RUTA` — carpeta/bucket de destino.
 *
 * ⚠️ Las credenciales del destino NO se leen aquí ni se imprimen nunca: quien suba, que las tome
 * de su propio entorno.
 */
export function destinoDeclarado(env = process.env) {
  const tipo = (env.BACKUP_DESTINO_TIPO || '').trim();
  const ruta = (env.BACKUP_DESTINO_RUTA || '').trim();
  if (!tipo) {
    return {
      hayDestino: false,
      motivo: 'sin `BACKUP_DESTINO_TIPO`: el volcado queda en disco y NO se sube a ninguna parte',
    };
  }
  if (!ruta) {
    return { hayDestino: false, motivo: `\`BACKUP_DESTINO_TIPO=${tipo}\` sin \`BACKUP_DESTINO_RUTA\`` };
  }
  return { hayDestino: true, tipo, ruta };
}
