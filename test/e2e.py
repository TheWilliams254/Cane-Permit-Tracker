import io, re, sys, time
from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:3100"
SHOT = "/home/claude/cpt/test/shots"
import os; os.makedirs(SHOT, exist_ok=True)


import sys
_pages=[]
def _hook(t,v,tb):
    import traceback; traceback.print_exception(t,v,tb)
    for i,pg in enumerate(_pages):
        try: pg.screenshot(path=f"{SHOT}/FAIL-{i}.png", full_page=True); print("saved", f"{SHOT}/FAIL-{i}.png", pg.url)
        except Exception as e: print("shot failed", e)
sys.excepthook=_hook

def expect_text(page, text, name="fail"):
    try:
        page.wait_for_selector(f"text={text}", timeout=30000)
    except Exception:
        page.screenshot(path=f"{SHOT}/FAIL-{name}.png", full_page=True)
        print("FAILED waiting for:", text, "| url:", page.url)
        for pnl in page.locator(".panel").all()[:6]:
            t = pnl.inner_text().strip().replace("\n", " | ")
            if t: print("  PANEL:", t[:400])
        raise

def jpeg(text):
    im = Image.new("RGB", (1200, 900), (230, 230, 220))
    d = ImageDraw.Draw(im); d.rectangle([40, 40, 1160, 860], outline=(20, 60, 30), width=8); d.text((80, 80), text, fill=(0, 0, 0))
    b = io.BytesIO(); im.save(b, "JPEG", quality=85); return b.getvalue()

def login(ctx, user, pw, first=False, newpw="Password-123"):
    page = ctx.new_page(); _pages.append(page)
    page.goto(BASE + "/login")
    page.fill("#username", user); page.fill("#password", pw); page.click("button[type=submit]")
    page.wait_for_url(re.compile(r"/account\?first=1|/admin|/entries|/queue"), timeout=60000)
    if first:
        assert "/account" in page.url, page.url
        page.fill("#current", pw); page.fill("#next", newpw); page.fill("#confirm", newpw)
        page.click("button:has-text('Change password')")
        page.wait_for_selector("text=Password changed.", timeout=60000)
        page.click("text=Continue")
        page.wait_for_url(re.compile(r"/admin|/entries|/queue"), timeout=60000)
    return page

import traceback
with sync_playwright() as p:
    browser = p.chromium.launch()
    results = []
    try:
        pass
    except Exception: pass
    # ---------- Admin ----------
    admin_ctx = browser.new_context(viewport={"width": 1280, "height": 900})
    admin = login(admin_ctx, "admin", "ChangeMe-2026", first=True)
    assert admin.url.endswith("/admin"), admin.url
    admin.screenshot(path=f"{SHOT}/01-admin-overview-empty.png", full_page=True)

    creds = {}
    admin.goto(BASE + "/admin/users")
    for uname, name, role in [("scout1", "Jane Scout", "SCOUT"), ("cc1", "Call Agent", "CALL_CENTER"), ("it1", "IT Checker", "IT_CHECKER"),
                              ("legal1", "Legal Officer", "LEGAL"), ("permit1", "Permit Officer", "PERMIT_OFFICER"), ("gis1", "GIS Officer", "GIS_OFFICER")]:
        admin.fill("#u-name", name); admin.fill("#u-username", uname); admin.select_option("#u-role", role)
        admin.click("text=Create user")
        admin.wait_for_selector(f"text=Temporary password for {uname}", timeout=30000)
        creds[uname] = admin.locator(".font-mono").inner_text().strip()
    admin.screenshot(path=f"{SHOT}/02-admin-users.png", full_page=True)
    results.append(("admin creates 6 users", True))

    # ---------- Scout: capture ----------
    scout_ctx = browser.new_context(viewport={"width": 412, "height": 915}, is_mobile=True, has_touch=True, device_scale_factor=2,
                                    geolocation={"latitude": -1.0517, "longitude": 34.5981}, permissions=["geolocation"])
    scout = login(scout_ctx, "scout1", creds["scout1"], first=True)
    assert "/entries" in scout.url
    scout.goto(BASE + "/entries/new")
    scout.wait_for_selector("#f-name")
    scout.fill("#f-name", "Wilson Otieno Ochieng"); scout.fill("#f-phone", "0712345678"); scout.fill("#f-id", "23456789")
    scout.fill("#f-lr", "Kanyamkago/Kakrao/1234"); scout.fill("#f-trips", "12"); scout.fill("#f-subloc", "Kakrao"); scout.fill("#f-area", "Oyani")
    # Polygon: four taps around Oyani CBC on the map
    m = scout.locator("[aria-label='Field map']")
    m.scroll_into_view_if_needed(); time.sleep(1.5)
    box = m.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    # zoom in via GPS corner first so taps are field-sized
    scout.click("text=Add corner at my position"); time.sleep(2)
    for dx, dy in [(60, -40), (70, 50), (-50, 60)]:
        scout.mouse.click(cx + dx, cy + dy); time.sleep(0.4)
    expect(scout.locator("text=Corners").locator("..").locator("p").nth(1)).to_have_text("4")
    zone_txt = scout.locator("text=Transport zone").locator("..").inner_text()
    print("ZONE PANEL:", zone_txt.replace("\n", " | "))
    scout.select_option("#f-harv", index=1)
    scout.select_option("#f-bank", label="EQUITY BANK KENYA LTD")
    scout.fill("#f-acct", "1234567890123"); scout.fill("#f-acctname", "Wilson Otieno Ochieng"); scout.fill("#f-branch", "Migori")
    files = scout.locator("input[type=file][accept='image/*']")
    for i, lbl in enumerate(["bank-card", "id-front", "id-back", "farmer"]):
        files.nth(i).set_input_files({"name": f"{lbl}.jpg", "mimeType": "image/jpeg", "buffer": jpeg(lbl)})
        time.sleep(1.2)
    scout.wait_for_function("() => document.querySelectorAll('img[alt=\"ID card, front\"],img[alt=\"ID card, back\"],img[alt=\"Farmer\"],img[alt=\"Bank card or passbook\"]').length === 4", timeout=30000)
    # consent + signature
    boxes = scout.locator("input[type=checkbox]")
    boxes.nth(0).check(); boxes.nth(1).check()
    sig = scout.locator("canvas[aria-label='Signature area']"); sig.evaluate("e => e.scrollIntoView({block: 'center'})"); time.sleep(0.6); sb = sig.bounding_box()
    scout.mouse.move(sb["x"] + 20, sb["y"] + 80); scout.mouse.down()
    for i in range(1, 30): scout.mouse.move(sb["x"] + 20 + i * 8, sb["y"] + 80 + (20 if i % 2 else -20))
    scout.mouse.up()
    scout.wait_for_selector("text=Signature captured.")
    scout.screenshot(path=f"{SHOT}/03-scout-form.png", full_page=True)
    scout.click("text=Submit for confirmation")
    scout.wait_for_url(re.compile(r"/entries/[0-9a-f-]+\?saved=1"), timeout=60000)
    entry_url = scout.url.split("?")[0]
    scout.wait_for_selector("text=Waiting on")
    scout.screenshot(path=f"{SHOT}/04-scout-entry-detail.png", full_page=True)
    results.append(("scout submits entry", True))

    # second entry for the return path (reuse: quicker, minimal)
    scout.goto(BASE + "/entries/new"); scout.wait_for_selector("#f-name")
    scout.fill("#f-name", "Mary Akinyi"); scout.fill("#f-phone", "0722000111"); scout.fill("#f-id", "3344556"); scout.fill("#f-lr", "Suna/West/77")
    scout.fill("#f-trips", "5"); scout.fill("#f-subloc", "Nyaoke"); scout.fill("#f-area", "Nyaoke")
    m = scout.locator("[aria-label='Field map']"); m.scroll_into_view_if_needed(); time.sleep(1.5); box = m.bounding_box()
    cx, cy = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    scout.click("text=Add corner at my position"); time.sleep(2)
    for dx, dy in [(40, -30), (50, 40), (-40, 40)]: scout.mouse.click(cx + dx, cy + dy); time.sleep(0.4)
    scout.select_option("#f-harv", index=2); scout.select_option("#f-bank", label="FAMILY BANK"); scout.fill("#f-acct", "123456789012")
    scout.fill("#f-acctname", "Mary Akinyi"); scout.fill("#f-branch", "Awendo")
    files = scout.locator("input[type=file][accept='image/*']")
    for i, lbl in enumerate(["bank-card", "id-front", "id-back", "farmer"]):
        files.nth(i).set_input_files({"name": f"{lbl}.jpg", "mimeType": "image/jpeg", "buffer": jpeg(lbl)}); time.sleep(1.0)
    scout.wait_for_function("() => document.querySelectorAll('img[alt=\"ID card, front\"],img[alt=\"ID card, back\"],img[alt=\"Farmer\"]').length === 3", timeout=30000)
    boxes = scout.locator("input[type=checkbox]"); boxes.nth(0).check(); boxes.nth(1).check()
    sig = scout.locator("canvas[aria-label='Signature area']"); sig.evaluate("e => e.scrollIntoView({block: 'center'})"); time.sleep(0.6); sb = sig.bounding_box()
    scout.mouse.move(sb["x"] + 20, sb["y"] + 60); scout.mouse.down(); scout.mouse.move(sb["x"] + 200, sb["y"] + 100); scout.mouse.up()
    scout.click("text=Submit for confirmation"); scout.wait_for_url(re.compile(r"/entries/[0-9a-f-]+\?saved=1"), timeout=60000)
    entry2_url = scout.url.split("?")[0]

    # ---------- Call centre ----------
    def stage_user(uname, vw=1280):
        ctx = browser.new_context(viewport={"width": vw, "height": 900})
        pg = login(ctx, uname, creds[uname], first=True)
        assert pg.url.endswith("/queue"), pg.url
        return pg

    cc = stage_user("cc1")
    expect(cc.locator("table >> text=Wilson Otieno Ochieng").first).to_be_visible()
    cc.screenshot(path=f"{SHOT}/05-callcenter-queue.png", full_page=True)
    cc.goto(BASE + entry_url.replace(BASE, "")); cc.wait_for_selector("text=Waiting on you", state="visible")
    # log a failed attempt first
    cc.click("role=tab[name='Not reachable']"); cc.fill("#call-notes", "Phone switched off"); cc.click("text=Log attempt")
    cc.wait_for_selector("text=Call attempt logged")
    cc.reload(); cc.wait_for_selector("input[name=check_name]")
    for b in cc.locator("form >> input[type=checkbox][name^='check_']").all(): b.check()
    cc.fill("#notes", "Farmer confirmed everything; asked about payment timing.")
    cc.click("form >> button[type=submit]")
    expect_text(cc, "Farmer confirmation call completed.", "Farmer confirmation call completed.")
    cc.screenshot(path=f"{SHOT}/06-callcenter-done.png", full_page=True)
    # return the second entry
    cc.goto(BASE + entry2_url.replace(BASE, "")); cc.wait_for_selector("text=Waiting on you", state="visible")
    cc.click("role=tab[name='Return to scout']"); cc.fill("#reason", "Farmer says the plot number is Suna/West/771, not 77."); cc.click("form >> button[type=submit]")
    expect_text(cc, "Returned to the scout.", "return")
    cc.goto(BASE + "/completed"); expect(cc.locator("table >> text=Wilson Otieno Ochieng").first).to_be_visible(); expect(cc.locator("table >> text=Mary Akinyi").first).to_be_visible()
    cc.screenshot(path=f"{SHOT}/07-callcenter-completed.png", full_page=True)
    results.append(("call centre: attempt, confirm, return, completed list", True))

    # scout corrects and resubmits entry 2
    scout.goto(BASE + "/entries"); expect(scout.locator("span:has-text('Returned to scout')").first).to_be_visible()
    scout.screenshot(path=f"{SHOT}/08-scout-my-entries.png", full_page=True)
    scout.goto(BASE + entry2_url.replace(BASE, "") + "/edit"); scout.wait_for_selector("#f-lr")
    expect(scout.locator("text=Returned for correction")).to_be_visible()
    scout.fill("#f-lr", "Suna/West/771"); scout.click("text=Resubmit entry")
    scout.wait_for_url(re.compile(r"/entries/[0-9a-f-]+\?saved=1"), timeout=60000)
    results.append(("scout corrects a returned entry", True))

    # ---------- IT data check ----------
    it = stage_user("it1")
    expect(it.locator("h2:has-text('Data check')")).to_be_visible(); expect(it.locator("h2:has-text('ERP entry')")).to_be_visible()
    it.screenshot(path=f"{SHOT}/09-it-queue.png", full_page=True)
    it.goto(BASE + entry_url.replace(BASE, "")); it.wait_for_selector("text=Waiting on you", state="visible")
    for b in it.locator("form >> input[type=checkbox][name^='check_']").all(): b.check()
    it.click("form >> button[type=submit]"); expect_text(it, "Data check completed.", "Data check completed.")

    # ---------- IT ERP ----------
    it.goto(BASE + entry_url.replace(BASE, "")); it.wait_for_selector("text=ERP entry")
    it.fill("#erpFarmerCode", "FRM-10233"); it.fill("#erpFieldCode", "FLD-10233-01"); it.click("form >> button[type=submit]"); expect_text(it, "ERP entry completed.", "ERP entry completed.")

    # ---------- Permit ----------
    permit = stage_user("permit1")
    permit.goto(BASE + entry_url.replace(BASE, "")); permit.wait_for_selector("text=Permit and CCS clips")
    permit.fill("#permitNumber", "HP-2026-0317"); permit.fill("#ccsClips", "1041–1052"); permit.click("form >> button[type=submit]"); expect_text(permit, "Permit and CCS clips completed.", "Permit and CCS clips completed.")

    # ---------- Legal ----------
    legal = stage_user("legal1")
    legal.goto(BASE + entry_url.replace(BASE, "")); legal.wait_for_selector("text=Waiting on you", state="visible")
    legal.check("input[name=check_idCopy]"); legal.check("input[name=check_signedTerms]"); legal.check("input[name=check_bankProof]")
    legal.fill("#fileRef", "LEG/2026/0042"); legal.click("form >> button[type=submit]"); expect_text(legal, "Physical documents completed.", "Physical documents completed.")
    legal.screenshot(path=f"{SHOT}/10-legal-done.png", full_page=True)

    # ---------- GIS ----------
    gis = stage_user("gis1")
    gis.goto(BASE + entry_url.replace(BASE, "")); gis.wait_for_selector("text=GIS zoning review")
    gis.check("input[name=gisFieldInspected]"); gis.check("input[name=gisPolygonReviewed]")
    print("GIS zone default:", gis.locator("#gisZone").input_value(), "cbc:", gis.locator("#gisCbcId").input_value()[:8], "dist:", gis.locator("#gisDistanceKm").input_value())
    gis.click("form >> button[type=submit]"); expect_text(gis, "GIS zoning review completed.", "GIS zoning review completed.")
    gis.click("text=View updated entry"); gis.wait_for_selector("text=Complete: permit issued and zone confirmed.")
    gis.screenshot(path=f"{SHOT}/11-entry-complete.png", full_page=True)
    results.append(("full pipeline to ZONED", True))

    # ---------- Admin checks ----------
    admin.goto(BASE + "/admin"); admin.wait_for_selector("text=Where entries are waiting")
    admin.screenshot(path=f"{SHOT}/12-admin-overview.png", full_page=True)
    admin.goto(BASE + "/entries"); expect(admin.locator("table >> text=Wilson Otieno Ochieng").first).to_be_visible(); expect(admin.locator("table >> text=Mary Akinyi").first).to_be_visible()
    admin.screenshot(path=f"{SHOT}/13-admin-all-entries.png", full_page=True)
    with admin.expect_download() as dl:
        admin.click("text=Download CSV")
    path = dl.value.path(); csv = open(path, encoding="utf-8-sig").read().splitlines()
    print("CSV rows:", len(csv) - 1, "| header cols:", len(csv[0].split(",")))
    assert len(csv) == 3
    results.append(("admin overview, all entries, CSV export", True))

    # ---------- Access control ----------
    r = scout.goto(BASE + "/admin"); assert "/entries" in scout.url or "/admin" not in scout.url, scout.url
    r = cc.goto(BASE + entry_url.replace(BASE, "")); cc.wait_for_load_state()
    assert "Wilson" in cc.content(), "call centre should still see an entry it acted on"
    cc.goto(BASE + "/entries"); assert "/entries" not in cc.url or "All entries" not in cc.content()
    anon = browser.new_context().new_page(); anon.goto(BASE + "/queue"); assert "/login" in anon.url
    results.append(("role gating + anonymous redirect", True))

    for name, ok in results: print(("PASS " if ok else "FAIL ") + name)
    browser.close()
