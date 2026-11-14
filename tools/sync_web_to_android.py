#!/usr/bin/env python3
"""Copy the canonical web/PWA source into the Android offline WebView assets.

Usage:
    python tools/sync_web_to_android.py
    python tools/sync_web_to_android.py --check

The site/ directory is the single source of truth for all three platforms.
The GitHub Android workflow syncs before compiling, so the APK never runs old web JS.
"""
from pathlib import Path
from argparse import ArgumentParser
import shutil
import sys

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
ANDROID = ROOT / 'app' / 'src' / 'main' / 'assets'
WEB_FILES = [f for f in SITE.rglob('*') if f.is_file() and f.name != '.nojekyll']


def main(check: bool) -> int:
    if not (SITE / 'index.html').is_file():
        print('ERROR: site/index.html is missing', file=sys.stderr)
        return 1
    needs_copy = []
    for source in WEB_FILES:
        target = ANDROID / source.relative_to(SITE)
        if not target.is_file() or target.read_bytes() != source.read_bytes():
            needs_copy.append((source, target))
    if check:
        if needs_copy:
            for _, target in needs_copy:
                print('Out of sync:', target.relative_to(ROOT))
            return 1
        print(f'OK: Android assets match the {len(WEB_FILES)} files in site/')
        return 0
    for source, target in needs_copy:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    print(f'OK: synchronized {len(needs_copy)} changed files ({len(WEB_FILES)} total).')
    return 0

if __name__ == '__main__':
    ap = ArgumentParser()
    ap.add_argument('--check', action='store_true', help='Exit nonzero if files differ')
    args = ap.parse_args()
    raise SystemExit(main(args.check))
