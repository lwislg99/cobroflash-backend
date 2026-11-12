// SCRUM-1698 · verificación en yaqu.app (regla 42) con la cuenta QA (QA en producción autorizado).
// ESCRIBE a propósito, y sólo en la cuenta QA: rellena UN borrador con una línea, km = 0 y SIN horas ni
// desplazamiento, lo firma, y fotografía el parte firmado a 390. Lo que se mide: los campos vacíos dicen
// «Sin apuntar» y el cero sigue siendo «0 km».
import { abrir, ir, foto } from '../../SCRUM-1658/banco/lib.mjs';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const s = await abrir(390, 844);
try {
  await ir(s.page, '#jobs');
  await s.page.waitForTimeout(2000);
  const r = await s.page.evaluate(async (png) => {
    const api = async (ruta, metodo = 'GET', cuerpo) => {
      const res = await fetch(ruta, { method: metodo, credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
      let j = null; try { j = await res.json(); } catch (_e) { /* sin cuerpo */ }
      return { status: res.status, j };
    };
    const lista = await api('/admin/partes');
    const partes = (lista.j && lista.j.partes) || [];
    const borr = partes.find((p) => p.estado === 'borrador' && p.jobId === 77) || partes.find((p) => p.estado === 'borrador');
    if (!borr) return { error: 'no hay borrador', estados: partes.map((p) => p.estado) };
    const patch = await api('/admin/partes/' + borr.id, 'PATCH', { lineas: [{ bloque: 'mano_obra', unds: 1, descripcion: 'Revisión QA SCRUM-1698' }], kilometros: 0 });
    const firma = await api('/admin/partes/' + borr.id + '/firmar', 'POST', { signatureData: png, firmadoPorCalidad: 'el_propio_cliente', firmadoPorNombre: 'Cliente QA' });
    const tras = await api('/admin/partes/' + borr.id);
    const p = tras.j && (tras.j.parte || tras.j);
    return { id: borr.id, numero: borr.numero, patch: patch.status, patchErr: patch.status >= 400 ? patch.j : null, firma: firma.status, firmaErr: firma.status >= 400 ? firma.j : null,
      estado: p && p.estado, entrada: p && p.entrada, salida: p && p.salida, km: p && p.kilometros, desplazamientos: p && p.desplazamientos };
  }, PNG);
  console.log(JSON.stringify(r));
  if (r.id) {
    await s.page.evaluate((id) => window.renderAppView && window.renderAppView('parte-detail', { parteId: id }), r.id);
    await s.page.waitForTimeout(2500);
    const vista = await s.page.evaluate(() => {
      const t = document.body.innerText;
      return { sinApuntar: (t.match(/Sin apuntar/g) || []).length, ceroKm: /\b0 km\b/.test(t), extracto: (t.match(/.{0,40}(Sin apuntar|0 km).{0,40}/g) || []).slice(0, 6) };
    });
    console.log(JSON.stringify(vista));
    console.log(await foto(s, 'c1698-prod-firmado-390'));
  }
  if (s.log.length) console.log('log:', s.log.join('\n'));
} finally { await s.browser.close(); }
