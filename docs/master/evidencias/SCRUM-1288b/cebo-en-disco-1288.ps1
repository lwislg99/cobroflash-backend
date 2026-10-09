# SCRUM-1288 punto 4, de extremo a extremo: el cebo del orquestador EN DISCO, dentro de src/, y el test real.
# base verde -> cebo puesto (se comprueba que ENTRO) -> rojo -> cebo quitado -> verde -> arbol limpio.
# Uso: .\cebo-en-disco-1288.ps1
$b = 'D:\MILLONARIO\cobroFlash\_banco-s3'
$w = 'D:\MILLONARIO\cobroFlash\wt-s3-1288b'
Set-Location $w
$env:FORCE_COLOR = $null
$cebo = "$w\src\modules\messaging\zz-cebo-1288.ts"
$test = 'tests/scrum1452-gemelo-crudo.test.mjs'
function Correr($nombre) {
  $tap = "$b\salidas\cebo1288-$nombre.tap"
  & node --test --test-reporter=tap "--test-reporter-destination=$tap" $test *> "$b\salidas\cebo1288-$nombre.out"
  $ex = $LASTEXITCODE
  $l = Get-Content $tap -Encoding UTF8
  $res = ($l | Select-String -Pattern '^# (tests|pass|fail|skipped) ').Line -join ' '
  $caidos = @($l | Where-Object { $_ -match '^not ok ' } | ForEach-Object { $_.Substring(0, [Math]::Min(110, $_.Length)) })
  $nombra = @($l | Select-String -SimpleMatch 'zz-cebo-1288' | Select-Object -First 2 | ForEach-Object { $_.Line.Trim().Substring(0, [Math]::Min(200, $_.Line.Trim().Length)) })
  "{0} | salida {1} | {2} | caidos: {3} | nombra el cebo: {4}" -f $nombre, $ex, $res, ($caidos -join ' || '), ($nombra -join ' // ')
}
"POBLACION | arbol $w | HEAD $(git rev-parse HEAD) | sucios antes: $(@(git status --porcelain).Count) | FORCE_COLOR ausente: $(-not (Test-Path Env:FORCE_COLOR))"
Correr 'base'
$texto = "import { sendWhatsAppText } from '../../integrations/whatsapp';`nexport async function avisarCebo(importe: number, tel: string) {`n  await sendWhatsAppText({ to: tel, text: 'Cobrado ' + importe.toFixed(2) + ' EUR' } as any);`n}`n"
[IO.File]::WriteAllText($cebo, $texto)
"cebo puesto: existe=$(Test-Path $cebo) bytes=$((Get-Item $cebo).Length) | git status: $((git status --porcelain) -join ' ')"
Correr 'con-cebo'
[IO.File]::Delete($cebo)
"cebo quitado: existe=$(Test-Path $cebo)"
Correr 'sin-cebo'
"sucios despues: $(@(git status --porcelain).Count)"
"EXIT=0"
