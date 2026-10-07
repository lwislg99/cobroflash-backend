# SCRUM-1184 · Dos módulos de albaranes sin importador: por qué, y qué hace falta con cada uno

**Medido contra:** `origin/main` = `494c0a7165d4b3e39e9b4b39d50616e32616a710` · 2026-09-27T17:56:08Z

**Escribe:** Sesión 1 (S1) · **Rama:** `scrum-1184-ventana-firma-alter` · **Carril:** S1 (servidor) con S4.

La pregunta del PASO 0 (orquestador): **¿por qué no se importan?** Tres respuestas posibles:
① pantalla que nunca llegó · ② resto de un refactor que se puede borrar · ③ necesita un ALTER.

| Módulo | Ticket de origen (`git log`) | Respuesta | Qué hace falta |
|---|---|---|---|
| `jobs/domain/albaranSerie.ts` | `c69cc54c` SCRUM-306 (C7), 6-ago | **① pantalla que nunca llegó** | ruta de lectura + pantalla + texto firmado |
| `jobs/domain/ventanaDeFirma.ts` | `e2c255ad` SCRUM-359 (H4), 11-ago | **③ ALTER**, y además **STOP de la regla 38** para cablearlo | `.sql` (en esta rama) → GO del fundador → cableado |

Ninguno es ②: los dos siguen describiendo una necesidad viva y nada los ha sustituido. **No se
propone borrar nada.**

## 1 · `albaranSerie.ts` — construido para una pantalla que no se hizo

- Su registro (`docs/master/SCRUM-306.md`, «Microcopy») lo dice: *«Nada de esto se pinta todavía:
  son módulos de dominio… El rótulo de la serie de albaranes llegará con la pantalla»*.
- **Otra pieza no hace ya lo mismo** (medido): ningún otro detector de huecos de serie en `src/` ni
  `public/` (`jobCobroHuecos.js` y `paquete.ts` son huecos de COBRO y de evidencias, otra cosa);
  ninguna vista previa del número siguiente en ninguna pantalla.
- Sus dos funciones siguen apoyadas en las piezas vivas: `formatAlbaranNumber`/`resolveAlbaranSeq`
  (`albaranNumber.service.ts`, las mismas de `allocateAlbaranNumber`).
- **Para enchufarlo:** servidor = una ruta de LECTURA (número siguiente + huecos del año, sin
  escribir nada, sin ALTER); front = dónde se enseña (al crear el albarán y/o en la serie) + texto
  del aviso firmado (regla 39). **No se construye la ruta sola**: una ruta sin pantalla sería otra
  pieza construida y sin consumir, la misma deuda con otro nombre. Va cuando se reparta el front.
- El prefijo configurable de la serie (hueco declarado en SCRUM-306) sí necesitaría columna; es
  aparte y no hace falta para lo anterior.

### 🔴 Hallazgo: el censo no ve lo que sólo consume un módulo muerto

`huecosDeLaSerie` (`invoicing/domain/huecosSerie.ts`, SCRUM-291 · A4, «detectar los huecos» de la
serie de FACTURAS) **no tiene ningún consumidor de producción**: su único importador en `src/` es
`albaranSerie.ts`, que a su vez no importa nadie (`git log -S` sobre `src/`: el único commit que
lo importa es el de SCRUM-306). El censo de SCRUM-1185 lo da por consumido porque cuenta un
importador muerto como consumidor. Es de J1 (facturas); se reporta, no se toca.

## 2 · `ventanaDeFirma.ts` — necesita columnas, y cablearlo es STOP

- Su registro (`docs/master/SCRUM-359.md` §4-§5): diff de tres columnas «PREPARADO Y PARADO»,
  y tres pasos para llegar al profesional: ① columnas · ② `encoladaEn` viaja en el `POST …/firmar`
  (hoy `colaDeFirmas.js` lo pone y no lo manda) · ③ cablear `contrastarReloj` donde se hace
  `const firmadoAt = new Date()`.
- **Medido hoy:** ninguna de las tres columnas existe en `prisma/schema.prisma` ni en `docs/sql/`.
  Nadie guarda la hora del dispositivo por otro camino.
- **Hecho en esta rama:** `docs/sql/scrum-359-ventana-de-firma.sql`, generado offline
  (`preview-migracion.mjs --desde`, control positivo OK, veredicto «aditiva»), idéntico al diff de
  §4. `prisma/schema.prisma` intacto; nada aplicado. Se suma a la cola de ALTER del equipo de Javier.
- **El paso ③ sigue siendo STOP (regla 38):** añade una escritura a los endpoints que sellan la
  firma. Va con GO explícito del fundador. El paso ② es front (S4/S2).
- ⚠️ **Hallazgo:** hoy hay **tres** caminos que sellan `firmadoAt = new Date()`, no dos:
  `albaranes.routes.ts:994`, `albaranPublic.routes.ts:431` y **`partes.routes.ts:740`** (el parte de
  trabajo, posterior a SCRUM-359, que también firma por `colaDeFirmas.js`). El `.sql` cubre sólo
  `albaranes`, que es lo que decidió el fundador; si la ventana debe valer también para el parte,
  es una decisión nueva (y otras columnas en su tabla).

## Lo que no se tocó

`prisma/schema.prisma` · los endpoints de firma · `colaDeFirmas.js` · `huecosSerie.ts` · ningún texto.

## Apéndice 28-sep-2026 · trozo 1 construido: `GET /admin/albaranes/serie` (S1, s1-28b)

Medido contra `origin/main` `a59dc1e6` (28-sep-2026 14:57Z). Decisión y firma: comentario 17342 de Jira. Se construye **solo la vista previa**; los huecos no.

- `siguienteNumeroDeAlbaran(db, merchantId, now)` en `albaranSerie.ts`. El año sale de `diaNaturalEn(now, zonaDelMerchant(m))`, las mismas dos funciones que `allocateAlbaranNumber`. Solo lee: no toma el cerrojo ni avanza el contador.
- Contrato para S2: `200 { siguiente: "AB260005" }` · `409 { error: "serie_sin_anio" }` (`AlbaranSerieSinAnioError`, sin texto) · `404` si el merchant no existe · `500`. Admin y técnico (`TECNICO_ALLOWED`, mismo criterio que el alta).
- **Un solo PR con la pantalla de S2** (trozo 3): con la ruta sola, el trinquete de SCRUM-1185 cae en `build + tests`.
- Censos: `vistaPreviaAlbaran` pasa a `retiradas`; `huecosDeAlbaranes` se queda declarada con su motivo y su condición de reapertura (bases renumeradas). SCRUM-411: el tope de módulos inalcanzables baja de 7 a 5, porque `albaranSerie.ts` y `huecosSerie.ts` pasan a estar vivos. Sus exports sin llamador de fuera se declaran, y salen las cuatro declaraciones que ahora sí se consumen (`CORTE_FORMATO_F` y tres de `albaranNumber.service.ts`).
- Test `tests/scrum1184-serie-siguiente-numero.test.mjs`: incluye el caso de Nochevieja (en Madrid, 23:30Z del 31-dic ya es el año siguiente → `AB270001`), el 409, que la ruta vaya antes de la ficha de un albarán suelto, y que la ruta no escriba nada. 5/5 en rojo contra el `dist` anterior; verde después.

## Apéndice 28-sep-2026 · trozo 3 construido: la vista previa en «Nuevo albarán» (S2, s2-28b)

**Medido contra:** `origin/main` = `00eef8c5e641fb418d8a25e9e172f90b328bd04c` · 2026-09-28T15:06:30Z (sobre la rama de S1, `26ddf3ed`).

- **Un solo sitio**: `openAlbCrearSheet` (`jobDetailView.js`). Todas las altas acaban en esa hoja; el «Nuevo albarán» de la pestaña Albaranes (`albaranDesdePresupuestoModal.js`) solo elige el presupuesto y navega hasta el Trabajo con `altaAlbaran`.
- Bajo la cabecera, un `<p class="alb-siguiente-numero">` oculto que se rellena con el texto FIRMADO (c.17342), «Siguiente número: AB260005.», con el número de la respuesta. **Falla cerrado**: 409 `serie_sin_anio`, error, red o respuesta sin `siguiente` string → no se pinta nada. La hoja no espera a la petición: el alta funciona igual si la ruta falla.
- `styles.css`: `.alb-siguiente-numero` con los tokens de las ayudas (`--muted`, 13 px, cifras tabulares). Sin componente ni token nuevo.
- Test `tests/scrum1184-vista-previa-en-el-alta.test.mjs`, que mide el viaje: el número lo da `siguienteNumeroDeAlbaran` (de `dist`) sobre un contador de prueba → ficha del Trabajo → «+ Nuevo albarán» → la hoja dice exactamente ese número. En rojo: sin pedir la ruta caen 3; pintando sin comprobar la respuesta cae 1.
- Vecinos (132 ficheros: `jobDetailView`, `styles.css`, la serie, 411 y 1185): 1211 pasan, 0 fallan (3 saltos declarados). El rojo esperado del trinquete 1185 («ruta · GET /admin/albaranes/serie») **desaparece**: la ruta ya tiene consumidor.
- yaqu.app: NO VERIFICADO (la lectura de producción está bloqueada por un permiso en esta sesión, 28-sep).

## SCRUM-1184b (7-oct-2026) · el segundo módulo, decidido; y la vista previa, vista en yaqu.app

**Medido contra:** `origin/main` = `5f1bb361ae5b6b0d720b28b54c624f5d8483ff3b` · 2026-10-07T15:12:40Z
A9: aviso → cicatriz S1 «El dueño de un fichero se le pregunta a `node scripts/carriles.mjs de <ruta>`: deducido por el parecido con lo de otro puesto, salió mal dos veces en el mismo ticket.» — no se pudo comprobar: fue una frase en un comentario de Jira y ningún guard los lee

Carril S1 · sesión `s1-7octt` · rama `scrum-1184b-ventana-de-firma-declarada`. No toca `src/`, ni el
esquema, ni ningún texto: una declaración en el censo, una sonda con su salida y este registro.

### Qué le faltaba al ticket (triaje de la S0, comentario 18594)

1. `ventanaDeFirma.ts` seguía sin importador **y sin motivo ni decisión** en el censo.
2. La vista previa del número estaba sin ver en yaqu.app.

### 1 · `ventanaDeFirma.ts`: ni se conecta hoy ni se retira

La aceptación pide, por módulo, «o se enchufa, o se declara retirado». Ninguna de las dos vale aquí,
y se dice por qué:

- **No se retira.** No es una pieza olvidada: el fundador decidió el 11-ago-2026 que se construye
  («se guardan los tres, y no se elige entre ellos», `docs/master/SCRUM-359.md`). Borrarla sería
  deshacer una decisión suya.
- **No se puede conectar hoy.** Le faltan, en este orden: ① el ALTER de
  `docs/sql/scrum-359-ventana-de-firma.sql` en las tres bases (tres columnas de `albaranes`; medido
  hoy: ninguna está en `prisma/schema.prisma`, el `.sql` está en `main` desde el 27-sep y nadie lo ha
  aplicado), ② el GO del fundador para añadir una escritura a los endpoints que sellan la firma
  (`SCRUM-359.md` §5) y ③ que `encoladaEn` viaje desde el móvil (pantalla).

Así que queda **declarada sin enchufar, con su motivo y su condición de reapertura**, igual que se
hizo con `huecosDeAlbaranes` (comentario 17342): las dos entradas de
`scripts/_sin-consumir-declarados.json` (`contrastarReloj`, `cruzaDias`) llevaban ticket y carril y
ningún motivo; ahora lo llevan. **Se reabre el día que el ALTER esté aplicado en las tres bases.**

`tests/scrum1185-trinquete-sin-consumir.test.mjs`: 11 de 11 antes y después. Ese test no exige el
motivo en una pieza declarada (sólo en las retiradas); el motivo es para quien lea el censo.

### 2 · La vista previa, vista en yaqu.app

Sonda de sólo lectura: `docs/master/evidencias/SCRUM-1184/vista-previa-en-pantalla.mjs`, y su salida
al lado (`vista-previa-en-pantalla.salida.json`). Cuenta de QA, build `5f1bb361`, Trabajo 76 (el
único de la cuenta), 390×844. Corta toda petición que no sea GET y lo comprueba antes de pulsar; abre
la hoja «Nuevo albarán» y no pulsa nada dentro.

| pasada | qué se mide | resultado |
|---|---|---|
| A · tal cual | la ruta `GET /admin/albaranes/serie` | 200, `{"siguiente":"AB260002"}` |
| A · tal cual | la línea de la hoja | visible, «Siguiente número: AB260002.» |
| B · la ruta cortada (control) | la línea de la hoja | oculta, sin texto: falla cerrado |

La pasada B es el control: prueba que el texto sale de la ruta y que la sonda sabe ver «no pintado».

**Error propio en la sonda.** La primera versión contaba cualquier petición cortada desde el
arranque y dio rojo con las dos hojas bien pintadas: el panel manda un `POST /admin/entorno` en cada
carga, y eso no es la hoja escribiendo. Ahora el recuento se toma justo antes de pulsar y ese POST
se nombra y se aparta; cualquier otra escritura tras pulsar sigue fallando.

### Lo que NO está hecho

- El ALTER de SCRUM-359, su GO y el viaje de `encoladaEn`: no son de este ticket (arriba).
- El tercer camino que sella una firma (`partes.routes.ts`, el parte) sigue fuera de la decisión del
  11-ago: si la ventana debe valer también para el parte, es una decisión nueva.
- La sonda mira un solo Trabajo, que es el único que tiene la cuenta de QA.
