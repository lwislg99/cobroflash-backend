// tests/scrum568-promesa-con-mecanismo.test.mjs — SCRUM-568
//
// Sin gate: lee ficheros. Ni BD, ni red, ni servidor.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// 🔴 UNA PROMESA CON FECHA NECESITA MECANISMO, O ES OTRA PROMESA
//
// El fundador decidió el 20-ago-2026, después de leer la medición de SCRUM-564: **no se
// documenta la condición**. Los tres medios se quedan enunciados. «Cuando hagamos el go para
// empezar a vender, todo será verdad.»
//
// Este fichero no revisa esa decisión: la SOSTIENE. Convierte «antes del go, o los medios están
// encendidos o los nueve textos cambian» en algo que el repo comprueba solo.
//
// ⚠️ ESTO ES UN REGISTRO, NO UNA PUERTA. Hoy está VERDE con las nueve inalcanzables, porque eso
// es la decisión correcta y un rojo permanente por una decisión correcta es el que el segundo
// que lo ve desactiva (SCRUM-559). Lo que hay aquí es un TRINQUETE: el día que los flags se
// enciendan, o que aparezca una décima frase condicionada, cae — pidiendo que se mire, no
// bloqueando a nadie por lo de hoy.
// ─────────────────────────────────────────────────────────────────────────────────────────
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as censoF from '../scripts/censo-anclas-bloque-f.mjs';
import {
  ANCLAS_564, DEFECTOS_AL_DECLARAR, estadoCondicionadas, veredictos, leerLanding,
  CON_ANCLA, FALSA,
} from '../scripts/_afirmaciones-publicadas.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = leerLanding(RAIZ);

/** Lo medido el 21-ago-2026. */
const CONDICIONADAS = 9;
const ALCANZABLES_HOY = 0;
const FLAGS = ['BIZUM_MANUAL_ENABLED', 'PAYMENTS_CONNECT_ENABLED'];

/** La tabla P con los dos flags encendidos. No toca `src/core/flags.ts`: se INYECTA. */
function conLosFlagsEncendidos() {
  const real = censoF.defaultsDeLaTablaP(RAIZ);
  assert.equal(real.ok, true, `🔴 CIEGO: no se ha podido leer la tabla P — ${real.motivo}`);
  return { ok: true, tabla: { ...real.tabla, PAYMENTS_CONNECT_ENABLED: true, BIZUM_MANUAL_ENABLED: true } };
}

// ═════════════════════════════════════════════════════════════════════════════════════════
// SUELO · un cero aquí diría «no hay ninguna promesa condicionada», que es lo contrario
// ═════════════════════════════════════════════════════════════════════════════════════════
test('SUELO · hay afirmaciones condicionadas a un flag, y son nueve', () => {
  const e = estadoCondicionadas(html, RAIZ, censoF);
  assert.ok(e.N > 0,
    '🔴 CIEGO: cero afirmaciones condicionadas a un flag. Están medidas: son nueve. Un cero se '
    + 'leería como «ninguna promesa depende de una puerta cerrada», que es justo al revés.');
  assert.equal(e.N, CONDICIONADAS,
    `🔴 hay ${e.N} condicionadas y se midieron ${CONDICIONADAS} · diferencia ${e.N - CONDICIONADAS}.\n`
    + '      → si son MÁS, hay copy publicado nuevo que promete un medio que aún no existe.\n'
    + '      → si son MENOS, alguien cambió un texto o le quitó el `tras`: di cuál.');
  assert.deepEqual(e.flags, FLAGS, '🔴 han cambiado las puertas que condicionan las nueve');
});

test('SUELO · la tabla P se lee de verdad, y las dos puertas siguen apagadas', () => {
  const t = censoF.defaultsDeLaTablaP(RAIZ);
  assert.equal(t.ok, true, `🔴 CIEGO: ${t.motivo}. Sin el valor no se puede decir si un merchant llega.`);
  for (const f of FLAGS) {
    assert.ok(f in t.tabla, `🔴 CIEGO: la tabla P no tiene «${f}». No se da por encendido.`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// EL ESTADO, EN UNA LÍNEA · punto 3
// ═════════════════════════════════════════════════════════════════════════════════════════
test('el estado se puede leer en una línea, y hoy dice 0 de 9', () => {
  const e = estadoCondicionadas(html, RAIZ, censoF);
  assert.equal(e.M, ALCANZABLES_HOY,
    `🔴 hoy son alcanzables ${e.M} de ${e.N}. Si ha subido, los flags se han encendido: **eso es `
    + 'la buena noticia**, y toca actualizar este trinquete y avisar de que ya no hay nada que '
    + 'esperar. Si ha bajado por debajo de 0, algo se ha roto en la cuenta.');
  assert.equal(e.linea, 'de las 9 afirmaciones condicionadas a un flag, 0 son alcanzables hoy');
  assert.equal(e.ids.length, CONDICIONADAS);
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EL CONTROL QUE DECIDE · ¿cambia el veredicto SOLO?
// ═════════════════════════════════════════════════════════════════════════════════════════
test('🔴 con los flags encendidos, las nueve pasan a alcanzables SIN tocar ningún fichero', () => {
  const antes = estadoCondicionadas(html, RAIZ, censoF);
  assert.equal(antes.M, 0, '🔴 el punto de partida no es 0: la prueba no probaría nada');

  const despues = estadoCondicionadas(html, RAIZ, censoF, conLosFlagsEncendidos());

  assert.equal(despues.N, CONDICIONADAS, '🔴 al encender los flags cambia CUÁNTAS hay, y no debería');
  assert.equal(despues.M, CONDICIONADAS,
    '🔴 con los dos flags encendidos siguen sin ser alcanzables ' + (CONDICIONADAS - despues.M)
    + ' de las nueve. Entonces su veredicto NO lo decide el flag, y «cambia solo» es mentira: '
    + 'las que faltan son ' + JSON.stringify(despues.ids.filter((id) => !despues.alcanzables.includes(id))));
  assert.deepEqual(despues.alcanzables.sort(), antes.ids.sort(),
    '🔴 pasan a alcanzables OTRAS distintas de las nueve condicionadas');
});

test('🔴 con UN solo flag encendido, sólo cambian las que dependen de él', () => {
  // Si con medio flag cambiaran las nueve, el veredicto no estaría mirando el flag que dice
  // mirar: estaría mirando cualquier cosa. Esto separa «depende del flag» de «depende de algo».
  const real = censoF.defaultsDeLaTablaP(RAIZ);
  const soloBizum = { ok: true, tabla: { ...real.tabla, BIZUM_MANUAL_ENABLED: true } };
  const e = estadoCondicionadas(html, RAIZ, censoF, soloBizum);
  assert.ok(e.M > 0, '🔴 encender BIZUM_MANUAL_ENABLED no desbloquea NI UNA: no lo está mirando');
  assert.ok(e.M < CONDICIONADAS,
    '🔴 encender sólo el flag de Bizum desbloquea las nueve. Entonces las que hablan de tarjeta '
    + 'no dependen de `PAYMENTS_CONNECT_ENABLED`, y su veredicto es casualidad.');
  // y las que quedan fuera tienen que ser justo las de tarjeta
  const siguenFuera = e.ids.filter((id) => !e.alcanzables.includes(id));
  for (const id of siguenFuera) {
    const tras = ANCLAS_564[id].tras.map((t) => t.flag);
    assert.ok(tras.includes('PAYMENTS_CONNECT_ENABLED'),
      `🔴 ${id} sigue inalcanzable con Bizum encendido y no declara depender de la tarjeta`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LAS NUEVE · declaradas como manda 551 + 558, no a mano
// ═════════════════════════════════════════════════════════════════════════════════════════
test('las nueve tienen ancla VIVA y `tras` con flag y motivo', () => {
  const e = estadoCondicionadas(html, RAIZ, censoF);
  for (const id of e.ids) {
    const reg = ANCLAS_564[id];
    assert.ok(Array.isArray(reg.anclas) && reg.anclas.length > 0,
      `🔴 ${id} está condicionada y no tiene ancla: «inalcanzable» y «no existe» no son lo mismo`);
    for (const a of reg.anclas) {
      const v = censoF.anclaViva(a, RAIZ);
      assert.equal(v.viva, true, `🔴 ${id}: el ancla «${a}» no está viva — ${v.motivo}`);
    }
    for (const t of reg.tras) {
      assert.ok(t.flag, `🔴 ${id}: una entrada de \`tras\` sin flag. Declarar a medias no declara.`);
      assert.ok(t.motivo && t.motivo.length > 30, `🔴 ${id}: la puerta «${t.flag}» sin motivo escrito`);
      // 🔴 Y lo que hace que el punto 2 funcione: NADA de `porDefecto`. Con él, encender el flag
      //    da «EL VALOR DECLARADO CADUCÓ» en vez de «alcanzable», y haría falta editar este
      //    fichero para pasar a verde — que es lo que el encargo prohíbe expresamente.
      assert.equal('porDefecto' in t, false,
        `🔴 ${id}: \`tras\` declara \`porDefecto\` para «${t.flag}». Medido: con él, al encender `
        + 'el flag el veredicto NO pasa a alcanzable, pasa a «valor caducado» — y entonces hay '
        + 'que editar un fichero, que es justo lo que no puede pasar.');
    }
  }
});

test('las nueve salen hoy INALCANZABLE, y el rojo nombra la puerta', () => {
  const r = veredictos(html, RAIZ, censoF);
  const porId = new Map(r.veredictos.map((v) => [v.id, v]));
  for (const id of estadoCondicionadas(html, RAIZ, censoF).ids) {
    const v = porId.get(id);
    assert.ok(v, `🔴 ${id} no aparece en los veredictos`);
    assert.equal(v.grupo, FALSA, `🔴 ${id} no sale como falsa hoy, y los flags siguen apagados`);
    assert.match(v.problemas.join(' '), /ANCLADA PERO INALCANZABLE/,
      `🔴 ${id}: sale falsa por otro motivo que no es la puerta cerrada`);
    assert.match(v.problemas.join(' '), /PAYMENTS_CONNECT_ENABLED|BIZUM_MANUAL_ENABLED/,
      `🔴 ${id}: el rojo no dice QUÉ puerta lo hace inalcanzable`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// CONTROL POSITIVO · si deja de reconocer lo que ya reconocía, se ha roto
// ═════════════════════════════════════════════════════════════════════════════════════════
test('CONTROL POSITIVO · las anclas vivas del bloque F siguen vivas', () => {
  const conAncla = Object.entries(censoF.ANCLAS_F).filter(([, r]) => Array.isArray(r.anclas) && r.anclas.length);
  assert.ok(conAncla.length > 0, '🔴 CIEGO: el registro del bloque F no tiene ninguna entrada anclada');
  for (const [id, reg] of conAncla) {
    for (const a of reg.anclas) {
      assert.equal(censoF.anclaViva(a, RAIZ).viva, true,
        `🔴 ${id}: el ancla «${a}» estaba viva y ahora no. El mecanismo que este fichero reutiliza `
        + 'se ha roto, y entonces su «0 de 9» no significa nada.');
    }
  }
});

test('CONTROL POSITIVO · lo que NO está condicionado no se mueve al encender los flags', () => {
  const antes = veredictos(html, RAIZ, censoF).veredictos.filter((v) => v.grupo === CON_ANCLA).map((v) => v.id);
  const despues = veredictos(html, RAIZ, censoF, conLosFlagsEncendidos()).veredictos
    .filter((v) => v.grupo === CON_ANCLA).map((v) => v.id);
  for (const id of antes) {
    assert.ok(despues.includes(id),
      `🔴 «${id}» tenía ancla viva y deja de tenerla al encender un flag que no le afecta`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// LA FOTO DE LOS DEFAULTS · informa, no condiciona
// ═════════════════════════════════════════════════════════════════════════════════════════
test('si alguien mueve un default, se dice — sin que eso gobierne ningún veredicto', () => {
  const t = censoF.defaultsDeLaTablaP(RAIZ);
  for (const f of FLAGS) {
    assert.equal(t.tabla[f], DEFECTOS_AL_DECLARAR[f],
      `🔴 «${f}» valía ${DEFECTOS_AL_DECLARAR[f]} cuando se declararon las nueve (${DEFECTOS_AL_DECLARAR.fecha}) `
      + `y hoy vale ${t.tabla[f]}.\n`
      + '      → NO es un fallo: es la señal de que el mundo se movió. Vuelve a mirar las nueve '
      + 'con el valor de hoy y actualiza `DEFECTOS_AL_DECLARAR`. El veredicto ya ha cambiado solo; '
      + 'esto sólo se asegura de que alguien se entere.');
  }
});

// ═════════════════════════════════════════════════════════════════════════════════════════
// NO SE ESCRIBE NINGUNA NOTA · el fundador decidió que no
// ═════════════════════════════════════════════════════════════════════════════════════════
test('🔴 no se ha añadido ninguna nota de condición a la landing', () => {
  // La decisión del 20-ago anuló el encargo anterior. Este ticket REGISTRA; no avisa al usuario.
  // Se comprueba sobre el marcado, no sobre la intención.
  const SOSPECHOSAS = [
    /solo (?:por )?transferencia (?:de|por) momento/i,
    /pr[oó]ximamente (?:con )?tarjeta/i,
    /tarjeta y bizum,? (?:muy )?pronto/i,
    /disponible (?:muy )?pronto/i,
  ];
  for (const re of SOSPECHOSAS) {
    assert.equal(re.test(html), false, `🔴 la landing trae una nota de condición: ${re}`);
  }
});

test('🔴 los nueve textos siguen intactos, byte a byte', () => {
  const e = estadoCondicionadas(html, RAIZ, censoF);
  const bruto = Buffer.from(html, 'utf8');
  for (const id of e.ids) {
    const t = ANCLAS_564[id].texto;
    const b = Buffer.from(t, 'utf8');
    const i = bruto.indexOf(b);
    assert.notEqual(i, -1, `🔴 ${id}: «${t}» ya no está en la landing`);
    assert.equal(Buffer.compare(bruto.subarray(i, i + b.length), b), 0,
      `🔴 ${id}: aparece pero no byte a byte`);
  }
});
