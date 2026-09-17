// docs/master/evidencias/scrum665b/proyeccion-de-tamano.mjs — SCRUM-665 (el CÓMO)
//
// Proyecta el almacenamiento del camino (B) «guardar el PDF al emitir».
//
// 🔴 LA MITAD DE ESTE FICHERO SON LOS SUPUESTOS, Y VAN MARCADOS. La cifra por factura está MEDIDA
// (`coste-de-los-dos-caminos.mjs`). Todo lo que multiplica esa cifra —cuántos merchants, cuántas
// facturas al mes— **no lo sé**, y no se puede consultar: mirar las bases está prohibido en esta
// tanda. Así que se proyecta sobre escenarios NOMBRADOS, y un escenario no es una previsión.
//
// Lo único anclado en el repositorio es el HOY: `CUENTAS_DE_PRUEBA_DECLARADAS = 13`
// (`src/modules/system/domain/puertaClienteReal.ts`) y la regla del máster que dice que todas las
// cuentas de producción son de prueba. Cero clientes reales.
import fs from 'node:fs';

// ── MEDIDO (no supuesto) ────────────────────────────────────────────────────────────────────
const BYTES_TIPICA = 5209;   // 1 línea, sin logo
const BYTES_20_LINEAS = 6403;
const BYTES_DEMO = 5512;
// Se proyecta con la MAYOR de las medidas, no con la típica: un número de almacenamiento que se
// queda corto no sirve para decidir. Y se dice que es el techo de lo medido, no un máximo real.
const BYTES = BYTES_20_LINEAS;

const KiB = 1024, MiB = KiB * 1024, GiB = MiB * 1024;
const humano = (b) => b >= GiB ? (b / GiB).toFixed(2) + ' GiB'
  : b >= MiB ? (b / MiB).toFixed(1) + ' MiB'
  : b >= KiB ? (b / KiB).toFixed(1) + ' KiB' : b + ' B';

// ── SUPUESTOS · cada uno nombrado, ninguno medido ───────────────────────────────────────────
const ESCENARIOS = [
  { nombre: 'HOY (anclado, no supuesto)', merchants: 13, facturasMesPorMerchant: 0,
    nota: '13 cuentas declaradas de prueba y CERO clientes reales: la puerta de SCRUM-390 está cerrada.' },
  { nombre: 'SUPUESTO A · arranque', merchants: 10, facturasMesPorMerchant: 10,
    nota: 'diez profesionales facturando diez veces al mes.' },
  { nombre: 'SUPUESTO B · tracción', merchants: 100, facturasMesPorMerchant: 20,
    nota: 'cien profesionales, una factura cada día laborable aprox.' },
  { nombre: 'SUPUESTO C · escala', merchants: 1000, facturasMesPorMerchant: 20,
    nota: 'mil profesionales al mismo ritmo.' },
];

const salida = [];
const di = (s = '') => { salida.push(s); console.log(s); };

di('═══ LO MEDIDO (de `coste-de-los-dos-caminos.mjs`) ═══');
di('   factura típica (1 línea, sin logo) : ' + BYTES_TIPICA + ' B  = ' + humano(BYTES_TIPICA));
di('   factura de 20 líneas ..............: ' + BYTES_20_LINEAS + ' B  = ' + humano(BYTES_20_LINEAS));
di('   con marca DEMO ....................: ' + BYTES_DEMO + ' B  = ' + humano(BYTES_DEMO));
di('   → se proyecta con ' + BYTES + ' B (el techo de lo medido). SIN LOGO: un logo se embebe y');
di('     puede moverlo mucho. Ese factor NO está medido y por eso no está dentro del número.');
di('');
di('═══ LA PROYECCIÓN · un escenario no es una previsión ═══');
di('');
di('   escenario                        merchants  fac/mes    al mes      al año   a 5 años');
di('   ' + '-'.repeat(88));
for (const e of ESCENARIOS) {
  const mes = e.merchants * e.facturasMesPorMerchant;
  const bMes = mes * BYTES;
  di('   ' + e.nombre.padEnd(32)
    + String(e.merchants).padStart(9)
    + String(mes).padStart(9)
    + humano(bMes).padStart(11)
    + humano(bMes * 12).padStart(12)
    + humano(bMes * 60).padStart(11));
}
di('');
for (const e of ESCENARIOS) di('   · ' + e.nombre + ' — ' + e.nota);
di('');
di('═══ LA LECTURA ═══');
const c = ESCENARIOS[3];
di('   Incluso el escenario más grande de los tres supuestos (' + c.merchants + ' merchants) da');
di('   ' + humano(c.merchants * c.facturasMesPorMerchant * BYTES * 12) + ' AL AÑO. El almacenamiento NO es el coste que decide este ticket.');
di('   Lo que decide es DÓNDE: hoy no existe ningún almacenamiento persistente en el producto.');
di('');
di('   ⚠️ Y el número de facturas al mes es el supuesto más frágil de los tres: no hay ni un dato');
di('      real detrás. Si alguien lo mide algún día, esta tabla se rehace con una línea.');

fs.writeFileSync(new URL('./salida-proyeccion.txt', import.meta.url), salida.join('\n') + '\n');
