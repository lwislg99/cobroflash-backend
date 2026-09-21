// SCRUM-920d · BANCO DE MUTACION de scripts/guard-lista-gastos.mjs (secciones I, J y la ampliacion de H).
// Uso, desde la raiz del worktree y con el arbol COMMITEADO (asi `git diff` de un fichero es SOLO la mutacion):
//   node docs/master/evidencias/scrum920/mutar-920d.mjs
// Cada mutacion cambia UNA cadena de expensesView.js o styles.css por una violacion real del tipo que el guard
// dice prevenir, comprueba que se aplico (cuenta ocurrencias y muestra `git diff --numstat`), corre el guard,
// RESTAURA el fichero y comprueba que el arbol vuelve a estar limpio. Antes de todas, la BASE sin mutar: tiene que
// dar exit 0 (sin base, un guard inestable que cae se lee como un mutante que muere; A3).
// El guard tarda ~30 s: 18 mutaciones + la base son ~10 minutos. Salida: una fila por mutacion, POBLACION y EXIT.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const RAIZ = process.cwd();
const JS = 'public/dashboard/js/expensesView.js';
const CSS = 'public/dashboard/css/styles.css';

const MUTACIONES = [
  { id: 'M01', f: CSS, quita: 'la animacion solo de opacidad de la pantalla (deja el `transform` que rompe el fixed)',
    de: '#view-container > .gastos-pantalla { animation-name: yaqu-fade-in-opacidad; }', a: '', rojo: /no está pegado al borde de abajo|se mueve/ },
  { id: 'M02', f: JS, quita: '«Sin foto» pasa a llevar un triangulo (texto sin firmar)',
    de: "e.tieneFoto ? 'Foto guardada' : 'Sin foto'", a: "e.tieneFoto ? 'Foto guardada' : '⚠ Sin foto'", rojo: /la foto de la fila dice otra cosa/ },
  { id: 'M03', f: JS, quita: 'una <img> con la foto ENTERA en cada fila con foto (la miniatura que pesa hasta 1,1 MiB)',
    de: "  meta.appendChild(gastoEl('span', 'gasto-foto '", a: "  if (e.tieneFoto) { const im = document.createElement('img'); im.src = '/admin/expenses/' + e.id + '/foto'; meta.appendChild(im); }\n  meta.appendChild(gastoEl('span', 'gasto-foto '", rojo: /la lista pide fotos/ },
  { id: 'M04', f: JS, quita: 'los chips cuentan el mes entero y no lo que se vera al pulsarlos',
    de: "const n = chip.dataset.foto === 'sinfoto' ? sinFoto.length : delTrabajo.length;", a: "const n = chip.dataset.foto === 'sinfoto' ? items.filter((e) => !e.tieneFoto).length : items.length;", rojo: /chips \[|· chips /
  },
  { id: 'M05', f: JS, quita: 'el chip vuelve a pedir la lista al servidor',
    de: "gastosVista.foto = chip.dataset.foto; pintarGastos(); });", a: "gastosVista.foto = chip.dataset.foto; pintarGastos(); loadExpenses(); });", rojo: /pidió la lista al servidor/ },
  { id: 'M06', f: JS, quita: 'la cabecera pinta la suma aunque no haya ningun filtro (el total del mes saldria dos veces)',
    de: "const filtrando = !!cat || job !== '' || foto !== 'todos';", a: 'const filtrando = true;', rojo: /cabecera sin filtros/ },
  { id: 'M07', f: JS, quita: '«Quitar los filtros» no suelta la categoria',
    de: 'if (cat && cat.value) {', a: 'if (false) {', rojo: /«Quitar los filtros» deja categoría/ },
  { id: 'M08', f: JS, quita: 'una categoria sin gastos dice «Sin gastos este mes»',
    de: 'if (!items.length && !cat) {', a: 'if (!items.length) {', rojo: /con una categoría sin gastos la pantalla dice/ },
  { id: 'M09', f: CSS, quita: 'la barra de «Nuevo gasto» es fija tambien en escritorio',
    de: '.gastos-barra { display: flex; }', a: '.gastos-barra { display: flex; position: fixed; left: 0; right: 0; bottom: 0; z-index: 25; }', rojo: /es fija también en escritorio/ },
  // ⚠️ M10 en DOS piezas, y la razon esta MEDIDA: con la animacion de opacidad puesta (`animation-fill-mode: both`), la
  // pantalla es un contexto de apilado que dura para siempre y el z-index de la barra vive DENTRO de el, siempre por debajo
  // de un modal colgado del body. Subir SOLO el z-index no cambia nada (primera pasada de M10: exit 0, mutante equivalente).
  // La mutacion honesta quita tambien la animacion (`animation: none`); entonces el z-index sí decide.
  { id: 'M10', f: CSS, quita: 'la barra pasa POR ENCIMA del modal (z-index 900 y sin el contexto de apilado de la animacion)',
    cambios: [
      { de: 'position: fixed; left: 0; right: 0; bottom: 0; z-index: 25; padding: 10px 16px', a: 'position: fixed; left: 0; right: 0; bottom: 0; z-index: 900; padding: 10px 16px' },
      { de: '#view-container > .gastos-pantalla { animation-name: yaqu-fade-in-opacidad; }', a: '#view-container > .gastos-pantalla { animation: none; }' },
    ], rojo: /la barra sigue POR ENCIMA del modal/ },
  { id: 'M11', f: JS, quita: '«Sin trabajo» deja fuera al gasto que tiene presupuesto pero no trabajo',
    de: 'if (job === TRABAJO_SUELTO) return !e.job;', a: 'if (job === TRABAJO_SUELTO) return !e.job && !e.quote;', rojo: /«Sin trabajo» deja/ },
  { id: 'M12', f: JS, quita: 'la suma de la cabecera pierde el primer gasto',
    de: 'return gastos.reduce((a, e) => a + Math.round(Number(e.amount) * 100), 0) / 100;', a: 'return gastos.slice(1).reduce((a, e) => a + Math.round(Number(e.amount) * 100), 0) / 100;', rojo: /cabecera con «Sin foto»|cabecera \{/ },
  { id: 'M13', f: JS, quita: '«1 gastos» (el singular deja de existir)',
    de: "return n + ' ' + (n === 1 ? singular : plural);", a: "return n + ' ' + plural;", rojo: /«Reforma baño» · cabecera/ },
  { id: 'M14', f: CSS, quita: 'el texto de «Sin foto» pasa a un ambar que no llega a 4,5:1',
    de: '.gasto-foto--no { background: #fff7ed; color: #b45309; }', a: '.gasto-foto--no { background: #fff7ed; color: #f59e0b; }', rojo: /píldoras por debajo de 4,5:1/ },
  { id: 'M15', f: JS, quita: 'el chip pulsado no cambia su aria-pressed',
    de: "chip.setAttribute('aria-pressed', String(chip.dataset.foto === foto));", a: '', rojo: /tras pulsar «Sin foto» el chip pulsado/ },
  { id: 'M16', f: CSS, quita: 'la barra crece hasta tapar la ultima fila',
    de: 'z-index: 25; padding: 10px 16px calc(10px + env(safe-area-inset-bottom));', a: 'z-index: 25; padding: 60px 16px calc(60px + env(safe-area-inset-bottom));', rojo: /la barra tapa la última fila/ },
  { id: 'M17', f: JS, quita: 'un segundo boton con el id #exp-new-btn (una copia del de arriba, no el mismo)',
    de: '<a id="exp-export-btn"', a: '<button class="btn-primary" id="exp-new-btn">Otro</button><a id="exp-export-btn"', rojo: /hay más de un botón/ },
  { id: 'M18', f: JS, quita: 'el filtro por trabajo ofrece un mismo trabajo una vez por gasto',
    de: 'trabajos.set(String(e.job.id), jobLabel(e.job));', a: "trabajos.set(String(e.job.id) + '-' + e.id, jobLabel(e.job));", rojo: /el filtro por trabajo ofrece/ },
];

const env = { ...process.env };
delete env.FORCE_COLOR;
delete env.GASTOS_PUBLICO;
const correrGuardUnaVez = () => {
  const r = spawnSync(process.execPath, ['scripts/guard-lista-gastos.mjs'], { cwd: RAIZ, env, encoding: 'utf8', timeout: 280000, maxBuffer: 32 * 1024 * 1024 });
  return { exit: r.status, salida: (r.stdout || '') + '\n' + (r.stderr || '') };
};
// Los cuatro desenlaces que el guard sabe dar son 0, 1, 2 y 3. Cualquier otro codigo (en Windows, 0xC0000409 = 3221226505;
// en la primera pasada, 134) es el NAVEGADOR o node muriendose bajo carga: el instrumento no llego a dar veredicto, y un
// «no cayo» leido de ahi seria un mutante vivo falso. Se reintenta (2 veces) y, si sigue, se declara CIEGO.
const correrGuard = () => {
  let r = correrGuardUnaVez();
  let intentos = 1;
  while (![0, 1, 2, 3].includes(r.exit) && intentos < 3) { r = correrGuardUnaVez(); intentos += 1; }
  return { ...r, intentos, ciego: ![0, 1, 2, 3].includes(r.exit) };
};
const git = (...args) => spawnSync('git', args, { cwd: RAIZ, encoding: 'utf8' });

const sucio = git('status', '--porcelain', '--', JS, CSS, 'scripts/guard-lista-gastos.mjs').stdout.trim();
console.log('TESTIGO · banco de mutacion 920d · HEAD ' + git('rev-parse', 'HEAD').stdout.trim());
if (sucio) { console.log('El arbol NO esta commiteado (' + sucio.replace(/\n/g, ' | ') + '): sin eso `git diff` no prueba nada. Aborto.'); console.log('EXIT=2'); process.exit(2); }

const base = correrGuard();
const lineas = (s) => s.split('\n');
console.log(`BASE sin mutar · guard exit=${base.exit} · ✅ ${lineas(base.salida).filter((l) => l.includes('✅')).length} · 🔴 ${lineas(base.salida).filter((l) => l.includes('🔴')).length}`);
if (base.exit !== 0) { console.log('La BASE no da 0: sin ella un mutante que cae no significa nada. Aborto.'); console.log('EXIT=2'); process.exit(2); }

// Sin argumentos corre las 18; con ids (`M12 M13 M14`) sólo esas — la BASE va SIEMPRE delante.
const pedidas = process.argv.slice(2).map((s) => s.toUpperCase());
const lista = pedidas.length ? MUTACIONES.filter((m) => pedidas.includes(m.id)) : MUTACIONES;
if (!lista.length) { console.log('Ninguna mutacion coincide con ' + pedidas.join(', ')); console.log('EXIT=2'); process.exit(2); }
const filas = [];
for (const m of lista) {
  const abs = path.join(RAIZ, m.f);
  const original = fs.readFileSync(abs, 'utf8');
  const cambios = m.cambios || [{ de: m.de, a: m.a }];
  const veces = cambios.map((c) => original.split(c.de).length - 1);
  const aplicable = veces.every((v) => v === 1);
  let fila = { id: m.id, quita: m.quita, aplicada: aplicable, numstat: '', exit: null, intentos: 0, ciego: false, rojoVisto: false, cae: false, restaurado: false };
  if (aplicable) {
    let mutado = original;
    for (const c of cambios) mutado = mutado.replace(c.de, () => c.a);
    fs.writeFileSync(abs, mutado, 'utf8');
    try {
      fila.numstat = git('diff', '--numstat', '--', m.f).stdout.trim().replace(/\t/g, ' ');
      const r = correrGuard();
      fila.exit = r.exit;
      fila.intentos = r.intentos;
      fila.ciego = r.ciego;
      // Se busca el rojo esperado SOLO en las lineas marcadas 🔴: una frase que tambien sale en un ✅ no es un rojo.
      const rojas = lineas(r.salida).filter((l) => l.includes('🔴'));
      fila.rojoVisto = m.rojo.test(rojas.join('\n'));
      fila.cae = !r.ciego && r.exit !== 0 && fila.rojoVisto;
      // Lo que el guard dijo, para que un «VIVA» se pueda LEER (¿cayo por otra razon?) y no solo contar.
      fila.rojas = rojas.slice(0, 3).map((l) => l.trim().slice(0, 170));
    } finally {
      fs.writeFileSync(abs, original, 'utf8'); // pase lo que pase, el fichero vuelve
    }
  }
  fila.restaurado = git('diff', '--quiet', '--', m.f).status === 0;
  filas.push(fila);
  console.log(`${m.id} · ${m.quita}\n     aplicada=${fila.aplicada} (ocurrencias por cambio: ${veces.join('+')}) · diff ${fila.numstat || '—'} · guard exit=${fila.exit} (intentos ${fila.intentos}) · rojo esperado visto=${fila.rojoVisto} · restaurado=${fila.restaurado} → ${fila.ciego ? 'CIEGO' : fila.cae ? 'CAE' : 'VIVA'}${(fila.rojas || []).map((l) => '\n       ' + l).join('')}`);
}
const caen = filas.filter((f) => f.cae).length;
const vivas = filas.filter((f) => !f.cae).map((f) => f.id + (f.ciego ? '(CIEGO)' : ''));
const sinRestaurar = filas.filter((f) => !f.restaurado).map((f) => f.id);
console.log(`\nPOBLACION mutaciones=${filas.length} · aplicadas=${filas.filter((f) => f.aplicada).length} · caen=${caen} · vivas=[${vivas.join(', ')}] · sin restaurar=[${sinRestaurar.join(', ')}]`);
console.log('EXIT=' + (caen === filas.length && !sinRestaurar.length ? 0 : 1));
process.exit(caen === filas.length && !sinRestaurar.length ? 0 : 1);
