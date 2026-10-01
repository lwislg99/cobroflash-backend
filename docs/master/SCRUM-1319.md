# SCRUM-1319 · La línea de progreso de SIF-1 en el máster decía «S1-D ✅» y no lo está

**Medido contra:** `origin/main` = `e9e71cab67574538943cd94392bdecf5f3dcbfa2` · 2026-10-01T01:22:26Z

A9: aviso → A10 «Un dato copiado de un registro lleva la fecha en que se midió, no la de hoy.» — no se pudo comprobar: ningún guard coteja la línea de progreso del máster con el árbol, y escribir uno es un test nuevo que este ticket (dos cambios en una línea) no autoriza; queda propuesto en §Ⓔ.

Sesión J5, por encargo del orquestador del equipo de Javier (`cobroflash-backend-5b`).

**La autorización.** Es un cambio de máster. El ticket SCRUM-1319 cita al fundador, el 1-oct-2026:
«5-Sí te autorizo». **Yo no se lo he oído a Javier:** lo leo en la descripción del ticket, escrita por
el orquestador, y Jira publica todo bajo la cuenta de Javier. Lo digo para que conste de dónde sale.
El cambio va por PR y no entra en `main` sin pasar por él.

## Ⓐ Qué se ha cambiado

**Una línea de `docs/YAQU_MASTER.md`, la 962** (Parte U, el resumen de SIF-1 de U1.3), y nada más.
Dos tramos de esa línea:

| tramo | decía | dice |
|---|---|---|
| **S1-0** | «falta alta en el entorno de pruebas AEAT + cita asesor» | eso mismo **tachado**, y a continuación: alta en el entorno de pruebas ✅ 24-sep-2026 (SCRUM-1110); falta la cita con el asesor, que el fundador fijó el 1-oct-2026 para las dos semanas siguientes (SCRUM-1264) |
| **S1-D** | «S1-D ✅ DECIDIDO 2026-09-16 (fundador): la representación…» | «S1-D ~~✅~~ 🟡 NO HECHO — la VÍA está DECIDIDA 2026-09-16 (fundador): la representación…», con la decisión **entera y sin tocar**, y una nota fechada que dice qué marcaba el ✅ y qué falta |

**No se ha borrado nada.** Lo que deja de valer queda tachado, que es como el máster ya marca lo
superado (la línea 959 lo hace con el justificante). **No se ha inventado ningún estado:** S1-D pasa a
🟡, que la misma línea ya usa en S1-0, S1-E y S1-H. No se ha tocado ningún otro hito ni ninguna otra
línea de la Parte U.

## Ⓑ El control que pedía el ticket

**Leída de corrido, la línea ya no dice que SIF-1 vaya por 4 de 8.** El estado que queda pegado a cada
hito, sacado con `grep` de la línea ya cambiada:

```
S1-0 🟡 · S1-0b ✅ · S1-A ✅ · S1-B ✅ · S1-C ✅ · S1-D ~~✅~~ 🟡 NO HECHO · S1-E 🟡 · S1-F ⏳ · S1-G ⏳ · S1-H 🟡
```

De los ocho hitos con letra (A a H), llevan ✅ **tres**: A, B y C.

**No se han movido líneas**, y está medido, no supuesto:

| | antes | después |
|---|---|---|
| saltos de línea del fichero | 1886 | 1886 |
| retornos de carro | 0 | 0 |
| `git diff --numstat` | — | 1 añadida, 1 quitada |
| tramo del diff | — | `@@ -962 +962 @@` |

## Ⓒ Las mediciones que sostienen cada palabra nueva

1. **«`enviarSobre` no tiene ningún llamador en `src/`».** `git grep "enviarSobre(" origin/main -- src`,
   quitando comentarios, da **una** línea: su definición, en `src/modules/fiscal/verifactu/sif.client.ts`.
   Las otras dos apariciones del nombre son comentarios de `sif.procesador.ts`.
2. **«Su Done es ≥10 registros (alta/anulación/R1) aceptados consecutivos».** Es el texto de la línea
   1042 del mismo máster, el criterio de S1-D.
3. **«hay 3 aceptados en pruebas».** Los tres códigos de la AEAT que constan en el repositorio como
   aceptados: `A-KR84MFNPTPDHMN` (24-sep, `EstadoEnvio: Correcto`, en `docs/master/SCRUM-1110.md`) y
   `A-SAQQXM7MXBDX3L` (27-sep) y `A-ALQ5VMP5QV7QLQ` (28-sep), «dos sondas aceptadas», en
   `docs/master/SCRUM-1296.md`. Población: buscando el patrón de esos códigos en `docs/` salen **5**
   distintos; los otros dos (`A-RRC3W7HBRRATXM`, `A-RWSKNNRGRBNNS9`) son intentos anteriores con
   `AceptadoConErrores`, y no se cuentan.
4. **«alta en el entorno de pruebas ✅ 24-sep-2026 (SCRUM-1110)».** El título de ese expediente es
   «S1-0 hecho», y su apéndice del 24-sep recoge la primera respuesta `Correcto` de la AEAT.
5. **«el fundador fijó la cita el 1-oct-2026 para las dos semanas siguientes».** SCRUM-1264,
   comentario 17682, que cita al fundador: «3-Cita con el asesor en las proximas dos semanas».

## Ⓓ Lo que NO he escrito en el máster, y por qué

El ticket traía tres cosas que no he podido sostener tal cual, y no han entrado en la línea:

1. **«antes del 15-oct-2026».** Es una cuenta del orquestador (1-oct más dos semanas), no la frase del
   fundador. En el máster va lo que dijo: dos semanas desde el 1-oct. Un número derivado no se
   escribe en la fuente de verdad como si fuera el dato.
2. **«los tres subidos a mano por el fundador desde el navegador».** Para el primero lo dice
   `SCRUM-1110.md`. Para los del 27 y el 28-sep, `SCRUM-1296.md` solo dice «dos sondas aceptadas».
   **No lo he comprobado y no lo afirmo.**
3. **Que los tres sean «consecutivos», o de qué clase son (alta, anulación o R1).** No lo he medido.
   La línea dice solo «3 aceptados en pruebas», frente a un criterio de diez.

Y una cosa que el ticket señala y **no se ha tocado, a propósito**: el cabo de S1-C. La línea 1041
dice que la huella de anulación está «implementada [VALIDAR vector en pruebas]». Cambiar el estado de
S1-C es otro hito, y el ticket prohíbe tocar otro. Queda dicho aquí.

## Ⓔ Propuesta, sin construir

La línea 962 es un resumen escrito a mano de lo que dicen las líneas de detalle de U1.3, y se quedó
vieja dos veces sin que nada avisara. Un guard podría exigir que un hito no lleve ✅ en el resumen si
su línea de detalle no lleva «DONE». **Es un test nuevo y una decisión sobre el máster:** no entra en
este ticket. Lo decide el orquestador.

## Ⓕ Lo que me salió mal

Nada que cambie el resultado. Una cosa de método: la primera búsqueda de «quién cita esta línea»
devolvió una cita vieja en `docs/master/evidencias/SCRUM-523/`, que la sitúa en la línea 959, no en
la 962. No es un fallo de este cambio (esa evidencia es de otra fecha), pero es la prueba de por qué
no se mueven líneas: las coordenadas ajenas ya van desfasadas tres líneas por ediciones anteriores.
