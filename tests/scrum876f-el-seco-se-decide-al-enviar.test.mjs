// tests/scrum876f-el-seco-se-decide-al-enviar.test.mjs — SCRUM-876f (sin base, sin red)
//
// `a55-window-quote` ganó un segundo destino (el banco de `LIBRO_PG_URL`), y en ese destino ES EL
// PROPIO FICHERO quien se pone `WHATSAPP_DRY_RUN=1`: la tanda de CI no la trae. Eso sólo protege
// si se cumplen dos cosas, y aquí se fijan las dos sin tocar ninguna base:
//
//   1) EL SENDER LEE LA BANDERA AL ENVIAR, NO AL CARGARSE. Si la leyera al importarse, un fichero
//      que la pone después de que otro haya cargado el sender creería ir en seco y no iría. Hoy
//      es `const isDryRun = () => process.env.WHATSAPP_DRY_RUN === '1'` (`whatsapp.ts`): una
//      función, llamada en cada envío. Se prueba cargando el sender con la bandera AUSENTE y
//      poniéndola y quitándola después.
//   2) EL CORTE DE SALIDA (`_sin-salida.mjs`) VE lo que dice ver —un POST de axios y un fetch— y
//      deja pasar lo de esta máquina. Es lo que decide en `a55`: la bandera es lo que creemos; que
//      no se abra un socket hacia fuera es lo que pasa.
//
// ⚠️ Este fichero corre un tramo con el dry-run APAGADO, como `scrum180`. Es seguro por tres
// capas, cualquiera basta: no hay token configurado (el sender devuelve `null` antes de la red),
// el freno de SCRUM-180 lanza en un proceso de test, y el corte de aquí destruye el socket.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { cortarSalida, HOST_DE_CONTROL } from './_sin-salida.mjs';

// 🔴 MUTACIONES_QUE_ME_TUMBAN · se ejecutan con `npm run meta:mutaciones`.
export const MUTACIONES_QUE_ME_TUMBAN = [
  {
    // La bandera, CONGELADA al cargar el módulo: el defecto exacto que haría inútil que un test
    // se la ponga a sí mismo después.
    fichero: 'src/integrations/whatsapp.ts',
    de: "const isDryRun = () => process.env.WHATSAPP_DRY_RUN === '1';",
    a: "const secoAlCargar = process.env.WHATSAPP_DRY_RUN === '1'; const isDryRun = () => secoAlCargar;",
    cae: 'SCRUM-876f · la bandera puesta DESPUÉS de cargar el sender surte efecto, y quitarla también',
  },
  {
    // El corte deja de mirar: todo pasa como si fuera de esta máquina.
    fichero: 'tests/_sin-salida.mjs',
    de: "if (d.tuberia || LOOPBACK.has(String(d.host).toLowerCase())) return original.apply(this, args);",
    a: 'if (d) return original.apply(this, args);',
    cae: 'SCRUM-876f · el corte de salida ve un POST de axios y un fetch, y los corta',
  },
];

const corte = cortarSalida();
test.after(() => corte.restaurar());

test('SCRUM-876f · el corte de salida ve un POST de axios y un fetch, y los corta', async () => {
  const vistos = await corte.controlPositivo(); // lanza si está ciego a cualquiera de los dos
  assert.equal(vistos, 2, 'un intento por camino: axios y fetch');
  assert.deepEqual(corte.intentos.map((i) => `${i.host}:${i.port}`), [`${HOST_DE_CONTROL}:443`, `${HOST_DE_CONTROL}:443`]);
  assert.deepEqual(corte.ajenos(), [], 'los intentos del control no cuentan como salida del código bajo prueba');
});

test('SCRUM-876f · lo de esta máquina pasa el corte y no se apunta', async () => {
  const servidor = await new Promise((listo) => {
    const s = http.createServer((_q, res) => res.end('de casa')).listen(0, '127.0.0.1', () => listo(s));
  });
  try {
    const antes = corte.intentos.length;
    const cuerpo = await (await fetch(`http://127.0.0.1:${servidor.address().port}/`)).text();
    assert.equal(cuerpo, 'de casa', '🔴 el corte se ha llevado por delante una conexión de loopback');
    assert.equal(corte.intentos.length, antes, '🔴 una conexión de loopback se apuntó como salida');
  } finally {
    servidor.close();
  }
});

test('SCRUM-876f · la bandera puesta DESPUÉS de cargar el sender surte efecto, y quitarla también', async () => {
  const guardada = process.env.WHATSAPP_DRY_RUN;
  delete process.env.WHATSAPP_DRY_RUN;
  try {
    // El sender se carga AQUÍ, con la bandera ausente.
    const { downloadWhatsAppMedia } = await import('../dist/integrations/whatsapp.js');
    assert.equal(typeof downloadWhatsAppMedia, 'function', 'CIEGO: no encuentro el sender que se usa de sonda');
    const enSeco = (r) => Boolean(r) && r.buffer.toString() === 'dryrun-media-m1';

    const sin = await downloadWhatsAppMedia('m1');
    assert.equal(enSeco(sin), false, 'SUELO: sin la bandera el sender NO contesta en seco');

    process.env.WHATSAPP_DRY_RUN = '1';
    const con = await downloadWhatsAppMedia('m1');
    assert.equal(enSeco(con), true,
      '🔴 la bandera, puesta después de cargar el sender, NO surte efecto: un test que se la pone a sí mismo ya no va en seco');

    delete process.env.WHATSAPP_DRY_RUN;
    const otraVez = await downloadWhatsAppMedia('m1');
    assert.equal(enSeco(otraVez), false, '🔴 el sender sigue en seco con la bandera quitada: la leyó una vez y la guardó');

    assert.deepEqual(corte.ajenos(), [], '🔴 la sonda intentó salir de esta máquina');
  } finally {
    if (guardada === undefined) delete process.env.WHATSAPP_DRY_RUN;
    else process.env.WHATSAPP_DRY_RUN = guardada;
  }
});
