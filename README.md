# MMM-JudoCollage

Dynamic full-screen **three-photo judo collage** for [MagicMirror²](https://github.com/MagicMirrorOrg/MagicMirror), created for Staffanstorps Judoklubb.

The layout matches the dojo display: one large photograph on the left (60% width), two stacked photographs on the right, black dividers, and an optional semi-transparent branding panel at bottom left. The clock and page indicator stay in their **existing MagicMirror modules**, layered above the collage.

All original photos remain untouched. Black-and-white presentation and cropping are provided entirely through CSS; no AI processing is involved.

## Install

```bash
cd ~/MagicMirror/modules
git clone https://github.com/FredrikGullberg/MMM-JudoCollage.git
```

Copy your JPG, JPEG, PNG, WebP or GIF pictures to `~/MagicMirror/modules/MMM-JudoCollage/photos/`. Photos in subfolders are not scanned. **No extra npm dependencies** are needed.

> Photos are intentionally excluded by `.gitignore`. Only use images that the club has permission to display, particularly images of children. Anyone who can access your MagicMirror server may be able to access its image files: do not expose it publicly.

## config/config.js

Add to the MagicMirror `modules` array:

```js
{
  module: "MMM-JudoCollage",
  position: "fullscreen_below",
  classes: "judoCollage",
  config: {
    imageFolder: "photos",
    imageCount: 3,
    grayscale: true,
    shuffleOnResume: true,
    avoidRecentImages: 6,
    transitionSpeed: 800,
    showBrandPanel: true,
    // Optional: place your transparent logo in assets/:
    // logoFile: "assets/staffanstorps-judo.png",
    titleTop: "STAFFANSTORPS",
    titleBottom: "JUDO"
  }
},
```

The default wordmark is plain text, **not the club's exact graphical logo**. For the original visual design, add a transparent PNG and set `logoFile`. Neither photos nor a logo are bundled in this repository.

### Integrating MMM-pages

Give the collage its own page using its `classes` value. For example:

```js
{
  module: "MMM-pages",
  config: {
    timings: { default: 5000 },
    modules: [
      ["page0"],
      ["judoCollage"],
      ["judo1"]
    ],
    fixed: ["pageIndicatorFixed", "clock"]
  }
},
```

Adapt this example to your actual page names and existing modules. Keep the clock and `MMM-page-indicator` in their normal screen regions, not inside the collage. When `MMM-pages` **hides** the collage page, MagicMirror calls `suspend()`. The module chooses, downloads and decodes the next three photos **while hidden**, and updates the hidden DOM at zero animation speed. On the next `resume()`, the prepared collage is already in place; the visible page does not change images. If preloading is still in progress when the page returns, it keeps the previous collage and uses the new set on a later visit.

If full-screen pictures obscure the clock or page indicator, adjust your existing `~/MagicMirror/css/custom.css` (for the regions used by those modules):

```css
.region.bottom.left,
.region.bottom.right {
  z-index: 9998 !important;
}
```

## Configuration

| Option | Default | Description |
| --- | --- | --- |
| `imageFolder` | `"photos"` | Directory inside this module (no absolute paths or parent traversal). |
| `imageCount` | `3` | Maximum distinct photos to display, up to 3 slots. |
| `grayscale` | `true` | Show black and white via CSS (originals remain intact). |
| `shuffleOnResume` | `true` | Preload a new selection when the page is hidden, ready for the next visit. Retained option name for backwards compatibility. |
| `avoidRecentImages` | `6` | Prefer photos not used in recent collages. |
| `transitionSpeed` | `800` | Legacy option retained for backwards compatibility. Hidden collage swaps always use `speed: 0` to avoid visible transitions. |
| `showBrandPanel` | `true` | Show dark branding overlay near the bottom left. |
| `logoFile` | `""` | Optional transparent club logo image path inside this module. |
| `titleTop` | `"STAFFANSTORPS"` | Text above JUDO if no `logoFile`. |
| `titleBottom` | `"JUDO"` | Lower text if no `logoFile`. |

Three unique pictures are selected when at least three exist. A recent-history preference reduces repetition; if the image collection is too small, previously shown images can be reused on later page visits, but not duplicated in the same collage.

The Node helper reads the folder **once on startup**. Restart MagicMirror to detect added or removed files:

```bash
systemctl --user restart magicmirror.service
```

### Troubleshooting

- **Empty/black frames**: confirm image files are directly in the `photos/` folder and restart MagicMirror.
- **Only one or two pictures**: the module needs three separate images for all slots.
- **Faces cropped**: `object-fit: cover` fills each panel. Adjust cropping in `MMM-JudoCollage.css` or prepare alternate copies of the originals.
- **Clock obscured**: inspect `fullscreen_below` region layering and your existing CSS.
- **Logo different from original**: specify your own transparent PNG using `logoFile`.
- **No shuffle on page return**: confirm `MMM-pages` references `judoCollage` and the option `shuffleOnResume` is true.

## Smooth transitions and preloading

The module uses the browser's `Image.decode()` to preload the **entire next image set** before putting it into the DOM. It retains decoded image references while that collage is displayed.

1. **Startup:** select and decode the first collage before rendering its photos.
2. **Leaving the collage page:** select the next set and preload/decode all images.
3. **While hidden:** swap the DOM with `speed: 0` only after every photo is ready.
4. **On return:** show the already prepared collage immediately; `resume()` never changes photos.
5. **Slow or broken image:** do not swap while the page is visible; keep the old collage. On a decode error the old collage remains and a warning is logged.

`shuffleOnResume` remains the existing config key, but scheduling is intentionally performed during `suspend()` to avoid the visible flicker. If your page rotation is exceptionally fast or photo files are very large, some visits can show the previous combination; this is preferable to a half-loaded collage.

After updating from an older version:

```bash
cd ~/MagicMirror/modules/MMM-JudoCollage
git pull
systemctl --user restart magicmirror.service
```

### Tests

Run the regression suite with Node.js 20+ from the module directory:

```bash
node --test tests/preloading.test.cjs
```

Tests cover initial decode, hidden DOM updates, slow decoding across `resume()`, duplicate-preload prevention, disabling shuffle, and broken-image fallback. These are mock-based unit tests; the full page transition should also be checked on the Raspberry Pi display.

## Internals

`node_helper.js` scans the local folder and returns a list of relative URLs. `MMM-JudoCollage.js` selects photos and preloads them on startup or while hidden. `MMM-JudoCollage.css` provides layout and the grayscale filter. It makes no external API requests.

License: MIT.
