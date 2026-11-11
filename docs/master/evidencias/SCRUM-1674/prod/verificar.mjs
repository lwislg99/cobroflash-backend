// SCRUM-1674 (+ medida de SCRUM-1662) · verificación en yaqu.app con la cuenta QA (QA en producción autorizado).
// ESCRIBE a propósito, y sólo en la cuenta QA: crea DOS trabajos de prueba («[QA-1674] …») y abre su parte
// con el botón real «Parte de trabajo» de la ficha del trabajo. Lo que se mide:
//   A · trabajo CON dirección de obra y tipo → el parte nace con esa obra y ese tipo.
//   B · trabajo SIN dirección ni tipo, de un cliente CON dirección de facturación → el parte nace VACÍO
//       (DOC-12: jamás desde facturación; lo vacío se queda vacío).
//   1662 · dónde cae en la ficha del trabajo el «qué hay que hacer» (descripcion → Job.notes).
import { abrir, ir, foto } from '../../SCRUM-1658/banco/lib.mjs';

const s = await abrir(390, 844);
const out = {};
try {
  await ir(s.page, '#jobs');
  await s.page.waitForTimeout(1500);
  const api = (ruta, metodo = 'GET', cuerpo) => s.page.evaluate(async ([ruta, metodo, cuerpo]) => {
    const res = await fetch(ruta, { method: metodo, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
    let j = null; try { j = await res.json(); } catch (_e) { /* sin cuerpo */ }
    return { status: res.status, j };
  }, [ruta, metodo, cuerpo]);

  // Cliente con dirección de FACTURACIÓN: la cebo de DOC-12 (si el parte la copiase, se vería).
  const CLIENTE = 86;
  const cli = await api('/admin/customers/' + CLIENTE);
  out.cliente = { status: cli.status, billingAddress: cli.j && cli.j.billingAddress };
  if (cli.j && !cli.j.billingAddress) {
    const p = await api('/admin/customers/' + CLIENTE, 'PATCH', { billingAddress: 'Avenida Facturación QA 99' });
    out.clienteParche = p.status;
    const re = await api('/admin/customers/' + CLIENTE);
    out.cliente.billingAddressTras = re.j && re.j.billingAddress;
  }

  const DESC = 'QA SCRUM-1662: cambiar el termo del baño y purgar radiadores';
  const crearA = await api('/admin/jobs', 'POST', { customerId: CLIENTE, titulo: '[QA-1674] con obra y tipo', direccion: '  Calle Obra QA 1674, 5º A  ', tipoIntervencion: 'MANTENIMIENTO', descripcion: DESC });
  const crearB = await api('/admin/jobs', 'POST', { customerId: CLIENTE, titulo: '[QA-1674] sin obra ni tipo' });
  const idDe = (r) => r.j && (r.j.id || (r.j.job && r.j.job.id));
  out.crear = { A: { status: crearA.status, id: idDe(crearA), err: crearA.status >= 400 ? crearA.j : null }, B: { status: crearB.status, id: idDe(crearB), err: crearB.status >= 400 ? crearB.j : null } };

  for (const [k, jobId] of [['A', idDe(crearA)], ['B', idDe(crearB)]]) {
    if (!jobId) continue;
    await s.page.evaluate((id) => window.renderAppView('jobs-detail', { jobId: id }), jobId);
    await s.page.waitForTimeout(2500);
    if (k === 'A') {
      // 1662: el texto de «qué hay que hacer», ¿bajo qué rótulo se ve?
      out.ficha1662 = await s.page.evaluate((desc) => {
        const t = document.body.innerText;
        const i = t.indexOf(desc.slice(0, 20));
        return { visibleEnLaFicha: i >= 0, contexto: i >= 0 ? t.slice(Math.max(0, i - 160), i + 90) : null,
          notasInternas: /Notas internas/.test(t), soloTu: /Solo tú las ves/.test(t) };
      }, DESC);
      out.fotoFichaA = await foto(s, 'c1674-ficha-trabajo-A');
    }
    const boton = s.page.locator('[data-abrir-parte]').first();
    out['boton' + k] = await boton.count();
    await boton.click();
    await s.page.waitForTimeout(3000);
    const lista = await api('/admin/partes');
    const suyos = ((lista.j && lista.j.partes) || []).filter((p) => p.jobId === jobId);
    const parte = suyos[0];
    if (!parte) { out['parte' + k] = { error: 'el botón no creó parte', n: suyos.length }; continue; }
    const det = await api('/admin/partes/' + parte.id);
    const p = det.j && (det.j.parte || det.j);
    const crudo = JSON.stringify(det.j || {});
    out['parte' + k] = { jobId, id: parte.id, numero: p && p.numero, estado: p && p.estado, obra: p && p.obra, tipo: p && p.tipo, nPartesDelTrabajo: suyos.length,
      facturacionEnLaRespuesta: crudo.includes('Facturación QA') || (out.cliente.billingAddress ? crudo.includes(out.cliente.billingAddress) : false) };
    out['vista' + k] = await s.page.evaluate(() => (document.body.innerText.match(/.{0,50}(Calle Obra QA|Mantenimiento|Obra|Tipo).{0,50}/g) || []).slice(0, 8));
    out['foto' + k] = await foto(s, 'c1674-parte-' + k);
  }
  if (s.log.length) out.log = s.log;
  console.log(JSON.stringify(out, null, 2));
} finally { await s.browser.close(); }
