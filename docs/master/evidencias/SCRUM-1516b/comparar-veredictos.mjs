// SCRUM-1516b · compara dos salidas del censo de frontera por CONJUNTO de pares (veredicto, ruta), no por
// cuentas: «he perdido una y ganado otra» deja los totales iguales.
// Uso: node comparar-veredictos.mjs <salida A> <salida B>   → imprime los pares que sólo están en una.
// Sale 0 si las dos son idénticas, 1 si difieren, 2 si alguna no trae ni una ruta (CIEGO: no comparo vacíos).
import fs from 'node:fs';

/** Los pares «VEREDICTO metodo ruta» de una salida: la cabecera `== X · n` abre sección, `--` o `==` la cierra. */
export function pares(texto) {
  const fuera = new Set();
  let seccion = null;
  // `trimStart` también quita la marca de orden de bytes que deja `Out-File` en PowerShell 5.1.
  for (const linea of String(texto).trimStart().split(/\r?\n/)) {
    const cab = linea.match(/^== ([A-Z-]+) · /);
    if (cab) { seccion = cab[1]; continue; }
    if (linea.startsWith('--') || linea.startsWith('TOTALES')) { seccion = null; continue; }
    const r = seccion && linea.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/);
    if (r) fuera.add(`${seccion} ${r[1]} ${r[2]}`);
  }
  return fuera;
}

if (process.argv[1] && process.argv[1].endsWith('comparar-veredictos.mjs')) {
  const [a, b] = process.argv.slice(2).map((f) => pares(fs.readFileSync(f, 'utf8')));
  if (!a.size || !b.size) { console.log(`CIEGO: A trae ${a.size} rutas y B ${b.size}`); process.exit(2); }
  const soloA = [...a].filter((x) => !b.has(x));
  const soloB = [...b].filter((x) => !a.has(x));
  console.log(`A ${a.size} pares · B ${b.size} pares · sólo en A ${soloA.length} · sólo en B ${soloB.length}`);
  for (const x of soloA) console.log('  - ' + x);
  for (const x of soloB) console.log('  + ' + x);
  process.exit(soloA.length || soloB.length ? 1 : 0);
}
