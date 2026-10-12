
$ErrorActionPreference = "Stop"

# Cartella principale del progetto
$root = Get-Location

# Percorso della pagina GestioneScarichi
$base = Join-Path $root "src\components\GestioneScarichi"

# Cartelle da creare
$cartelle = @(
    $base,
    (Join-Path $base "components"),
    (Join-Path $base "utils"),
    (Join-Path $base "stampa"),
    (Join-Path $base "services")
)

# File vuoti da creare
$file = @(
    "components\FiltriMovimenti.js",
    "components\TabellaRiepilogoGiornaliero.js",
    "components\ModaleProspetto.js",
    "components\ModaleDocumento.js",
    "utils\calcoli.js",
    "utils\riepilogoGiornaliero.js",
    "stampa\stampaMovimenti.js",
    "stampa\stampaProspetto.js",
    "stampa\stampaDocumento.js",
    "services\movimentiService.js",
    "services\documentiService.js",
    "services\fatturaService.js",
    "services\generaXmlFatturaPa.js",
    "services\validazioneFattura.js"
)

Write-Host ""
Write-Host "Creazione struttura GestioneScarichi..." -ForegroundColor Cyan
Write-Host ""

# Crea le cartelle, se mancanti
foreach ($cartella in $cartelle) {
    if (-not (Test-Path $cartella)) {
        New-Item -ItemType Directory -Path $cartella -Force | Out-Null
        Write-Host "[CARTELLA] $cartella" -ForegroundColor Green
    }
    else {
        Write-Host "[ESISTENTE] $cartella" -ForegroundColor Yellow
    }
}

# Crea i file vuoti senza sovrascrivere quelli esistenti
foreach ($nomeFile in $file) {
    $percorso = Join-Path $base $nomeFile

    if (-not (Test-Path $percorso)) {
        New-Item -ItemType File -Path $percorso | Out-Null
        Write-Host "[FILE] $percorso" -ForegroundColor Green
    }
    else {
        Write-Host "[GIA' ESISTENTE] $percorso" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Struttura creata!" -ForegroundColor Green
Write-Host "Nessun file esistente e' stato sovrascritto." -ForegroundColor Cyan
Write-Host ""