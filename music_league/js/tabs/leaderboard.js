/**
 * tabs/leaderboard.js — 🏆 Leaderboard tab
 */

import {
  top3Winners, topPodiumAppearances, mostMisunderstood,
  playerRoundAverages, uniqueVotersPerPlayer, zeroPointsIncidents,
  pointsPerSubmission, nameMap,
} from '../data.js';

import {
  el, sectionHeader, sectionCaption, divider,
  statTile, tileGroup, makeBarChart, makeComboChart, makeHeatmap, esc, destroyChart, ACCENT,
} from '../charts.js';

const WINNER_STYLES  = [
  { bg: '#2a220a', icon: '🥇' }, { bg: '#1a2228', icon: '🥈' }, { bg: '#2a1a0a', icon: '🥉' },
  { bg: '#0a1e14', icon: '4️⃣' }, { bg: '#0d2019', icon: '5️⃣' },
];
const PODIUM_COLORS = ['#0a1e14','#0e2418','#152e1e','#1a3824','#1f3e28'];
const MISUND_COLORS = ['#2a0a0a','#301010','#361616','#3a1c1c','#3e2020'];
const AVG_COLORS    = ['#0a1626','#0e1c30','#12223a','#162842','#1a2e4a'];

export function renderLeaderboard(container, data) {
  // ── Stat tiles ──────────────────────────────────────────────────────────
  const winners = top3Winners(data, 5);
  const podium  = topPodiumAppearances(data, 3).slice(0, 5);
  const misund  = mostMisunderstood(data, 5);
  const avgs    = playerRoundAverages(data).slice(0, 5);

  const winTiles   = winners.map((w, i) => statTile(WINNER_STYLES[i].icon, w.name, `${w.points} pts`, WINNER_STYLES[i].bg));
  const podTiles   = podium.map((e, i)  => statTile('🎯', e.name, `${e.podium_appearances}× top-3`, PODIUM_COLORS[i]));
  const avgTiles   = avgs.map((e, i)    => statTile('📈', e.name, `${e.avg_points} avg · ${e.rounds} rounds`, AVG_COLORS[i]));
  const misTiles   = misund.map((e, i)  => statTile('💔', e.name, `${e.points} pts`, MISUND_COLORS[i]));

  const tileRow = el('div', 'grid-4');
  tileRow.appendChild(tileGroup('🏆 Top 5 Winners',           winTiles));
  tileRow.appendChild(tileGroup('🥇 Top Podium Appearances',  podTiles));
  tileRow.appendChild(tileGroup('📈 Top by Round Average',    avgTiles));
  tileRow.appendChild(tileGroup('😥 Most Misunderstood',      misTiles));
  container.appendChild(tileRow);
  container.appendChild(divider());

  // ── [TEST] Combined Total + Average Points ──────────────────────────────
  container.appendChild(sectionHeader('🏅 Points Overview — Total & Average per Round'));
  container.appendChild(sectionCaption(
    'Bars show total points earned; the lollipops show average points per round.'
  ));
  {
    const names  = nameMap(data.competitors);
    const pps    = pointsPerSubmission(data.submissions, data.votes);
    const totals = new Map();
    pps.forEach(p => totals.set(p['Submitter ID'], (totals.get(p['Submitter ID']) || 0) + p.TotalPoints));

    const avgByName = new Map(playerRoundAverages(data).map(e => [e.name, e.avg_points]));

    // Build one row per player: { name, total, avg }
    const rows = [...totals.entries()].map(([id, total]) => {
      const name = names.get(id) || id;
      return { name, total, avg: avgByName.get(name) ?? 0 };
    });

    // Sort toggle
    const controls = el('div', 'sort-toggle');
    const sortLabel = el('span', 'sort-toggle-label', 'Sort by:');
    const btnTotal  = el('button', 'sort-btn active', 'Total Points');
    const btnAvg    = el('button', 'sort-btn', 'Avg / Round');
    controls.appendChild(sortLabel);
    controls.appendChild(btnTotal);
    controls.appendChild(btnAvg);
    container.appendChild(controls);

    const chartHost = el('div', '');
    container.appendChild(chartHost);

    let comboChart = null;
    const render = key => {
      const sorted = [...rows].sort((a, b) => b[key] - a[key]);
      const labels = sorted.map(r => r.name);
      destroyChart(comboChart);
      chartHost.innerHTML = '';
      comboChart = makeComboChart(chartHost, labels,
        { label: 'Total Points',       data: sorted.map(r => r.total), color: ACCENT },
        { label: 'Avg Points / Round', data: sorted.map(r => r.avg),   color: '#7ec8e3' },
        { title: 'Total & Average Points', horizontal: true, lollipop: true,
          showAxis: key === 'avg' ? 'line' : 'bar' }
      );
    };

    btnTotal.addEventListener('click', () => {
      btnTotal.classList.add('active');
      btnAvg.classList.remove('active');
      render('total');
    });
    btnAvg.addEventListener('click', () => {
      btnAvg.classList.add('active');
      btnTotal.classList.remove('active');
      render('avg');
    });

    render('total');
  }
  container.appendChild(divider());

  // Shared computations used by the per-round heatmap below
  const names  = nameMap(data.competitors);
  const pps    = pointsPerSubmission(data.submissions, data.votes);
  const totals = new Map();
  pps.forEach(p => totals.set(p['Submitter ID'], (totals.get(p['Submitter ID']) || 0) + p.TotalPoints));
  const sortedTotals = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const uvResult = uniqueVotersPerPlayer(data);

  // ── Zero points incidents ───────────────────────────────────────────────
  container.appendChild(sectionHeader('0️⃣ Zero Points Incidents'));
  const zpi = zeroPointsIncidents(data);
  const zMetric = el('p', 'caption', `Total zero-point rounds across all players: ${zpi.total}`);
  container.appendChild(zMetric);
  if (zpi.byPerson.length > 0) {
    // Group incidents by player name
    const byName = new Map();
    zpi.incidents.forEach(inc => {
      if (!byName.has(inc.name)) byName.set(inc.name, []);
      byName.get(inc.name).push(inc);
    });

    const zChart = el('div', 'zero-chart');
    const maxCount = Math.max(...zpi.byPerson.map(p => p.zero_rounds));
    zChart.style.setProperty('--zero-cols', maxCount);
    zpi.byPerson.forEach(person => {
      const row = el('div', 'zero-row');
      row.appendChild(el('div', 'zero-row-label', person.name));

      (byName.get(person.name) || []).forEach(inc => {
        const tile = el('div', 'zero-tile');
        const parts = [
          inc.league ? `League: ${inc.league}` : null,
          `Round: ${inc.round}`,
          `Song: ${inc.title}`,
          `Artist: ${inc.artist}`,
        ].filter(Boolean);
        tile.title = parts.join('\n');
        tile.innerHTML =
          `<span class="zero-tile-round">${esc(inc.round)}</span>` +
          `<span class="zero-tile-song">${esc(inc.title)}</span>` +
          `<span class="zero-tile-artist">${esc(inc.artist)}</span>`;
        row.appendChild(tile);
      });
      zChart.appendChild(row);
    });
    container.appendChild(zChart);
  }
  container.appendChild(divider());

  // ── Per-round heatmap (Points / Unique Voters toggle) ─────────────────────
  container.appendChild(sectionHeader('📊 Per-Round Heatmap'));
  {
    const roundNameMap = new Map(data.rounds.map(r => [r.ID, r.Name]));
    const roundOrder   = [...data.rounds]
      .sort((a, b) => new Date(a.Created) - new Date(b.Created))
      .map(r => r.Name);

    // Build points player × round matrix
    const playerNames = sortedTotals.map(([id]) => names.get(id) || id);
    const playerIndex = new Map(playerNames.map((n, i) => [n, i]));

    const pointsMatrix = playerNames.map(() => roundOrder.map(() => 0));
    pps.forEach(p => {
      const playerName = names.get(p['Submitter ID']);
      const roundName  = roundNameMap.get(p['Round ID']);
      if (playerName && roundName) {
        const ri = playerIndex.get(playerName);
        const ci = roundOrder.indexOf(roundName);
        if (ri !== undefined && ci !== -1) pointsMatrix[ri][ci] = p.TotalPoints;
      }
    });

    // Build unique voters player × round matrix
    const { pivot, totals: uvTotals, orderedRounds } = uvResult;
    const uvPlayers = uvTotals.map(e => e.Player);
    const uvMatrix  = uvPlayers.map(player => {
      const rowMap = pivot.get(player) || new Map();
      return orderedRounds.map(col => rowMap.get(col) || 0);
    });

    // Metric toggle
    const controls = el('div', 'sort-toggle');
    controls.appendChild(el('span', 'sort-toggle-label', 'Show:'));
    const btnPoints = el('button', 'sort-btn active', 'Points');
    const btnVotes  = el('button', 'sort-btn', 'Unique Voters');
    controls.appendChild(btnPoints);
    controls.appendChild(btnVotes);
    container.appendChild(controls);

    const heatHost = el('div', '');
    container.appendChild(heatHost);

    const render = metric => {
      heatHost.innerHTML = '';
      if (metric === 'points') {
        makeHeatmap(heatHost, playerNames, roundOrder, pointsMatrix, {
          title: 'Points earned per player per round',
          cellW: Math.max(30, Math.min(50, Math.floor(700 / Math.max(roundOrder.length, 1)))),
          cellH: 26,
          colorRange: ['#0a1a10', ACCENT],
        });
      } else {
        makeHeatmap(heatHost, uvPlayers, orderedRounds, uvMatrix, {
          title: 'Unique voters per player per round',
          cellW: Math.max(30, Math.min(50, Math.floor(700 / Math.max(orderedRounds.length, 1)))),
          cellH: 26,
          colorRange: ['#0e0a1e', '#c77dff'],
        });
      }
    };

    btnPoints.addEventListener('click', () => {
      btnPoints.classList.add('active');
      btnVotes.classList.remove('active');
      render('points');
    });
    btnVotes.addEventListener('click', () => {
      btnVotes.classList.add('active');
      btnPoints.classList.remove('active');
      render('votes');
    });

    render('points');
  }
  container.appendChild(divider());

  // ── Unique Voters ───────────────────────────────────────────────────────
  container.appendChild(sectionHeader('👥 Unique Voters'));
  container.appendChild(sectionCaption(
    'Distinct voters who gave each player ≥1 point, counted per round.'
  ));
  makeBarChart(container,
    uvResult.totals.map(e => e.Player),
    uvResult.totals.map(e => e.TotalUniqueVoters),
    { color: '#c77dff', xLabel: 'Total Unique Voters', title: 'Total Unique Voters Per Player (summed across rounds)' }
  );
}
