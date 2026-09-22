// docs/master/evidencias/scrum864/mutacion.mjs — SCRUM-864
//
// 🔴 MUTACIÓN: se le quita a `_temporal.mjs` su compromiso de limpieza y **tiene que volver el
// resto**. Si no vuelve, el arreglo no es el arreglo: es una casualidad del banco.
//
// El ticket dice «quitar el `finally`». Aquí el mecanismo no es un `finally` —está explicado en
// la cabecera del helper: hay sitios sin `t` y sitios fuera de un test— sino el enganche
// `process.on('exit', limpiarTodo)`. **Se muta lo que de verdad garantiza la limpieza**, no la
// palabra que el ticket usó para nombrarla.
//
// Disciplina, la de siempre:
//   1. la mutación tiene que ENTRAR (si el contenido no cambia, aborta);
//   2. el fuente se restaura BYTE A BYTE y se comprueba;
//   3. no hace falta reconstruir `dist/`: esto es un `.mjs` que se lee tal cual.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../../../..');
const HELPER = path.join(RAIZ, 'tests/_temporal.mjs');
const BANCO = path.join(AQUI, 'el-que-decide.mjs');
const NODE = process.execPath;

const salida = [];
const di = (s = '') => { salida.push(s); console.log(s); };

const ANCLA = "    process.on('exit', limpiarTodo);";
const MUTADO = "    // process.on('exit', limpiarTodo);   ← MUTACIÓN";

/** Corre el banco y devuelve cuántos restos dejó el caso de DESPUÉS. */
function correrBanco() {
  const r = spawnSync(NODE, [BANCO], { cwd: RAIZ, shell: false, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const txt = (r.stdout || '') + (r.stderr || '');
  // Se lee el bloque de DESPUÉS por POSICIÓN, no el primer número que aparezca: el de HOY va
  // antes y dice 1 siempre.
  const i = txt.indexOf('DESPUÉS (con');
  if (i < 0) return { CIEGO: true, txt };
  const m = txt.slice(i).match(/directorios que deja tirados \.+: (\d+)/);
  const eje = /¿llegó a EJECUTARSE el cuerpo\? \.+: sí/.test(txt.slice(i));
  return m ? { dejados: Number(m[1]), ejecutado: eje, txt } : { CIEGO: true, txt };
}

di('═══ CONTROL · sin mutar ═══');
const base = correrBanco();
if (base.CIEGO) { di('🔴 CIEGO: no sé leer la salida del banco.'); process.exit(3); }
di('   el caso de DESPUÉS deja: ' + base.dejados + (base.dejados === 0 ? '  ✅' : '  🔴'));
if (base.dejados !== 0) { di('🔴 la base no está limpia; no se puede mutar.'); process.exit(3); }

const original = fs.readFileSync(HELPER);
const texto = original.toString('utf8');
if (!texto.includes(ANCLA)) {
  di('🔴 ABORTADA: el ancla no existe en `_temporal.mjs`. La mutación no mediría nada.');
  process.exit(3);
}

di('');
di('═══ MUTACIÓN · se le quita el enganche de salida ═══');
try {
  fs.writeFileSync(HELPER, texto.split(ANCLA).join(MUTADO), 'utf8');
  const entro = Buffer.compare(fs.readFileSync(HELPER), original) !== 0;
  di('   ¿ENTRÓ la mutación? ' + (entro ? 'sí (contenido distinto)' : '🔴 NO — aborto'));
  if (!entro) throw new Error('la escritura no cambió el fichero');

  const r = correrBanco();
  di('   el caso de DESPUÉS deja ahora: ' + (r.CIEGO ? 'CIEGO' : r.dejados));
  di('   ¿el cuerpo siguió ejecutándose? ' + (r.ejecutado ? 'sí' : '🔴 no — entonces el cero de antes era falso'));
  di('');
  di('   VEREDICTO: ' + (!r.CIEGO && r.dejados > 0 && r.ejecutado
    ? '✅ CAE — sin el enganche vuelve el resto. El arreglo es el arreglo.'
    : '🔴 NO CAE — el resto no vuelve, así que el banco no estaba midiendo el mecanismo.'));
} finally {
  fs.writeFileSync(HELPER, original);
  const intacto = Buffer.compare(fs.readFileSync(HELPER), original) === 0;
  di('');
  di('   restaurado byte a byte: ' + (intacto ? 'sí' : '🔴 NO'));
  if (!intacto) throw new Error('EL ÁRBOL QUEDÓ SUCIO en ' + HELPER);
}

const fin = correrBanco();
di('   post-condición · el caso de DESPUÉS vuelve a dejar: ' + (fin.CIEGO ? 'CIEGO' : fin.dejados));

fs.writeFileSync(path.join(AQUI, 'salida-mutacion.txt'), salida.join('\n') + '\n');
