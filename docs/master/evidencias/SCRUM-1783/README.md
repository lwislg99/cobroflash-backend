# SCRUM-1783 · LIVA arts. 148-163 (recargo de equivalencia), tal como los sirve la API del BOE

Bajado el **2026-11-21T03:39:46Z** (cabecera `Date:` de la respuesta del índice) por jv-j5bn (J5).

- **Norma:** Ley 37/1992, del IVA · `BOE-A-1992-28740`.
- **Método:** API de legislación **consolidada** del BOE (`https://www.boe.es/datosabiertos/api/legislacion-consolidada/id/BOE-A-1992-28740/texto/indice` y `.../texto/bloque/a<N>`, `Accept: application/xml`). NO `buscar/xml.php`, que da el texto original.
- **Control de método (que esto es el consolidado y no el original):** cada bloque trae TODAS sus versiones con la norma que la introdujo. `a154` trae 3, la última de `BOE-A-2014-12329`; `a161` trae 3, la última de `BOE-A-2012-9364`; `a150`-`a153` traen su versión «(Derogado)» de `BOE-A-1999-24786`. El texto original de 1992 no podría llevar nada de eso. Y el índice entero trae `fecha_actualizacion` máxima `20261007`: la consolidación está al día a 7-oct-2026.
- **Lectura:** se toma la ÚLTIMA `<version>` de cada bloque (la vigente), con su `fecha_vigencia`. En `a161` la nota dice además «surte efectos desde el 1 de septiembre de 2012»: la fecha de vigencia del atributo no es la de aplicación (A10, SCRUM-1316).
- **No medido:** proyectos o anteproyectos de ley en trámite que pudieran tocar el régimen; el Reglamento del IVA (RD 1624/1992, arts. 58-61 y siguientes), que fija los sectores y los requisitos a los que remite el art. 148.Uno.

## sha256 de lo bajado

```
3ad9d7d5860a6827b1e43f1cf72becb6a8c8b54d0cf11f0503c3367b940de39b  indice.xml
3cd64b865169ee036701118406acad75565e8630970e65f757f686236f88f72e  a148.xml
```

El resto de hashes, en `sha256.txt` (misma carpeta). Se recalculan con `sha256sum *.xml` desde aquí.
