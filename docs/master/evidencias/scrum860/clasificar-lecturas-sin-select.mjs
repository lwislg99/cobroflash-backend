// docs/master/evidencias/scrum860/clasificar-lecturas-sin-select.mjs — SCRUM-860 ①②
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 ESTO YA NO LLEVA CRITERIO DENTRO: LO IMPORTA.
//
// En la fase a este fichero tenía el análisis completo. En la fase b el trinquete
// (`tests/scrum860-trinquete-del-select.test.mjs`) necesita el MISMO criterio, y dos copias del
// mismo criterio es exactamente cómo nacen dos censos del mismo árbol que un día dejan de coincidir
// —y el que diverge en silencio es el que miente—. Así que el criterio vive en UN sitio:
//
//     scripts/_lecturas-sin-select.mjs
//
// y esto es sólo el informe legible: el que se guarda como evidencia y el que se lee para decidir.
// Si cambia el criterio, cambia para el guard y para este informe a la vez.
//
// ⛔ Informa. No arregla nada, no toca `src/`, no escribe guard.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { R, RESUMEN, motivosParaNoFiarse, expuestas } from '../../../../scripts/_lecturas-sin-select.mjs';

const r = RESUMEN();

console.log('SCRUM-860 ① · clasificación de las lecturas SIN `select` de primer nivel');
console.log('='.repeat(94));
console.log(`lecturas de Prisma en src/ : ${r.totalLecturas}  (con select ${r.conSelect} · sin select ${r.sinSelect})`);

const ciego = motivosParaNoFiarse();
if (ciego.length) { console.log('\n🔴 CIEGO: ' + ciego.join(' · ')); process.exit(3); }

const tot = r.haciaFuera + r.interna + r.noClasificado;
console.log('');
console.log('🔴 HACIA FUERA (se serializan a una respuesta) : ' + String(r.haciaFuera).padStart(3) + '   ← EL NÚMERO QUE DECIDE');
console.log('   INTERNA   (no salen por la API)             : ' + String(r.interna).padStart(3));
console.log('⚠️  NO CLASIFICADO (no lo sé — NO es sano)      : ' + String(r.noClasificado).padStart(3));
console.log('   ' + '-'.repeat(48));
console.log('   suma                                        : ' + String(tot).padStart(3) + (tot === r.sinSelect ? '  ✅ cuadra con el censo' : '  🔴 NO CUADRA'));
console.log('');
console.log('🔒 EL SUELO DEL TRINQUETE = hacia fuera + no clasificado = ' + expuestas().length);
console.log('   NO CLASIFICADO cae del lado MALO: si el suelo se derivara sólo de las que se');
console.log('   serializan, las que nadie ha sabido seguir quedarían fuera de la red sin que nadie');
console.log('   lo hubiera decidido — el defecto de este ticket una capa más arriba.');

const porModelo = (lista) => {
  const m = new Map();
  for (const x of lista) m.set(x.modelo, (m.get(x.modelo) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};

console.log('\n🔴 HACIA FUERA · por modelo');
for (const [m, n] of porModelo(R.HACIA_FUERA)) console.log(`   ${String(n).padStart(3)}  ${m}`);

console.log('\n🔴 HACIA FUERA · la lista, con fichero y línea');
for (const x of [...R.HACIA_FUERA].sort((a, b) => a.fichero.localeCompare(b.fichero) || a.linea - b.linea)) {
  console.log(`   ${x.fichero}:${x.linea}  ${x.modelo}.${x.metodo}${x.tieneInclude ? ' +include' : ''}  [${x.via}]  ${x.fn || ''}`);
}

console.log('\n⚠️ NO CLASIFICADO · por qué (y NO son sanos)');
const porMotivo = new Map();
for (const x of R.NO_CLASIFICADO) porMotivo.set(x.motivo, (porMotivo.get(x.motivo) || 0) + 1);
for (const [m, n] of [...porMotivo.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${m}`);

console.log('\n   INTERNA · por vía');
const porVia = new Map();
for (const x of R.INTERNA) porVia.set(x.via || 'no devuelve ni serializa', (porVia.get(x.via || 'no devuelve ni serializa') || 0) + 1);
for (const [v, n] of [...porVia.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}  ${v}`);
