# Roman Urdu: Ye script localhost ke liye trusted HTTPS certificate banati hai.
# Is ko backend folder ke certs folder mein localhost key/cert generate karne ke liye use karein.
# -Trust dene par cert current Windows user ke Trusted Root store mein install hota hai.

param(
  [switch]$Trust
)

$ErrorActionPreference = 'Stop'

$BackendRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')
$CertDir = Join-Path $BackendRoot 'certs'
$KeyPath = Join-Path $CertDir 'localhost-key.pem'
$CertPath = Join-Path $CertDir 'localhost-cert.pem'
$ConfigPath = Join-Path $CertDir 'localhost-openssl.cnf'

$OpenSsl = Get-Command openssl -ErrorAction Stop

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

@'
[ req ]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req

[ dn ]
CN = localhost

[ v3_req ]
basicConstraints = critical,CA:FALSE
keyUsage = critical,digitalSignature,keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[ alt_names ]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
'@ | Set-Content -LiteralPath $ConfigPath -Encoding ASCII

& $OpenSsl.Source req -x509 -nodes -days 825 -newkey rsa:2048 -keyout $KeyPath -out $CertPath -config $ConfigPath

if ($LASTEXITCODE -ne 0) {
  throw 'OpenSSL certificate generation failed.'
}

if ($Trust) {
  Import-Certificate -FilePath $CertPath -CertStoreLocation Cert:\CurrentUser\Root | Out-Null
  Write-Host "Trusted localhost certificate installed for current Windows user."
} else {
  Write-Host "Localhost certificate generated. Run this script with -Trust to install it in CurrentUser Trusted Root."
}

Write-Host "Certificate: $CertPath"
Write-Host "Private key:  $KeyPath"
