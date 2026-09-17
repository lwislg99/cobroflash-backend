# LÍMITES DEL FUNDADOR — decisiones dichas, nunca escritas

Estas decisiones las tomó el fundador de viva voz. No están en el máster ni en las
normas, y por eso se pierden en cada traspaso. No se relajan sin que él lo diga
otra vez, y «no lo veo escrito» no es motivo para saltárselas.

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

Lo que NO está delegado y vuelve siempre a él: coste nuevo o dependencia nueva
(regla 36), cualquier cosa que toque dinero o el camino fiscal (regla 38), y
cualquier cambio de infraestructura de producción.

## El objetivo vigente (17-sep-2026, de viva voz)

**Producto y automatización A LA VEZ, los dos a fuego.** Sus palabras: «quiero en paralelo avanzar a
fuego con el producto ya, a fuego con la automatización, ya que nos quitará trabajo. Si hay algo que
nos bloquea lo solucionamos al momento y me lo dices».

- S0-S4 van a producto, cada una en su carril. La S5 va SOLO a automatización.
- La automatización NO se da por cerrada (eso lo había decidido el orquestador el 16-sep, y queda
  retirado). Su horizonte incluye que **el orquestador arranque solo por la mañana y hable con las
  sesiones sin que el fundador copie y pegue**, además del bucle PR → CI → merge → aviso.
- Un bloqueo no se aparca en silencio: se resuelve al momento y se le dice qué bloqueaba.

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

## Las normas de Javier (el colaborador)

- ① decisión → ② ALTER aditivo en las TRES bases → ③ un solo PR. **Nunca ③ sin ②.**
- Nunca `db push` contra producción. El DDL sale de `prisma migrate diff`.
- Toda verificación lleva **dos controles de tipo distinto** más `current_database()`.
- «Un merge SIN CONFLICTOS no es un merge correcto.»
- «Mergear ya no es acabar: un ticket no está cerrado hasta que su despliegue está verde.»
