#!/usr/bin/env bash
# guard-dangerous — envoltorio del hook PreToolUse (master Parte AA2, reglas 3 y AA1.8).
#
# La lógica vive en guard-dangerous.mjs (SCRUM-176). Este fichero solo canaliza stdin.
# Por qué se movió: el guard tenía que dejar de casar por TEXTO (el mensaje de commit, el
# campo `description`) y pasar a mirar solo el comando que se ejecuta, descontando las
# regiones que son carga de texto. Eso pide parsear JSON de verdad y regex con estado, y en
# bash sale frágil. Como efecto secundario deseado, ahora las reglas son EJECUTABLES DESDE UN
# TEST en cualquier plataforma (`bash` no está en el PATH de la máquina Windows del fundador,
# así que un guard escrito en bash no se podía verificar ahí).
#
# FAIL-CLOSED: sin node no se puede evaluar la regla, y un guard que no puede evaluar no deja
# pasar — bloquea y lo dice. Es ruidoso a propósito: un guard mudo se pudre sin que nadie lo note.

set -u

if ! command -v node >/dev/null 2>&1; then
  echo "guard-dangerous BLOQUEADO: no encuentro 'node' para evaluar el guard (AA2). Sin evaluacion no hay paso." >&2
  exit 2
fi

exec node "$(dirname "$0")/guard-dangerous.mjs"
