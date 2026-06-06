// public/dashboard/js/csvImport.js
// Modal para importar clientes desde CSV. Se usa desde customersView.js.

function openImportCsvModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = [
    '<div class="modal" style="max-width:600px">',
    '<div class="modal-header">',
    '<h3 class="modal-title">⬆ Importar clientes desde CSV</h3>',
    '<button class="modal-close" id="csv-modal-close">&times;</button>',
    '</div>',
    '<div class="modal-body">',
    '<p style="font-size:13px;color:var(--neutral-500);margin:0 0 12px">',
    'Sube un fichero <strong>.csv</strong> o pega el contenido. Columnas aceptadas:<br/>',
    '<code style="font-size:12px;background:var(--neutral-100);padding:2px 6px;border-radius:4px">nombre</code> ',
    '<code style="font-size:12px;background:var(--neutral-100);padding:2px 6px;border-radius:4px">telefono</code> ',
    '<code style="font-size:12px;background:var(--neutral-100);padding:2px 6px;border-radius:4px">email</code> ',
    '<code style="font-size:12px;background:var(--neutral-100);padding:2px 6px;border-radius:4px">notas</code>',
    ' (separador coma o punto y coma)',
    '</p>',
    '<div class="alert" id="csv-alert" style="display:none"></div>',
    '<div id="csv-dropzone" style="border:2px dashed var(--neutral-300);border-radius:10px;padding:18px;text-align:center;cursor:pointer;transition:border-color .15s;margin-bottom:8px">',
    '<div style="font-size:13px;color:var(--neutral-500)">',
    '📂 Arrastra tu fichero CSV o <span style="color:var(--green-600);font-weight:600;text-decoration:underline">haz click para elegirlo</span>',
    '</div>',
    '<input type="file" id="csv-file-input" accept=".csv,.txt" style="display:none"/>',
    '</div>',
    '<div style="text-align:center;font-size:12px;color:var(--neutral-400);margin:4px 0">— o pega el contenido —</div>',
    '<textarea id="csv-paste" rows="4" placeholder="nombre,telefono,email\nJuan,+34600000001,juan@email.com" ',
    'style="width:100%;padding:8px 10px;border:1.5px solid var(--neutral-200);border-radius:8px;font-size:12px;font-family:monospace;resize:vertical"></textarea>',
    '<button class="btn-secondary" id="csv-parse-btn" style="width:100%;margin-top:8px">Vista previa</button>',
    '<div id="csv-preview" style="display:none;margin-top:14px">',
    '<div style="font-size:12px;font-weight:600;color:var(--neutral-500);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px" id="csv-preview-summary"></div>',
    '<div style="max-height:200px;overflow-y:auto;border:1px solid var(--neutral-200);border-radius:8px">',
    '<table class="table" id="csv-preview-table"></table>',
    '</div>',
    '<button class="btn-primary" id="csv-import-btn" style="width:100%;margin-top:10px">✅ Importar clientes</button>',
    '</div>',
    '</div>',
    '</div>',
  ].join('');
  document.body.appendChild(overlay);

  var closeModal = function() { overlay.remove(); };
  overlay.querySelector('#csv-modal-close').onclick = closeModal;
  overlay.addEventListener('click', function(e) { if (e.target === overlay) closeModal(); });

  var alertEl   = overlay.querySelector('#csv-alert');
  var parseBtn  = overlay.querySelector('#csv-parse-btn');
  var importBtn = overlay.querySelector('#csv-import-btn');
  var preview   = overlay.querySelector('#csv-preview');
  var fileInput = overlay.querySelector('#csv-file-input');
  var dropzone  = overlay.querySelector('#csv-dropzone');
  var pasteArea = overlay.querySelector('#csv-paste');

  function setAlert(type, msg) {
    alertEl.textContent = msg || '';
    alertEl.className = 'alert';
    if (type === 'error')   alertEl.classList.add('error');
    if (type === 'success') alertEl.classList.add('success');
    alertEl.style.display = (type || msg) ? 'block' : 'none';
  }

  function readFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) { pasteArea.value = e.target.result; };
    reader.readAsText(file, 'UTF-8');
  }

  dropzone.addEventListener('click', function() { fileInput.click(); });
  dropzone.addEventListener('dragover', function(e) {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--green-500)';
  });
  dropzone.addEventListener('dragleave', function() {
    dropzone.style.borderColor = 'var(--neutral-300)';
  });
  dropzone.addEventListener('drop', function(e) {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--neutral-300)';
    var file = e.dataTransfer && e.dataTransfer.files[0];
    if (file) readFile(file);
  });
  fileInput.addEventListener('change', function() {
    if (fileInput.files[0]) readFile(fileInput.files[0]);
  });

  var parsedRows = [];

  parseBtn.addEventListener('click', function() {
    var text = pasteArea.value.trim();
    if (!text) { setAlert('error', 'Pega el contenido CSV o sube un fichero.'); return; }
    parsedRows = csvParseRows(text);
    if (!parsedRows.length) { setAlert('error', 'No se detectaron filas. Comprueba el formato.'); return; }

    var valid   = parsedRows.filter(function(r) { return r.name; });
    var invalid = parsedRows.length - valid.length;
    overlay.querySelector('#csv-preview-summary').textContent =
      valid.length + ' cliente' + (valid.length !== 1 ? 's' : '') + ' válidos' +
      (invalid > 0 ? ' · ' + invalid + ' filas sin nombre (se omitirán)' : '');

    var table = overlay.querySelector('#csv-preview-table');
    table.innerHTML = '<thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th></tr></thead>';
    var tbody = document.createElement('tbody');
    valid.slice(0, 25).forEach(function(r) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td>' + escImp(r.name) + '</td><td style="color:var(--neutral-500)">' +
        escImp(r.phone||'') + '</td><td style="color:var(--neutral-500)">' + escImp(r.email||'') + '</td>';
      tbody.appendChild(tr);
    });
    if (valid.length > 25) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="3" style="text-align:center;color:var(--neutral-400);font-size:12px">… y ' + (valid.length - 25) + ' más</td>';
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    preview.style.display = 'block';
    setAlert(null, '');
  });

  importBtn.addEventListener('click', async function() {
    var valid = parsedRows.filter(function(r) { return r.name; });
    if (!valid.length) return;
    importBtn.disabled = true;
    importBtn.textContent = 'Importando…';
    try {
      var data = await apiRequest('/admin/customers/import', {
        method: 'POST',
        body: JSON.stringify({ customers: valid }),
      });
      closeModal();
      var msg = '✅ Importación completada:\n• ' + data.created + ' clientes nuevos\n• ' +
        data.skipped + ' ya existían\n• ' + data.errors + ' errores';
      alert(msg);
      if (window.renderAppView) renderAppView('customers');
    } catch(err) {
      setAlert('error', 'Error durante la importación. Inténtalo de nuevo.');
      importBtn.disabled = false;
      importBtn.textContent = '✅ Importar clientes';
    }
  });
}

function csvParseRows(text) {
  var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
  if (lines.length < 2) return [];
  var sep = lines[0].includes(';') ? ';' : ',';
  var headers = lines[0].split(sep).map(function(h) {
    return h.trim().toLowerCase()
      .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
      .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')
      .replace(/\s+/g,'_').replace(/^"(.+)"$/,'$1');
  });
  var iName  = findIdx(headers, ['nombre','name','cliente']);
  var iPhone = findIdx(headers, ['telefono','phone','tel','movil','mobile']);
  var iEmail = findIdx(headers, ['email','correo','mail']);
  var iNotes = findIdx(headers, ['notas','notes','nota','observaciones']);
  if (iName < 0) return [];
  return lines.slice(1).map(function(line) {
    var c = csvSplitLine(line, sep);
    return {
      name:  cell(c, iName),
      phone: cell(c, iPhone),
      email: cell(c, iEmail),
      notes: cell(c, iNotes),
    };
  });
}

function findIdx(headers, keys) {
  for (var i = 0; i < keys.length; i++) {
    var idx = headers.indexOf(keys[i]);
    if (idx >= 0) return idx;
  }
  return -1;
}

function cell(cells, idx) {
  if (idx < 0 || idx >= cells.length) return '';
  return cells[idx].trim().replace(/^"|"$/g, '');
}

function csvSplitLine(line, sep) {
  var result = [], cur = '', inQ = false;
  for (var i = 0; i < line.length; i++) {
    var ch = line[i];
    if (ch === '"')       { inQ = !inQ; }
    else if (ch === sep && !inQ) { result.push(cur); cur = ''; }
    else                  { cur += ch; }
  }
  result.push(cur);
  return result;
}

function escImp(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
