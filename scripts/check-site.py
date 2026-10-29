#!/usr/bin/env python3
"""Check the built site's local links, anchors, assets, and page structure."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit
import json
import re
import tempfile


class Page(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.ids = set()
        self.links = []
        self.h1 = 0
        self.lang = False
        self.title = False
        self.description = False
        self.duplicates = []
        self.redirect = False
        self.canonical = ''
        self.feed(path.read_text())

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                self.duplicates.append(attrs['id'])
            self.ids.add(attrs['id'])
        self.redirect |= tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh'
        if tag == 'link' and attrs.get('rel') == 'canonical':
            self.canonical = attrs.get('href', '')
        self.h1 += tag == 'h1'
        self.lang |= tag == 'html' and bool(attrs.get('lang'))
        self.title |= tag == 'title'
        self.description |= tag == 'meta' and attrs.get('name') == 'description'
        for name in ('href', 'src', 'poster'):
            if attrs.get(name):
                self.links.append(attrs[name])


def inspect(root):
    root = root.resolve()
    pages = {p.resolve(): Page(p) for p in root.rglob('*.html')}
    home = pages.get(root / 'index.html')
    base = urlsplit(home.canonical if home else '')
    base_path = base.path.rstrip('/') + '/'
    errors = []
    links = 0
    for path, page in pages.items():
        relative = path.relative_to(root)
        if page.duplicates:
            errors.append(f'{relative}: duplicate ids: {page.duplicates}')
        if not page.redirect and not (page.lang and page.title and page.description):
            errors.append(f'{relative}: missing lang, title, or description')
        if not page.redirect and '_print' not in relative.parts and path.name == 'index.html' and page.h1 != 1:
            errors.append(f'{relative}: expected one h1, got {page.h1}')
        current = base_path + relative.as_posix()
        for link in page.links:
            parsed = urlsplit(link)
            if parsed.scheme or parsed.netloc:
                if parsed.scheme not in ('', 'http', 'https') or parsed.netloc != base.netloc:
                    continue
                if not parsed.path.startswith(base_path):
                    continue
            links += 1
            target_url = urlsplit(urljoin(current, link))
            if not target_url.path.startswith(base_path):
                errors.append(f'{relative}: outside base path {link}')
                continue
            target = root / unquote(target_url.path[len(base_path):])
            if target.is_dir():
                target /= 'index.html'
            target = target.resolve()
            if not target.is_relative_to(root) or not target.exists():
                errors.append(f'{relative}: missing {link}')
                continue
            fragment = unquote(target_url.fragment)
            # Text fragments are interpreted by the browser rather than element ids.
            if fragment and not fragment.startswith(':~:text=') and target in pages:
                if fragment not in pages[target].ids:
                    errors.append(f'{relative}: missing anchor {link}')
    content = root.parent / 'content'
    for document in content.rglob('*.md'):
        text = document.read_text()
        for name in ('title', 'description'):
            if not re.search(r'^' + name + r': .+', text, re.M):
                errors.append(f'{document}: missing {name}')
        if document != content / '_index.md':
            if not re.search(r'^doc_type: (tutorial|how-to|reference|explanation|historical)$', text, re.M):
                errors.append(f'{document}: invalid doc_type')
    return {'pages': len(pages), 'local_links': links, 'base_path': base_path, 'errors': errors}


def self_test():
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory) / 'public'
        root.mkdir()
        (root/'index.html').write_text('<html lang="zh"><title>Test</title><meta name="description" content="Test"><h1>Test</h1><a href="next/#ok">Next</a></html>')
        (root/'next').mkdir()
        target = root/'next/index.html'
        target.write_text('<html lang="zh"><title>Next</title><meta name="description" content="Next"><h1 id="ok">Next</h1></html>')
        assert inspect(root)['errors'] == []
        target.write_text(target.read_text().replace('id="ok"', 'id="other"'))
        assert any('missing anchor' in error for error in inspect(root)['errors'])
        target.unlink()
        assert any('missing next/' in error for error in inspect(root)['errors'])
        target.write_text('<html lang="zh"><title>Next</title><meta name="description" content="Next"><h1 id="ok">Next</h1></html>')
        content = root.parent / 'content' / 'docs'
        content.mkdir(parents=True)
        document = content / 'test.md'
        document.write_text('---\ntitle: Test\ndescription: Test\ndoc_type: reference\n---\n')
        assert inspect(root)['errors'] == []
        document.write_text('---\ntitle: Test\ndoc_type: unknown\n---\n')
        errors = inspect(root)['errors']
        assert any('missing description' in error for error in errors)
        assert any('invalid doc_type' in error for error in errors)
        document.write_text('---\ntitle: Test\ndescription: Test\ndoc_type: reference\n---\n')
        index = root / 'index.html'
        index.write_text('<html lang="zh"><title>Test</title><meta name="description" content="Test"><link rel="canonical" href="https://docs.example/project/"><h1>Test</h1><a href="/project/next/#ok">Root</a><a href="next/#ok">Relative</a><a href="https://docs.example/project/next/#ok">Absolute</a></html>')
        assert inspect(root)['base_path'] == '/project/'
        assert inspect(root)['errors'] == []
        index.write_text(index.read_text().replace('href="/project/next/#ok"', 'href="/next/#ok"'))
        assert any('outside base path' in error for error in inspect(root)['errors'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', nargs='?', default='public', type=Path)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    if args.self_test:
        self_test()
        print('PASS: link checker accepts valid anchors and rejects missing targets')
    else:
        if not args.root.is_dir():
            parser.error(f'build directory does not exist: {args.root}')
        report = inspect(args.root)
        print(json.dumps(report, ensure_ascii=False, indent=2))
        raise SystemExit(bool(report['errors']))
