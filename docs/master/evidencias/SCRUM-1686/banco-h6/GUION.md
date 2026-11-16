# Recorrido final de Trabajos · GUION EN FRÍO (S4 · 12-nov-2026 ~19:45Z)

Escrito ANTES de que el paquete esté en `main`, sin tocar producción. Medido sobre `origin/main`
`02aa1a42d537959e00944efd9fd2d7824d4fa1bb` y las puntas del paquete a esa hora:
`scrum-1662-que-hay-que-hacer` `60f6e87494e058fcd2d2417f9f48596610eed5ac` (#3151) y
`scrum-1707-operario-sin-dinero` `f899f2cf93a905b773c2690d7a20bb91942994f3` (#3153).
Si esas puntas se mueven antes del merge, la sección «Lo que el paquete cambia» se re-lee del diff.

## Instrumentos
- Banco de SCRUM-1658 (en `main`): `docs/master/evidencias/SCRUM-1658/banco/` — `lib.mjs`, `paso.mjs`, `mirar.mjs`, `a02…a21`.
- Nuevo, en esta carpeta (`docs/master/evidencias/SCRUM-1686/banco-h6/`): `rol.mjs` (viste el rol y cuenta) y `paso2.mjs` (= `paso.mjs` + `ROL=` + cuentas + sale 1 si la acción falla + `bitacora.txt`).
  Comprobados sin red: `node --check` 0/0; vocabulario con control positivo (13 de 13 claves ≥1) y negativo (13 de 13 a 0).
- Se lanza con `BANCO_OUT=<carpeta de capturas>`:
  `node docs/master/evidencias/SCRUM-1686/banco-h6/paso2.mjs <390|1280> "<hash>" <nombre> <acciones.mjs>` y `ROL=tecnico` para el operario.
- ⚠️ La hora de `bitacora.txt` es la del reloj local (va ~6,5 min adelantado): la hora de cada tramo sale de `gh api -i zen`.

## Lo que el rol simulado mide y lo que NO
| capa | cómo | lo que prueba | lo que NO prueba |
|---|---|---|---|
| front | `/admin/me` → `tecnico` | qué PINTA el panel a un operario | — |
| cable | copia literal de `trabajoParaElRol` + `albaranParaElRol`, `/admin/team` 403, sólo sus trabajos | que el front no FABRICA cifras con lo vacío («0,00 €», «NaN») | que yaqu.app recorte de verdad: eso lo dicen los tests del paquete, o una sesión del operario 30 |
| escrituras | salen con la cookie de ADMIN | que el flujo se puede completar | sus 403: cada `MÉTODO ruta` se apunta y se casa A MANO con `TECNICO_ALLOWED` (`adminRouteDeclarations.ts` de main) |
El parte NO necesita recorte simulado: sus cinco rutas responden a todos con `serializeParteParaElTecnico` (sin precios).

## Lo que el paquete cambia (leído del diff, no de memoria)
- Alta: `tn-descripcion` («Qué hay que hacer») deja de ir a `notes` y va a `jobs.que_hay_que_hacer` (ALTER aplicado en prod y staging, c.21553).
- Ficha (S2): línea «Qué hay que hacer», ABIERTA, párrafo `.detail-tarea` (`pre-wrap`, `overflow-wrap:anywhere`), sólo lectura; sin tarea NO hay línea. «Notas internas» sólo para `admin` (línea quitada del DOM). Sin `veEstadoDeCobro`: fuera «Te falta por cobrar», «Cobrado», la barra y los huecos; se queda «Aceptado».
- Servidor: al operario `notes`, `totalCobrado`, `estadoCobro`, `remaining`, `nextStage`, `charge` → null; `invoices` → []; albaranes sin `precioUnitario`/`tipoIva`/`totales`; `PATCH {notes}` → 403; el `.ics` lleva la tarea y no las notas.
- Lista (S4, ya en main por #3127): sin «Por cobrar», sin filtros de cobro, importe a secas.

## TRAMO 0 · Testigos (si uno falla, NO se recorre)
| # | qué | cómo | pasa si |
|---|---|---|---|
| 0.1 | main lleva el paquete | `git log origin/main --grep=SCRUM-1662 --grep=SCRUM-1707 --oneline` + `git merge-base --is-ancestor` de las dos puntas (o su contenido: `git grep queHayQueHacer origin/main -- src public`) | las dos dentro |
| 0.2 | el FRONT desplegado es el de main | `curl` + `git hash-object --no-filters` contra `git rev-parse origin/main:<ruta>` de `jobDetailView.js`, `jobTrabajoPlegable.js`, `jobsView.js`, `css/styles.css` | 4 de 4 blobs iguales |
| 0.3 | el SERVIDOR desplegado es el del paquete | `node scripts/qa/sesion-panel.mjs get /admin/jobs/77` (el JSON es la línea [1]) | 200 y la clave `queHayQueHacer` EXISTE (null en el #77) |
| 0.4 | sesión QA | `node scripts/qa/sesion-panel.mjs estado` | VIVA |
| 0.5 | el recorte copiado es el de main | `git diff <punta leída> origin/main -- src/modules/jobs/domain/trabajoParaElRol.ts src/modules/jobs/domain/albaranParaElRol.ts` | vacío → `COPIADO_DE=<sha main>`; si no, re-copiar a `rol.mjs` |
| 0.6 | qué rutas pasan por el recorte | leer `albaranes.routes.ts` y `jobs.routes.ts` de main (`grep -n ParaElRol`) | las rutas de `rol.mjs` cubren las que el front pide (casar con `--- RECORTES` de la primera medida) |

## TRAMO 1 · ADMIN crea el trabajo (escribe en prod, cuenta QA)
Sujeto NUEVO = «T» (lleva tarea y notas, nace sin importe). Sujeto de DINERO = el **#77** (1,21 €, de «Operario QA», en curso; anterior al paquete: sin tarea).
| paso | acción (banco) | aserto | dónde se ve |
|---|---|---|---|
| 1.1 | `a02-modal` a 390 y 1280 | 4 campos + «Abrir trabajo»; sin desborde; ≥44 px | `…-abierto-admin-*.txt` |
| 1.2 | `a04-crear-trabajo` adaptado (`b04`): cliente «Marta Prieto (PILOTO-1 QA)», tipo, dirección, y una TAREA de dos párrafos con salto de línea y una palabra de 60 caracteres sin espacios | `POST /admin/jobs → 201`; respuesta con `queHayQueHacer` = lo escrito y `notes` = null | ESCRITURAS + `sesion-panel get /admin/jobs/<T>` |
| 1.3 | ficha de T como admin | línea «Qué hay que hacer» ABIERTA con el texto, los dos párrafos separados, la palabra larga partida sin desborde a 390; «Notas internas» presente y vacía | cuentas `queHayQueHacer≥1`, `notasInternas≥1`, DESBORDES=0 |
| 1.4 | escribir una NOTA interna («NOTA-PRIVADA-QA …») en la ficha | `PATCH /admin/jobs/<T> → 200`; tras recargar sigue | ESCRITURAS + recarga |
| 1.5 | asignar a «Operario QA» (línea «Quién») y `a06-agendar` para HOY | `PATCH → 200`; en la lista T pasa a su grupo y cuenta en «PARA HOY» | lista admin |
| 1.6 | lista como admin, 390 y 1280 | T visible; tarjeta «Por cobrar» y filtros SIGUEN (control positivo de todo lo que luego debe faltar) | cuentas `porCobrar≥1` |

## TRAMO 2 · OPERARIO (simulado) ve lo suyo — `ROL=tecnico`, 390 y 1280
| paso | acción | aserto (operario) | control positivo (admin, misma pantalla) |
|---|---|---|---|
| 2.1 | lista | sólo T y #77; `porCobrar=0`, `pendiente/parcial/pagado=0`, `deImporte=0`; #77 con «1,21 €» a secas; `basura=0`, `ceroEuros=0` | 1.6 |
| 2.2 | ficha de T | `queHayQueHacer≥1` y el TEXTO de la tarea está; `notasInternas=0` y «NOTA-PRIVADA-QA» NO aparece en el texto ni en el DOM (`document.documentElement.innerHTML`); ningún `textarea` de notas | 1.3/1.4 |
| 2.3 | ficha de #77 | «Aceptado» + 1,21 € presente; `cobrado=0`, `teFalta=0`, sin barra (`.progress`/la clase que tenga: se mira en el admin primero); `ceroEuros=0`; SIN línea de tarea (no consta → no se pinta) | ficha #77 como admin: «Cobrado» y «Te falta» ≥1 |
| 2.4 | qué acciones se le ofrecen (lista y ficha) | inventario de PULSABLES; cada una se casa con `TECNICO_ALLOWED`: una acción ofrecida que el servidor le negaría = AVERÍA (control que no puede usarse, canon de SCRUM-823) | — |
| 2.5 | `GET /admin/jobs/<T>/ics` (sólo con operario REAL) | DESCRIPTION = la tarea, no la nota | NO MEDIBLE con rol simulado → se dice |

## TRAMO 3 · OPERARIO abre y rellena el parte (escribe)
| paso | acción (banco) | aserto |
|---|---|---|
| 3.1 | desde la LISTA, la primaria «Abrir parte» de T (variante de `a08`, que lo hacía desde la ficha con «Parte de trabajo») | `POST /admin/partes → 201` y aterriza en `#parte-detail/<P>`; ¿hereda obra y tipo del trabajo? (SCRUM-1674) |
| 3.2 | `a09-rellenar` (horas, desplazamiento, km, dictado → «Ordenar en líneas») | cada `PATCH → 200`; tiempo de «Ordenar en líneas» medido; sin «NaN»; a 390 sin desborde |
| 3.3 | `a10-anadir` | las líneas quedan en el parte; tras recargar siguen (y qué NO sobrevive a la recarga: se apunta) |
| 3.4 | `a11-datos` (obra, tipo, técnicos) | tras recargar, el bloque «DATOS DEL PARTE» conserva los tres |
| 3.5 | cuentas del parte como operario | `euros=0`, `factura=0`, `basura=0`; márgenes laterales a 390 (borrador: 12 px medidos el 12-nov) |

## TRAMO 4 · Firmas
| paso | acción | aserto |
|---|---|---|
| 4.1 | `a12-firma` `FIRMA=tecnico` sin `HACER` | «Confirmar firma» DISABLED antes del trazo; campos y botones del modal |
| 4.2 | `a12-firma` `FIRMA=tecnico HACER=1` | `POST /admin/partes/<P>/firmar-tecnico → 200`; el parte lo dice |
| 4.3 | `a12-firma` `FIRMA=cliente HACER=1` («Firmar aquí mismo») | `POST …/firmar → 200`; estado FIRMADO; ya no se puede editar (inputs fuera o `disabled`) |
| 4.4 | parte firmado a 390 y 1280 | margen lateral (firmado: 18 px el 12-nov, contra 12 del borrador → se re-mide y va a la lista); qué acción queda como primaria |
⛔ NO se pulsa «Enviar para firmar» ni nada que salga por WhatsApp o correo (STOP de Meta; además 403 `trial_expired`). Si es la ÚNICA salida que la pantalla ofrece en algún estado, eso es un hallazgo y se apunta.

## TRAMO 5 · Albarán
No sé todavía por dónde nace (¿«+ Nuevo albarán» de la fila, la ficha, o desde el parte firmado?): se LEE del inventario tras 4.3, no se supone.
| paso | acción | aserto |
|---|---|---|
| 5.1 | el camino que la pantalla ofrezca al operario tras firmar | qué `MÉTODO ruta` dispara y si `TECNICO_ALLOWED` la tiene |
| 5.2 | albarán como operario (lista y detalle, 390/1280) | `euros=0`, `ceroEuros=0`, `basura=0`: con `totales:null` y líneas sin precio el front NO puede pintar «0,00 €» ni «NaN» (la misma clase de cifra falsa que D1) |
| 5.3 | el mismo albarán como admin | precios y total presentes (control positivo) |

## TRAMO 6 · Lo que ve la oficina después (admin)
| paso | acción | aserto |
|---|---|---|
| 6.1 | ficha de T | parte firmado enlazado, albarán, estado; la tarea y la nota siguen |
| 6.2 | `a15-estados` hasta ANTES de «Cerrar» | primaria de cada estado; el cierre (irreversible) NO se pulsa: T se queda abierto como sujeto |
| 6.3 | lista admin | T en su grupo; nada del recorrido ha roto cifras de «Por cobrar» |

## En cada medida, sin excepción
DESBORDES=0 · pulsables <44 px · LOG (errores de consola y HTTP ≥400) · `basura` · ESCRITURAS con su código · rol que DICE la página (`paso2` sale 1 si no es el pedido).
Lista de averías: una fila por hallazgo — `pantalla · ancho · rol · qué se ve · qué debería · medida/captura · de quién es (S4: lista, parte, albarán · S2: ficha · S1: servidor)`.

## Dudas que cambian el recorrido (para el orquestador)
1. ¿Hay ya sesión del OPERARIO REAL (miembro 30, H6)? Con ella, 2.5 y los 403 de escritura se miden de verdad; sin ella quedan «no medido en yaqu.app · cubierto por `tests/scrum1707-…` y `scrum1662-…`».
2. ¿Bajo qué TICKET va el registro y la rama del recorrido (el banco nuevo se sube: A8)?
3. T se queda en la cuenta QA como dato de prueba (no se cierra ni se borra). ¿Conforme?
