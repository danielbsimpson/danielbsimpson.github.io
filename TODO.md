# Portfolio TODO

## Visual / Animations

### Planet Per Page
- [x] Source planet images for each page (currently Earth only)
  - [x] Mars
  - [x] Venus
  - [x] Neptune
  - [ ] Others (e.g. Jupiter, Saturn, Moon)
- [x] Assign a unique planet to each page so the scroll-reveal animation shows the correct planet
- [x] Ensure planet images are consistent in style/resolution with the existing Earth asset

### Space Warp Transition
- [x] Implement a "zoom through space" animation when navigating between pages
  - [x] Research CSS/JS approaches (e.g. CSS keyframe warp tunnel, Three.js, Canvas)
  - [x] Trigger animation on outbound link click before the new page loads
  - [x] Mirror the animation on page load (arriving at the new planet)
  - [x] Ensure the transition degrades gracefully when JS is disabled or `prefers-reduced-motion` is set

---

## Pages & Content

### Dedicated Work Page
- [ ] Create a new `work.html` page
  - [ ] Write expanded work-history / career narrative content
  - [ ] Migrate the existing Work Projects section from `index.html` to `work.html`
  - [ ] Add `work.html` to the site navigation menu
  - [ ] Assign its own planet for the scroll-reveal animation

---

## URL / Naming Convention
- [ ] Rename pages to more descriptive filenames
  - [ ] `index.html` → `home.html` ⚠️ **Skipped** — GitHub Pages serves `index.html` as the site root (`danielbsimpson.github.io/`); renaming it would break the root URL. Keeping as `index.html`.
  - [x] `landing.html` → `msc_project.html` (redirect stub left at old path)
  - [x] `generic.html` → `about.html` (redirect stub left at old path)
  - [x] `elements.html` → moved to `dev/elements.html` (redirect stub left at old path)
  - [x] Update all internal `<a href="">` references across every page after renaming
  - [x] Update any GitHub Pages / Jekyll config that references old filenames (`_config.yml` only sets theme — no filenames to update)
  - [x] Set up redirects (meta-refresh stubs at `generic.html`, `landing.html`, `elements.html` → new URLs)
