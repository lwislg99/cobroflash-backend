# SCRUM-1551 · Lo que `/legal/alcance-beta` promete HOY, y cómo decirlo sin prometerlo

**Medido contra:** `origin/main` = `c30729832c18b65c3793917ca836868e6cfdaa6e` · 2026-10-14T03:57:00Z

A9: aviso → cicatriz J4 «mi sonda de la versión del documento dio el mismo hash para dos textos distintos: cambiaba de carpeta DESPUÉS de cargar el módulo, y la carpeta de los documentos se fija AL cargarlo» — no se pudo comprobar: la sonda es de un solo uso y vive fuera del repo; lo cazó que dos textos distintos no pueden dar la misma huella

14-oct-2026 · **J4** (sesión `jv-j4d`, equipo de Javier), por encargo del orquestador (`cobroflash-backend-2e`).
[Escrito por J4. El encargo se leyó en Jira: SCRUM-1551 entero, descripción y c.19537.]

**Carril a mano.** El hook de arranque dijo «SIN IDENTIDAD»; medido por el orquestador, es SCRUM-1549, y
se construye con su orden. Etiquetas leídas en el ticket: `area-j4`, `equipo-javier`, `decision-jefe`,
`fundador`, `legal`, `microcopy`, `sin-firma`, `verifactu`. Ninguna de equipo-luis, `area-s*` ni `esperando-*`.

**Es una medición y una PROPUESTA. No se aplica nada.** No se toca `docs/legal/`, ni `src/`, ni `public/`,
ni el esquema, ni ningún guard o workflow. No se ha tocado ninguna base. No se ha pedido ni usado ninguna
credencial. Lo único que entra es este registro y una línea en `docs/equipo/cicatrices/J4.md`.

---

## ① Barrido en el presente

### Qué se sirve, por la RUTA

| comprobación | resultado |
|---|---|
| quién lee `docs/legal/` en `src/` | sólo `readLegalDoc` (`src/modules/system/app/routes/legalPages.routes.ts:46`) |
| con qué fichero se llama `readLegalDoc` | `ALCANCE_BETA.md`, en sus tres llamadas: `legalPages.routes.ts:98` y `subscriptions.routes.ts:48` y `:82` |
| rutas que monta ese router | una: `GET /legal/alcance-beta` (`legalPages.routes.ts:97`), montada en `app.ts:369` |
| `docs/` servido de otra forma | no: el estático es `public/` (`app.ts:262`) y `/outbox` fuera de producción (`app.ts:187`) |
| `GET https://yaqu.app/legal/alcance-beta`, hoy 03:54Z | HTTP 200, 4.298 bytes |

**Población:** 20 ficheros versionados en `docs/legal/` (19 `.md` y `fuentes/aeat-errores.properties`).
**Se sirve UNO: `ALCANCE_BETA.md`.** El ticket habla de «dos documentos servidos»: medido hoy, por la ruta,
hay uno. Las dos frases están en ese mismo documento.

### Dónde está el documento a la vista de un comercio (no sólo de quien tenga el enlace)

- `public/dashboard/js/plansView.js:232`: el modal de alta founding lo enseña en un `iframe`, y
  `:235` lo enlaza en otra pestaña. El botón «Aceptar y continuar al pago» exige marcar
  «He leído y acepto el alcance de la beta» (`:239-243`).
- `plansView.js:40`: la oferta founding se enseña según las plazas y el plan. **El modo de emisión no
  cuenta.** Un comercio español con `INVOICING_ES_ENABLED` en OFF (`receipt`) llega a ese modal.
- La ruta es pública (`publicAccessDeclarations.ts:91`): la abre cualquiera, sin sesión.

Esto contesta uno de los «no medidos» de SCRUM-534 («si la página está enlazada desde algún sitio»).

### Producción sirve el fichero de `main`: re-comprobado hoy, no copiado

El orquestador pidió no apoyarse en el `4deaa1a6d479` de `SCRUM-534.md:1343`, que se midió el 14-oct a las
02:10Z. Medido otra vez a las 03:54Z, y **con el `readLegalDoc` real** transpilado (no con una réplica):

| qué | versión |
|---|---|
| la que imprime `yaqu.app/legal/alcance-beta` en su pie | `4deaa1a6d479` |
| `readLegalDoc` sobre el fichero de `main` (`c30729832`) | `4deaa1a6d479` |
| el cuerpo HTML servido frente al que genera `main` | **idéntico**, 2.558 de 2.558 caracteres |

### Las líneas que empiezan por `>` NO se sirven: sigue siendo así

`legalPages.routes.ts:27`: `if (/^\s*>/.test(line)) continue;`. Medido sobre la página servida hoy:

| texto | en el fichero | en la página servida |
|---|---|---|
| «BORRADOR para revisión del asesor» (L3) | sí | **no** |
| «NO usar con clientes hasta el visto bueno del asesor» (L5-6) | sí | **no** |
| «[REVISAR ASESOR: …]» (L32, L40, L46) | sí | **sí** |
| «[Nombre/Razón social del titular de YaQu]», «[NIF]», «[fecha]» (L13-14) | sí | **sí** |

**En qué documentos pasa:** sólo puede pasar en un documento servido, y se sirve uno. Las 5 líneas `>` de
`ALCANCE_BETA.md` (L3-L7) son la cabecera entera de «borrador». Lo que ve el comercio es un contrato con
las partes en blanco y tres «[REVISAR ASESOR]» a la vista, **sin el aviso de que es un borrador**, y con
una casilla para aceptarlo antes de pagar. (Los otros seis documentos con las frases tienen líneas `>`,
pero no se sirven, así que ahí no hay nada que se oculte.)

### Dónde aparece cada frase: población entera de `docs/legal/`

Patrón `cobro integrado|justificantes? de cobro`, sin distinguir mayúsculas, sobre los 19 `.md`. Control
positivo: casa en `ALCANCE_BETA.md` L21, L22 y L30. El documento servido, además, **se leyó entero**
(53 líneas), porque una frase partida entre dos líneas el patrón no la ve.

| fichero | se sirve | «cobro integrado» | «justificante(s) de cobro» | líneas |
|---|---|---|---|---|
| `ALCANCE_BETA.md` | **SÍ** | 1 | 2 | L21, L22, L30 |
| `EMAIL_ASESOR.md` | no | 0 | 1 | L21 |
| `ENVIO_ASESOR_2026-09-28.md` | no | 0 | 1 | L116 |
| `INVENTARIO_AFIRMACIONES_VERIFACTU.md` | no | 0 | 1 | L427 |
| `LITERALES_COBRO_WEB_PENDIENTES.md` | no | 1 | 0 | L50 |
| `PREGUNTAS_ASESOR.md` | no | 0 | 2 | L419, L637 |
| `PREGUNTAS_ASESOR_POR_ESPECIALISTA.md` | no | 0 | 3 | L40, L157, L158 |
| los otros 12 `.md` | no | 0 | 0 | — |

Los seis que no se sirven son papeles para el asesor o inventarios: citan la frase para hablar de ella,
o describen el justificante como algo que existió. Que alguno haya salido del repo (por correo, en una
demo) **no se puede saber desde aquí**, y no se deduce de no haberlo visto.

**De paso, y fuera de `docs/legal/`** (no es la población pedida; se nombra para que no se pierda):
`public/terminos.html:48` dice, en presente, que YaQu permite «emitir facturas y gestionar cobros».
Es un texto legal servido en `/terminos`. No se ha leído entero ni se propone nada sobre él aquí.

---

## ② Qué es claim prohibido, por unidad visible

La vara es la regla 24, literal (`YAQU_MASTER.md`, Parte I): «Con el interruptor en OFF, YaQu no emite
ningún documento para ese merchant —ni factura, ni justificante, ni ningún otro documento de cobro— y no
cobra por YaQu a sus clientes: ni enlace de pago, ni señal al aceptar el presupuesto, ni recordatorios de
pago […]. Presupuestos, firma, albaranes y partes siguen igual. El profesional cobra por fuera de YaQu
hasta que exista la factura.» Y la 18: tarjeta y Bizum/transferencia, «en España, … solo en un merchant
con `INVOICING_ES_ENABLED` en ON».

Lo que ve el comercio, unidad por unidad (texto servido, no el fichero):

| # | unidad visible (servida) | frase | veredicto |
|---|---|---|---|
| A | §1 «Qué incluye HOY tu suscripción Founding», viñeta 3 (L21) | «**Cobro integrado**: tu cliente paga desde el móvil; recordatorios automáticos de cobro.» | 🔴 **PROHIBIDO.** Bajo un título que dice HOY. Promete justo dos cosas que la regla 24 nombra: enlace de pago y recordatorios. Nada en la unidad lo condiciona. |
| B | §1, viñeta 4 (L22) | «**Justificantes de cobro** por cada pago recibido (documento no fiscal).» | 🔴 **PROHIBIDO, y además FALSO hoy.** La regla 24 nombra el justificante. Y el código ya no lo emite: con `receipt`, `invoiceNumber.service.ts:448` lanza `invoicing_es_disabled`, y el generador `J-` lo retiró SCRUM-825 (comentario 17446, D1). «(documento no fiscal)» no lo salva: la regla prohíbe «ningún otro documento de cobro». |
| C | §2 «Qué NO incluye todavía», viñeta 1 (L29-30) | «Hasta ese momento YaQu emite justificantes de cobro (no facturas fiscales)» | 🔴 **PROHIBIDO y FALSO**, por lo mismo que B. Que vaya bajo «Qué NO incluye» no lo arregla: la frase dice en presente lo que SÍ se hace mientras tanto. |
| D | §2, viñeta 2 (L33-34) | «El cobro con **tarjeta** se activará al completar el alta de cobros (Stripe); mientras tanto, Bizum y transferencia.» | 🔴 **PROHIBIDO en su segunda mitad.** «Mientras tanto, Bizum y transferencia» presenta un cobro por YaQu que existe hoy. Con OFF no hay ninguno (reglas 18 y 24). La primera mitad es cierta como condición (regla 18), pero se queda corta: también hace falta el interruptor. |
| E | §1, viñeta 5 (L23-24) | «…soporte por email y WhatsApp.» | 🟠 **No es de la regla 24, pero es falso.** SCRUM-406 midió que ese WhatsApp de soporte no existe, y lo retiró de `plansView.js` (`:113-115`, hoy «Soporte por email»). Aquí sigue. Y su guard (`tests/scrum406-canal-prometido-existe.test.mjs`) no lo ve: busca en `public/` y la página servida sale de `docs/legal/`, que queda fuera de su población. Lo que se sirve desde `docs/legal/` no lo mira ningún guard de «lo prometido existe». |
| F | §2, viñeta 1 (L28-29) | «facturación con sistema VERI*FACTU se activará al cerrar la certificación» | ⚪ **No es de este ticket.** Es P1/P2 de SCRUM-534, firmada (c.19531), y la aplica `jv-j4c` en `scrum-534q-aplica-las-siete`. Se nombra porque comparte unidad con C. |

**Lo que hace grave A y B** es el contraste dentro de la MISMA pantalla. SCRUM-1029 ya ocultó en
`plansView.js:102-116`, para `receipt`, la fila «Cobro integrado: el cliente paga desde el móvil» de la
lista del plan. Y en ese mismo modal, el `iframe` sigue enseñando «**Cobro integrado**: tu cliente paga
desde el móvil» al comercio al que se le escondió. Es más: se le pide que marque que lo ha leído y lo
acepta antes de pagar.

**Lo que no se ha medido:** si un comercio de fuera de España ve este documento. Para él, A y D podrían
ser ciertas: el interruptor no gobierna fuera de España, y la regla 24 habla de «merchants ES». La
unidad visible no dice país. La propuesta de abajo está escrita para España, que es España-first.

---

## ③ Las aceptaciones

Lo midió el fundador en producción (c.19537): 4 filas en `legal_acceptances`, todas del comercio 6, con
`doc_key` `alcance-beta`, `team_member_id` nulo y versión `48e3140b2083`, el 6-jul-2026 entre las 14:07 y
las 14:16.

**Medido hoy, y es nuevo:** `48e3140b2083` **sí sale del repo** si se calcula. No está escrito en
ninguna parte, pero es la huella que da `readLegalDoc` sobre el fichero del commit `328c18838` (5-jul,
«A10.1: contratación founding con aceptación del ALCANCE BETA»). La historia entera del fichero y del router:

| commit | fecha | qué cambia | versión servida |
|---|---|---|---|
| `54bef6705` | 13-jun | nace el borrador | — (la ruta aún no existía) |
| `328c18838` | 5-jul | nacen la ruta y la aceptación | **`48e3140b2083`** ← las 4 filas |
| `e52a4a445` | 8-jul | precio: «**14,50 €/mes** … (50 % del precio de lista, **29 €/mes**)» → «9,90 €/mes … 19,90 €/mes» | **`4deaa1a6d479`** ← la de hoy |
| `c30729832` (`main`) | 14-oct | — | `4deaa1a6d479` (control: igual que la de arriba) |

(El router `legalPages.routes.ts` no ha cambiado desde `328c18838`. Su función de huella es la misma en
las tres filas.)

Consecuencias:

1. **El freno del ticket no aplica.** Ninguna de las cuatro aceptaciones vale hoy para el checkout: el
   checkout busca la versión servida (`subscriptions.routes.ts:85`), y nadie ha aceptado `4deaa1a6d479`
   *según la consulta del fundador de ~04:00Z*. Cambiar el texto **no invalida ninguna aceptación vigente**.
2. **Lo que aceptó el comercio 6 no es sólo un texto anterior: es otro PRECIO.** Aceptó 14,50 €/mes de por
   vida sobre un precio de lista de 29 €. Si eso tiene valor de consentimiento, la pregunta que abrió
   c.19537 («un comercio aceptó en julio un texto que ya no es el que servimos») tiene un contenido
   concreto. **No es de este ticket**, como ya dijo c.19537. Se deja el dato.
3. **Antes de aplicar, la consulta se repite**, porque puede haber filas nuevas desde las ~04:00Z. Está
   en UNA sola sentencia, con el control dentro (la fila `total_tabla` sale aunque no haya ninguna de
   `alcance-beta`), y es de SÓLO LECTURA:

```sql
SELECT 'total_tabla' AS fila, NULL AS version, count(*) AS n, count(DISTINCT merchant_id) AS comercios, min(created_at) AS primera, max(created_at) AS ultima FROM legal_acceptances UNION ALL SELECT 'alcance-beta', version, count(*), count(DISTINCT merchant_id), min(created_at), max(created_at) FROM legal_acceptances WHERE doc_key = 'alcance-beta' GROUP BY version ORDER BY 1 DESC, 2;
```

   Qué se espera hoy: `total_tabla` = 4, y una fila `alcance-beta | 48e3140b2083 | 4 | 1`. **Si aparece
   `4deaa1a6d479`, alguien ya aceptó el texto de hoy, y cambiarlo SÍ le costaría esa aceptación.** Los
   nombres de columna salen de `prisma/schema.prisma:1299-1311`, que sólo se ha leído.

---

## ④ Propuesta de redacción (SIN APLICAR)

La base es la frase **ya firmada** de V0-6 (`YAQU_MASTER.md:1006`): «presupuestos+firma+**albaranes**;
**el cobro a tus clientes y** la facturación VeriFactu se activa**n** al cerrar la declaración responsable
del fabricante, sin cambio de precio». Y la regla 24, que dice qué sigue igual y que «el profesional cobra
por fuera de YaQu». Ninguna propuesta nombra VeriFactu ni la AEAT: así no hace falta el triple de la
regla 26. La única frase de §2 que los nombra es la de SCRUM-534 P2, y no se toca.

**Se escriben sobre el texto de la rama de `jv-j4c`** (`scrum-534q-aplica-las-siete` @ `c4531733`), que ya
pone P2 en la línea 29 sin mover líneas. Por eso se citan **por contenido**, no sólo por línea.

### R1 · §1, viñeta 3 (L21) — «Cobro integrado» sale de lo que incluye HOY

Hoy:

    - **Cobro integrado**: tu cliente paga desde el móvil; recordatorios automáticos de cobro.

Propuesto:

    - **Albaranes y partes de trabajo** de cada trabajo.

Son palabras de la regla 24 («albaranes y partes siguen igual») y de V0-6 («presupuestos+firma+albaranes»).
El cobro no desaparece del documento: pasa a §2 (R4), que es donde lo pone V0-6. No mueve líneas.

### R2 · §1, viñeta 4 (L22) — el justificante, fuera

Hoy:

    - **Justificantes de cobro** por cada pago recibido (documento no fiscal).

Propuesto: **quitar la línea**. Es el precedente de SCRUM-1029 y SCRUM-406: lo que no existe se retira,
no se reescribe. Mueve una línea hacia arriba todo lo que viene detrás (ver «coste»).

### R3 · §1, viñeta 5 (L23-24) — el soporte que existe

Hoy: «…tus datos siempre exportables; soporte / por email y WhatsApp.»
Propuesto: «…tus datos siempre exportables; soporte / por email.» Es la misma retirada de SCRUM-406
(`plansView.js:113-115`). No mueve líneas.

### R4 · §2, viñeta nueva al principio — el cobro, con su estado real al lado (la que recomiendo)

Propuesto, como primera viñeta de «2. Qué NO incluye todavía»:

    - El **cobro a tus clientes a través de YaQu** (enlace de pago, señal y recordatorios de cobro) se
      activará a la vez que la facturación del punto siguiente, **sin cambio de precio**. Hasta
      entonces YaQu no cobra por ti: cobras a tu cliente por tus medios de siempre.

«Se activará a la vez que la facturación» es V0-6 («el cobro a tus clientes y la facturación … se
activan»). «Cobras a tu cliente por tus medios de siempre» es la regla 24 («cobra por fuera de YaQu»)
dicho con las palabras que la cláusula ya usa más abajo («tu gestoría o tu sistema de siempre»). Y el
estado real («hoy no cobra por ti») va en la misma unidad que la promesa (regla 26). Añade tres líneas.

⚠️ «del punto siguiente» sólo es cierto si R4 va DELANTE de la viñeta de facturación. Si se pone detrás,
la frase es «del punto anterior».

### R5 · §2, viñeta de facturación — la cola de la frase P2 (L29-30 de la rama 534q)

Hoy, en la rama 534q (P2 ya puesto delante):

    …que publicaremos en cuanto el envío esté terminado. Hasta ese momento YaQu emite
      justificantes de cobro (no facturas fiscales); la facturación fiscal de tu actividad

Propuesto:

    …que publicaremos en cuanto el envío esté terminado. Hasta ese momento YaQu no emite
      facturas ni ningún otro documento de cobro; la facturación fiscal de tu actividad

«Ningún otro documento de cobro» es literal de la regla 24. **No toca nada de P2**: empieza en «YaQu»,
después del punto. No mueve líneas.

### R6 · §2, viñeta de tarjeta (L33-34) — sin el «mientras tanto»

Hoy:

    - El cobro con **tarjeta** se activará al completar el alta de cobros (Stripe);
      mientras tanto, Bizum y transferencia.

Propuesto:

    - Cuando el cobro se active, el pago con **tarjeta** necesitará además que completes
      el alta de cobros (Stripe).

Es la regla 18 (tarjeta sólo con Connect activo en ese comercio). Y no hay «mientras tanto» que prometer.
No mueve líneas.

### D1 · Una DECISIÓN, no una redacción: el aviso de borrador que no se ve

Las R1-R6 corrigen lo que el documento dice. No corrigen que la página sea **un borrador que se da a
aceptar sin decir que lo es**: partes en blanco, tres «[REVISAR ASESOR]» a la vista, y la cabecera que
lo advierte, oculta por ser cita. Hay tres salidas, y ninguna es de J4:

- (a) **Que se vea.** Sacar de la cita una línea visible: «Borrador pendiente de revisión legal: estas
  condiciones pueden cambiar antes de que se te cobre.» Es texto de usuario (regla 39) y no arregla las
  partes en blanco.
- (b) **Cerrar la aceptación** hasta el visto bueno del asesor. Es código (`subscriptions.routes.ts` /
  `plansView.js`), así que es de otro carril y del dinero de producción: STOP.
- (c) **Dejarlo como está**, sabiendo lo que se ve.

No recomiendo entre (a) y (b): cambia qué se vende hoy, y eso lo decide el fundador.

### Coste de aplicar

| qué | coste |
|---|---|
| aceptaciones vigentes que se pierden | **0** según la consulta de ~04:00Z: ninguna es de `4deaa1a6d479` (repetir la de ③ antes) |
| versión del documento | cambia. Con la rama 534q sola pasaría a `17275d59e185` (calculado); con R1-R6 encima, a otra. **Se recomienda aplicar todo en UN solo PR**: un único cambio de versión, y el comercio que acepte después lo hace sobre el texto bueno |
| quién cita `ALCANCE_BETA.md` por línea | `INVENTARIO_AFIRMACIONES_VERIFACTU.md` (C9: L28-29, según SCRUM-534) y el comentario de `tests/scrum341-condicion-precio-publicada.test.mjs:4` («ALCANCE_BETA.md:38», la condición del precio; medido hoy). R2 resta una línea y R4 suma tres, así que la L38 pasaría a ser la L40. El test lee el TEXTO de la condición, no la línea; el comentario quedaría desfasado. **Antes de aplicar se re-mide** quién cita qué línea |
| `MICROCOPY_BLOQUEADA` (`tests/scrum302-rotulos-completos.test.mjs`) | medido hoy: **0** apariciones de «cobro integrado», «justificante(s) de cobro», «alcance», «soporte por email y WhatsApp» o «Bizum y transferencia». Ninguna R espera al asesor por esa lista |

### Lo que la propuesta NO arregla

- La negrita rota de «VERI*FACTU» (el asterisco parte el par y salen asteriscos a la vista). Está en la
  frase de P1/P2, que no es de aquí. Ya la dijo SCRUM-534 §6.
- `public/terminos.html:48` («emitir facturas y gestionar cobros»): fuera de `docs/legal/`, sin leer entero.
- Que el texto esté bien como DERECHO. Se mide que cada frase es cierta contra el código y el máster.
  La cláusula entera sigue marcada para el asesor.
- Qué pasa con la aceptación de julio del comercio 6 (③.2).

---

## Lo que NO he medido

- Ninguna base: el ③ es la consulta del fundador y la de arriba, sin ejecutar.
- Si algún documento de `docs/legal/` salió del repo.
- Lo que ve un comercio de fuera de España.
- La pantalla real en un navegador. El recorrido modal → `iframe` sale de leer `plansView.js`, no de
  pulsarlo.
- `npm test`: este árbol no tiene dependencias ni `dist/`. Se corrieron a mano los guards que leen
  ficheros (abajo).

## Un error mío, contado

Para comprobar el `48e3140b2083` escribí una sonda que transpila el `readLegalDoc` real y lo ejecuta sobre
el fichero de cada commit. La primera pasada dio la **misma huella** para el texto de 14,50 € y para el de
9,90 €. La causa: cambiaba de carpeta DESPUÉS de cargar el módulo, y `LEGAL_DIR`
(`legalPages.routes.ts:13`) se fija con `process.cwd()` AL cargarlo. Las dos veces había medido el fichero
de `main`. Lo cazó que dos textos distintos no pueden dar la misma huella; corregida, salieron `48e3140b2083`
y `4deaa1a6d479`. Si los dos commits hubieran tenido el mismo texto, el error habría pasado callado.
Va a mis cicatrices (línea A9 de arriba).

## Aceptación → dónde se ve

| lo pedido | dónde se ve |
|---|---|
| ① barrer en el presente, por la ruta, con población | ① |
| la trampa de `>`, re-comprobada | ①, «Las líneas que empiezan por `>`» |
| ② claim prohibido o no, con contexto visible | ② |
| ③ aceptaciones, y re-comprobar `4deaa1a6d479` | ③ (más el origen de `48e3140b2083`, que es nuevo) |
| ④ proponer redacción con estado real y coste | ④, R1-R6, D1 y «Coste de aplicar» |
| aplicar | **NO HECHO, por mandato**: espera la firma del fundador sobre R1-R6 y su decisión sobre D1 |
