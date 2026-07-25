# The Obsessn — theobsessn.com

Static site. **Zero runtime dependencies** — no framework, no build step, no
package manager. Push to `main` and GitHub Pages serves it.

```
index.html      markup + head (meta, JSON-LD, font + module preloads)
404.html        branded not-found page, reuses the design system
styles.css      design tokens + all styling, incl. every @media preference block
js/main.js      entry: preloader → gate → Ivy → site handoff
js/gl.js        WebGL2 atmosphere (hand-written GLSL, no library)
js/ivy.js       the spoken intro: audio, FFT, lyric cues
js/motion.js    reveals, cursor, nav, marquee, tilt, parallax, counters
ivy-intro.mp3   Ivy's voice track (51.76s)
assets/         logo derivatives, generated OG card, favicons
```

Local preview: `python3 -m http.server 4321`

Useful URLs: `?nointro=1` skips the intro · `?ivy=1` replays it · a deep link
like `#music` skips it automatically.

---

## Making common edits

Everything is plain HTML/CSS/JS — edit, save, reload. No build step.

**Change the tagline** — `index.html`, `.hero-lede`. It also appears in the meta
description, `og:description`, `twitter:description`, the JSON-LD `description`,
and `llms.txt`. Change all of them together or they will disagree.

**Add or edit an era** — copy a `.era` row in `index.html`. Bump `.era-no`, and
give each new row a slightly larger `--d` so it reveals after the one above:

```html
<div class="era" data-reveal="left" style="--d:.30s">
  <span class="era-no">06</span>
  <h3 class="era-name">Name</h3>
  <p class="era-desc">One line.</p>
  <span class="era-arrow">↘</span>
</div>
```

**Add a streaming platform** — copy a `.plat` card. `--plat` is that brand's
colour and drives the icon, border and hover glow. Add the same URL to
`llms.txt` and to `sameAs` in the JSON-LD.

**Clean the URL before you paste it.** The share button on these services hands
you a link that is wrong for a website in two ways, and both shipped here once:

- **Strip the tracking parameter.** Spotify's share link carries `?si=<token>`,
  a share-session id. It rode on all five clickable Spotify links while the
  JSON-LD had the clean one — a giveaway that it was pasted, not chosen.
- **Strip the country code.** `music.apple.com/tr/artist/…` pins every visitor
  to the Turkish storefront. Drop the `/tr/` and Apple redirects each person to
  their own store; the artist resolves in every storefront checked (us, gb, de,
  jp). Same idea for any service with a regional path.

Prefer the URL that resolves in **zero** redirects — `www.instagram.com`,
`x.com`, `www.tiktok.com` — rather than the short forms, which each cost a hop.
The Apple Music link is the one deliberate exception: its single redirect *is*
the storefront adapting to the visitor.

**Add a social link** — copy a `.social` card; `--soc` works like `--plat`.

**Change Ivy's words or timings** — `CUES` in `js/ivy.js`. `t` is seconds into
`ivy-intro.mp3`; `text: null` clears the screen. Replacing the audio means
re-timing every cue. The full script, with stage directions, is transcribed
in the comment above `CUES`.

**Change the accent colour** — `--crimson`, `--crimson-bright`, `--ember` in
`styles.css`. `--crimson-text` is the small-text variant and is deliberately
lighter so it clears WCAG AA; it is overridden again for `prefers-contrast: more`
and for print. Re-check contrast after changing any of them — a dead selector
once hid a 2.93:1 accent for the entire life of the marquee.

**Swap the logo** — replace `TheObsessn.PNG`, then regenerate the derivatives:

```sh
brew install webp ffmpeg          # cwebp and ffmpeg are not on a stock Mac

cwebp -q 88 -resize 512 512 TheObsessn.PNG -o assets/logo-512.webp
cwebp -q 88 -resize 96  96  TheObsessn.PNG -o assets/logo-96.webp

# Palette-quantised PNGs. Two settings here are measured, not guessed — keep them.
#
#   max_colors=64   The mark is one hue: a white glyph bleeding into a red glow.
#                   Against a truecolour render, 64 colours scores 42.7 dB PSNR
#                   (>40 is the visually-lossless threshold) at 35% smaller than
#                   the 255 this recipe used to specify. 32 measures 40.1 dB but
#                   visibly tightens the outer halo — 64 is the floor worth using.
#
#   dither=none     Counter-intuitive but consistent at every palette size: no
#                   dithering is BOTH smaller and higher-fidelity here. The source
#                   glow already carries film grain, which dithers it naturally;
#                   adding error-diffusion on top just injects noise that hurts
#                   compression and PSNR at once.
#
# Sizes are load-bearing: Chrome fetches exactly ONE manifest icon per page load
# and picks the one nearest ~192px — currently the 180. Don't drop that entry to
# "de-duplicate" the manifest; Chrome then falls to fav-192 and the page gets
# heavier. See "Generated assets".
ffmpeg -y -i TheObsessn.PNG -vf "scale=512:512:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none" assets/logo-512.png
ffmpeg -y -i TheObsessn.PNG -vf "scale=192:192:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none" assets/fav-192.png
ffmpeg -y -i TheObsessn.PNG -vf "scale=180:180:flags=lanczos,split[a][b];[a]palettegen=max_colors=64[p];[b][p]paletteuse=dither=none" assets/apple-touch-icon.png
sips -Z 32 -s format png TheObsessn.PNG --out assets/fav-32.png   # sips ships with macOS
```

`favicon.ico` also needs rebuilding. `sips` cannot write ICO and ImageMagick is
not stock, so pack it by hand — an ICO is just a header plus concatenated PNGs,
and every browser the site targets accepts PNG-compressed entries:

```sh
for s in 16 32 48 64; do sips -Z $s -s format png TheObsessn.PNG --out ico-$s.png; done
python3 - <<'EOF'
import struct
sizes = [16, 32, 48, 64]
imgs = [open(f'ico-{s}.png', 'rb').read() for s in sizes]
out = struct.pack('<HHH', 0, 1, len(sizes))
off = 6 + 16 * len(sizes)
for s, d in zip(sizes, imgs):
    out += struct.pack('<BBBBHHII', s, s, 0, 0, 1, 32, len(d), off)
    off += len(d)
open('favicon.ico', 'wb').write(out + b''.join(imgs))
EOF
rm ico-16.png ico-32.png ico-48.png ico-64.png
```

…then re-render the OG card (see *Generated assets*).

**Renaming a section `id`** — add the old anchor to `LEGACY_HASH` in
`js/main.js`. The rewrite renamed `#hero`→`#top` and `#about`→`#story`, and
links to the old ones exist in the wild; without the map they land at the top
of the page with no scroll and no explanation. Verified: `#hero` rewrites to
`#top` and shows the gate (it is the top of the page, so not a deep link),
`#about` rewrites to `#story` and goes straight in scrolled to the section, and
an unknown hash is left alone and boots normally. Deep links land 108px above
the section's own top — that is `scroll-margin-top: clamp(4.5rem, 12vh, 7rem)`
resolving to 12vh at a 900px viewport, which is the fixed nav being accounted
for, not a miss.

**Add a section** — give it an `id`, add a `.nav-link` with a matching
`data-sec`, and add the anchor to `llms.txt`. The active-nav logic finds
sections automatically; nothing else needs wiring.

**Add a JS file** — add a `<link rel="modulepreload">` for it in `index.html`,
or it falls back to late discovery.

---

## Decisions that look arbitrary but aren't

Everything below was measured or tested. Each one will look like cruft to a
future reader; each one breaks something real if removed.

### Typography

**`@font-face 'Display Fallback'` with `size-adjust: 85%`**
If Google Fonts is blocked (privacy networks, some regions) the wordmark falls
back to a system face. Measured at 216px, "OBSESSN" is **663px** in Bricolage
`wdth 78` but **1152px** in Arial Black — enough to run straight over the hero
mark. Impact is the closest widely-installed face (779px); `size-adjust: 85%`
closes the gap. Verified: overlap went 374px → 0.

**`.hero-title .ln { width: fit-content }`**
`background-clip: text` paints across the element's *box*. Without
`fit-content` the `.ln` is full-column-width, so the gradient's ink stops
swallow the whole word and the no-JS tint fallback renders flat white.

**Per-character tint is applied in JS, not CSS**
`background-clip: text` cannot survive being split into per-character spans.
`splitText()` in `motion.js` bakes the ramp per character. The CSS
`:not(:has(.ch))` rule is the fallback for before/without JS.

**Fonts load async; the preloader waits on specific faces**
The stylesheet is `media="print"` until `onload`, so it never blocks first
paint (FCP 1340ms → 140ms). But that also means `document.fonts.ready`
resolves before anything is requested — so `fonts()` asks for the two faces the
gate actually renders in.

### Layout

**The root URL is `https://theobsessn.com/` — with the trailing slash — in all four places**
`sitemap.xml`'s `<loc>` had the slash while `canonical`, `og:url` and the JSON-LD `url` did
not. The origin serves `/`, and a sitemap `<loc>` is supposed to be byte-identical to the
canonical it points at, so all four now agree on the slashed form. If you edit one, edit
all four; there is a check for it in the audit note below.

**Metadata audit — everything the site references resolves (verified, not assumed)**
Every local reference in `index.html`, `404.html` and `site.webmanifest` returns 200: all
four manifest icons (`fav-32.png`, `fav-192.png`, `apple-touch-icon.png`, `logo-512.png` —
note the manifest wants **PNG**, while the page itself uses the `.webp` variants), the four
JS modules, `styles.css`, `favicon.ico`, and `og.jpg`. The OG card is genuinely 1200×630,
matching its declared `og:image:width/height`. The single JSON-LD block is valid JSON.

Two things worth not re-deriving:
- **`TheObsessn.PNG` casing is correct.** The JSON-LD `image` points at
  `/TheObsessn.PNG` and the file on disk (and in git) is exactly that. This matters because
  macOS is case-*insensitive* and GitHub Pages is case-*sensitive* — a local 200 proves
  nothing here, so it was checked against `git ls-files`.
- **Deep links and the legacy hash remap work.** `#music` → 3652px, `#connect` → 4856px,
  and the legacy `#about` → rewritten to `#story` (805px), `#hero` → `#top` (0px), all with
  the intro skipped. Sections land 96px down, which is `scroll-margin-top` clearing the
  fixed nav. **Test these with a cache-busting query** (`?t=2#about`): a hash-only change in
  the same tab is a *same-document* navigation, so `main.js` never re-runs and every hash
  appears to inherit the previous scroll position.

**`404.html` needed the same `<noscript>` painted sky, and has its own iris baseline**
The 404 page builds its atmosphere by importing `createAtmosphere` from `/js/gl.js` in a
module, so with JS disabled the canvas stays empty *and* nothing adds `.no-gl` — it fell
back to flat `--bg` exactly like index.html did (verified: `background-image: none`). It
now carries the same one-line `<noscript>` rule against the same `--painted-sky` token.

Its standing baseline is **`iris look /404.html` → 2 high · 0 medium · 0 low · 0 console**.
Both highs are `.lost-mark` / its `img` bleeding ~109px past the right edge, which is the
deliberate off-canvas bleed the inline `overflow: clip` comment already describes — the
same accepted category as the hero mark on index. Note iris's own headless Chrome has no
WebGL, so it reports selectors under `body.no-gl`: those runs double as free verification
that the no-WebGL fallback renders correctly. `@keyframes markSpin` used by `.lost-mark`
lives in `styles.css` (not the page's inline `<style>`), so it is not dead CSS.

**`--painted-sky` is a token because two fallback paths need it**
The layered radial gradients that stand in for the live shader were declared inline on
`body.no-gl`. But `.no-gl` is added by **gl.js**, so with JavaScript disabled entirely
nothing ever adds it — and the `<noscript>` block did not supply a background either, so
a no-JS visitor got flat `--bg` (verified: `background-image: none`) while a no-WebGL
visitor got the full painted sky. A no-JS visitor was getting *less* atmosphere than a
no-WebGL one, which is backwards. The gradients now live in `--painted-sky` and both
paths reference it, so they cannot drift:

- `body.no-gl { background: var(--painted-sky) }` — WebGL missing or context lost.
- `<noscript>` → `body { background: var(--painted-sky) }` — no JS at all. The noscript
  `<style>` sits *after* `styles.css`, so it wins on order at equal specificity, and the
  token resolves from `:root`.

Verified all three paths: with JS+WebGL `body` keeps `background-image: none` (the canvas
paints, unchanged); forcing `.no-gl` still resolves to the gradients; JS-disabled now
renders them.

**`overflow: hidden` immediately before `overflow: clip`**
`clip` is Safari 16+. The `.hero` mark bleeds off-canvas by design; without a
fallback, older Safari scrolls sideways. `hidden` can't go on `html`/`body`
instead — that would break `position: sticky` on `.about-sticky`, which is
exactly the problem `clip` exists to solve. Verified with `clip` neutralised:
210px of horizontal scroll → 0, sticky still working.

**`100vh` immediately before every `100svh`** — `svh` is Safari 15.4+.

**Plain colour declarations before every `color-mix()`** — Safari 16.2+.

**`--readw` is 52ch, and `ch` does not mean "characters"**
`ch` is the advance width of the **zero glyph**. In this geometric sans a "0" is ~12.4px
while an average prose character is ~8.3px, so the original `62ch` was not a 62-character
measure — it was ~740–770px of line, and the body copy actually ran **74 median / 91 max
characters per line at every width from ~640px up, desktop included**. That is past the
45–75 comfort range and past WCAG 1.4.8's 80. `52ch` brings it to 49 median / 74 max:

| viewport | before (median/max) | after |
|---|---|---|
| 1440 (2-col) | 74 / **91** | 49 / **74** |
| 900 (1-col) | 74 / **91** | 49 / **74** |
| 720 (= 200% zoom) | 60 / **82** | 50 / **74** |
| 640 · 390 | 50/74 · 37/46 | unchanged |

If you retune this, **count rendered characters** — take `Range.getClientRects()` on each
paragraph, divide its text length by the number of line boxes. Do not reason from the `ch`
number; that is what produced a 91-character measure while looking like it said 62.

**`--t-mega` uses `min(15vw, 25vh)`**
Width-only sizing produced 142px type in 390px of height on a landscape phone,
pushing the entire CTA off-screen.

**`.plat` / `.social` get lower `min-height` floors under 480px** (section 16b)
The 240px / 180px floors are right for a ~427px-wide card in a row of three: the
space under the icon is poster framing, and it costs the page its height only
once. Stacked on a phone the card is ~280px wide, so the same absolute floor
made it *taller than wide* — 0.86 against the 0.75 the design uses at desktop —
and multiplied ~90px of dead air by three in Music and three again in Connect.
The 200px / 152px floors hold that designed ratio (0.71 / 0.54) at phone width.
Measured at 390px: page 6962px → 6758px, Music 1528 → 1408, Connect 867 → 783,
with 500px, 560px and 1440px byte-identical. Don't "simplify" these back into the
main `clamp()` — a clamp floor is absolute and cannot know the card got narrower.

**`transform-origin: left center` on the `.plat-icon` / `.social-icon` hover zoom**
`scale(1.08)` about the default centre grows a 42px icon by 3.36px, i.e. 1.68px on
*each* side, so on hover the icon's left edge slid 1.68px out past `.plat-name` and
`.plat-desc` and broke the single vertical rail the card is built on. Anchoring the
origin to the left keeps the identical zoom and lift while the rail holds: measured
icon-vs-name delta 1.68px → 0.01px, and `iris look --hover .plat` stops reporting
`almost-aligned`. Note this defect is invisible at rest — all three left edges are
exactly 90.59px — so it only ever shows up in a *hovered* render.

### Accessibility

**`inert` is set in `main.js`, not in the markup**
In markup it would apply to no-JS visitors too, leaving a page where nothing is
focusable. Paired with the `<noscript>` block and the 7-second failsafe, which
reveal the site if the module never boots.

**The heading outline is clean and split text keeps its accessible name**
Exactly one `<h1>` ("The Obsessn"), then h2 per section and h3 per card, with no
skipped levels. `splitText()` shatters the h1 into ten per-character `.ch` spans
across two lines, but the accessible name still computes to "The Obsessn" (the
spans are plain inline `<span>`s and the spaces are preserved as space
characters), so a screen reader announces the whole word, not the letters — no
`aria-label` needed. One heading *was* wrong: the footer CTA is
`Stay kind.<br>Stay obsessed.`, and a `<br>` contributes no separator to the
accessible name, so it computed as "Stay kind.Stay obsessed." with no space
between the sentences. The fix is a single space **before** the `<br>`
(`Stay kind. <br>…`) — invisible, because trailing whitespace collapses at the
end of a line box, but it restores the word boundary in the name. Do not "tidy"
that space away.

**The hovered `.plat-go` chip uses dark ink, not white**
On hover the chip fills with the *platform's* own colour, and streaming brands are
saturated mid-to-light. A white `→` measured **1.92:1 on Spotify green** and
**2.66:1 on SoundCloud orange** — the affordance vanished at the exact moment
hover was meant to confirm it. Dark ink reads 10.31 / 5.07 / 7.44:1 across the
three, and it is already what `.social-go` does (its worst case is Instagram at
4.56:1). Measured settled, with `:hover` forced by a real `Input.dispatchMouseEvent`
— at 400ms the transition is still mid-flight and the numbers lie. If a genuinely
dark brand colour is ever added, override `--plat-ink` on that card rather than
flipping the rule back.

**prefers-contrast / prefers-reduced-transparency: audited by rendering, and they hold**
Unlike the `forced-colors` and `print` blocks, these two were rendered and came back
essentially healthy. The check worth repeating is an **invariant, not a threshold**:
`prefers-contrast: more` must never make anything *worse* than the default. Measured
across 125 text-bearing elements in both modes — **84 improved, 41 unchanged, 0
regressed**, and every token moves the right way (`--ink-dim` .72→.93, `--ink-faint`
.57→.84, `--ink-trace` .14→.42, both hairlines up, `--crimson-text` lighter).

One genuine fix: `.footer-word` measured **2.74:1** in contrast mode, still under the 3:1
large-text bar *in the one mode where the visitor explicitly asked for more contrast*.
Now `0.40` alpha = 3.40:1. Safe to brighten because the wordmark is `position: static`
and owns its own band between the CTA and the footer bar — verified zero overlapping text
nodes, so it is not acting as a background for anything. On screen it stays the accepted
1.54:1 ghost; only the contrast-mode value changed.

`prefers-reduced-transparency: reduce` is clean: **zero** backdrop-blurred elements, and
the nav is opaque `rgb(13,13,16)` in both `.nav` and `.nav.stuck` — i.e. the specificity
fix noted in that block genuinely holds when you scroll past 40px. The two remaining
translucent values (`#nav-pill`, `.player-fallback`) are tints layered over surfaces that
are already opaque, not windows onto the page, so they are deliberate.

**print: the two most important links had no destination, and three controls were dead ink**
The `@media print` block was written but never actually printed. Rendering it (via
`Page.printToPDF`, or `Emulation.setEmulatedMedia { media: 'print' }` to screenshot it —
about 4.2 A4 sheets) found three things:

- **Both "Listen on Spotify" CTAs printed as bordered buttons with no URL.** The
  destination-append rule was enumerated by class (`.prose a[href^="http"]`, `.plat`,
  `.social`) and so it missed `a.btn` — the hero CTA *and* the footer CTA, i.e. the two
  links most likely to be why someone printed the page. It is now a blanket
  `a[href^="http"]::after`, which covers the CTAs, the cards and the prose in one rule and
  gives any future link its destination for free. Everything else external
  (`.nav-cta`, `.player-fallback`) already sits inside a `display: none` ancestor.
- **Three controls printed as dead ink** and are now hidden, for the same reason
  `.skip-link` / `.plat-go` / `.social-go` already are — none of it is content: the
  JS-only `#replay-intro`, "Back to top ↑", and the `href="#story"` ghost button, which
  invited the reader to jump to a section printed a few centimetres below it.
- **`.footer-replay`** (in `index.html`) wraps the `" · "` separator *together with* the
  replay link, because hiding the link alone left "…guided by Ivy · " trailing into
  nothing. It is an unstyled inline span — on screen the text, the single-line height and
  the hit target are all unchanged; verified with `elementFromPoint`.

**forced-colors: every icon needed forcing by hand, and the play glyph needed opting out**
The `@media (forced-colors: active)` block had been written but never *rendered*. Doing so
found two defects that no automated check reports, because forced-colors is a mode you
have to look at:

- **7 of the 9 inline SVGs were invisible.** Chrome's UA stylesheet gives `<svg>`
  `forced-color-adjust: preserve-parent-color`, which *preserves* an explicit author
  `color` on the svg instead of forcing it. `.plat-icon` / `.social-icon` set
  `color: var(--ink-dim)` and `.player-fallback svg` sets Spotify green, so all seven kept
  their author colour and measured **1.10:1** (and 1.92:1) against a white Canvas — every
  brand mark on every platform and social card was a ghost. The two that survived,
  `.btn svg` and `.nav-cta svg`, do so *only* because they set no colour of their own and
  inherit their link's forced `LinkText`. All of them use `fill="currentColor"`, so
  forcing `color: LinkText` is enough. Hover is in the selector list too — otherwise it
  paints an author brand colour back over the system palette. Now 13.99:1 on the light
  palette and 19.56:1 on the dark one, adapting automatically because it is a keyword.
- **The Enter button's play triangle became a filled square.** `.tri` is a CSS
  border-triangle (`border-left: 7px solid currentColor`, transparent top and bottom), and
  forced-colors forces *every* border colour — including the transparent ones. It gets
  `forced-color-adjust: none` plus an explicit `border-left-color: CanvasText`. The
  selector has to be `.gate-btn .tri`; a bare `.tri` loses to the base rule's (0,2,0) and
  silently leaves the edge cream. The other `border-color: transparent` declarations here
  are all hover states, where forced-colors making them visible is desirable.

**Focus is handed along the whole journey: gate → intro → shell**
There are three modal surfaces and each must own the keyboard while it is up. The intro
(`#ivy-skip`) and the drawer (first link, returned to the burger) always did. Two gaps
were fixed:

- **The gate never took focus.** It is `role="dialog" aria-modal="true"`, yet it opened
  with focus on `<body>`, so a screen reader was never told a dialog had appeared.
  `main.js` now calls `el.gate.focus()` when `.ready` lands, and `#gate` carries
  `tabindex="-1"`. **Focus the dialog, not `#gate-enter`** — Chrome matches
  `:focus-visible` on programmatic focus *even when the last input was the mouse*, so
  focusing the button painted a bright crimson ring over the designed pill for every
  pointer visitor. Landing on the container announces the `aria-label` instead, and Tab
  still reaches Enter next.
- **The journey ended with focus stranded on `<body>`.** Whatever held the keyboard
  (`#ivy-skip` or `#gate-skip`) was hidden with its dialog, so the browser reset focus
  to the document start. `revealSite()` now focuses `#shell` (also `tabindex="-1"`), so
  the next Tab still reaches the skip link exactly as before, but the position is ours.

`#gate` and `#shell` are landing spots, not controls — they cannot be reached by Tab, so
`styles.css` suppresses their focus ring. Without that, the global `:focus-visible` rule
draws a 2px crimson outline around the entire gate overlay and the whole site shell.

**`setDrawer(false)` must not do focus restoration on its init call**
This was the real bug behind the stranded focus, and it is a trap worth remembering: the
drawer's close branch also runs once at startup, where there is no prior focus to
restore. It did it anyway, with two symptoms — on desktop the burger is `display: none`,
so it fell through to an unconditional `activeElement.blur()` and **erased the focus
handoff `revealSite()` had made 25 milliseconds earlier**; on a phone the burger *is*
displayed, so it yanked focus to the burger on page load. The branch is now guarded on
`lastFocus`, which is only set when the drawer actually opens. The blur is also scoped to
`drawer.contains(document.activeElement)`, matching its stated purpose — un-stranding
focus from a link inside a drawer the breakpoint just hid.

**Both skip controls are padded to a 34px tap target, with compensating anchors**
`#gate-skip` was 101×19 and `.ivy-skip` 120×19 — bare text buttons with no padding,
under the 24px WCAG 2.5.8 floor, and between them they are the *only* way past the
intro. Each now carries `padding: 0.45rem 1rem`, and each subtracts that padding back
out of whatever anchors it, so the label does not move by even a pixel:

- `.gate-skip` — `margin: 1.15rem auto -0.45rem` (was `1.6rem auto 0`). The top margin
  loses the padding; the **negative bottom margin** is the part that is easy to miss —
  the gate stack is vertically *centred*, so without it the taller box grows the stack
  and drags the label up ~3.6px.
- `.ivy-skip` — `bottom: calc(clamp(2rem, 6vh, 3.6rem) - 0.45rem)`. Bottom-anchored, so
  the padding grows the box upward and the label would rise by `padding-bottom`.
- The landscape block overrides both anchors, so it subtracts the padding too
  (`calc(clamp(0.7rem, 2.5vh, 1.4rem) - 0.45rem)` and `calc(0.75rem - 0.45rem)`).
  Landscape is the tight case: `.ivy-skip` sits 5.2px off the bottom edge at 844×390.

Verified: 133×34 / 152×34 portrait and 137×34 / 156×34 landscape, label ink at exactly
its old coordinates (587.9 / 775.1 portrait, 291.3 / 359.0 landscape), everything still
in the fold, and a synthetic tap 4.9px *above* the old label box now hits the button and
reveals the site. Keep the padding and the anchor `calc()`s in sync if you touch either.

**Hover states that fill with an accent get the *darkened* accent, never the display one**
Three places inverted on hover to a bright fill under a light label and lost AA doing it.
The pattern to watch: a rule that sets `background` **and** `color` in the same hover
declaration, or a `::before` that slides a gradient up under existing white text.

| | was | is | worst contrast |
|---|---|---|---|
| `.nav-cta:hover` | `--crimson-bright` + `#fff` | `--crimson` + `#fff` | 3.76:1 → **5.88:1** |
| `.gate-btn::before` | `--accent-grad` | `--accent-grad-btn` | 2.85:1 → **5.23:1** |
| `.btn-solid::before` | ends `#e0402c` | ends `#d43a22` | 4.25:1 → **4.85:1** |

`--accent-grad` is a *display* gradient: with a `#fff` label, **71% of its length** sits
under 4.5:1 and the ember end bottoms out at 2.85:1. `--accent-grad-btn` is the same
ramp darkened and exists for exactly this — it clears AA across 100% of its length.
The gate simply never got switched over, which mattered because it is the one button
the entire site funnels through. The `.btn-solid` end stop now matches that token too,
so its hover (4.85:1) and rest (4.96:1) agree instead of hover being the weaker state.

Numbers above are **rendered pixels**, not token math — see the measurement note in
"Things that look broken in a screenshot but aren't" before re-checking them.

**Every interactive element has a non-empty, unambiguous accessible name**
Audited all 29: none missing a name, none sharing a name across different hrefs.
Icon-only controls are handled — the nav logo carries `aria-label="The Obsessn —
home"`, and all 9 `<svg>` brand marks plus the `→`/`↗`/`↘` glyph spans are
`aria-hidden="true"` so they never read as "image" or "down-right arrow" inside a
link. The one gap fixed here: the five `.era-arrow` (`↘`) spans lacked
`aria-hidden` and would have been announced on each Eras row (they are a
hover-only decoration — `opacity: 0` until `.era:hover`). The hero stat `∞` is
deliberately *not* hidden: it is the value of the "Obsession" stat and reads
correctly as "infinity, Obsession".

**Touch: tap targets pass WCAG AA, and the browser tap-flash is suppressed**
Measured every interactive element at 390px: the smallest is 30px, so all clear
the 24px AA floor (2.5.8) — nothing fails. Five sit under the 44px AAA guideline
(the logo-home link, two inline footer links, the nav CTA, and the 40px burger);
those are deliberate compact-nav / inline-link choices, and the burger can't grow
to 44px without its hit area overlapping the adjacent CTA, so they're left. What
*was* worth changing: `-webkit-tap-highlight-color: transparent` on `html` (it
inherits), killing the grey box mobile browsers flash on every tap. Safe because
every interactive element already has a `:hover` state, which fires on touch — so
taps keep feedback, just the site's own instead of the browser's default.

**The Ivy meter is static under `prefers-reduced-motion`**
It's painted from JS every frame, so the CSS reduced-motion block never touched
it — 56 bars oscillating for 52 seconds at someone who asked for no motion.
`gl.js` also snaps and repaints once so those users still get the orb.

Because three files read the preference independently (`main.js`, `motion.js`,
`ivy.js`), it is worth re-checking end to end rather than trusting the CSS. Note
that the emulation has to be set **before** navigation — `main.js` and `ivy.js`
capture `matchMedia(...).matches` as a boolean at module load, so flipping it
afterwards changes nothing. Last measured, all correct:

| | default | reduced |
|---|---|---|
| shader (mean pixel Δ over 2.2s) | 4.36 — animating | **0.000 — static** |
| Ivy meter bar heights over 2.5s | changing | **byte-identical** |
| marquee `animation-name` | running | `none` |
| grain / smooth scroll | on / `smooth` | `none` / `auto` |
| reveals fired | 30/30 | 30/30 |

Do not measure the shader with `readPixels` — without `preserveDrawingBuffer`
the buffer is cleared after compositing and every sample comes back zero, which
reads as "static" in *both* modes. Compare screenshots of the canvas region
instead. The custom cursor is also a false alarm: `cursor()` returns early under
reduced motion so `body.cursor-live` is never added, and both cursor elements sit
at `opacity: 0` despite computing to `display: block`.

**The Ivy lyrics are deliberately *not* an `aria-live` region**
They're captions for audio already speaking those exact words. A live region
would double-speak every line. The overlay is `role="dialog"` + labelled, with
focus sent to the skip button.

**`.ivy-words` is `display: block`, not flex**
A flex container discards whitespace-only nodes, so word spacing came from
`gap` alone and `textContent` read `"I'llbeyourguidetonight."`

**The vignette stays under `prefers-contrast: more`**
It looks decorative but it darkens the frame, which *helps* text near the
edges. Removing it made contrast worse; the smoke field is dimmed instead.

**The drawer closes itself when the viewport crosses 860px**
Above that breakpoint the burger is `display: none`. Leaving the drawer open
across the boundary left a full-screen overlay with `body.is-locked` and no
visible control to dismiss it — a tablet rotating portrait→landscape hits it.
Closing also restores focus to the burger rather than leaving it on a link
inside the now-hidden drawer. Its menu is also re-sized in the landscape /
short-height block (`@media (orientation: landscape) and (max-height: 540px)`):
the default item size is vw-based (up to 3.6rem), which made five items ~496px
tall and clipped "Home" and "Connect" off a ~390px landscape phone. There it
switches to height-based sizing (`6.5vh`), reserves room for the nav pill, and
becomes scrollable as a floor for the shortest devices. Portrait is untouched.

**The gate was the worse version of the same bug** and is fixed in the same
block. Its portrait stack — a 168px orb with 2.6rem/3rem margins — overran a
~390px landscape viewport and pushed **"Enter" mostly below the fold with "Skip
intro" entirely off-screen**. Since the gate is `position: fixed` and is the only
way into the site, a first-time visitor holding their phone in landscape had no
reachable way in. The landscape block now sizes the orb off the short axis
(`19vh`), shrinks the stack margins, and trims the button padding so orb +
wordmark + sub + both buttons clear the fold at 360–430px tall (verified: nothing
clipped, `gateScrolls` false). The intro itself was already fine in landscape —
only the gate blocked reaching it. This is the kind of defect that hides from
every automated check (valid HTML, passing axe, no console errors) and only
shows up by *rendering the state and looking*.

**The whole keyboard path is driven and verified, not assumed**

| path | result |
|---|---|
| tab order | skip link → nav → hero buttons → platform cards → player; every stop paints the `2px solid #ff2442` focus ring |
| gate | two-stop trap (Enter / Skip intro) that wraps; `Enter` activates and starts the intro identically to a mouse click |
| drawer | opens with `aria-expanded="true"` and focus on the current link; Tab cycles the 5 links **plus the burger** and wraps; `Escape` closes and returns focus to the burger |
| intro | `Escape` skips and fully reveals the site — `shellLive`, `inert` removed, `is-locked` cleared, page scrollable |
| intro, early | `Escape` pressed inside the 380 ms defer before `ivy.start()` also reveals correctly — this is what `skipRequested` is for |

Use CDP `keyDown`, **not `rawKeyDown`**, for any key that activates something.
`rawKeyDown` delivers the event to listeners but does not run the browser's
default action, so `Enter` on a focused button never produces a click. The page
then sits in a half-started state that reads exactly like a bug: the intro
appears to begin and then strand itself with the site never revealed. Pair it
with `text` for printable keys.

**Active nav carries `aria-current`, computed from scroll position**
An `IntersectionObserver` band cannot work here: the last section never reaches
the middle of the viewport, so `#connect` was structurally unreachable and the
nav stayed stale for the whole final screen.

### The intro

**Completion listens for the audio `ended` event *and* polls in rAF**
Not redundant. rAF throttles or stops in a backgrounded tab, and a visitor who
switched tabs mid-intro could return to a permanently stuck overlay with the
site locked behind it.

**Skip intent is latched (`skipRequested`), not read off the DOM**
`ivy.start()` is deferred ~380ms behind the gate's fade. Pressing Escape inside
that window used to do nothing — the handler bailed because `#ivy` was still
hidden — and the visitor then sat through all 52 seconds. `abortIntro()` now
cancels the pending start, so skipping early also means the 1.1MB mp3 is never
fetched at all.

**`runFallback()` is latched**
Both the `error` listener and the load guard can reach it. Without the latch
each starts its own timer set and rAF loop, and the two fight — lyrics jump and
the progress bar runs backwards.

**Cue timings** were checked against a band-passed envelope of the mp3. Anchors
align within 0.25s with no drift.

> The intro is **fully captioned.** An earlier analysis of mine flagged
> 40.7–43.4s and 44.1–47.5s as possible uncaptioned speech, on the basis that
> they carry 3–8 Hz amplitude modulation similar to the spoken lines. That was
> wrong: the script embedded in the file's own `lyrics-eng` tag ends at
> "Let me show you everything." followed by `[Echoing fade out, dark ambient
> outro]`. An echoing outro modulates at speech-like rates. Read the tag before
> trusting envelope analysis:
> `ffprobe -show_entries format_tags=lyrics-eng ivy-intro.mp3`
>
> That tag no longer exists — the file's metadata was stripped to remove an
> unused 22 KB embedded cover image. The **tagged original is preserved in git
> history** (`git show <pre-rewrite-commit>:ivy-intro.mp3`), and the full script
> including its stage directions is transcribed in the comment above `CUES` in
> `js/ivy.js`.

### Performance

**`<link rel="modulepreload">` for all four JS files**
ES module imports are only discovered after the entry module parses. On 3G the
three imports didn't start until 3775ms. Preloading: they start at 501ms
together. Measured on a gzip-serving host: gate ready 5.4s → **3.6s**.

**Analytics is queued immediately but fetched at idle**
`gtag.js` is ~163 KB — a third of the whole page — and has no business competing
with first paint. `dataLayer` buffers events until it arrives. The bootstrap
waits for `load` *and then* `requestIdleCallback`, so it lands well clear of the
render path — measured against a gzip-serving host:

| | FCP | LCP | `gtag.js` starts |
|---|---|---|---|
| Fast 3G | 776 ms | 1260 ms | 1742 ms — 482 ms after LCP |
| Slow 3G | 2208 ms | 2856 ms | 6497 ms — 3641 ms after LCP |

Measured on a plain `python3 -m http.server` it *looks* like the deferral fails —
`gtag.js` starts at 133 ms against a 164 ms FCP. That is an artefact of a local
server being instant, which fires `load` before the first paint is recorded. Do
not "fix" it on that evidence.

**`<link rel="preload" as="font">` for the Bricolage woff2**
The wordmark is the LCP element. If Google re-versions that URL the preload is
simply ignored — it cannot break anything.

**Instrument Serif is requested as `ital@0;1` and both variants are genuinely used.**
It arrives as two files (~15 KB each) and looks like an easy 15 KB saving, because the
serif reads as "the italic one" — `.hero-lede`, `.prose em`, `.prose .drop`,
`.pullquote p` and 404's `.lost-say` are all italic. But **`.ivy-line`** (the intro
captions, the largest type in the whole experience) and **`.pullquote::before`** (the
giant decorative `"`) are *roman*. Dropping to `ital@1` would silently swap the intro
captions to Georgia. Checked rule-by-rule; do not "optimise" this.

**The shader renders below native resolution** (0.62 desktop / 0.5 coarse) with
fewer fbm octaves on touch devices. The field is low-frequency; nobody can tell.
Measured 0/199 frames over 16.7ms.

**The atmosphere loop is capped at ~60fps** (`MIN_FRAME = 13.5` in `gl.js`). Left
uncapped it painted a full-screen fbm shader on every `requestAnimationFrame` —
measured at **119.8fps** in a headless run and the same on any 120Hz phone, for a
field that drifts at `uTime*0.045` where 60fps is indistinguishable. The gate
halves that GPU draw (real battery and heat on a phone) with no visible change.
It is chosen *not* to disturb 60Hz: a 16.7ms frame always clears a 13.5ms gate,
so 60Hz stays 60fps untouched and only >74Hz displays get thinned — verified
119.8 → 60.1fps by counting `drawArrays` calls per second. This is intentional;
do not "unthrottle" it. CPU throttling, incidentally, barely moves any of these
numbers (median 8.4→8.8ms from 1× to 6×) — the work is GPU-bound and the
per-frame JS is negligible, so a slow *CPU* is not what this loop is pacing for.

**The custom cursor loop idles out when the pointer is still.** The dot tracks
the pointer instantly and the ring eases behind it; once the ring has caught up
(within 0.1px) there is nothing to animate, so the loop stops and a `pointermove`
restarts it. Previously it was a 60fps `requestAnimationFrame` plus two style
writes for the whole desktop session — including every stretch the pointer sits
still while reading. Verified by counting `style` writes on the ring: ~48/s while
moving, **0 in 1.5s once settled**, and it wakes on the next move (ring lands on
target). The parallax loop already behaves well (scroll-driven, `ticking`-gated,
IntersectionObserver-culled).

**The marquee ticker pauses when scrolled off-screen.** It rewrites a
`translate3d + skewX` transform every frame; left ungated it did so at ~120fps to
a band ~3900px above the viewport for the whole reading session. An
IntersectionObserver (`rootMargin: 100px`, so it wakes just before re-entering)
stops the loop off-screen and restarts it with `last = performance.now()` so the
gap never lands as one huge `dt` step. Verified by counting `style` writes on the
track: ~119/s on-screen, **0 off-screen**, resumes cleanly (transform stays a
valid `translate3d`, no `NaN`). It only *looks* like it must run forever — the
occlusion check that prompted this also confirmed the **shader** must keep drawing:
content sections are transparent and only `body` is opaque (behind the canvas), so
the dimmed atmosphere and embers are genuinely visible through every section.
Pausing the shader on scroll would flatten a visible background — don't.

**The audio is fetched on intent, never speculatively** — measured on the network, not
inferred: **0 requests** for `ivy-intro.mp3` at page load, **0** at `#gate.ready`, **0**
after idling 2.5s on the gate, and exactly **1**, about **1.0s after *Enter* is pressed**.
There is no `<audio>` element in the markup at all; `ivy.js` constructs it. So a visitor
who lands, reads the gate and takes *Skip intro* — or any returning visitor, or any deep
link — pays **0 KB** of it. The 1.1 MB lands only on people who chose the intro, which is
worth remembering when weighing the re-encode question below.

**Every other number here describes `?nointro=1`. A real first visit is 3.4×
heavier**, because clicking *Enter* fetches `ivy-intro.mp3`:

| | first visit | `?nointro=1` |
|---|---|---|
| `ivy-intro.mp3` | 1110 KB — **70%** | not fetched |
| fonts | 210 KB — 13% | 45% |
| `gtag.js` | 163 KB — 10% | 35% |
| this repo | 95 KB — 6% | 20% |
| **total** | **1579 KB** | **469 KB** |

The audio dominates, and it is already about as small as it can honestly get:
no ID3 tags (already stripped), already **VBR** (11 distinct frame sizes, so the
encoder is allocating bits adaptively — there is no constant-bitrate waste to
reclaim), and genuinely stereo (the side channel sits 15 dB under the mid, so
folding to mono would audibly narrow the ambience). It is also *already lossy* at
175 kbps with a ~19 kHz lowpass, so every further option is a generational
re-encode of the artist's voice, not a free win. Measured, if it is ever wanted:
LAME `-q:a 4` → 942 KB (−17%), `128k` → 829 KB (−27%), `-q:a 6` → 635 KB (−44%).
Gross spectral measures cannot tell these apart (energy >16 kHz is already 36 dB
down and moves <1.5 dB across all of them); what separates them is pre-echo and
mid-band quantisation noise, which needs ears, not `ffmpeg`. **That makes it a
quality call for the artist, not a build decision.**

**It streams — do not "fix" the buffering.** Playback starts 1.9 s in on Slow 3G
off ~15 KB buffered, so the 6-second text-only guard never fires, and at 175 kbps
against Slow 3G's 400 kbps the download runs 2.3× realtime and will not stall.
Two things will silently ruin any measurement of the intro:

- **Drive it with CDP `Input.dispatchMouseEvent`.** A `.click()` from
  `Runtime.evaluate` is not a trusted gesture, autoplay is refused, and every
  connection looks like it falls back to the silent captions.
- **Wait for `#gate .ready`, not just for `#gate-enter` to exist.** The button is
  in the DOM and has a box well before the gate finishes its entrance, and a
  click landing in that window does nothing at all — no error, no state change.
  `#ivy` then stays `hidden`, so everything inside it has a `display: none`
  ancestor and its CSS animations never start. That reads downstream as broken
  UI: `#ivy-skip` sat at `opacity: 0` for 18 s straight and looked like a dead
  affordance, when in fact it fades in correctly 2.4 s after `#ivy` is shown.

**Once the audio is out of the picture the four web fonts are the largest thing
left — ~210 KB — and every obvious way to cut them is a trap.** On the
`?nointro=1` load that is 45% against `gtag.js` 35% and this repo's own files
just 20%: four fifths of it is third-party, and neither part is worth what it
looks like it is worth cutting. All four families were measured; do not repeat
the experiments.

| family | bytes | why it is that size |
|---|---|---|
| Bricolage Grotesque | 128 KB | three variable axes, all genuinely used |
| Instrument Serif | 30 KB | **two** files — roman *and* italic, both used |
| Geist | 29 KB | body |
| Geist Mono | 23 KB | labels, eyebrows, nav |

- **Narrowing a range inside an axis saves nothing.** `Geist:wght@200..600` and
  `wght@300..500` return byte-identical files (29288 B), as do Geist Mono
  (23108 B) and Bricolage (131312 B). Google serves the same variable font; only
  dropping a whole axis changes anything.
- **Dropping `opsz` from Bricolage saves 53 KB (131→78 KB) and is not worth it.**
  It is set explicitly on four rules, and without it `.sec-title` renders 15%
  wider and the footer CTA 14% wider — side by side the condensed display cut
  that carries the site's identity is plainly gone. `wdth` costs about the same
  and is even more load-bearing (13 declarations, values 75–88).
- **Do not change `Instrument+Serif:ital@0;1` to `ital@1`.** Five of five
  *rendered* serif elements are italic, so roman looks unused — it isn't.
  `.ivy-line` sets no `font-style`, so the entire intro caption track is roman,
  and it does not render under `?nointro=1` where you would go looking. Dropping
  `ital@0` silently drops every caption to Georgia.
- **`&text=` subsetting** would cut Bricolage hard, but this README teaches the
  owner to edit copy freely; a new era name or platform would silently lose
  glyphs. Not worth the trap.

Two ways to get page weight wrong, both of which produced published-looking
numbers here before being caught:

- **Measure with CDP `Network.responseReceived`, not the Performance API.** The
  later font requests land after a naive
  `performance.getEntriesByType('resource')` snapshot, which reports 128 KB
  instead of the real 210 KB.
- **Never read transfer sizes off a local server.** GitHub Pages gzips text;
  `python3 -m http.server` does not. The repo's own text assets are 142 KB raw
  but 44 KB over the wire — a 70% difference — so a plain local server roughly
  triples local weight and makes CSS and JS look like problems worth solving.
  They are not: `styles.css` is 12.7 KB gzipped. For real numbers use DevTools →
  Network against the deployed site, or just check one file:
  `gzip -9 -c styles.css | wc -c`.

### `TheObsessn.PNG` carries C2PA content credentials

The source logo has a 61 KB `caBX` chunk holding signed C2PA provenance
(claim generator ChatGPT / GPT-4o, IPTC `digitalSourceType:
trainedAlgorithmicMedia`). It is referenced only from the JSON-LD `image`
field, so browsers never load it — it is crawler and repo weight, not page
weight.

**Any re-encode destroys it.** A lossless recompress saves 136 KB (9%) but
strips the chunk, and the seven derivatives in `assets/` already lost it when
they were generated — so the credential currently survives in exactly one file.

Whether to keep it is a disclosure decision, not an optimisation one, so it has
been left untouched. To inspect:

```sh
python3 -c "import struct,pathlib;d=pathlib.Path('TheObsessn.PNG').read_bytes();p=8
while p<len(d)-8:
 l=struct.unpack('>I',d[p:p+4])[0];t=d[p+4:p+8].decode();print(t,l);p+=12+l
 if t=='IEND':break"
```

### Browser floor

Derived by auditing every modern feature used against its WebKit baseline —
Safari is the binding constraint, and it cannot be driven headlessly on this
machine, so this is static analysis rather than a live test.

**Effective floor: Safari 15 / iOS 15** (Sept 2021). Two hard dependencies land
there: `aspect-ratio` (sizes `.hero-mark`, `.gate-orb`, `.about-portrait`) and
WebGL2. Below it the atmosphere already falls back to `body.no-gl`.

That fallback is exercised, not assumed. Blocking WebGL entirely — override
`HTMLCanvasElement.prototype.getContext` to return `null` for `webgl*` via
`Page.addScriptToEvaluateOnNewDocument`, so it is gone before any module runs —
gives: `body.no-gl` applied, the painted radial-gradient sky in place of the
shader, the canvas at `opacity: 0`, the shell live, and 30/30 reveals firing.
The page reads as a deliberately flatter version of itself rather than a broken
one, which is the whole point. This matters more than the browser floor suggests:
a current browser on a blocklisted GPU driver takes the same path.

Everything newer degrades rather than breaks, and is deliberately unpolyfilled:

| feature | Safari | without it |
|---|---|---|
| `inert` | 15.5 | shell stays tabbable behind the gate |
| `:has()` | 15.4 | no-JS hero tint renders flat white |
| `overflow: clip` | 16 | falls back to `overflow: hidden` |
| `color-mix()` | 16.2 | plain colour predecessors apply |
| `size-adjust` | 17 | raw Impact metrics — still far closer than Arial Black |
| `modulepreload` | 17 | modules load late, as before |
| `fetchpriority` | 17.2 | ignored |
| `prefers-reduced-transparency` | 17 | no effect |

`forced-colors` is Windows-only; macOS High Contrast routes through
`prefers-contrast`, which is supported and handled.

### Generated assets

`assets/og.jpg` is the social link-preview card. **Its wording is baked into
pixels**, so editing the site's copy does not update it — and it is the surface
with the widest reach, since it appears in every Twitter / iMessage / Slack
preview. A stale claim there outlives the page by a long way.

Source: **`tools/og-card.html`** (marked `noindex`, regeneration steps in its
header comment). Re-render at exactly 1200×630 whenever the hero eyebrow, lede
or wordmark changes, then:

```sh
sips -s format jpeg -s formatOptions 86 shot.png --out assets/og.jpg
```

The favicons and `assets/logo-*` derive from `TheObsessn.PNG` and carry no text,
so they only need regenerating if the logo itself changes — recipes for all of
them, including the hand-packed `favicon.ico`, are under *Swap the logo* above.

### Build / hosting

**`.nojekyll`** — without it GitHub Pages runs Jekyll, which silently excludes
any file or directory starting with `_`.

**`modulepreload` must track the module graph.** Add a new file under `js/` and
add a `<link>` for it, or it falls back to late discovery.

**`404.html` must keep root-absolute paths** (`/styles.css`, `/assets/…`, `/`).
GitHub Pages serves it *at the URL that was missed*, so a visitor who lands on
`/a/b/c/typo` gets this page with the browser's base still at `/a/b/c/`. Relative
paths would resolve against that and 404 in turn — an unstyled error page. This
is the one file where the absolute paths are load-bearing rather than incidental;
verified by serving it at depth, with the stylesheet, logo and both links
resolving correctly and zero failed subresources.

---

## Accessibility overrides lose to state classes

**A `@media` block adds no specificity.** A rule written as `.nav` inside
`@media (forced-colors: active)` is still `(0,1,0)`, so any `.nav.stuck` or
`#gl-canvas.ready` sitting in the normal cascade quietly beats it. Nothing warns
you: the CSS is valid, the block is obviously present, and at the one moment you
are likely to check — page top, before any state class is applied — it works.

Two shipped bugs came from exactly this, both invisible until measured:

| override | beaten by | effect |
|---|---|---|
| `.nav` → opaque background | `.nav.stuck` (0,2,0), applied from 40px down | reduced-transparency held only at the very top; the pill went translucent again the moment anyone scrolled |
| `#gl-canvas` → `opacity: 0.22` | `#gl-canvas.ready` (1,1,0), added by `gl.js` on first paint | `prefers-contrast: more` never dimmed the smoke field at all — it ran at full strength behind every line of text |

When adding an override, name every state variant of the element
(`.nav, .nav.stuck { … }`), or reach for `!important` — a media query that exists
to make the page usable is a legitimate place for it.

Re-run the check by extracting each selector inside an accessibility block and
looking for any rule in the normal cascade whose *subject compound* is a superset
of it with higher specificity. Strip comments before parsing; and note that
comma-separated selectors have to be considered as a group, or an already-fixed
`.nav, .nav.stuck { … }` still reports as a conflict.

Not every hit is a bug. `:hover` overrides of these values are fine — in
forced-colors the hover value resolves to system `LinkText` on what is genuinely
a link, and the `prefers-reduced-motion` caption rules keep their transform and
blur but run at `1e-05s` because the global `!important` duration wins, which is
the hard cut that mode wants.

---

## Things that look broken in a screenshot but aren't

Three of these have now cost real time. Check here before investigating.

- **The Spotify player shows "The player couldn't load".** The iframe is
  `loading="lazy"`, and a full-page screenshot does not scroll, so the embed
  never enters the viewport and never loads — you are photographing the fallback
  that sits behind it. Scroll `#music` into view and it loads normally.

- **A hovered icon sits ~1.7px left of the text under it.** That is the
  `scale(1.08)` hover zoom growing about its centre, not a layout bug — at rest the
  edges are identical to the pixel. Fixed by origin, not by margins; see the
  `transform-origin` note under Layout.

### Measuring contrast on a filled button — four ways to get a wrong number

Every one of these produced a confident, wrong answer here. If a contrast figure
looks surprising, suspect the method before the CSS.

1. **Walking `backgroundColor` up the ancestors misses `::before` fills.** Three
   buttons here paint their hover state with a `z-index: -1` pseudo-element, so a
   DOM-based probe reads the *resting* background and reports dark-on-dark. `.btn-ghost`
   "measured" 1.02:1 this way and is actually a near-white pill with dark ink.
2. **It also misses gradients**, which have no `backgroundColor` at all — the value
   is `transparent` and the probe falls through to whatever is behind.
3. **`color: transparent` does not remove the ink.** Antialiased glyph edges survive,
   and since they blend toward the *label* colour every sampled "worst pixel" is a
   glyph edge, not the fill. This invented a 3.98:1 failure on the primary CTA that
   does not exist. Use `-webkit-text-fill-color: transparent !important`.
4. **Deleting the label reflows the button.** These are `inline-flex`, so removing the
   text shrinks them and a pre-measured clip then photographs the *neighbour* — which
   is how `--ink` (rgb 244,240,234) turned up "inside" a crimson button. Wrapping the
   text in a span is no better: it becomes a flex item and `gap` widens the button,
   pushing the lightest end of the gradient outside the clip. Assert
   `widthBefore === widthAfter` before trusting any crop.

Also note `.grain` (`opacity: 0.16`, `mix-blend-mode: overlay`, `z-index: 3`) paints
over everything, so rendered pixels legitimately differ from token math by roughly
±0.1:1. That is real, and small — it was not the cause of any figure above.

  The fallback behind it only reaches the visitor when a blocker *removes* the
  iframe (uBlock-style cosmetic filtering does). When the load is instead
  *refused* while the element survives — a CSP `frame-src` rule, a corporate
  proxy — Chrome paints the frame as an opaque light-grey slab with a
  broken-document icon on top of the fallback, and that is all the visitor sees.
  There is no clean fix, and it was tried: a blocked cross-origin frame is
  **indistinguishable from a loaded one** from the page. `load` fires in both
  cases (it does *not* only fire on success — that was a measurement error);
  `contentDocument` is `null`, `contentWindow.location` throws, and
  `contentWindow.length` is `0` in both. Chrome gives a blocked frame an opaque
  origin on purpose, so a JS guard cannot tell "blocked" from "cross-origin and
  fine" and would hide a working player for everyone. The mitigation that already
  exists is the right one: the `.plat` Spotify card, the nav "Listen" CTA, and the
  hero button are six other Spotify links on the page that a blocked visitor can
  still click.
- **A section title looks grey instead of white.** `.nav` is `position: fixed`
  with `rgba(9,9,11,0.58)` and `backdrop-filter: blur(22px)`. Anything passing
  under the nav pill is meant to dim. Measured at rest: `Eras` 237/255 and
  `Connect` 241/255 at full ink, versus `Music` 167/255 purely because
  `scrollIntoView` had parked it at y=30, directly beneath the nav.
- **Cropping a full-page capture at DOM coordinates yields black boxes.**
  `parallax()` translates elements by scroll position, so an element's absolute
  page coordinates are only valid at the scroll offset where they were read.
  Screenshot and measure in the *same* coordinate space: take a viewport
  screenshot and crop with the viewport-relative rect from that same moment.

---

## Verifying changes

What matters is the outcome, not the tool. After any edit, the site should still
have **no console errors**, **no contrast failures**, and **no horizontal
scroll** at phone and desktop width.

**To see the gate or the intro at all, use `?ivy=1`.** `?nointro=1` hides both, and
after one visit `sessionStorage['obsessn:seen']` sends you straight in — so a reused
browser profile silently shows you the shell while you think you are testing the gate.
The symptom is every gate element reporting a 0×0 rect (`getBoundingClientRect` returns
zeros for `display: none`). `?ivy=1` is the force-intro flag the footer replay link uses
and it ignores both the session flag and a deep link.

**With nothing installed** — open `http://localhost:4321/?nointro=1` after
`python3 -m http.server 4321` and use Chrome DevTools:

- *Console* — must be empty.
- *Lighthouse* → Accessibility — runs axe-core under the hood; expect 100.
- *Device toolbar* — check 390px and 1440px; the page must not scroll sideways.
- *Rendering* panel — emulate `prefers-reduced-motion`, `prefers-contrast`, and
  `forced-colors` and confirm the page still reads.

**Markup validity**, no install needed:

```sh
curl -s -H "Content-Type: text/html; charset=utf-8" \
     --data-binary @index.html "https://validator.w3.org/nu/?out=json"
```

Both pages currently return 0 errors and 0 warnings — keep it that way.

**After any scripted edit to `index.html`, re-validate the structure.** Scripted
edits have silently deleted whole blocks here before; the validator above
catches it immediately where a screenshot will not.

**Specialist tooling used while building this** (`iris` for viewport rendering,
axe-core injected over the Chrome DevTools Protocol) is not required and may not
be installed — the DevTools route above covers the same ground.

Known-and-accepted findings, whatever tool reports them: the marquee and hero
mark register as "clipped" (both intentional, inside `overflow: clip`, and
create no scroll), and the giant footer wordmark registers low contrast (it is
`aria-hidden` and decorative — exempt under WCAG 1.4.3 as incidental text).

Worth re-testing after significant changes, because each of these has caught a
real bug: JS disabled · fonts blocked · audio blocked · WebGL context lost ·
`forced-colors: active` · `prefers-reduced-motion` · print · slow 3G ·
landscape phone · 320px.

**Check print with "Background graphics" ticked**, not just with the default
settings. Everything the print rules hide or recolour looks right either way;
what only appears with backgrounds on is any dark background that survived into
print. That is exactly how the footer scrim went unnoticed — a full-width
near-black slab under `#111` text, 2.01:1, until it was rendered with the box
ticked. `Emulation.setEmulatedMedia({media:'print'})` plus a screenshot shows
this faster than a PDF round-trip, and does not need a PDF renderer installed.

Independent tools have each found defects that hand-checking missed, so they are
worth re-running rather than trusting this file:

```sh
# accessibility — caught three landmark violations
axe.run(document)                       # inject axe-core via CDP

# markup — caught <h3> inside <span>, and an invalid iframe width attribute
curl -s -H "Content-Type: text/html; charset=utf-8" \
     --data-binary @index.html "https://validator.w3.org/nu/?out=json"
```

Two structural checks worth keeping in the toolkit: selectors that match nothing
(a dead `nth-child(even)` hid a never-rendered design *and* an untested contrast
failure behind it), and `var(--x)` references with no definition. Both are
silent — nothing errors, the rule simply never applies.
