# Spike de SCRUM-198 — validación XSD del XML de VeriFactu

**Esto NO es el test.** Es la evidencia ejecutable del spike que evaluó tres librerías, y
el material con el que nacerá el test de SCRUM-198 cuando **SCRUM-209** esté arreglado.

Se commitea a propósito: el 29-jul-2026 se perdió trabajo por dejarlo en un scratchpad
efímero. Un spike que no se puede volver a ejecutar es una opinión.

## Qué hay

| fichero | qué hace |
| --- | --- |
| `gen-xml.mjs` | Genera `valido.xml` e `invalido.xml`. Obtiene el XML **igual que `tests/scrum145`**: importa `buildVerifactuRegistrosXml` de `dist/` con un `prisma` falso. **Cero cambios en el camino de emisión.** |
| `c1-xmllint-wasm.mjs` | Candidato 1 — `xmllint-wasm` (WASM, 892 KB, 0 deps, MIT). |
| `c2-libxml2-wasm.mjs` | Candidato 2 — `libxml2-wasm` (WASM, 1,4 MB, 0 deps, MIT). API de input provider marcada `@alpha`. |
| `c3-libxmljs2.cjs` | Candidato 3 — `libxmljs2` (nativo, 9,3 MB, prebuild por plataforma, MIT). |

`package.json` es una **raíz npm aparte a propósito**: el `package.json` del repo NO se toca,
porque elegir la dependencia es decisión del fundador (regla 36).

## Cómo se ejecuta

```bash
npm run build                 # desde la raíz del repo: gen-xml.mjs importa de dist/
cd spike && npm install       # instala los tres candidatos SOLO aquí
node gen-xml.mjs
node c1-xmllint-wasm.mjs      # y c2 / c3
```

## Los dos XML

* `valido.xml` — mal nombre a partir de ahora, y se deja a propósito: es lo que **emite el
  servicio hoy**, y **NO valida** (SCRUM-209: `DetalleDesglose` sin `ClaveRegimen` ni
  `CalificacionOperacion`). Cuando 209 se arregle, este fichero pasará a validar y **ahí es
  donde el test de SCRUM-198 debe nacer en verde**.
* `invalido.xml` — inválido A PROPÓSITO, y el caso está elegido para que **ningún assert de
  cadena de los que hay hoy lo cace**: el elemento existe y está bien escrito, lo que falla es
  el VALOR contra el tipo (`TipoFactura` `F1` → `F9`, fuera de la enumeración). Es el caso rojo.

Los dos son regenerables con `gen-xml.mjs`; se commitean como **instantánea del 29-jul-2026**
para que el hallazgo de 209 se pueda leer sin reconstruir nada.

## El coste común a los tres candidatos

Los XSD de la AEAT importan xmldsig por **URL remota**
(`schemaLocation="http://www.w3.org/TR/xmldsig-core/xmldsig-core-schema.xsd"`). Sin red hay que
redirigirlo al `.xsd` vendorizado — lo mismo que hace `scripts/validate-registros-xsd.ps1` con
`XmlResolver = $null`. Cada candidato lo resuelve por su vía; ninguno se libra.
