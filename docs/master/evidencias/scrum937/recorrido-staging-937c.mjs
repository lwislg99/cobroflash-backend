// docs/master/evidencias/scrum937/recorrido-staging-937c.mjs — SCRUM-937c · EL RECORRIDO QUE CIERRA.
//
// Uso (desde la raíz de un worktree al día, con 937b ya desplegado en staging):
//   node docs/master/evidencias/scrum937/recorrido-staging-937c.mjs
//
// En STAGING, con el merchant QA y el panel desplegado de verdad, recorre la mitad de PANTALLA de
// SCRUM-937 (la de 937b) y mide el ESTADO del DOM, nunca una captura:
//
//   A  · sin proveedor: el NIF es de SOLO LECTURA y la ayuda firmada SE VE.
//   B  · proveedor sin NIF → se teclea → se vuelve a «— Sin proveedor —» → se guarda:
//        el NIF tecleado NO se borra, y tras guardar sale el aviso ámbar firmado.
//
// Y con DOS CONTROLES POSITIVOS, porque los dos verdes de A son indistinguibles de un instrumento
// averiado (🔒 «una operación que no se ejecutó se lee igual que un éxito»):
//   P1 · proveedor SIN NIF: el campo se escribe y MI TECLEO ENTRA. Si P1 falla, el «no entró» de A
//        no prueba nada: prueba que este banco no sabe teclear.
//   P2 · proveedor CON NIF: sale el de la ficha, de solo lectura, y la ayuda SE ESCONDE. Si P2
//        falla, el «la ayuda se ve» de A no prueba nada: prueba que la ayuda no sabe esconderse.
//
// Crea UN gasto (lo exige B: el aviso sale DESPUÉS de guardar) y lo BORRA al final. Permiso del
// orquestador por el canal (20-sep-2026): recorrer 937b con el merchant QA, casos A y B.
//
// 🔒 El secreto de login se lee EN TIEMPO DE EJECUCIÓN de un fichero fuera del repo y no se imprime
// (regla 9). Aborta si la base no es staging: producción no se toca.
import fs from 'node:fs';
import puppeteer from 'puppeteer-core';
import { lanzarNavegador } from '../../../../scripts/_navegador.mjs';

const BASE = 'https://yaqu-staging-production.up.railway.app';
if (!/yaqu-staging/.test(BASE)) { console.error('no es staging: no se mide'); process.exit(2); }
const SECRETO = 'D:/MILLONARIO/cobroFlash/e2e-staging-secret.txt';
const m = fs.readFileSync(SECRETO, 'utf8').match(/^E2E_TEST_LOGIN_SECRET=(.+)$/m);
if (!m) { console.error('no encuentro la clave de login en el fichero de secretos'); process.exit(2); }

// Los literales firmados (docs/microcopy/2026-09-18-SCRUM-937-nif-del-gasto.md). Se comparan con
// los de la PANTALLA DESPLEGADA: si alguien los cambia sin pasar por la ficha, este banco cae.
const AYUDA = 'Elige antes el proveedor: el NIF se guarda en su ficha.';
const AVISO = 'Gasto guardado. El NIF no se ha guardado: para guardarlo, el gasto necesita un proveedor.';
const NIF_TECLEADO = 'B87654321';
const CONCEPTO = `QA 937c nif ${Date.now()}`;

console.log('TESTIGO · sonda 937c arrancada contra ' + BASE);

// Lee el estado del modal. `new Function` porque el censo 258 no deja `document` suelto en el banco.
const LEER = new Function(`
  var inp = document.getElementById('exp-provider-nif');
  var ayuda = document.getElementById('exp-nif-ayuda');
  var sel = document.getElementById('exp-providerid');
  return {
    proveedorElegido: sel ? (sel.selectedOptions[0] ? sel.selectedOptions[0].textContent : null) : null,
    nifValor: inp ? inp.value : null,
    nifSoloLectura: inp ? inp.readOnly : null,
    nifOrigen: inp ? (inp.dataset.origen || null) : null,
    ayudaHidden: ayuda ? ayuda.hidden : null,
    ayudaTexto: ayuda ? ayuda.textContent.trim() : null,
    ayudaSeVe: ayuda && ayuda.checkVisibility ? ayuda.checkVisibility() : null,
    ayudaAlto: ayuda ? Math.round(ayuda.getBoundingClientRect().height) : null
  };
`);

const nav = await lanzarNavegador(puppeteer, { headless: 'new', args: ['--disable-dev-shm-usage'] });
const pag = await nav.newPage();
const informe = { concepto: CONCEPTO, fases: {} };
let creadoId = null;
let creadosProveedores = [];
let respuestaDelAlta = null;

// Quietos los animados antes de tocar nada (trampa de los guards de navegador).
const quieto = () => pag.waitForFunction(
  () => document.getAnimations().every((a) => a.playState !== 'running'), { timeout: 5000 },
).catch(() => {});

// Elige un proveedor POR SU id y dispara el `change` que el modal escucha.
const elegirProveedor = async (id) => {
  await pag.evaluate((v) => {
    const s = document.getElementById('exp-providerid');
    s.value = String(v);
    s.dispatchEvent(new Event('change', { bubbles: true }));
  }, id == null ? '' : id);
  await new Promise((r) => setTimeout(r, 150));
};

// Teclea DE VERDAD (foco + teclado), que es lo único que distingue «no se puede escribir» de
// «yo no he escrito».
const teclear = async (texto) => {
  await pag.click('#exp-provider-nif');
  await pag.keyboard.type(texto, { delay: 12 });
  await new Promise((r) => setTimeout(r, 100));
};

try {
  pag.on('response', async (r) => {
    if (r.request().method() === 'POST' && /\/admin\/expenses$/.test(r.url())) {
      respuestaDelAlta = await r.json().catch(() => null);
    }
  });

  await pag.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await pag.goto(BASE + '/login.html', { waitUntil: 'load' });
  informe.login = await pag.evaluate(async (secreto) => {
    const r = await fetch('/auth/test-login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'qa@staging.yaqu', secret: secreto }),
    });
    return r.status;
  }, m[1].trim());
  if (informe.login !== 200) throw new Error('login de QA: ' + informe.login);

  informe.version = await pag.evaluate(async () => (await (await fetch('/version')).json()).version);
  // El despliegue tiene 937b: no basta el SHA, se comprueba el CONTENIDO servido.
  informe.despliegueTiene937b = await pag.evaluate(async (ayuda, aviso) => {
    const t = await (await fetch('/dashboard/js/expensesView.js', { cache: 'no-store' })).text();
    return {
      aplicarNifSegunProveedor: t.includes('aplicarNifSegunProveedor'),
      literalAyuda: t.includes(ayuda),
      literalAviso: t.includes(aviso),
    };
  }, AYUDA, AVISO);
  const d = informe.despliegueTiene937b;
  if (!d.aplicarNifSegunProveedor || !d.literalAyuda || !d.literalAviso) {
    throw new Error('staging no sirve 937b (o los textos firmados han cambiado)');
  }

  // ── Los proveedores de prueba ─────────────────────────────────────────────────────────────
  // Permiso del orquestador por el canal (20-sep-2026) y sus cuatro condiciones: exactamente 2,
  // el nombre empieza por «ZZZ PRUEBA 937» para que se vean de lejos, se borran en la misma tanda
  // y sólo en staging. Se crean sólo con `--crear-proveedores`: sin la bandera esto no toca nada.
  //
  // ⚠️ Medido en la ruta (`src/modules/providers/app/routes/providers.routes.ts`): NI el POST NI el
  // PUT aceptan `taxId` — sólo name/phone/email/notes/isActive. El ÚNICO que escribe el NIF de una
  // ficha es `guardarNifDelProveedor`, o sea el mecanismo que este banco viene a probar. Por eso el
  // proveedor CON NIF no se puede fabricar sin crear otro gasto, y P2 se queda sin evaluar.
  if (process.argv.includes('--crear-proveedores')) {
    informe.proveedoresCreados = await pag.evaluate(async () => {
      const crear = async (name) => {
        const r = await fetch('/admin/providers', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        const j = await r.json().catch(() => null);
        return { name, status: r.status, id: j && j.item ? j.item.id : null, error: j && j.error };
      };
      return [await crear('ZZZ PRUEBA 937 sin NIF'), await crear('ZZZ PRUEBA 937 con NIF')];
    });
    creadosProveedores = informe.proveedoresCreados.filter((p) => p.id != null).map((p) => p.id);
  }

  // ── POBLACIÓN: los proveedores del merchant QA ────────────────────────────────────────────
  const provs = await pag.evaluate(async () => {
    const r = await (await fetch('/admin/providers')).json();
    return (Array.isArray(r) ? r : (r.items || [])).map((p) => ({ id: p.id, name: p.name, taxId: p.taxId || null }));
  });
  // Por NOMBRE y no por posición: si algún día el merchant QA tiene proveedores de verdad, este
  // banco tiene que seguir cogiendo los suyos y no los del negocio.
  const sinNif = provs.find((p) => !p.taxId && /ZZZ PRUEBA 937 sin NIF/.test(p.name)) || provs.find((p) => !p.taxId) || null;
  const conNif = provs.find((p) => p.taxId) || null;
  informe.poblacionProveedores = { total: provs.length, conNif: provs.filter((p) => p.taxId).length, sinNif: provs.filter((p) => !p.taxId).length };
  informe.elegidos = { sinNif: sinNif && { id: sinNif.id, name: sinNif.name }, conNif: conNif && { id: conNif.id, name: conNif.name } };

  await pag.goto(BASE + '/dashboard/#expenses', { waitUntil: 'networkidle2' });
  await pag.waitForSelector('#exp-new-btn', { timeout: 15000 });
  await quieto();
  await pag.click('#exp-new-btn');
  await pag.waitForSelector('#exp-provider-nif', { timeout: 10000 });
  // La lista de proveedores decide el estado del campo al llegar: se espera A QUE LLEGUE, o se
  // estaría midiendo el estado de nacimiento y no el que decide `aplicarNifSegunProveedor`.
  informe.listaDeProveedoresLlego = await pag.waitForFunction(
    () => document.querySelector('#exp-providerid option[value=""]')?.textContent.includes('Sin proveedor'),
    { timeout: 15000 },
  ).then(() => true, () => false);
  if (!informe.listaDeProveedoresLlego) throw new Error('la lista de proveedores no llegó: el modal no está en el estado que se mide');

  // ── A · sin proveedor ─────────────────────────────────────────────────────────────────────
  await elegirProveedor(null);
  informe.fases.A_antesDeTeclear = await pag.evaluate(LEER);
  await teclear(NIF_TECLEADO);
  informe.fases.A_despuesDeTeclear = await pag.evaluate(LEER);

  // ── P0 · CONTROL POSITIVO DEL TECLEADOR, y no necesita ningún proveedor ────────────────────
  // «Teclear no dejó nada» y «no he llegado a teclear» se leen IGUAL. Con el mismo gesto (clic +
  // teclado) sobre un campo del MISMO modal que NO es de solo lectura: si aquí entra, el vacío de
  // A es del `readOnly` y no de este banco.
  await pag.click('#exp-concept');
  await pag.keyboard.type('CONTROL TECLEADOR', { delay: 12 });
  await new Promise((r) => setTimeout(r, 100));
  informe.fases.P0_tecleadorFunciona = await pag.evaluate(() => document.getElementById('exp-concept').value);
  await pag.evaluate(() => { document.getElementById('exp-concept').value = ''; });

  // ── P1 · control positivo: proveedor SIN NIF, el campo se escribe y mi tecleo ENTRA ────────
  if (sinNif) {
    await elegirProveedor(sinNif.id);
    informe.fases.P1_alElegir = await pag.evaluate(LEER);
    await teclear(NIF_TECLEADO);
    informe.fases.P1_despuesDeTeclear = await pag.evaluate(LEER);
  } else {
    informe.fases.P1_alElegir = 'NO HAY proveedor sin NIF en el merchant QA: control positivo IMPOSIBLE';
  }

  // ── P2 · control positivo: proveedor CON NIF, sale el de la ficha y la ayuda se ESCONDE ────
  if (conNif) {
    await elegirProveedor(conNif.id);
    informe.fases.P2 = await pag.evaluate(LEER);
    informe.fases.P2.nifDeLaFicha = conNif.taxId;
  } else {
    informe.fases.P2 = 'NO HAY proveedor con NIF en el merchant QA: control positivo IMPOSIBLE';
  }

  // ── B · el gesto normal: proveedor sin NIF → teclear → volver a «Sin proveedor» → guardar ──
  if (sinNif) {
    await elegirProveedor(sinNif.id);
    await pag.evaluate(() => { document.getElementById('exp-provider-nif').value = ''; });
    await teclear(NIF_TECLEADO);
    informe.fases.B_conProveedor = await pag.evaluate(LEER);
    await elegirProveedor(null);
    informe.fases.B_alQuitarElProveedor = await pag.evaluate(LEER);

    await pag.evaluate((concepto) => {
      document.getElementById('exp-concept').value = concepto;
      document.getElementById('exp-amount').value = '37';
    }, CONCEPTO);
    await quieto();
    const boton = await pag.$('#exp-save');
    await boton.evaluate((b) => b.scrollIntoView({ block: 'center', behavior: 'instant' }));
    await boton.click();
    informe.fases.B_modalCerrado = await pag.waitForFunction(
      () => !document.getElementById('exp-modal'), { timeout: 60000 },
    ).then(() => true, () => false);

    // EL AVISO: se mide el elemento real, su clase, su texto y su color. No una captura.
    informe.fases.B_aviso = await pag.waitForFunction(
      () => document.querySelector('.yaqu-toast[data-kind="warn"]'), { timeout: 15000 },
    ).then(() => pag.evaluate(() => {
      const t = document.querySelector('.yaqu-toast[data-kind="warn"]');
      const cs = getComputedStyle(t);
      return {
        texto: t.textContent.trim(),
        kind: t.dataset.kind,
        seVe: t.checkVisibility ? t.checkVisibility() : null,
        fondo: cs.backgroundColor,
        color: cs.color,
      };
    }), () => ({ error: 'no salió ningún aviso ámbar' }));
    informe.fases.B_destinoDelNif = respuestaDelAlta ? respuestaDelAlta.destinoDelNif : 'no se capturó la respuesta del POST';

    // ESTADO en el servidor: el gasto existe, sin proveedor, y la ficha del proveedor NO se tocó.
    const g = await pag.evaluate(async (concepto) => {
      const r = await (await fetch('/admin/expenses')).json();
      const e = (r.items || []).find((x) => x.concept === concepto);
      return e ? { id: e.id, providerId: e.providerId ?? null } : null;
    }, CONCEPTO);
    if (!g) throw new Error('el gasto de B NO está en el servidor');
    creadoId = g.id;
    informe.fases.B_gasto = g;
    informe.fases.B_fichaDelProveedorSigueSinNif = await pag.evaluate(async (id) => {
      const r = await (await fetch('/admin/providers')).json();
      const p = (Array.isArray(r) ? r : (r.items || [])).find((x) => x.id === id);
      return p ? (p.taxId || null) : 'no encuentro el proveedor';
    }, sinNif.id);
  } else {
    informe.fases.B = 'NO ALCANZABLE desde la pantalla: sin un proveedor sin NIF el campo nunca se desbloquea';
  }
} catch (e) {
  informe.error = e.message;
} finally {
  if (creadoId != null) {
    informe.borrado = await pag.evaluate(async (id) => {
      const r = await fetch('/admin/expenses/' + id, { method: 'DELETE' });
      const lista = await (await fetch('/admin/expenses')).json();
      return { status: r.status, sigue: (lista.items || []).some((x) => x.id === id) };
    }, creadoId).catch((e) => ({ error: e.message }));
  }
  // Condición 3 del permiso: se borran en la misma tanda, y el resultado del borrado se DICE con su
  // id. Un proveedor «supuestamente borrado» es justo lo que el fundador tuvo que limpiar a mano.
  if (creadosProveedores.length) {
    informe.proveedoresBorrados = await pag.evaluate(async (ids) => {
      const out = [];
      for (const id of ids) {
        const r = await fetch('/admin/providers/' + id, { method: 'DELETE' });
        out.push({ id, status: r.status, error: r.ok ? null : (await r.json().catch(() => ({}))).error || null });
      }
      const lista = await (await fetch('/admin/providers')).json();
      const vivos = (Array.isArray(lista) ? lista : (lista.items || [])).map((p) => p.id);
      return { borrados: out, siguenVivos: ids.filter((i) => vivos.includes(i)) };
    }, creadosProveedores).catch((e) => ({ error: e.message }));
  }
  await nav.close();
}

// ── VEREDICTO. Cada casilla dice qué propiedad afirma. ────────────────────────────────────────
const f = informe.fases;
const casillas = {
  'A · sin proveedor el NIF es de SOLO LECTURA': f.A_antesDeTeclear?.nifSoloLectura === true,
  'A · la ayuda firmada SE VE (y es el literal)': f.A_antesDeTeclear?.ayudaHidden === false
    && f.A_antesDeTeclear?.ayudaTexto === AYUDA && f.A_antesDeTeclear?.ayudaSeVe === true
    && f.A_antesDeTeclear?.ayudaAlto > 0,
  'A · teclear NO deja nada en el campo': f.A_despuesDeTeclear?.nifValor === '',
  'P0 · CONTROL POSITIVO: el tecleador de este banco SÍ escribe': f.P0_tecleadorFunciona === 'CONTROL TECLEADOR',
  'P1 · proveedor sin NIF: el campo se escribe': f.P1_alElegir?.nifSoloLectura === false && f.P1_alElegir?.ayudaHidden === true,
  'P1 · CONTROL POSITIVO: mi tecleo SÍ entra': f.P1_despuesDeTeclear?.nifValor === NIF_TECLEADO,
  'P2 · CONTROL POSITIVO: con NIF en ficha sale el de la ficha, bloqueado y sin ayuda':
    f.P2?.nifValor === f.P2?.nifDeLaFicha && f.P2?.nifSoloLectura === true
    && f.P2?.ayudaHidden === true && f.P2?.nifOrigen === 'ficha',
  'B · al quitar el proveedor el NIF tecleado NO se borra': f.B_alQuitarElProveedor?.nifValor === NIF_TECLEADO,
  'B · y vuelve a bloquearse con la ayuda a la vista': f.B_alQuitarElProveedor?.nifSoloLectura === true
    && f.B_alQuitarElProveedor?.ayudaHidden === false,
  'B · tras guardar sale el aviso ámbar con el literal firmado': f.B_aviso?.texto === AVISO && f.B_aviso?.kind === 'warn' && f.B_aviso?.seVe === true,
  'B · el servidor dijo sin_proveedor': f.B_destinoDelNif === 'sin_proveedor',
  'B · el gasto se guardó sin proveedor': f.B_gasto?.providerId === null,
  'B · y la ficha del proveedor sigue SIN NIF': f.B_fichaDelProveedorSigueSinNif === null,
  'el gasto de prueba está BORRADO': informe.borrado?.status === 200 && informe.borrado?.sigue === false,
  'los proveedores de prueba están BORRADOS': informe.proveedoresBorrados?.siguenVivos?.length === 0
    && informe.proveedoresBorrados?.borrados?.every((b) => b.status === 200),
};

// Una casilla que NO SE HA PODIDO EVALUAR no es un fallo ni un acierto: se declara. Contarla como
// roja convertiría «no hay datos» en «la pantalla falla», que es una afirmación distinta y falsa.
// Cada casilla dice de QUÉ dato depende. Una casilla sin su dato no es roja: es no evaluable, y
// contarla roja diría «la pantalla falla» cuando lo que pasa es «no hay con qué probarla».
const falta = (k) => {
  if (/^(P1|B) /.test(k) && !informe.elegidos?.sinNif) return 'no hay proveedor SIN NIF en el merchant QA';
  if (/^P2 /.test(k) && !informe.elegidos?.conNif) return 'no hay proveedor CON NIF: la API de proveedores no deja escribir taxId (ni POST ni PUT)';
  if (/gasto de prueba está BORRADO/.test(k) && !informe.fases?.B_gasto) return 'no se creó ningún gasto, no había nada que borrar';
  if (/proveedores de prueba están BORRADOS/.test(k) && !informe.proveedoresCreados) return 'no se creó ningún proveedor en esta pasada';
  return null;
};

console.log(JSON.stringify(informe, null, 2));
console.log('\n── VEREDICTO ──');
const evaluadas = [];
for (const [k, v] of Object.entries(casillas)) {
  const porque = falta(k);
  if (porque) { console.log('— ' + k + '  (NO EVALUABLE: ' + porque + ')'); continue; }
  evaluadas.push(v);
  console.log((v ? '✔ ' : '🔴 ') + k);
}
const verdes = evaluadas.filter(Boolean).length;
const ok = !informe.error && evaluadas.length > 0 && verdes === evaluadas.length;
console.log(`\nPOBLACION casillas=${Object.keys(casillas).length} evaluadas=${evaluadas.length} verdes=${verdes} · no evaluables=${Object.keys(casillas).length - evaluadas.length} · proveedores=${JSON.stringify(informe.poblacionProveedores)}`);
if (informe.proveedoresCreados) console.log('PROVEEDORES DE PRUEBA creados=' + JSON.stringify(informe.proveedoresCreados) + ' · borrados=' + JSON.stringify(informe.proveedoresBorrados));
if (informe.error) console.log('ERROR: ' + informe.error);
console.log('EXIT=' + (ok ? 0 : 1));
process.exit(ok ? 0 : 1);
