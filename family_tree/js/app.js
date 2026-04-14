/**
 * app.js — Family Tree renderer
 *
 * CSV columns:
 *   id          — unique integer
 *   name        — display name
 *   birth       — YYYY-MM-DD  (optional)
 *   death       — YYYY-MM-DD  (optional, blank = still living)
 *   description — free text
 *   image       — relative path from family_tree/ root  (optional)
 *   parent_ids  — comma-separated list of parent IDs from this file (optional)
 *
 * Layout: generation-based, left→right columns, nodes centred per gen.
 */

const NODE_W   = 160;
const NODE_H   = 80;
const H_GAP    = 60;   // horizontal gap between generations
const V_GAP    = 22;   // vertical gap between siblings
const PHOTO_R  = 24;   // photo circle radius
const PHOTO_CX = 36;   // photo circle centre x within node
const PHOTO_CY = 40;   // photo circle centre y within node

// ── Helpers ──────────────────────────────────────────────────────────────

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    // Handle quoted fields containing commas
    const fields = [];
    let cur = '', inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { fields.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    fields.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (fields[i] || '').replace(/^"|"$/g, '').trim(); });
    return obj;
  }).filter(r => r.id);
}

function formatYear(dateStr) {
  if (!dateStr) return null;
  const m = dateStr.match(/^(\d{4})/);
  return m ? m[1] : null;
}

function yearsLine(birth, death) {
  const b = formatYear(birth);
  const d = formatYear(death);
  if (!b && !d) return '';
  if (b && !d) return `b. ${b}`;
  if (!b && d) return `d. ${d}`;
  return `${b} – ${d}`;
}

function initials(name) {
  return (name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

// Wrap SVG text to fit within maxWidth, returning array of tspan lines
function wrapText(text, maxWidth, charWidth = 6.2) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (test.length * charWidth > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2); // max 2 lines
}

// ── Layout ────────────────────────────────────────────────────────────────

function assignGenerations(people) {
  const byId = new Map(people.map(p => [p.id, p]));

  // Build child→parents map
  const parentIds = new Map();
  people.forEach(p => {
    const ids = (p.parent_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    parentIds.set(p.id, ids);
  });

  // BFS from roots (no parents)
  const gen = new Map();
  const queue = [];
  people.forEach(p => {
    if ((parentIds.get(p.id) || []).length === 0) {
      gen.set(p.id, 0);
      queue.push(p.id);
    }
  });

  // Also handle any nodes whose parents aren't in the dataset
  people.forEach(p => {
    const pIds = parentIds.get(p.id) || [];
    const knownParents = pIds.filter(pid => byId.has(pid));
    if (!gen.has(p.id) && knownParents.length === 0) {
      gen.set(p.id, 0);
      queue.push(p.id);
    }
  });

  while (queue.length) {
    const id = queue.shift();
    const g = gen.get(id);
    // Find children of this node
    people.forEach(p => {
      const pids = parentIds.get(p.id) || [];
      if (pids.includes(id)) {
        const newGen = g + 1;
        if (!gen.has(p.id) || gen.get(p.id) < newGen) {
          gen.set(p.id, newGen);
          queue.push(p.id);
        }
      }
    });
  }

  // Any still unassigned
  people.forEach(p => { if (!gen.has(p.id)) gen.set(p.id, 0); });

  return gen;
}

function computeLayout(people) {
  const gen = assignGenerations(people);

  // Group by generation
  const byGen = new Map();
  people.forEach(p => {
    const g = gen.get(p.id);
    if (!byGen.has(g)) byGen.set(g, []);
    byGen.get(g).push(p);
  });

  const positions = new Map();
  const sortedGens = [...byGen.keys()].sort((a, b) => a - b);

  sortedGens.forEach(g => {
    const nodes = byGen.get(g);
    const x = g * (NODE_W + H_GAP);
    nodes.forEach((p, i) => {
      const y = i * (NODE_H + V_GAP);
      positions.set(p.id, { x, y, gen: g });
    });
  });

  // Centre each generation vertically around the tallest generation
  const maxCount = Math.max(...[...byGen.values()].map(v => v.length));
  const totalH = maxCount * (NODE_H + V_GAP) - V_GAP;
  sortedGens.forEach(g => {
    const nodes = byGen.get(g);
    const colH = nodes.length * (NODE_H + V_GAP) - V_GAP;
    const offset = (totalH - colH) / 2;
    nodes.forEach(p => {
      const pos = positions.get(p.id);
      pos.y += offset;
    });
  });

  return { positions, byGen, gen };
}

// ── Build link paths (curved bezier from parent right-edge to child left-edge)

function buildLinks(people, positions) {
  const links = [];
  people.forEach(child => {
    const pids = (child.parent_ids || '').split(',').map(s => s.trim()).filter(Boolean);
    pids.forEach(pid => {
      const parentPos = positions.get(pid);
      const childPos  = positions.get(child.id);
      if (!parentPos || !childPos) return;

      const x1 = parentPos.x + NODE_W;
      const y1 = parentPos.y + NODE_H / 2;
      const x2 = childPos.x;
      const y2 = childPos.y + NODE_H / 2;
      const cx = (x1 + x2) / 2;

      links.push({ d: `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`, parentId: pid, childId: child.id });
    });
  });
  return links;
}

// ── SVG rendering ─────────────────────────────────────────────────────────

export function renderTree(people, svgEl, onNodeClick) {
  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();

  if (!people.length) return;

  const { positions, byGen } = computeLayout(people);
  const links = buildLinks(people, positions);

  // Compute total canvas size
  const maxX = Math.max(...[...positions.values()].map(p => p.x)) + NODE_W + 40;
  const maxY = Math.max(...[...positions.values()].map(p => p.y)) + NODE_H + 40;

  // Zoom / pan container
  const g = svg.append('g').attr('class', 'zoom-layer');

  const zoom = d3.zoom()
    .scaleExtent([0.15, 3])
    .on('zoom', e => g.attr('transform', e.transform));

  svg.call(zoom);

  // Initial transform: centre the tree in the viewport
  const vw = svgEl.clientWidth  || window.innerWidth;
  const vh = svgEl.clientHeight || window.innerHeight - 52;
  const scale = Math.min(1, (vw - 80) / maxX, (vh - 80) / maxY);
  const tx = (vw - maxX * scale) / 2;
  const ty = (vh - maxY * scale) / 2;
  svg.call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));

  // Expose zoom for toolbar buttons
  svgEl._zoom     = zoom;
  svgEl._zoomSel  = svg;

  // Generation labels
  const sortedGens = [...byGen.keys()].sort((a, b) => a - b);
  sortedGens.forEach(gIdx => {
    const nodes = byGen.get(gIdx);
    const x = gIdx * (NODE_W + H_GAP) + NODE_W / 2;
    const ys = nodes.map(p => positions.get(p.id).y);
    const labelY = Math.min(...ys) - 18;
    const genLabel = gIdx === 0 ? 'Generation I' :
                     gIdx === 1 ? 'Generation II' :
                     gIdx === 2 ? 'Generation III' :
                     `Gen ${gIdx + 1}`;
    g.append('text')
      .attr('class', 'gen-label')
      .attr('x', x)
      .attr('y', Math.max(0, labelY))
      .text(genLabel);
  });

  // Links
  const linkGroup = g.append('g').attr('class', 'links');
  linkGroup.selectAll('path')
    .data(links)
    .join('path')
    .attr('class', 'tree-link')
    .attr('d', l => l.d);

  // Nodes
  const nodeGroup = g.append('g').attr('class', 'nodes');

  const nodes = nodeGroup.selectAll('g.node-group')
    .data(people)
    .join('g')
    .attr('class', 'node-group')
    .attr('transform', p => {
      const pos = positions.get(p.id);
      return `translate(${pos.x},${pos.y})`;
    })
    .on('click', (event, p) => {
      event.stopPropagation();
      nodeGroup.selectAll('g.node-group').classed('selected', false);
      d3.select(event.currentTarget).classed('selected', true);
      onNodeClick(p);
    });

  // Card background
  nodes.append('rect')
    .attr('class', 'node-card')
    .attr('width', NODE_W)
    .attr('height', NODE_H);

  // Photo circle background
  nodes.append('circle')
    .attr('class', 'node-photo-bg')
    .attr('cx', PHOTO_CX)
    .attr('cy', PHOTO_CY)
    .attr('r', PHOTO_R);

  // Photo image (clipPath per node)
  const defs = svg.append('defs');
  people.forEach(p => {
    defs.append('clipPath')
      .attr('id', `clip-${p.id}`)
      .append('circle')
      .attr('cx', PHOTO_CX)
      .attr('cy', PHOTO_CY)
      .attr('r', PHOTO_R);
  });

  // Try loading photo; fall back to initials
  nodes.each(function(p) {
    const grp = d3.select(this);
    if (p.image) {
      const img = grp.append('image')
        .attr('class', 'node-photo')
        .attr('href', p.image)
        .attr('x', PHOTO_CX - PHOTO_R)
        .attr('y', PHOTO_CY - PHOTO_R)
        .attr('width', PHOTO_R * 2)
        .attr('height', PHOTO_R * 2)
        .attr('clip-path', `url(#clip-${p.id})`);

      // On error, show initials instead
      img.on('error', function() {
        d3.select(this).remove();
        grp.append('text')
          .attr('class', 'node-initials')
          .attr('x', PHOTO_CX)
          .attr('y', PHOTO_CY)
          .text(initials(p.name));
      });
    } else {
      grp.append('text')
        .attr('class', 'node-initials')
        .attr('x', PHOTO_CX)
        .attr('y', PHOTO_CY)
        .text(initials(p.name));
    }
  });

  // Photo border ring
  nodes.append('circle')
    .attr('class', 'node-photo-border')
    .attr('cx', PHOTO_CX)
    .attr('cy', PHOTO_CY)
    .attr('r', PHOTO_R);

  // Name text (right of photo)
  const textX = PHOTO_CX + PHOTO_R + 10;
  const textMaxW = NODE_W - textX - 6;

  nodes.each(function(p) {
    const grp = d3.select(this);
    const lines = wrapText(p.name, textMaxW);
    const yl = yearsLine(p.birth, p.death);
    const totalLines = lines.length + (yl ? 1 : 0);
    const lineH = 14;
    const startY = NODE_H / 2 - (totalLines * lineH) / 2 + lineH / 2;

    lines.forEach((ln, i) => {
      grp.append('text')
        .attr('class', 'node-name')
        .attr('x', textX)
        .attr('y', startY + i * lineH)
        .attr('dominant-baseline', 'central')
        .text(ln);
    });
    if (yl) {
      grp.append('text')
        .attr('class', 'node-years')
        .attr('x', textX)
        .attr('y', startY + lines.length * lineH)
        .attr('dominant-baseline', 'central')
        .text(yl);
    }
  });
}

// ── Modal ─────────────────────────────────────────────────────────────────

export function showModal(person) {
  const overlay = document.getElementById('modal-overlay');

  document.getElementById('modal-name').textContent  = person.name || '';
  document.getElementById('modal-years-line').textContent = yearsLine(person.birth, person.death) || '';

  // Photo
  const photoEl    = document.getElementById('modal-photo');
  const initialsEl = document.getElementById('modal-initials');
  if (person.image) {
    photoEl.src    = person.image;
    photoEl.style.display = 'block';
    initialsEl.style.display = 'none';
    photoEl.onerror = () => {
      photoEl.style.display = 'none';
      initialsEl.style.display = 'block';
      initialsEl.textContent = initials(person.name);
    };
  } else {
    photoEl.style.display    = 'none';
    initialsEl.style.display = 'block';
    initialsEl.textContent   = initials(person.name);
  }

  // Birth / Death
  document.getElementById('modal-birth').textContent = person.birth || '—';
  document.getElementById('modal-death').textContent = person.death || (person.birth ? 'Living' : '—');

  // Description
  const descWrap = document.getElementById('modal-desc-wrap');
  const descEl   = document.getElementById('modal-desc');
  if (person.description) {
    descEl.textContent = person.description;
    descWrap.style.display = 'block';
  } else {
    descWrap.style.display = 'none';
  }

  overlay.classList.add('open');
}

export function hideModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  document.querySelectorAll('g.node-group').forEach(n => n.classList.remove('selected'));
}

// ── Boot ──────────────────────────────────────────────────────────────────

export async function loadAndRender(csvText, svgEl, onNodeClick) {
  const people = parseCsv(csvText);
  renderTree(people, svgEl, onNodeClick);
  return people;
}
