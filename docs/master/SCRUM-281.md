# SCRUM-281 · BLOQUE F · Landing — el gancho legal, la tabla comparativa y los gremios

## Tramo S4 · 29-oct-2026 · la tanda de literales, PREPARADA PARA FIRMAR (sin tocar `public/`)

**Medido contra:** `origin/main` = `8dcf269130bab35d42a9fa4ba3d026d0efb98152` · 2026-10-29T18:43:47Z

La medida se hizo sobre `b5190eedcf6165f477b23a942e3720253657aa9e` (18:30Z, cabecera `Date:` de
`api.github.com/zen`); entre los dos hay 9 commits y ninguno toca los ficheros citados aquí
(`git diff --stat b5190eedc 8dcf26913 -- <los citados>`: vacío). Producción: `curl https://yaqu.app/`
a las 18:3xZ.

**Skill UI:** no cargada · no se toca ninguna pantalla: ni un carácter en `public/`. Este tramo sólo
cita `public/index.html` para decir qué hay hoy.

A9: sin fallo que generalice — sólo medir y proponer texto; no hay código ni guard nuevo.

**Qué es y qué NO es este tramo.** La landing es microcopy de principio a fin (regla 30, y el propio
ticket). Este tramo **no escribe la landing**: mide lo que hay, dice qué afirma cada frase, y deja
una tabla de literales **propuestos** para que el fundador firme, reescriba o tache cada uno. **Ningún
literal de aquí está aprobado.** Ningún literal de aquí se puede copiar a `public/` sin su firma con
localizador.

### 1 · Lo que hay HOY en la landing (lo que ve el visitante)

| Pieza | Dónde | Estado hoy | Fuente |
|---|---|---|---|
| Gancho legal «Preparado para VERI\*FACTU…» | — | **NO existe** en ningún HTML público, ni visible ni oculto | grep `verifactu\|hacienda\|aeat\|antifraude\|homolog\|rrsif\|obligatori` sobre `index.html`, `precios.html`, `privacidad.html`, `terminos.html`: 0. Control positivo: la misma búsqueda casa en `public/dashboard/index.html:154` y `public/dashboard/js/api.js:23` |
| Tabla comparativa (F5, SCRUM-332) | `public/index.html:683-726` | **Construida y OCULTA** (`hidden` + `data-propuesta="microcopy-sin-aprobar"`). Compara contra «tu método actual», sin nombrar competidores (`:678-681`, art. 5 LCD) | |
| Tarjetas por gremio (F6, SCRUM-333) | `public/index.html:634-646` | **Construidas y OCULTAS** (`hidden` + `data-microcopy="PENDIENTE_FUNDADOR"`). 6 gremios, todas a `/register.html` | |
| Lo que SÍ se ve: «Seis herramientas» | `public/index.html:648-660` | visible, por herramienta (no por gremio) | |

**Cero claims fiscales visibles.** Ninguna frase pública afirma nada sobre VeriFactu, Hacienda o la
AEAT. Las dos promesas visibles que no se pueden sostener hoy **no son fiscales**:

| Visible | Literal | Por qué no se sostiene | ¿Ya registrado? |
|---|---|---|---|
| `public/index.html:653` | «Tarjeta, Bizum o transferencia. Cobra trabajos completos o por adelantado, con recordatorios que persiguen solos.» | regla 24: con `INVOICING_ES_ENABLED` en OFF no hay cobro por YaQu, ni recordatorios de pago | **SÍ**: `docs/go-live/puerta.json:114`, SCRUM-1554 fila 11, `docs/equipo/para-javier.md:344` (va a la puerta de go-live a propósito, regla 43) |
| `public/index.html:652` | «…y fírmalos por WhatsApp con validez legal.» | afirmación JURÍDICA sin dictamen detrás. El propio repo veta esa frase en el documento de evidencia de la firma: `tests/scrum438-atestiguar.test.mjs:247` | **NO** en `puerta.json` ni en SCRUM-1554 (git grep: 0). Sólo `docs/master/SCRUM-328.md:452` (fila 18), que la trajo «sin clasificar». Avisado al orquestador el 29-oct 18:3xZ |

Servidas en producción: `curl https://yaqu.app/` da 1 «Tarjeta, Bizum o transferencia» y 1
«validez legal» (control: «Seis herramientas» = 1). Es carril J3 (la landing): aquí no se toca.

### 2 · Lo que ya está decidido, y lo que choca entre sí

1. **El gancho del ticket (4-ago)** es «Preparado para VERI\*FACTU. Se activa con un interruptor en
   cuanto Hacienda te lo exija.» **Choca con la excepción posterior (7-ago, SCRUM-328 A4.1)**, que
   prohíbe en su punto (a) «cualquier afirmación sobre el estado de YaQu ante esa norma —construido,
   en certificación, certificado, conforme, homologado, adaptado, cumple…»
   (`docs/master/SCRUM-328.md:257-259`). «Preparado para» es una afirmación de estado de YaQu.
2. **La excepción A4.1 está SIN APLICAR al máster** (`docs/equipo/puesto-j3.md:87-89`: «Hasta que se
   aplique, manda la prohibición»). La regla vigente es la del máster: **en la landing no se nombra
   VeriFactu**, salvo con el guion H2. Y el guion H2 tampoco vale hoy en la landing
   (`SCRUM-328.md:287-308`: es el texto que SCRUM-400 retiró).
3. **El guard de conformidad deja pasar el gancho del ticket.** Ejecutado, no razonado
   (`afirmacionesDeConformidad()` de `scripts/_guard-conformidad-landing.mjs`, 29-oct):

   | Frase | Guard |
   |---|---|
   | CONTROL + · el texto que retiró SCRUM-400 («Te contesto como fabricante… en certificación… declaración responsable…») | **CAE** |
   | CONTROL + · «Cuando VeriFactu sea obligatorio en 2027, con YaQu ya cumples.» | **CAE** |
   | «Preparado para VERI\*FACTU. Se activa con un interruptor en cuanto Hacienda te lo exija.» | pasa |
   | «Preparado para VeriFactu, y sin más papeleo.» (`puesto-j3.md:87`) | pasa |
   | L2 de la tabla de abajo (la fecha del lector) | pasa |
   | L3 de la tabla de abajo (C3 del máster) | pasa |

   Los dos controles caen: el verde no es «no supe mirar». **Pero «preparado» no está en su lista**, y
   A4.1(a) sí lo prohíbe. Un guard verde no es una aprobación (`SCRUM-328.md:191`). **No se toca el
   guard aquí**: es un hallazgo para quien lleve el guard.
4. **El máster avisa contra apostar por la fecha:** «ya hubo UN aplazamiento → no apostar todo el GTM
   a la fecha» (`docs/YAQU_MASTER.md:1882`). Y desde el 29-jul-2025 «solo se puede comercializar
   software de facturación totalmente adaptado al RRSIF» (`:69`): anunciarse como software de
   facturación antes de SIF-1 es justo lo que no podemos sostener.
5. **F5 (comparativa) no se publica ni se pide firma todavía**: bloqueada por F1 (SCRUM-328) sin
   cerrar, por decisión del orquestador del 22-sep (comentario de SCRUM-281). Esta tabla la deja
   preparada; el orden lo decide el orquestador.

### 3 · LA TABLA — literales propuestos para firmar

Columnas: **dónde** iría · **literal propuesto** · **qué afirma** · **qué lo sostiene hoy** · **riesgo**.
«Hoy» = `INVOICING_ES_ENABLED` en OFF, SIF-1 sin cerrar, sin Stripe Connect en ningún merchant.

#### 3.1 · Gancho legal (F1 / la parte legal de 281)

| # | Dónde | Literal propuesto | Qué afirma | Qué lo sostiene | Riesgo |
|---|---|---|---|---|---|
| L0 | — | **No poner gancho legal hasta SIF-1 8/8.** El gancho nº 1 sigue siendo el cobro y la firma | nada | reglas 17/24/26; A4.1 sin aplicar | ninguno. **Recomendada** |
| L1 | — | ~~«Preparado para VERI\*FACTU. Se activa con un interruptor en cuanto Hacienda te lo exija.»~~ (el del ticket) | que YaQu está preparado ante la norma, y que el profesional tiene un interruptor | **nada**: SIF-1 abierto; `INVOICING_ES_ENABLED` es un flag de la plataforma, no un interruptor del profesional | prohibido por A4.1(a); el guard no lo caza. **No proponible** |
| L2 | banda bajo el héroe, sólo si el fundador APLICA A4.1 | «VeriFactu será obligatorio para las sociedades el 1 de enero de 2027 y para los autónomos el 1 de julio de 2027.» | sólo la obligación del LECTOR y su fecha. Nada de YaQu | `docs/YAQU_MASTER.md:68` y `:1882` (RD-ley 15/2025) | la fecha ya se aplazó una vez (`:1882`): habría que retirarla si cambia |
| L3 | junto a L2, sólo si el fundador aplica A4.1 | «¿Te aviso cuando lo de Hacienda sea obligatorio?» (C3 de H6, literal del máster) | que le avisaremos | es un guion HABLADO: pasarlo a la web es cambio de superficie (`SCRUM-328.md:170-171`). **Sin medir** si hay hoy algún mecanismo de aviso que lo cumpla | prometer un aviso que quizá no existe. Medirlo antes de firmar |

#### 3.2 · Tabla comparativa (F5, SCRUM-332 · ya construida en `public/index.html:683-726`)

Cabecera hoy: «Tu libreta no firma, no cobra y no avisa.» (`:685`). **«no cobra» implica que YaQu sí
cobra**: con OFF, eso no se sostiene (regla 24).

| # | Fila (`data-fila`) | «Con YaQu» de hoy | ¿Se sostiene hoy? | Literal propuesto |
|---|---|---|---|---|
| C0 | cabecera `:685` | «Tu libreta no firma, no cobra y no avisa.» | **NO** (cobro) | «Tu libreta no firma y no avisa.» |
| C1 | `firma` `:692` | «Lo aceptó con su firma y su fecha, y la firma queda dentro del PDF.» | sí: firma del presupuesto (`SCRUM-328.md:507`) | sin cambio |
| C2 | `cobro-pendiente` `:696-698` | «La factura lleva tres semanas sin pagarse…» / «El recordatorio sale solo.» | **NO**: es el recordatorio de pago de FACTURA (`invoiceReminder.service.ts`, cron `src/core/cron/cron.ts:78`), que la regla 24 apaga con OFF | **quitar la fila** hasta SIF-1 + Connect |
| C3 | `presupuesto-sin-respuesta` `:704` | «Se le recuerda solo, y el presupuesto caduca cuando toca.» | **en código, sí**: `src/modules/quotes/domain/reminder.service.ts` (24 h tras el envío) y `expire.service.ts` (cron `:63`, `:68`). **No visto en producción** | sin cambio, tras verlo en yaqu.app |
| C4 | `historial-cliente` `:710` | «Cada movimiento queda en su ficha, con su fecha.» | sí: ficha de cliente | sin cambio |
| C5 | `margen-mes` `:716` | «Lo que entró menos lo que salió, mes a mes.» | **dudoso**: «lo que entró» sale de cobros que con OFF no se registran por YaQu | «Lo que presupuestaste y lo que gastaste, mes a mes.» — **sin medir** que la pantalla de informes lo dé así: medirlo antes de firmar |
| C6 | `catalogo-precios` `:722` | «Salen de tu catálogo según escribes.» | sí: productos y catálogo | sin cambio |

#### 3.3 · Gremios (F6, SCRUM-333 · ya construidos en `public/index.html:634-646`)

Cinco de las seis tarjetas **prometen el cobro** (regla 24, con OFF: ni señal ni cobro por YaQu).

| # | Gremio (`:línea`) | Frase que no se sostiene hoy | Literal propuesto |
|---|---|---|---|
| G1 | Fontanería `:638` | «…y cobras al terminar —» | «Presupuestas un desatasco desde la furgoneta y el cliente firma en su móvil — sin volver a casa a hacer papeles.» |
| G2 | Electricidad `:639` | «…y no se quedan sin cobrar.» | «Cambias un cuadro y aparecen dos puntos de luz más. Añades las líneas en la misma escalera y el cliente las acepta en el momento.» |
| G3 | Reformas `:640` | «Una obra de tres semanas y cuatro pagos. Cobras por tramos…» | «Una obra de tres semanas. Cada parte firmado queda con su fecha, y el cliente sabe en todo momento qué ha aceptado.» |
| G4 | Climatización `:641` | «…la revisión del año que viene queda anotada sola.» | **en código, sí** (`runMaintenanceProposals`, cron `:89`); no visto en producción. Sin cambio, tras verlo |
| G5 | Cerrajería `:642` | «…y cobras antes de recoger la herramienta.» | «Una apertura a las dos de la mañana. Presupuestas en el portal y el cliente firma en su móvil antes de que abras.» |
| G6 | Pintura `:643` | «La señal entra antes de que compres la pintura.» | «Mides el piso y mandas el presupuesto antes de bajar la escalera. Firmado, ya puedes comprar la pintura.» |

⚠️ G3 dice «el cliente sabe en todo momento qué ha aceptado»: **sin medir** que el cliente tenga
dónde mirarlo después de firmar. Si no, quitar la segunda mitad.

### 4 · Lo que necesita el fundador (para la tanda)

1. **¿L0 (sin gancho legal hasta SIF-1) o aplicas A4.1 y firmas L2 (+ L3 con un formulario)?** El
   gancho del ticket (L1) no se puede publicar bajo ninguna de las dos.
2. **Firma, reescribe o tacha** C0, C2 (quitar la fila), C5 y G1-G6, cada uno por su número.
3. **«con validez legal»** (`public/index.html:652`, visible hoy): no es de 281, va al orquestador
   para la puerta de go-live.

**Lo que NO se ha hecho:** ver en producción C3 y G4 (sólo código), y medir C5 contra la pantalla de
informes. Ninguno de los tres se firma sin eso.
