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

## Resume — Skill Logo Popups

### Clickable Skill Descriptions (`resume.html` — Technology Expertise section)
- [x] Add a `data-description` attribute to every `.skill-node` div in `resume.html` containing a short sentence describing personal usage of that tool (e.g. *"Used for building and deploying survival models and CLTV pipelines at TJX."*)
- [x] Create a reusable JS lookup object (or rely solely on `data-description`) as the single source of truth for popup text so descriptions are easy to update without touching the HTML
- [x] Add a popup/modal HTML element inside `.skills-constellation-wrap` (or appended to `<body>`) — a single shared element that gets populated dynamically on click; suggested structure:
  - Outer overlay div (`#skill-popup`) — hidden by default
  - Inner card with: skill logo `<img>`, skill name `<h4>`, description `<p>`, and a close `×` button
- [x] Write CSS for the popup, keeping it consistent with the existing space theme (dark translucent background, `var(--space-accent)` border, `backdrop-filter: blur`, `border-radius: 4px`); include a fade-in keyframe animation matching the rest of the page
- [x] Write JS (inside the existing IIFE in `resume.html`) to:
  - Attach a `click` event listener to each `.skill-node`
  - On click: populate the popup with the node's logo src, `data-label`, and `data-description`, then show it
  - Close the popup when: the close button is clicked, the user clicks outside the inner card, or the `Escape` key is pressed
- [x] Ensure the popup is fully accessible: add `role="dialog"`, `aria-modal="true"`, `aria-labelledby` pointing at the skill name heading, and trap/restore focus on open/close
- [x] Ensure the popup does not interfere with the existing canvas drag/drift interaction on `.skill-node` elements (distinguish a deliberate click from a drag — e.g. only fire popup if the pointer moved fewer than ~5 px between `pointerdown` and `pointerup`)
- [ ] Test on mobile (touch targets, popup positioning within the viewport, dismiss by tapping outside)

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
