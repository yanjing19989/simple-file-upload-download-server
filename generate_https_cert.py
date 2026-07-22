"""Generate a local self-signed HTTPS certificate for the file server."""

import argparse
import ipaddress
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
from pathlib import Path


DEFAULT_OUTPUT_DIR = Path.home() / '.simple-file-upload-download-server'


def local_names(extra_names=()):
    names = {'localhost', socket.gethostname()}
    names.update(name.strip() for name in extra_names if name.strip())
    try:
        addresses = socket.getaddrinfo(socket.gethostname(), None)
    except OSError:
        addresses = []
    ips = {'127.0.0.1', '::1'}
    for address in addresses:
        value = address[4][0].split('%', 1)[0]
        try:
            ips.add(str(ipaddress.ip_address(value)))
        except ValueError:
            continue
    return sorted(names), sorted(ips)


def generate_with_powershell(cert_path, key_path, common_name,
                             dns_names, ip_addresses, days):
    powershell = shutil.which('pwsh') or shutil.which('powershell')
    if not powershell:
        raise RuntimeError('PowerShell is required to generate a certificate')
    script = r'''
$ErrorActionPreference = 'Stop'
$rsa = [System.Security.Cryptography.RSA]::Create(2048)
$subject = [System.Security.Cryptography.X509Certificates.X500DistinguishedName]::new("CN=$env:SFS_CERT_CN")
$request = [System.Security.Cryptography.X509Certificates.CertificateRequest]::new(
    $subject,
    $rsa,
    [System.Security.Cryptography.HashAlgorithmName]::SHA256,
    [System.Security.Cryptography.RSASignaturePadding]::Pkcs1
)
$request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($false, $false, 0, $true)
)
$usage = [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::DigitalSignature -bor
    [System.Security.Cryptography.X509Certificates.X509KeyUsageFlags]::KeyEncipherment
$request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509KeyUsageExtension]::new($usage, $true)
)
$oids = [System.Security.Cryptography.OidCollection]::new()
[void]$oids.Add([System.Security.Cryptography.Oid]::new('1.3.6.1.5.5.7.3.1'))
$request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509EnhancedKeyUsageExtension]::new($oids, $false)
)
$san = [System.Security.Cryptography.X509Certificates.SubjectAlternativeNameBuilder]::new()
foreach ($name in (ConvertFrom-Json $env:SFS_CERT_DNS)) {
    $san.AddDnsName([string]$name)
}
foreach ($value in (ConvertFrom-Json $env:SFS_CERT_IPS)) {
    $san.AddIpAddress([System.Net.IPAddress]::Parse([string]$value))
}
$request.CertificateExtensions.Add($san.Build())
$request.CertificateExtensions.Add(
    [System.Security.Cryptography.X509Certificates.X509SubjectKeyIdentifierExtension]::new($request.PublicKey, $false)
)
$notBefore = [System.DateTimeOffset]::UtcNow.AddMinutes(-5)
$notAfter = $notBefore.AddDays([int]$env:SFS_CERT_DAYS)
$certificate = $request.CreateSelfSigned($notBefore, $notAfter)

function Write-Pem([string]$label, [byte[]]$bytes, [string]$path) {
    $base64 = [Convert]::ToBase64String($bytes)
    $body = [regex]::Replace($base64, '.{1,64}', {
        param($match)
        $match.Value + "`n"
    })
    $pem = "-----BEGIN $label-----`n$body-----END $label-----`n"
    [System.IO.File]::WriteAllText($path, $pem,
        [System.Text.UTF8Encoding]::new($false))
}

Write-Pem 'CERTIFICATE' $certificate.Export(
    [System.Security.Cryptography.X509Certificates.X509ContentType]::Cert
) $env:SFS_CERT_PATH
Write-Pem 'PRIVATE KEY' $rsa.ExportPkcs8PrivateKey() $env:SFS_KEY_PATH
'''
    environment = os.environ.copy()
    environment.update({
        'SFS_CERT_PATH': str(cert_path),
        'SFS_KEY_PATH': str(key_path),
        'SFS_CERT_CN': common_name,
        'SFS_CERT_DNS': json.dumps(dns_names),
        'SFS_CERT_IPS': json.dumps(ip_addresses),
        'SFS_CERT_DAYS': str(days),
    })
    subprocess.run(
        [powershell, '-NoProfile', '-NonInteractive', '-Command', script],
        check=True,
        env=environment,
    )


def generate_with_openssl(cert_path, key_path, common_name,
                          dns_names, ip_addresses, days):
    openssl = shutil.which('openssl')
    if not openssl:
        raise RuntimeError('OpenSSL is required to generate a certificate')
    san = ','.join(
        ['DNS:' + name for name in dns_names] +
        ['IP:' + value for value in ip_addresses]
    )
    subprocess.run([
        openssl,
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-sha256',
        '-nodes',
        '-days',
        str(days),
        '-subj',
        '/CN=' + common_name,
        '-addext',
        'subjectAltName=' + san,
        '-addext',
        'basicConstraints=critical,CA:FALSE',
        '-addext',
        'keyUsage=critical,digitalSignature,keyEncipherment',
        '-addext',
        'extendedKeyUsage=serverAuth',
        '-keyout',
        str(key_path),
        '-out',
        str(cert_path),
    ], check=True)


def main(argv=None):
    parser = argparse.ArgumentParser(
        description='Generate a random self-signed certificate for HTTPS.'
    )
    parser.add_argument(
        '-o',
        '--output-dir',
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help='output directory (default: %(default)s)',
    )
    parser.add_argument(
        '--host',
        action='append',
        default=[],
        help='additional DNS name; may be specified more than once',
    )
    parser.add_argument(
        '--days',
        type=int,
        default=825,
        help='certificate validity in days (default: 825)',
    )
    parser.add_argument(
        '--force',
        action='store_true',
        help='replace existing cert.pem and key.pem',
    )
    args = parser.parse_args(argv)
    if args.days < 1:
        parser.error('--days must be at least 1')

    output_dir = args.output_dir.expanduser().resolve()
    cert_path = output_dir / 'cert.pem'
    key_path = output_dir / 'key.pem'
    if not args.force and (cert_path.exists() or key_path.exists()):
        parser.error('certificate files already exist; use --force to replace')
    output_dir.mkdir(parents=True, exist_ok=True)
    dns_names, ip_addresses = local_names(args.host)
    common_name = 'sfs-' + secrets.token_hex(8)
    try:
        if os.name == 'nt':
            generate_with_powershell(
                cert_path,
                key_path,
                common_name,
                dns_names,
                ip_addresses,
                args.days,
            )
        else:
            generate_with_openssl(
                cert_path,
                key_path,
                common_name,
                dns_names,
                ip_addresses,
                args.days,
            )
        if os.name != 'nt':
            key_path.chmod(0o600)
            cert_path.chmod(0o644)
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        for path in (cert_path, key_path):
            try:
                path.unlink()
            except FileNotFoundError:
                pass
        parser.exit(1, 'Certificate generation failed: ' + str(error) + '\n')

    print('Certificate generated:')
    print('  ' + str(cert_path))
    print('  ' + str(key_path))
    print('Included DNS names: ' + ', '.join(dns_names))
    print('Included IP addresses: ' + ', '.join(ip_addresses))
    print('Trust cert.pem on each client device before using HTTPS.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
