# ERRORES DEL ASESOR — registro y reglas derivadas
> Documento vivo. Vive en `docs/`. Complemento de `ASESOR.md`.
> **Propósito:** que los errores del rol asesor no se repitan. Cada entrada registra QUÉ pasó, POR QUÉ pasó, QUIÉN lo detectó y QUÉ REGLA se deriva. Las reglas del final son de aplicación obligatoria.
>
> **Por qué existe:** el asesor no escribe código, así que sus errores no los caza ningún test. Se detectan tarde o no se detectan. Este registro es su única red.

---

## LAS REGLAS (leer antes de cada sesión)

**R1 · Verifica en la fuente antes de afirmar.** No deducir el estado de algo por su síntoma. Si es configuración externa (Meta, Resend, Railway, DNS), mirar EN la herramienta. Si es código, leer EL código. Si es un archivo, comprobar que existe.

**R2 · No cerrar un ticket sin evidencia de que el fix está donde debe.** "Claude Code dice que está hecho" no es evidencia; el diff o el test que lo prueba, sí. **Un mensaje de éxito NO es evidencia de éxito** — hay que preguntarle al sitio donde debería estar el resultado, no al proceso que dice haberlo puesto. Dos métodos concretos, uno por cada eslabón:

- **¿Llegó la rama al remoto?** → `git ls-remote --heads origin | grep <rama>`. **El listado COMPLETO con `grep`, nunca la consulta filtrada** (`ls-remote --heads origin <rama>`): una consulta filtrada que devuelve vacío y una que no llega a devolver son **indistinguibles en una línea de salida**; el listado enseña el conjunto y ahí el hueco se ve. Contrastar el SHA con `git rev-parse HEAD`. Ocurrió el 27-jul-2026 (incidente #10): push con mensaje de éxito, exit 0, y la rama no existía en GitHub — el PR daba 404 y `main` siguió en rojo mientras el fix parecía entregado.
- **¿Llegó el commit (o el contenido) a `main`?** → **resolver primero el SHA y preguntar por el SHA**, nunca por el alias:

  ```bash
  git fetch origin main -q
  MAIN=$(git rev-parse origin/main)
  git merge-base --is-ancestor <commit> "$MAIN"      # ¿está el commit?
  git show "$MAIN:<ruta>" | grep "<lo que buscas>"   # ¿está el contenido?
  ```

  Nunca el estado de Jira ni el resumen en prosa del ejecutor. Y **`origin/main` es un alias local que puede ir por detrás del remoto**, sobre todo consultado justo después de un `fetch` encadenado en la misma línea: el 27-jul-2026 eso dio un **falso "NO está"** sobre un fichero (`.github/workflows/ci.yml`) que sí estaba en `main`, y estuvo a punto de mandar a rehacer trabajo ya entregado. Resolver el SHA primero quita la ambigüedad.

Los dos eslabones fallan igual y en silencio: el trabajo existe, el mensaje dice que salió, y el resultado no está donde hace falta.

**Y fallan en las DOS direcciones, las dos caras cuestan:** un falso *"sí está"* deja el trabajo sin entregar creyendo que se entregó (`main` en rojo mientras el arreglo parece hecho); un falso *"no está"* manda a rehacer lo que ya estaba. Los dos salen de lo mismo — fiarse de un alias, o de una salida de una línea, en vez de preguntarle al objeto.

**R3 · Orden de diagnóstico para "algo no llega/no funciona":** ① ¿se generó? ② ¿se envió/ejecutó? ③ ¿llegó? ④ ¿lo filtró/bloqueó alguien? Empezar por ①, no por ④.

**R4 · Una prioridad Highest exige una comprobación, no una sospecha.** Marcar algo como crítico sin verificar quema credibilidad y desvía trabajo.

**R5 · Antes de proponer infraestructura o proceso nuevo, preguntar qué dolor concreto resuelve.** Si no hay un incidente real detrás, es sobreingeniería.

**R6 · Coordinar recursos compartidos ANTES de repartir tareas**, no después del choque. Staging, `main`, un archivo caliente: si dos carriles pueden tocarlo, decirlo al asignar.

**R8 · Un guard nuevo se prueba TAMBIÉN contra los guards que ya existen, no solo contra el defecto que viene a cerrar.** Cuando varios mecanismos pueden rechazar, excluir o bloquear de forma independiente, la pregunta obligatoria es **«¿qué queda cuando actúan TODOS a la vez?»** — y muy en particular el **caso degenerado: que no quede nada**. Ese estado casi nunca está en el alcance de ningún ticket, así que no lo cubre ningún test, y **un diff no lo enseña, porque ninguna línea está mal**: el defecto vive en la composición, no en las piezas.

Tres cosas concretas, por orden de coste:

1. **Correr la suite ENTERA, no los tests del ticket.** Es la única capa que ve la composición. Y la señal es específica: **un test AJENO que cae por un motivo que no es su tema**. Si un test de otro ticket falla y su mensaje no habla de lo que ese test vigila, no es un fixture que haya que ajustar — es que el sistema entró en un estado nuevo. Ajustarlo sin entenderlo entierra el hallazgo.
2. **Preguntarse por el vacío.** Si el mecanismo filtra, ¿el consumidor aguanta cero elementos? Los formatos con `minOccurs` ≥ 1, los agregados, los ZIP y los informes suelen romperse ahí, y romperse **en silencio**.
3. **Al añadir el guard N-ésimo, listar los N−1 anteriores** que pueden actuar sobre el mismo objeto. Si la lista no cabe en una línea, ese es el aviso.

**Por qué es una familia propia y no un caso de R1:** aquí nadie afirmó nada sin comprobarlo. Todo estaba medido y todo estaba bien **por separado**. Es el reverso de *«prohibición sin mecanismo»*: **exceso de mecanismos que nadie compuso**. Y se parece al #12 —probar con un caso fuera del mecanismo— pero una capa más arriba: el caso está *dentro* de cada mecanismo y *fuera* de todos a la vez.

*(Origen: incidente #15, 29-jul-2026. Se numera R8 y no R7 porque R7 existe en una rama sin mergear.)*

---

## REGISTRO DE INCIDENTES

### 2026-07-22 · #1 — Cerré SCRUM-54 sin verificar que el fix estaba en la ruta correcta
**Qué pasó:** di por finalizada la tarea de gatear `collect-rest` con `requireRole('admin')` basándome en el reporte del ejecutor. Semanas después, el recon de SCRUM-55 descubrió que `collect-rest` **seguía sin gate**: el fix se había aplicado a la ruta de al lado (`consolidar-albaranes`), que además citaba "S1/SCRUM-54" en su comentario.
**Por qué:** confié en un reporte en prosa en vez de comprobar el código. El ticket quedó cerrado, sin comentario de evidencia, y el agujero de seguridad siguió vivo.
**Quién lo detectó:** el carril B (Javier), semanas después.
**Coste:** una ruta de dinero abierta a rol Técnico durante semanas, y un ticket cerrado que mentía.
**Regla derivada:** R2.

### 2026-07-22 · #2 — Diagnostiqué un problema de entregabilidad de email que no existía (SCRUM-91)
**Qué pasó:** ante "no me llega el magic link a Hotmail", abrí ticket **Highest** sobre entregabilidad, con plan de revisar SPF/DKIM/DMARC y reputación del dominio con Microsoft.
**Por qué:** salté al paso ④ del diagnóstico (¿lo filtró el destino?) sin comprobar el ① (¿se llegó a generar?). La causa real era SCRUM-92: `/auth/login` solo buscaba en `Merchant`, y un `TeamMember` salía por un return silencioso **sin crear token ni llamar a Resend**. El email nunca salió.
**Quién lo detectó:** el carril B, leyendo el código en vez del síntoma.
**Coste:** un ticket Highest falso, y a punto de mandar al fundador a investigar DNS sin motivo.
**Regla derivada:** R3, R4.

### 2026-07-22 · #3 — Di por rota una plantilla de Meta sin mirar el panel (SCRUM-77)
**Qué pasó:** abrí ticket **High** afirmando que `payment_request_es` tenía el botón como URL estática con `{{1}}` literal, con acción manual del fundador y aviso de que necesitaría re-aprobación de Meta.
**Por qué:** el diagnóstico partió de una URL copiada de un móvil (`%7B%7B1%7D%7D0`), no del panel de WhatsApp Manager. El propio ticket recogía la sospecha de truncamiento al copiar y **no se confirmó antes de abrirlo**. Al mirarlo, la plantilla ya estaba en modo dinámico y correcta.
**Quién lo detectó:** el fundador, abriendo el panel.
**Coste:** una tarea manual falsa en la cola del fundador durante horas, presentada como urgente.
**Regla derivada:** R1, R4.

### 2026-07-22 · #4 — Afirmé que no existía política de privacidad, y existía (SCRUM-93)
**Qué pasó:** abrí ticket **Highest** diciendo "no existe política de privacidad publicada". Existe desde junio en `public/privacidad.html`, publicada en `yaqu.app/privacidad`.
**Por qué:** no comprobé el repo ni la web. Asumí la ausencia porque no había aparecido en ninguna conversación.
**Quién lo detectó:** la sesión legal, al ir a escribirla.
**Coste:** menor (el ticket sigue siendo válido: la política está incompleta y sin validar), pero el planteamiento era falso y habría llevado a duplicar trabajo.
**Regla derivada:** R1.

### 2026-07-22 · #5 — Repartí tres sesiones sobre una única BD de staging sin coordinar turnos
**Qué pasó:** asigné tareas a dos sesiones propias mientras el carril B trabajaba, todas usando la misma BD de staging. Resultado: tests fallando con errores distintos en cada corrida, una sesión viendo "la columna no existe" mientras otra aplicaba un `db push`, y dos sesiones paradas esperando ventana.
**Por qué:** el plan ya decía "la suite resetea la BD QA, uno a la vez" — pero al repartir tareas no lo apliqué. Coordiné después del choque, no antes.
**Quién lo detectó:** las propias sesiones, parando a preguntar.
**Coste:** ~1h de trabajo perdido y varios diagnósticos falsos de "test roto".
**Regla derivada:** R6.

### 2026-07-22 · #6 — Propuse worktrees DESPUÉS de que dos sesiones se pisaran, no antes
**Qué pasó:** dos sesiones sobre el mismo checkout: una hizo `checkout -b` y arrastró los cambios sin commitear de la otra. Acabó en cirugía de git y en un `db push` a producción partiendo de la premisa falsa de que una tarea estaba mergeada (no lo estaba).
**Por qué:** conocía el riesgo (estaba documentado como lección previa) y aun así autoricé la segunda sesión sin exigir el worktree primero.
**Quién lo detectó:** las sesiones, al encontrarse el árbol cambiado.
**Coste:** una hora de reconstrucción manual, y una columna aplicada a producción antes que su código.
**Regla derivada:** R6.

### 2026-07-23 · #7 — Cerré SCRUM-114 fiándome de un reporte, sin verificar que el código estaba en main
**Qué pasó:** cerré el ticket SCRUM-114 (scrum47/scrum49 debían autoimponerse `WHATSAPP_DRY_RUN=1` en vez de depender de que quien invocara el test no lo olvidara) dando el fix por mergeado. La rama con el código real (`scrum-114-enviar-para-firmar-ok-false`) nunca llegó a `main`: lo único que aterrizó fue un PR ajeno de otro carril (#112, `scrum-114-runbook-falso-rojo`) que documentaba el mismo hallazgo en `docs/QA/SUITE_REGRESION.md` ("trampa 7") sin tocar una línea de código. Jira decía "Cerrada"; el repositorio decía otra cosa.
**Por qué:** di el ticket por bueno porque el relato del cierre coincidía con lo esperado (la misma causa raíz que el propio reporte ya había distinguido con detalle), sin el paso mínimo de comprobar que el commit era antepasado de `main`. Es el MISMO fallo que el incidente #1 (SCRUM-54): confiar en el reporte en vez de en el repositorio.
**Quién lo detectó:** la siguiente tarea (SCRUM-126), al tocar los mismos ficheros para unificar el shape de los endpoints de envío y encontrar que `WHATSAPP_DRY_RUN` seguía sin autoimponerse — unas 6 horas después de cerrada la 114.
**Coste:** dos tests gateados (scrum47, scrum49) quedaron frágiles frente a quien los invocara durante esas 6 horas sin que nadie lo supiera; el fix tuvo que reaplicarse dentro de SCRUM-126 en vez de tener su propio PR revisable.
**Regla derivada:** R2 (reforzada arriba con el método exacto de verificación).

### 2026-07-24 · #8 — Di por rota la vía de transferencia midiendo la PÁGINA equivocada (SCRUM-4 → SCRUM-150)
**Qué pasó:** al verificar el cobro por transferencia (SCRUM-4) reporté un 🔴 grave: *"el cliente no ve el IBAN ni la referencia — un método de cobro que no se puede completar"*. Era falso. El script medía `/pay/invoice`, que es el **selector** ("Elige cómo pagar"), donde transferencia es un **enlace**; los datos viven en `/pay/bank/:token`. Al mirar `/pay/bank`: IBAN, referencia y dos botones "Copiar", exactamente como promete N2:325.
**Por qué:** el assert estaba bien escrito y la medición era correcta — *sobre la URL equivocada*. `muestra_iban:false` era **verdad** en esa página. Nada en el resultado indicaba que la página no fuera la del flujo: un rojo bien fundado y un rojo mal dirigido se leen idénticos.
**Quién lo detectó:** yo mismo, al **abrir la captura** antes de crear el ticket 🔴. La imagen mostraba el selector con "Transferencia bancaria ›" como enlace — la medición numérica no lo mostraba y no podía mostrarlo.
**Coste:** casi se abre un 🔴 falso sobre un método de cobro (el tipo de alarma que reordena prioridades). Contenido antes de publicarse; el ticket real que salió (SCRUM-150) es un Medium de UI, no un bloqueo de cobro.
**Regla derivada — nueva:** **un assert sobre la URL equivocada es verde o rojo con la misma confianza.** La medición no valida su propio objeto: antes de fiarse de un resultado automático sobre una pantalla, hay que confirmar que es LA pantalla del flujo (una captura, el HTML, o un assert de identidad del tipo "esta página contiene el título esperado"). Aplica a todo el trabajo de guards de esta semana: un test puede estar midiendo el sitio equivocado con total seguridad.

### 2026-07-24 · #9 — Escribí en el runbook con un script y no releí el resultado (lección propia, del ejecutor)
**Qué pasó:** al añadir al runbook de QA el apunte del error `P1013` del `db push`, lo inserté con un script en vez de a mano. El texto llevaba un retorno de carro escapado; el script lo **interpretó** y partió el párrafo en tres trozos sin sentido. Se commiteó, se mergeó y **quedó así en `main`**.
**Por qué:** confundí *"el comando terminó sin error"* con *"el fichero quedó bien"*. El script imprimió `runbook actualizado` y di el trabajo por hecho — justo el hueco entre **ejecutar** y **verificar el efecto**.
**Quién lo detectó:** yo mismo, dos tickets después, al ir a añadir OTRO apunte al mismo bloque y encontrarme el párrafo roto.
**Coste:** bajo en sí (documentación ilegible unas horas), pero el patrón no lo es: es el mismo con el que se cuela una migración mal escrita o un guard que no comprueba nada.
**Regla derivada — nueva:** **una edición hecha con herramienta no está hecha hasta que se relee el resultado.** Vale para scripts de texto, `sed`/`python` sobre ficheros y cualquier generación automática: la salida del comando **no es evidencia del contenido**. Es la misma R1 que se exige a los reportes ajenos, aplicada a los artefactos propios.
**Nota:** hermana del incidente #8 (medir la página equivocada con total confianza). En los dos, la herramienta hizo su trabajo **correctamente sobre el objeto equivocado** — y no hay nada en su salida que lo delate.

### 2026-07-27 · #10 — Di un PR por entregado con el mensaje del push, y la rama no estaba en GitHub (lección propia, del ejecutor)
**Qué pasó:** arreglé el rojo de `main` (migración de `scrum51` a `withMerchant`), hice `git push`, y la salida fue la de siempre: `remote: Create a pull request...`, `* [new branch] fix-main-scrum51-fixtures -> fix-main-scrum51-fixtures`, **exit 0**. Reporté el trabajo como entregado con su link de compare. El fundador fue a abrirlo: **404**, y la rama no aparecía en la lista de PRs. `main` seguía en rojo.
**Por qué:** confundí *"el comando dijo que salió bien"* con *"el resultado está en el remoto"*. Al comprobarlo, `git ls-remote --heads origin fix-main-scrum51-fixtures` no devolvía **nada**: la rama no existía. Un segundo push idéntico sí la creó. No sé por qué se perdió el primero — y ese es justo el punto: **no hace falta saberlo para que el método sea obligatorio**, porque el fallo es indistinguible del éxito en la salida del comando.
**Quién lo detectó:** el fundador, al abrir el link que yo le di.
**Coste:** `main` en rojo más tiempo del necesario, con el resto del equipo trabajando sin red y cada merge nuevo heredando el fallo — mientras el arreglo parecía entregado.
**Regla derivada:** R2, **ampliada con el eslabón del push**. Lo que ya se exigía para el merge (`merge-base --is-ancestor`) vale igual para el push (`ls-remote`): son los dos sitios donde el trabajo puede quedarse por el camino con un mensaje de éxito por delante. **Un mensaje de éxito no es evidencia de éxito.**
**Nota:** es exactamente el patrón de los incidentes #8 y #9 —la herramienta informa bien de una operación que no produjo el efecto esperado— pero cometido sobre lo más básico del flujo: entregar. Los tres comparten que la salida del comando no habla del estado del mundo, solo de sí misma.

**Tercera variante, el mismo día y la más útil de las tres — un falso "NO está":** horas después, comprobando si `.github/workflows/ci.yml` había llegado a `main`, `git cat-file -e origin/main:.github/workflows/ci.yml` respondió que **no existía**. Era falso: el fichero estaba. El comando iba encadenado justo detrás de un `git fetch origin main` en la misma línea, y `origin/main` —que es un **alias local**, no el remoto— todavía apuntaba al estado anterior. Se resolvió preguntando por SHA explícito (`MAIN=$(git rev-parse origin/main)` y luego `git show "$MAIN:<ruta>"`), que dio la respuesta correcta.

Lo que la hace la más útil: las dos primeras variantes fallaban hacia *"parece entregado y no lo está"*; esta falla hacia *"parece que falta y ya estaba"*, y su coste es **rehacer trabajo hecho** o contradecir a quien tenía razón (aquí, un compañero que decía que el fichero ya estaba en `main` — y lo estaba). **La lección completa: resolver el SHA primero, consultar por SHA, y no fiarse de alias.**

### 2026-07-27 · #11 — Retiré 37 worktrees con la orden correcta y vacié el `node_modules` de TODO EL EQUIPO (lección propia, del ejecutor)

**Qué pasó:** con el GO del fundador para retirar los worktrees ya mergeados, corrí `git worktree remove` sobre 37 de ellos. Cada worktree lleva dentro un **junction de Windows** (`mklink /J node_modules → <repo>/node_modules`) para no duplicar 271 paquetes por copia. `git worktree remove` **entró por el enlace y borró el contenido del destino**: el `node_modules` compartido quedó con 0 ficheros. Ningún comando falló; los 37 dijeron OK.

**El daño real no fue mío:** ese `node_modules` lo comparten TODAS las sesiones por junction. Cualquiera que estuviera compilando o corriendo tests en ese momento se encontró un repo sin dependencias, sin haber tocado nada. Es la primera de estas lecciones cuyo coste cae **sobre terceros**.

**Detectado:** al minuto siguiente, al ir a medir para SCRUM-162 y no resolverse `@prisma/client`. Restaurado con `npm ci` + `npx prisma generate` (271 paquetes, build y suite en verde otra vez).

**Verificado, no supuesto:** se reprodujo con un destino de juguete — worktree desechable + junction a una carpeta con un fichero marcador → `git worktree remove` → **el marcador desaparece**. Y se comprobó el orden correcto en el mismo experimento: `rmdir <enlace>` primero (borra el ENLACE, no el destino: el marcador sobrevive) y `git worktree remove` después. Las dos mitades, provocadas.

**Regla derivada — nueva:** **antes de retirar un worktree, deshacer sus enlaces.** Un junction no es una carpeta del worktree: es una puerta a algo compartido, y las herramientas de borrado recursivo no distinguen. Orden obligatorio:

```bash
cmd //c "rmdir D:\ruta\al\worktree\node_modules"   # quita el ENLACE (no el destino)
git worktree remove ../wt-loquesea                 # ahora sí
```

**Nota:** hermana de #8 y #9 —la herramienta hizo su trabajo correctamente sobre un objeto que no era el que yo creía— pero con una vuelta de tuerca: aquí el objeto equivocado **no estaba a la vista**. Lo que se ve es una carpeta del worktree; lo que se borra está al otro lado del enlace, fuera de él. Cuando una operación de borrado toca algo compartido, el radio de la acción es mayor que el de la carpeta que se nombra en el comando.

### 2026-07-27 · #12 — Probé un guard fiscal en rojo con el caso equivocado, y el verde me habría dado por seguro (lección propia, del ejecutor)

**Qué pasó:** en SCRUM-178 (emisión manual de factura) escribí un assert para proteger la regla de SCRUM-141 —el importe emitido sale de las LÍNEAS, no del campo `total` guardado del presupuesto—. Para probarlo en rojo, monté un presupuesto cuyo `total` guardado estaba desfasado **5 €** respecto a sus líneas y devolví el código al comportamiento malo. **El test siguió en verde.**

**Por qué:** `reconcileToTarget` solo busca el cuadre dentro de una ventana de **±0,05 €** de base. Un hueco de 5 € es inalcanzable: la función se rinde y devuelve las líneas intactas, así que el comportamiento malo daba el mismo resultado que el bueno. Mi caso de prueba era **tan grave que caía fuera del mecanismo que quería vigilar**.

**Lo peligroso no es el caso grande: es el pequeño.** Con un desfase de **3 céntimos** —dentro de la ventana— el código malo sí actúa: toca el precio de la última línea para cuadrar con una cifra vieja, el importe emitido pasa de 134,27 € a 134,30 €, y **eso queda sellado en la huella VeriFactu**, que solo se corrige con una R1 (regla 29). Con 3 céntimos el rojo salió a la primera.

**Quién lo detectó:** yo mismo, al no ver el rojo que esperaba. El fallo habría sido invisible al revés: si no llego a probarlo en rojo, tenía un assert verde sobre un código correcto y **habría reportado que la regla estaba protegida**.

**Regla derivada — nueva:** **el caso de prueba tiene que caer DENTRO del mecanismo que se vigila.** Un desvío enorme suele salirse de los márgenes, las tolerancias y las ventanas de la función que se quiere probar, y entonces el guard no distingue nada. Al inyectar una regresión hay que preguntarse *¿este valor activa de verdad el camino malo?* — y si el rojo no sale, la primera hipótesis no es «el guard sobra», es «el caso está mal elegido».

**Nota:** es la vuelta de tuerca de la regla de la casa (*todo guard se prueba fallando primero*). Probar en rojo no basta si el rojo se busca con el caso equivocado: **un test que falla con el caso equivocado da falsa tranquilidad**, y en zona fiscal la falsa tranquilidad se sella en una cadena de huellas inmutable. Hermana de #8 —medir la página equivocada con total confianza—, pero sobre el propio mecanismo de verificación.

### 2026-07-27 · #13 — Verifiqué las piezas del job de CI en los dos sentidos y nunca ejecuté el job (lección propia, del ejecutor)

**Qué pasó:** entregué SCRUM-168 (aviso «este PR toca la zona roja») con el detector verificado a conciencia — los dos sentidos con datos reales, el test de deriva doc↔código probado en rojo. El PR salió con el check **en ROJO a los 7 segundos**. El job moría en `git fetch origin "$BASE" --depth=0`, que **no es un flag válido** (`fatal: depth 0 is not a positive number`, exit 128): el paso reventaba ANTES de ejecutar el detector. El job nunca llegó a mirar si había zona roja. Lo detectó el fundador al abrir el PR.

**Por qué:** verifiqué todas las piezas y ninguna la de arriba. El detector es código y lo ejercité; el workflow es **una hipótesis escrita en YAML que nunca se ejecutó**, y su primer intento de correr fue en producción, sobre el PR del propio ticket. Escribí en su cabecera que el job «sale verde siempre» sin haber visto salir verde a nada.

**El segundo error, de concepto:** puse `continue-on-error: true` creyendo que garantizaba el verde. **No hace eso.** Evita que falle el *workflow*; el job sigue apareciendo con su aspa roja en la lista de checks del PR. Confié en un ajuste por lo que sugería su nombre. Y para un aviso eso no es un detalle: **un check rojo es un gate de facto**, y como `package.json` y `YAQU_MASTER.md` son zona roja por definición, habría acabado en rojo casi permanente — justo lo que el ticket existía para evitar.

**El tercero, y el más humillante:** el test que escribí para que `--depth=0` no volviera **falló contra la prosa de su propio comentario** — el literal aparece en la cabecera donde explico que no se use. Es, calcado, el bug de **SCRUM-176**, cometido el mismo día, en el ticket de al lado, por quien acababa de arreglarlo. Arreglado igual: mirar solo las líneas ejecutables.

**Coste:** bajo (un check rojo en un PR sin mergear), pero el patrón no: un aviso que se pinta rojo se acaba desactivando, y entonces no avisa de nada el día que importa.

**Regla derivada — nueva:** **un artefacto de CI no está entregado hasta que se le ha visto ejecutar.** Vale para workflows, hooks y cualquier cosa cuyo entorno de ejecución no sea la máquina donde se escribe. Si no se puede lanzar de verdad, se ejecuta su lógica **paso a paso en local con las mismas variables** antes de empujar — que es lo que hice al arreglarlo, y lo que habría cazado el fallo en dos minutos. Verificar los componentes no es verificar el sistema: **el pegamento también es código, y es donde estaba el fallo.**

**Nota:** es la familia de #8, #9 y #10 (confiar en lo propio), con una vuelta más: allí la herramienta hacía su trabajo sobre el objeto equivocado; aquí directamente **no llegué a ejecutar el objeto**, y el resto de verificaciones —reales y buenas— me dieron la sensación de haberlo hecho.

### 2026-07-29 · #15 — Tres guards correctos por separado produjeron juntos un estado que ninguno contemplaba (lección propia, del ejecutor)

> **Nota de numeración:** salta el **#14**, que existe en una rama sin mergear (`docs(errores-asesor): #14 la fuga de credencial + R7`). Se deja su hueco a propósito para que las dos entradas no colisionen al entrar. Misma razón para usar **R8** y no R7.

**Qué pasó:** tres tickets seguidos de la cadena fiscal añadieron, cada uno, un motivo por el que una factura **se excluye** del registro VeriFactu en vez de declararse mal:

- **SCRUM-209** — un tramo de IVA que no se puede calificar con certeza (el 0 %).
- **SCRUM-215** — una factura sin destinatario identificado, mientras no haya dictamen.
- **SCRUM-216** — una rectificativa cuyo tipo (`S`/`I`) no está confirmado.

Los tres son correctos. Los tres tienen sus tests, probados en rojo. Los tres se revisaron con su diff delante y **ninguno estaba mal**.

Juntos producen un estado que no está en el alcance de ninguno: **un ejercicio en el que TODAS las facturas caen en alguna de las tres exclusiones genera un envelope con la cabecera y CERO `RegistroFactura`** — y eso **no valida** contra el esquema, que exige al menos uno (`Missing child element(s)`). O sea: tres mecanismos construidos para no emitir un documento inválido acabaron, entre los tres, emitiendo uno.

**Y no es un caso de laboratorio.** En el vertical de oficios el cliente sin NIF es lo normal, así que un merchant cuyo ejercicio sean todo facturas a particulares cae **entero** en la exclusión de SCRUM-215. No hace falta una combinación rara: basta un fontanero con un año normal.

**Por qué:** cada ticket revisó **su** diff y **sus** tests, que es lo correcto y no habría bastado en ningún caso. El defecto no está *en* ninguno de los tres: está en su **composición**. El estado «no queda nada que declarar» no aparece en el alcance de ninguno, así que ningún test lo cubría — y un diff no lo enseña, porque no hay ninguna línea equivocada que mirar.

**Quién lo detectó:** `npm test` **completo**. Y de la forma más indirecta posible: cayó un test de **otro** ticket (`SCRUM-209 · una rectificativa (importes en negativo) SÍ se clasifica y valida`) por un motivo que **no tenía nada que ver con su tema** — no fallaba la clasificación del desglose, fallaba que ya no había registro que validar. Ese «un test ajeno cae por un motivo que no es el suyo» fue toda la señal.

**Lo que lo hace peligroso:** los tres guards siguen en verde mientras el sistema entrega un documento inválido. No hay ningún rojo que apunte al problema, porque **cada pieza está haciendo exactamente lo que se le pidió**. Es el primo del #12 —el caso de prueba fuera del mecanismo— pero una capa más arriba: aquí el caso de prueba está *dentro* de cada mecanismo y *fuera* de todos a la vez.

**Arreglado:** sin registros no se entrega documento — el servicio devuelve vacío, el ZIP no adjunta el fichero de ese ejercicio y el endpoint suelto responde `409` con los motivos de cada exclusión. Entregar un XML inválido es lo que la cadena entera venía a evitar; entregarlo en silencio, peor.

**Regla derivada: R8** (arriba, en LAS REGLAS).

---

## PATRÓN COMÚN (lo que de verdad hay que corregir)

**Ocho de los diez incidentes son la misma cosa: afirmar el estado del mundo sin comprobarlo.** Un reporte, un síntoma, una suposición, una ausencia de mención o **la salida de un comando** se convirtieron en "esto es así" — y de ahí salieron tickets con prioridad alta, tareas manuales para el fundador, un ticket cerrado en falso y `main` en rojo mientras el arreglo parecía entregado.

Son #1, #2, #3, #4, #7, #8, #9 y #10. Los otros dos (#5 y #6) son de otra familia: **actuar sin anticipar** — repartir tres sesiones sobre una BD sin turnos, y proponer los worktrees *después* de que dos sesiones se pisaran. Ahí el fallo no fue creerse algo, fue no haberlo pensado antes.

**Los posteriores han abierto dos familias más, y conviene no meterlas en el saco de la primera:**

- **#12 y #13 — verificar de verdad, pero el objeto equivocado.** Un guard probado en rojo con un caso que caía *fuera* del mecanismo que vigilaba, y un job de CI cuyas piezas se comprobaron una a una sin ejecutarlo nunca. Aquí sí se comprobó; lo que falló fue **sobre qué**.
- **#15 — composición.** Tres guards correctos, cada uno medido y probado en rojo, que **juntos** producen un estado que ninguno contempla. Es la primera vez que el defecto no está en ninguna pieza: está entre ellas. No se caza leyendo diffs —no hay línea mala que leer— sino **corriendo la suite entera** y desconfiando cuando cae un test ajeno por un motivo que no es el suyo.

Esa última es la que más cuesta ver, porque **todos los indicadores están en verde mientras el sistema hace algo mal**: cada mecanismo está cumpliendo exactamente su encargo.

### La evolución importa: el objeto de la confianza se ha movido

- **#1 a #7 — confiar en lo AJENO.** Un reporte del ejecutor, un panel que no se abrió, un síntoma de email, el estado de un ticket en Jira.
- **#8, #9 y #10 — confiar en lo PROPIO.** Un assert que medía la página equivocada, un script que dijo "actualizado" y partió el párrafo, un `git push` que imprimió `* [new branch]` y no dejó la rama en el remoto.

Los tres últimos son peores de detectar, porque **la herramienta hizo su trabajo correctamente sobre el objeto equivocado** y no hay nada en su salida que lo delate. Un rojo bien dirigido y uno mal dirigido se leen idénticos; un push que salió y uno que no, también.

De ahí la formulación que los cubre a todos: **un mensaje de éxito no es evidencia de éxito.** Hay que preguntarle al sitio donde debería estar el resultado (`ls-remote`, `merge-base`, releer el fichero, abrir la captura), no al proceso que dice haberlo puesto.

**Lo que funciona como red:** en los diez casos alguien fue a mirar y lo corrigió — el carril B, el fundador, o el propio ejecutor un rato después (#8 y #9 se autodetectaron; #10 lo pilló el fundador al abrir el link). Los ejecutores verifican porque el código no les deja mentir; el asesor no tiene ese freno y debe imponérselo. **Y como enseña #10, tener ese freno para el código no basta: el ejecutor también da por hecho lo que sus propias herramientas le dicen.**

**Corolario para el fundador:** cuando alguien —asesor o ejecutor— afirme algo con seguridad sobre el estado del sistema, es legítimo preguntar *"¿lo has comprobado o lo estás deduciendo?"*. Esa pregunta habría evitado seis de estos diez. Para los tres de herramienta propia, la versión útil es otra: *"¿has mirado el resultado, o solo que el comando no diera error?"*.
