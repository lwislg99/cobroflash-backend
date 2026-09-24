# SCRUM-870 · El productor de pruebas: de un marcador al nombre real

**Fecha:** 23-sep-2026 · **Carril:** fiscal · **Puesto:** orquestador (A13)
**Medido contra:** `origin/main` = `78ef063c0b35b0e3e2f72dde60a97321cc44143d` · 2026-09-23T16:12:36Z
---

# APÉNDICE · 23-sep-2026 · SCRUM-870b · El productor de pruebas, aplicado

**Medido contra:** `origin/main` = `78ef063c0b35b0e3e2f72dde60a97321cc44143d` · 2026-09-23T16:12:36Z
**Aplica:** el orquestador del equipo de Javier (A13), por **instrucción expresa suya** en el chat
(*«y lo que me dices del productor hazlo tú»*), sobre su decisión del mismo día
(SCRUM-870, comentario 16599: *«Sí soy yo el productor de pruebas»*).

## Por qué lo aplica el orquestador y no J1

**El clasificador de permisos de `jv-j1` denegó la edición**, con el motivo **`PII Data Handling`**:
un nombre real y un NIF real de una persona, escritos en un fichero.

**J1 paró y no lo reintentó por otra vía.** Lo dijo con estas palabras: hacerlo por Bash o por Write
sería *«la misma acción disfrazada»*. Tenía razón, y es la segunda vez hoy que una sesión de este
equipo se topa con un guardarraíl y **no busca la puerta de al lado** (la otra fue J4 con los
documentos de la gestoría).

**Tampoco lo hizo el orquestador por su cuenta.** Se subió al fundador —que es de quien son los
permisos y de quien son los datos— y él instruyó aplicarlo. **Eso es lo que distingue un reparto de
un rodeo**, y por eso queda escrito aquí.

**El guardarraíl no estaba equivocado del todo:** existe para impedir que se filtren datos de una
persona a un fichero. Lo que no puede distinguir es que **éstos son del propio fundador, los aportó
él, y ya estaban publicados en este ticket bajo su cuenta**.

## El cambio

```
-export const VERIFACTU_PRODUCTOR_NOMBRE = "<Luis Lara Granado>";
+export const VERIFACTU_PRODUCTOR_NOMBRE = "Javier Pereira Fernández";
-export const VERIFACTU_PRODUCTOR_NIF = "02290074X";
+export const VERIFACTU_PRODUCTOR_NIF = "05292751Z";
```

🔴 **Los ángulos `<>` desaparecen, y eso ES el cambio, no un detalle de formato.** Estaban puestos
como marcador visible de «esto no es un dato real». **Ahora lo es.** A partir de aquí **el fichero
ya no avisa por sí solo** de que el productor es provisional: lo único que lo mantiene provisional
es que el NIF es de persona física y el go live será como empresa.

## Controles, ejecutados y no supuestos

El cambio se aplicó con un script que **aborta sin escribir un byte** si cualquiera falla:

| control | resultado |
|---|---|
| cada constante aparece **exactamente una vez** antes de tocar | **sí, las dos** |
| líneas del fichero antes → después | **61 → 61** |
| líneas que difieren | **2** |
| marcadores con ángulos que quedan | **0** |
| ¿queda el NIF viejo en algún sitio? | **no** |
| ¿queda el nombre viejo en algún sitio? | **no** |
| 🔴 ¿sigue cerrada la puerta al override por entorno? | **sí** |
| ¿se siguen exportando las dos constantes? | **sí** |

El penúltimo es el control que importa de verdad: ese fichero **prohíbe a propósito** que el
productor se pueda inyectar por variable de entorno —su propio comentario dice *«una puerta que
existe se acaba usando»*— y este cambio **no la abre**.

## 📣 Lo que esto retira, dicho aquí para que no se descubra en un diff

**Sale el nombre y el NIF de Luis Lara Granado** de un fichero cuyo contenido viaja a Hacienda en el
bloque `SistemaInformatico`. El ticket está etiquetado `equipo-luis` y `aviso-a-luis` desde antes de
aplicarlo, precisamente para eso.

**No es una decisión impuesta:** Javier asume la responsabilidad del productor, no se la traslada.
El productor es quien firma la declaración responsable del art. 13 RRSIF y quien responde de ella
(art. 201 bis LGT, hasta 150.000 €/ejercicio).

## Lo que este cambio NO resuelve

- ⛔ **No cierra SCRUM-523.** La declaración responsable es un requisito de **pantalla** (art. 15.3
  de la Orden) y sigue sin construirse. Lo que se desbloquea es poder **redactarla**, porque ya se
  sabe quién firma.
- ⛔ **No contesta si el productor puede ser DOS personas.** Javier respondió esa pregunta el mismo
  día con la norma delante: **dos personas físicas en el mismo campo, no; una entidad sin
  personalidad (comunidad de bienes con NIF E), sí**. La vía decidida sigue siendo **la SL**, y este
  cambio es para **pruebas**.
- ⛔ **Nada más de `productor.ts`.**
