param(
  [Parameter(Mandatory=$true)][int]$Puerta,
  [Parameter(Mandatory=$true)][string]$Modo,
  [int]$EsperaMs = 0,
  [string]$Casa = ''
)
# SCRUM-1386 - busca al runner (`node --test`, hijo directo de la puerta) y lo mata segun $Modo.
# Imprime UN testigo, y el banco lo exige: objetivo vivo antes de matar, muerto despues.
# Solo ASCII a proposito: PowerShell 5.1 lee un .ps1 sin BOM como ANSI.
$t0 = [DateTime]::UtcNow
$runner = $null
for ($i = 0; $i -lt 300 -and -not $runner; $i++) {
  $hijos = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$Puerta")
  $runner = $hijos | Where-Object { $_.CommandLine -match '--test' } | Select-Object -First 1
  if (-not $runner) { Start-Sleep -Milliseconds 50 }
}
if (-not $runner) { Write-Output "TESTIGO runner=NO-VISTO"; exit 3 }
$visto = [int]([DateTime]::UtcNow - $t0).TotalMilliseconds
if ($EsperaMs -gt 0) { Start-Sleep -Milliseconds $EsperaMs }
$nietos = @(Get-CimInstance Win32_Process -Filter "ParentProcessId=$($runner.ProcessId)" | Where-Object { $_.Name -match '^node' })
$objetivo = $runner.ProcessId
$como = ''
if ($Modo -eq 'nieto') {
  $n = $nietos | Where-Object { $_.CommandLine -match $Casa } | Select-Object -First 1
  if (-not $n) { Write-Output "TESTIGO runner=$($runner.ProcessId) nietos=$($nietos.Count) nieto=NO-VISTO($Casa)"; exit 4 }
  $objetivo = $n.ProcessId
}
$antes = @(Get-Process -Id $objetivo -ErrorAction SilentlyContinue).Count
# El codigo con el que sale el que mata NO es el testigo: `taskkill /T` sale 255 o 128 si un
# bisnieto no se deja matar aunque el objetivo si muera. El testigo es vivo-antes / muerto-despues.
if ($Modo -eq 'runner-arbol') {
  $como = 'taskkill /F /T'
  $null = & taskkill.exe /F /T /PID $objetivo 2>&1
} elseif ($Modo -eq 'runner-solo') {
  $como = 'taskkill /F'
  $null = & taskkill.exe /F /PID $objetivo 2>&1
} elseif ($Modo -eq 'runner-stop') {
  $como = 'Stop-Process -Force'
  Stop-Process -Id $objetivo -Force
} elseif ($Modo -eq 'nieto') {
  $como = "taskkill /F al nieto $Casa"
  $null = & taskkill.exe /F /PID $objetivo 2>&1
} else { Write-Output "TESTIGO modo=DESCONOCIDO($Modo)"; exit 5 }
Start-Sleep -Milliseconds 200
$sigue = @(Get-Process -Id $objetivo -ErrorAction SilentlyContinue).Count
Write-Output "TESTIGO runner=$($runner.ProcessId) visto_a=${visto}ms espera=${EsperaMs}ms nietos_vivos_al_matar=$($nietos.Count) objetivo=$objetivo como=[$como] objetivo_vivo_antes=$antes objetivo_sigue_vivo=$sigue"
exit 0
