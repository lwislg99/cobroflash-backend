// SCRUM-111 — el canario de tenancy del ZIP no podía detectar una fuga.
//
// PURO Y SIN GATE: se construye un ZIP con una fuga DENTRO y se comprueba, sobre datos
// reales y no sobre el código, que el método viejo no la ve y el nuevo sí.
//
// Es SUITE_REGRESION.md «*Pruébalo en rojo, modo por modo, y déjalo escrito en el commit*» aplicada al arreglo, no solo al test original: **un arreglo
// que no has visto fallar tiene el mismo problema que el test que arregla.** Aquí el
// "rojo" está escrito como assert: si alguien revirtiera la descompresión, el caso
// «el método CRUDO no detecta la fuga» seguiría pasando y el «el método NUEVO sí» caería.
import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { ZipArchive } from 'archiver';

const CANARIO = 'VECINO-NO-DEBE-SALIR-1234567890';
const PROPIO = 'Cliente Propio S111';

/** Misma función que usa scrum25-export-zip (SCRUM-111). Duplicada aquí a propósito:
 *  este test valida EL MÉTODO, así que no debe depender del fichero que lo usa. */
function contenidoEntradasZip(buf) {
  const out = {};
  const SIG_CD = 0x02014b50;
  for (let i = 0; i + 46 <= buf.length; i++) {
    if (buf.readUInt32LE(i) !== SIG_CD) continue;
    const metodo    = buf.readUInt16LE(i + 10);
    const compSize  = buf.readUInt32LE(i + 20);
    const nameLen   = buf.readUInt16LE(i + 28);
    const extraLen  = buf.readUInt16LE(i + 30);
    const cmtLen    = buf.readUInt16LE(i + 32);
    const lho       = buf.readUInt32LE(i + 42);
    const nombre    = buf.toString('utf8', i + 46, i + 46 + nameLen);
    const lNameLen  = buf.readUInt16LE(lho + 26);
    const lExtraLen = buf.readUInt16LE(lho + 28);
    const ini = lho + 30 + lNameLen + lExtraLen;
    const datos = buf.subarray(ini, ini + compSize);
    try {
      out[nombre] = metodo === 0 ? datos.toString('utf8') : zlib.inflateRawSync(datos).toString('utf8');
    } catch { out[nombre] = ''; }
    i += 45 + nameLen + extraLen + cmtLen;
  }
  return out;
}

/** Un ZIP como el del paquete real: mismas opciones de compresión que exports.routes. */
async function zipConFuga() {
  const a = new ZipArchive({ zlib: { level: 9 } });
  const trozos = [];
  a.on('data', (c) => trozos.push(c));
  const fin = new Promise((r) => a.on('end', r));
  a.append(`Nombre;Teléfono\n${PROPIO};34600000001\n${CANARIO};34699999999\n`, { name: 'csv/clientes.csv' });
  a.append('Paquete de datos de QA', { name: 'LEEME.txt' });
  await a.finalize();
  await fin;
  return Buffer.concat(trozos);
}

test('SCRUM-111: el método VIEJO (bytes crudos) NO detecta una fuga real', async () => {
  const buf = await zipConFuga();

  // Esto es exactamente lo que hacía el assert original: buscar en el ZIP sin descomprimir.
  assert.equal(
    buf.includes(CANARIO), false,
    'Si esto pasa a ser true, el ZIP ha dejado de comprimirse y este test ya no describe\n' +
    'el fallo original — revisa por qué antes de tocar nada.',
  );

  // La conclusión, escrita como assert para que no se pierda: con la fuga DENTRO, el
  // canario viejo daba verde. Nunca pudo fallar; no se rompió con el tiempo, nació roto.
  assert.ok(!buf.includes(CANARIO),
    'el canario viejo daba por bueno un paquete con datos de otro merchant dentro');
});

test('SCRUM-111: el método NUEVO (descomprimiendo) SÍ detecta la fuga', async () => {
  const buf = await zipConFuga();
  const texto = Object.values(contenidoEntradasZip(buf)).join('\n');

  assert.ok(texto.includes(CANARIO),
    'con la fuga dentro, el canario nuevo TIENE que verla — si no, el arreglo no sirve');
});

test('SCRUM-111: y sigue viendo el dato PROPIO (la guarda no es vacía)', async () => {
  const buf = await zipConFuga();
  const entradas = contenidoEntradasZip(buf);

  // La guarda de `assertAusenteConMecanismoVivo` se apoya en esto: si los nombres de
  // cliente dejaran de salir, el canario no podría detectar nada y hay que enterarse.
  assert.ok(Object.values(entradas).join('\n').includes(PROPIO),
    'el testigo propio debe aparecer: es lo que demuestra que el mecanismo sigue vivo');
  assert.ok(entradas['csv/clientes.csv'], 'se extrae la entrada por su nombre');
  assert.ok(entradas['LEEME.txt'].includes('Paquete de datos'), 'y también las demás entradas');
});

test('SCRUM-111: un ZIP SIN fuga no da falso positivo', async () => {
  const a = new ZipArchive({ zlib: { level: 9 } });
  const trozos = [];
  a.on('data', (c) => trozos.push(c));
  const fin = new Promise((r) => a.on('end', r));
  a.append(`Nombre;Teléfono\n${PROPIO};34600000001\n`, { name: 'csv/clientes.csv' });
  await a.finalize();
  await fin;

  const texto = Object.values(contenidoEntradasZip(Buffer.concat(trozos))).join('\n');
  assert.ok(!texto.includes(CANARIO), 'sin fuga no debe detectarse ninguna');
  assert.ok(texto.includes(PROPIO), 'pero el dato propio sigue ahí');
});
