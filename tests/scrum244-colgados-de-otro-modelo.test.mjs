// SCRUM-244 · UN MODELO SIN `merchantId` TAMBIÉN GUARDA DATOS PERSONALES.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// EL HUECO, y por qué el guard de SCRUM-192 no podía verlo
//
// El guard de cobertura de SCRUM-192 deriva del schema **los modelos con columna `merchantId`**
// y exige que cada uno esté en el orden de borrado o declarado fuera. Es el guard correcto para
// lo que mira. Pero hay modelos que pertenecen a un merchant **sin tener esa columna**: cuelgan
// de otro modelo que sí la tiene. Para ese guard **no existen**, y su verde no dice nada de
// ellos: los tres modelos sin `merchantId` del schema (`Merchant`, `Event`, `Reconciliation`)
// pasan por debajo del radar por construcción.
//
// `Event` estaba tratado a mano y bien. `Reconciliation` NO — mismo padre (`Charge`), mismo
// caso, y nadie lo vio porque el único sitio donde estos modelos existen es la lista escrita a
// mano, y una lista a mano no avisa de lo que le falta.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ OLVIDARLO ERA PEOR QUE NO BORRAR, que es lo que convierte esto en defecto y no en
// pulido: `Reconciliation.charge` declara `@relation` **sin `onDelete`** → la FK es RESTRICT.
// Al llegar a los charges, ese `deleteMany` **falla**… con ocho tablas ya borradas. El servicio
// devuelve `ok:false` (para eso devuelve en vez de lanzar), pero el merchant queda a medias:
// media identidad borrada y la otra media viva. Un borrado parcial de datos personales es peor
// que ninguno, porque creerías haber cumplido — lo dice la cabecera del propio servicio.
//
// LA REGLA QUE ESTE FICHERO IMPONE: un modelo que cuelga de otro con `merchantId` está en el
// borrado o declarado fuera CON SU MOTIVO. Se deriva del schema, así que el siguiente que
// aparezca sale en rojo el día que se declare, no el día que alguien pida su baja.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { modelosConTenancy } from './scrum172-cobertura-tenancy.test.mjs';
import {
  ORDEN_BORRADO_MERCHANT,
  FUERA_DEL_BARRIDO_GENERICO,
  COLGADOS_DE_CHARGE,
  borrarMerchant,
} from '../dist/modules/system/domain/borradoMerchant.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
const camel = (m) => m.charAt(0).toLowerCase() + m.slice(1);

/** Los dos que hay hoy. Sirve de SUELO: si la derivación devuelve menos, es que dejó de mirar. */
const SUELO_COLGADOS = 2;

/**
 * Modelos que NO tienen `merchantId` pero apuntan con `@relation` a uno que sí lo tiene.
 * Es decir: pertenecen a un merchant por herencia, no por columna. `Merchant` queda fuera
 * porque es la raíz, no un colgado.
 */
export function modelosColgadosDeOtro(schema) {
  const conTenancy = new Set(modelosConTenancy(schema).map((d) => d.modelo));
  const bloques = [...schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)];

  return bloques
    .filter(([, modelo]) => modelo !== 'Merchant' && !conTenancy.has(modelo))
    .map(([, modelo, cuerpo]) => ({
      modelo,
      // `campo Tipo @relation(fields: […])` — el lado que LLEVA la clave foránea, que es el
      // que se queda huérfano (o bloquea el borrado) si nadie lo barre.
      padres: [...new Set([...cuerpo.matchAll(/^\s+\w+\s+(\w+)\s+@relation\(fields:/gm)]
        .map((m) => m[1])
        .filter((p) => conTenancy.has(p)))],
    }))
    .filter((d) => d.padres.length > 0);
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL GUARD · ninguno se queda fuera en silencio
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-244 · la derivación SIGUE ENCONTRANDO modelos colgados (suelo)', () => {
  // Sin esto, cualquier cambio de formato del schema convertiría el guard en un verde hueco:
  // cero colgados encontrados es indistinguible de «no he sabido mirar».
  const colgados = modelosColgadosDeOtro(SCHEMA);
  assert.ok(
    colgados.length >= SUELO_COLGADOS,
    `🔴 la derivación solo ve ${colgados.length} modelo(s) colgados y conocemos ${SUELO_COLGADOS} ` +
      `(event, reconciliation). El guard de abajo estaría pasando sin mirar nada.`,
  );
});

test('SCRUM-244 · todo modelo colgado de otro está en el borrado o declarado fuera', () => {
  const colgados = modelosColgadosDeOtro(SCHEMA);
  const cubiertos = new Set([
    ...ORDEN_BORRADO_MERCHANT,
    ...Object.keys(FUERA_DEL_BARRIDO_GENERICO),
    ...Object.keys(COLGADOS_DE_CHARGE),
  ]);

  const olvidados = colgados.filter((d) => !cubiertos.has(camel(d.modelo)));
  assert.deepEqual(
    olvidados.map((d) => `${camel(d.modelo)} (cuelga de ${d.padres.join(', ')})`),
    [],
    `🔴 hay modelo(s) que pertenecen a un merchant SIN columna \`merchantId\` y que nadie borra. ` +
      `El guard de SCRUM-192 no puede verlos: deriva por columna, y estos cuelgan de un padre. ` +
      `Y no fallan callando: su \`@relation\` no lleva \`onDelete\`, así que la FK es RESTRICT y ` +
      `revientan el borrado DEL PADRE a mitad de recorrido, con las tablas anteriores ya vacías.`,
  );
});

test('SCRUM-244 · cada colgado trae su motivo por escrito, como las exclusiones', () => {
  for (const [modelo, motivo] of Object.entries(COLGADOS_DE_CHARGE)) {
    assert.ok(
      typeof motivo === 'string' && motivo.length > 20,
      `🔴 «${modelo}» se borra a mano sin explicar de qué cuelga. Aquí el porqué no es adorno: ` +
        `es lo único que dice al siguiente DÓNDE va en la secuencia.`,
    );
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL SERVICIO · el orden importa, porque la FK es RESTRICT
// ═════════════════════════════════════════════════════════════════════════════════════════

/** Un `prisma` de mentira que apunta lo que se le pide y no toca nada. */
function prismaFalso() {
  const llamadas = [];
  const modelo = (nombre) => ({
    deleteMany: async (args) => {
      llamadas.push({ modelo: nombre, where: args?.where });
      return { count: 0 };
    },
  });
  return new Proxy({ llamadas }, {
    get: (t, k) => (k === 'llamadas' ? t.llamadas : modelo(String(k))),
  });
}

test('SCRUM-244 · reconciliation se borra, y ANTES que sus charges', async () => {
  const p = prismaFalso();
  await borrarMerchant(p, 7, { telefonosBot: ['34000000001'] });
  const orden = p.llamadas.map((l) => l.modelo);

  assert.ok(
    orden.includes('reconciliation'),
    '🔴 NADIE BORRA `reconciliation`. Guarda la conciliación bancaria de los cobros de este ' +
      'merchant: es su rastro de dinero, y se quedaría en la base después de darle de baja.',
  );
  assert.ok(
    orden.indexOf('reconciliation') < orden.indexOf('charge'),
    '🔴 se borra DESPUÉS de los charges. Como la FK es RESTRICT, ese orden no deja filas ' +
      'huérfanas: hace fallar el borrado de charges con ocho tablas ya vacías.',
  );
});

test('SCRUM-244 · el filtro de un colgado viaja por su padre, no por un merchantId que no tiene', async () => {
  const p = prismaFalso();
  await borrarMerchant(p, 7, { telefonosBot: ['34000000001'] });

  for (const modelo of Object.keys(COLGADOS_DE_CHARGE)) {
    const llamada = p.llamadas.find((l) => l.modelo === modelo);
    assert.deepEqual(
      llamada?.where,
      { charge: { merchantId: 7 } },
      `🔴 «${modelo}» se filtra por una columna que no existe en él. Un \`where\` sobre un campo ` +
        `ausente no borra de menos: revienta en caliente y aborta la limpieza a mitad.`,
    );
  }
});

test('SCRUM-244 · un charge de OTRO merchant no se lleva por delante su conciliación', async () => {
  // El filtro tiene que seguir siendo del merchant que se borra. Sin este control, «borrar por
  // el padre» podría degenerar en «borrar todo» y nadie lo notaría: el test anterior seguiría
  // en verde mientras el `where` fuese `{}`.
  const p = prismaFalso();
  await borrarMerchant(p, 7, { telefonosBot: ['34000000001'] });

  for (const l of p.llamadas) {
    assert.notDeepEqual(l.where, {}, `🔴 «${l.modelo}» se borra SIN filtro: eso vacía la tabla entera`);
    assert.notDeepEqual(l.where, undefined, `🔴 «${l.modelo}» se borra sin \`where\``);
  }
});
