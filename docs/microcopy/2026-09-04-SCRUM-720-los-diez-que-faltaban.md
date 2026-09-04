# Los diez rótulos que faltaban del parte y del selector

**Aprobados por el fundador** el 4-sep-2026, en **SCRUM-720c**.
**Aplicados en el mismo acto** (regla 30).

Con éstos, las dos pantallas quedan a **cero marcadores**. Seis se firman tal como estaban
propuestos; **cuatro los cambió el fundador**, y el motivo de cada cambio queda escrito porque es lo
que impide que alguien los «arregle» de vuelta.

## Textos aprobados, literales

| Texto aprobado | Dónde se pinta |
|---|---|
| Firma del cliente | `public/dashboard/js/parteDetailView.js` |
| Pide al cliente que firme con el dedo dentro del recuadro. | ídem |
| Firmado. El contenido ya no se puede cambiar. | ídem |
| No se ha podido cargar el parte. Vuelve a intentarlo. | ídem |
| Añadir estas líneas | ídem |
| Sin colocar — elige mano de obra o materiales | ídem |
| Todavía no lo ejecuta nadie | `public/dashboard/js/jobAsignados.js` |
| Solo un administrador puede cambiar quién ejecuta este trabajo | ídem |
| Todavía no has dado de alta a nadie en tu equipo | ídem |
| No se ha podido guardar quién ejecuta este trabajo | ídem |

## Los cuatro que cambiaron, y por qué

- **«Firmado. El contenido ya no se puede cambiar.»** — no «ya no se toca»: **los precios siguen
  abiertos** después de firmar, y la frase no puede sugerir que todo esté cerrado.
- **«Sin colocar — elige mano de obra o materiales»** — «dile dónde va» no dice a quién ni dónde.
  Esto nombra **las dos opciones reales**, que son vocabulario cerrado (regla 27).
- **«Solo un administrador puede cambiar quién ejecuta este trabajo»** — dice **qué** trabajo.
- **«Todavía no has dado de alta a nadie en tu equipo»** — un estado vacío que no dice el
  **siguiente paso** es media pantalla.

## El mecanismo se VACÍA, no se retira

Las dos constantes —`M` y `MARCA_ASIGNADOS`— **siguen vivas**, con un control que cae si
desaparecen. Lo que se va son los usos, no la herramienta: el rótulo que alguien añada mañana sin
firmar tiene que seguir saliendo marcado.

## Y el guard dice ahora qué cubre

`tests/scrum720-marcadores-en-lo-pintado.test.mjs` trabaja en **dos capas**, y las enuncia **en su
propia salida**, no sólo en un comentario:

1. **Lo que se pinta** — la pantalla ejecutada en tres estados (borrador, firmado, sin líneas).
   Cero. Un cero en un solo estado no es un cero: con el parte en borrador ya salía 0 antes de
   firmar nada.
2. **El catálogo entero** — `PARTE_TEXTOS` (27 textos) y `TEXTOS_ASIGNADOS` (5), que es de donde
   salen **todos** los rótulos, incluidos los de caminos que el banco no sabe pintar: el pad de
   firma, el error al cargar y la propuesta del dictado. Cero también.

**Lo que sigue sin cubrirse, dicho por el propio guard:** que cada texto del catálogo **llegue** a
una pantalla. Un texto declarado y nunca pintado pasaría las dos capas.
