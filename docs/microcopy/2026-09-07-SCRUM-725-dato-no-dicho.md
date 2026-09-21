# El aviso del dato que el técnico no dijo

**Aprobado por el fundador** el 7-sep-2026, en **SCRUM-725**.
**Aplicado en el mismo acto** (regla 30).

## Texto aprobado, literal

| Texto aprobado | Dónde se pinta |
|---|---|
| Esto no lo has dicho — bórralo o confírmalo. | `src/modules/jobs/domain/parteDictado.ts` (`AVISOS_DEL_DICTADO.datosRetirados`), pintado por `public/dashboard/js/parteDetailView.js` en la línea de la propuesta |

**Con punto final**, raya larga `—` de un solo carácter, y sin corchete de marcador.

## Dónde va, y por qué ahí

En la **línea de la propuesta del dictado** que lleva el dato, junto al aviso hermano
«Falta la cantidad — ponla tú» (SCRUM-674). **No es un resumen de cabecera**: un aviso arriba
diría que algo sobra pero no **cuál**, y con varias líneas el técnico no sabría dónde mirar. Va en
singular por lo mismo que su hermano: `datosRetirados` trae **una entrada por línea**.

El texto vive en el **servidor** y la pantalla lo **copia**. Un texto aprobado que se reteclea en
cada pantalla deja de ser el aprobado sin que nadie lo decida.

## Qué había antes: nada

No sustituye a ningún texto. **Antes no se decía**: el mecanismo de SCRUM-725 ya detectaba la
marca, el modelo o la referencia que el dictado no sostiene —y lo mandaba en `datosRetirados`—
pero la pantalla se lo callaba. Un mecanismo que detecta y no avisa es medio mecanismo: el técnico
firmaba el parte sin enterarse de que llevaba un `G3-144` que él no había nombrado.

## Por qué estas palabras

* **Dice qué pasa** —«esto no lo has dicho»— en las palabras del oficio, sin jerga.
* **Da las dos salidas**, borrarlo o confirmarlo, y las dos son legítimas: puede que la máquina se
  lo inventara, y puede que él lo dijera y la transcripción se lo comiera.
* **No culpa a nadie.** Desde aquí no se sabe cuál de las dos fue, y el único que puede decidirlo
  es quien estuvo en la obra. Un aviso que acusara a la máquina invitaría a ignorarlo; uno que
  acusara al técnico, a discutirlo.

## Verificación

Comprobado **sobre el DOM renderizado**, no sobre el fuente
(`tests/scrum725b-el-aviso-se-pinta.test.mjs`): con «reviso la central» y un modelo inventado el
aviso **aparece** dentro de su línea; con «cambié 3 detectores Honeywell» —todo respaldado— **no
aparece**. Un aviso que sale siempre se ignora en dos días.
