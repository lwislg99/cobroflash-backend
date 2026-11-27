// SCRUM-1648 · S5 · 2-nov-2026 · guard-dangerous y las barras invertidas. SOLO MIDE: importa
// `evaluar` del guard de la raíz que se le pase y lo corre contra un banco desechable.
// Uso: node mide.mjs <raíz con el guard> <directorio NUEVO para el banco>
// Al final escribe filas.json junto al banco (en su directorio padre).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [RAIZ, BANCO] = process.argv.slice(2);
const { evaluar } = await import(pathToFileURL(path.join(RAIZ, '.claude', 'hooks', 'guard-dangerous.mjs')).href);
const FALSO = path.join(BANCO, '__no-existe__');
const BASE = path.join(BANCO, 'base-no-repo'); // desde donde «arranca» la sesión: NO es un repo

// ── banco ──
// El banco lleva una JUNCTION, y un borrado recursivo la seguiría (SCRUM-429). Por eso este guion
// NO borra nada: exige un directorio que no exista y deja la limpieza a mano, en este orden:
//   [IO.Directory]::Delete("<banco>\conj\node_modules", $false)   # la junction, sin seguirla
//   Test-Path "<banco>\destino\vale.txt"                          # el destino sigue lleno
//   y sólo entonces se borra <banco>.
// SCRUM-1648b · Sin comillas, una ruta con espacios son VARIAS palabras: el banco mediría el espacio
// y no las barras (27-nov-2026: 35 MAL de 71 bajo `C:\Users\Nombre Apellido\…`, 19 en su forma 8.3).
if (/\s/.test(BANCO)) { console.log(`PARO: ${BANCO} lleva espacios; pásame una ruta sin ellos (en Windows, la forma corta 8.3)`); process.exit(3); }
if (fs.existsSync(BANCO)) { console.log(`PARO: ${BANCO} ya existe; pásame un directorio nuevo`); process.exit(3); }
const SUCIO = path.join(BANCO, 'sucio');
const LIMPIO = path.join(BANCO, 'limpio');
const CONJ = path.join(BANCO, 'conj');
for (const d of [BASE, SUCIO, LIMPIO, CONJ, path.join(BANCO, 'destino')]) fs.mkdirSync(d, { recursive: true });
const g = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8' });
for (const r of [SUCIO, LIMPIO]) {
  g(r, 'init', '-q'); g(r, 'config', 'user.email', 'b@b'); g(r, 'config', 'user.name', 'b');
  fs.writeFileSync(path.join(r, 'rastreado.txt'), 'trabajo\n');
  g(r, 'add', '.'); g(r, 'commit', '-qm', 'base');
}
fs.writeFileSync(path.join(SUCIO, 'rastreado.txt'), 'trabajo SIN COMMITEAR\n');
fs.writeFileSync(path.join(BANCO, 'destino', 'vale.txt'), 'compartido\n');
execFileSync('cmd', ['/c', 'mklink', '/J', path.join(CONJ, 'node_modules'), path.join(BANCO, 'destino')], { stdio: 'ignore' });
if (!fs.lstatSync(path.join(CONJ, 'node_modules')).isSymbolicLink()) { console.log('CIEGO: la junction no es enlace para lstat'); process.exit(3); }

const bs = (p) => p.replace(/\//g, '\\');
const fw = (p) => p.replace(/\\/g, '/');
const msys = (p) => fw(p).replace(/^([A-Za-z]):/, (_, l) => `/${l.toLowerCase()}`);
const FORMAS = {
  'D:/… (barra normal)': fw,
  'D:\\… (invertida, sin comillas)': bs,
  '"D:\\…" (invertida, comillas dobles)': (p) => `"${bs(p)}"`,
  "'D:\\…' (invertida, comillas simples)": (p) => `'${bs(p)}'`,
  '/d/… (MSYS)': msys,
};

const filas = [];
// SCRUM-1648b · CORRECCIÓN DECLARADA AL INSTRUMENTO (decisión del orquestador J, 27-nov-2026). En las
// cinco filas de Bash con `D:\…` SIN comillas el banco esperaba lo mismo que en PowerShell, y el
// propio ticket dice lo contrario: «En Bash el guard lee lo mismo que lee bash, así que ahí la `\`
// sin comillas no es un defecto del guard». bash convierte `D:\a\b` en `D:ab`, que no existe: no hay
// nada que perder ahí (→ deja), y un `cd` a esa carpeta no deja comprobar el árbol (→ BLOQUEA, que
// es el fallo CERRADO de siempre). El «debe» de esas filas es el de esa lectura.
const RECLASIFICADAS_BASH_SIN_COMILLAS = {
  'switch -c, arbol LIMPIO (legitimo)': 'BLOQUEA',
  '> rastreado (relativa tras cd)': 'deja',
  '> rastreado (absoluta, sin cd)': 'deja',
  'worktree remove con junction (absoluta)': 'deja',
  'rm -r con junction (absoluta)': 'deja',
};
const caso = (familia, debeOriginal, herramienta, forma, comando, base = BASE) => {
  const reclasificada = herramienta === 'Bash' && forma === 'D:\\… (invertida, sin comillas)' && RECLASIFICADAS_BASH_SIN_COMILLAS[familia];
  const debe = reclasificada || debeOriginal;
  const crudo = JSON.stringify({ tool_name: herramienta, tool_input: { command: comando } });
  let r;
  try { r = evaluar(crudo, FALSO, { base, sentinelDestructivo: FALSO }); } catch (e) { r = { bloqueado: 'EXCEPCION', motivo: String(e) }; }
  const visto = r.bloqueado === true ? 'BLOQUEA' : r.bloqueado === false ? 'deja' : String(r.bloqueado);
  const motivo = (reclasificada ? `[debe RECLASIFICADO en SCRUM-1648b; era ${debeOriginal}] ` : '') + (r.motivo || '').split('\n')[0].slice(0, 70);
  filas.push({ familia, herramienta, forma, debe, visto, ok: visto === debe, motivo, comando });
};

for (const herr of ['PowerShell', 'Bash']) {
  const sep = herr === 'PowerShell' ? '; ' : ' && ';
  for (const [forma, f] of Object.entries(FORMAS)) {
    // 1. Lo LEGÍTIMO: switch -c en un árbol LIMPIO no tiene nada que perder → debe dejar.
    caso('switch -c, arbol LIMPIO (legitimo)', 'deja', herr, forma, `cd ${f(LIMPIO)}${sep}git switch -c rama-nueva`);
    // 2. Lo que DEBE parar: switch -c con trabajo sin commitear.
    caso('switch -c, arbol SUCIO', 'BLOQUEA', herr, forma, `cd ${f(SUCIO)}${sep}git switch -c rama-nueva`);
    caso('reset --hard, arbol SUCIO', 'BLOQUEA', herr, forma, `cd ${f(SUCIO)}${sep}git reset --hard`);
    // 3. Truncar un rastreado, ruta relativa tras el cd y ruta absoluta sin cd.
    caso('> rastreado (relativa tras cd)', 'BLOQUEA', herr, forma, `cd ${f(SUCIO)}${sep}echo x > rastreado.txt`);
    caso('> rastreado (absoluta, sin cd)', 'BLOQUEA', herr, forma, `echo x > ${f(path.join(LIMPIO, 'rastreado.txt'))}`);
    // 4. Borrar un árbol con junction dentro.
    caso('worktree remove con junction (absoluta)', 'BLOQUEA', herr, forma, `git worktree remove ${f(CONJ)}`);
    caso('rm -r con junction (absoluta)', 'BLOQUEA', herr, forma, `rm -r ${f(CONJ)}`);
  }
}
// Control de cobertura (no de barras): PowerShell nativo.
caso('Remove-Item -Recurse con junction', 'BLOQUEA', 'PowerShell', 'D:/…', `Remove-Item -Recurse -Force ${fw(CONJ)}`);
// Caso 72 (SCRUM-1648b; el quinto hueco, SCRUM-1648 c.21339): `Set-Location X` cuenta como `cd`.
// La sesión «arranca» en el repo LIMPIO: si el guard mira ahí y no en X, dice «nada que perder».
caso('Set-Location SUCIO + reset --hard (sesion en el LIMPIO)', 'BLOQUEA', 'PowerShell', 'D:/…', `Set-Location ${fw(SUCIO)}; git reset --hard`, LIMPIO);

// Control de que el banco NO se ha tocado (el guard sólo pregunta).
const intacto = fs.readFileSync(path.join(SUCIO, 'rastreado.txt'), 'utf8') === 'trabajo SIN COMMITEAR\n'
  && fs.existsSync(path.join(BANCO, 'destino', 'vale.txt'));

console.log(`POBLACION\tcasos=${filas.length}\tguard=${path.join(RAIZ, '.claude/hooks/guard-dangerous.mjs')}\tbanco_intacto=${intacto}`);
console.log('ok\therramienta\tforma\tfamilia\tdebe\tvisto\tmotivo');
for (const r of filas) console.log(`${r.ok ? 'ok ' : 'MAL'}\t${r.herramienta}\t${r.forma}\t${r.familia}\t${r.debe}\t${r.visto}\t${r.motivo}`);
const mal = filas.filter((r) => !r.ok);
console.log(`RECUENTO\tcasos=${filas.length}\tbien=${filas.length - mal.length}\tmal=${mal.length}`);
fs.writeFileSync(path.join(path.dirname(BANCO), 'filas.json'), JSON.stringify(filas, null, 1));
