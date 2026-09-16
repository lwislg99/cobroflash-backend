// tests/scrum289-censo-origen-factura.test.mjs — SCRUM-289 (A0.3), incremento 1: SIN entrypoint.
//
// La factura suelta no entra por una pantalla: entra por aquí. El botón «Nueva factura» encima de
// sitios que se degradan en silencio entrega una factura que PARECE bien y no lo está, así que
// primero se censan los sitios y se pone el mecanismo que impide que aparezca uno nuevo sin mirar.
//
// El rojo NO es «crear una suelta revienta»: SCRUM-287 midió que no revienta (0 crashes ruidosos,
// `Invoice.quoteId` siempre fue nullable). El rojo de este incremento es el del MECANISMO: si
// alguien ata una población de facturas al presupuesto y no lo clasifica, esto falla — y falla
// también con la forma que estuvo a punto de escaparse (el spread).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sitiosQueAtanAlOrigen, clavesDe, CENSO, ATADURAS } from './_censo-origen-factura.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Árbol de mentira con UN fichero en src/, para ejercitar el analizador sin tocar el repo. */
function arbolConFuente(codigo) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'censo-origen-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'fixture.ts'), codigo, 'utf8');
  return dir;
}

// ── SUELO ────────────────────────────────────────────────────────────────────────────────
// Un cero de «no hay» y uno de «no supe mirar» son el mismo número y significan lo contrario.

test('SCRUM-289 · suelo: el analizador encuentra sitios de verdad en el árbol', () => {
  const sitios = sitiosQueAtanAlOrigen(RAIZ);
  assert.ok(sitios.length > 0,
    '🔴 CERO sitios en src/. El verde del guard de abajo no significaría «nadie ata la factura a ' +
    'su origen», sino «no se miró». Revisa que src/ existe y que el analizador resuelve el AST.');
});

test('SCRUM-289 · suelo: encuentra el sitio CONOCIDO que motiva el ticket (control positivo)', () => {
  // El embudo de conversión filtra con `...soloDePresupuesto`, un SPREAD. La primera versión de
  // este analizador buscaba `quoteId` dentro del `where` y daba LIMPIA justo la consulta que
  // excluye las facturas sueltas. Si este control cae, el analizador volvió a quedarse ciego
  // ante la única forma que de verdad se usa en el árbol.
  const sitios = sitiosQueAtanAlOrigen(RAIZ);
  const embudo = sitios.filter((s) => s.fichero.endsWith('metrics/domain/metrics.service.ts'));
  assert.ok(embudo.length >= 2,
    '🔴 el analizador NO ve el embudo de conversión (metrics.service.ts). Es el sitio que motiva ' +
    'A0.3 y filtra por spread: si no lo ve, no ve la forma que importa.');
  assert.ok(embudo.some((s) => s.ataduras.includes(ATADURAS.FILTRA)),
    '🔴 ve el embudo pero no lo clasifica como filtro por origen: el spread volvió a ser opaco.');
});

// ── ROJO POR EL MECANISMO ────────────────────────────────────────────────────────────────

test('SCRUM-289 · ROJO: un sitio NUEVO que ata la factura a su origen se detecta', () => {
  const dir = arbolConFuente(`
    export async function informeInventado(merchantId: number) {
      return prisma.invoice.findMany({
        where: { merchantId, status: 'paid', quoteId: { not: null } },
        select: { total: true },
      });
    }
  `);
  const sitios = sitiosQueAtanAlOrigen(dir);
  assert.equal(sitios.length, 1, '🔴 no se detecta una consulta que filtra explícitamente por quoteId');
  assert.ok(sitios[0].ataduras.includes(ATADURAS.FILTRA));
});

test('SCRUM-289 · ROJO: y también cuando el filtro entra por SPREAD (la forma que casi se escapa)', () => {
  const dir = arbolConFuente(`
    const soloDePresupuesto = { quoteId: { not: null } };
    export async function otroInforme(merchantId: number) {
      return prisma.invoice.count({ where: { merchantId, ...soloDePresupuesto } });
    }
  `);
  const sitios = sitiosQueAtanAlOrigen(dir);
  assert.equal(sitios.length, 1,
    '🔴 el filtro por spread vuelve a ser invisible. Es EXACTAMENTE como está escrito el embudo ' +
    'en metrics.service.ts, así que esta ceguera no es teórica: es la del árbol real.');
  assert.ok(sitios[0].ataduras.includes(ATADURAS.FILTRA));
});

test('SCRUM-289 · ROJO: un spread que no se puede resolver NO se da por limpio (falla cerrado)', () => {
  const dir = arbolConFuente(`
    import { filtroDeOtroModulo } from './otro';
    export async function tercero(merchantId: number) {
      return prisma.invoice.count({ where: { merchantId, ...filtroDeOtroModulo } });
    }
  `);
  const sitios = sitiosQueAtanAlOrigen(dir);
  assert.equal(sitios.length, 1, '🔴 un where que no se puede leer se dio por limpio');
  assert.ok(sitios[0].ataduras.includes(ATADURAS.OPACO),
    '🔴 debería quedar OPACO: no se puede afirmar que no ata al origen algo que no se puede leer.');
});

// ── CONTROL NEGATIVO ─────────────────────────────────────────────────────────────────────
// Un guard que salta con todo no informa de nada. Estos cambios NO deben hacerlo caer.

test('SCRUM-289 · control negativo: una consulta de facturas SIN origen no entra en el censo', () => {
  const dir = arbolConFuente(`
    export async function cobradoDelMes(merchantId: number, desde: Date) {
      return prisma.invoice.aggregate({
        where: { merchantId, status: 'paid', paidAt: { gte: desde } },
        _sum: { total: true },
      });
    }
  `);
  assert.deepEqual(sitiosQueAtanAlOrigen(dir), [],
    '🔴 el guard salta con una consulta que NO ata la factura a su presupuesto. Un guard que ' +
    'salta con todo obliga a censar todo, y un censo de todo no se lee.');
});

test('SCRUM-289 · control negativo: el analizador NO ve comentarios (la trampa del guard de texto)', () => {
  // El sitio natural donde se escribe el literal prohibido es el comentario que explica la
  // prohibición: mordió en SCRUM-176/168/3/193. Con AST el problema no se mitiga, deja de existir.
  const dir = arbolConFuente(`
    // Aquí NO se filtra por quoteId, ni por quote, y este comentario lo dice usando
    // where: { quoteId: { not: null } } como ejemplo de lo que no hay que hacer.
    export async function limpia(merchantId: number) {
      return prisma.invoice.count({ where: { merchantId } }); // sin quoteId
    }
  `);
  assert.deepEqual(sitiosQueAtanAlOrigen(dir), [],
    '🔴 el analizador está leyendo COMENTARIOS. Es la trampa de auto-referencia que hace que un ' +
    'guard de texto se cace a sí mismo en el fichero que explica la regla.');
});

test('SCRUM-289 · control negativo: otro modelo con quoteId no entra (la población está acotada)', () => {
  const dir = arbolConFuente(`
    export async function trabajosDelQuote(quoteId: number) {
      return prisma.job.findMany({ where: { quoteId }, select: { id: true } });
    }
  `);
  assert.deepEqual(sitiosQueAtanAlOrigen(dir), [],
    '🔴 el censo se ha salido de su población declarada (invoice y expense).');
});

// ── EL GUARD ─────────────────────────────────────────────────────────────────────────────

test('SCRUM-289 · todo sitio que ata una factura a su origen está CENSADO', () => {
  const sitios = sitiosQueAtanAlOrigen(RAIZ);
  const claves = clavesDe(sitios);
  const sinCensar = claves
    .map((k, i) => ({ k, s: sitios[i] }))
    .filter(({ k }) => !(k in CENSO))
    .map(({ k, s }) => `${k}  (${s.fichero}:${s.linea})  →  ${s.ataduras.join(' + ')}`);

  assert.deepEqual(sinCensar, [],
    '🔴 HAY SITIOS QUE ATAN UNA FACTURA A SU PRESUPUESTO Y NADIE LOS HA CLASIFICADO:\n    ' +
    sinCensar.join('\n    ') +
    '\n\n  Atar al origen NO está prohibido: muchas veces es correcto (un embudo de presupuestos\n' +
    '  DEBE contar solo presupuestos). Lo que no vale es que aparezca uno sin mirarlo, porque con\n' +
    '  la factura suelta (A0.3) ese sitio la excluye o la cuenta mal EN SILENCIO — y eso no se ve\n' +
    '  en un diff, porque ninguna línea está mal.\n\n' +
    '  Ya pasó: SCRUM-236 encontró `quoteId: { not: null }` en el rendimiento del equipo tirando\n' +
    '  todo el flujo de Trabajos, con las filas sin cuadrar y la pantalla callada.\n\n' +
    '  Clasifícalo en CENSO (tests/_censo-origen-factura.mjs) con su veredicto y su motivo.');
});

test('SCRUM-289 · el censo no describe sitios que ya no existen (trinquete)', () => {
  const claves = new Set(clavesDe(sitiosQueAtanAlOrigen(RAIZ)));
  const fantasmas = Object.keys(CENSO).filter((k) => !claves.has(k));
  assert.deepEqual(fantasmas, [],
    '🔴 el censo nombra sitios que ya no están en el árbol:\n    ' + fantasmas.join('\n    ') +
    '\n\n  Un censo que describe código ausente deja de medir. Si el sitio se fue, quítalo de aquí;\n' +
    '  si se movió de fichero o cambió de método, su clave cambió y hay que volver a mirarlo.');
});

test('SCRUM-289 · los HUECOS declarados siguen declarados, con su motivo', () => {
  // El ticket exige que «todos los (b) se tapan aquí, y el que se quede fuera se declara con su
  // motivo». Estos dos se declaran y NO se tapan en este incremento: son huecos PREEXISTENTES
  // (ya afectan al flujo de albaranes, que fija quoteId null) y taparlos es cambiar el modelo de
  // atribución de gastos, que no es este incremento y roza carril ajeno.
  const huecos = Object.entries(CENSO).filter(([, v]) => v.veredicto === 'HUECO');
  assert.ok(huecos.length > 0, '🔴 no queda ningún hueco declarado: ¿se taparon sin anotarlo?');
  for (const [k, v] of huecos) {
    assert.ok(v.nota && v.nota.length > 40,
      `🔴 el hueco ${k} está declarado sin motivo legible. Un hueco sin motivo es una excepción.`);
  }
});
