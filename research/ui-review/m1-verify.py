#!/usr/bin/env python3
"""M1 visual verification: screenshots + console error check."""
from playwright.sync_api import sync_playwright

BASE = "http://127.0.0.1:8901/"
OUT = "/home/hatch/workspace/bballproj/research/ui-review/m1"
CHROME = "/opt/meta-chromium/chrome"
ARGS = ["--no-sandbox", "--disable-features=LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests"]

errors = []

def shot(page, name):
    page.screenshot(path=f"{OUT}/{name}.png")
    print("shot:", name, flush=True)

def new_page(pw, width, height):
    browser = pw.chromium.launch(executable_path=CHROME, args=ARGS)
    ctx = browser.new_context(viewport={"width": width, "height": height})
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(f"[{width}px console.{m.type}] {m.text}") if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"[{width}px pageerror] {e}"))
    return browser, page

def start_dynasty(page):
    page.goto(BASE)
    page.wait_for_selector("#setup-content, #home-slots", timeout=15000)
    btn = page.query_selector('[data-action="new-dynasty-start"]')
    if btn:
        btn.click()
        page.wait_for_selector("#coach-first", timeout=10000)
    page.fill("#coach-first", "Test")
    page.fill("#coach-last", "Coach")
    page.click('[data-setup="coach-name-submit"]')
    page.wait_for_selector('[data-diff]', timeout=10000)

def set_theme(page, mode):
    page.evaluate(f"""() => {{
      const b = document.querySelector('[data-action="theme"][data-mode="{mode}"]');
      if (b) b.click();
    }}""")
    page.wait_for_timeout(400)

with sync_playwright() as pw:
    # ── 1280px light ──
    browser, page = new_page(pw, 1280, 800)
    page.goto(BASE)
    page.wait_for_selector("#setup-content, #home-slots", timeout=15000)
    shot(page, "home-1280-light")
    start_dynasty(page)
    shot(page, "difficulty-1280-light")
    hdr = page.inner_text(".setup-hero")
    print("difficulty header:", " | ".join(hdr.split("\n")[:2]), flush=True)
    set_theme(page, "dark")
    page.wait_for_selector('[data-diff]', timeout=10000)
    shot(page, "difficulty-1280-dark")
    page.click('[data-diff="normal"]')
    page.click('[data-setup="diff-submit"]')
    page.wait_for_selector('[data-setup="job-sort"]', timeout=15000)
    shot(page, "joboffers-1280-light")
    for s in ["ovr", "prestige", "name"]:
        page.click(f'[data-setup="job-sort"][data-sort="{s}"]')
        page.wait_for_timeout(300)
    first = page.inner_text('tbody tr td:nth-child(2)')
    print("after sort-name, first row:", first.split("\n")[0], flush=True)
    page.click('[data-setup="job-random"]')
    page.wait_for_selector('[data-setup="start-dynasty"]', timeout=15000)
    page.click('[data-setup="start-dynasty"]')
    page.wait_for_selector('#dash-content', timeout=15000)
    page.wait_for_timeout(1500)
    navbtn = page.query_selector('#main-nav [data-view="history"]')
    if navbtn:
        navbtn.click()
    else:
        page.evaluate("() => document.querySelector('#more-sheet [data-view=\"history\"]').click()")
    page.wait_for_selector("#history-content .hist-tabs", timeout=10000)
    shot(page, "history-seasons-1280-light")
    page.click('[data-histtab="coach"]')
    page.wait_for_timeout(400)
    shot(page, "history-coach-1280-light")
    page.click('[data-histtab="records"]')
    page.wait_for_timeout(400)
    shot(page, "history-records-1280-light")
    nav_txt = page.inner_text("#main-nav")
    print("nav has League leaders:", "League leaders" in nav_txt, flush=True)
    print("nav has Trophy room:", "Trophy room" in nav_txt, flush=True)
    browser.close()

    # ── 1600px light ──
    browser, page = new_page(pw, 1600, 900)
    page.goto(BASE)
    page.wait_for_selector("#setup-content, #home-slots", timeout=15000)
    shot(page, "home-1600-light")
    browser.close()

    # ── 390px ──
    browser, page = new_page(pw, 390, 844)
    page.goto(BASE)
    page.wait_for_selector("#setup-content, #home-slots", timeout=15000)
    shot(page, "home-390-light")
    start_dynasty(page)
    set_theme(page, "dark")
    shot(page, "difficulty-390-dark")
    browser.close()

print("\n=== console errors ===", flush=True)
seen = set()
for e in errors:
    if e not in seen:
        seen.add(e)
        print(e, flush=True)
if not seen:
    print("zero console errors", flush=True)
