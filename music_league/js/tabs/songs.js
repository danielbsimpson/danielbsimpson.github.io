/**
 * tabs/songs.js — 🎵 Song Stats tab
 */

import {
  mostUniversallyLiked, biggestBlowout,
  mostSubmittedSongs, mostArtistAppearances,
  pointsPerSubmission, nameMap,
} from '../data.js';

import {
  el, sectionHeader, sectionCaption, divider,
  makeBarChart, htmlTable, expander, statTile, esc, ACCENT,
} from '../charts.js';

export function renderSongs(container, data) {
  container.appendChild(sectionHeader('🎵 Song Stats'));

  // ── Top N slider ────────────────────────────────────────────────────────
  const ctrlRow = el('div', 'panel-control-row');
  ctrlRow.innerHTML = `<span class="panel-label">Show top </span>`;
  const rangeInput = document.createElement('input');
  rangeInput.type      = 'range'; rangeInput.min = 3; rangeInput.max = 20; rangeInput.value = 10;
  rangeInput.className = 'panel-range'; rangeInput.id = 'songs-topn';
  const rangeLabel = el('span', 'panel-label', '10');
  rangeInput.addEventListener('input', () => { rangeLabel.textContent = rangeInput.value; refresh(); });
  ctrlRow.appendChild(rangeInput);
  ctrlRow.appendChild(rangeLabel);
  ctrlRow.appendChild(el('span', 'panel-label', 'songs'));

  // Containers for lazy re-render
  const likedSection     = el('div');
  const blowoutSection   = el('div');
  const repeatedSection  = el('div');
  const artistsSection   = el('div');

  // ── Ordered layout ───────────────────────────────────────────────────────
  // 1. All Submitted Songs
  container.appendChild(renderAllSongs(data));
  container.appendChild(divider());
  // 2. Restricted Songs
  container.appendChild(renderRestrictedList(data));
  container.appendChild(divider());
  // 3. Most Submitted Songs
  container.appendChild(repeatedSection);
  container.appendChild(divider());
  // 4. Most Artist Appearances
  container.appendChild(artistsSection);
  container.appendChild(divider());
  // 5. Most Universally Liked Songs
  container.appendChild(likedSection);
  container.appendChild(divider());
  // Everything else
  container.appendChild(blowoutSection);

  function refresh() {
    const topN = Number(rangeInput.value);
    renderLiked(likedSection, data, topN, ctrlRow);
    renderBlowouts(blowoutSection, data);
    renderRepeated(repeatedSection, data);
    renderArtists(artistsSection, data);
  }

  refresh();
}

function renderLiked(container, data, topN, ctrlRow) {
  container.innerHTML = '';
  container.appendChild(sectionHeader('❤️ Most Universally Liked Songs'));
  if (ctrlRow) container.appendChild(ctrlRow);
  const { byPoints, byVoters } = mostUniversallyLiked(data, topN);

  const grid = el('div', 'grid-2');

  // By Points
  const leftWrap = el('div');
  leftWrap.appendChild(el('p', 'caption', 'By Total Points'));
  makeBarChart(leftWrap,
    byPoints.map(s => `${s.title} — ${s.artist}`),
    byPoints.map(s => s.total_points),
    { color: ACCENT, xLabel: 'Points', title: 'Most points received', horizontal: true }
  );
  leftWrap.appendChild(expander('📋 Open Table View', htmlTable(
    ['Title', 'Artist', 'Submitted By', 'Points', 'Voters'],
    byPoints.map(s => ({
      Title: s.title, Artist: s.artist, 'Submitted By': s.submitted_by,
      Points: s.total_points, Voters: s.voter_count,
    }))
  )));
  grid.appendChild(leftWrap);

  // By Voters
  const rightWrap = el('div');
  rightWrap.appendChild(el('p', 'caption', 'By Number of Voters'));
  makeBarChart(rightWrap,
    byVoters.map(s => `${s.title} — ${s.artist}`),
    byVoters.map(s => s.voter_count),
    { color: '#b47bff', xLabel: 'Voters', title: 'Most distinct voters', horizontal: true }
  );
  rightWrap.appendChild(expander('📋 Open Table View', htmlTable(
    ['Title', 'Artist', 'Submitted By', 'Points', 'Voters'],
    byVoters.map(s => ({
      Title: s.title, Artist: s.artist, 'Submitted By': s.submitted_by,
      Points: s.total_points, Voters: s.voter_count,
    }))
  )));
  grid.appendChild(rightWrap);

  container.appendChild(grid);
}

function renderBlowouts(container, data) {
  container.innerHTML = '';
  container.appendChild(sectionHeader('💥 Biggest Blowouts'));
  container.appendChild(sectionCaption('Rounds where the winner had the largest margin over 2nd place.'));

  const blowouts = biggestBlowout(data);
  makeBarChart(container,
    blowouts.map(b => b.round),
    blowouts.map(b => b.margin),
    { color: '#ffd166', horizontal: false, xLabel: 'Round', title: 'Winning margin per round (1st − 2nd place pts)', height: 320 }
  );
  container.appendChild(expander('📋 Open Table View', htmlTable(
    ['Round', 'Winner', 'Winning Song', 'Winner Pts', '2nd Place', '2nd Pts', 'Margin'],
    blowouts.map(b => ({
      Round: b.round, Winner: b.winner, 'Winning Song': b.winner_song,
      'Winner Pts': b.winner_points, '2nd Place': b.second_place,
      '2nd Pts': b.second_points, Margin: b.margin,
    }))
  )));
}

function renderRepeated(container, data) {
  container.innerHTML = '';
  container.appendChild(sectionHeader('🔁 Most Submitted Songs'));
  container.appendChild(sectionCaption('Songs submitted more than once across all rounds.'));

  const repeated = mostSubmittedSongs(data, 10);
  if (repeated.length === 0) {
    container.appendChild(el('p', 'banner banner-success', 'No song was submitted more than once. 🎉'));
    return;
  }
  const repeatedGrid = el('div', 'grid-5');
  repeated.forEach(s => {
    const tile = el('div', 'square-tile');
    tile.style.background = '#2a1a3a';
    tile.innerHTML =
      `<span class="square-tile-title">${esc(s.title)}</span>` +
      `<span class="square-tile-sub">${esc(s.artist)}</span>` +
      `<span class="square-tile-value">${esc(s.count)}× submitted</span>`;
    repeatedGrid.appendChild(tile);
  });
  container.appendChild(repeatedGrid);
}

function renderArtists(container, data) {
  container.innerHTML = '';
  container.appendChild(sectionHeader('🎤 Most Artist Appearances'));
  container.appendChild(sectionCaption("Artists appearing most frequently across all submissions."));

  const artists = mostArtistAppearances(data, 10);
  const artistsGrid = el('div', 'grid-5');
  artists.forEach(a => {
    const tile = el('div', 'square-tile');
    tile.style.background = '#3a1420';
    tile.innerHTML =
      `<span class="square-tile-title">${esc(a.artist)}</span>` +
      `<span class="square-tile-value">${esc(a.count)}× appearances</span>`;
    artistsGrid.appendChild(tile);
  });
  container.appendChild(artistsGrid);
}

function renderRestrictedList(data) {
  const names    = nameMap(data.competitors);
  const roundMap = new Map(data.rounds.map(r => [r.ID, r.Name]));
  const withPts  = pointsPerSubmission(data.submissions, data.votes);

  // Group by round and pick top 3 per round
  const byRound = new Map();
  withPts.forEach(s => {
    const rid = s['Round ID'];
    if (!byRound.has(rid)) byRound.set(rid, []);
    byRound.get(rid).push(s);
  });

  const podiumRows = [];
  for (const [rid, entries] of byRound) {
    const sorted = [...entries].sort((a, b) => b.TotalPoints - a.TotalPoints);
    sorted.slice(0, 3).forEach((s, i) => {
      podiumRows.push({
        Position:       i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉',
        Title:          s.Title  || s.title  || '',
        Artist:         s['Artist(s)'] || s.Artist || s.artist || '',
        Theme:          roundMap.get(rid) || rid,
        'Submitted By': names.get(s['Submitter ID']) || s['Submitter ID'] || '',
        Points:         s.TotalPoints,
      });
    });
  }

  // Sort by theme then position within theme
  podiumRows.sort((a, b) => {
    if (a.Theme !== b.Theme) return a.Theme.localeCompare(b.Theme);
    const posOrder = { '🥇': 0, '🥈': 1, '🥉': 2 };
    return (posOrder[a.Position] || 0) - (posOrder[b.Position] || 0);
  });

  const content = el('div');
  content.appendChild(sectionCaption(
    `Songs that finished on the podium (top 3) in previous rounds — ${podiumRows.length} songs total.`
  ));

  const searchInput = document.createElement('input');
  searchInput.type        = 'text';
  searchInput.className   = 'panel-search';
  searchInput.placeholder = '🔍 Search songs, artists, players…';

  const tableWrap = el('div');
  const cols = ['Position', 'Title', 'Artist', 'Theme', 'Submitted By', 'Points'];

  function renderTable(filter) {
    tableWrap.innerHTML = '';
    const filtered = filter
      ? podiumRows.filter(r =>
          ['Title', 'Artist', 'Submitted By', 'Theme']
            .some(k => String(r[k]).toLowerCase().includes(filter.toLowerCase()))
        )
      : podiumRows;
    tableWrap.appendChild(htmlTable(cols, filtered));
  }

  searchInput.addEventListener('input', () => renderTable(searchInput.value));
  renderTable('');

  const searchRow = el('div', 'panel-control-row');
  searchRow.appendChild(searchInput);
  content.appendChild(searchRow);
  content.appendChild(tableWrap);

  return expander(`🚫 Restricted List (${podiumRows.length} songs)`, content);
}

function renderAllSongs(data) {
  const names    = nameMap(data.competitors);
  const roundMap = new Map(data.rounds.map(r => [r.ID, r.Name]));
  const withPts  = pointsPerSubmission(data.submissions, data.votes);

  const rows = withPts.map(s => ({
    Title:       s.Title  || s.title  || '',
    Artist:      s['Artist(s)'] || s.Artist || s.artist || '',
    'Submitted By': names.get(s['Submitter ID']) || s['Submitter ID'] || '',
    Round:       roundMap.get(s['Round ID']) || s['Round ID'] || '',
    Points:      s.TotalPoints,
  })).sort((a, b) => b.Points - a.Points);

  const searchInput = document.createElement('input');
  searchInput.type        = 'text';
  searchInput.className   = 'panel-search';
  searchInput.placeholder = '🔍 Search songs, artists, players…';

  const tableWrap = el('div');

  function renderTable(filter) {
    tableWrap.innerHTML = '';
    const filtered = filter
      ? rows.filter(r =>
          ['Title', 'Artist', 'Submitted By', 'Round']
            .some(k => String(r[k]).toLowerCase().includes(filter.toLowerCase()))
        )
      : rows;
    tableWrap.appendChild(htmlTable(
      ['Title', 'Artist', 'Submitted By', 'Round', 'Points'],
      filtered
    ));
  }

  searchInput.addEventListener('input', () => renderTable(searchInput.value));
  renderTable('');

  const content = el('div');
  const searchRow = el('div', 'panel-control-row');
  searchRow.appendChild(searchInput);
  content.appendChild(searchRow);
  content.appendChild(tableWrap);

  return expander(`🎵 All Submitted Songs (${rows.length})`, content);
}
