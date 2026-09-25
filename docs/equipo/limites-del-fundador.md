# LÍMITES DEL FUNDADOR — decisiones dichas, nunca escritas

Estas decisiones las tomó el fundador de viva voz. No están en el máster ni en las
normas, y por eso se pierden en cada traspaso. No se relajan sin que él lo diga
otra vez, y «no lo veo escrito» no es motivo para saltárselas.

## 🔴 Desde el 18-sep-2026: los límites de los DOS JEFES

**Decisión del fundador (18-sep-2026 ~11:50Z):** Luis y Javier son los dos jefes. Desde ese día:

- **Donde este fichero dice que algo «vuelve al fundador» o que «el sí lo escribe el fundador», vale
  cualquiera de los dos jefes.** Cada jefe habla con SU orquestador (`dos-equipos.md`).
- **Las decisiones de abajo siguen en vigor** tal como están escritas: el cambio es quién puede dar un sí,
  no lo que ya se decidió. Si un jefe puede cambiar una decisión que tomó el otro está **PENDIENTE** de
  decidir (`dos-equipos.md` §1); mientras tanto, una decisión escrita solo la cambia quien la tomó.
- **Una decisión nueva se escribe con quién la tomó y la fecha** («Javier, 20-sep-2026: …»). La escribe el
  orquestador de Luis, dueño de este fichero; el de Javier se la pasa por Jira (`dos-equipos.md` §3.3 y §5).
- La **delegación permanente** de más abajo la dio el fundador a su orquestador. Si Javier delega lo mismo en
  el suyo, se escribe aparte, con su fecha: no se supone.

## Seguridad y secretos

- La credencial de staging que quedó expuesta **NO se rota**. Decisión suya,
  consciente, como fundador. No se vuelve a proponer.
- Las variables `VERIFACTU_PRODUCTOR_*` **se quedan en Railway**, aunque hoy no
  las lea nadie. «Por si se usan en un futuro.»
- **NUNCA se pega en el chat una cadena de conexión, un usuario o una contraseña.
  Ni real ni de ejemplo.** Solo resultados de consultas. Ninguna sesión escribe,
  imprime ni inventa una cadena de conexión con forma realista en ningún sitio.
- Una sesión **no toca el `.env` de otro worktree**. Nunca.
- El secreto del webhook de Resend va del panel de Resend **directamente a
  Railway**, sin pasar por el chat.
- La clave privada `.pem` y el token `sk-ant-oat` **no se pegan jamás en el chat**,
  y el `.pem` se borra de Descargas después de usarlo.
- Ninguna clave de Stripe se escribe en ningún sitio, ni real ni de ejemplo.
- `assertSafeStagingUrl` es una lista blanca de hosts y es **fail-closed. No se
  relaja.**

## Datos

- **Todos los datos de producción de hoy son de prueba. No hay merchants reales.**
  Eso es lo que hace que decisiones como «mover la infraestructura» sean baratas
  hoy y caras mañana — y lo que hace que la mayoría de hallazgos NO tengan víctima
  todavía (regla 37).
- Las facturas antiguas de producción no representan a ningún cliente real.

## Delegación permanente

El fundador ha delegado, por escrito y de forma permanente:

- **Los textos de microcopy que haya que aprobar los aprueba el orquestador**
  (dentro de la regla 30: siguen sin poder inventarse a nivel de sesión).
- **Lo que sea claramente decisión del orquestador, la toma el orquestador** y le
  dice qué ha decidido, en vez de devolverle la pregunta.
- Sus palabras: «todo lo que dices que es mío decídelo tú si puedes».

**Javier, 25-sep-2026:** los textos de microcopy que haya que aprobar los aprueba **su**
orquestador (dentro de la regla 30: siguen sin poder inventarse a nivel de sesión). Referencia:
SCRUM-1121. Delegación aparte de la de Luis (línea de arriba): dos jefes, dos delegaciones
distintas, nunca una sola frase para las dos.

Lo que NO está delegado y vuelve siempre a él: coste nuevo o dependencia nueva,
el camino de emisión fiscal y cualquier cambio de infraestructura de producción (la regla 36 del máster es otra cosa: plugins, skills y hooks de terceros; y la 38 dice que un test que solo LEE el camino fiscal NO es STOP. Estas reservas vienen de las STOP CONDITIONS de CLAUDE.md y de lo que el fundador ha dicho; se citaban mal, lo cazó la auditoría de la Sesión 0 del 17-sep).
El dinero tiene un matiz desde el 17-sep: ver «Delegaciones del 17-sep-2026».

## El objetivo vigente (17-sep-2026, de viva voz)

**Producto y automatización A LA VEZ, los dos a fuego.** Sus palabras: «quiero en paralelo avanzar a
fuego con el producto ya, a fuego con la automatización, ya que nos quitará trabajo. Si hay algo que
nos bloquea lo solucionamos al momento y me lo dices».

- S0-S4 van a producto, cada una en su carril. La S5 va SOLO a automatización.
- La automatización NO se da por cerrada (eso lo había decidido el orquestador el 16-sep, y queda
  retirado). Su horizonte incluye que **el orquestador arranque solo por la mañana y hable con las
  sesiones sin que el fundador copie y pegue**, además del bucle PR → CI → merge → aviso.
- Un bloqueo no se aparca en silencio: se resuelve al momento y se le dice qué bloqueaba.

## Qué es YaQu (17-sep-2026, de viva voz)

**YaQu ES un software de gestión completo —un ERP— para oficios, empresas y autónomos, y quiere abarcarlo
todo.** Sus palabras: «el máster está antiquísimo, claramente somos un ERP; por una norma de no borrar nada
del máster hay cosas mega antiguas». El veto «YaQu NO es un ERP ni un CRM» (Parte Z del máster, repetido en
la skill `cerebro-yaqu`) **queda RETIRADO por el fundador**. Hasta que se cambie el máster manda esta línea,
y cambiarlo es una propuesta de cambio de máster pendiente.

## Delegaciones del 17-sep-2026

- **El visto bueno de arreglos de producto que tocan el cobro lo da el orquestador** («tú eres jefe de
  producto, dalas tú»). ⚠️ **Medido el mismo día:** cuando ese visto bueno significa DESPLEGAR a producción (PR
  con auto-merge), el clasificador de permisos no deja al orquestador darlo por el canal. **El sí lo escribe el
  fundador en el chat de la sesión**; el orquestador lo prepara y se lo explica (`orquestador-autonomo.md` §7).
- **Sigue siendo suyo:** coste nuevo, infraestructura de producción, schema (con Javier), el camino de emisión
  FISCAL y los permisos de Claude Code.
- **Permiso acotado para SCRUM-899 (sesiones de prueba `control-899-*` y tareas programadas de un solo uso):
  autorizado por él.** La regla la pone él a mano, porque al orquestador se le bloquea tocar la configuración.

## El horario del equipo (17-sep-2026)

«Que el equipo arranque por la mañana y haga varias tandas al día, cuando haya uso de nuevo.» Provisional:
cron del orquestador **a las 8:57, 13:57 y 18:57** todos los días (`orquestador-autonomo.md` §2, F5). Lo
robusto está en SCRUM-899.

## Cómo quiere trabajar

- El cuadro del bucle SIEMPRE primero, antes de los prompts (sustituye al «bloque de merge»:
  desde el 9-sep el merge es automático). Y **lo que tiene que hacer él, SIEMPRE AL FINAL** del
  mensaje, después de los prompts (17-sep-2026).
- Enlace directo y clicable a cada PR, dentro de un bloque de código.
- «¿Se borra la rama?» solo para un PR que se cierra SIN mergear, y ahí NO se borra
  (`orquestador.md` §10.3). Al mergear se borran solas.
- Cada ticket a la sesión de SU puesto, nunca a la que esté libre (17-sep-2026: «la 5 es
  automatización, eso es raro»; tabla en `orquestador.md` §11bis).
- Jira mirado CADA turno, y dicho explícitamente aunque no se pueda cerrar nada.
- Prompt SOLO para las sesiones que han contestado ese turno; las que siguen ejecutando no
  reciben nada (lo retiró el 15-sep-2026; ver `orquestador.md` §10.6).
- Cada prompt dice ARRIBA, en claro, si va a una **conversación nueva** (y en qué carpeta) o a
  la **misma conversación** (16-sep-2026: «abre una sesión nueva y mándaselo, más claro»).
- Todo lo que vaya a una sesión, dentro del bloque de código y COMPLETO: sin
  huecos que él tenga que rellenar.
- Los pasos manuales, de UNO EN UNO. Nunca una lista.
- Lo que no conoce, explicado «para tontos», sin dar contexto por sabido.

## Las normas de Javier (jefe desde el 18-sep-2026; antes, «el colaborador»)

- ① decisión → ② ALTER aditivo en las TRES bases → ③ un solo PR. **Nunca ③ sin ②.**
- Nunca `db push` contra producción. El DDL sale de `prisma migrate diff`.
- Toda verificación lleva **dos controles de tipo distinto** más `current_database()`.
- «Un merge SIN CONFLICTOS no es un merge correcto.»
- «Mergear ya no es acabar: un ticket no está cerrado hasta que su despliegue está verde.»
