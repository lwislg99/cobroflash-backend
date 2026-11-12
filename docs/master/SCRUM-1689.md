# SCRUM-1689 · FLAKY scrum1266b: el bloque ④ espera a que no quede nada en vuelo, no a un reloj

**Fecha:** 12-nov-2026 · **Carril:** A · **Gate:** sin gate
**Medido contra:** `origin/main` = `44f299d33b6c21c965954ba6bd5cd078b343886e` · 2026-11-12T18:56:58Z
A9: comprobación → `tests/scrum1266b-aviso-no-salia-en-lo-dictado.test.mjs`
**Tanda:** el fichero, 15 tests, 15 pass, 0 fail, 0 skipped
**Skill UI:** no cargada · no cambia ningún fichero de `public/`: la vista sólo se mutó en local para la aceptación 2, y se restauró con `git checkout`

Medido por S3 en el worktree `s3-1689`, `dist/` compilado con `tsc`, salida 0. Carril: el fichero de test es de S4 (SCRUM-1266);
el orquestador encargó el arreglo a S3, que es el dueño de la medición y del arnés.

## El defecto

`tests/scrum1266b-aviso-no-salia-en-lo-dictado.test.mjs`, bloque ④: el doble mete `setTimeout(15)` en cada
PATCH (`lento: true`) y los tres casos esperaban `dormir(80)` (y `dormir(20)` a que saliera la propuesta del
dictado). Con la CPU llena, 80 ms de reloj no cubren dos vueltas de 15 ms más el render, y la aserción leía el
estado A MEDIO GUARDAR.

## El arreglo (sólo en el TEST; la vista y el guard no se tocan — regla 41)

`abrir()` cuenta las peticiones EN VUELO (sube al entrar en `apiRequest`, baja en `finally`) y devuelve
`reposo()`: repite {`vaciar()`, un `setTimeout(1)`, `vaciar()`} hasta que no queda ninguna en vuelo **y** no ha
salido ninguna nueva en esa vuelta. Tope de 5 s que FALLA nombrando «COLGADO». Es correcto porque la vista no
tiene temporizadores (su contexto `vm` no lleva `setTimeout`): lo único que tarda es el PATCH del doble.
Los cuatro `dormir(…)` del bloque ④ pasan a `await reposo()`; las aserciones, intactas.

## Medida (arnés de abajo; máquina de 8 núcleos lógicos, con el resto del equipo trabajando)

| población | pasadas | rojas |
| --- | --- | --- |
| ANTES del arreglo, 32 a la vez | 96 | **89** (72× «×», 66× dictado, 59× añadir línea) |
| control del arnés: copia vieja con `dormir(80)` → `dormir(1)`, 8 a la vez | 8 | 8 de 8 |
| DESPUÉS, 32 a la vez | 96 | **0** |
| DESPUÉS, 64 a la vez | 192 | **0** |
| DESPUÉS, en calma | 1 | 0 (15 `ok` en el TAP) |
| control «sin esperar»: copia nueva con `reposo()` → `setTimeout(1)`, 8 a la vez | 8 | **8 de 8** → el arreglo no cegó el test |

El 11-nov eran 3 de 96: hoy la máquina iba mucho más cargada, y el rojo salió en casi todas.

## Aceptación 2 — el test sigue cayendo con el defecto P1-PARTE-1266 puesto (medido ANTES de darlo por bueno)

| mutación de `public/dashboard/js/parteDetailView.js` (restaurada con `git checkout` al acabar) | rojos del bloque ④ |
| --- | --- |
| sólo la cola: `var previa = Promise.resolve();` en `enOrdenDelParte` | 1 de 3 (dictado) — **igual que la BASE**: el test original da también 1 de 3 con esta mutación |
| el defecto ENTERO: la cola fuera **y** «×»/«Añadir línea» arman la lista con la última lectura (`(parte.lineas \|\| []).map(lineaQueSeGuarda)` en vez de `listaDePantalla()`) | **3 de 3**, 8 de 8 pasadas |
| la vista tal y como estaba antes del arreglo (`490040f9b^`) | **3 de 3**, con los tres mensajes «🔴 … ha devuelto la descripción de antes de corregirla» |

Hallazgo: con la mutación «sólo cola», «×» y «Añadir línea» siguen bien porque leen la PANTALLA
(`listaDePantalla()`); el dictado no, porque arma `yaHabia` desde `parte.lineas`. La mutación del plan del
11-nov («los 3 casos rojos con `previa = Promise.resolve()`») era falsa: da 1 de 3 también en la base.

## El arnés (el del 11-nov vivía en el tmp del job y se perdió; aquí queda)

```js
// Uso: node estres.mjs <fichero.test.mjs> <N> <P>   (desde la raíz del repo, con dist/ compilado)
import { spawn } from 'node:child_process';
const [fichero, N = '96', P = '32'] = process.argv.slice(2);
if (!fichero) { console.error('uso: estres.mjs <fichero> <N> <P>'); process.exit(2); }
const total = Number(N), par = Number(P);
const rojos = new Map(); let hechas = 0, conRojo = 0, sinResultado = 0, lanzadas = 0;
const una = () => new Promise((res) => {
  const h = spawn(process.execPath, ['--test', '--test-reporter=tap', fichero], { stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; h.stdout.on('data', (d) => { out += d; }); h.stderr.on('data', () => {});
  h.on('close', (codigo) => {
    // Un fichero suelto: cada caso sale como línea TAP de nivel 0.
    const malos = [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1].trim());
    const buenos = (out.match(/^ok \d+ - /gm) || []).length;
    if (buenos + malos.length === 0) sinResultado++;
    if (malos.length || codigo !== 0) conRojo++;
    for (const m of malos) rojos.set(m, (rojos.get(m) || 0) + 1);
    hechas++; res();
  });
});
const obrero = async () => { while (lanzadas < total) { lanzadas++; await una(); } };
await Promise.all(Array.from({ length: par }, obrero));
console.log(`pasadas ${hechas} · con rojo ${conRojo} · sin resultado (NO PUDE MIRAR) ${sinResultado}`);
for (const [nombre, n] of rojos) console.log(`  ${n}× ${nombre}`);
```

## Lo que NO cubre

* Otros tests del árbol que esperen con reloj de pared contra un doble lento: no los he censado. Este arreglo
  es para los tres casos del bloque ④.
* La medida es de una máquina (8 núcleos lógicos). En CI no se ha visto el rojo nunca (0 de 32 el 11-nov), así
  que «0 de 96 en CI» no se ha comprobado aparte.

Las copias mutadas del test se escribieron como `tests/_tmp1689-*.mjs` (sin `.test.`, para que ninguna tanda
las recoja) y se borraron en el mismo comando.
