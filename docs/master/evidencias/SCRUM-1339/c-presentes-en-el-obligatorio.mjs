#!/usr/bin/env node
// SCRUM-1339c · ¿el job OBLIGATORIO del mismo run trae ENTERO el fichero que el trinquete de zona
// vio perder la cola? Se comprueba POR NOMBRE, no por recuento.
//
//   node docs/master/evidencias/SCRUM-1339/c-presentes-en-el-obligatorio.mjs <log> <fuente del test>
//
// <log> es la salida de `gh run view <run> --job <id de «build + tests»> --log`, tal cual.
// SÓLO LEE. El censo de nombres es el de `c-ordenar-por-fichero.mjs` (AST, nombres literales).
// ⚠️ NO VE nombres construidos en un bucle: los cuenta y los declara, no los busca.
import fs from 'node:fs';
import { declaradosEnOrden, lineasDelLog } from './c-ordenar-por-fichero.mjs';

const [, , rutaLog, rutaFuente] = process.argv;
if (!rutaLog || !rutaFuente) {
  console.error('uso: node c-presentes-en-el-obligatorio.mjs <log de «build + tests»> <fuente del test>');
  process.exit(2);
}
const lineas = lineasDelLog(fs.readFileSync(rutaLog, 'utf8'));
const { declarados, noLiterales } = declaradosEnOrden(fs.readFileSync(rutaFuente, 'utf8'));

const RE_MARCA = /^\s*[✔✖﹣]\s/u;
const conMarca = lineas.filter((l) => RE_MARCA.test(l)).length;
let presentes = 0;
const faltan = [];
const posLog = [];
declarados.forEach((d, i) => {
  const donde = lineas.findIndex((l) => RE_MARCA.test(l) && l.replace(RE_MARCA, '').startsWith(`${d.nombre} (`));
  if (donde >= 0) { presentes += 1; posLog.push(donde); } else faltan.push(`${i + 1}:${d.nombre}`);
});
// 🔴 CON MENOS DE DOS PRESENTES NO HAY ORDEN QUE JUZGAR. La primera versión decía «el orden ES el del
// fichero» con 0 presentes: `[].every()` es verdadero, y eso es un control que se cumple sobre el vacío.
const orden = posLog.length < 2
  ? 'no se puede juzgar el orden (menos de dos presentes)'
  : `el orden del informe ${posLog.every((x, i) => i === 0 || x > posLog[i - 1]) ? 'ES' : 'NO es'} el del fichero`;
console.log(`POBLACIÓN · ${declarados.length} nombres literales (${noLiterales.length} construidos, no buscados)`
  + ` · ${lineas.length} líneas de log · ${conMarca} con marca de resultado`);
console.log(`PRESENTES por nombre: ${presentes} de ${declarados.length} · ${orden}`);
for (const f of faltan.slice(0, 5)) console.log(`   falta ${f}`);
if (faltan.length > 5) console.log(`   … y ${faltan.length - 5} más`);
if (!conMarca) { console.log('🔴 CIEGO · el log no trae NI UNA línea de resultado: no es el log de una tanda'); console.log('EXIT=2'); process.exit(2); }
console.log('EXIT=0');
