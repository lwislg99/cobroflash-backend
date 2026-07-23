# SUITE DE REGRESIÓN E2E — v1.8 (SCRUM-38 · fixes SCRUM-42/36 · albaranes SCRUM-14 · alineación UI real SCRUM-43/44 · seguridad PDF SCRUM-48 · autoría operario SCRUM-22 · albarán-WA SCRUM-47 · albarán valorado + PDF legal SCRUM-65/67 · runbook de ejecución SCRUM-79 · `.env` del carril B SCRUM-55/60 · cómo se escribe una verificación SCRUM-103)

> Guion que Claude Code ejecuta con el **Playwright MCP** contra **STAGING** tras cada
> merge+deploy. Cubre la regresión de PAGOS-FLEX (SCRUM-27/32/34) y los CTAs de invoice
> (SCRUM-35). Los hallazgos se REPORTAN (regla 9), no se arreglan sobre la marcha.
> Prerequisito: seed corrido (`scripts/seed-staging.mjs`) y las 3 env vars `E2E_*` en staging.

## Runbook de ejecución de los tests gateados (SCRUM-79)

Cinco trampas que ya nos han costado tiempo. Las tres primeras y la quinta fallan **en
silencio**: el test pasa o el número parece plausible, y nadie lo cuestiona. La cuarta no
falla — te hace perder el rato creyendo que tu entorno está roto.

1. **Reconstruye antes de aislar un test.** Los tests importan de `dist/`, que **no está
   en git y NO cambia al cambiar de rama**. Si compilas en una rama y luego te vas a otra,
   `node --test <fichero>` leerá el `dist` de la rama anterior. Pasó de verdad: una medición
   de A12.4 reportó 28 rutas admin-only cuando en esa rama eran 22 — el `dist` traía las 6
   rutas de otra rama sin mergear.
   → Usa **`npm run test:staging`** (compila primero) o, si aíslas a mano,
   **`npm run build && node --test <fichero>`**. Nunca `node --test` a secas tras un
   `git checkout`.

2. **Corre siempre con `--test-force-exit`.** Sin él, un fichero que falla puede dejar el
   proceso colgado indefinidamente (nos comió >400 s creyendo que era la BD lenta, cuando
   era un test que reventaba en 940 ms y no cerraba). `npm test` y `npm run test:staging`
   ya lo llevan.

3. **Limpia staging antes de una tanda.** Cuando un test gateado falla a medias, su `finally`
   no llega a correr y deja el merchant efímero huérfano. Llegamos a **26 de 28 merchants**
   siendo basura de test.
   → `node scripts/clean-staging-tests.mjs` (**dry-run**, solo lista) y luego
   `node scripts/clean-staging-tests.mjs --apply`. Tiene doble guard anti-producción y solo
   toca emails `@test.local`.

4. **El `.env` del carril B lleva SOLO `DATABASE_URL_STAGING`, a propósito. NO está
   incompleto.** Se creó así en SCRUM-60: **sin `DATABASE_URL`**, para que desde el portátil
   del carril B sea imposible tocar producción ni queriendo — el mismo fail-closed que
   `tests/_staging-db.mjs`. El resto de variables (Stripe, WhatsApp, Gemini…) viven solo en
   Railway, porque en carril B no se levanta la app en local: solo se corren tests.
   → El `CLAUDE.md` describe la máquina del **carril A**, que despliega y sí necesita prod.
   No es una contradicción: son dos máquinas con permisos distintos por diseño.
   → Si al abrir un worktree ves `Environment variable not found: DATABASE_URL`, es esto,
   y es lo esperado. Los tests **no gateados** (entre ellos la red fail-closed de SCRUM-55)
   no tocan BD y corren igual sin `.env`; solo los de `QA_DB_TEST=1` necesitan el fichero.

5. **Nunca leas el resultado de una herramienta a través de una tubería. (SCRUM-103)** En una
   pipeline, el código de salida que ves es el del **último** comando, no el del primero.
   `npm run build | tail -5 && echo "BUILD OK"` imprimió **BUILD OK con el build fallando**:
   el exit code leído era el de `tail`, que siempre sale 0. **12 errores de TypeScript
   reportados como verde.**
   → Ejecuta la herramienta **sola** y mira su salida, o usa `set -o pipefail` / `${PIPESTATUS[0]}`
   si de verdad necesitas la tubería. Nada de `| tail`, `| head` ni `&&` entre una herramienta
   y su código de salida. Esto aplica igual a `npm test`, `tsc`, `prisma` **y `git`**.

   **Segundo caso, el mismo día y con `git` (SCRUM-103).** Este repo se usa con dos worktrees
   (carril A y carril B). Con `main` abierto en el otro, `git checkout main` **falla y grita**:
   `fatal: 'main' is already used by worktree at …`, exit **128**. Pero escrito así:

   ```bash
   git checkout main 2>&1 | tail -1 && git checkout -b mi-rama    # ⚠️ NO
   ```

   la tubería devuelve el exit de `tail` (**0**), el `&&` continúa, y la rama nueva sale **de
   donde estuvieras**: salió de una rama sin mergear, siete commits por detrás de `main`, e
   incluía el commit que añadía esta misma sección. No se detectó al hacer el checkout — se
   detectó al buscar un texto del runbook y no encontrarlo.

   La lección **no** es "desconfía de `git checkout`": git hizo su trabajo. Es esta misma regla,
   mordiendo en la misma sesión en que se escribió. Que la doctrina recién redactada no evitara
   su propio caso es el motivo de la segunda capa: **confirma la base antes de empezar** con
   `git merge-base --is-ancestor origin/main HEAD`, o al menos un `git log --oneline -1`. Cuesta
   un segundo y evita rebasar a destiempo con el trabajo ya hecho encima.

6. **Al empezar y al terminar una tanda, consulta tus tickets asignados con JQL.** El otro
   carril puede haberte asignado trabajo, y **el contexto de sesión nunca lo refleja**.

   ```
   project = SCRUM AND assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC
   ```

   No es disciplina personal, es **estructural**: con dos carriles abriéndose tickets el uno al
   otro y el fundador cerrando en paralelo, no hay forma de que una sesión sepa qué le han puesto
   en la cola desde que empezó. El 23-jul-2026 el carril B descubrió así **dos tickets propios
   (SCRUM-103 y SCRUM-108) de cuya existencia no tenía ni idea** — y SCRUM-108 nacía de un
   hallazgo suyo.

   **Al TERMINAR también**, no solo al empezar: el estado de `main` y de los tickets caduca en
   minutos (varios PR por hora). Una comprobación hecha al abrir la tarea **no sirve** para
   afirmar nada al cerrarla — ver la regla 2 de la sección siguiente, que es el mismo fallo
   aplicado al estado en vez de a los tests.

## Escribir verificaciones: un verde falso no lo mira nadie (SCRUM-103)

Entre el 22 y el 23-jul-2026 aparecieron **seis** mecanismos que pasaban sin comprobar lo que
decían comprobar (catálogo completo en SCRUM-103): una suite que solo corría tras `QA_DB_TEST=1`
y se había caído entera; dos tickets cerrados con la ruta de su propio título abierta en
producción; un ratchet que contaba entradas sin validar su contenido; un canario de tenancy
clavado en `'9999.00'` que dejó de poder coincidir al pasar a coma decimal; y la trampa 5 de
aquí arriba.

En ninguno falló el criterio — el criterio estaba bien escrito en los seis. Lo que falló es que
existía un estado **verde alcanzable sin que la comprobación llegara a ocurrir**. Y sobreviven
por un motivo asimétrico que conviene tener presente al escribir un test:

> **Un rojo se investiga; un verde falso no lo mira nadie.**

Un fallo ruidoso se arregla el mismo día. Un verde que no significa nada puede durar meses, y
encima *consume* la atención que habría ido a comprobarlo a mano: es peor que no tener la
verificación, porque genera confianza sin respaldarla.

Las tres reglas que salen de ahí, para cualquier test, assert o check nuevo:

1. **Pruébalo en rojo, modo por modo, y déjalo escrito en el commit.** Una regla que no has
   visto fallar no sabes si funciona. La red fail-closed de SCRUM-55 se probó en sus 5 modos
   (gate quitado · `app.use` en vez de `mountAdmin` · entrada muerta · plazo caducado · lista
   creciendo) antes de darla por buena.

   **Esto incluye la LIMPIEZA, que es la parte que nadie prueba.** Un `finally` que borra
   fixtures es código como cualquier otro y falla igual, solo que su fallo no sale por
   ningún sitio: el test pasa y la basura se acumula en staging hasta que alguien la cuenta.
   *Un test de limpieza que no has visto fallar no sabes si limpia.* Los dos modos mínimos:
   revienta el **montaje** de fixtures y comprueba que no queda nada; revienta la **primera**
   operación de borrado y comprueba que las siguientes se ejecutan igual (SCRUM-113 los
   prueba así, contra un doble de `prisma`, sin BD ni gate).

   Y **nunca lances desde un `finally` de limpieza**: un `throw` ahí *sustituye* a la
   excepción original, así que el error de verdad del test desaparece y se lee un fallo de
   borrado en su lugar — además de saltarse todo lo que venga detrás en el mismo bloque
   (`server.close()`, `$disconnect()`). Avisa por consola y sigue.

2. **Toda comprobación por AUSENCIA necesita antes un assert de que lo buscado existe cuando
   debe existir.** El canario de tenancy buscaba que la cadena `'9999.00'` no apareciera en el
   export de otro merchant; al cambiar el formato a coma decimal, esa cadena dejó de existir en
   ninguna parte y el assert siguió en verde **sin comprobar nada**. "No aparece" era su
   condición de éxito, así que su propia rotura era indistinguible del éxito. Guarda previa
   obligatoria: afirmar primero que el valor SÍ está donde tiene que estar.

3. **Que la garantía estructural corra en `npm test` normal, sin gate.** A12.4 vive tras
   `QA_DB_TEST=1`, solo contra staging, y se cayó entera sin que nadie se enterara. Los 403 de
   comportamiento necesitan BD y seguirán ahí; pero lo que se pueda comprobar sin BD ni servidor
   (que toda ruta declare rol, que una lista no crezca) va en la suite normal. Una red que solo
   funciona cuando alguien se acuerda de levantarla no es una red.

4. **Calíbralo contra los datos REALES antes de darlo por bueno, y ante la duda prefiere el
   falso negativo.** Un assert nuevo se prueba contra todo lo que ya hay en el repo, no solo
   contra el caso que lo motivó. En SCRUM-103 el assert propuesto en el ticket exigía que cada
   entrada aparcada formulase una pregunta: **0 de las 17 entradas reales llevaban signo de
   interrogación**. Habría puesto la build en rojo con todo el trabajo legítimo ya aparcado.

   Y ese es el fallo peor de los dos. Un **falso negativo** (se cuela algo flojo) cuesta un caso
   sin detectar. Un **falso positivo** — rojo con trabajo legítimo — hace que alguien **relaje el
   test para poder seguir**, y a partir de ahí no detecta nada nunca más. Un test relajado para
   seguir es exactamente cómo empezó esta lista de seis casos.

   Corolario: si al calibrar contra los datos reales una entrada falla, **antes de tocar el assert
   hay que mirar si el dato es el que está mal**. En SCRUM-103, la única de 17 que falló era un
   agujero de permisos vivo en producción (`GET /admin/products/export`, el tarifario completo
   descargable por un Técnico), no un falso positivo.

5. **Si puedes comprobarlo por ESTRUCTURA en vez de por texto, hazlo. (SCRUM-108/111)** Buscar
   una cadena en una salida es frágil por naturaleza: depende del formato, del serializador,
   del nombre del campo y de que la fixture siga sembrando ese valor. Comprobar una propiedad
   estructural —un status, un content-type, la ausencia de una clave en un objeto, el tipo de
   los bytes— **es inmune a todo eso por diseño**.

   `tests/scrum72-pdfs-privados` no busca cadenas: comprueba `status === 404` y `!isPdf(res)`.
   Ningún cambio de formato puede dejarlo pasando en vacío. Comparado con el canario del ZIP
   —que buscaba una cadena en bytes **comprimidos** y por eso no podía fallar nunca
   (SCRUM-111)—, es la misma intención con una implementación que sí sostiene la garantía.

   Esta regla evita de golpe los dos modos de fallo: el canario que **se rompe** con un cambio
   de formato (regla 2) y el que **nace roto** porque el texto no está donde se busca. Cuando
   no haya alternativa a buscar por texto, aplica la regla 2 sin excepción — y comprueba que
   estás mirando el sitio correcto: descomprimido, decodificado y en el mismo formato en que
   se emite.

6. **Al verificar un cambio, confirma los asserts nuevos UNO A UNO — no el total. Y ante un
   test en rojo, pregunta también qué quedó POR DETRÁS sin evaluar. (SCRUM-108)**

   Un verde global no prueba que tus asserts se ejecutaran; un rojo global no dice cuáles
   quedaron sin ejecutar. **En `node --test`, el primer assert que falla mata todos los
   posteriores del mismo `test()`**: un fichero con 30 asserts que revienta en el tercero
   reporta **un** fallo, y los 27 restantes quedan sin evaluar sin que nada lo indique.

   Le pasó al propio SCRUM-108 el día que se escribió esta regla. Se añadieron **cuatro**
   guardas nuevas y la tanda salió «4 pass, 1 fail». Confirmadas una a una: tres se habían
   ejecutado y **la cuarta no llegó a correr nunca** — su fichero (`scrum49`) abortaba doce
   líneas antes, por un fallo ajeno (SCRUM-114). Se mergeó **sin estrenar**, y el recuento no
   lo distinguía de las otras tres.

   → Cuando un test falle por una causa que no es tuya, **no te quedes en «no es mío»**:
   localiza qué asserts propios vivían por detrás y **dilo explícitamente**, en el PR y en el
   ticket. Un assert mergeado que no se ha ejecutado ni una vez no está verificado, y es
   justo el estado en el que nadie vuelve a mirarlo.

   → Y para decidir si un fallo es tuyo, **demuéstralo en vez de defenderte**: extrae la
   versión de `main` del fichero y córrela con el **mismo `dist` y la misma BD**, dejando tu
   edición como única diferencia. Cuesta una ejecución y convierte «no creo que sea mío» en
   «no es mío, y aquí está la prueba».

### La conclusión de las seis reglas: mueve la garantía de la disciplina al mecanismo

Las reglas de arriba son útiles, pero el 23-jul-2026 falló **una regla que estaba bien escrita y
que se cumplió**. Merece la pena entender por qué, porque decide cómo se escribe la siguiente
salvaguarda.

**Tres formas del mismo problema, en un solo día:**

* **El recordatorio del LEEME** — la salvaguarda **existía y apuntaba mal**. Comprobaba el texto,
  no el criterio: cambiar el filtro y olvidar la descripción pasaba en verde. Disparaba solo
  cuando ya habías hecho lo correcto (SCRUM-106/108).
* **El canario del ZIP** — **nació incapaz de fallar**. Buscaba una cadena en bytes comprimidos;
  con la fuga dentro daba verde igual (SCRUM-111).
* **`scrum106-trabajos-fecha`** — **la regla estaba bien escrita, se cumplió, y no cubría el
  caso**. El runbook pedía limpiar en `finally` con `.catch()` por operación, y así se hizo. Lo
  que la regla no podía decir es **dónde crear el merchant**: eso no era una regla, era una
  **forma**. Entre el `create` y el `try` quedó una ventana sin red.

**En las tres, lo que aguantó fue mover la garantía de la disciplina al mecanismo:** una constante
única de la que derivan filtro y texto, para que no puedan divergir; leer el contenido
descomprimido, para que el canario pueda ver lo que vigila; un helper `withMerchant` que mete el
montaje dentro de la red por construcción.

> **Una regla protege desde que la lees; un mecanismo protege también hacia atrás.**

El ratchet de SCRUM-113 cazó un fichero escrito **antes de que el helper existiera**. Ninguna regla
puede hacer eso: quien escribió aquel test no tenía nada que leer. Por eso, cuando una salvaguarda
se pueda expresar como mecanismo —una constante compartida, un helper que envuelve, un tipo que no
compila mal— **prefiérelo a documentarla aquí**. Este runbook es la red de lo que todavía no se ha
podido convertir en mecanismo, no el sitio donde se resuelven las cosas.

**Corolario para los detectores:** el ratchet marcó ese fichero aunque su fuga **no fuera
alcanzable** —entre el `create` y el `try` solo había cuatro `const` de fechas, que no lanzan—.
Está bien así: cazó el **patrón**, no un escape vivo. Esas cuatro líneas inertes son exactamente
donde alguien mete mañana un `customer.create`, y ese día sí hay fuga sin que nadie note que el
fichero cruzó una frontera.

> **Un detector que solo saltara con exposición demostrable llegaría siempre tarde.**

Al calibrar un detector, cuenta esto junto con la regla 4: el falso positivo por patrón es barato
—se migra el fichero— y el falso negativo se paga en producción.

> **Coordinación (regla del canal):** la suite y el seed **resetean la BD del merchant QA**.
> Avisa por el canal antes de lanzarla — solo uno a la vez. `tests/` es **zona compartida**:
> avisar antes de tocarlo (SCRUM-78 y SCRUM-79 arreglaron el mismo fichero el mismo día sin
> saberlo, y chocaron en un merge).

## Variables

- `BASE` = URL de staging (p.ej. `https://<staging>.up.railway.app`)
- `QA_EMAIL` = email del merchant seed (default `qa@staging.yaqu`)
- `QA_SECRET` = valor de `E2E_TEST_LOGIN_SECRET` en staging

## 0 · Login de test

1. `POST {BASE}/auth/test-login` con JSON `{ "email": QA_EMAIL, "secret": QA_SECRET }`
   (vía `page.request` o formulario; la cookie `pf_session` queda en el contexto).
   - ✅ ASSERT: respuesta `{ ok: true }` y cookie de sesión presente.
2. Navegar a `{BASE}/dashboard/` → ✅ ASSERT: carga el Home (no redirige a `/login.html`).
3. **(v1.1, SCRUM-36)** Si aparece el modal de onboarding ("Bienvenido a YaQu" — merchant
   recién sembrado), **descartarlo** ("Saltar por ahora" / cerrar) ANTES de capturar
   pantallas. Los asserts DOM no lo necesitan, pero las capturas de evidencia sí.

## 1 · Plan custom 30/40/30 de 100,01 € (SCRUM-27/32/34)

3. Ir a Presupuestos → abrir el presupuesto "Obra QA por hitos (30/40/30)".
4. ✅ ASSERT "Condiciones de pago" muestra el plan: `Anticipo 30% · Hito 1 40% · Hito 2 30%`
   (NUNCA "Sin condiciones específicas").
5. Botón de facturas — generar los 3 tramos SIN tocar el Trabajo (sin marcar Terminado):
   a. ✅ ASSERT botón = `Generar siguiente tramo: Anticipo (30,00 €)` → click.
   b. ✅ ASSERT botón = `Generar siguiente tramo: Hito 1 (40,00 €)` → click.
   c. ✅ ASSERT botón = `Generar siguiente tramo: Hito 2 (30,01 €)` → click.  ← céntimo impar
   d. ✅ ASSERT botón = `Plan de facturación completado` (deshabilitado).
6. ✅ ASSERT: la sección Facturas lista 3 justificantes con importes **30,00 + 40,00 + 30,01**
   (suma EXACTA 100,01 — SCRUM-32). **(v1.4, SCRUM-44)** El estado pendiente NO aparece como
   literal "Pendiente" en esta lista: se infiere de que cada tramo sin cobrar muestra el botón
   **"Marcar como pagada"** — el assert comprueba que los 3 tramos tienen ese botón visible.
   **(v1.1, SCRUM-42)** ✅ ASSERT: los números de documento empiezan por **`J-`** (serie de
   justificante de merchant REAL — el seed quema el id 1; si sale `2026-…` el merchant QA ha
   caído en semántica demo) y **sin watermark "DEMO"** en pantalla.
7. CTAs de invoice (SCRUM-35): en el primer tramo → click **"Marcar como pagada"**.
   **(v1.4, SCRUM-43)** ✅ ASSERT: aparece la confirmación nativa
   `¿Marcar como pagada la factura {número} de {importe}?` con el número del justificante y su
   importe correctos → aceptarla (con el Playwright MCP: `browser_handle_dialog` accept; si se
   cancela, la factura NO cambia de estado).
   **(v1.4, SCRUM-44)** ✅ ASSERT: tras confirmar, el CTA de cabecera pasa a
   **"Ver cobro pendiente"** (quedan tramos sin cobrar; el texto "Ver justificante" del v1.1
   no era el real) — o el tramo se muestra pagado tras recargar el detalle.

## 2 · Preset 50/50 — regresión BYTE A BYTE (deuda del E2E de SCRUM-34)

8. Abrir el presupuesto "Trabajo QA 50/50" (200,00 €).
9. ✅ ASSERT "Condiciones de pago" = `50% al aceptar, 50% al finalizar` (texto REAL de
   `getPaymentTermsLabel` en el detalle — v1.1: el v1 traía por error el texto de la preview).
10. ✅ ASSERT botón = `Generar 1ª factura (50%)` → click.
11. ✅ ASSERT botón = `Generar 2ª factura (50% restante)` → click.
12. ✅ ASSERT botón = `Plan de facturación completado` (deshabilitado) y 2 justificantes de 100,00 €.

## 3 · Preset 100% — sin regresión

13. Abrir "Trabajo QA 100%" (150,00 €).
14. ✅ ASSERT "Condiciones de pago" = `Pago 100% al aceptar` (texto REAL del detalle — v1.1).
15. ✅ ASSERT botón = `Generar factura (100%)` → click → ✅ ASSERT `Factura ya generada`
    (deshabilitado) y 1 justificante de 150,00 €.

## 4 · Cero envíos reales (evidencia obligatoria)

16. Logs del servicio staging: los envíos de WhatsApp aparecen como dry-run (wamid `dryrun.*`)
    y NINGUNA llamada a `graph.facebook.com`; sin `RESEND_API_KEY` los emails van a
    buffer/outbox/console. ✅ ASSERT: ni un mensaje real de WhatsApp ni email real.
17. (Si accesible) `/outbox` o log WA-0b como evidencia adjunta al reporte.

## 5 · Albaranes (v1.3, SCRUM-14 — documento NO fiscal)

> Prerequisito: seed con Jobs (el seed crea un Trabajo por quote aceptada desde v1.3).

18. Ir a Trabajos → abrir el Trabajo de "Obra QA por hitos (30/40/30)" → sección **Albaranes**.
19. Click **"+ Nuevo albarán"** → ✅ ASSERT: aparece con número **`ALB-<año>-001`**, estado
    **Borrador**, `v1`. Crear un segundo → ✅ ASSERT `ALB-<año>-002` (correlativo, serie propia
    del merchant, independiente de la serie de facturas/justificantes).
20. **Editar borrador**: "Editar líneas" → añadir línea (concepto/cantidad/unidad, SIN precio)
    → Guardar → ✅ ASSERT **v2** visible. Línea inválida (concepto vacío o cantidad 0) →
    ✅ ASSERT error 400 claro y NO se guarda.
21. **Emitir** → ✅ ASSERT estado **Emitido**; botones ahora [PDF] [Firmar] [Editar líneas].
22. **PDF (SIN_VALORAR, comportamiento por defecto)** → se abre por el endpoint **auth**
    `GET /admin/albaranes/:id/pdf` (el botón "PDF" de la UI ya apunta ahí). ✅ ASSERT: título
    "ALBARÁN / PARTE DE TRABAJO"; SIN la palabra "factura" como título, SIN QR, SIN serie J-,
    **SIN importes/precios** (solo concepto·cantidad·unidad). **(v1.7, SCRUM-67)** Leyenda legal
    EXACTA: **"Documento sin validez fiscal. No es una factura."** (reemplaza el pie de v1.3-v1.6);
    ✅ ASSERT también: **fecha de emisión** y **fecha de entrega/ejecución** por separado
    (`Emitido: … · Entrega/ejecución: …`), bloque **Emisor** (nombre/NIF/domicilio, sin cambios)
    y bloque **Receptor** (nombre del cliente, +NIF si el cliente lo tiene registrado).
22b. **(v1.5, SCRUM-48) Seguridad del PDF:** `GET {BASE}/albaranes/<archivo>.pdf` SIN cookie
    (tanto `ALB-<año>-001.pdf` como `<merchantId>-ALB-<año>-001.pdf`) → ✅ ASSERT **404** y
    content-type ≠ `application/pdf` (el estático público se eliminó; los PDF llevan firma y
    datos personales). El PDF SOLO sale por el endpoint auth del paso 22.
22c. **(v1.7, SCRUM-65) Albarán VALORADO:** en la sección Albaranes, marcar el toggle
    **"Incluir precios en el parte"** (subtexto "El parte sigue sin ser una factura") ANTES de
    **"+ Nuevo albarán"** → ✅ ASSERT: el nuevo albarán trae columnas **Precio ud. / IVA %** en
    "Editar líneas". Añadir una línea (p. ej. 2 h a 45 € con IVA 21%) → ✅ ASSERT **total
    orientativo en vivo** = `Base: 90,00 € · Total orientativo: 108,90 €` bajo las líneas. Guardar
    sin precio/IVA en modo VALORADO → ✅ ASSERT error 400 claro (`lineas_invalidas`) y NO se guarda.
22d. **PDF valorado** → tras emitir, ✅ ASSERT columnas **PRECIO UD. / IMPORTE** por línea +
    bloque de totales (**Base** y **Total**, SIN desglose de cuota de IVA por tipo) + leyenda
    **"Importes orientativos; el IVA y la factura se emitirán conforme a la normativa vigente."**
    Además de las dos fechas/Receptor del paso 22 (comunes a ambos modos).
22e. **Candado del modo:** con el albarán VALORADO recién emitido, `PATCH /admin/albaranes/:id`
    con `{modoValoracion:'SIN_VALORAR'}` → ✅ ASSERT **409 `albaran_locked`** (el modo solo se
    cambia en borrador). Un albarán **legacy/SIN_VALORAR** (creado sin el toggle) sigue
    funcionando exactamente como en v1.3-v1.6 (sin cambios de comportamiento).
23. **Firmar** (canvas en el móvil del pro) → ✅ ASSERT estado **Firmado** + el PDF regenerado
    incluye el bloque "Conformidad del cliente" con la firma.
24. **Congelado**: en un albarán Firmado → ✅ ASSERT no hay botones de edición en la UI y el
    `PATCH /admin/albaranes/:id` responde **409 `albaran_locked`**.
25. **Foto**: "📷 Añadir foto" en un albarán no firmado → ✅ ASSERT miniatura visible tras
    subir (límites: jpeg/png/webp, ≤5 MB, máx. 10).
26. **Tenancy**: con sesión de OTRO merchant (si la allowlist E2E lo permite),
    `GET /admin/albaranes/:id` del albarán anterior → ✅ ASSERT 404. (Si no hay segundo
    merchant en staging, queda cubierto por `tests/albaran.test.mjs`.)
27. Cero envíos: los albaranes NO envían WhatsApp ni email en V1 → el log WA-0b no crece.
    **(v1.6, SCRUM-47)** OBSOLETO para el albarán FIRMADO: ahora sí se envía por WhatsApp a mano
    desde el §6 (los albaranes borrador/emitido siguen sin enviar nada).

## 6 · Enviar el albarán FIRMADO por WhatsApp (v1.6, SCRUM-47)

> **Precondiciones del paso (hallazgos v1.6):**
> - **El seed NO crea albaranes** → este paso necesita un albarán en estado **Firmado**.
>   Reutiliza el del §5.23, o créalo por API en la misma sesión autenticada:
>   `POST /admin/jobs/:id/albaranes` → `POST /admin/albaranes/:id/emitir` →
>   `POST /admin/albaranes/:id/firmar` (`{ signatureData: <data-URI PNG> }`).
> - **Onboarding wizard tras el reseed:** el merchant QA queda con onboarding incompleto, así
>   que `#onboarding-backdrop` **intercepta los clicks**. Descártalo (§0.3) o elimínalo por JS
>   ANTES de pulsar el botón, o el click del Playwright MCP hará **timeout**.

28. En el detalle del Trabajo, sobre el albarán **Firmado** → ✅ ASSERT las acciones son
    **[PDF] [Enviar por WhatsApp]**. El botón nuevo aparece **SOLO en Firmado** (en Borrador/Emitido
    no). `jobDetailView.js` NO está en el SHELL del SW → llega fresco, sin bump de `CACHE_NAME`.
29. Click **"Enviar por WhatsApp"** → ✅ ASSERT `POST /admin/albaranes/:id/enviar-whatsapp`
    responde **200 `{ ok: true }`** (toast "✓ Albarán enviado por WhatsApp." — efímero; la verdad
    autoritativa es el body + el log WA-0b del paso 30).
30. ✅ ASSERT log WA-0b: fila `type:'template'`, `templateName:'albaran_firmado_es'`,
    `relatedType:'albaran'`, `relatedId:<id>`, `status:'sent'`. **staging corre `WHATSAPP_DRY_RUN=1`**
    → `waMessageId` = `wamid.dryrun.*` y CERO llamada a `graph.facebook.com` (coherente con §4). El
    E2E valida wiring + guards (V0-2/J3/A3.2/J6/J7) + log + UI, **NO** la aceptación real de la
    plantilla por Meta (depende de `albaran_firmado_es` Approved en la WABA de PROD).
31. **Negativos (cubiertos por `tests/scrum47-enviar-albaran-wa.test.mjs`, gateado):** no-firmado
    → 409 `albaran_no_firmado`; cliente sin teléfono → 409 `sin_telefono`; tenancy (merchant ajeno)
    → 404. Desde la UI el botón solo existe en Firmado, así que el 409 no-firmado no es alcanzable
    con el botón.

## 7 · Operarios — autoría en el Trabajo (SCRUM-22)

> Cobertura del read-path de autoría. La verificación automática vive en
> `tests/scrum52-operario.test.mjs` (write-path: operarioId poblado + audit + índice) y
> `tests/scrum22-operario-readpath.test.mjs` (serializer operario:{id,name} + owner null + tenancy),
> ambos en `npm test` (gate `QA_DB_TEST=1`).

31. Contrato en staging (JSON, sin UI): `GET {BASE}/admin/jobs` y `GET {BASE}/admin/jobs/:id`
    → ✅ ASSERT cada Job trae `operarioId` y `operario` (`{id,name}` o `null` para el propietario).
32. Propagación a documentos (SCRUM-22 DONE): en `GET {BASE}/admin/jobs/:id` → ✅ ASSERT cada
    entrada de `albaranes[]` y el objeto `charge` exponen `operario` (misma autoría del Trabajo,
    `{id,name}` o `null`).
33. **(SCRUM-57) Render visible en el detalle:** abrir un Trabajo → ✅ ASSERT en la cabecera un chip
    **"👷 Responsable: {nombre}"** = el nombre del operario si `job.operario` no es null, o el nombre
    del NEGOCIO (vía `/admin/merchant`) si el Trabajo es del propietario (`operario` null). `window.appUserName`
    NO sirve (es el usuario logueado). `jobDetailView.js` NO está en el SHELL del SW → sin bump de `CACHE_NAME`.

> **(SCRUM-23) Visibilidad por rol.** Cubierta automáticamente por el caso row-level de
> `tests/tenancy-permisos.test.mjs` (crea su merchant + 2 técnicos + 2 Jobs efímeros; no depende
> del seed). Filtrado SIEMPRE en backend (S3).

34. Con sesión de **técnico**: `GET {BASE}/admin/jobs` → ✅ ASSERT la lista trae SOLO los Trabajos
    con `operarioId` = ese técnico; ninguno de otro operario (fuga = fallo de seguridad).
35. Con sesión de **técnico**: `GET {BASE}/admin/jobs/:id` de un Trabajo de OTRO técnico del mismo
    merchant → ✅ ASSERT **404** (no 403: mismo patrón que la tenancy, no filtra existencia).
36. Con sesión de **admin/owner**: la lista trae los Trabajos de todos los operarios y el detalle
    de cualquiera responde **200** (sin cambio respecto a antes de SCRUM-23).

> **(SCRUM-24) Supervisión por operario.** Cubierta automáticamente por
> `tests/scrum24-operarios-metrics.test.mjs` (sumas por operario + fila del propietario +
> técnico 403 + tenancy, con datos efímeros propios). El gate real es de backend.

37. Con sesión de **admin**: en el sidebar aparece **Operarios** → abrir la vista → ✅ ASSERT
    tarjeta de cabecera **"Pendiente de cobrar"** con el importe total y el nº de trabajos
    abiertos, y una tarjeta por operario con su barra de % cobrado y su pill de estado.
38. Selector por operario: click en el nombre de un operario → ✅ ASSERT la lista muestra solo
    su tarjeta; "Todos" restaura el listado completo.
39. Con sesión de **técnico**: ✅ ASSERT el ítem **Operarios** NO aparece en el sidebar; navegar
    a la vista a mano redirige a Inicio; y `GET {BASE}/admin/metrics/operarios` responde **403**
    (el gate es de backend — regla S3, no basta con ocultar el nav).
40. Digno 390/1280: ✅ ASSERT una columna en móvil, importes en tinta y tabulares, sin scroll
    horizontal.

## 8 · PDFs de factura y presupuesto privados (SCRUM-72 · seguridad/RGPD)

> Los PDFs vivían en `public/invoices` servidos por estático con nombres **enumerables**
> (`2026-CF-001`, `-002`…): se descargaban documentos ajenos sin login. Ahora viven en
> `storage/invoices` y solo salen por endpoint auth. Cobertura automática:
> `tests/scrum72-pdfs-privados.test.mjs` (incluye el **assert de regresión** que falla si
> alguien devuelve el directorio a `public/`).
>
> ⚠️ **SCRUM-72 NO cierra la fuga del todo:** `GET /recibo/:chargeId/pdf` sigue sirviendo los
> mismos PDFs de forma **anónima y enumerable** (`Charge.id` es autoincremental) hasta que se
> resuelva **SCRUM-74**. No dar esto por "PDFs privados ✅".

41. **Estático muerto:** `GET {BASE}/invoices/<numero-real>.pdf` **sin cookie** → ✅ ASSERT **404**
    y content-type ≠ `application/pdf`. Ídem con el nombre nuevo `<merchantId>-<numero>.pdf`
    y con `QUOTE-<quoteId>.pdf` (presupuesto).
42. **Descarga del admin:** en el dashboard, botón **PDF** de una factura y de un presupuesto
    (Clientes → ficha, y modal de presupuesto) → ✅ ASSERT abre el PDF correctamente
    (van por `/admin/invoices/:id/pdf` y `/admin/quotes/:id/pdf`).
43. **Email de factura:** enviar factura por email → ✅ ASSERT llega **con el PDF adjunto** y
    **sin botón "Ver documento"** (se retiró en SCRUM-72; el adjunto es el que sostiene el acceso).
44. **Recibo público (NO es fuga, por diseño):** `GET {BASE}/recibo/:chargeId/pdf` de un cobro
    pagado → ✅ ASSERT sigue respondiendo **200** (el cliente lo abre desde WhatsApp sin login).

## Resultado

- Reportar por paso: ✅/❌ + captura del MCP donde aporte.
- Cualquier ❌ = HALLAZGO → ticket aparte en Jira (regla 9). La suite no arregla nada.
- Nota de estado: los pasos 5-7 alteran la BD staging (tramos emitidos/pagados). Re-ejecutar
  la suite requiere re-sembrar (borrar el merchant QA o usar un `E2E_QA_EMAIL` nuevo) — v2
  podrá automatizar el reset.
