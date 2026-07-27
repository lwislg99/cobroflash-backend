// public/dashboard/js/exportView.js — SCRUM-138 (EXPORT-2)
//
// "Descargar datos" vivía en Configuración, donde no lo encuentra nadie: es el entregable
// para el asesor y para una inspección, o sea DINERO, no una preferencia de la cuenta.
// Ahora es apartado propio dentro de Finanzas, al lado de Informes / Facturas / Gastos.
//
// Movido DESDE settingsView.js (`renderExportDataCard`) — misma lógica de descarga, tope y
// contador vivo, más la selección de qué incluir. Lo que cambia es dónde vive y que ya no
// hay que descargarlo todo para llevarte una tabla.
//
// ⚠️ GATES DE SCRUM-25 INTACTOS: el endpoint sigue siendo admin-only en BACKEND (el router
// entero va montado con requireRole + ADMIN_ONLY_ROUTES). Esta vista es UX; la seguridad no
// depende de ella. El XML VeriFactu sigue atado a INVOICING_ES_ENABLED: marcar "Facturas"
// NO lo enciende (ver resolverSeleccion — es un AND, nunca un OR).
//
// La descarga va por fetch + blob (no navegación directa) para poder leer el nombre que
// manda el servidor: si el paquete sale incompleto viene marcado como INCOMPLETO y esa
// señal tiene que llegar al fichero guardado.

// Los 6 datasets del paquete. El orden es el de lectura del asesor, no el alfabético.
const EXPORT_DATASETS = [
  { id: 'facturas',     label: 'Facturas',      nota: 'CSV + el PDF de cada una' },
  { id: 'cobros',       label: 'Cobros',        nota: 'Qué se cobró, cuándo y por qué vía' },
  { id: 'gastos',       label: 'Gastos',        nota: 'Tus costes, para el margen real' },
  { id: 'presupuestos', label: 'Presupuestos',  nota: 'Enviados, aceptados y rechazados' },
  { id: 'trabajos',     label: 'Trabajos',      nota: 'Por fecha de ejecución prevista' },
  { id: 'clientes',     label: 'Clientes',      nota: 'Los que aparecen en lo que descargues' },
];

async function renderExportView(container) {
  container.innerHTML = `
    <div style="max-width:860px">
      <div class="customers-card" style="margin-bottom:16px">
        <h2 style="margin:0 0 4px;font-size:18px;font-weight:700;color:var(--ink)">Descargar datos</h2>
        <p style="margin:0;font-size:13px;color:var(--muted)">
          Un archivo ZIP con tus datos en CSV, listo para tu asesor o para una inspección.
          Elige el periodo y qué quieres llevarte.
        </p>
      </div>

      <div class="customers-card" style="margin-bottom:16px">
        <div style="font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Qué incluir</div>
        <div id="export-datasets" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px"></div>
        <p style="margin:12px 0 0;font-size:12px;color:var(--neutral-400)">
          Sin marcar nada se descarga todo. Los PDF de factura y el registro VeriFactu solo
          entran si incluyes las facturas.
        </p>
      </div>

      <div class="customers-card">
        <div style="font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Periodo</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
          <div>
            <label for="export-from" style="display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Desde</label>
            <input type="date" id="export-from" class="input" style="width:auto">
          </div>
          <div>
            <label for="export-to" style="display:block;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);margin-bottom:4px">Hasta</label>
            <input type="date" id="export-to" class="input" style="width:auto">
          </div>
          <button class="btn-primary" id="btn-export-zip" style="min-height:44px">Descargar ZIP</button>
        </div>
        <p id="export-info" style="margin:12px 0 0;font-size:12px;color:var(--muted)" aria-live="polite">
          Sin fechas se descarga todo.
        </p>
      </div>
    </div>
  `;

  const dsBox = document.getElementById('export-datasets');
  EXPORT_DATASETS.forEach((d) => {
    const l = document.createElement('label');
    l.style.cssText = 'display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:13.5px;color:var(--ink);min-height:44px;padding:6px 0';
    l.innerHTML = `
      <input type="checkbox" class="export-ds" value="${d.id}" style="margin-top:3px;flex:none">
      <span><b style="font-weight:600">${d.label}</b><br><span style="color:var(--neutral-400);font-size:12px">${d.nota}</span></span>
    `;
    dsBox.appendChild(l);
  });

  const btn = document.getElementById('btn-export-zip');
  const info = document.getElementById('export-info');
  const inputFrom = document.getElementById('export-from');
  const inputTo = document.getElementById('export-to');
  let generando = false;

  const marcados = () => [...document.querySelectorAll('.export-ds:checked')].map((c) => c.value);

  const params = () => {
    const qs = new URLSearchParams();
    if (inputFrom.value) qs.set('from', inputFrom.value);
    if (inputTo.value) qs.set('to', inputTo.value);
    // Nada marcado = todo. NO se manda `incluir` vacío: el backend trata lo ilegible como
    // "todo", pero mandar la ambigüedad desde aquí sería pedirle que adivine.
    const ds = marcados();
    if (ds.length > 0 && ds.length < EXPORT_DATASETS.length) qs.set('incluir', ds.join(','));
    return qs;
  };

  // Aviso ANTES de pulsar: cuántas facturas caen en el rango y si pasa del tope. El máximo
  // lo dice el backend (MAX_FACTURAS_ZIP), no se duplica aquí.
  async function refrescarInfo() {
    if (generando) return;
    if (inputFrom.value && inputTo.value && inputFrom.value > inputTo.value) {
      info.textContent = 'La fecha "Desde" es posterior a "Hasta".';
      btn.disabled = true;
      return;
    }
    try {
      const qs = params();
      const d = await apiRequest('/admin/exports/datos.zip/info' + (qs.toString() ? `?${qs}` : ''));
      const ds = marcados();
      const sufijoSeleccion = (ds.length > 0 && ds.length < EXPORT_DATASETS.length)
        ? ` Se descargará solo: ${ds.join(', ')}.`
        : '';
      if (d.excede) {
        btn.disabled = true;
        info.textContent = `Tu rango incluye ${d.facturas} facturas y el máximo por descarga es ${d.maximo}. Acota las fechas y descarga por partes.`;
      } else {
        btn.disabled = false;
        const base = d.facturas === 1 ? '1 factura' : `${d.facturas} facturas`;
        info.textContent = (d.facturas === 0
          ? `Sin facturas en este rango (los CSV se descargan igual). Máximo por descarga: ${d.maximo}.`
          : `${base} en este rango (máximo ${d.maximo}). Preparar el archivo puede tardar hasta un par de minutos.`) + sufijoSeleccion;
      }
    } catch {
      // Si el conteo falla no bloqueamos la descarga: el backend vuelve a validar el tope.
      info.textContent = 'Sin fechas se descarga todo.';
      btn.disabled = false;
    }
  }
  inputFrom.addEventListener('change', refrescarInfo);
  inputTo.addEventListener('change', refrescarInfo);
  dsBox.addEventListener('change', refrescarInfo);
  refrescarInfo();

  btn.addEventListener('click', async () => {
    if (generando) return;               // el botón no acepta un segundo clic
    generando = true;
    btn.disabled = true;
    const txt = btn.textContent;

    // Contador VIVO: con esperas de un minuto, un "Preparando…" congelado parece colgado.
    const t0 = Date.now();
    const tick = setInterval(() => {
      const s = Math.round((Date.now() - t0) / 1000);
      btn.textContent = `Preparando… ${s}s`;
    }, 1000);
    btn.textContent = 'Preparando… 0s';
    info.textContent = 'Generando el archivo. Puedes seguir trabajando; no cierres esta pestaña.';

    try {
      const qs = params();
      const res = await fetch('/admin/exports/datos.zip' + (qs.toString() ? `?${qs}` : ''), {
        credentials: 'same-origin',
      });

      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.message || 'No se pudo preparar el archivo.', 'error');
        info.textContent = d.message || 'No se pudo preparar el archivo.';
        return;
      }

      // El nombre lo decide el servidor: si el paquete salió incompleto viene marcado
      // como yaqu-datos-INCOMPLETO-… y esa señal debe llegar al fichero guardado.
      const cd = res.headers.get('content-disposition') || '';
      const m = /filename="([^"]+)"/.exec(cd);
      const nombre = m ? m[1] : 'yaqu-datos.zip';

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      if (nombre.includes('INCOMPLETO')) {
        showToast('Descargado, pero el paquete está INCOMPLETO: faltan PDF. Mira el aviso dentro del ZIP.', 'warn');
        info.textContent = 'El paquete se descargó INCOMPLETO: faltan PDF de factura. Vuelve a generarlo antes de entregarlo.';
      } else {
        showToast('✓ Archivo descargado');
        info.textContent = 'Archivo descargado.';
      }
    } catch (err) {
      showToast('No se pudo preparar el archivo: ' + (err && err.message ? err.message : 'inténtalo de nuevo'), 'error');
    } finally {
      clearInterval(tick);
      btn.textContent = txt;
      generando = false;
      refrescarInfo();                    // re-habilita según el rango actual
    }
  });
}

window.renderExportView = renderExportView;
