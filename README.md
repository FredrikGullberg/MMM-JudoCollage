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

Adapt this example to your actual page names and existing modules. Keep the clock and `MMM-page-indicator` in their normal screen regions, not inside the collage. Every time `MMM-pages` shows the collage page, MagicMirror calls `resume()`, which selects another random combination when `shuffleOnResume` is enabled.

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
| `shuffleOnResume` | `true` | Choose new photos whenever page is shown. |
| `avoidRecentImages` | `6` | Prefer photos not used in recent collages. |
| `transitionSpeed` | `800` | MagicMirror DOM animation speed in milliseconds. |
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

## Internals

`node_helper.js` scans the local folder and returns a list of safe relative URLs. `MMM-JudoCollage.js` randomly selects photos on initial load and page `resume()`. `MMM-JudoCollage.css` creates the responsive screen layout and grayscale effect. It makes no external API requests.

License: MIT.
