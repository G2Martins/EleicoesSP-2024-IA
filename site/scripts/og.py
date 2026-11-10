# Renders the social card and PNG icons with Playwright (Python). Run from site/: python -I scripts/og.py
# Outputs: public/og/eleicoes.png (1200x630), favicon-32.png, apple-touch-icon.png, icon-192.png, icon-512.png
from pathlib import Path

from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parent.parent
pub = root / "public"
svg = (pub / "favicon.svg").read_text(encoding="utf-8")

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={"width": 1200, "height": 630})
    page.goto((root / "scripts" / "og.html").as_uri())
    page.wait_for_timeout(400)  # fonts
    (pub / "og").mkdir(exist_ok=True)
    page.screenshot(path=str(pub / "og" / "eleicoes.png"))
    for name, size, pad in [("favicon-32.png", 32, 0), ("apple-touch-icon.png", 180, 14), ("icon-192.png", 192, 0), ("icon-512.png", 512, 0)]:
        page.set_viewport_size({"width": size, "height": size})
        bg = "#f3f0e8" if pad else "transparent"
        page.set_content(f'<body style="margin:0;background:{bg};display:grid;place-items:center;width:{size}px;height:{size}px">'
                         f'<div style="width:{size - 2 * pad}px;height:{size - 2 * pad}px">{svg.replace("<svg ", "<svg width=100% height=100% ")}</div></body>')
        page.screenshot(path=str(pub / name), omit_background=not pad)
    b.close()
print("og: public/og/eleicoes.png + icons")
