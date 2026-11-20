// public/dashboard/js/csvImport.js
// Modal para importar clientes desde CSV. Se usa desde customersView.js.
//
// ─────────────────────────────────────────────────────────────────────────────
// SCRUM-312 (D1) · EL NAVEGADOR YA NO PARSEA NADA.
//
// Antes este fichero troceaba el CSV (`csvParseRows`, `csvSplitLine`) y mandaba JSON. Eso
// dejaba DOS parseos vivos del mismo formato —éste y el del servidor (SCRUM-339)— que ni
// siquiera eran equivalentes: aquí no se honraba `""` ni se quitaba el BOM, así que el MISMO
// fichero se leía distinto según por dónde entrara.
//
// Ahora sube los BYTES y el servidor decide. Además de quitar la duplicación, es lo único que
// permite resolver la codificación: un `readAsText(file,'UTF-8')` ya ha destruido la
// información — «José» sale «Jos<?>» y no hay vuelta atrás. Los bytes crudos sí se pueden
// releer de otra forma.
//
// TRES PASOS, y cada uno existe por un fallo concreto:
//   1 ACENTOS  — no se pregunta por codificaciones (nadie sabe qué es Windows-1252): se enseña
//                la primera fila REAL y que la juzgue quien conoce a sus clientes.
//   2 MAPEO    — se PROPONE leyendo la cabecera. Antes se adivinaba, y si no encontraba la
//                columna de nombre devolvía cero filas EN SILENCIO.
//   3 INFORME  — las filas que no entran se listan con su motivo y se pueden descargar.
//
// Microcopy: la aprobada por el fundador (regla 30). NO reformular.

function openImportCsvModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = [
    '<div class="modal csv-modal">',
    '<div class="modal-body">',
    '<div class="alert csv-oculto" id="csv-alert"></div>',
    '<div id="csv-paso"></div>',
    '</div>',
    '</div>',
  ].join('');
  // SCRUM-446: la cabecera sale del constructor compartido.
  overlay.querySelector('.modal').prepend(cabeceraModal({
    titulo: '⬆ Importar clientes desde CSV o Excel', idCierre: 'csv-modal-close',
  }));
  document.body.appendChild(overlay);

  const cerrar = function () { overlay.remove(); };
  overlay.querySelector('#csv-modal-close').onclick = cerrar;
  overlay.addEventListener('click', function (e) { if (e.target === overlay) cerrar(); });

  const alertEl = overlay.querySelector('#csv-alert');
  const paso = overlay.querySelector('#csv-paso');

  // Estado del asistente. `base64` son los BYTES tal cual: se reenvían en cada paso para que el
  // servidor pueda releerlos con otra codificación sin que el usuario vuelva a elegir fichero.
  const est = { base64: null, texto: null, codificacion: null, alternativa: null, columnas: [], mapeo: {} };

  function setAlert(tipo, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (tipo === 'error') alertEl.classList.add('error');
    if (tipo === 'success') alertEl.classList.add('success');
    alertEl.style.display = (tipo || msg) ? 'block' : 'none';
  }

  // ── PASO 0 · elegir el fichero ─────────────────────────────────────────────
  function pintarElegir() {
    setAlert(null, '');
    paso.innerHTML = [
      '<p class="csv-guia">',
      'Sube el <strong>.csv</strong> o el <strong>.xlsx</strong> de tu Excel. Da igual el orden de las columnas: ',
      'te diremos qué hemos entendido antes de importar nada.',
      '</p>',
      '<div id="csv-dropzone" class="csv-dropzone">',
      '<div class="csv-dropzone-texto">',
      '📂 Arrastra tu fichero o <span class="csv-dropzone-enlace">haz click para elegirlo</span>',
      '</div>',
      '<input type="file" id="csv-file-input" accept=".csv,.txt,.xlsx" hidden/>',
      '</div>',
      '<div class="csv-separador">— o pega el contenido —</div>',
      '<textarea id="csv-paste" rows="4" placeholder="nombre;telefono;email" ',
      'class="csv-pegar"></textarea>',
      '<button class="btn-secondary csv-boton-8" id="csv-seguir">Continuar</button>',
    ].join('');

    const fileInput = paso.querySelector('#csv-file-input');
    const dropzone = paso.querySelector('#csv-dropzone');
    const pasteArea = paso.querySelector('#csv-paste');

    dropzone.addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.style.borderColor = 'var(--green-500)'; });
    dropzone.addEventListener('dragleave', function () { dropzone.style.borderColor = 'var(--neutral-300)'; });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.style.borderColor = 'var(--neutral-300)';
      if (e.dataTransfer.files && e.dataTransfer.files[0]) leerFichero(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', function (e) { if (e.target.files[0]) leerFichero(e.target.files[0]); });

    paso.querySelector('#csv-seguir').onclick = function () {
      const pegado = pasteArea.value.trim();
      if (!pegado) { setAlert('error', 'No hemos recibido ningún archivo. Vuelve a elegirlo.'); return; }
      // ⚠️ El texto PEGADO ya viene decodificado por el navegador: no hay bytes que releer, así
      // que la pregunta de los acentos no aplica y se salta. Con FICHERO sí aplica.
      est.base64 = btoa(unescape(encodeURIComponent(pegado)));
      preparar('utf-8', true);
    };
  }

  /** Lee el fichero como BYTES (no como texto): es lo que permite releerlo con otra codificación. */
  function leerFichero(file) {
    const reader = new FileReader();
    reader.onload = function (e) {
      const bytes = new Uint8Array(e.target.result);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      est.base64 = btoa(bin);
      preparar(null, false);
    };
    reader.readAsArrayBuffer(file);
  }

  // ── Llamada al servidor: propone codificación y mapeo ──────────────────────
  async function preparar(codificacion, saltarAcentos) {
    setAlert(null, 'Leyendo el archivo…');
    try {
      const d = await apiRequest('/admin/customers/import/preparar', {
        method: 'POST',
        body: JSON.stringify({ fichero: est.base64, codificacion: codificacion || undefined }),
      });
      setAlert(null, '');
      est.texto = d.primeraFila;
      est.codificacion = d.codificacion;
      est.alternativa = d.alternativa;
      est.columnas = d.columnas || [];
      est.mapeo = {};
      est.columnas.forEach(function (c) { if (c.campo) est.mapeo[c.campo] = c.indice; });
      if (saltarAcentos) pintarMapeo(); else pintarAcentos();
    } catch (err) {
      setAlert('error', (err && err.message) || 'No hemos podido leer el archivo.');
    }
  }

  // ── PASO 1 · ¿Se ven bien los acentos? ─────────────────────────────────────
  // Microcopy APROBADA (fundador). No pregunta por codificaciones a propósito: un fontanero no
  // sabe qué es Windows-1252, pero sí sabe si su cliente se llama José o Jos<?>.
  function pintarAcentos() {
    paso.innerHTML = [
      '<h4 class="csv-titulo-6">¿Se ven bien los acentos?</h4>',
      '<p class="csv-guia">Así hemos leído la primera fila de tu archivo:</p>',
      '<div id="csv-muestra" class="csv-muestra"></div>',
      '<div class="csv-botonera">',
      '<button class="btn-primary csv-flex1" id="csv-acentos-si">Sí, continuar</button>',
      '<button class="btn-secondary csv-flex1" id="csv-acentos-no">No, prueba de otra forma</button>',
      '</div>',
    ].join('');
    // `textContent`, no HTML: la muestra es contenido del usuario y aquí es donde acabaría un
    // fichero con `<script>` en la cabecera.
    paso.querySelector('#csv-muestra').textContent = est.texto || '(vacía)';
    paso.querySelector('#csv-acentos-si').onclick = pintarMapeo;
    paso.querySelector('#csv-acentos-no').onclick = function () { preparar(est.alternativa, false); };
  }

  // ── PASO 2 · Esto es lo que hemos entendido ────────────────────────────────
  function pintarMapeo() {
    // SCRUM-1136 · LOS DOCE CAMPOS QUE EL SERVIDOR ACEPTA, en el orden de `CAMPOS_CLIENTE`
    // (importarClientes.service.ts). Con sólo los cuatro de antes, una columna que el servidor
    // RECONOCÍA (NIF, MOVIL…) llegaba propuesta con un campo que aquí no existía: el desplegable
    // caía en «— dejar fuera —», el aviso de columna desconocida no salía —porque sí se había
    // reconocido— y el dato se perdía EN SILENCIO. Los ocho rótulos nuevos, firmados en
    // SCRUM-1136 comentario 17445 (docs/microcopy/2026-09-28-SCRUM-1136-columnas-importar.md).
    const CAMPOS = [
      ['name', 'Nombre'], ['phone', 'Teléfono'], ['mobile', 'Móvil (WhatsApp)'], ['email', 'Email'],
      ['notes', 'Notas'], ['taxId', 'NIF/CIF'], ['tags', 'Etiquetas'], ['billingAddress', 'Dirección'],
      ['billingCity', 'Población'], ['billingPostalCode', 'Código postal'], ['billingProvince', 'Provincia'],
      ['billingCountry', 'País (código, ej. ES)'],
    ];
    const filas = est.columnas.map(function (c) {
      const opciones = ['<option value="">— dejar fuera —</option>'].concat(
        CAMPOS.map(function (f) {
          return '<option value="' + f[0] + '"' + (c.campo === f[0] ? ' selected' : '') + '>' + f[1] + '</option>';
        }),
      ).join('');
      // AB6: 44px de alto minimo — esto se toca con guantes y al sol.
      return [
        '<div class="csv-columna">',
        '<div class="csv-columna-fila">',
        '<span class="csv-columna-nombre">' + escImp(c.columna) + '</span>',
        '<span class="csv-flecha">→</span>',
        '<select class="csv-campo csv-campo-select" data-indice="' + c.indice + '">' + opciones + '</select>',
        '</div>',
        // El aviso va EN SU FILA, no una vez al final: «esta columna» en singular solo
        // significa algo al lado de la columna a la que se refiere. Con cuatro sin reconocer,
        // un aviso global no dice CUAL.
        (c.campo ? '' : '<p class="csv-columna-aviso">No sabemos qué es esta columna. Elige un campo o déjala fuera.</p>'),
        '</div>',
      ].join('');
    }).join('');



    paso.innerHTML = [
      '<h4 class="csv-titulo-12">Esto es lo que hemos entendido</h4>',
      '<div>' + filas + '</div>',
      '<button class="btn-primary csv-boton-14" id="csv-importar">Está bien, importar</button>',
    ].join('');

    paso.querySelectorAll('.csv-campo').forEach(function (sel) {
      sel.addEventListener('change', recogerMapeo);
    });
    paso.querySelector('#csv-importar').onclick = importar;
    recogerMapeo();
  }

  function recogerMapeo() {
    est.mapeo = {};
    paso.querySelectorAll('.csv-campo').forEach(function (sel) {
      if (sel.value) est.mapeo[sel.value] = Number(sel.getAttribute('data-indice'));
    });
  }

  async function importar() {
    const btn = paso.querySelector('#csv-importar');
    btn.disabled = true;
    btn.textContent = 'Importando…';
    setAlert(null, '');
    try {
      const d = await apiRequest('/admin/customers/import', {
        method: 'POST',
        body: JSON.stringify({ fichero: est.base64, codificacion: est.codificacion, mapeo: est.mapeo }),
      });
      pintarInforme(d);
      if (typeof window.loadCustomers === 'function') window.loadCustomers();
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Está bien, importar';
      setAlert('error', (err && err.message) || 'No hemos podido importar el archivo.');
    }
  }

  // ── PASO 3 · Informe ───────────────────────────────────────────────────────
  function pintarInforme(d) {
    const rechazos = d.rechazos || [];
    const resumen = '<p class="csv-resumen"><strong>' + d.creados + '</strong> clientes importados'
      + (d.omitidos ? ' · <strong>' + d.omitidos + '</strong> ya estaban' : '') + '.</p>';

    if (!rechazos.length) {
      paso.innerHTML = resumen + '<button class="btn-primary csv-boton-14" id="csv-fin">Cerrar</button>';
      paso.querySelector('#csv-fin').onclick = cerrar;
      return;
    }

    // Microcopy APROBADA. Y sin capar: se listan TODAS.
    const lista = rechazos.map(function (r) {
      return '<div class="csv-rechazo">'
        + 'Fila ' + r.fila + ' · ' + escImp(r.motivo) + '</div>';
    }).join('');

    paso.innerHTML = [
      resumen,
      '<h4 class="csv-titulo-rechazos">' + rechazos.length + ' filas no han entrado</h4>',
      '<p class="csv-guia-10">Puedes descargarlas, corregirlas y volver a importar.</p>',
      '<div class="csv-rechazos-lista">' + lista + '</div>',
      '<button class="btn-primary csv-boton-12" id="csv-descargar">Descargar las filas con errores</button>',
      '<button class="btn-secondary csv-boton-8" id="csv-fin">Cerrar</button>',
    ].join('');

    paso.querySelector('#csv-fin').onclick = cerrar;
    paso.querySelector('#csv-descargar').onclick = function () {
      const blob = new Blob([d.csvRechazos || ''], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'clientes-con-errores.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    };
  }

  pintarElegir();
}

function escImp(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
