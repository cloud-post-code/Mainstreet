# Background images (rotating map)

The full-page rotating map backgrounds used by `site-bg-rotate` are loaded from this directory (paths are defined in `public/js/bg-rotate.js`).

**Image quality:** For sharp rendering on high-DPI (retina) displays, use source images at **at least 2×** the largest viewport dimension you support. For example:

- 1920px viewport width → use images at least **3840px** wide (or proportional height for `background-size: cover`).
- 1440px viewport → at least **2880px** wide.

Using 1× or lower resolution will appear fuzzy when the browser scales with `background-size: cover`.
