# Portfolio TODO

## Visual / Animations

### Planet Per Page
- [ ] Source planet images for each page (currently Earth only)
  - [ ] Mars
  - [ ] Jupiter
  - [ ] Saturn
  - [ ] Others (e.g. Venus, Neptune, Moon)
- [ ] Assign a unique planet to each page so the scroll-reveal animation shows the correct planet
- [ ] Ensure planet images are consistent in style/resolution with the existing Earth asset

### Space Warp Transition
- [ ] Implement a "zoom through space" animation when navigating between pages
  - [ ] Research CSS/JS approaches (e.g. CSS keyframe warp tunnel, Three.js, Canvas)
  - [ ] Trigger animation on outbound link click before the new page loads
  - [ ] Mirror the animation on page load (arriving at the new planet)
  - [ ] Ensure the transition degrades gracefully when JS is disabled or `prefers-reduced-motion` is set

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
  - [ ] `index.html` → `home.html` (update all internal links and `_config.yml` if needed)
  - [ ] `landing.html` → `msc_project.html` (or equivalent)
  - [ ] `generic.html` → review and rename to a descriptive name
  - [ ] `elements.html` → keep as dev reference or move to a `/dev/` subfolder
  - [ ] Update all internal `<a href="">` references across every page after renaming
  - [ ] Update any GitHub Pages / Jekyll config that references old filenames
  - [ ] Set up redirects (e.g. a meta-refresh or 404 redirect) from old URLs for any shared/bookmarked links
