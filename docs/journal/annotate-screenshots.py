"""Annotate Giftwell screenshots: numbered orange boxes + a legend strip below.
Coordinates are in source-image pixels. Usage: annotate.py SRC_DIR OUT_DIR"""
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

SRC, OUT = Path(sys.argv[1]), Path(sys.argv[2])
ORANGE, BG, TEXT = (255, 122, 26), (14, 19, 36), (230, 233, 242)
REG = "/System/Library/Fonts/Supplemental/Arial.ttf"
BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"
MAXW = 3000  # never upscale; keep native resolution for the popup
THUMB = 1100

S = 1.47  # 20-thank-you-survey.png was viewed at 2000px wide; source is 2940
def sc(*r): return tuple(round(v * S) for v in r)

SHOTS = {
    "giftwell-gift-wrap-offer": ("16-gift-wrap-offer.jpg", (218, 70, 1240, 779), [
        ((818, 192, 1217, 332), "Gift wrap offer: a Checkout UI extension under the order lines. One click adds the $5 gift wrap product."),
        ((893, 146, 1080, 164), "Discount Function: 2 units of wax reach the 10% tier on their own, with no code.", "r"),
        ((238, 689, 737, 777), "Gift message: a second Checkout UI extension. The note is saved to the order."),
    ]),
    "giftwell-gift-wrap-added": ("17-gift-wrap-added.jpg", (218, 70, 1240, 779), [
        ((815, 182, 1224, 250), "Gift wrap added as its own $5 line.", "tr"),
        ((830, 350, 1205, 398), "The extension confirms it and offers Remove."),
        ((815, 601, 1003, 624), "Savings stay at $4.98: gift wrap is tagged giftwell-exclude, so the discount Function doesn't count it.", "r"),
    ]),
    "giftwell-tier-15": ("06-checkout-tier-15-percent.png", None, [
        ((176, 234, 544, 266), "BUY 3+, SAVE 15%: with 3 units, the Discount Function picks the higher tier.", "r"),
        ((20, 322, 820, 420), "No discount code entered. It's an automatic app discount."),
    ]),
    "giftwell-tier-20-from-settings": ("25-checkout-new-tier-20-percent.png", None, [
        ((152, 75, 472, 105), "New 5+ tier at 20%, added on the settings page. No code change, no redeploy.", "r"),
        ((26, 690, 352, 724), "$629.95 off 5 snowboards.", "r"),
    ]),
    "giftwell-cod-shown": ("14-cod-shown-under-200.jpg", (218, 0, 1240, 680), [
        ((238, 506, 737, 553), "Cash on delivery is offered: this order is under the $200 limit."),
        ((810, 264, 1226, 299), "Order total: $52.92.", "l"),
    ]),
    "giftwell-cod-hidden": ("15-cod-hidden-over-200.jpg", (218, 0, 1240, 680), [
        ((230, 108, 742, 170), "Card only. The Payment Customization Function hid cash on delivery.", "r"),
        ((810, 264, 1226, 299), "Order total: $600, over the $200 limit set in the app.", "l"),
    ]),
    "giftwell-max-per-product": ("13-cart-max-per-product.jpg", (30, 130, 1180, 480), [
        ((768, 298, 914, 349), "Trying to add a 6th unit.", "l"),
        ((766, 355, 1052, 422), "The Cart and Checkout Validation Function blocks it and names the product. The same rule runs in checkout.", "l"),
        ((196, 378, 332, 400), "The discount Function's label shows in the cart too.", "r"),
    ]),
    "giftwell-thank-you-survey": ("20-thank-you-survey.png", sc(310, 120, 1030, 745), [
        (sc(344, 344, 645, 636), "Thank-you page extension: one quick question for every buyer.", "l"),
        (sc(350, 648, 443, 716), "Send posts the answer to the app with a checkout session token. The server verifies it and saves one answer per order.", "l"),
    ]),
    "giftwell-admin-gift-details": ("18-admin-gift-details-block.png", None, [
        ((42, 103, 288, 162), "Admin UI extension on the order page.", "l"),
        ((48, 172, 190, 222), "Shown when the order has a gift message or gift wrap.", "l"),
        ((54, 247, 1510, 354), "The buyer's gift message, copied from the cart to the order.", "l"),
    ]),
    "giftwell-settings-page": ("22-settings-page.jpg", (220, 60, 1450, 652), [
        ((290, 82, 1053, 137), "Live status of all three Functions.", "l"),
        ((300, 267, 1042, 484), "Discount tiers. Saving writes JSON to the Function's metafield.", "l"),
        ((300, 562, 1042, 628), "Cash on delivery limit. Orders above it can only pay by card.", "l"),
        ((1088, 78, 1390, 446), "Answers from the thank-you page survey.", "l"),
    ]),
}


def wrap(draw, text, font, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = f"{cur} {w}".strip()
        if draw.textlength(t, font=font) <= width:
            cur = t
        else:
            lines.append(cur); cur = w
    lines.append(cur)
    return lines


def render(name, src, crop, notes):
    im = Image.open(SRC / src).convert("RGB")
    ox, oy = (crop[0], crop[1]) if crop else (0, 0)
    if crop:
        im = im.crop(crop)
    k = min(1.0, MAXW / im.width)
    if k < 1:
        im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    W = im.width
    u = max(W / 1000, 1.0)  # unit for line widths and fonts
    lw, r = max(3, round(4 * u)), round(17 * u)
    fnum = ImageFont.truetype(BOLD, round(19 * u))
    ftxt = ImageFont.truetype(REG, round(20 * u))
    d = ImageDraw.Draw(im)
    for n, (box, _, *pos) in enumerate(notes, 1):
        pos = pos[0] if pos else "tl"
        x0, y0, x1, y1 = [round((v - o) * k) for v, o in zip(box, (ox, oy, ox, oy))]
        d.rounded_rectangle((x0, y0, x1, y1), radius=round(8 * u), outline=ORANGE, width=lw)
        cx, cy = {"tl": (x0, y0), "tr": (x1, y0), "r": (x1 + r - lw, (y0 + y1) // 2), "l": (x0 - r + lw, (y0 + y1) // 2), "bl": (x0, y1)}[pos]
        cx = min(max(cx, r + 2), W - r - 2); cy = min(max(cy, r + 2), im.height - r - 2)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=ORANGE, outline=(255, 255, 255), width=max(2, round(2 * u)))
        d.text((cx, cy), str(n), font=fnum, fill=(10, 10, 10), anchor="mm")
    # legend
    pad, gap, lh = round(24 * u), round(14 * u), round(28 * u)
    tx = pad + 2 * r + round(14 * u)
    blocks = [wrap(d, t, ftxt, W - tx - pad) for _, t, *_ in notes]
    hgt = pad * 2 + sum(max(len(b) * lh, 2 * r) for b in blocks) + gap * (len(blocks) - 1)
    out = Image.new("RGB", (W, im.height + hgt), BG)
    out.paste(im, (0, 0))
    d = ImageDraw.Draw(out)
    y = im.height + pad
    for n, lines in enumerate(blocks, 1):
        cy = y + r
        d.ellipse((pad, cy - r, pad + 2 * r, cy + r), fill=ORANGE)
        d.text((pad + r, cy), str(n), font=fnum, fill=(10, 10, 10), anchor="mm")
        ty = y + r - lh // 2 if len(lines) == 1 else y
        for i, line in enumerate(lines):
            d.text((tx, ty + i * lh + lh // 2), line, font=ftxt, fill=TEXT, anchor="lm")
        y += max(len(lines) * lh, 2 * r) + gap
    out.save(OUT / f"{name}-full.webp", "WEBP", quality=90, method=6)
    tw = min(THUMB, out.width)
    out.resize((tw, round(out.height * tw / out.width)), Image.LANCZOS).save(OUT / f"{name}.webp", "WEBP", quality=84, method=6)
    return out.size


only = sys.argv[3:] or SHOTS
for name in only:
    print(name, render(name, *SHOTS[name]))
