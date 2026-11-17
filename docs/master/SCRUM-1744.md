# SCRUM-1744 · el PDF del albarán ya no le lleva los precios al operario

**Medido contra:** `origin/main` = `a3510f52b208b060e755c81e0c8cc1accc299672` · 2026-11-17T07:26:43Z (hora de GitHub, de `scripts/equipo/ancla.mjs`; sesión S1, por encargo del orquestador `cobroflash-backend-53`, PILOTO-1)

A9: comprobación → `tests/scrum1744-pdf-del-albaran-sin-precios-operario.test.mjs`

**Cero textos, cero estados, cero flags, cero esquema.** El operario recibe un papel que ya existía: el que imprime el interruptor `ocultarPreciosEnDocumento` (SCRUM-607).

## ⓪ La lectura de S4, CONFIRMADA

S4 (recorrido H6, 16-nov) lo leyó en el código sin probarlo con una sesión de técnico: `GET /admin/albaranes/:id/pdf` está en `TECNICO_ALLOWED` (`adminRouteDeclarations.ts:183`) y su manejador no miraba el rol. **Confirmado por comportamiento** con una sesión de técnico real contra el banco desechable: con un albarán VALORADO a 987,65 €, el test ② salió **ROJO** con los dos fallos que debía dar —«el PDF del operario lleva el PRECIO UD.» y «al operario se le sirve el PDF del admin desde la caché»— y sus controles en verde (el admin sí lleva el precio, el PDF se deja leer y trae la línea del albarán).

## ① Qué se decide, y por qué

- **Firma del fundador** (SCRUM-1707 c.21547, Q2, literal): «No: se recortan — el servidor recorta los precios del albarán para el rol operario, igual que ya hace con el parte.» El PDF lo dejó FUERA el **orquestador** como ejecución (c.21556 ②), y SCRUM-1744 lo reabre: «decidir cuál, sin textos nuevos».
- **Elegido: recortar el papel** en vez de sacar la ruta de `TECNICO_ALLOWED`. Si se sacara la ruta, el botón «Descargar PDF» que la pantalla del operario ya le ofrece daría un 403, y quitarlo es trabajo de S2 (front). Con el recorte, el botón sirve **lo que su rol ve**, que es el tercer punto de la aceptación, y no cambia ni una línea de front.
- **Cómo:** `pdfDelAlbaranSinPrecios(rol)` (en `albaranParaElRol.ts`, por capacidad `seesOnlyOwnJobs`: un rol desconocido o ausente va al lado restringido). Si es `true`, `ensureAlbaranPdf(id, false, { sinPrecios: true })` imprime el MISMO documento con `ocultarPreciosEnDocumento` puesto:
  - en un **fichero aparte** (`<merchant>-<numero>-sin-precios.pdf`): ni envenena el papel del negocio ni se le sirve el del negocio desde la caché de disco (el test lo mide en los dos órdenes);
  - **regenerado en cada petición**: nadie invalida esa caché al editar el albarán;
  - **sin tocar el albarán**: ni el interruptor (el test lo mide) ni `pdfUrl`.
- El admin no cambia: mismo fichero, misma caché, byte a byte.

## ② Ficheros

| fichero | qué |
|---|---|
| `src/modules/jobs/domain/albaranParaElRol.ts` | `pdfDelAlbaranSinPrecios` + la cabecera ya no dice que el PDF queda fuera |
| `src/modules/jobs/domain/albaran.service.ts` | `ensureAlbaranPdf`: tercer parámetro `{ sinPrecios }` (opcional; los llamadores de siempre no cambian) |
| `src/modules/jobs/infra/albaranPdf.service.ts` | `generateAlbaranPdf`: `nombreDeArchivo` opcional (ausente = el de siempre) |
| `src/modules/jobs/app/routes/albaranes.routes.ts` | `GET /:id/pdf` pasa el rol |
| `tests/scrum1744-pdf-del-albaran-sin-precios-operario.test.mjs` | ① sin BD, la decisión por capacidad · ② con banco, el PDF de cada sesión en los dos órdenes, con controles |

## ③ Medido

- `scrum1744`, rojo-primero: ① verde, ② **rojo** (los dos fallos de arriba) con sólo la decisión añadida; ② **verde** con la ruta cambiada.
- Acoplados con banco (`LIBRO_PG_URL` a un cluster propio, puerto 55744, base `yaqu_1744_test`), 17 ficheros (1744, 1707, 1712, 607, 452, 300, 462, 608, 762, 72, 806, 807, 285, 1650c, 1632c, 1302k, `albaran`): **118/118, 0 fallos, 0 saltos**, salida 0, TAP a fichero.

## ④ Lo que NO cambia y se declara

- **`POST /:id/enviar-whatsapp` y la firma remota** siguen mandando AL CLIENTE el papel del negocio (con el interruptor que tenga el albarán): es el documento del cliente, no la pantalla del operario.
- **🔎 Visto y NO arreglado (fuera de alcance, se avisa al orquestador):** `GET /admin/albaranes/:id` le da al operario el `firmaToken` (SCRUM-49c), y con él puede abrir la página pública de firma `/albaran/<token>`, que enseña los precios según `ocultarPreciosEnDocumento`, no según el rol. Es la página del CLIENTE; decidir si el operario debe poder abrirla con precios no es de este ticket. No lo he probado con sesión: es MI LECTURA del código.
