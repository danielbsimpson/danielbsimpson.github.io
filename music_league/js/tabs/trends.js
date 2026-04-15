/**
 * tabs/trends.js — 📈 Trends & Consistency tab
 */

import {
  mostConsistentSubmitter, mostVolatileSubmitter,
  halfVsHalf, pointsOverTime, roundByRoundBreakdown, rankOverTime,
  top3Winners,
} from '../data.js';

import {
  el, sectionHeader, sectionCaption, divider,
  makeBarChart, makeGroupedBarChart, makeLineChart, htmlTable,
  ACCENT, PALETTE, expander, esc,
} from '../charts.js';

export function renderTrends(container, data) {
  container.appendChild(sectionHeader('📈 Trends & Consistency'));

  // Compute top-5 players by total points (used to default chart visibility)
  const top5Players = new Set(top3Winners(data, 5).map(e => e.name));

  // ── Consistency / Volatility ────────────────────────────────────────────
  {
    const grid = el('div', 'grid-2');

    const conWrap = el('div');
    conWrap.appendChild(el('h4', 'section-header', '📏 Most Consistent (Lowest Variance)'));
    const con = mostConsistentSubmitter(data);
    makeBarChart(conWrap, con.map(e => e.name), con.map(e => e.variance),
      { color: ACCENT, xLabel: 'Variance', title: 'Points variance (lower = more consistent)' });
    grid.appendChild(conWrap);

    const volWrap = el('div');
    volWrap.appendChild(el('h4', 'section-header', '🎢 Most Volatile (Highest Variance)'));
    const vol = mostVolatileSubmitter(data);
    makeBarChart(volWrap, vol.map(e => e.name), vol.map(e => e.variance),
      { color: '#e05252', xLabel: 'Variance', title: 'Points variance (higher = more volatile)' });
    grid.appendChild(volWrap);

    container.appendChild(grid);
  }
  container.appendChild(divider());

  // ── Most Improved ───────────────────────────────────────────────────────
  container.appendChild(sectionHeader('📈 Most Improved'));

  const isCumulative = data.leagueRounds && data.leagueRounds.length > 1;

  if (isCumulative) {
    // Current league vs. all combined
    const currentRds = [...data.leagueRounds[data.leagueRounds.length - 1]]
      .sort((a, b) => new Date(a.Created) - new Date(b.Created))
      .map(r => r.ID);

    const allRds = [...data.rounds]
      .sort((a, b) => new Date(a.Created) - new Date(b.Created))
      .map(r => r.ID);

    const curLabel   = data.leagueNames[data.leagueNames.length - 1];
    const nCur       = currentRds.length;
    const nAll       = allRds.length;

    const grid = el('div', 'grid-2');

    // Current league
    const curWrap = el('div');
    curWrap.appendChild(el('p', 'caption', `🗓️ Current League — ${curLabel}`));
    curWrap.appendChild(el('p', 'caption', `${nCur} rounds split into two halves (rounds 1–${Math.floor(nCur/2)} vs ${Math.floor(nCur/2)+1}–${nCur})`));
    const curImproved = halfVsHalf(data, currentRds);
    renderImprovedChart(curWrap, curImproved);
    grid.appendChild(curWrap);

    // All combined
    const allWrap = el('div');
    allWrap.appendChild(el('p', 'caption', '📚 Cumulative — all leagues'));
    allWrap.appendChild(el('p', 'caption', `${nAll} rounds split into two halves (rounds 1–${Math.floor(nAll/2)} vs ${Math.floor(nAll/2)+1}–${nAll})`));
    const allImproved = halfVsHalf(data, allRds);
    renderImprovedChart(allWrap, allImproved);
    grid.appendChild(allWrap);

    container.appendChild(grid);
  } else {
    const rdsOrdered = [...data.rounds]
      .sort((a, b) => new Date(a.Created) - new Date(b.Created))
      .map(r => r.ID);
    const n = rdsOrdered.length;
    container.appendChild(el('p', 'caption', `${n} rounds split into two halves (rounds 1–${Math.floor(n/2)} vs ${Math.floor(n/2)+1}–${n})`));
    const improved = halfVsHalf(data, rdsOrdered);
    renderImprovedChart(container, improved);
  }
  container.appendChild(divider());

  // ── Points Over Time ────────────────────────────────────────────────────
  container.appendChild(sectionHeader('📉 Points Over Time (per player)'));
  const { series, orderedRounds } = pointsOverTime(data);
  if (series.length > 0) {
    makeLineChart(container, orderedRounds, series, {
      title: 'Points scored each round',
      height: 380,
      visiblePlayers: top5Players,
    });
  }

  container.appendChild(divider());

  // ── Rank Over Time ──────────────────────────────────────────────────────
  container.appendChild(sectionHeader('🏅 Rank Over Time'));
  container.appendChild(sectionCaption('Cumulative leaderboard position after each round. Lower = better. Rank is based on total points accumulated up to and including that round.'));
  const { orderedRounds: rankRounds, series: rankSeries } = rankOverTime(data);
  if (rankSeries.length > 0) {
    makeRankChart(container, rankRounds, rankSeries, top5Players);
  }

  container.appendChild(divider());

  // ── Round-by-Round Breakdown ────────────────────────────────────────────
  container.appendChild(sectionHeader('📋 Round-by-Round Breakdown'));
  container.appendChild(sectionCaption('Expand each round to see that round\'s top 3 submissions and the cumulative leaderboard standings at that point in time.'));
  renderRoundBreakdown(container, data);
}

function renderImprovedChart(container, improved) {
  if (!improved.length) { container.appendChild(el('p', 'caption', 'Not enough data for improvement comparison.')); return; }

  makeGroupedBarChart(
    container,
    improved.map(e => e.player),
    [
      { label: 'First Half Avg',  data: improved.map(e => e.firstAvg),  color: '#888888' },
      { label: 'Second Half Avg', data: improved.map(e => e.secondAvg), color: ACCENT },
    ],
    { title: 'First half vs second half average', yLabel: 'Avg pts / round', height: 340 }
  );
  container.appendChild(htmlTable(
    ['Player', 'First Half Avg', 'Second Half Avg', 'Improvement'],
    improved.map(e => ({
      Player: e.player,
      'First Half Avg':  e.firstAvg,
      'Second Half Avg': e.secondAvg,
      Improvement:       e.improvement,
    }))
  ));
}

// ── Round medal helpers ───────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Renders a rank-over-time line chart using Chart.js directly so we can
 * invert the Y axis (rank 1 at the top) and format ticks as ordinals.
 */
function makeRankChart(container, roundLabels, series, visiblePlayers = null) {
  const wrap = document.createElement('div');
  wrap.className = 'chart-container';
  const titleEl = document.createElement('div');
  titleEl.className = 'chart-title';
  titleEl.textContent = 'Leaderboard rank after each round (1 = leading)';
  wrap.appendChild(titleEl);

  const sizer = document.createElement('div');
  sizer.style.cssText = 'position:relative;width:100%;height:420px';
  const canvas = document.createElement('canvas');
  sizer.appendChild(canvas);
  wrap.appendChild(sizer);
  container.appendChild(wrap);

  const maxRank = Math.max(...series.map(s => Math.max(...s.rounds.map(r => r.rank))));

  const ordinal = n => {
    const s = ['th','st','nd','rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const datasets = series.map((s, i) => ({
    label:            s.player,
    data:             roundLabels.map(rName => {
      const found = s.rounds.find(r => r.round === rName);
      return found != null ? found.rank : null;
    }),
    borderColor:      PALETTE[i % PALETTE.length],
    backgroundColor:  PALETTE[i % PALETTE.length] + '33',
    pointRadius:      4,
    pointHoverRadius: 8,
    tension:          0.3,
    spanGaps:         true,
    borderWidth:      2,
    hidden:           visiblePlayers ? !visiblePlayers.has(s.player) : false,
  }));

  new Chart(canvas, {
    type: 'line',
    data: { labels: roundLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { color: '#ccc', boxWidth: 12, usePointStyle: true },
        },
        tooltip: {
          backgroundColor: 'rgba(15,18,27,.95)',
          titleColor: '#dde1ea',
          bodyColor: '#8b92a5',
          borderColor: '#2e3340',
          borderWidth: 1,
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ordinal(ctx.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8b92a5', maxRotation: 45 },
          grid:  { color: 'rgba(255,255,255,.05)' },
        },
        y: {
          reverse: true,           // rank 1 at the top
          min: 1,
          max: maxRank,
          ticks: {
            color:     '#8b92a5',
            stepSize:  1,
            callback:  v => Number.isInteger(v) ? ordinal(v) : '',
          },
          grid: { color: 'rgba(255,255,255,.05)' },
          title: {
            display: true,
            text:    'Rank',
            color:   '#8b92a5',
          },
        },
      },
    },
  });
}

function renderRoundBreakdown(container, data) {
  const rounds = roundByRoundBreakdown(data);
  if (!rounds.length) {
    container.appendChild(el('p', 'caption', 'No round data available.'));
    return;
  }

  const wrap = el('div', 'round-breakdown');

  rounds.forEach(round => {
    // ── Build expander content ──────────────────────────────────────────
    const content = el('div', 'round-breakdown-body');

    // Left: this round's top-3 submissions
    const leftCol = el('div', 'round-breakdown-col');
    const leftTitle = el('h4', 'round-breakdown-col-title', '🎵 Round Top 3');
    leftCol.appendChild(leftTitle);

    if (round.top3.length === 0) {
      leftCol.appendChild(el('p', 'caption', 'No submissions recorded.'));
    } else {
      round.top3.forEach(entry => {
        const card = el('div', 'round-entry-card');
        card.innerHTML =
          `<span class="round-entry-medal">${MEDALS[entry.rank - 1] || `#${entry.rank}`}</span>` +
          `<span class="round-entry-name">${esc(entry.name)}</span>` +
          `<span class="round-entry-song">${esc(entry.song)}` +
            (entry.artist ? ` <span class="round-entry-artist">— ${esc(entry.artist)}</span>` : '') +
          `</span>` +
          `<span class="round-entry-pts">${entry.points} pts</span>`;
        leftCol.appendChild(card);
      });
    }

    // Right: cumulative leaderboard as of this round
    const rightCol = el('div', 'round-breakdown-col');
    const rightTitle = el('h4', 'round-breakdown-col-title', '🏆 Standings After This Round');
    rightCol.appendChild(rightTitle);

    if (round.leaderboard.length === 0) {
      rightCol.appendChild(el('p', 'caption', 'No standings data.'));
    } else {
      round.leaderboard.forEach(entry => {
        const card = el('div', 'round-entry-card');
        card.innerHTML =
          `<span class="round-entry-medal">${MEDALS[entry.rank - 1] || `#${entry.rank}`}</span>` +
          `<span class="round-entry-name">${esc(entry.name)}</span>` +
          `<span class="round-entry-pts">${entry.cumulativePoints} pts total</span>`;
        rightCol.appendChild(card);
      });
    }

    content.appendChild(leftCol);
    content.appendChild(rightCol);

    wrap.appendChild(expander(round.roundName, content));
  });

  container.appendChild(wrap);
}
