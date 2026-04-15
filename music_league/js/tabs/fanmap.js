/**
 * tabs/fanmap.js — 🤝 Fan Map tab
 */

import {
  biggestFans, leastCompatible, allVotesMatrix,
  nameMap, mostGenerousVoter,
} from '../data.js';

import {
  el, sectionHeader, sectionCaption, divider,
  makeBarChart, makeSankey, makeHeatmap, htmlTable,
  ACCENT, PALETTE,
} from '../charts.js';

function hexToRgba(hex, alpha = 0.4) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function renderFanMap(container, data) {
  const names = nameMap(data.competitors);
  const allPlayerNames = [...new Set([...names.values()])].sort();

  // ── Target player selector ─────────────────────────────────────────────
  container.appendChild(sectionHeader('🤝 Fan Map'));
  const ctrlRow = el('div', 'panel-control-row');
  ctrlRow.appendChild(el('span', 'panel-label', '🎯 Target player:'));
  const sel = document.createElement('select');
  sel.className = 'panel-select';
  allPlayerNames.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    sel.appendChild(opt);
  });
  // Default to "Daniel" if present
  const danielOpt = allPlayerNames.find(n => n.toLowerCase().startsWith('daniel'));
  if (danielOpt) sel.value = danielOpt;
  ctrlRow.appendChild(sel);
  container.appendChild(ctrlRow);
  container.appendChild(sectionCaption("Select a player to see who are their biggest fans and least compatible matches."));

  const fansSection      = el('div');
  const sankeySection    = el('div');
  const incomingSection  = el('div');
  const fullSection      = el('div');
  const heatmapSection   = el('div');
  const generousSection  = el('div');

  container.appendChild(fansSection);
  container.appendChild(divider());
  container.appendChild(sankeySection);
  container.appendChild(divider());
  container.appendChild(incomingSection);
  container.appendChild(divider());
  container.appendChild(fullSection);
  container.appendChild(divider());
  container.appendChild(heatmapSection);
  container.appendChild(divider());
  container.appendChild(generousSection);

  sel.addEventListener('change', () => refresh(sel.value));

  function refresh(targetName) {
    renderFansCompat(fansSection, data, targetName);
    renderPlayerSankey(sankeySection, data, targetName);
    renderIncomingSankey(incomingSection, data, targetName);
    renderFullSankey(fullSection, data);
    renderPointsHeatmap(heatmapSection, data);
    renderGenerousVoter(generousSection, data);
  }

  refresh(sel.value);
}

function renderFansCompat(container, data, targetName) {
  container.innerHTML = '';
  const grid = el('div', 'grid-2');

  // Biggest fans
  const leftWrap = el('div');
  leftWrap.appendChild(el('h4', 'section-header', `💚 Biggest Fans of ${targetName}`));
  const fans = biggestFans(data, targetName).slice(0, 5);
  if (fans.length) {
    makeBarChart(leftWrap,
      fans.map(f => f.voter),
      fans.map(f => f.points_given),
      { color: ACCENT, xLabel: 'Points Given', title: `Top 5 — points given to ${targetName}` }
    );
    leftWrap.appendChild(htmlTable(
      ['Voter', 'Points Given'],
      fans.map(f => ({ Voter: f.voter, 'Points Given': f.points_given }))
    ));
  } else {
    leftWrap.appendChild(el('p', 'caption', 'No voting data found.'));
  }
  grid.appendChild(leftWrap);

  // Least compatible
  const rightWrap = el('div');
  rightWrap.appendChild(el('h4', 'section-header', `💔 Least Compatible with ${targetName}`));
  const compat = leastCompatible(data, targetName).slice(0, 5);
  if (compat.length) {
    makeBarChart(rightWrap,
      compat.map(f => f.voter),
      compat.map(f => f.points_given),
      { color: '#e05252', xLabel: 'Points Given', title: `Bottom 5 — points given to ${targetName}` }
    );
    rightWrap.appendChild(htmlTable(
      ['Voter', 'Points Given'],
      compat.map(f => ({ Voter: f.voter, 'Points Given': f.points_given }))
    ));
  } else {
    rightWrap.appendChild(el('p', 'caption', 'No voting data found.'));
  }
  grid.appendChild(rightWrap);

  container.appendChild(grid);
}

function renderPlayerSankey(container, data, targetName) {
  container.innerHTML = '';
  container.appendChild(el('h4', 'section-header', `🎵 How ${targetName} Voted`));
  container.appendChild(sectionCaption(`Points sent by ${targetName} to every other player across all rounds.`));

  const names = nameMap(data.competitors);
  const invMap = new Map([...names.entries()].map(([k, v]) => [v, k]));
  const targetId = invMap.get(targetName);
  if (!targetId) { container.appendChild(el('p', 'caption', 'Player not found.')); return; }

  const uriToSub = new Map(data.submissions.map(s => [s.SpotifyURI, s['Submitter ID']]));
  const edges    = new Map(); // receiverName -> total points

  data.votes.forEach(v => {
    if (v['Voter ID'] !== targetId) return;
    const recv = uriToSub.get(v.SpotifyURI);
    if (!recv || recv === targetId) return;
    const rName = names.get(recv) || recv;
    edges.set(rName, (edges.get(rName) || 0) + Number(v.Points || 0));
  });

  if (edges.size === 0) {
    container.appendChild(el('p', 'caption', `No voting data found for ${targetName}.`));
    return;
  }

  const receivers = [...edges.entries()].sort((a, b) => b[1] - a[1]);
  const receiverColors = Object.fromEntries(receivers.map(([n], i) => [n, PALETTE[i % PALETTE.length]]));

  const nodes = [
    { id: '__voter__', name: targetName, color: ACCENT },
    ...receivers.map(([n]) => ({ id: n, name: n, color: receiverColors[n] })),
  ];
  const links = receivers.map(([n, pts]) => ({
    source: '__voter__',
    target: n,
    value:  pts,
    color:  hexToRgba(receiverColors[n]),
  }));

  makeSankey(container, nodes, links, {
    width:  700,
    height: Math.max(380, receivers.length * 36 + 60),
  });
}

function renderIncomingSankey(container, data, targetName) {
  container.innerHTML = '';
  container.appendChild(el('h4', 'section-header', `🎯 Who Voted for ${targetName}`));
  container.appendChild(sectionCaption(`Points received by ${targetName} from every other player across all rounds.`));

  const names    = nameMap(data.competitors);
  const invMap   = new Map([...names.entries()].map(([k, v]) => [v, k]));
  const targetId = invMap.get(targetName);
  if (!targetId) { container.appendChild(el('p', 'caption', 'Player not found.')); return; }

  const uriToSub = new Map(data.submissions.map(s => [s.SpotifyURI, s['Submitter ID']]));
  const edges    = new Map(); // voterName -> total points given to target

  data.votes.forEach(v => {
    const recv = uriToSub.get(v.SpotifyURI);
    if (!recv || recv !== targetId) return;
    if (v['Voter ID'] === targetId) return;
    const vName = names.get(v['Voter ID']) || v['Voter ID'];
    edges.set(vName, (edges.get(vName) || 0) + Number(v.Points || 0));
  });

  if (edges.size === 0) {
    container.appendChild(el('p', 'caption', `No votes found for ${targetName}.`));
    return;
  }

  const voters      = [...edges.entries()].sort((a, b) => b[1] - a[1]);
  const voterColors = Object.fromEntries(voters.map(([n], i) => [n, PALETTE[i % PALETTE.length]]));

  const nodes = [
    ...voters.map(([n]) => ({ id: n, name: n, color: voterColors[n] })),
    { id: '__target__', name: targetName, color: ACCENT },
  ];
  const links = voters.map(([n, pts]) => ({
    source: n,
    target: '__target__',
    value:  pts,
    color:  hexToRgba(voterColors[n]),
  }));

  makeSankey(container, nodes, links, {
    width:  700,
    height: Math.max(380, voters.length * 36 + 60),
  });
}

function renderFullSankey(container, data) {
  container.innerHTML = '';
  container.appendChild(el('h4', 'section-header', '🗺️ Full Points-Given Matrix'));
  container.appendChild(sectionCaption('Rows = voter  ·  Columns = submitter who received the points'));

  const edges = allVotesMatrix(data);
  if (edges.length === 0) { container.appendChild(el('p', 'caption', 'No data.')); return; }

  // Order: voters by total sent, receivers by total received
  const totalSent = new Map();
  const totalRecv = new Map();
  edges.forEach(e => {
    totalSent.set(e.voterName, (totalSent.get(e.voterName) || 0) + e.points);
    totalRecv.set(e.receiverName, (totalRecv.get(e.receiverName) || 0) + e.points);
  });

  const voters    = [...totalSent.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const receivers = [...totalRecv.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);

  const receiverColors = Object.fromEntries(receivers.map((n, i) => [n, PALETTE[i % PALETTE.length]]));
  const nodes = [
    ...voters.map(n    => ({ id: 'v_' + n, name: n, color: '#888888' })),
    ...receivers.map(n => ({ id: 'r_' + n, name: n, color: receiverColors[n] })),
  ];
  const links = edges.map(e => ({
    source: 'v_' + e.voterName,
    target: 'r_' + e.receiverName,
    value:  e.points,
    color:  hexToRgba(receiverColors[e.receiverName] || '#888'),
  }));

  makeSankey(container, nodes, links, {
    width:  700,
    height: Math.max(400, Math.max(voters.length, receivers.length) * 28 + 60),
  });
}

function renderPointsHeatmap(container, data) {
  container.innerHTML = '';
  container.appendChild(el('h4', 'section-header', '🔥 Points Given Heatmap'));
  container.appendChild(sectionCaption('Rows = voter  ·  Columns = receiver  ·  Value = total points given across selected leagues'));

  const edges = allVotesMatrix(data);
  if (edges.length === 0) { container.appendChild(el('p', 'caption', 'No data.')); return; }

  // Collect all unique voter and receiver names
  const voterSet    = new Set(edges.map(e => e.voterName));
  const receiverSet = new Set(edges.map(e => e.receiverName));

  // Union of all player names so axis is consistent
  const allNames = [...new Set([...voterSet, ...receiverSet])].sort();

  // Build lookup map
  const lookup = new Map();
  edges.forEach(e => lookup.set(`${e.voterName}|||${e.receiverName}`, e.points));

  // Build matrix (rowLabels = voters sorted by total sent desc, colLabels = receivers by total received desc)
  const totalSent = new Map();
  const totalRecv = new Map();
  edges.forEach(e => {
    totalSent.set(e.voterName,    (totalSent.get(e.voterName)    || 0) + e.points);
    totalRecv.set(e.receiverName, (totalRecv.get(e.receiverName) || 0) + e.points);
  });

  const rowLabels = [...new Set(edges.map(e => e.voterName))].sort((a, b) => (totalSent.get(b) || 0) - (totalSent.get(a) || 0));
  const colLabels = [...new Set(edges.map(e => e.receiverName))].sort((a, b) => (totalRecv.get(b) || 0) - (totalRecv.get(a) || 0));

  const matrix = rowLabels.map(row =>
    colLabels.map(col => lookup.get(`${row}|||${col}`) || 0)
  );

  const cellSize = Math.max(34, Math.min(52, Math.floor(540 / colLabels.length)));
  makeHeatmap(container, rowLabels, colLabels, matrix, {
    cellW: cellSize,
    cellH: Math.max(28, cellSize - 4),
    colorRange: ['#0a1418', ACCENT],
  });
}

function renderGenerousVoter(container, data) {
  container.innerHTML = '';
  container.appendChild(el('h4', 'section-header', '🎁 Most Generous Voter'));
  container.appendChild(sectionCaption('Average number of distinct players voted for per round.'));

  const results = mostGenerousVoter(data);
  if (results.length === 0) { container.appendChild(el('p', 'caption', 'No data.')); return; }

  makeBarChart(
    container,
    results.map(r => r.voter),
    results.map(r => r.avg_distinct_recipients_per_round),
    { color: ACCENT, xLabel: 'Avg players voted for per round', title: 'Most Generous Voter' }
  );
}
