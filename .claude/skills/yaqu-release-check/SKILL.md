---
name: yaqu-release-check
description: Cierre de sprint de YaQu (protocolo AA1.7) — QA del sprint, docs actualizados, done/evidencias en la Parte U y actualización del master. Usar cuando un sprint del registry está listo para cerrarse o el usuario invoque /yaqu-release-check.
---

# /yaqu-release-check — Cierre de sprint (AA1.7)

> Derivado de `docs/YAQU_MASTER.md` Parte AA (regla 35). Si esta skill y el master
> divergen, gana el master.

## Checklist de cierre (todo debe estar ✅ antes de declarar el sprint cerrado)

1. **QA del sprint.** Ejecutar los checks de `docs/QA_MASTER.md` que apliquen al sprint
   (la Parte Q define los bloques; el E2E crítico es release blocker). `npm test` en verde.

   **1-bis. Evidencia de la tanda gateada (SCRUM-161) — 🔴 HOY NO BLOQUEA:**

   ```bash
   node scripts/verificar-evidencia-tanda.mjs
   ```

   Comprueba que `npm run test:staging:gated` corrió **contra este mismo commit**, hace menos
   de 24 h, **en verde** (los tres hijos a exit 0) y **entera** (no un fichero suelto). La
   evidencia es un recibo que escribe el propio runner, no una respuesta que se teclea.

   **Está APAGADO a propósito** (`ACTIVO = false` en `scripts/_evidencia-tanda.mjs`): la tanda
   todavía no está verde, y exigir evidencia hoy obligaría a adjuntar una tanda ROJA — o
   bloquea a todo el mundo, o enseña a adjuntar rojos. Mientras esté apagado **imprime el
   veredicto y sale 0**: léelo igualmente, porque dice exactamente lo que exigirá el día que se
   encienda. Se enciende cuando la tanda esté verde o cada rojo tenga ticket y cuarentena
   (SCRUM-160); es cambiar una línea.

   ⚠️ **Alcance, para no leerlo por más de lo que es:** es un guard contra el **OLVIDO, no
   contra la mala fe** — nada impide borrar o editar el recibo a mano. Y **NO sustituye a un
   CI** de los gateados (que no existe: `DATABASE_URL_TESTS` no entra en GitHub Actions,
   regla 9). Sustituye al descuido, que es el fallo que de verdad ocurre.

2. **Verificación en producción.** Los flujos tocados verificados en **yaqu.app**
   (no localhost), idealmente desde móvil si el sprint toca landing o WhatsApp.
3. **Docs actualizados.** Los docs operativos afectados reflejan la realidad:
   `docs/RUNBOOKS.md` · `docs/QA_MASTER.md` (añadir los checks nuevos del sprint — la
   Parte Q crece por sprint) · `docs/BUGS.md` (bugs del sprint cerrados o registrados) ·
   `docs/MIGRATIONS_PENDING.md` si hubo db push · `docs/WHATSAPP_TEMPLATES.md` si se
   tocaron plantillas.
4. **Done + evidencias en U.** En `docs/YAQU_MASTER.md` Parte U: marcar el done de la fila
   con motivo/evidencias (capturas, IDs, docs de evidencia que pida la tarea, p. ej.
   `EVIDENCIAS_E2E.md`, `VERIFACTU_EVIDENCIAS.md`). **✅ con motivo; nunca borrar filas
   ni reescribir historia.**
5. **Master actualizado.** Si el sprint reveló necesidad de cambios de spec → propuesta
   de cambio de master al fundador (nunca editarlo de tapadillo). CLAUDE.md y `.claude/*`
   se regeneran del master si la Parte AA cambió (regla 35).
6. **Flags.** Estado final de los flags del sprint documentado (tabla P): qué quedó ON/OFF
   y por qué. Cambios de flag global = stop condition (OK del fundador).

## Resultado
Resumen final al fundador: qué se cerró, evidencias, qué queda pendiente (humano o
bloqueado), y cuál es el siguiente sprint según la cola U.
