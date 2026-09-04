// public/dashboard/js/productsView.js

// ═══════════════════════════════════════════════════════════════════════════════════════
// SCRUM-641 · UN CÓDIGO DEL SERVIDOR NO ES UN MENSAJE PARA UNA PERSONA.
//
// LO QUE PASABA: las llamadas de aquí abajo hacen `throw new Error(data?.error || "Error
// actualizando…")`, y el aviso pintaba `e.message`. Cuando el servidor contesta
// `{ok:false, error:"name_duplicate"}`, el identificador GANA al respaldo en castellano — así
// que un fontanero mirando su catálogo leía literalmente `name_duplicate`: una cadena en
// inglés con guion bajo, sin forma de saber qué le dicen. No es un mensaje mal redactado; es
// una tubería interna asomando a la interfaz.
//
// POR QUÉ VIVE AQUÍ Y NO EN `api.js`, que es donde están los mapeos canónicos
// (`invoiceStatusMeta`, `jobStatusMeta`): porque `api.js` es ZONA SIN MARCADOR por decisión
// —lo fija `scrum405-microcopy-descarga.test.mjs`, que falla si vuelve a aparecer uno— y esto
// necesita marcador. Y además queda más honesto: el texto sin aprobar lo pinta ESTA pantalla,
// así que es esta la que entra en el censo de marcadores.
//
// ⚠️ EL CRITERIO DE `invoiceStatusMeta` SE INVIERTE A PROPÓSITO, que si no parecería un
// descuido. Allí lo desconocido «se ve» —cae al propio código en mayúsculas— para que un
// estado sin mapear no se disfrace del más inocente. Un aviso de error NO puede hacer eso:
// enseñar el código ES el defecto que esto cierra. Así que lo desconocido cae al respaldo en
// castellano que cada llamada YA traía, y el código sale por `console.warn` — donde lo ve
// quien puede mapearlo, no quien está intentando cobrar.
// ═══════════════════════════════════════════════════════════════════════════════════════

// ⚠️ EL MARCADOR YA NO SE PINTA: se queda SÓLO como respaldo de ÚLTIMO RECURSO, para el caso en
// que una llamada no traiga respaldo en castellano. Hoy las ocho lo traen, así que no es
// alcanzable; se conserva porque una llamada nueva que lo olvide tiene que enseñar que falta un
// texto, no una cadena vacía (`.alert:empty` no se pinta, y el error desaparecería en silencio).
// Es el mismo reparto que el fichero gemelo `providersView.js` (SCRUM-644), que ya convive con un
// texto aprobado en el mapa y el marcador aquí abajo. Criterio COPIADO, no inventado.
const PV_MARCADOR_MICROCOPY = '[PENDIENTE microcopy oficial]';

// ── SCRUM-641 · EL TEXTO DEL NOMBRE COGIDO ───────────────────────────────────────────────────
//
// ✅ APROBADO POR EL ASESOR el 4-sep-2026, PROVISIONAL a la espera de la firma del fundador.
// El registro va en `docs/master/SCRUM-641.md` y NO en `docs/microcopy/`: ese directorio es el
// registro del FUNDADOR y `constaAprobado()` lo barre (SCRUM-726), así que meter ahí la firma del
// asesor la haría pasar por la suya.
//
// 🔴 DICE «YA TIENES» Y NO «ese nombre está en uso»: le dice al profesional que el choque es con
// algo SUYO. Quien lee «en uso» se pregunta de quién es, y en un multi-tenant esa duda es peor
// que el error.
//
// 🔴 NO LLEVA SALIDA («cambia el nombre»): se lee con el campo del nombre delante, así que la
// salida es obvia y la frase sobraría. Precedente de la casa: un 409 que decía «no lo hemos
// duplicado» y acababa mandando a crearlo otra vez.
//
// 🔴 NO MENCIONA LOS DESACTIVADOS aunque sean probablemente la causa frecuente: eso es SCRUM-631
// y está esperando al fundador. No se explica algo que todavía no es verdad.
//
// LA CAJA, MEDIDA en el DOM renderizado (Playwright) antes de aprobarlo — 37 caracteres:
//   · 929 px → útil 561 px (546 con barra de scroll): una línea, sobra el triple.
//   · 390 px → útil 279 px CON barra de scroll: una línea, capacidad medida 45 caracteres.
//   · 320 px → útil 224 px: dos líneas, y la página no scrollea en horizontal (SCRUM-469).
//
// ⚠️ SIN MARCADOR en pantalla, mismo criterio que `jobDetailView.js` (SCRUM-607) y
// `filtroClientes.js` (SCRUM-582). Que no se pinte el corchete NO significa que esté firmado por
// el fundador: eso lo dice `PV_SIN_APROBAR`, aquí abajo.
const PV_NOMBRE_DUPLICADO = 'Ya tienes un producto con ese nombre.';

// Cuántas ranuras estrena esta pantalla SIN la firma del fundador. UNA: el texto de arriba.
//
// Se queda aunque llegue a 0, por el motivo de `filtroClientes.js` y `quoteDireccionObra.js`: el
// día que el traductor gane un segundo texto, ese texto nace sin firma y este número tiene que
// subir. Borrarlo dejaría el hueco sin sitio donde declararse.
const PV_SIN_APROBAR = 1;

// Un identificador interno no lleva espacios ni mayúsculas: `name_duplicate`, `forbidden`,
// `trial_expired`. Una frase escrita para una persona siempre lleva una de las dos cosas.
const PV_ES_IDENTIFICADOR = /^[a-z][a-z0-9_]*$/;

/**
 * El texto que se le enseña a la persona a partir de lo que dijo el servidor.
 *
 * `respaldo` es el mensaje en castellano que la llamada ya traía: no es microcopy nueva, es la
 * que estaba escrita y que el identificador estaba tapando.
 */
function mensajeDeErrorCatalogo(codigoOMensaje, respaldo) {
  const bruto = String(codigoOMensaje == null ? '' : codigoOMensaje).trim();

  // El que necesita decir algo DISTINTO del respaldo genérico: es un control de varios lados —este
  // caso frente a todos los demás, que caen a su respaldo en castellano—, así que si todos los
  // errores dijeran lo mismo la pantalla perdería la distinción que este ticket vino a dar.
  const M = {
    name_duplicate: PV_NOMBRE_DUPLICADO,
  };
  if (M[bruto]) return M[bruto];

  if (PV_ES_IDENTIFICADOR.test(bruto)) {
    try { console.warn('[productsView] código sin traducir:', bruto); } catch (_) { /* sin consola */ }
    return respaldo || PV_MARCADOR_MICROCOPY;
  }
  return bruto || respaldo || PV_MARCADOR_MICROCOPY;
}
if (typeof window !== 'undefined') {
  window.mensajeDeErrorCatalogo = mensajeDeErrorCatalogo;
  window.PV_MARCADOR_MICROCOPY = PV_MARCADOR_MICROCOPY;
  window.PV_NOMBRE_DUPLICADO = PV_NOMBRE_DUPLICADO;
  window.PV_SIN_APROBAR = PV_SIN_APROBAR;
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// SCRUM-609 (CAT-01) · EL SWITCH Producto | Servicio, cableado en UN solo sitio.
//
// El alta y la edición son dos formularios distintos de este mismo fichero y ya divergieron
// una vez (el IVA salió de uno antes que del otro). La regla de qué se ve en cada lado vive en
// `switchTipoArticulo.js`; esto sólo la conecta al DOM de cada formulario.
//
// ⚠️ El switch se monta ANTES de los campos que oculta, porque es el que decide si se ven: un
// control que aparece debajo de lo que gobierna se lee como si fuera un campo más.
// ═══════════════════════════════════════════════════════════════════════════════════════
function cablearTipoArticulo(raiz, filaCampos, valorInicial) {
  const envoltorio = (nombre) => {
    const entrada = raiz.querySelector(`[name="${nombre}"]`);
    return entrada ? entrada.closest('.field') : null;
  };
  const campos = {
    cost: envoltorio('cost'),
    margen: envoltorio('margen'),
    providerId: envoltorio('providerId'),
  };
  const sw = switchTipoArticulo({
    valor: valorInicial,
    alCambiar: (lado) => switchTipoArticulo.aplicarLado(lado, campos),
  });
  filaCampos.parentNode.insertBefore(sw.nodo, filaCampos);
  // Al abrir: el lado guardado manda. Es la razón por la que este ticket paró hasta tener
  // columna — un switch sin dónde guardarse olvida lo que elegiste en cuanto recargas.
  switchTipoArticulo.aplicarLado(sw.leer(), campos);
  // Se expone para que quien reescriba el valor pueda REAPLICAR: `escribir()` sólo marca el
  // radio; sin esto el modal enseñaría el lado nuevo con los campos del anterior — el switch
  // PARECERÍA funcionar, que es la peor forma de no funcionar.
  sw.aplicar = () => switchTipoArticulo.aplicarLado(sw.leer(), campos);
  return sw;
}

function renderProductsView(container) {
    container.innerHTML = "";
  
    const wrap = document.createElement("div");
    wrap.className = "data-card";
    container.appendChild(wrap);

    const header = document.createElement("div");
    header.className = "data-card-header";
    wrap.appendChild(header);

    const h = document.createElement("div");
    const titleEl = document.createElement("h2");
    titleEl.textContent = "Catálogo de productos";
    titleEl.style.cssText = "margin:0;font-size:18px";
    const countEl = document.createElement("p");
    countEl.textContent = "Cargando…";
    countEl.style.cssText = "margin:2px 0 0;color:var(--muted);font-size:13px";
    h.appendChild(titleEl);
    h.appendChild(countEl);
    header.appendChild(h);

    function setCount(text) { countEl.textContent = text; }

    const headActions = document.createElement("div");
    headActions.style.cssText = "display:flex;align-items:center;gap:8px";
    header.appendChild(headActions);

    const reloadBtn = document.createElement("button");
    reloadBtn.className = "btn-secondary btn-sm";
    reloadBtn.type = "button";
    reloadBtn.textContent = "Recargar";
    headActions.appendChild(reloadBtn);

    const exportBtn = document.createElement("button");
    exportBtn.className = "btn-secondary btn-sm";
    exportBtn.type = "button";
    exportBtn.textContent = "⬇ Exportar CSV";
    headActions.appendChild(exportBtn);

    const importBtn = document.createElement("button");
    importBtn.className = "btn-secondary btn-sm";
    importBtn.type = "button";
    importBtn.textContent = "⬆ Importar CSV";
    headActions.appendChild(importBtn);

    const importFile = document.createElement("input");
    importFile.type = "file";
    importFile.accept = ".csv,text/csv";
    importFile.style.display = "none";
    headActions.appendChild(importFile);

    // SCRUM-365 · exportar e importar el tarifario son admin-only en el servidor
    // (`requireRole('admin')`). Sin esto, un Operario vería los dos botones, elegiría un fichero y
    // se llevaría un 403 después de haber hecho el trabajo. Se VETA en vez de ocultar —helpers de
    // SCRUM-89, con su copy ya aprobada— porque un botón que desaparece no explica nada y quien
    // lo busque pensará que la pantalla está rota.
    const esTecnico = window.appUserRole === 'tecnico';
    if (esTecnico) {
      lockActionForRole(exportBtn);
      lockActionForRole(importBtn);
    }

      // --- search + filters (client-side) ---
  const tools = document.createElement("div");
  tools.className = "data-card-toolbar";
  wrap.appendChild(tools); // toolbar al nivel del data-card, no dentro del header

  const searchI = document.createElement("input");
  searchI.placeholder = "Buscar producto…";
  searchI.className = "input";
  searchI.style.maxWidth = "240px";

  const onlyActiveWrap = document.createElement("label");
  onlyActiveWrap.style.display = "flex";
  onlyActiveWrap.style.alignItems = "center";
  onlyActiveWrap.style.gap = "6px";
  onlyActiveWrap.style.fontSize = "13px";
  onlyActiveWrap.style.color = "var(--muted)";

  const onlyActiveI = document.createElement("input");
  onlyActiveI.type = "checkbox";
  onlyActiveI.checked = false;

  const onlyActiveText = document.createElement("span");
  onlyActiveText.textContent = "Solo activos";

  onlyActiveWrap.appendChild(onlyActiveI);
  onlyActiveWrap.appendChild(onlyActiveText);

  tools.appendChild(searchI);
  tools.appendChild(onlyActiveWrap);

  // tools ya appended al wrap directamente como toolbar

  
    const alert = document.createElement("div");
    alert.className = "alert";
    alert.style.cssText = "margin:0 20px 0;display:none";
    wrap.appendChild(alert);
  
    function setAlert(type, msg) {
      alert.textContent = msg || "";
      alert.className = "alert";
      alert.style.cssText = "margin:0 20px 0";
      if (type === "success") { alert.classList.add("success"); alert.style.display = "block"; }
      else if (type === "error") { alert.classList.add("error"); alert.style.display = "block"; }
      else { alert.style.display = "none"; }
    }

        // --- edit modal (custom modal-overlay) ---
        let editOverlay = null;
        let _editing = null; // { merchantId, id }
        let _editSwitch = null; // SCRUM-609: el switch del modal de edición, para leerlo al guardar

        function buildEditModal() {
          const ov = document.createElement('div');
          ov.className = 'modal-overlay';
          ov.style.display = 'none';
          ov.innerHTML = `
            <div class="modal" style="max-width:560px">
              <div class="modal-body" style="gap:12px">
                <div class="quote-form-row">
                  <div class="field"><label>Nombre *</label><input name="name"/></div>
                  <div class="field"><label>Precio *</label><input name="price" type="number" step="0.01" min="0"/></div>
                  <div class="field"><label>Coste</label><input name="cost" type="number" step="0.01" min="0"/></div>
                  <div class="field"><label>Margen %</label><input name="margen" type="number" step="0.01"/></div>
                  <div class="field"><label>Proveedor</label><select name="providerId"><option value="">— Sin proveedor —</option></select></div>
                </div>
                <div class="field"><label>Descripción</label><input name="description"/></div>
              </div>
              <div class="modal-footer">
                <button class="btn btn-secondary" type="button" id="pf-edit-cancel">Cancelar</button>
                <button class="btn btn-primary" type="button" id="pf-edit-save">Guardar</button>
              </div>
            </div>
          `;
          // SCRUM-446: la cabecera sale del constructor compartido.
          ov.querySelector('.modal').prepend(cabeceraModal({ titulo: "Editar producto", idCierre: "pf-edit-close" }));
          document.body.appendChild(ov);

          cablearMargen(
            ov.querySelector('[name="cost"]'),
            ov.querySelector('[name="price"]'),
            ov.querySelector('[name="margen"]'),
          );
          _editSwitch = cablearTipoArticulo(ov, ov.querySelector('.quote-form-row'), null);
          ov.querySelector('#pf-edit-close').addEventListener('click', closeEditModal);
          ov.querySelector('#pf-edit-cancel').addEventListener('click', closeEditModal);
          ov.addEventListener('click', (e) => { if (e.target === ov) closeEditModal(); });

          ov.querySelector('#pf-edit-save').addEventListener('click', async () => {
            if (!_editing) return;
            const body = ov.querySelector('.modal-body');
            const name = body.querySelector('[name="name"]').value.trim();
            const price = Number(body.querySelector('[name="price"]').value);
            const costRaw = body.querySelector('[name="cost"]').value.trim();
            const providerRaw = body.querySelector('[name="providerId"]').value.trim();
            const description = body.querySelector('[name="description"]').value.trim();

            if (!name) return setAlert('error', 'El nombre es obligatorio.');
            if (!Number.isFinite(price) || price <= 0) return setAlert('error', 'El precio debe ser mayor que 0.');

            const payload = {
              name,
              description: description || null,
              price,
              // SCRUM-609 · la EDICIÓN tampoco escribe ya el IVA. No se manda `vat: null` —eso
              // BORRARÍA el que hay al guardar cualquier otro cambio—: simplemente no viaja, y
              // `updateProduct` sólo toca las claves presentes. Dejar de escribir ≠ borrar.
              cost: costRaw === '' ? null : Number(costRaw),
              providerId: providerRaw === '' ? null : Number(providerRaw),
              // SCRUM-609 · el lado elegido. Viaja SIEMPRE (aunque sea null) porque el PUT
              // sólo toca las claves presentes: si no viajara, no se podría volver a «sin
              // clasificar» una vez declarado.
              itemKind: _editSwitch ? _editSwitch.leer() : null,
            };

            const saveBtn = ov.querySelector('#pf-edit-save');
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando…';
            try {
              await updateProduct(_editing.merchantId, _editing.id, payload);
              closeEditModal();
              setAlert('success', 'Producto actualizado.');
              await refresh();
            } catch (e) {
              setAlert('error', mensajeDeErrorCatalogo(e && e.message, 'Error actualizando.'));
            } finally {
              saveBtn.disabled = false;
              saveBtn.textContent = 'Guardar';
            }
          });

          return ov;
        }

        function openEditModal(it) {
          if (!editOverlay) editOverlay = buildEditModal();
          _editing = { merchantId: _merchantId, id: it.id };

          const body = editOverlay.querySelector('.modal-body');
          body.querySelector('[name="name"]').value = it.name || '';
          body.querySelector('[name="price"]').value = it.price ?? '';
          body.querySelector('[name="cost"]').value = it.cost === null ? '' : String(it.cost);
          // SCRUM-609 · el margen NO se guarda: se DERIVA de coste y precio. Si no hay coste no
          // hay margen que enseñar, y el campo se queda vacío — que es «no se sabe», no 0.
          const mg = window.margenCatalogo.margenDesde(it.cost, it.price);
          body.querySelector('[name="margen"]').value = mg === null ? '' : String(mg);
          body.querySelector('[name="description"]').value = it.description || '';

          // SCRUM-609 · EL LADO GUARDADO MANDA AL ABRIR, y esto es lo que hace que el switch
          // sirva de algo: uno que no lee lo guardado OLVIDA lo que elegiste en cuanto
          // recargas, y eso es peor que no tenerlo. Es la razón por la que este ticket paró
          // hasta tener columna.
          //
          // Se escribe DESPUÉS de rellenar los campos a propósito: `aplicarLado` decide mirando
          // si el campo tiene valor (invariante ② de CONT-01), así que necesita los valores ya
          // puestos. Al revés escondería un coste que estaba a punto de aparecer.
          if (_editSwitch) {
            _editSwitch.escribir(it.itemKind || null);
            _editSwitch.aplicar();
          }

          const provSel = body.querySelector('[name="providerId"]');
          provSel.innerHTML = '<option value="">— Sin proveedor —</option>';
          (_providers || []).forEach((p) => {
            const opt = document.createElement('option');
            opt.value = String(p.id);
            opt.textContent = p.name || `Proveedor #${p.id}`;
            provSel.appendChild(opt);
          });
          provSel.value = it.providerId == null ? '' : String(it.providerId);

          editOverlay.style.display = 'flex';
          body.querySelector('[name="name"]').focus();
        }

        function closeEditModal() {
          if (editOverlay) editOverlay.style.display = 'none';
          _editing = null;
        }
    
  
    // --- form create ---
    const form = document.createElement("div");
    form.style.cssText = "padding:0 20px 4px";
    // ── SCRUM-609 (CAT-01) · QUÉ CAMBIA EN ESTE FORMULARIO ─────────────────────────────────
    //
    // SALE «IVA (0..1)». El tipo depende del trabajo y del destinatario, no del artículo: se fija
    // en la línea del documento, donde YA existe su sitio (`vatDefault`). Y pedirle una fracción
    // decimal a un fontanero era la mitad del defecto que abrió el ticket.
    //
    // 🔴 DEJAR DE ESCRIBIRLO NO ES BORRAR LO ESCRITO. El `vat` de los productos que ya existen se
    // queda donde está, huérfano y VISIBLE en la tabla de abajo. Borrarlo es migración
    // irreversible y espera su número de producción — el de cuántos lo tienen distinto del
    // `defaultVat` de su locale, que son los únicos tecleados a mano.
    //
    // ENTRA «Margen %», sobre PRECIO DE VENTA. No es obligatorio, y eso no es un detalle: medido
    // en este mismo ticket, 8 de 8 productos de hoy no tienen coste. Si el margen fuera
    // obligatorio, el catálogo que ya existe dejaría de poder guardarse.
    //
    // ⚠️ Y los comentarios de este bloque van AQUÍ y no dentro del literal de abajo: el DOM del
    // banco de vistas (`tests/_banco-vistas.mjs`) trae su propio parser de `innerHTML`, y ninguna
    // vista que monta llevaba un comentario HTML hasta hoy. El primero que puse reventó su
    // `querySelector`. No se cambia el banco por un comentario.
    form.innerHTML = `
      <div class="quote-block">
        <h3 class="quote-block-title">Nuevo producto</h3>
  
        <div class="quote-form-row">
        <div class="field">
          <label>Nombre *</label>
          <input name="name" placeholder="Ej: Detector de humos" />
        </div>

        <div class="field">
          <label>Precio *</label>
          <input name="price" type="number" step="0.01" min="0" placeholder="99.99" />
        </div>

        <div class="field">
          <label>Coste</label>
          <input name="cost" type="number" step="0.01" min="0" placeholder="60.00" />
        </div>

        <div class="field">
          <label>Margen %</label>
          <input name="margen" type="number" step="0.01" placeholder="70" />
        </div>

        <div class="field">
          <label>Proveedor</label>
          <select name="providerId">
            <option value="">— Sin proveedor —</option>
          </select>
        </div>
      </div>
  
        <div class="field">
          <label>Descripción</label>
          <input name="description" placeholder="Texto opcional" />
        </div>
  
        <div style="display:flex; gap:8px; justify-content:flex-end; margin-top:10px">
          <button class="btn btn-primary" type="button" id="pf-create-product">Crear producto</button>
        </div>
      </div>
    `;
    wrap.appendChild(form);
  
    const nameI = form.querySelector('input[name="name"]');
    const priceI = form.querySelector('input[name="price"]');
    // SCRUM-609: el campo de IVA ya no existe en el alta. Entra el de margen.
    const margenI = form.querySelector('input[name="margen"]');

    /**
     * SCRUM-609 · el autocompletado coste ↔ margen ↔ precio. La aritmética NO vive aquí: está en
     * `margenCatalogo.js`, sin DOM y con su test. Aquí sólo se cablea.
     *
     * 🔴 Se escribe SÓLO el campo que el módulo devuelve, y nunca el que el usuario acaba de
     * tocar: pisarle lo que está tecleando es como se pierde un número a medio escribir.
     * Y «sólo precio» no autocompleta NADA — es un caso válido, no un formulario a medias.
     */
    function cablearMargen(campoCoste, campoPrecio, campoMargen) {
      const aplicar = (cambiado) => {
        const r = window.margenCatalogo.autocompletar({
          coste: campoCoste.value, precio: campoPrecio.value, margen: campoMargen.value,
        }, cambiado);
        if (r.precio !== null && cambiado !== 'precio') campoPrecio.value = String(r.precio);
        if (r.margen !== null && cambiado !== 'margen') campoMargen.value = String(r.margen);
      };
      campoCoste.addEventListener('input', () => aplicar('coste'));
      campoPrecio.addEventListener('input', () => aplicar('precio'));
      campoMargen.addEventListener('input', () => aplicar('margen'));
    }
    const costI = form.querySelector('input[name="cost"]');
    const providerSelect = form.querySelector('select[name="providerId"]');
    const descI = form.querySelector('input[name="description"]');
    cablearMargen(costI, priceI, margenI);
    // SCRUM-609 · el switch del ALTA. Nace SIN lado marcado: null = «nadie lo ha declarado»,
    // y con null se ven todos los campos (invariante de CONT-01). Preseleccionar Producto
    // aqui declararia por el profesional en cada alta, que es lo que la columna nullable evita.
    const altaSwitch = cablearTipoArticulo(form, form.querySelector('.quote-form-row'), null);
    const createBtn = form.querySelector("#pf-create-product");
  
    // --- table ---
    const tableWrap = document.createElement("div");
    tableWrap.className = "table-scroll";
    tableWrap.style.marginTop = "14px";
    wrap.appendChild(tableWrap);
  
    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
    <thead>
    <tr>
      <th style="width:60px">ID</th>
      <th style="min-width:220px">Nombre</th> <!-- A18.4: los nombres largos del catálogo no se estrujan -->
      <th style="width:160px" class="col-hide-mobile">Proveedor</th>
      <th style="width:140px;text-align:right">Precio</th>
      <th style="width:90px" class="col-hide-mobile">IVA</th>
      <th style="width:140px;text-align:right" class="col-hide-mobile">Coste</th>
      <th style="width:110px">Activo</th>
      <th style="width:210px"></th>
    </tr>
  </thead>
      <tbody></tbody>
    `;
    tableWrap.appendChild(table);
  
    const tbody = table.querySelector("tbody");
  
    // --- api helpers ---
    async function getMerchantId() {
      // usa tu endpoint real
      const res = await fetch("/admin/merchant");
      if (!res.ok) throw new Error("No se pudo cargar /admin/merchant");
      const m = await res.json();
      if (!m || !m.id) throw new Error("merchant.id no disponible");
      return m.id;
    }
  
    async function listProducts(merchantId) {
      const res = await fetch(`/admin/products?merchantId=${encodeURIComponent(merchantId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error listando productos");
      return data.items || [];
    }

    async function listProviders(merchantId) {
      const res = await fetch(`/admin/providers?merchantId=${encodeURIComponent(merchantId)}`);
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error listando proveedores");
      return data.items || [];
    }
  
    async function createProduct(merchantId, payload) {
      const res = await fetch(`/admin/products?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error creando producto");
      return data.item;
    }
  
    async function updateProduct(merchantId, id, payload) {
      const res = await fetch(`/admin/products/${id}?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error actualizando producto");
      return data.item;
    }
  
    async function deleteProduct(merchantId, id) {
      const res = await fetch(`/admin/products/${id}?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error borrando producto");
      return data.deleted;
    }

    async function importProductsCsv(merchantId, csvText) {
      const res = await fetch(`/admin/products/import?merchantId=${encodeURIComponent(merchantId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: csvText }),
      });
    
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error importando CSV");
      return { created: Number(data.created || 0) }; // SCRUM-339: contrato alineado (era data.inserted)
    }
  
    function money(v) {
      if (v === null || typeof v === "undefined") return "—";
      const n = Number(v);
      if (!Number.isFinite(n)) return String(v);
      // P-A66-3: es-ES compartido — "60,00 €" en vez de "60.00"
      return fmtMoneyEs(n, (window.appLocale && window.appLocale.currency) || "EUR");
    }
  
    function renderRows(items, merchantId) {
      tbody.innerHTML = "";

      if (!items || items.length === 0) {
        const searching = !!String(searchI.value || "").trim() || !!onlyActiveI.checked;
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 8;
        td.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div>'
          + '<div class="empty-state-title">' + (searching ? 'Sin productos para este filtro' : 'Crea tu catálogo de servicios') + '</div>'
          + '<div class="empty-state-desc">' + (searching ? 'Prueba con otra búsqueda o desactiva el filtro.' : 'Con tus servicios y precios guardados, montar una cotización es cuestión de segundos gracias al autocompletado.') + '</div>'
          + (searching ? '' : '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-top:14px">'
            + '<button id="products-empty-catalog" class="btn-primary btn-sm">📚 Cargar el catálogo de mi gremio</button>'
            + '<button id="products-empty-cta" class="btn-secondary btn-sm">+ Añadir un servicio a mano</button>'
            + '</div><div style="font-size:12px;color:var(--muted);margin-top:8px">25-30 servicios típicos con precios orientativos — todo editable después.</div>') + '</div>';
        tr.appendChild(td);
        tbody.appendChild(tr);
        const cta = td.querySelector('#products-empty-cta');
        if (cta) cta.addEventListener('click', () => {
          const nameInput = document.querySelector('input[name="name"]');
          if (nameInput) { nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' }); nameInput.focus(); }
        });
        // A18.4 (AB4 "importar") × A17: catálogo del gremio en un clic
        const catBtn = td.querySelector('#products-empty-catalog');
        // SCRUM-365 · cargar el catalogo del gremio es admin-only en el servidor: son 25-30
        // conceptos de golpe, o sea el tarifario entero, no una linea. Al Operario se le veta con
        // su explicacion en vez de dejarle pulsar para que le devuelvan un 403.
        if (catBtn && esTecnico) {
          lockActionForRole(catBtn);
          catBtn.insertAdjacentElement('afterend', roleLockedNote());
        }
        // SCRUM-364 · el rescate: si no hay oficio, ofrece elegirlo en vez de morir en el catch.
        if (catBtn && !esTecnico) catBtn.addEventListener('click', () => cargarCatalogoDeGremio(catBtn, td, refresh));
        setCount(searching ? "0 resultados" : "0 productos");
        return;
      }

      setCount(items.length + " producto" + (items.length !== 1 ? "s" : ""));

      items.forEach((it) => {
        const tr = document.createElement("tr");
  
        const vatPct = (it.vat === null || typeof it.vat === "undefined")
          ? "—"
          : (Number(it.vat) * 100).toFixed(0) + " %";
        const activePill = it.isActive
          ? '<span class="status-pill status-pill-accepted">ACTIVO</span>'
          : '<span class="status-pill status-pill-draft">INACTIVO</span>';

        tr.innerHTML = `
        <td>${it.id}</td>
        <td>
          <div style="font-weight:600">${it.name || ""}</div>
          <div style="font-size:12px;color:var(--muted)">${it.description || ""}</div>
        </td>
        <td class="col-hide-mobile">${it.provider?.name || "—"}</td>
        <td class="amount" style="text-align:right">${money(it.price)}</td>
        <td class="col-hide-mobile">${vatPct}</td>
        <td class="amount-muted col-hide-mobile" style="text-align:right">${money(it.cost)}</td>
        <td>${activePill}</td>
        <td></td>
      `;
  
        const actionsTd = tr.lastElementChild;
        const actionsDiv = document.createElement("div");
        actionsDiv.style.cssText = "display:flex;justify-content:flex-end;gap:6px;align-items:center";

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.className = "btn btn-secondary btn-sm";
        editBtn.textContent = "Editar";

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "btn btn-secondary btn-sm";
        toggleBtn.textContent = it.isActive ? "Desactivar" : "Activar";

        const delBtn = document.createElement("button");
        delBtn.type = "button";
        delBtn.className = "btn btn-danger btn-sm";
        delBtn.textContent = "Borrar";

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(toggleBtn);
        actionsDiv.appendChild(delBtn);
        actionsTd.appendChild(actionsDiv);
  
        editBtn.addEventListener("click", () => {
          setAlert(null, "");
          openEditModal(it);
        });
  


  
        toggleBtn.addEventListener("click", async () => {
          try {
            setAlert(null, "");
            await updateProduct(merchantId, it.id, { isActive: !it.isActive });
            setAlert("success", "Estado actualizado.");
            await refresh();
          } catch (e) {
            setAlert("error", mensajeDeErrorCatalogo(e && e.message, "Error actualizando estado."));
          }
        });
  
        delBtn.addEventListener("click", async () => {
          if (!confirm(`¿Borrar el producto "${it.name}"?`)) return;
          try {
            setAlert(null, "");
            await deleteProduct(merchantId, it.id);
            setAlert("success", "Producto borrado.");
            await refresh();
          } catch (e) {
            setAlert("error", mensajeDeErrorCatalogo(e && e.message, "Error borrando."));
          }
        });
  
        tbody.appendChild(tr);
      });
    }
  
    let _merchantId = null;
    let _importing = false;
    let _providers = [];
  
    async function refresh() {
      setCount("Cargando…");
      uiSkeletonRows(tbody, 8, 6);
      const merchantId = _merchantId || (_merchantId = await getMerchantId());

      const [items, providers] = await Promise.all([
        listProducts(merchantId),
        listProviders(merchantId),
      ]);

      _providers = Array.isArray(providers) ? providers : [];

      if (providerSelect) {
        const currentValue = providerSelect.value;
        providerSelect.innerHTML = `<option value="">— Sin proveedor —</option>`;

        _providers.forEach((p) => {
          const opt = document.createElement("option");
          opt.value = String(p.id);
          opt.textContent = p.name || `Proveedor #${p.id}`;
          providerSelect.appendChild(opt);
        });

        if (currentValue) {
          providerSelect.value = currentValue;
        }
      }

      const q = String(searchI.value || "").trim().toLowerCase();
      const onlyActive = !!onlyActiveI.checked;

      const filtered = items.filter((p) => {
        if (onlyActive && !p.isActive) return false;
        if (!q) return true;
        const hay = `${p.name || ""} ${p.description || ""}`.toLowerCase();
        return hay.includes(q);
      });

      renderRows(filtered, merchantId);
    }
  
    reloadBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
        await refresh();
      } catch (e) {
        setAlert("error", mensajeDeErrorCatalogo(e && e.message, "Error recargando."));
      }
    });

    exportBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
        const url = `/admin/products/export?merchantId=${encodeURIComponent(merchantId)}`;
        window.open(url, "_blank");
      } catch (e) {
        setAlert("error", mensajeDeErrorCatalogo(e && e.message, "Error exportando."));
      }
    });

  

    importBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
    
      if (_importing) return;
    
      setAlert(null, "");
      importFile.value = ""; // permite re-importar el mismo archivo
      importFile.click();
    };
    
    importFile.onchange = async (e) => {
      e.preventDefault();
      e.stopPropagation();
    
      // lock anti-doble disparo
      if (_importing) return;
    
      const file = importFile.files && importFile.files[0];
      if (!file) return;
    
      _importing = true;
      importBtn.disabled = true;
      const prevText = importBtn.textContent;
      importBtn.textContent = "Importando…";
    
      try {
        setAlert(null, "");
    
        const csv = await file.text();
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
    
        const res = await fetch(`/admin/products/import?merchantId=${encodeURIComponent(merchantId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ csv }),
        });
    
        const data = await res.json().catch(() => null);
        if (!res.ok || !data || !data.ok) throw new Error(data?.error || "Error importando");
    
        // SCRUM-339: contrato alineado con clientes (created/skipped/errors/errorList). «Insertados» y
        // «Duplicados omitidos» son feedback EXISTENTE reusado (no microcopy nueva, regla 30). El rótulo
        // de los errores SÍ es nuevo → marcador [PENDIENTE microcopy oficial] hasta que lo apruebe el
        // fundador (guard: tests/scrum339-microcopy-import.test.mjs). Antes las filas inválidas y los
        // duplicados normales no se veían: el recuento decía «0 y 0».
        const errNota = (data.errors ?? 0) > 0 ? ` · Con errores: ${data.errors}` : '';
        setAlert("success", `CSV importado. Insertados: ${data.created ?? 0} · Duplicados omitidos: ${data.skipped ?? 0}${errNota}`);
        await refresh();
      } catch (err) {
        setAlert("error", mensajeDeErrorCatalogo(err && err.message, "Error importando."));
      } finally {
        // MUY importante: limpiar value para que no se “re-dispare” con el mismo archivo
        importFile.value = "";
        _importing = false;
        importBtn.disabled = false;
        importBtn.textContent = prevText;
      }
    };
    createBtn.addEventListener("click", async () => {
      try {
        setAlert(null, "");
  
        const merchantId = _merchantId || (_merchantId = await getMerchantId());
  
        const name = String(nameI.value || "").trim();
        const price = Number(priceI.value);
        const costRaw = String(costI.value || "").trim();
        const providerRaw = String(providerSelect?.value || "").trim();
        const description = String(descI.value || "").trim();
  
        if (!name) return setAlert("error", "El nombre es obligatorio.");
        if (!Number.isFinite(price) || price <= 0) return setAlert("error", "El precio debe ser mayor que 0.");
  
        const payload = {
          name,
          description: description || null,
          price,
          // SCRUM-609: el alta DEJA DE ESCRIBIR el IVA. No se manda: no es que se mande null,
          // es que el campo ya no existe. El `vat` de lo que ya hay no se toca.
          cost: costRaw === "" ? null : Number(costRaw),
          providerId: providerRaw === "" ? null : Number(providerRaw),
          // SCRUM-609 · el lado elegido, o null si nadie tocó el switch.
          itemKind: altaSwitch.leer(),
        };
  
        await createProduct(merchantId, payload);
  
        nameI.value = "";
        priceI.value = "";
        margenI.value = "";
        costI.value = "";
        if (providerSelect) providerSelect.value = "";
        descI.value = "";
  
        setAlert("success", "Producto creado.");
        await refresh();
      } catch (e) {
        setAlert("error", mensajeDeErrorCatalogo(e && e.message, "Error creando producto."));
      }
    });
  



    searchI.addEventListener("input", () => refresh().catch(() => {}));
    onlyActiveI.addEventListener("change", () => refresh().catch(() => {}));


    // init
    refresh().catch((e) => setAlert("error", mensajeDeErrorCatalogo(e && e.message, "Error cargando productos.")));
  }
  
// ═══════════════════════════════════════════════════════════════════════════════════════════
// SCRUM-364 · CARGAR EL CATÁLOGO CUANDO NO HAY OFICIO
//
// EL DEFECTO, medido: `trade` se captura en UN SOLO SITIO de todo el producto —el paso 1 del
// asistente de alta— y no es editable en ninguna pantalla. Quien lo saltó se queda sin oficio
// PARA SIEMPRE, porque el asistente queda marcado como completado y no vuelve a salir. Este
// botón llamaba a `load-catalog` con `{}`, el servidor respondía 400 `trade_required`, y la
// pantalla decía «No se pudo cargar el catálogo. Inténtalo de nuevo.» — pidiéndole al usuario
// que repitiera algo que no iba a funcionar nunca. Medido en producción el 5-ago-2026: 8 de 13
// merchants sin oficio, 4 de ellos cuentas reales y 2 con actividad (una de pago, con 31
// presupuestos y 6 facturas emitidas desde mayo).
//
// EL SERVIDOR NO SE TOCA, y no hace falta: `load-catalog` ya acepta `req.body?.trade ||
// merchant.trade`. Con oficio guardado, mandar `{}` YA funciona hoy. Lo que faltaba no era el
// dato en la petición: era **poder elegirlo**, porque el front no tenía de dónde sacarlo.
//
// LO QUE NO SE HACE, a propósito: no se sustituye ni se borra nada. El servidor ya lo garantiza
// —con 2 o más productos devuelve `already_has_products` y no toca el catálogo—, así que lo que
// aquí falta no es una protección, es DECIRLO. De ahí el aviso antes de cargar.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const PV_TXT_CARGAR = '📚 Cargar el catálogo de mi gremio';

/** Pide el catálogo. Si el merchant no tiene oficio, ofrece elegirlo en vez de fallar. */
async function cargarCatalogoDeGremio(btn, contenedor, refresh) {
  btn.disabled = true; btn.textContent = 'Cargando catálogo…';
  try {
    await pedirCatalogo(undefined, refresh, btn);
  } catch (e) {
    btn.disabled = false; btn.textContent = PV_TXT_CARGAR;
    // Se ramifica por CÓDIGO, no por el texto del mensaje: `api.js` deja el código del servidor
    // en `err.code` justo para esto.
    if (e && e.code === 'trade_required') {
      pedirOficio(btn, contenedor, refresh);
      return;
    }
    if (typeof showToast === 'function') showToast('No se pudo cargar el catálogo. Inténtalo de nuevo.', 'error');
  }
}

/** La llamada al servidor y la lectura de su respuesta. Separada para no repetirla en dos sitios. */
async function pedirCatalogo(trade, refresh, btn) {
  const cuerpo = trade ? { trade } : {};
  const r = await apiRequest('/admin/products/load-catalog', { method: 'POST', body: JSON.stringify(cuerpo) });
  if (r.inserted > 0) {
    if (typeof showToast === 'function') {
      showToast('✓ ' + r.inserted + ' servicios cargados' + (r.templates ? ' + ' + r.templates + ' plantillas' : '') + ' — precios orientativos, edítalos a tu gusto');
    }
    await refresh();
    return true;
  }
  if (btn) { btn.disabled = false; btn.textContent = PV_TXT_CARGAR; }
  if (typeof showToast === 'function') {
    // SCRUM-338 (residuo) · `already_has_products` NO es un fallo: es el servidor protegiendo lo
    // que el profesional ya tiene (con 2 o más productos no carga y no borra nada). Decirle «no
    // se pudo» es contarle un error donde hubo una decisión a su favor, y encima le deja sin
    // saber qué pasa con su catálogo. Los tres casos son distintos y ahora se distinguen.
    //
    // 🔴 MICROCOPY PENDIENTE (regla 30): el texto del caso nuevo está marcado. Lo que tiene que
    // decir, en la entrada `docs/master/SCRUM-313.md`.
    const MSG = {
      no_catalog_for_trade: 'Tu gremio aún no tiene catálogo predefinido — añade servicios a mano o importa un CSV.',
      // Microcopy APROBADA por el fundador (5-ago-2026), literal.
      already_has_products: 'Tu catálogo ya tiene productos, así que no hemos cargado la plantilla. Tus precios siguen como estaban.',
    };
    const msg = MSG[r.skipped] || 'No se pudo cargar el catálogo.';
    // El caso protegido se anuncia como AVISO ('warn'), no como error: no ha fallado nada, pero
    // tampoco se ha cargado. 'ok' seria mentira (parece exito) y 'info' NO EXISTE -- showToast
    // solo admite ok|warn|error y cualquier otra cosa cae al verde de exito (api.js:111).
    showToast(msg, r.skipped === 'already_has_products' ? 'warn' : 'error');
  }
  return false;
}

/**
 * El rescate: elegir oficio aquí mismo, sin volver a un asistente que ya no se puede abrir.
 *
 * La lista sale de `window.OB_TRADES` (SCRUM-364, publicada por `onboardingView.js`) y NO se
 * escribe aquí: el censo de SCRUM-310 encontró tres listas del mismo gremio a mano y ésta habría
 * sido la cuarta. Si por lo que sea no está disponible, se dice y no se inventa media lista.
 */
function pedirOficio(btn, contenedor, refresh) {
  if (contenedor.querySelector('#products-trade-picker')) return; // ya está abierto
  const oficios = Array.isArray(window.OB_TRADES) ? window.OB_TRADES : null;
  if (!oficios || oficios.length === 0) {
    if (typeof showToast === 'function') showToast('No se pudo cargar el catálogo.', 'error');
    return;
  }

  const caja = document.createElement('div');
  caja.id = 'products-trade-picker';
  caja.style.cssText = 'margin:14px auto 0;max-width:360px;text-align:left;background:var(--surface,#fff);border:1px solid var(--line,#cdd2cb);border-radius:12px;padding:14px';
  caja.innerHTML =
    '<label for="products-trade-select" style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Tu oficio</label>'
    + '<select id="products-trade-select" style="width:100%;padding:11px 13px;border:1px solid var(--line,#cdd2cb);border-radius:9px;font-size:14px;background:#fff">'
    + '<option value="">Selecciona…</option>'
    + oficios.map((t) => '<option value="' + t.value + '">' + t.label + '</option>').join('')
    + '</select>'
    // Microcopy APROBADA por el fundador (5-ago-2026). Va ANTES de cargar, no después: dice lo
    // que va a pasar y que lo suyo no se toca. El defecto de hoy no es que destruya —no lo
    // hace—, es que no lo dice.
    + '<p style="font-size:12px;color:var(--muted);margin:10px 0 12px;line-height:1.45">'
    + 'Cargamos los conceptos de tu oficio. Lo que ya tengas en tu catálogo se queda como está.</p>'
    + '<button id="products-trade-ok" class="btn-primary btn-sm" style="width:100%">Cargar catálogo</button>';
  btn.insertAdjacentElement('afterend', caja);

  const sel = caja.querySelector('#products-trade-select');
  const ok  = caja.querySelector('#products-trade-ok');
  sel.focus();
  ok.addEventListener('click', async () => {
    const trade = sel.value;
    if (!trade) { sel.focus(); return; }
    ok.disabled = true; ok.textContent = 'Cargando…';
    try {
      // Se GUARDA el oficio antes de cargar: si solo se mandara en la petición, el usuario
      // volvería a quedarse sin él en cuanto cerrara la pantalla — que es el defecto que este
      // ticket cierra, repetido con más pasos.
      await updateMerchantProfile({ trade });
      const cargado = await pedirCatalogo(trade, refresh, null);
      if (cargado) caja.remove();
      else { ok.disabled = false; ok.textContent = 'Cargar catálogo'; }
    } catch (e) {
      ok.disabled = false; ok.textContent = 'Cargar catálogo';
      if (typeof showToast === 'function') showToast('No se pudo cargar el catálogo. Inténtalo de nuevo.', 'error');
    }
  });
}
