// docs/master/evidencias/SCRUM-1396/antes-y-despues.mjs — SCRUM-1396
//
// El MISMO árbol, clasificado por los DOS censos: el de antes (`censo-por-nombre-c92d8182.mjs`, la
// copia literal de `scripts/_censo-mkdtemp.mjs` en c92d8182, que empareja por nombre) y el de
// ahora (el de `scripts/`, que empareja por variable). Compara CONJUNTOS, llamada a llamada, no
// cuentas: un total igual dejaría pasar «he perdido una y he ganado otra».
//
// No escribe nada. Uso:  node docs/master/evidencias/SCRUM-1396/antes-y-despues.mjs [raíz]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { censar as censarAntes } from './censo-por-nombre-c92d8182.mjs';
import { censar as censarAhora, lineaDePoblacion } from '../../../../scripts/_censo-mkdtemp.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(process.argv[2] || path.join(AQUI, '..', '..', '..', '..'));

const t0 = Date.now();
const antes = censarAntes(RAIZ);
const t1 = Date.now();
const ahora = censarAhora(RAIZ);
const t2 = Date.now();

const clave = (l) => `${l.fichero}:${l.linea}`;
const deAntes = new Map(antes.llamadas.map((l) => [clave(l), l]));
const deAhora = new Map(ahora.llamadas.map((l) => [clave(l), l]));
const soloAntes = [...deAntes.keys()].filter((k) => !deAhora.has(k));
const soloAhora = [...deAhora.keys()].filter((k) => !deAntes.has(k));
const cambian = [...deAhora.values()].filter((l) => deAntes.has(clave(l)) && deAntes.get(clave(l)).categoria !== l.categoria);
const CATS = ['GARANTIZADA', 'NO_GARANTIZADA', 'SIN_LIMPIEZA', 'ESCAPA', 'FABRICA'];
const cuenta = (c) => CATS.map((k) => `${k} ${c[k].length}`).join(' · ');

console.log('ANTES Y DESPUÉS · el mismo árbol por los dos censos');
console.log(`  ficheros mirados ...... antes ${antes.ficheros} · ahora ${ahora.ficheros}`);
console.log(`  llamadas .............. antes ${antes.llamadas.length} · ahora ${ahora.llamadas.length} · sólo en antes ${soloAntes.length} · sólo en ahora ${soloAhora.length}`);
console.log(`  nuestras, por nombre .. ${cuenta(antes)}`);
console.log(`  nuestras, por variable  ${cuenta(ahora)}`);
console.log(`  tiempo ................ antes ${t1 - t0} ms · ahora ${t2 - t1} ms`);
console.log('');
console.log(`CAMBIAN DE CATEGORÍA: ${cambian.length} de ${ahora.llamadas.length}`);
for (const l of cambian) {
  console.log(`  ${clave(l)} · ${l.destino} · ${deAntes.get(clave(l)).categoria} → ${l.categoria}`
    + ` · borrados que ya no se le atribuyen: [${l.borradoAjenoEn.join(', ')}] · los que sí: [${l.borradoEn.join(', ')}]`
    + (l.ajeno ? ' · AJENA' : ''));
}
const porNombre = ahora.nuestras.filter((l) => l.enlace === 'nombre');
console.log('');
console.log(`SIGUEN EMPAREJADAS POR NOMBRE (no hay variable que enlazar): ${porNombre.length} de ${ahora.nuestras.length}`);
for (const l of porNombre) console.log(`  ${clave(l)} · ${l.destino} · ${l.categoria}`);
console.log('');
console.log('LA LÍNEA DEL CENSO');
console.log('  ' + lineaDePoblacion(ahora));
