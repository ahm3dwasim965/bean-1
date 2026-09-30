#!/usr/bin/env python3
"""Dependency-free structural audit for the Bean Boutique submission."""

from __future__ import annotations

import json
import re
import subprocess
import sys
from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
EVIDENCE = ROOT / "evidence"
EXPECTED_PAGES = {
    "index.html",
    "coffee.html",
    "equipment.html",
    "events.html",
    "offers.html",
    "cart.html",
}


class AuditParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.tags: list[tuple[str, dict[str, str]]] = []
        self.ids: list[str] = []
        self.links: list[str] = []
        self.images: list[dict[str, str]] = []
        self.labels: set[str] = set()
        self.controls: list[tuple[str, dict[str, str]]] = []
        self.styles = 0
        self.inline_styles = 0
        self.stylesheets: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        self.tags.append((tag, data))
        if data.get("id"):
            self.ids.append(data["id"])
        if tag == "a" and data.get("href"):
            self.links.append(data["href"])
        if tag == "img":
            self.images.append(data)
        if tag == "label" and data.get("for"):
            self.labels.add(data["for"])
        if tag in {"input", "select", "textarea"}:
            self.controls.append((tag, data))
        if tag == "style":
            self.styles += 1
        if "style" in data:
            self.inline_styles += 1
        if tag == "link" and data.get("rel") == "stylesheet":
            self.stylesheets.append(data.get("href", ""))


def result(name: str, passed: bool, detail: str) -> dict[str, object]:
    return {"check": name, "passed": passed, "detail": detail}


def main() -> int:
    EVIDENCE.mkdir(exist_ok=True)
    checks: list[dict[str, object]] = []
    pages = {path.name for path in DIST.glob("*.html")}
    checks.append(result("Six required HTML pages", pages == EXPECTED_PAGES, f"Found: {', '.join(sorted(pages))}"))

    for page_name in sorted(EXPECTED_PAGES):
        page = DIST / page_name
        parser = AuditParser()
        text = page.read_text(encoding="utf-8")
        parser.feed(text)

        tag_names = {tag for tag, _ in parser.tags}
        checks.append(result(f"{page_name}: HTML5 doctype", text.lower().lstrip().startswith("<!doctype html>"), "Document begins with HTML5 doctype"))
        checks.append(result(f"{page_name}: semantic landmarks", {"header", "nav", "main", "footer"}.issubset(tag_names), "Header, nav, main and footer present"))
        checks.append(result(f"{page_name}: external project CSS", "css/styles.css" in parser.stylesheets and parser.styles == 0 and parser.inline_styles == 0, "Shared stylesheet linked; no style element or style attribute"))
        checks.append(result(f"{page_name}: unique IDs", len(parser.ids) == len(set(parser.ids)), f"{len(parser.ids)} IDs checked"))
        checks.append(result(f"{page_name}: image alternatives", all("alt" in image for image in parser.images), f"{len(parser.images)} images checked"))

        unlabelled = []
        for tag, attrs in parser.controls:
            if attrs.get("type") == "hidden":
                continue
            control_id = attrs.get("id")
            has_name = control_id in parser.labels or bool(attrs.get("aria-label")) or bool(attrs.get("aria-labelledby"))
            if not has_name:
                unlabelled.append(f"{tag}#{control_id or '?'}")
        checks.append(result(f"{page_name}: form control names", not unlabelled, "All labelled" if not unlabelled else ", ".join(unlabelled)))

        broken = []
        for href in parser.links:
            if href.startswith(("http://", "https://", "mailto:", "#")):
                continue
            target = (page.parent / href.split("#", 1)[0]).resolve()
            if not target.exists():
                broken.append(href)
        checks.append(result(f"{page_name}: internal links", not broken, "All internal targets exist" if not broken else ", ".join(broken)))

    css = (DIST / "css" / "styles.css").read_text(encoding="utf-8")
    checks.append(result("CSS braces balanced", css.count("{") == css.count("}"), f"{css.count('{')} opening and {css.count('}')} closing braces"))
    checks.append(result("Responsive media queries", "@media (max-width:" in css and "prefers-reduced-motion" in css, "Mobile breakpoints and reduced-motion support found"))

    js_check = subprocess.run(
        ["node", "--check", str(DIST / "js" / "app.js")],
        capture_output=True,
        text=True,
        check=False,
    )
    checks.append(result("JavaScript syntax", js_check.returncode == 0, js_check.stderr.strip() or "node --check passed"))

    html_source = "\n".join((DIST / name).read_text(encoding="utf-8") for name in EXPECTED_PAGES)
    checks.append(result("No placeholder text", not re.search(r"\b(lorem ipsum|todo|tbd)\b", html_source, re.I), "No lorem ipsum, TODO or TBD text found"))

    summary = {
        "tool": "Bean Boutique structural pre-audit",
        "scope": "Local source checks; not an official W3C validation result",
        "passed": sum(1 for item in checks if item["passed"]),
        "failed": sum(1 for item in checks if not item["passed"]),
        "checks": checks,
    }
    output = EVIDENCE / "static-audit.json"
    output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    return 1 if summary["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
