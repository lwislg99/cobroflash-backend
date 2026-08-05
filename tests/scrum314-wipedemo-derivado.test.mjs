// SCRUM-314 (D3) · EL BARRIDO DEL DEMO SE DERIVA, NO SE ESCRIBE A MANO.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// POR QUÉ ESTO VA ANTES QUE EL BOTÓN, Y NO AL REVÉS
//
// `wipeDemo` borraba **10 de los 21 modelos con `merchantId`**. Los once que faltaban —medidos
// por derivación propia sobre `schema.prisma` y coincidentes con el delta de SCRUM-310— eran
// `authSession`, `provider`, `quoteTemplate`, `teamMember`, `legalAcceptance`, `job`,
// `maintenancePlan`, `auditLog`, `attachment`, `albaran` y `albaranLineaFacturada`.
//
// Poner encima un botón «Eliminar datos de ejemplo» habría entregado algo peor que nada: el
// usuario pulsa, se le dice que su cuenta queda limpia, y siguen ahí sus trabajos, sus albaranes,
// su equipo y su rastro de auditoría. **Un borrado que miente sobre lo que borró no se deshace
// avisando después.**
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// LO QUE SE PRUEBA AQUÍ, Y POR QUÉ ASÍ
//
// El barrido vive FUERA de `seed-demo.mjs` (hoy en `src/modules/system/domain/barridoDemo.ts`,
// compilado a `dist/`) por una razon
// medida: ese script **se ejecuta al importarlo** (tiene await de nivel superior y siembra), así
// que un test que lo importara sembraría la base. Sacada la pieza, se ejercita con un `prisma` de
// doble: sin BD, sin turno y sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { barridoDemo, PREFIJO_TELEFONO_DEMO } from '../dist/modules/system/domain/barridoDemo.js';
import { modelosConTenancy } from './scrum172-cobertura-tenancy.test.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCHEMA = fs.readFileSync(path.join(RAIZ, 'prisma', 'schema.prisma'), 'utf8');
const camel = (m) => m.charAt(0).toLowerCase() + m.slice(1);
const DEMO_ID = 1;

/** `prisma` que no toca nada y apunta cada borrado con su `where`. */
function prismaEspia({ modelos = null } = {}) {
  const borrados = [];
  const disponibles = modelos ?? [...modelosConTenancy(SCHEMA).map((d) => camel(d.modelo)),
    'event', 'reconciliation', 'botSession'];
  const p = {};
  for (const m of disponibles) {
    p[m] = { deleteMany: async ({ where }) => { borrados.push({ modelo: m, where }); return { count: 0 }; } };
  }
  p.borrados = borrados;
  return p;
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// 1 · COBERTURA · ningún modelo con merchantId se queda fuera
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-314 · el barrido cubre TODOS los modelos con merchantId, derivados del schema', async () => {
  const derivados = modelosConTenancy(SCHEMA).map((d) => camel(d.modelo));
  // SUELO: si la derivación no ve modelos, la comparación de abajo sería un verde hueco.
  assert.ok(derivados.length >= 20,
    `🔴 ESCÁNER CIEGO: la derivación ve ${derivados.length} modelos con merchantId y son 21`);

  const p = prismaEspia();
  const { modelos } = await barridoDemo(p, DEMO_ID);
  const olvidados = derivados.filter((m) => !modelos.includes(m));

  assert.deepEqual(
    olvidados, [],
    `🔴 ${olvidados.length} MODELO(S) DEL DEMO SIN BARRER: ${olvidados.join(', ')}.\n\n` +
      '  Con el botón «Eliminar datos de ejemplo» encima, eso es decirle al usuario que su cuenta\n' +
      '  quedó limpia mientras siguen ahí sus trabajos, albaranes, equipo y auditoría.',
  );
});

test('SCRUM-314 · un modelo NUEVO con merchantId pone el barrido en rojo hasta que se trate', async () => {
  // 🔑 EL TEST QUE IMPORTA. No comprueba la lista de hoy: comprueba que la lista NO PUEDE
  // quedarse corta mañana. Se simula el schema del futuro con un modelo que hoy no existe.
  const schemaConModeloNuevo = SCHEMA + `

model FacturaRecurrente {
  id         Int @id @default(autoincrement())
  merchantId Int @map("merchant_id")
}
`;
  const derivados = modelosConTenancy(schemaConModeloNuevo).map((d) => camel(d.modelo));
  assert.ok(derivados.includes('facturaRecurrente'),
    '🔴 la derivación no ve el modelo nuevo: el caso no está entrando por el mecanismo');

  const p = prismaEspia();
  const { modelos } = await barridoDemo(p, DEMO_ID);

  assert.ok(
    !modelos.includes('facturaRecurrente'),
    '🔴 el barrido dice cubrir un modelo que NO está declarado en el orden de borrado. Si lo ' +
      'cubriera por casualidad, este test dejaría de significar nada.',
  );
  // Y ésta es la garantía real: el modelo nuevo tiene que aparecer como olvidado, que es lo que
  // pone en rojo al guard de cobertura del test anterior (y al de SCRUM-192, su fuente).
  const olvidados = derivados.filter((m) => !modelos.includes(m));
  assert.deepEqual(
    olvidados, ['facturaRecurrente'],
    '🔴 un modelo nuevo con `merchantId` NO sale como olvidado. Entonces el día que alguien lo ' +
      'añada, el demo se quedaría sucio sin que nada avise — que es el estado del que venimos.',
  );
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 2 · CONTROL NEGATIVO · no se toca nada que no sea del demo
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-314 · CONTROL: ningún borrado sale sin filtro del demo', async () => {
  // Un barrido de demo que se lleva datos reales no se deshace. Este control es tan importante
  // como la cobertura: sin él, «cubrir los 21» se podría lograr borrando las tablas enteras.
  const p = prismaEspia();
  const { modelos } = await barridoDemo(p, DEMO_ID);
  assert.equal(p.borrados.length, modelos.length, '🔴 hay recorridos que no acabaron en un borrado');

  const sinFiltro = [];
  for (const { modelo, where } of p.borrados) {
    const w = JSON.stringify(where ?? null);
    const acotado =
      where?.merchantId === DEMO_ID ||                       // los 21 por merchant
      where?.charge?.merchantId === DEMO_ID ||               // los colgados de charge
      where?.phone?.startsWith === PREFIJO_TELEFONO_DEMO;    // las sesiones del bot, por teléfono
    if (!acotado) sinFiltro.push(`${modelo} → ${w}`);
  }
  assert.deepEqual(
    sinFiltro, [],
    '🔴 BORRADO SIN ACOTAR AL DEMO:\n    ' + sinFiltro.join('\n    ') +
      '\n\n  Esto se ejecuta contra la base de staging y, con el botón, contra la del usuario.\n' +
      '  Un borrado de datos de ejemplo que se lleva datos reales NO se deshace.',
  );
});

test('SCRUM-314 · CONTROL: el merchant demo SOBREVIVE al barrido', async () => {
  // La diferencia con `borrarMerchant`, y la razón de que este módulo exista: allí el merchant
  // cae el último; aquí tiene que quedar en pie, porque el seed lo rellena justo después.
  const p = prismaEspia();
  p.merchant = { deleteMany: async ({ where }) => { p.borrados.push({ modelo: 'merchant', where }); return { count: 1 }; } };
  const { modelos } = await barridoDemo(p, DEMO_ID);
  assert.ok(!modelos.includes('merchant'), '🔴 el barrido borra el merchant demo: el seed se quedaría sin cuenta que rellenar');
  assert.ok(!p.borrados.some((b) => b.modelo === 'merchant'), '🔴 se ha llamado a merchant.deleteMany');
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 3 · ORDEN Y ROBUSTEZ
// ═════════════════════════════════════════════════════════════════════════════════════════

test('SCRUM-314 · los colgados de charge caen ANTES que sus charges', async () => {
  // Su FK es RESTRICT (SCRUM-244): al revés, el borrado revienta a mitad y deja el demo en un
  // estado que nadie eligió.
  const p = prismaEspia();
  await barridoDemo(p, DEMO_ID);
  const orden = p.borrados.map((b) => b.modelo);
  for (const colgado of ['event', 'reconciliation']) {
    assert.ok(orden.indexOf(colgado) < orden.indexOf('charge'),
      `🔴 «${colgado}» se borra después de sus charges: la FK RESTRICT hace fallar el barrido`);
  }
});

test('SCRUM-314 · un modelo que este entorno no expone NO tumba el barrido, y se distingue de «0 filas»', async () => {
  // El seed corre en máquinas distintas. Que falte un delegado no puede dejar el resto sin
  // limpiar — pero tampoco puede confundirse con «no había nada»: uno es null, el otro 0.
  const p = prismaEspia();
  delete p.attachment;
  const { porModelo } = await barridoDemo(p, DEMO_ID);
  assert.equal(porModelo.attachment, null, '🔴 un modelo ausente debería quedar como null, no como 0');
  assert.equal(porModelo.customer, 0, 'y uno presente sin filas, como 0');
});

test('SCRUM-314 · seed-demo usa el barrido derivado y no una lista propia', () => {
  // Sin esto, el módulo podría estar perfecto y el script seguir borrando sus 10 de siempre.
  const src = fs.readFileSync(path.join(RAIZ, 'scripts', 'seed-demo.mjs'), 'utf8');
  // 🔴 SCRUM-381: este assert fijaba `from './_wipe-demo.mjs'` — un fichero que ESTE MISMO TICKET
  // borró al mover el barrido al dominio. Comprobaba el TEXTO del import y nunca que el destino
  // EXISTIERA, así que sostuvo el import muerto en verde durante tickets enteros: `seed-demo.mjs`
  // no podía ni arrancar, y el test decía que sí.
  //
  // Un guard que fija una ruta sin resolverla vigila la ortografía, no el cableado. Ahora apunta a
  // donde vive de verdad, y de que ESO exista se encarga el guard de SCRUM-381, que resuelve cada
  // import de cada script de la capa.
  assert.ok(
    src.includes("from '../dist/modules/system/domain/barridoDemo.js'"),
    '🔴 seed-demo no importa el barrido derivado',
  );
  assert.match(src, /barridoDemo\(/, '🔴 seed-demo no llama a barridoDemo');
  const cuerpo = src.slice(src.indexOf('async function wipeDemo'), src.indexOf('async function seed'));
  const aMano = [...cuerpo.matchAll(/prisma\.(\w+)\.deleteMany/g)].map((m) => m[1]);
  assert.deepEqual(
    aMano, [],
    `🔴 wipeDemo sigue borrando a mano: ${aMano.join(', ')}. Dos listas del mismo hecho se ` +
      'desincronizan solas — es lo que lo dejó en 10 de 21.',
  );
});


// ═════════════════════════════════════════════════════════════════════════════════════════
// EL BOTÓN · confirmación explícita, dice qué borró, y dice si falló a medias
// ═════════════════════════════════════════════════════════════════════════════════════════

const settings = fs.readFileSync(path.join(RAIZ, 'public', 'dashboard', 'js', 'settingsView.js'), 'utf8');
const appTs = fs.readFileSync(path.join(RAIZ, 'src', 'app.ts'), 'utf8');

test('SCRUM-314 · el botón NO borra directamente: cuelga del botón de confirmar', () => {
  // Es un borrado irreversible. Un aviso que no detiene nada solo cambia dónde aparece el
  // destrozo (SCRUM-260): la llamada tiene que salir del «Sí, eliminar», no del botón de la
  // tarjeta. Se comprueba por POSICIÓN, no por texto: el `fetch` va DESPUÉS del confirmar.
  const iConfirmar = settings.indexOf("'#de-si'");
  const iLlamada = settings.indexOf("/admin/datos-ejemplo/eliminar");
  assert.ok(iConfirmar !== -1, '🔴 no hay botón de confirmación en el modal');
  assert.ok(iLlamada !== -1, '🔴 el botón no llama a la ruta de borrado');
  assert.ok(iConfirmar < iLlamada,
    '🔴 el borrado NO cuelga de la confirmación: se dispararía con la primera pulsación');
});

test('SCRUM-314 · los cuatro textos son los aprobados, literales (regla 30)', () => {
  for (const texto of [
    'Eliminar datos de ejemplo',
    'Vamos a borrar los clientes, presupuestos y facturas de ejemplo. Esto no se puede deshacer.',
    'Sí, eliminar',
  ]) {
    assert.ok(settings.includes(texto), `🔴 falta el texto aprobado: «${texto}»`);
  }
  // El de después lleva las tres cifras interpoladas: se comprueba por sus trozos fijos.
  assert.match(settings, /'Listo\. Hemos eliminado ' \+/, '🔴 falta el texto de resultado aprobado');
  assert.match(settings, /' presupuestos y ' \+/);
  assert.match(settings, /' facturas de ejemplo\.'/);
});

test('SCRUM-314 · el resultado DICE las tres cifras, no un «listo» a secas', () => {
  // El usuario tiene que poder COMPROBAR que su cuenta está limpia, no creérselo.
  for (const campo of ['clientes', 'presupuestos', 'facturas']) {
    assert.match(appTs, new RegExp(`${campo}: porModelo\.`), `🔴 la ruta no devuelve ${campo}`);
    assert.ok(settings.includes(`r.${campo}`), `🔴 la interfaz no pinta ${campo}`);
  }
});

test('SCRUM-314 · si el barrido falla a medias, se DICE', () => {
  // Una cuenta medio limpia que se anuncia limpia es el fallo mudo que este ticket evita.
  assert.match(appTs, /noBarridos/, '🔴 la ruta no informa de lo que no pudo barrer');
  assert.match(appTs, /ok: noBarridos\.length === 0/, '🔴 `ok` no refleja el barrido incompleto');
  assert.ok(settings.includes('r.ok === false'), '🔴 la interfaz no mira si el barrido quedó incompleto');
  assert.ok(settings.includes('r.noBarridos'), '🔴 la interfaz no dice QUÉ quedó sin borrar');
});

test('SCRUM-314 · el botón solo existe en la cuenta demo, y el criterio NO se reimplementa', () => {
  // Medido: el registro no siembra datos de ejemplo y no hay marca por fila. Fuera del demo este
  // botón borraría datos REALES bajo un rótulo que dice «de ejemplo».
  assert.ok(settings.includes('merchant.esCuentaDemo'), '🔴 el front no consulta el veredicto del backend');
  // SIN COMENTARIOS: un guard de texto casa con el comentario que EXPLICA la prohibición, y este
  // fichero explica justo ésta. Ya mordió al escribirlo — se lee el código, no la prosa.
  const codigo = settings.replace(/^\s*\/\/.*$/gm, '');
  assert.doesNotMatch(
    codigo, /id\s*===\s*1|merchantId\s*===\s*1/,
    '🔴 la interfaz reimplementa «¿es el demo?» con un id a mano: eso es la segunda fuente de ' +
    'verdad que se desincroniza (isDemoMerchant también mira el email)',
  );
  assert.match(appTs, /isDemoMerchant\(merchant\)/, '🔴 la ruta no cierra la puerta por su lado');
});
