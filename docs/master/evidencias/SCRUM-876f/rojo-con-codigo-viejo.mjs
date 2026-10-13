// ¿El test de un arreglo sale ROJO con el código de antes?
// Para cada caso: base verde -> se quita el arreglo (el diff de su commit, aplicado al revés, sólo en
// las rutas de código) -> build si toca src/ -> se corre SU test -> se restaura con git.
// Uso, desde la raíz de un árbol LIMPIO:  node <ruta>/rojo-con-codigo-viejo.mjs <id> [<id>...]
// Un caso que no se puede quitar limpio sale CIEGO, no rojo ni verde.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const CASOS = {
  1227: { desde: '8ddea271^', hasta: '8ddea271', rutas: ['src/app.ts', 'src/modules/system/merchantAdmin.ts'], tests: ['tests/scrum1227-perfil-ida-y-vuelta.test.mjs'], build: true },
  1285: { desde: '78f9a35d^', hasta: '78f9a35d', rutas: ['src/core/db/escrituraConVersion.ts', 'src/modules/system/app/routes/quotesAdmin.routes.ts'], tests: ['tests/scrum1285b-plan-de-cobro-con-version.test.mjs'], build: true },
  1371: { desde: '34a3dc81^', hasta: '34a3dc81', rutas: ['public/dashboard/js/homeView.js'], tests: ['tests/scrum1371-reintentar-no-vuelve-a-crear.test.mjs'], build: false },
  930: { desde: '029222d9^', hasta: '029222d9', rutas: ['public/dashboard/js/quotesView.js'], tests: ['tests/scrum930-plantilla-guarda-descripcion-y-dto.test.mjs'], build: false },
  '1488ruta': { desde: 'eca676a3^1', hasta: 'eca676a3', rutas: ['src/modules/jobs/app/routes/partes.routes.ts'], tests: ['tests/scrum1488-rango-del-parte.test.mjs'], build: true },
  // Finos: sólo la línea del arreglo, sobre el código de HOY (cuando el parche ya no sale limpio).
  '1371presupuesto': { tests: ['tests/scrum1371-reintentar-no-vuelve-a-crear.test.mjs'], build: false, reemplazos: [{ ruta: 'public/dashboard/js/homeView.js', de: 'let quote = qqState.creado && qqState.creado.pedido === pedido ? qqState.creado.quote : null;', a: 'let quote = null;' }] },
  '1371cliente': { tests: ['tests/scrum1371-reintentar-no-vuelve-a-crear.test.mjs'], build: false, reemplazos: [{ ruta: 'public/dashboard/js/homeView.js', de: '      qqState.customerId = customerId;\n', a: '' }] },
  '1487fino': { tests: ['tests/scrum1487-la-ficha-lee-la-palabra-del-locale.test.mjs'], build: false, reemplazos: [{ ruta: 'public/dashboard/js/quotesDetailView.js', de: "const palabraDelDocumento = (window.appLocale && window.appLocale.quote) || '';", a: "const palabraDelDocumento = 'Presupuesto';" }] },
  1487: { desde: '73ce872c^1', hasta: '73ce872c', rutas: ['public/dashboard/js/quotesDetailView.js'], tests: ['tests/scrum1487-la-ficha-lee-la-palabra-del-locale.test.mjs'], build: false },
};

const entorno = { ...process.env };
for (const v of ['FORCE_COLOR', 'NODE_OPTIONS', 'QA_DB_TEST', 'A55_DB_TEST', 'BOT_SUITE_TEST']) delete entorno[v];
if (!process.argv.includes('--con-banco')) delete entorno.LIBRO_PG_URL;

const git = (...a) => spawnSync('git', a, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const sucio = () => git('status', '--porcelain').stdout.trim();

function correr(tests) {
  const tap = path.join(os.tmpdir(), `rojo-viejo-${process.pid}-${Date.now()}.tap`);
  const r = spawnSync(process.execPath, ['--test', '--test-force-exit', '--test-reporter=tap', `--test-reporter-destination=${tap}`, ...tests], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  const lineas = fs.existsSync(tap) ? fs.readFileSync(tap, 'utf8').split(/\r?\n/) : [];
  if (fs.existsSync(tap)) fs.unlinkSync(tap);
  const casos = lineas.filter((l) => /^(not ok|ok) \d+ - /.test(l));
  const saltados = casos.filter((l) => /# SKIP/.test(l));
  return { salida: r.status, casos: casos.length, saltados: saltados.length, caidos: casos.filter((l) => l.startsWith('not ok')).map((l) => l.replace(/^not ok \d+ - /, '')) };
}

function build() {
  const r = spawnSync(process.execPath, [path.join(RAIZ, 'node_modules', 'typescript', 'bin', 'tsc')], { cwd: RAIZ, env: entorno, encoding: 'utf8' });
  return { salida: r.status, errores: (r.stdout || '').split(/\r?\n/).filter((l) => /error TS/.test(l)) };
}

const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (!ids.length) { console.error('uso: rojo-con-codigo-viejo.mjs <id> [<id>...]   ids: ' + Object.keys(CASOS).join(' ')); process.exit(2); }
if (sucio()) { console.error('🔴 el árbol no está limpio: no se muta nada'); process.exit(2); }
console.log(`POBLACION · ${ids.length} caso(s): ${ids.join(' ')} · HEAD ${git('rev-parse', 'HEAD').stdout.trim()}`);

let huboBuild = false;
let mal = 0;
for (const id of ids) {
  const c = CASOS[id];
  if (!c) { console.log(`✖ ${id} · caso desconocido`); mal++; continue; }
  const base = correr(c.tests);
  if (!base.casos || base.caidos.length || base.salida !== 0 || base.saltados === base.casos) {
    console.log(`? ${id} · CIEGO: la BASE no vale (casos ${base.casos}, caídos ${base.caidos.length}, saltados ${base.saltados}, salida ${base.salida})`);
    mal++; continue;
  }
  if (c.reemplazos) {
    let linea;
    try {
      const fallos = [];
      for (const r of c.reemplazos) {
        const f = path.join(RAIZ, r.ruta);
        const original = fs.readFileSync(f, 'utf8');
        const de = original.includes('\r\n') ? r.de.replace(/\n/g, '\r\n') : r.de;
        const veces = original.split(de).length - 1;
        if (veces !== 1) { fallos.push(`«de» casa ${veces} veces en ${r.ruta}`); continue; }
        fs.writeFileSync(f, original.replace(de, r.a));
      }
      const numstat = git('diff', '--numstat').stdout.trim().replace(/\r?\n/g, ' | ').replace(/\t/g, ' ');
      if (fallos.length || !numstat) {
        linea = `? ${id} · CIEGO: ${fallos.join(' · ') || 'el árbol no cambió'}`;
        mal++;
      } else {
        const r = correr(c.tests);
        const rojo = r.caidos.length > 0;
        if (!rojo) mal++;
        linea = `${rojo ? '✔ ROJO' : '✖ VERDE'} ${id} · quitado [sólo la línea del arreglo · ${numstat}] · base ${base.casos} casos · caen ${r.caidos.length} de ${r.casos}` +
          (rojo ? `: ${r.caidos.map((n) => `«${n.slice(0, 110)}»`).join(' · ')}` : ' — EL TEST NO CAZA SU DEFECTO');
      }
    } finally {
      git('restore', '--source=HEAD', '--staged', '--worktree', '.');
    }
    console.log(linea);
    if (sucio()) { console.error('🔴 el árbol NO quedó limpio tras restaurar: paro'); process.exit(2); }
    continue;
  }
  const parche = git('diff', c.desde, c.hasta, '--', ...c.rutas).stdout;
  if (!parche.trim()) { console.log(`? ${id} · CIEGO: el diff ${c.desde}..${c.hasta} sobre sus rutas sale vacío`); mal++; continue; }
  const fp = path.join(os.tmpdir(), `rojo-viejo-${process.pid}-${id}.patch`);
  fs.writeFileSync(fp, parche);
  let linea;
  try {
    // Tres maneras de quitar el arreglo, de la más fina a la más gruesa. La que se usó, se DICE.
    let modo = 'parche al revés';
    if (git('apply', '-R', '--check', fp).status === 0) {
      git('apply', '-R', fp);
    } else {
      const tres = git('apply', '-R', '--3way', fp);
      const conflicto = /^(UU|AA|DU|UD) /m.test(git('status', '--porcelain').stdout);
      if (tres.status === 0 && !conflicto) {
        modo = 'parche al revés con fusión a tres (el código cambió encima)';
        git('restore', '--staged', '.');
      } else {
        git('restore', '--source=HEAD', '--staged', '--worktree', '.');
        modo = `FICHERO ENTERO de ${c.desde} (el parche no sale limpio: se pierde también lo que entró después)`;
        for (const ruta of c.rutas) {
          const viejo = spawnSync('git', ['show', `${c.desde}:${ruta}`], { cwd: RAIZ, maxBuffer: 64 * 1024 * 1024 });
          if (viejo.status !== 0) { fs.rmSync(path.join(RAIZ, ruta), { force: true }); continue; }
          fs.writeFileSync(path.join(RAIZ, ruta), viejo.stdout);
        }
      }
    }
    const numstat = `${modo} · ` + git('diff', '--numstat').stdout.trim().replace(/\r?\n/g, ' | ').replace(/\t/g, ' ');
    const cambio = git('diff', '--numstat').stdout.trim();
    let b = null;
    if (cambio && c.build) { huboBuild = true; b = build(); }
    if (!cambio) {
      linea = `? ${id} · CIEGO: tras «${modo}» el árbol no cambió`;
      mal++;
    } else if (b && b.salida !== 0) {
      linea = `? ${id} · quitado [${numstat}] · el código viejo NO COMPILA (${b.errores.length} errores; el primero: ${b.errores[0] || 'sin texto'}) · sin veredicto del test`;
      mal++;
    } else {
      const r = correr(c.tests);
      const rojo = r.caidos.length > 0;
      if (!rojo) mal++;
      linea = `${rojo ? '✔ ROJO' : '✖ VERDE'} ${id} · quitado [${numstat}] · base ${base.casos} casos (${base.saltados} saltados) · con el código viejo caen ${r.caidos.length} de ${r.casos}` +
        (rojo ? `: ${r.caidos.map((n) => `«${n.slice(0, 110)}»`).join(' · ')}` : ' — EL TEST NO CAZA SU DEFECTO');
    }
  } finally {
    git('restore', '--source=HEAD', '--staged', '--worktree', '.');
    fs.unlinkSync(fp);
  }
  console.log(linea);
  if (sucio()) { console.error('🔴 el árbol NO quedó limpio tras restaurar: paro'); process.exit(2); }
}
if (huboBuild) { const b = build(); console.log(`RECOMPILADO con el código de HEAD · salida ${b.salida}`); }
const fin = correr(ids.flatMap((id) => (CASOS[id] ? CASOS[id].tests : [])));
console.log(`RESTAURADO · todos los tests de los casos: ${fin.casos} casos, ${fin.caidos.length} caídos, ${fin.saltados} saltados · árbol ${sucio() ? 'SUCIO' : 'limpio'}`);
console.log(`EXIT=${mal || fin.caidos.length ? 1 : 0}`);
process.exit(mal || fin.caidos.length ? 1 : 0);
