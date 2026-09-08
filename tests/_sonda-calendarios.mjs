// tests/_sonda-calendarios.mjs — SCRUM-750
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// LA SONDA QUE CORRE EN OTRA ZONA HORARIA. No es un test: es el instrumento que usan los tests.
//
// 🔴 POR QUÉ UN PROCESO HIJO Y NO UNA VARIABLE. La zona del navegador entra en el cálculo a
// través de `Date`, y `Date` fija su zona al arrancar el proceso. Para probar «el empleado con el
// navegador en Auckland» hay que ARRANCAR en Auckland, y eso no se puede hacer a mitad de una
// tanda.
//
// 🔴 Y LA ZONA SE FIJA AQUÍ DENTRO, NO EN EL SHELL. Medido el 5-sep-2026 en esta máquina (Git
// Bash sobre Windows): `TZ=X node …`, `export TZ=X` y `env TZ=X` NO llegan a `process.env.TZ`.
// No dan error — devuelven la zona del sistema con otra etiqueta, así que un barrido por zonas
// imprime el MISMO número tres veces bajo tres nombres distintos y se lee como un resultado.
// Pasó en la medición que abrió este ticket, y por eso la sonda lleva su control positivo dentro:
// si `Intl` no resuelve la zona pedida, sale con estado 2 y NO publica número.
//
// USO:  node tests/_sonda-calendarios.mjs <zonaDelNavegador> <zonaDelMerchant> <modo>
//         modo `derivado` → el módulo tal y como está en el árbol
//         modo `mutado`   → con la aritmética LOCAL de antes de SCRUM-750 reinyectada, que es el
//                           control positivo: si el barrido no se pone rojo con esto, no mide.
//       Imprime una línea de JSON.
// ═════════════════════════════════════════════════════════════════════════════════════════
const [ZONA_NAVEGADOR, ZONA_MERCHANT, MODO] = process.argv.slice(2);
process.env.TZ = ZONA_NAVEGADOR;

const { default: fs } = await import('node:fs');
const { default: path } = await import('node:path');

const resuelta = Intl.DateTimeFormat().resolvedOptions().timeZone;
if (resuelta !== ZONA_NAVEGADOR) {
  console.log(JSON.stringify({ ciego: `pedi ${ZONA_NAVEGADOR}, Date resuelve ${resuelta}` }));
  process.exit(2);
}

const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (rel) => fs.readFileSync(path.join(RAIZ, rel), 'utf8');

/**
 * La aritmética de ANTES de SCRUM-750, palabra por palabra: componentes LOCALES y días de
 * calendario. Se reinyecta sustituyendo el cuerpo de la delegación, no reescribiendo el fichero.
 */
const DELEGACION = 'return cal.diaPorDefecto(merchant, dias, hoy instanceof Date ? hoy : undefined);';
const VIEJA = [
  'var base = (hoy instanceof Date && !isNaN(hoy.getTime())) ? hoy : new Date();',
  'var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);',
  'if (isNaN(d.getTime())) return null;',
  "var dc = function (n) { return (n < 10 ? '0' : '') + n; };",
  "return d.getFullYear() + '-' + dc(d.getMonth() + 1) + '-' + dc(d.getDate());",
].join('\n    ');

let fuenteAtajos = leer('public/dashboard/js/quoteAtajosVencimiento.js');
if (MODO === 'mutado') {
  if (!fuenteAtajos.includes(DELEGACION)) {
    console.log(JSON.stringify({ ciego: 'no encuentro la delegacion que hay que mutar' }));
    process.exit(2);
  }
  fuenteAtajos = fuenteAtajos.replace(DELEGACION, VIEJA);
}

const win = {};
new Function('window', leer('public/dashboard/js/quoteCaducidad.js'))(win);
new Function('window', fuenteAtajos)(win);
const A = win.QUOTE_ATAJOS_VENCIMIENTO;
const C = win.quoteCaducidad;
if (!A || !C) {
  console.log(JSON.stringify({ ciego: 'no cargo algun modulo' }));
  process.exit(2);
}

const MERCHANT = { timezone: ZONA_MERCHANT };
const INICIO = Date.UTC(2026, 0, 1);
const FIN = Date.UTC(2027, 0, 1);

// ── LOS INSTANTES · densidad CONCENTRADA, no barrido plano ────────────────────────────────
//
// La medición que abrió el ticket barrió 17.520 instantes (uno cada 30 min). Aquí eso tardaba
// 14,7 s MEDIDOS, porque el coste real son ~52.000 `Intl.format`, y un test de 15 s en una tanda
// de dos minutos acaba desactivado por alguien con prisa.
//
// Así que la densidad va donde el defecto vive: **cada 30 min alrededor de los dos cambios de
// hora** —±3 días, que es donde una aritmética de 24 h fijas y uno de calendario se separan— más
// un peine de 6 h sobre el año entero para que ninguna otra franja quede sin mirar. El SUELO no
// se afloja: se sigue exigiendo que el barrido contenga los DOS cambios de hora, y eso se CUENTA
// abajo en vez de darse por supuesto.
const instantes = [];
for (let t = INICIO; t < FIN; t += 6 * 3600 * 1000) instantes.push(t);
for (const centro of [Date.UTC(2026, 2, 29), Date.UTC(2026, 9, 25)]) {
  for (let t = centro - 3 * 86400000; t <= centro + 3 * 86400000; t += 30 * 60 * 1000) instantes.push(t);
}
instantes.sort((a, b) => a - b);
const MUESTRAS = instantes.length;

// El desplazamiento de la zona del merchant en un instante, para poder CONTAR los cambios de
// hora. 🔴 EL FORMATEADOR SE CONSTRUYE UNA VEZ: medido, crearlo dentro del bucle llevaba la sonda
// de 1,4 s a 29 s —17.520 construcciones de `Intl`— y una sonda de 29 s la acaba quitando alguien
// de la tanda, que es como un guard deja de correr sin que nadie lo decida.
const FMT_DESFASE = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_MERCHANT, timeZoneName: 'shortOffset',
});
const desfase = (t) => FMT_DESFASE.format(t).split(' ').pop();

const divergencias = {};
let cambiosDeHora = 0;
let desfaseAnterior = null;
let ejemplo = null;

for (const dias of A.DIAS_ATAJO) divergencias[dias] = 0;

for (let i = 0; i < MUESTRAS; i++) {
  const t = new Date(instantes[i]);

  const d = desfase(t);
  if (desfaseAnterior !== null && d !== desfaseAnterior) cambiosDeHora++;
  desfaseAnterior = d;

  for (const dias of A.DIAS_ATAJO) {
    const atajo = A.fechaDeAtajo(dias, MERCHANT, t);
    const defecto = C.diaPorDefecto(MERCHANT, dias, t);
    if (atajo !== defecto) {
      divergencias[dias]++;
      if (!ejemplo) ejemplo = { instante: t.toISOString(), dias, atajo, defecto };
    }
  }
}

console.log(JSON.stringify({
  navegador: resuelta, merchant: ZONA_MERCHANT, modo: MODO,
  muestras: MUESTRAS, atajos: A.DIAS_ATAJO, divergencias, cambiosDeHora, ejemplo,
}));
