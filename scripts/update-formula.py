#!/usr/bin/env python3
"""Update Formula/vakt.rb with new version and checksums.

Reads VERSION, SHA_DARWIN_ARM64, SHA_LINUX_X86_64 from environment.
"""
import re
import os
import sys

version    = os.environ['VERSION']
sha_darwin = os.environ['SHA_DARWIN_ARM64']
sha_linux  = os.environ['SHA_LINUX_X86_64']

with open('Formula/vakt.rb') as f:
    content = f.read()

content = re.sub(r'version "[^"]*"', f'version "{version}"', content)
content = re.sub(
    r'(on_arm do\s+url ")[^"]*(".*?sha256 ")[^"]*(")',
    lambda m: (
        f'{m.group(1)}https://github.com/tn819/vakt/releases/download/'
        f'v{version}/vakt-{version}-darwin-arm64.tar.gz'
        f'{m.group(2)}{sha_darwin}{m.group(3)}'
    ),
    content, flags=re.DOTALL)
content = re.sub(
    r'(on_intel do\s+url ")[^"]*(".*?sha256 ")[^"]*(")',
    lambda m: (
        f'{m.group(1)}https://github.com/tn819/vakt/releases/download/'
        f'v{version}/vakt-{version}-linux-x86_64.tar.gz'
        f'{m.group(2)}{sha_linux}{m.group(3)}'
    ),
    content, flags=re.DOTALL)

with open('Formula/vakt.rb', 'w') as f:
    f.write(content)

print(f"Updated formula to v{version}")
