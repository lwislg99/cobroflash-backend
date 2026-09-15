// docs/master/evidencias/scrum860/control-columna-nueva.mjs — SCRUM-860 ③
//
// ═════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE: se añade una columna al modelo EN MEMORIA y se comprueba que HOY sale
// sola por una lectura clasificada «hacia fuera». Ejecutado, no razonado.
//
// ── POR QUÉ EL DOBLE RESPETA `select`, y sin eso esto no probaría nada ───────────────────────
// Un doble que devolviera siempre la fila entera sacaría la columna nueva por TODAS las lecturas,
// tuvieran `select` o no, y el control sería CIRCULAR: demostraría lo que el doble hace, no lo que
// el código decide. Así que el doble imita la semántica real de Prisma:
//
//     con `select` → devuelve SÓLO las claves pedidas
//     sin `select` → devuelve la fila ENTERA, incluida la columna nueva
//
// Con eso, el control discrimina: la lectura sin `select` publica la columna nueva y la que sí lo
// tiene no la publica. Si las dos la publicaran, el doble estaría mintiendo y se vería aquí.
//
// ── Y SE COMPRUEBA QUE LA MUTACIÓN ENTRÓ ─────────────────────────────────────────────────────
// 🔒 Una mutación que no entra y una cobertura que no existe dan la misma salida. Medido hoy en
// SCRUM-844: un `split/join` que casó cero veces dejó el fichero intacto y el test pasó en verde,
// y por poco declaro NO CUBIERTO el punto más grave del ticket. Así que antes de leer el veredicto
// se afirma que la fila doblada LLEVA la columna nueva.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const RAIZ = path.resolve(import.meta.dirname, '..', '..', '..', '..');
const req = createRequire(path.join(RAIZ, 'package.json'));

/** La columna que «alguien añade mañana al modelo». Nadie la nombra en ninguna parte del código. */
const COLUMNA_NUEVA = 'margenObjetivoInterno';

const FILA = {
  id: 1, merchantId: 42, name: 'Bombín', nameSearch: 'bombin', description: null,
  price: '30.00', cost: '12.00', vat: 21, providerId: null, isActive: true,
  itemKind: 'product', createdAt: new Date(0), updatedAt: new Date(0),
  [COLUMNA_NUEVA]: 'NO DEBERÍA SALIR SOLA',
};

/** Doble con la semántica de Prisma respecto a `select`. */
function dobleDeLaBase() {
  const aplicarSelect = (fila, select) => {
    if (!select) return { ...fila };                       // sin select → la fila ENTERA
    const out = {};
    for (const [k, v] of Object.entries(select)) if (v === true) out[k] = fila[k];
    return out;
  };
  const modelo = () => new Proxy({}, {
    get: (_t, m) => async (args = {}) => {
      const uno = aplicarSelect(FILA, args.select);
      return String(m) === 'findMany' ? [uno] : uno;
    },
  });
  const cache = new Map();
  return new Proxy({}, {
    get: (_t, p) => {
      const n = String(p);
      if (n.startsWith('$')) return async () => undefined;
      if (!cache.has(n)) cache.set(n, modelo());
      return cache.get(n);
    },
  });
}

const rp = req.resolve('./dist/core/db/prisma.js');
req.cache[rp] = { id: rp, filename: rp, loaded: true, exports: { prisma: dobleDeLaBase() } };
const svc = req('./dist/modules/products/domain/products.service.js');

console.log('SCRUM-860 ③ · controles');
console.log('='.repeat(94));

// ── 🔴 SUELO DEL PROPIO CONTROL: la mutación tiene que haber ENTRADO ─────────────────────────
assert.ok(Object.hasOwn(FILA, COLUMNA_NUEVA),
  '🔴 la fila doblada NO lleva la columna nueva: el control mediría sobre un modelo sin mutar y su '
  + 'verde no significaría nada.');
console.log(`🔴 SUELO · la mutación entró: la fila doblada lleva \`${COLUMNA_NUEVA}\``);

// ── 🔴 EL QUE DECIDE ────────────────────────────────────────────────────────────────────────
const lista = await svc.listProducts(42);
const salioSola = Object.hasOwn(lista[0], COLUMNA_NUEVA);
console.log('');
console.log('🔴 EL QUE DECIDE · `listProducts` (clasificada HACIA FUERA, sin `select`)');
console.log(`   claves servidas: ${Object.keys(lista[0]).length}`);
console.log(`   ¿sale \`${COLUMNA_NUEVA}\` sin que nadie la nombre?  ${salioSola ? '🔴 SÍ' : '✅ no'}`);
assert.equal(salioSola, true,
  '🔴 la columna nueva NO sale. Entonces `listProducts` no publica el modelo entero y la '
  + 'clasificación «hacia fuera / sin select» está mal — y con ella el resto.');

// ── ✅ EL CONTRASTE que impide que esto sea circular ─────────────────────────────────────────
const csv = await svc.exportProductsCsv(42);
const csvSacaLaColumna = String(csv).includes(String(FILA[COLUMNA_NUEVA]));
console.log('');
console.log('✅ CONTRASTE · `exportProductsCsv` (CON `select`, mismo doble, misma columna nueva)');
console.log(`   ¿saca la columna nueva?  ${csvSacaLaColumna ? '🔴 SÍ (el doble miente)' : '✅ no'}`);
assert.equal(csvSacaLaColumna, false,
  '🔴 la lectura CON `select` también publica la columna nueva: el doble no respeta `select` y '
  + 'este control es circular — no prueba nada del código.');

// ── ✅ CONTROL NEGATIVO · el que evita romper el producto ────────────────────────────────────
console.log('');
console.log('✅ NEGATIVO · `listProducts` SIGUE sirviendo `cost` (decisión del fundador, SCRUM-609)');
assert.ok(Object.hasOwn(lista[0], 'cost'),
  '🔴 `listProducts` ha dejado de servir `cost`. Es decisión del fundador y cerrarla rompería el '
  + 'producto por el lado bueno.');
console.log(`   cost = ${lista[0].cost}  ✅`);
console.log('');
console.log('🔒 «HACIA FUERA» ES UNA CLASIFICACIÓN, NO UN VEREDICTO DE DEFECTO. Que `listProducts`');
console.log('   sirva `cost` está DECIDIDO y es correcto. Lo que esta tanda mide es otra cosa: que');
console.log('   la columna de MAÑANA sale sola, sin pasar por ninguna decisión.');
