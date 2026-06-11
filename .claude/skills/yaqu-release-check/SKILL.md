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
