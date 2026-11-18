// SCRUM-1679 · REGLA 42 en yaqu.app (cuenta QA): se crea un trabajo DE VERDAD con tarea y dirección,
// «Abrir trabajo» tiene que ATERRIZAR en su ficha, y su tarjeta de la lista tiene que decir las dos cosas.
//
// Acción del banco H6 (`docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs`):
//   mirar   BANCO_OUT=<fuera del repo>          node …/paso2.mjs <ancho> "#jobs" r42 <este fichero>
//   crear   BANCO_OUT=<fuera del repo> HACER=1  node …/paso2.mjs <ancho> "#jobs" r42 <este fichero>
//   releer  BANCO_OUT=<fuera del repo> TRABAJO=<id>  node …/paso2.mjs <ancho> "#jobs" r42 <este fichero>
//
// 🔴 ESCRIBE EN PRODUCCIÓN con HACER=1: un `POST /admin/jobs` en la cuenta QA. El trabajo se QUEDA, nombrado
// «(prueba)», y se declara en el registro. Sin HACER=1 abre el modal, apunta sus campos y no crea nada.
// Con TRABAJO=<id> no crea: relee la tarjeta de ese trabajo (para medirla a otro ancho sin crear otro).
// No usa `.route(`: lo que se mide es lo que sirve producción, sin nada servido encima.
//
// SUELO: si la lista no pinta ninguna tarjeta, o el POST no devuelve un id, CIEGO (código 1).
export const DIRECCION = 'Calle de la Regla 42, n.º 18, 1.º A, 28801 Alcalá de Henares';
export const TAREA = '(prueba) Regla 42 de SCRUM-1679 del 18-nov: revisar la presión de la caldera y cambiar la válvula de seguridad.';
const CLIENTE = 'Marta Prieto (PILOTO-1 QA)';

const tarjetaDe = (id) => {
  const filas = [...document.querySelectorAll('tr.jobs-fila')];
  const de = (tr, sel) => { const e = tr.querySelector('td.cell-client ' + sel); return e ? e.textContent.trim() : null; };
  const todas = filas.map((tr) => ({
    id: tr.dataset.jobId || tr.dataset.id || null,
    cliente: de(tr, '.jobs-fila-cliente'), tarea: de(tr, '.jobs-fila-tarea'), direccion: de(tr, '.jobs-fila-direccion'),
    botones: [...tr.querySelectorAll('button')].filter((b) => b.getBoundingClientRect().width > 0).map((b) => b.textContent.replace(/\s+/g, ' ').trim()),
    atributos: [...tr.attributes].map((a) => `${a.name}=${a.value}`).join(' ').slice(0, 160),
  }));
  return { total: todas.length, conTarea: todas.filter((t) => t.tarea).length, conDireccion: todas.filter((t) => t.direccion).length, todas, pedida: id };
};

async function leerTarjeta(s, h, queTarea, queDireccion) {
  await h.ir(s.page, '#jobs');
  const l = await s.page.evaluate(tarjetaDe, null);
  if (!l.total) throw new Error('CIEGO: la lista no pinta ninguna tarjeta (tr.jobs-fila)');
  s.nota(`TESTIGO lista @${s.ancho}: ${l.total} tarjetas · con tarea ${l.conTarea} · con dirección ${l.conDireccion}`);
  const mias = l.todas.filter((t) => t.tarea === queTarea);
  s.nota(`tarjetas cuya tarea es LA ESCRITA: ${mias.length}`);
  for (const t of mias) s.nota('TARJETA ' + JSON.stringify(t));
  await s.mide('lista');
  if (mias.length !== 1) throw new Error(`ROJO: ${mias.length} tarjetas pintan la tarea escrita (se espera 1)`);
  if (mias[0].direccion !== queDireccion) throw new Error(`ROJO: la tarjeta pinta la dirección «${mias[0].direccion}» y se escribió «${queDireccion}»`);
  if (mias[0].cliente !== CLIENTE) throw new Error(`ROJO: la tarjeta es de «${mias[0].cliente}» y el trabajo se creó para «${CLIENTE}»`);
  return mias[0];
}

export default async (s, h) => {
  const p = s.page;
  if (process.env.TRABAJO) {
    s.nota(`RELECTURA del trabajo #${process.env.TRABAJO}: no se crea nada`);
    await leerTarjeta(s, h, TAREA, DIRECCION);
    return;
  }
  const antes = await p.evaluate(tarjetaDe, null);
  if (!antes.total) throw new Error('CIEGO: la lista no pinta ninguna tarjeta (tr.jobs-fila)');
  s.nota(`ANTES @${s.ancho}: ${antes.total} tarjetas · con tarea ${antes.conTarea} · con dirección ${antes.conDireccion}`);
  await p.getByRole('button', { name: /Nuevo trabajo/ }).first().click();
  await p.waitForTimeout(900);
  s.nota('botón del modal: «' + (await p.locator('#tn-crear').innerText()).trim() + '»');
  s.nota('tipos que ofrece: ' + (await p.locator('#tn-tipo option').allInnerTexts()).join(' / '));
  // El cliente se carga por red DESPUÉS de abrir el modal: se espera a que el desplegable lo tenga y se dice
  // si está, también en la pasada de mirar (sin él, la de crear moriría en el `selectOption`, antes de escribir).
  await p.waitForFunction(() => document.querySelectorAll('#tn-cliente option').length > 2, null, { timeout: 8000 }).catch(() => {});
  const clientes = await p.locator('#tn-cliente option').allInnerTexts();
  s.nota(`clientes en el desplegable: ${clientes.length - 2} · está «${CLIENTE}»: ${clientes.includes(CLIENTE)}`);
  if (!clientes.includes(CLIENTE)) throw new Error(`CIEGO: «${CLIENTE}» no está entre los clientes de la cuenta; no se crea nada`);
  if (process.env.HACER !== '1') { await s.mide('modal'); s.nota('SIN HACER=1: no se crea nada'); return; }
  const pedidas = [];
  p.on('response', (r) => { if (r.request().method() === 'GET' && /\/admin\/jobs\/\d+$/.test(new URL(r.url()).pathname)) pedidas.push(`${new URL(r.url()).pathname} → ${r.status()}`); });
  await p.locator('#tn-cliente').selectOption({ label: CLIENTE });
  await p.waitForTimeout(300);
  await p.locator('#tn-tipo').selectOption({ index: 1 });
  s.nota('tipo elegido: ' + (await p.locator('#tn-tipo').evaluate((e) => `${e.value} · «${e.options[e.selectedIndex].text}»`)));
  await p.locator('#tn-direccion').fill(DIRECCION);
  await p.locator('#tn-descripcion').fill(TAREA);
  await s.mide('relleno');
  const resp = p.waitForResponse((r) => r.url().endsWith('/admin/jobs') && r.request().method() === 'POST', { timeout: 15000 });
  await p.locator('#tn-crear').click();
  const r = await resp;
  let j = null; try { j = await r.json(); } catch { /* no es JSON */ }
  s.nota(`POST /admin/jobs → ${r.status()} · id=${j && j.id} · status=${j && j.status} · queHayQueHacer igual a lo escrito=${j && j.queHayQueHacer === TAREA} · direccion igual=${j && j.direccion === DIRECCION} · tipoIntervencion=${j && j.tipoIntervencion}`);
  if (!j || !j.id) throw new Error(`CIEGO: el POST respondió ${r.status()} sin id; no hay trabajo que seguir`);
  const esperado = `#jobs-detail/${j.id}`;
  await p.waitForFunction((e) => location.hash === e, esperado, { timeout: 8000 }).catch(() => {});
  await p.waitForTimeout(2500);
  // ── ¿ATERRIZA? El hash solo no prueba nada (se queda como se escribió aunque el panel pinte otra cosa:
  // `paso2.mjs`, 16-nov). Se miran cuatro cosas: el hash, que el panel PIDIÓ ese trabajo al servidor, que ya no
  // se pinta la lista, y que la pantalla dice lo que se escribió. La ficha guarda parte en líneas plegables
  // (`<details>`), que `innerText` no lee cerradas: se apunta lo VISIBLE y lo que hay en el DOM, por separado.
  const donde = await p.evaluate(() => {
    const raiz = document.querySelector('#view-container, .view-container, main') || document.body;
    return {
      hash: location.hash,
      modalAbierto: [...document.querySelectorAll('.modal-overlay')].some((m) => m.getBoundingClientRect().width > 0),
      visible: raiz.innerText,
      dom: raiz.textContent + '\n' + [...raiz.querySelectorAll('textarea, input')].map((c) => c.value).join('\n'),
      filasDeLista: document.querySelectorAll('tr.jobs-fila').length,
    };
  });
  const pidioLaFicha = pedidas.some((x) => x.startsWith(`/admin/jobs/${j.id} → 2`));
  const ve = { tarea: donde.visible.includes(TAREA), direccion: donde.visible.includes(DIRECCION) };
  const hay = { tarea: donde.dom.includes(TAREA), direccion: donde.dom.includes(DIRECCION) };
  s.nota(`ATERRIZA: hash=${donde.hash} (se espera ${esperado}) · el panel pidió la ficha=${pidioLaFicha} [${pedidas.join(' ; ')}] · modal abierto=${donde.modalAbierto} · filas de lista pintadas=${donde.filasDeLista}`);
  s.nota(`LA FICHA DICE · a la vista: tarea=${ve.tarea} dirección=${ve.direccion} · en el DOM (plegado incluido): tarea=${hay.tarea} dirección=${hay.direccion}`);
  await s.mide('ficha');
  // 🔴 El trabajo YA está creado: pase lo que pase con la ficha, su tarjeta se lee en ESTA pasada (si no, un rojo
  // de la ficha dejaría el trabajo creado y la mitad de la medida sin hacer). Los rojos de la ficha se lanzan al final.
  s.nota(`TRABAJO CREADO Y DECLARADO: #${j.id} · ${CLIENTE}`);
  const t = await leerTarjeta(s, h, TAREA, DIRECCION);
  s.nota(`TARJETA de #${j.id}: tarea=«${t.tarea}» · dirección=«${t.direccion}» · botones: ${t.botones.join(' · ')}`);
  if (donde.hash !== esperado) throw new Error(`ROJO: tras «Abrir trabajo» el panel está en ${donde.hash}, no en ${esperado}`);
  if (!pidioLaFicha) throw new Error(`ROJO: tras crear, el panel no pidió /admin/jobs/${j.id}`);
  if (donde.modalAbierto) throw new Error('ROJO: el modal sigue abierto tras crear');
  if (donde.filasDeLista) throw new Error('ROJO: tras crear se sigue viendo la LISTA, no la ficha');
  if (!hay.tarea || !hay.direccion) throw new Error('ROJO: la ficha en la que aterriza no lleva la tarea o la dirección del trabajo recién creado');
};
