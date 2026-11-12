#!/usr/bin/env bash
# SCRUM-1396e · ¿dejan resto las 4 llamadas SIN_MEDIR? Camino feliz y camino de FALLO, con el MISMO
# instrumento de J4 (espia-mkdtemp.cjs y control-del-espia.fixture.txt, c.18875), sin cambiarlo.
#
#   bash docs/master/evidencias/SCRUM-1396/medir-restos-1396e.sh <carpeta de trabajo> [fichero:línea …]
#
# Sin líneas, mide las 4 SIN_MEDIR de scripts/_mkdtemp-declarados.json del 27-oct. Con líneas, sólo
# ésas. DESPUÉS del cambio la línea ya no es un mkdtempSync (el espía anotaría «creados 0», que no es
# «limpio»): se pasa `tests/<test>.test.mjs@_temporal.mjs:<línea de su mkdtempSync>` y se arma ésa.
# La carpeta de trabajo va FUERA del repositorio y SIN ESPACIOS (medir-restos.sh explica por qué).
set -u
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../../../.." && pwd)"
T="${1:?uso: medir-restos-1396e.sh <carpeta de trabajo, fuera del repo y sin espacios> [fichero:línea …]}"
shift
case "$T" in *" "*) echo "NO-PUDE-MIRAR: la carpeta de trabajo lleva espacios"; exit 2;; esac
mkdir -p "$T" && T="$(cd "$T" && pwd)"
case "$T/" in "$RAIZ"/*) echo "NO-PUDE-MIRAR: la carpeta de trabajo cae dentro del repositorio"; exit 2;; esac
nativa() { if command -v cygpath >/dev/null 2>&1; then cygpath -w "$1"; else printf '%s' "$1"; fi; }
if command -v cygpath >/dev/null 2>&1; then ESPIA="$(cygpath -m "$AQUI/espia-mkdtemp.cjs")"; else ESPIA="$AQUI/espia-mkdtemp.cjs"; fi
cd "$RAIZ" || exit 2

LINEAS=("$@")
[ ${#LINEAS[@]} -eq 0 ] && LINEAS=(
  tests/scrum1328-skips-con-motivo-en-el-tap.test.mjs:102
  tests/scrum1575b-censo-conexiones.test.mjs:37
  tests/scrum1575c-censo-ve-el-singleton.test.mjs:22
  tests/scrum1575d-staging-por-destino.test.mjs:71
)

# pasada <etiqueta> <fichero> <nombre> <líneas a armar, o -> [VAR=valor]  (la de medir-restos.sh)
pasada() {
  local D="$T/$1/$3" armar="$4" extra="${5:-SIN_EXTRA=1}"
  mkdir -p "$D/tmp"
  local W L TAP rc nv=0 vivos="" tipo quien dir resto
  W="$(nativa "$D/tmp")"; L="$D/espia.log"; TAP="$D/tanda.tap"
  [ "$armar" = "-" ] && armar=""
  env "$extra" ESPIA_ARMAR="$armar" ESPIA_LOG="$(nativa "$L")" NODE_OPTIONS="--require \"$ESPIA\"" TEMP="$W" TMP="$W" TMPDIR="$W" \
    node --test --test-force-exit --test-reporter=tap --test-reporter-destination="$TAP" "$2" >/dev/null 2>&1
  rc=$?
  touch "$L"
  while IFS=$'\t' read -r tipo quien dir resto; do
    [ "$tipo" = "C" ] || continue
    if [ -d "$dir" ]; then nv=$((nv+1)); vivos="$vivos $quien"; fi
  done < "$L"
  echo "$1 · $3 · salida $rc · tests $(grep -cE '^(not )?ok ' "$TAP" 2>/dev/null) · rojos $(grep -c '^not ok ' "$TAP" 2>/dev/null) · creados $(grep -c '^C' "$L") · armados $(grep -c '^A' "$L") · disparados $(grep -c '^F' "$L") · en TEMP al final $(ls -A "$D/tmp" | wc -l) · creados que siguen vivos $nv${vivos:+ →$vivos}"
}

echo "REPOSITORIO $(git rev-parse HEAD) · $(node --version) · $(uname -s)"
echo
echo "== CONTROLES DEL INSTRUMENTO (esperado: 0 · 1 · 0 · 1 creados que siguen vivos)"
C="$T/control-del-espia.test.mjs"; cp "$AQUI/control-del-espia.fixture.txt" "$C"
pasada control-1-pasa-y-borra "$C" control -
pasada control-2-pasa-y-nadie-borra "$C" control - CONTROL_FUGA=1
pasada control-3-falla-con-finally "$C" control control-del-espia.test.mjs:11
pasada control-4-falla-sin-finally "$C" control control-del-espia.test.mjs:12

echo
echo "== LAS LÍNEAS, una a una: camino feliz y camino de fallo"
for fl in "${LINEAS[@]}"; do
  # «test@línea armada»: corre ese test y arma otra línea (tras el cambio, la de tests/_temporal.mjs).
  case "$fl" in
    *@*) f="${fl%@*}"; arm="${fl#*@}" ;;
    *)   f="${fl%:*}"; arm="${fl#tests/}" ;;
  esac
  n="$(basename "$f" .test.mjs)"
  pasada feliz "$f" "$n" -
  pasada fallo "$f" "$n" "$arm"
  fa=0; q=0
  while IFS=$'\t' read -r tipo quien dir resto; do
    [ "$quien" = "$arm" ] || continue
    [ "$tipo" = "F" ] && fa=$((fa+1))
    [ "$tipo" = "C" ] && [ -d "$dir" ] && q=$((q+1))
  done < "$T/fallo/$n/espia.log"
  echo "  → $arm · fallos inyectados $fa · directorios suyos que quedan $q"
done
