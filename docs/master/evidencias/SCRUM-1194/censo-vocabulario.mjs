// SCRUM-1194 · «el servidor acepta un VALOR que la pantalla no ofrece» — la medición, impresa.
//
// Desde SCRUM-1194d el algoritmo vive en `tests/_censo-vocabulario-ofrecido.mjs`, que es lo que
// usa el trinquete (`tests/scrum1194d-trinquete-vocabulario-ofrecido.test.mjs`). Este fichero sólo
// lo llama e imprime: un algoritmo en dos sitios acaba divergiendo.
//
// Uso: node censo-vocabulario.mjs <raíz del repo> [--todo] [--sin-siembra]
// Salidas: 0 medido (haya o no hallazgos) · 2 CIEGO (el parche no casa, o falla un control SEMBRADO).
// `--sin-siembra` quita el positivo fabricado: TIENE que salir CIEGO (exit 2), no verde.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const RAIZ = path.resolve(process.argv[2] || '.');
const { censarVocabulario } = await import(pathToFileURL(path.join(RAIZ, 'tests/_censo-vocabulario-ofrecido.mjs')).href);
const c = await censarVocabulario(RAIZ, { sembrar: !process.argv.includes('--sin-siembra') });
if (c.ciego) { console.log(`\n🔴 CIEGO — ${c.ciego}`); process.exit(2); }

const p = c.poblacion; const { positivo: sp, negativo: sc } = c.controles;
const c1136 = c.filas.find((x) => x.v.nombre === 'CAMPOS_CLIENTE' && x.r.method === 'POST' && x.r.path === '/admin/customers/import');
console.log(`población: ${p.vocabularios} vocabularios del servidor (${p.zod} z.enum + ${p.arrays} arrays de literales) · ${p.rutas} rutas (sonda 1185) · siembra aparte: 1 vocabulario, 2 rutas`);
console.log(`  · sin ninguna ruta que los use (ni directo ni a un salto): ${p.sinRuta}  ← NO PUDE LIGAR`);
console.log(`  · pares vocabulario×ruta: ${p.pares}`);
console.log(`      GET (el vocabulario se DEVUELVE, no se acepta: no es esta forma): ${p.get}`);
console.log(`      sin pantalla llamadora (ruta sin consumidor: dominio de 1185): ${p.sinPantalla}`);
console.log(`      ofrece todo: ${p.ofreceTodo} · PARCIAL: ${p.parcial} · no nombra NINGUNO: ${p.ninguno} · NO PUDE MEDIR: ${p.noPudeMedir}`);
console.log(`control positivo SEMBRADO (pareja de 1136, 4 de 12): ${sp.veredicto} · faltan ${sp.faltan.join(', ')} ✅`);
console.log(`control negativo SEMBRADO (gemela, 12 de 12): ${sc.veredicto} ✅`);
console.log(`SCRUM-1136 real (POST /admin/customers/import): ${c1136 ? c1136.veredicto + (c1136.faltan.length ? ' · faltan ' + c1136.faltan.join(', ') : '') : 'NO APARECE'}`);
for (const x of ['PARCIAL', 'no nombra NINGUNO', 'NO PUDE MEDIR']) {
  const fs_ = c.filas.filter((f) => f.veredicto === x); if (!fs_.length) continue;
  console.log(`\n── ${x} ──`);
  // Una ruta que no lee `req.body` (según 1185) no puede aceptar el valor de fuera por el cuerpo:
  // el vocabulario lo compara con algo guardado. Se marca, no se reclasifica (puede ir por query).
  const sinCuerpo = (r) => r.cuerpoLeido && !r.cuerpoLeido.ciego && !r.cuerpoLeido.ks.length ? '  ⚠️ la ruta no lee req.body' : '';
  for (const f of fs_) console.log(`  ${f.r.method} ${f.r.path}  ·  ${f.v.nombre} (${f.v.file} · ruta ${f.r.file}:${f.r.line})${sinCuerpo(f.r)}\n      faltan [${f.faltan.join(', ')}] de [${f.v.valores.join(', ')}]\n      pantallas: ${f.llamadores.join(', ')}${f.porEnvoltorio ? `  (${f.porEnvoltorio} por envoltorio)` : ''}`);
}
console.log(`\n── «ofrece todo» SÓLO gracias a pantallas traídas por envoltorio: ${c.soloPorEnvoltorio.length} ──`);
for (const f of c.soloPorEnvoltorio) console.log(`  ${f.r.method} ${f.r.path}  ·  ${f.v.nombre} (${f.r.file}:${f.r.line})\n      con los directos faltarían [${f.faltanDirectos.join(', ')}]\n      directos: ${f.directos.join(', ')} · por envoltorio: ${f.llamadores.filter((x) => !f.directos.includes(x)).join(', ')}`);
if (process.argv.includes('--todo')) {
  console.log('\n── ofrece todo ──'); for (const f of c.filas.filter((x) => x.veredicto === 'ofrece todo')) console.log(`  ${f.r.method} ${f.r.path} · ${f.v.nombre}`);
  console.log('\n── sin ruta ──'); for (const v of c.sinRuta) console.log(`  ${v.nombre} (${v.file}) [${v.valores.slice(0, 6).join(', ')}${v.valores.length > 6 ? '…' : ''}]`);
}
