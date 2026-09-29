# SCRUM-1268 — `scripts/qa/sembrar-qa.mjs`: escritura ESTRECHA en la cuenta QA para QA en producción

**Medido contra:** `origin/main` = `b1d8845daf38394c33a22814db323394517c091a` · 2026-09-29T09:59:24Z

Sesión 3 (instrumentos). Encargo del orquestador (`cobroflash-backend-57`), con autorización del fundador para
hacer QA en producción en la cuenta `luisdragonball+qa@gmail.com`, incluida la escritura en Configuración.

## Por qué existe

El clasificador de permisos deniega conducir un navegador contra producción. A S4 se lo denegó como
[Production Reads]; a S1, por dos motivos: el MCP no tiene `fs`, y el `playwright-core` local se marcó como
«Credential Exploration». Este fichero es la única vía, y es estrecha: una herramienta y una regla.

El primer intento, que añadía la escritura a `sesion-panel.mjs`, lo **denegó el clasificador** («Modify Shared
Resources»). No se rodeó. El fundador autorizó un fichero **aparte**: `sesion-panel.mjs` sigue siendo solo de
lectura, así que son dos ficheros con dos reglas. Para retirar la escritura basta borrar este fichero y su regla.

## Lo medido antes de construir (rutas, en el árbol)

| Operación | Ruta | Efectos |
| --- | --- | --- |
| ¿quién soy? | `GET /admin/me` | devuelve `merchantId`, `merchantName` e `isOwner`, pero **no el correo** |
| cliente | `POST /admin/customers` | solo BD; el teléfono no es único y se guarda tal cual |
| trabajo | `POST /admin/jobs` | solo BD + auditoría |
| albarán | `POST /admin/jobs/:id/albaranes` + `claveIdempotencia` | repetir devuelve **200 `repetida`** sin reservar número |
| emitir | `POST /admin/albaranes/:id/emitir` | **irreversible**: gasta número ALB. No envía nada ni factura |
| parte | `POST /admin/partes` | siempre en borrador; solo BD |
| perfil | `PUT /admin/merchant` | responde con la **fila cruda** del merchant (no se imprime) |

La cuenta QA es el merchant **46** («PruebaQA», owner, plan trial). Lo medí con `sesion-panel.mjs get /admin/me`, en solo lectura.

## Los cerrojos

- **Cuenta:** `GET /admin/me` → `merchantId === 46 && isOwner`. Si no se cumple, no sale **ninguna** escritura
  (salida 3). `escritura()` solo acepta el objeto que devuelve esa comprobación: uno fabricado no vale.
- **Lista blanca** de método + ruta (las 6 de arriba), más una lista de **prohibidas** redundante a propósito:
  envíos, facturas, cobros, onboarding, flags y borrados. Tampoco admite query ni fragmento, ni otro host.
  Todo esto se comprueba **antes de la red**.
- **Idempotente:** cliente por nombre exacto; trabajo por cliente y título; albarán por su clave fija por
  trabajo, y **se emite solo si no lo está**; parte en borrador por trabajo. Si hay ambigüedad o la lista viene
  llena (200), responde «no pude» (salida 1) en vez de crear otro.
- **Perfil:** GET → PUT → GET. Imprime, campo a campo, lo enviado y lo releído, y marca «CAMBIÓ SIN
  ENVIARSE» cuando algo cambia sin haberlo mandado. Así se ve solo lo que el esquema descarta en silencio (el
  defecto del IRPF) y lo que se borra al guardar (la familia de SCRUM-1227). `slug` e `invoiceSeriesPrefix` se
  rechazan.

## Pruebas

`tests/scrum1268-sembrar-qa.test.mjs` usa un `fetch` falso **con estado** y no toca la red. Cubre el sembrado
desde cero, la repetición (no crea nada ni vuelve a emitir), el cerrojo en 4 variantes con su control positivo,
la lista blanca (11 rutas fuera y 6 dentro), la cuenta fabricada, 4 casos de fail-closed, el perfil con el
IRPF descartado y el campo borrado, las exclusiones y la falta de sesión. Tiene **3 mutaciones** declaradas
(quitar el cerrojo, quitar la lista blanca, emitir siempre) y las 3 caen.

## Regla de EJECUCIÓN (la añade el fundador; no se ha ejecutado contra producción)

```
"Bash(node scripts/qa/sembrar-qa.mjs sembrar)",
"Bash(node scripts/qa/sembrar-qa.mjs perfil:*)"
```

Antes hay que hacer `node scripts/qa/sesion-panel.mjs login luisdragonball+qa@gmail.com`, que ya está cubierto
por su regla.
