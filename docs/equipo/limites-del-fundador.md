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

## Cómo quiere trabajar

- Bloque de merge SIEMPRE primero, antes de los prompts.
- Enlace directo y clicable a cada PR, dentro de un bloque de código.
- En cada PR, si la rama se borra o no.
- Jira mirado CADA turno, y dicho explícitamente aunque no se pueda cerrar nada.
- Prompt para TODAS las sesiones cada turno, incluidas las que no tienen novedad.
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
