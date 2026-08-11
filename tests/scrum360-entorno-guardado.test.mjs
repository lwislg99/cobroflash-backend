// tests/scrum360-entorno-guardado.test.mjs — SCRUM-360 (H5 · fase 2)
//
// ═════════════════════════════════════════════════════════════════════════════════════════
// WebKit borra el ORIGEN ENTERO tras 7 días de usar Safari sin visitar el sitio. Los web apps
// AÑADIDOS A LA PANTALLA DE INICIO están exentos; una pestaña normal NO. Con la cola de firmas ya
// construida (SCRUM-358), a un profesional que emite cada dos semanas **puede desaparecerle una
// firma pendiente**, y no se entera él ni nos enteramos nosotros.
//
// 🔴 `null` NO SE SUMA NUNCA A `false`. Si al contar quién está en riesgo un «no lo sé» cayera del
// lado de «pestaña», habríamos fabricado el número tranquilo que este dato venía a impedir.
// ═════════════════════════════════════════════════════════════════════════════════════════
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ENTORNOS_APP, esEntornoApp, aInstaladaPwa, registrarEntornoDeSesion,
  ENTORNO_ESCRITO, ENTORNO_SIN_CAMBIO, ENTORNO_NO_SE_PUDO,
} from '../dist/modules/auth/domain/entornoApp.service.js';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Un Prisma de mentira que REGISTRA si se escribió y con qué. Esa es toda la prueba. */
function prismaFalso({ guardado = null, existe = true, revienta = false } = {}) {
  const reg = { escrituras: [], lecturas: 0 };
  return {
    reg,
    authSession: {
      findUnique: async () => {
        reg.lecturas++;
        if (revienta) throw new Error('la base no contestó');
        return existe ? { instaladaPwa: guardado } : null;
      },
      update: async ({ where, data }) => { reg.escrituras.push({ where, data }); return {}; },
    },
  };
}

// ═══ ① LOS TRES ESTADOS. Los TRES, no dos. ═══════════════════════════════════════════════

test('SCRUM-360 · los tres estados se guardan como lo que son', async () => {
  const casos = [
    { entorno: 'instalada', esperado: true },
    { entorno: 'pestana', esperado: false },
    { entorno: 'desconocido', esperado: null },
  ];
  // SUELO: si la unión se quedara corta, «los tres» sería un nombre y no una comprobación.
  assert.equal(ENTORNOS_APP.length, 3,
    `🔴 SUELO: la unión tiene ${ENTORNOS_APP.length} estados y este test comprueba tres.`);

  for (const c of casos) {
    assert.equal(aInstaladaPwa(c.entorno), c.esperado,
      `🔴 «${c.entorno}» se convierte en ${JSON.stringify(aInstaladaPwa(c.entorno))} y tenía que ser ` +
      `${JSON.stringify(c.esperado)}.`);
    // Y de punta a punta, no solo la función pura: tiene que LLEGAR A LA FILA.
    const p = prismaFalso({ guardado: 'nada-igual' });
    const r = await registrarEntornoDeSesion(7, c.entorno, p);
    assert.equal(r.estado, ENTORNO_ESCRITO, `🔴 «${c.entorno}» no se escribió: ${JSON.stringify(r)}`);
    assert.equal(p.reg.escrituras.length, 1, `🔴 «${c.entorno}»: no hay escritura.`);
    assert.equal(p.reg.escrituras[0].data.instaladaPwa, c.esperado,
      `🔴 «${c.entorno}» llegó a la fila como ${JSON.stringify(p.reg.escrituras[0].data.instaladaPwa)}.`);
    assert.equal(p.reg.escrituras[0].where.id, 7, '🔴 se ha escrito en otra sesión.');
  }
});

test('SCRUM-360 · SUELO: «no se pudo saber» se guarda `null`, y NO se inventa `false`', async () => {
  const p = prismaFalso({ guardado: true });
  const r = await registrarEntornoDeSesion(7, 'desconocido', p);

  assert.equal(p.reg.escrituras[0].data.instaladaPwa, null,
    '🔴 SE ESTÁ CONTANDO UN «NO LO SÉ» COMO UN «NO». `desconocido` ha llegado a la fila como ' +
    `${JSON.stringify(p.reg.escrituras[0].data.instaladaPwa)}, no como \`null\`. Al contar quién ` +
    'está en riesgo de perder una firma, ese valor caerá del lado de «pestaña» y habremos ' +
    'fabricado el número tranquilo que este dato venía a impedir.');
  assert.notEqual(p.reg.escrituras[0].data.instaladaPwa, false,
    '🔴 «no supimos» y «no instalada» tienen que salir DISTINTAS de la base.');
  assert.equal(r.valor, null);
});

// ═══ ② EL CONTROL NEGATIVO: con el mismo valor, NO SE ESCRIBE ════════════════════════════

test('SCRUM-360 · con el mismo valor que ya está guardado, NO se escribe', async () => {
  // Sin este test, «solo cuando cambia» es un comentario y no un mecanismo.
  for (const [entorno, guardado] of [['instalada', true], ['pestana', false], ['desconocido', null]]) {
    const p = prismaFalso({ guardado });
    const r = await registrarEntornoDeSesion(7, entorno, p);
    assert.equal(r.estado, ENTORNO_SIN_CAMBIO,
      `🔴 «${entorno}» sobre un ${JSON.stringify(guardado)} ya guardado dice ${r.estado}.`);
    assert.deepEqual(p.reg.escrituras, [],
      `🔴 se ha escrito «${entorno}» sobre una fila que YA valía ${JSON.stringify(guardado)}. Es una ` +
      'escritura por visita sobre una tabla caliente, y el campo dejaría de significar «el último ' +
      'entorno visto» para significar «la última vez que entró».');
    // CONTROL POSITIVO DENTRO: el banco SÍ sabe escribir. Si no, «no escribió» sería trivial.
    assert.equal(p.reg.lecturas, 1, '🔴 ni siquiera se leyó la fila: no se está comparando nada.');
  }
});

// ═══ ③ LA TRAMPA DEL FUNDADOR: instalar A MITAD tiene que verse ══════════════════════════

test('SCRUM-360 · si el entorno cambia de `pestana` a `instalada`, la fila SE ACTUALIZA', async () => {
  // 🔴 Es la decisión del fundador convertida en guard: si el campo se escribiera solo al CREAR la
  // sesión, esto caería. Y **instalar es justo la mitigación que queremos ver ocurrir**: un campo
  // que no la capta mide lo contrario de lo que hace falta.
  const p = prismaFalso({ guardado: false }); // venía en pestaña
  const r = await registrarEntornoDeSesion(7, 'instalada', p);

  assert.equal(r.estado, ENTORNO_ESCRITO,
    '🔴 el profesional ha INSTALADO la app a mitad de sesión y la fila no se ha actualizado. Es ' +
    'la mitigación que este dato existe para poder ver, y se estaría perdiendo.');
  assert.equal(p.reg.escrituras[0].data.instaladaPwa, true);
});

test('SCRUM-360 · y al revés: de `instalada` a `pestana` también se actualiza', async () => {
  const p = prismaFalso({ guardado: true });
  const r = await registrarEntornoDeSesion(7, 'pestana', p);
  assert.equal(r.estado, ENTORNO_ESCRITO, '🔴 desinstalar no se ve.');
  assert.equal(p.reg.escrituras[0].data.instaladaPwa, false);
});

test('SCRUM-360 · `null` y `false` NO son lo mismo al comparar', async () => {
  // ⚠️ El colapso puede volver por la puerta de atrás de un operador: con `||` en vez de `??`, un
  // `false` guardado se leería como `null` y «pestaña» sobre «pestaña» se escribiría cada visita.
  const desdeNull = prismaFalso({ guardado: null });
  assert.equal((await registrarEntornoDeSesion(7, 'pestana', desdeNull)).estado, ENTORNO_ESCRITO,
    '🔴 pasar de «no lo sé» a «pestaña» no se ha escrito: son valores distintos.');
  const desdeFalse = prismaFalso({ guardado: false });
  assert.equal((await registrarEntornoDeSesion(7, 'desconocido', desdeFalse)).estado, ENTORNO_ESCRITO,
    '🔴 pasar de «pestaña» a «no lo sé» no se ha escrito: perder la certeza también es un cambio.');
});

// ═══ ④ QUE NO PUEDA TUMBAR NADA, Y QUE NO ACEPTE CUALQUIER COSA ══════════════════════════

test('SCRUM-360 · si la base falla, se dice — y no se lanza', async () => {
  const r = await registrarEntornoDeSesion(7, 'instalada', prismaFalso({ revienta: true }));
  assert.equal(r.estado, ENTORNO_NO_SE_PUDO, '🔴 un fallo de base se cuenta como escrito.');
  assert.ok(r.motivo, '🔴 se declara NO_SE_PUDO sin decir por qué.');
});

test('SCRUM-360 · la unión es CERRADA: lo que no está no se normaliza', async () => {
  for (const malo of ['INSTALADA', 'standalone', '', null, undefined, true, 'pestaña']) {
    assert.equal(esEntornoApp(malo), false,
      `🔴 «${String(malo)}» se acepta como entorno. Normalizar un valor desconocido a ` +
      '`desconocido` guardaría un `null` que PARECE medido y no lo es.');
  }
  // CONTROL POSITIVO DENTRO: los tres buenos sí pasan, o esto solo diría que rechaza todo.
  for (const bueno of ENTORNOS_APP) assert.equal(esEntornoApp(bueno), true, `🔴 «${bueno}» se rechaza.`);
});

// ═══ ⑤ EL CAMINO ENTERO: que el navegador lo MANDE, no solo que exista ═══════════════════

test('SCRUM-360 · el navegador manda el entorno al arrancar, y no bloquea el arranque', () => {
  // «Un endpoint que recibe y no guarda no lleva a ninguna parte» — y uno que guarda y al que nadie
  // llama, tampoco. Esto comprueba la mitad del camino que no se ve desde el servidor.
  const app = fs.readFileSync(path.join(RAIZ, 'public/dashboard/js/app.js'), 'utf8');
  const codigo = app.replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, '');

  assert.ok(/enviarEntornoDeLaApp\(\)/.test(codigo),
    '🔴 nadie llama a `enviarEntornoDeLaApp`: la fase 1 dejó `entornoDeLaApp()` sin llamar y esto ' +
    'la dejaría igual, con un endpoint más que mantener y ningún dato.');
  assert.ok(/window\.entornoDeLaApp\(\)/.test(codigo),
    '🔴 no se está usando la detección de la fase 1: o se llama a esa, o se ha escrito otra.');
  assert.ok(/apiRequest\('\/admin\/entorno'/.test(codigo),
    '🔴 el envío no va a `/admin/entorno`.');
  // 🔴 Y SIN `await` EN EL ARRANQUE: telemetría que retrasa el arranque es telemetría que un día
  // impide arrancar. Se comprueba que la llamada dentro de `initApp` NO va esperada.
  assert.ok(/\n  enviarEntornoDeLaApp\(\);/.test(app),
    '🔴 la llamada del arranque no está suelta: si va con `await`, un servidor lento retrasa la ' +
    'app entera por un dato que a nadie le urge.');
});

test('SCRUM-360 · la detección de la fase 1 NO se ha reescrito', () => {
  // Sacar algo a un sitio compartido y luego escribir una segunda copia es el defecto que la fase 1
  // cerró con su propio guard. Aquí se comprueba lo que a esta fase le toca: que no haya nacido
  // otra detección en el servidor, donde no hay navegador al que preguntarle.
  const dir = path.join(RAIZ, 'src');
  const copias = [];
  (function anda(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { anda(f); continue; }
      if (!f.endsWith('.ts')) continue;
      const codigo = fs.readFileSync(f, 'utf8').replace(/\/\/[^\n]*|\/\*[^]*?\*\//g, '');
      if (/display-mode|navigator\.standalone/.test(codigo)) copias.push(path.relative(RAIZ, f).replace(/\\/g, '/'));
    }
  })(dir);
  assert.deepEqual(copias, [],
    `🔴 hay detección de entorno en el servidor: ${copias.join(', ')}. El servidor no tiene ` +
    'navegador al que preguntar: cualquier cosa que decida ahí es una suposición sobre el aparato.');
});
