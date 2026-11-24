// SCRUM-936d · La VARIANTE de `tocable` que eligió el fundador (SCRUM-936 c.22615, «Variante, sin
// tocar el vigía»): se recorta SOLO el borde medido que cae a menos de 1 px del borde de la caja (el
// píxel fantasma de arriba de `elementsFromPoint` y el que el vecino de abajo se come); el resto se
// queda como lo mide el árbitro. Banco fabricado aquí mismo: cada caso lo siembra el test, no el árbol.
import test from 'node:test';
import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';
import { FUENTE_MEDIDOR, INTERACTIVOS, MINIMO_TACTIL } from '../scripts/_medidor-de-toque.mjs';
import { resolverNavegador, lanzarNavegador } from '../scripts/_navegador.mjs';

const HTML = `<!doctype html><html><head><style>
body{margin:0}
.c{display:block;box-sizing:border-box;width:200px;margin:0;padding:0;border:0;background:#ccc}
.s{height:100px}
#h43{height:43px} #h44{height:44px} #pegA{height:44px} #pegB{height:44px} #h48{height:48px}
#amp{position:relative;height:20px;line-height:20px}
#amp::after{content:"";position:absolute;left:0;right:0;top:-12px;bottom:-12px}
</style></head><body>
<div class="s"></div><button class="c" id="h43">a</button>
<div class="s"></div><button class="c" id="h44">b</button>
<div class="s"></div><button class="c" id="pegA">c</button><button class="c" id="pegB">d</button>
<div class="s"></div><button class="c" id="h48">e</button>
<div class="s"></div><a class="c" id="amp" href="#x">f</a>
</body></html>`;

const navegador = resolverNavegador();

test('SCRUM-936d · tocable recorta el borde a menos de 1 px de la caja, y deja el área ampliada como la mide el árbitro', { skip: !navegador.ok && `sin navegador donde mirar (resolverNavegador): ${navegador.motivo}` }, async () => {
  const nav = await lanzarNavegador(puppeteer, { headless: 'new' });
  try {
    const page = await nav.newPage();
    await page.setViewport({ width: 400, height: 1000, deviceScaleFactor: 1 });
    await page.setContent(HTML);
    await page.evaluate(FUENTE_MEDIDOR);
    const m = await page.evaluate(async (SEL) => {
      const out = {};
      for (const id of ['h43', 'h44', 'pegA', 'h48', 'amp']) {
        out[id] = await window.__areaDeToque(document.getElementById(id), SEL, {});
      }
      return out;
    }, INTERACTIVOS);
    const visto = JSON.stringify(m);

    // CONTROL del banco: las cajas son las sembradas y el árbitro alcanza a las cinco. Si no, el
    // test no mide lo que cree y cualquier «tocable» de abajo no valdría nada.
    assert.deepEqual(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, [v.caja, v.error ?? null]])),
      { h43: [43, null], h44: [44, null], pegA: [44, null], h48: [48, null], amp: [20, null] },
      `🔴 CIEGO: el banco no es el sembrado o el árbitro no alcanza: ${visto}`);

    // El botón real de 43 px es CORTO (hoy el píxel fantasma de arriba lo sube a 44 y lo aprueba).
    assert.equal(m.h43.tocable, 43, `h43 tiene que medir 43: ${visto}`);
    assert.ok(m.h43.tocable < MINIMO_TACTIL, `h43 tiene que salir corto: ${visto}`);
    // El de 44 da 44 aislado y con un vecino interactivo pegado debajo (pintado después).
    assert.equal(m.h44.tocable, 44, `h44 aislado tiene que medir 44: ${visto}`);
    assert.equal(m.pegA.tocable, 44, `h44 con vecino pegado debajo tiene que medir 44: ${visto}`);
    // CONTROL POSITIVO: 48 es conforme.
    assert.equal(m.h48.tocable, 48, `h48 tiene que medir 48: ${visto}`);
    assert.ok(m.h48.tocable >= MINIMO_TACTIL, `h48 tiene que salir conforme: ${visto}`);

    // RESTO CONOCIDO, FIJADO: resto conocido aceptado por el fundador en c.22615. Un enlace de 20
    // ampliado con ::after a 44 mide 45: sus bordes caen a 12 px de la caja y la variante no los
    // toca, así que le queda el píxel fantasma de arriba. Si un día mide 44, el resto ha
    // desaparecido: se actualiza este caso y el registro de SCRUM-936, no se ensancha.
    assert.equal(m.amp.tocable, 45,
      `el resto conocido de c.22615 ha cambiado (esperado 45, el área ampliada con su píxel fantasma): ${visto}`);
  } finally {
    await nav.close();
  }
});
