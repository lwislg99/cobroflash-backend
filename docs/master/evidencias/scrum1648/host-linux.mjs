// docs/master/evidencias/scrum1648/host-linux.mjs — SCRUM-1648b, relevo del CI (jv-j6gn, 27-nov-2026)
//
// Precarga que hace que `path.win32.resolve` se comporte en Windows como en el CI (`ubuntu-latest`).
// Una ruta RELATIVA A UNA UNIDAD (`Z:xrepo`, que es lo que bash deja de `Z:\x\repo`) se completa con
// la carpeta actual de esa unidad: `process.env['=Z:']` o, si falta, `process.cwd()`. En Windows ese
// cwd empieza por `C:\` y node lo descarta por ser de otra unidad (sale `Z:\xrepo`); en Linux empieza
// por `/` y node lo usa ENTERO (sale `Z:\home\runner\work\…\xrepo`). Eso es lo que tumbó los casos
// (a) control y (d) del test en el run 46000711974.
//
// Uso (sólo el grupo determinista: el ② y el ③ crean repos y rutas de la máquina de verdad):
//   node --import ./docs/master/evidencias/scrum1648/host-linux.mjs \
//        --test-name-pattern="cualquier host|\(a\) control" \
//        tests/scrum1648b-guard-dangerous-powershell-y-cwd.test.mjs
// Control positivo: imprime a stderr lo que resuelve con la precarga puesta; si no sale
// `Z:\home\runner\…`, la precarga no simula nada y el verde de detrás no vale.
import path from 'node:path';

const CWD_DEL_RUNNER = '/home/runner/work/cobroflash-backend/cobroflash-backend';
process.cwd = () => CWD_DEL_RUNNER;
delete process.env['=Z:'];
process.stderr.write(`host-linux.mjs · path.win32.resolve('Q:/base', 'Z:xrepo') = ${path.win32.resolve('Q:/base', 'Z:xrepo')}\n`);
