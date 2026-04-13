/**
 * tabs/timing.js — ⏱️ Timing tab
 */

import {
  submissionTimingStats, voteTimingStats,
  timingPerRound,
} from '../data.js';

import {
  el, sectionHeader, sectionCaption, divider,
  recordTile, tileGroup, makeBarChart, makeLineChart, htmlTable,
  ACCENT, PALETTE,
} from '../charts.js';

export function renderTiming(container, data) {
  container.appendChild(sectionHeader('⏱️ Submission & Voting Timing'));
  container.appendChild(sectionCaption(
    'Timings are relative to each round\'s inferred deadline (= latest submission/vote in that round).'
  ));

  // submissionTimingStats returns array sorted asc by avg_hours_before_deadline
  // (lowest = latest submitter, highest = earliest)
  const subStats  = submissionTimingStats(data);  // [{player_name, avg_hours_before_deadline, min_hours_before_deadline, max_hours_before_deadline, rounds_submitted}]
  // voteTimingStats returns array sorted asc by avg_hours_after_playlist
  const voteStats = voteTimingStats(data);         // [{player_name, avg_hours_after_playlist, avg_hours_before_vote_deadline, rounds_voted}]

  // ── Record tiles: find global extremes ─────────────────────────────────
  const perRound  = timingPerRound(data);
  const subRows   = perRound.filter(e => e.sub_hours_before_deadline  != null);
  const voteRows  = perRound.filter(e => e.vote_hours_after_playlist  != null);

  // Fastest single vote = lowest vote_hours_after_playlist (voted soonest after playlist dropped)
  const fastest_vote = voteRows.length ? voteRows.reduce((a, b) => b.vote_hours_after_playlist < a.vote_hours_after_playlist ? b : a) : null;
  // Slowest single vote = highest vote_hours_after_playlist (waited longest after playlist dropped)
  const slowest_vote = voteRows.length ? voteRows.reduce((a, b) => b.vote_hours_after_playlist > a.vote_hours_after_playlist ? b : a) : null;
  // Earliest single submission = highest sub_hours_before_deadline
  const earliest_sub = subRows.length  ? subRows.reduce((a, b)  => b.sub_hours_before_deadline  > a.sub_hours_before_deadline  ? b : a) : null;
  // Latest single submission = lowest sub_hours_before_deadline
  const latest_sub   = subRows.length  ? subRows.reduce((a, b)  => b.sub_hours_before_deadline  < a.sub_hours_before_deadline  ? b : a) : null;

  function fmtHoursAfter(h) {
    if (h < 1) {
      const mins = Math.round(h * 60);
      return mins === 0 ? '< 1m after playlist' : `${mins}m after playlist`;
    }
    return `${Math.round(h)}h after playlist`;
  }
  function fmtHoursBefore(h) {
    if (h < 1) {
      const mins = Math.round(h * 60);
      return mins === 0 ? '< 1m before deadline' : `${mins}m before deadline`;
    }
    return `${Math.round(h)}h before deadline`;
  }

  const rRow = el('div', 'grid-4');
  if (fastest_vote) rRow.appendChild(tileGroup('⚡🗳️ Fastest Single Vote',      [recordTile('⚡🗳️', fastest_vote.player_name, fmtHoursAfter(fastest_vote.vote_hours_after_playlist),  fastest_vote.round_name, '#0a1814', ACCENT)]));
  if (slowest_vote) rRow.appendChild(tileGroup('🐌🗳️ Slowest Single Vote',      [recordTile('🐌🗳️', slowest_vote.player_name, fmtHoursAfter(slowest_vote.vote_hours_after_playlist),  slowest_vote.round_name, '#1e0a2e', '#b47bff')]));
  if (earliest_sub) rRow.appendChild(tileGroup('📅 Earliest Single Submission', [recordTile('📅⚡', earliest_sub.player_name, fmtHoursBefore(earliest_sub.sub_hours_before_deadline), earliest_sub.round_name, '#0a1e14', '#ffd166')]));
  if (latest_sub)   rRow.appendChild(tileGroup('🔥 Latest Single Submission',   [recordTile('🔥📅', latest_sub.player_name,   fmtHoursBefore(latest_sub.sub_hours_before_deadline),   latest_sub.round_name,   '#2a0e0e', '#e05252')]));
  container.appendChild(rRow);
  container.appendChild(divider());

  // ── Timing podiums ─────────────────────────────────────────────────────
  container.appendChild(sectionHeader('🏅 Timing Podiums'));
  container.appendChild(sectionCaption('Top 3 per category based on average timing across all rounds.'));

  const podiumGrid = el('div', 'grid-4');

  function fmtAfterPlaylist(h) {
    if (h < 1) {
      const mins = Math.round(h * 60);
      return mins === 0 ? '< 1m avg after playlist' : `${mins}m avg after playlist`;
    }
    const hrs  = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m avg after playlist` : `${hrs}h avg after playlist`;
  }
  function fmtBeforeDeadline(h) {
    if (h < 1) {
      const mins = Math.round(h * 60);
      return mins === 0 ? '< 1m avg before deadline' : `${mins}m avg before deadline`;
    }
    const hrs  = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m avg before deadline` : `${hrs}h avg before deadline`;
  }

  // 1. Fastest average voter (lowest avg_hours_after_playlist)
  const fastVoters = [...voteStats].sort((a, b) => a.avg_hours_after_playlist - b.avg_hours_after_playlist).slice(0, 3);
  podiumGrid.appendChild(tileGroup('⚡ Fastest Average Voter', fastVoters.map((e, i) =>
    recordTile(['🥇','🥈','🥉'][i], e.player_name, fmtAfterPlaylist(e.avg_hours_after_playlist), `${e.rounds_voted} rounds`, '#0a1814', ACCENT)
  )));

  // 2. Most patient listener (highest avg_hours_after_playlist)
  const patientVoters = [...voteStats].sort((a, b) => b.avg_hours_after_playlist - a.avg_hours_after_playlist).slice(0, 3);
  podiumGrid.appendChild(tileGroup('🐌 Most Patient Listener', patientVoters.map((e, i) =>
    recordTile(['🥇','🥈','🥉'][i], e.player_name, fmtAfterPlaylist(e.avg_hours_after_playlist), `${e.rounds_voted} rounds`, '#1e0a2e', '#b47bff')
  )));

  // 3. Submits the earliest (highest avg_hours_before_deadline)
  const earliestSubs = [...subStats].sort((a, b) => b.avg_hours_before_deadline - a.avg_hours_before_deadline).slice(0, 3);
  podiumGrid.appendChild(tileGroup('📅 Submits the Earliest', earliestSubs.map((e, i) =>
    recordTile(['🥇','🥈','🥉'][i], e.player_name, fmtBeforeDeadline(e.avg_hours_before_deadline), `${e.rounds_submitted} rounds`, '#0a1e14', '#ffd166')
  )));

  // 4. Cuts it close (lowest avg_hours_before_deadline)
  const lastSubs = [...subStats].sort((a, b) => a.avg_hours_before_deadline - b.avg_hours_before_deadline).slice(0, 3);
  podiumGrid.appendChild(tileGroup('🔥 Cuts It Close', lastSubs.map((e, i) =>
    recordTile(['🥇','🥈','🥉'][i], e.player_name, fmtBeforeDeadline(e.avg_hours_before_deadline), `${e.rounds_submitted} rounds`, '#2a0e0e', '#e05252')
  )));

  container.appendChild(podiumGrid);
  container.appendChild(divider());

  // ── Submission timing bar ───────────────────────────────────────────────
  container.appendChild(sectionHeader('📅 Submission Timing — Hours Before Deadline'));
  const subSorted = [...subStats].sort((a, b) => b.avg_hours_before_deadline - a.avg_hours_before_deadline);
  makeBarChart(container,
    subSorted.map(e => e.player_name),
    subSorted.map(e => e.avg_hours_before_deadline),
    { color: '#ffd166', xLabel: 'Avg Hours Before Deadline', title: 'Average submission lead time per player (higher = earlier)' }
  );
  container.appendChild(htmlTable(
    ['Player', 'Avg Hrs Before Deadline', 'Min Hrs', 'Max Hrs', 'Submissions'],
    subSorted.map(e => ({
      Player: e.player_name,
      'Avg Hrs Before Deadline': e.avg_hours_before_deadline,
      'Min Hrs': e.min_hours_before_deadline,
      'Max Hrs': e.max_hours_before_deadline,
      Submissions: e.rounds_submitted,
    }))
  ));
  container.appendChild(divider());

  // ── Vote timing: fastest listeners & last-minute voters ────────────────
  container.appendChild(sectionHeader('🗳️ Vote Timing'));
  {
    const grid = el('div', 'grid-2');

    // Fastest listeners = lowest avg_hours_after_playlist (voted soonest after playlist dropped)
    const fastSorted = [...voteStats].sort((a, b) => a.avg_hours_after_playlist - b.avg_hours_after_playlist);
    const fastWrap = el('div');
    fastWrap.appendChild(el('h4', 'section-header', '⚡ Fastest Listeners'));
    makeBarChart(fastWrap,
      fastSorted.map(e => e.player_name),
      fastSorted.map(e => e.avg_hours_after_playlist),
      { color: ACCENT, xLabel: 'Avg Hrs After Playlist' });
    grid.appendChild(fastWrap);

    // Latest voters = lowest avg_hours_before_vote_deadline
    const lateSorted = [...voteStats].sort((a, b) => a.avg_hours_before_vote_deadline - b.avg_hours_before_vote_deadline);
    const lateWrap = el('div');
    lateWrap.appendChild(el('h4', 'section-header', '⏰ Latest Deadline Voters'));
    makeBarChart(lateWrap,
      lateSorted.map(e => e.player_name),
      lateSorted.map(e => e.avg_hours_before_vote_deadline),
      { color: '#e05252', xLabel: 'Avg Hrs Before Vote Deadline' });
    grid.appendChild(lateWrap);

    container.appendChild(grid);
  }
  container.appendChild(htmlTable(
    ['Player', 'Avg Hrs After Playlist', 'Avg Hrs Before Vote Deadline', 'Votes Cast'],
    voteStats.map(e => ({
      Player: e.player_name,
      'Avg Hrs After Playlist': e.avg_hours_after_playlist,
      'Avg Hrs Before Vote Deadline': e.avg_hours_before_vote_deadline,
      'Votes Cast': e.rounds_voted,
    }))
  ));
  container.appendChild(divider());

  // ── Per-round line charts ───────────────────────────────────────────────
  container.appendChild(sectionHeader('🔬 Per-Round Timing'));
  container.appendChild(sectionCaption(
    'Rounds in chronological order. Each player is a separate coloured line.'
  ));

  const orderedRounds = data.rounds.map(r => r.Name);
  const allPlayerNames = [...new Set(perRound.map(e => e.player_name))].sort();

  // Submission chart
  container.appendChild(el('h4', 'section-header', '📅 Submission: Hours Before Deadline per Round'));
  const subSeries = allPlayerNames
    .map(player => ({
      player,
      rounds: perRound
        .filter(e => e.player_name === player && e.sub_hours_before_deadline != null)
        .map(e => ({ round: e.round_name, points: e.sub_hours_before_deadline })),
    }))
    .filter(s => s.rounds.length > 0);

  if (subSeries.length > 0) {
    makeLineChart(container, orderedRounds, subSeries, {
      title:    'Submission Lead Time per Round',
      height:   400,
      showLine: false,
    });
  } else {
    container.appendChild(el('p', 'caption', 'No submission timing data.'));
  }

  container.appendChild(divider());

  // Vote chart
  container.appendChild(el('h4', 'section-header', '🗳️ Voting: Hours Before Vote Deadline per Round'));
  const voteSeries = allPlayerNames
    .map(player => ({
      player,
      rounds: perRound
        .filter(e => e.player_name === player && e.vote_hours_before_deadline != null)
        .map(e => ({ round: e.round_name, points: e.vote_hours_before_deadline })),
    }))
    .filter(s => s.rounds.length > 0);

  if (voteSeries.length > 0) {
    makeLineChart(container, orderedRounds, voteSeries, {
      title:    'Vote Lead Time per Round',
      height:   400,
      showLine: false,
    });
  } else {
    container.appendChild(el('p', 'caption', 'No vote timing data.'));
  }

  container.appendChild(divider());

  // ── Player Deep-Dive ────────────────────────────────────────────────────
  container.appendChild(sectionHeader('🔍 Player Deep-Dive'));
  container.appendChild(sectionCaption('Select a player to see their individual submission and voting timing across all rounds.'));

  const allPlayerNamesDeep = [...new Set(perRound.map(e => e.player_name))].sort();

  const ctrlRow = el('div', 'panel-control-row');
  ctrlRow.appendChild(el('span', 'panel-label', '🎯 Player:'));
  const playerSel = document.createElement('select');
  playerSel.className = 'panel-select';
  allPlayerNamesDeep.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
    playerSel.appendChild(opt);
  });
  const danielOpt = allPlayerNamesDeep.find(n => n.toLowerCase().startsWith('daniel'));
  if (danielOpt) playerSel.value = danielOpt;
  ctrlRow.appendChild(playerSel);
  container.appendChild(ctrlRow);

  const deepBody = el('div');
  container.appendChild(deepBody);

  function renderDeepDive(playerName) {
    deepBody.innerHTML = '';

    const playerSubStats  = subStats.find(e => e.player_name === playerName);
    const playerVoteStats = voteStats.find(e => e.player_name === playerName);

    const playerSubRows  = perRound
      .filter(e => e.player_name === playerName && e.sub_hours_before_deadline != null)
      .map(e => ({ round: e.round_name, value: e.sub_hours_before_deadline }));
    const playerVoteRows = perRound
      .filter(e => e.player_name === playerName && e.vote_hours_after_playlist != null)
      .map(e => ({ round: e.round_name, value: e.vote_hours_after_playlist }));

    // Sort in round order
    const roundOrder = new Map(data.rounds.map((r, i) => [r.Name, i]));
    playerSubRows.sort( (a, b) => (roundOrder.get(a.round) ?? 999) - (roundOrder.get(b.round) ?? 999));
    playerVoteRows.sort((a, b) => (roundOrder.get(a.round) ?? 999) - (roundOrder.get(b.round) ?? 999));

    // ── 4 metric tiles ──────────────────────────────────────────────────
    const tilesRow = el('div', 'grid-4');

    // Avg submission lead time
    if (playerSubStats) {
      tilesRow.appendChild(tileGroup('📅 Avg Submission Lead Time', [
        recordTile('📅', playerName, fmtBeforeDeadline(playerSubStats.avg_hours_before_deadline), `${playerSubStats.rounds_submitted} rounds`, '#0a1e14', '#ffd166'),
      ]));
    }

    // Earliest single submission (max sub_hours_before_deadline for this player)
    if (playerSubRows.length) {
      const earliest = playerSubRows.reduce((a, b) => b.value > a.value ? b : a);
      tilesRow.appendChild(tileGroup('⚡ Earliest Submission', [
        recordTile('⚡📅', playerName, fmtHoursBefore(earliest.value), earliest.round, '#0a1814', ACCENT),
      ]));
    }

    // Avg voter turnaround time
    if (playerVoteStats) {
      tilesRow.appendChild(tileGroup('🗳️ Avg Voter Turnaround', [
        recordTile('🗳️', playerName, fmtAfterPlaylist(playerVoteStats.avg_hours_after_playlist), `${playerVoteStats.rounds_voted} rounds`, '#0a1020', '#b47bff'),
      ]));
    }

    // Fastest single vote (min vote_hours_after_playlist for this player)
    if (playerVoteRows.length) {
      const fastest = playerVoteRows.reduce((a, b) => b.value < a.value ? b : a);
      tilesRow.appendChild(tileGroup('⚡ Fastest Vote Cast', [
        recordTile('⚡🗳️', playerName, fmtHoursAfter(fastest.value), fastest.round, '#0a1814', ACCENT),
      ]));
    }

    deepBody.appendChild(tilesRow);

    // ── Bar charts ───────────────────────────────────────────────────────
    const chartGrid = el('div', 'grid-2');

    const subWrap = el('div');
    subWrap.appendChild(el('h4', 'section-header', '📅 Hours Before Submission Deadline'));
    if (playerSubRows.length) {
      makeBarChart(subWrap,
        playerSubRows.map(e => e.round),
        playerSubRows.map(e => e.value),
        { color: '#ffd166', xLabel: 'Hours Before Deadline', title: `${playerName} — submission lead time per round` }
      );
    } else {
      subWrap.appendChild(el('p', 'caption', 'No submission data.'));
    }
    chartGrid.appendChild(subWrap);

    const voteWrap = el('div');
    voteWrap.appendChild(el('h4', 'section-header', '🗳️ Hours After Playlist Drop to Vote'));
    if (playerVoteRows.length) {
      makeBarChart(voteWrap,
        playerVoteRows.map(e => e.round),
        playerVoteRows.map(e => e.value),
        { color: ACCENT, xLabel: 'Hours After Playlist', title: `${playerName} — vote turnaround per round` }
      );
    } else {
      voteWrap.appendChild(el('p', 'caption', 'No voting data.'));
    }
    chartGrid.appendChild(voteWrap);

    deepBody.appendChild(chartGrid);
  }

  playerSel.addEventListener('change', () => renderDeepDive(playerSel.value));
  renderDeepDive(playerSel.value);
}
