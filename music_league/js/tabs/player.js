/**
 * tabs/player.js — 👤 Player Profile tab
 *
 * Renders a full profile for a selected player:
 *   - Summary stat tiles (points, rounds, avg, wins, podium, zeros, votes given)
 *   - Points-over-time line chart
 *   - Submissions table
 *   - Biggest fans (who voted for them most)
 *   - Voting behaviour (who they voted for most)
 */

import {
  pointsPerSubmission, nameMap,
  submissionTimingStats, voteTimingStats,
} from '../data.js';

import {
  el, sectionHeader, sectionCaption, divider,
  metricTile, recordTile, makeLineChart, htmlTable, ACCENT,
} from '../charts.js';

// ── Public entry point ────────────────────────────────────────────────────

export function renderPlayer(container, data) {
  const names = nameMap(data.competitors);

  // Sort all players alphabetically by display name
  const playerList = [...names.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  if (playerList.length === 0) {
    container.appendChild(el('p', 'banner banner-info', 'No players found.'));
    return;
  }

  // ── Header + player selector ────────────────────────────────────────────
  container.appendChild(sectionHeader('👤 Player Profile'));

  const ctrlRow = el('div', 'panel-control-row');
  const lbl = el('span', 'panel-label', 'Select player: ');
  ctrlRow.appendChild(lbl);

  const sel = document.createElement('select');
  sel.className = 'sidebar-select';
  sel.style.width = 'auto';
  sel.style.display = 'inline-block';
  sel.style.minWidth = '200px';
  playerList.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.name;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
  ctrlRow.appendChild(sel);
  container.appendChild(ctrlRow);
  container.appendChild(divider());

  // ── Profile area (re-rendered on player change) ─────────────────────────
  const profileWrap = el('div');
  container.appendChild(profileWrap);

  function renderProfile(playerName) {
    profileWrap.innerHTML = '';
    buildProfile(profileWrap, data, playerName, names);
  }

  sel.addEventListener('change', () => renderProfile(sel.value));
  renderProfile(playerList[0].name);
}

// ── Profile builder ───────────────────────────────────────────────────────

function buildProfile(container, data, playerName, names) {
  const invMap   = new Map([...names.entries()].map(([k, v]) => [v, k]));
  const playerId = invMap.get(playerName);
  if (!playerId) return;

  const pps    = pointsPerSubmission(data.submissions, data.votes);
  const mySubs = pps.filter(p => p['Submitter ID'] === playerId);

  // ── Round-level stats ────────────────────────────────────────────────────
  const totalPtsReceived = mySubs.reduce((s, p) => s + p.TotalPoints, 0);
  const avgPts = mySubs.length
    ? Math.round((totalPtsReceived / mySubs.length) * 100) / 100
    : 0;
  const zeroPtRounds = mySubs.filter(p => p.TotalPoints === 0).length;

  // Wins & podium
  const byRound = new Map();
  pps.forEach(p => {
    if (!byRound.has(p['Round ID'])) byRound.set(p['Round ID'], []);
    byRound.get(p['Round ID']).push(p);
  });
  let roundWins = 0;
  let podiumAppearances = 0;
  for (const entries of byRound.values()) {
    const sorted = [...entries].sort((a, b) => b.TotalPoints - a.TotalPoints);
    const rank = sorted.findIndex(p => p['Submitter ID'] === playerId);
    if (rank === 0) roundWins++;
    if (rank >= 0 && rank < 3) podiumAppearances++;
  }

  // ── Personal bests ───────────────────────────────────────────────────────
  const roundNameById  = new Map(data.rounds.map(r => [r.ID, r.Name]));
  const roundToLeague  = new Map();
  if (data.leagueRounds && data.leagueNames) {
    data.leagueRounds.forEach((lrounds, i) => {
      const lname = data.leagueNames[i] || `League ${i + 1}`;
      lrounds.forEach(r => roundToLeague.set(r.ID, lname));
    });
  }

  // Best single-round placement
  let bestRound = null;
  for (const [roundId, entries] of byRound) {
    const sorted = [...entries].sort((a, b) => b.TotalPoints - a.TotalPoints);
    const rank   = sorted.findIndex(p => p['Submitter ID'] === playerId);
    if (rank < 0) continue;
    const pts = sorted[rank].TotalPoints;
    if (!bestRound || rank < bestRound.rank || (rank === bestRound.rank && pts > bestRound.pts)) {
      bestRound = {
        rank,
        pts,
        roundName:  roundNameById.get(roundId)  || roundId,
        leagueName: roundToLeague.get(roundId) || '',
      };
    }
  }

  // Best overall league placement
  let bestLeague = null;
  if (data.leagueRounds && data.leagueNames) {
    data.leagueRounds.forEach((lrounds, i) => {
      const lname        = data.leagueNames[i] || `League ${i + 1}`;
      const leagueRoundIds = new Set(lrounds.map(r => r.ID));
      const leaguePps    = pps.filter(p => leagueRoundIds.has(p['Round ID']));
      if (!leaguePps.some(p => p['Submitter ID'] === playerId)) return;
      const totals = new Map();
      leaguePps.forEach(p => totals.set(p['Submitter ID'], (totals.get(p['Submitter ID']) || 0) + p.TotalPoints));
      const sorted = [...totals.entries()].sort((a, b) => b[1] - a[1]);
      const rank   = sorted.findIndex(([id]) => id === playerId);
      if (rank < 0) return;
      const pts = totals.get(playerId) || 0;
      if (!bestLeague || rank < bestLeague.rank || (rank === bestLeague.rank && pts > bestLeague.pts)) {
        bestLeague = { rank, pts, leagueName: lname };
      }
    });
  }

  // ── Voting stats ─────────────────────────────────────────────────────────
  const myVotes = data.votes.filter(
    v => v['Voter ID'] === playerId && Number(v.Points) > 0
  );
  const totalPtsGiven   = myVotes.reduce((s, v) => s + Number(v.Points), 0);
  const roundsVotedIn   = new Set(myVotes.map(v => v['Round ID'])).size;

  // ── Pre-compute timing stats ──────────────────────────────────────────────
  const subStats  = submissionTimingStats(data);
  const voteStats = voteTimingStats(data);
  const mySub     = subStats.find(s => s.player_name === playerName);
  const myVote    = voteStats.find(s => s.player_name === playerName);

  function fmtH(h) {
    if (h == null) return '—';
    const hrs  = Math.floor(Math.abs(h));
    const mins = Math.round((Math.abs(h) - hrs) * 60);
    const sign = h < 0 ? '-' : '';
    return mins > 0 ? `${sign}${hrs}h ${mins}m` : `${sign}${hrs}h`;
  }

  // ── Helper functions for rank tiles ────────────────────────────────────
  function rankOrdinal(r) {
    const n = r + 1;
    return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
  }
  function rankIcon(r) {
    return r === 0 ? '🥇' : r === 1 ? '🥈' : r === 2 ? '🥉' : '🏅';
  }
  function rankBg(r) {
    return r === 0 ? '#0a1e14' : r === 1 ? '#1a2228' : r === 2 ? '#2a1a0a' : '#21252e';
  }
  function rankAccent(r) {
    return r === 0 ? ACCENT : r === 1 ? '#a8dadc' : r === 2 ? '#ffd166' : '#8b92a5';
  }

  // ── Row 1: personal bests + total points ────────────────────────────────
  const tileRow1 = el('div', 'grid-3');

  if (bestLeague) {
    tileRow1.appendChild(recordTile(
      rankIcon(bestLeague.rank),
      'Best League Finish',
      `${rankOrdinal(bestLeague.rank)} place · ${bestLeague.pts.toLocaleString()} pts`,
      bestLeague.leagueName,
      rankBg(bestLeague.rank),
      rankAccent(bestLeague.rank),
    ));
  } else {
    tileRow1.appendChild(metricTile('Best League Finish', '—'));
  }

  if (bestRound) {
    const ctx = bestRound.leagueName
      ? `${bestRound.roundName} · ${bestRound.leagueName}`
      : bestRound.roundName;
    tileRow1.appendChild(recordTile(
      rankIcon(bestRound.rank),
      'Best Round Finish',
      `${rankOrdinal(bestRound.rank)} place · ${bestRound.pts.toLocaleString()} pts`,
      ctx,
      rankBg(bestRound.rank),
      rankAccent(bestRound.rank),
    ));
  } else {
    tileRow1.appendChild(metricTile('Best Round Finish', '—'));
  }

  tileRow1.appendChild(metricTile('Total Points Received', totalPtsReceived.toLocaleString()));
  container.appendChild(tileRow1);

  // ── Row 2 ────────────────────────────────────────────────────────────────
  const tileRow2 = el('div', 'grid-3');
  [
    ['Rounds Submitted',     mySubs.length],
    ['Avg Points / Round',   avgPts],
    ['Round Wins 🏆',        roundWins],
  ].forEach(([label, value]) => tileRow2.appendChild(metricTile(label, value)));
  container.appendChild(tileRow2);

  // ── Row 3 ────────────────────────────────────────────────────────────────
  const tileRow3 = el('div', 'grid-3');
  [
    ['Podium (Top 3) 🥇',   podiumAppearances],
    ['Zero-Point Rounds 😬', zeroPtRounds],
    ['Total Points Given',   totalPtsGiven.toLocaleString()],
  ].forEach(([label, value]) => tileRow3.appendChild(metricTile(label, value)));
  container.appendChild(tileRow3);

  // ── Row 4 ────────────────────────────────────────────────────────────────
  const tileRow4 = el('div', 'grid-3');
  [
    ['Rounds Voted In',        roundsVotedIn],
    ['Avg Before Deadline 📅', mySub  ? fmtH(mySub.avg_hours_before_deadline) : '—'],
    ['Earliest Submission ⚡',  mySub  ? fmtH(mySub.max_hours_before_deadline) : '—'],
  ].forEach(([label, value]) => tileRow4.appendChild(metricTile(label, value)));
  container.appendChild(tileRow4);

  // ── Row 5 ────────────────────────────────────────────────────────────────
  const tileRow5 = el('div', 'grid-3');
  [
    ['Latest Submission 🔥',  mySub  ? fmtH(mySub.min_hours_before_deadline) : '—'],
    ['Avg After Playlist 🗳️', myVote ? fmtH(myVote.avg_hours_after_playlist) : '—'],
    ['Fastest Vote ⚡',        myVote ? fmtH(myVote.min_hours_after_playlist) : '—'],
  ].forEach(([label, value]) => tileRow5.appendChild(metricTile(label, value)));
  container.appendChild(tileRow5);

  container.appendChild(divider());

  // ── Points over time ─────────────────────────────────────────────────────
  if (mySubs.length > 1) {
    const roundName = new Map(data.rounds.map(r => [r.ID, r.Name]));
    const roundsOrdered = [...data.rounds]
      .sort((a, b) => new Date(a.Created) - new Date(b.Created))
      .map(r => r.Name);

    const roundPtsMap = new Map(
      mySubs.map(p => [roundName.get(p['Round ID']) || p['Round ID'], p.TotalPoints])
    );
    const timeLabels = roundsOrdered.filter(n => roundPtsMap.has(n));

    if (timeLabels.length > 1) {
      container.appendChild(sectionHeader('📈 Points Over Time'));
      makeLineChart(
        container,
        timeLabels,
        [{ player: playerName, rounds: timeLabels.map(n => ({ round: n, points: roundPtsMap.get(n) })) }],
        { height: 280 }
      );
      container.appendChild(divider());
    }
  }

  // ── Submissions table ────────────────────────────────────────────────────
  container.appendChild(sectionHeader('🎵 Submissions'));
  const roundNameMap = new Map(data.rounds.map(r => [r.ID, r.Name]));
  const subRows = mySubs
    .map(p => ({
      Title:  p.Title || '',
      'Artist(s)': p['Artist(s)'] || '',
      Round:  roundNameMap.get(p['Round ID']) || p['Round ID'],
      Points: p.TotalPoints,
    }))
    .sort((a, b) => b.Points - a.Points);

  container.appendChild(
    htmlTable(['Title', 'Artist(s)', 'Round', 'Points'], subRows)
  );
}
