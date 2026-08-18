param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$resolvedPath = Resolve-Path -LiteralPath $Path -ErrorAction Stop
$signature = Get-AuthenticodeSignature -LiteralPath $resolvedPath

if ($signature.Status -ne 'Valid') {
  throw "Signature verification failed for '$resolvedPath': $($signature.Status) $($signature.StatusMessage)"
}

[PSCustomObject]@{
  Path = $resolvedPath.Path
  Status = $signature.Status
  Subject = $signature.SignerCertificate.Subject
  Issuer = $signature.SignerCertificate.Issuer
  Expires = $signature.SignerCertificate.NotAfter
} | Format-List
