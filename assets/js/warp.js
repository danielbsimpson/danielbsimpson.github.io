/**
 * Space Warp Transition
 * Plays a "zoom through hyperspace" canvas animation when navigating between
 * pages, and a matching arrival animation on page load.
 *
 * Sequence:
 *  Exit  : page content fades out → planet visible → warp streaks → navigate.
 *  Arrive: warp streaks decelerate → overlay fades revealing planet → content fades in.
 *
 * Degrades gracefully:
 *  - Respects prefers-reduced-motion (instant navigation, no canvas shown).
 *  - Falls back silently if canvas/requestAnimationFrame is unavailable.
 */
(function () {
	'use strict';

	// ── Reduced-motion guard ────────────────────────────────────────────────
	var prefersReduced = window.matchMedia &&
		window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (prefersReduced) return;

	// Signal that warp is active (so main.js defers preload removal & navigation)
	window.__warpActive = true;

	// ── Constants ───────────────────────────────────────────────────────────
	var CONTENT_FADE_MS = 350;   // ms — content fades out before warp exit
	var PLANET_PAUSE_MS = 300;   // ms — pause to show planet before/after warp
	var EXIT_DURATION   = 750;   // ms — outbound warp streaks
	var ARRIVE_DURATION = 700;   // ms — arrival deceleration
	var NUM_STREAKS     = 180;
	var MAX_STREAK_LEN  = 0.52;  // fraction of half-diagonal at full speed

	// ── Overlay canvas ──────────────────────────────────────────────────────
	var overlay = document.createElement('canvas');
	overlay.id  = 'warp-overlay';
	overlay.style.cssText = [
		'position:fixed',
		'inset:0',
		'width:100%',
		'height:100%',
		'z-index:99999',
		'pointer-events:none',
		'opacity:1',
		'display:block'
	].join(';');
	document.body.appendChild(overlay);
	var ctx = overlay.getContext('2d');

	// Draw an initial opaque frame immediately so nothing shows through
	function fillBlack() {
		ctx.fillStyle = 'rgba(0, 2, 8, 1)';
		ctx.fillRect(0, 0, overlay.width || window.innerWidth, overlay.height || window.innerHeight);
	}

	function sizeOverlay() {
		overlay.width  = window.innerWidth;
		overlay.height = window.innerHeight;
	}
	sizeOverlay();
	fillBlack();
	window.addEventListener('resize', sizeOverlay);

	// ── Streak data ─────────────────────────────────────────────────────────
	var streaks = [];

	function initStreaks() {
		streaks = [];
		for (var i = 0; i < NUM_STREAKS; i++) {
			streaks.push({
				angle      : Math.random() * Math.PI * 2,
				dist       : Math.random() * 0.85 + 0.05,
				speed      : Math.random() * 0.55 + 0.30,
				brightness : Math.floor(Math.random() * 80 + 175)
			});
		}
	}
	initStreaks();

	// ── Core draw ────────────────────────────────────────────────────────────
	function drawWarp(t, phase) {
		var W = overlay.width;
		var H = overlay.height;
		var cx = W * 0.5;
		var cy = H * 0.5;
		var maxR = Math.sqrt(cx * cx + cy * cy);

		ctx.clearRect(0, 0, W, H);

		// ── Background ──────────────────────────────────────────────────────
		var bgAlpha = phase === 'exit'
			? Math.min(1, t * 1.6)
			: Math.max(0, 1 - t * 1.1);      // fully fades to 0 during arrival
		ctx.fillStyle = 'rgba(0, 2, 8, ' + bgAlpha + ')';
		ctx.fillRect(0, 0, W, H);

		// ── Speed factor ────────────────────────────────────────────────────
		var ease = phase === 'exit'
			? t * t
			: 1 - (1 - t) * (1 - t);
		var speed = phase === 'exit'
			? ease
			: 1 - ease;

		// ── Streaks ─────────────────────────────────────────────────────────
		for (var i = 0; i < streaks.length; i++) {
			var s   = streaks[i];
			var ang = s.angle;
			var r   = s.dist * maxR;

			var vel     = speed * s.speed * maxR * MAX_STREAK_LEN;
			var tailR   = r;
			var headR   = r + vel;

			if (headR < 2) continue;

			var tailX = cx + Math.cos(ang) * tailR;
			var tailY = cy + Math.sin(ang) * tailR;
			var headX = cx + Math.cos(ang) * headR;
			var headY = cy + Math.sin(ang) * headR;

			var alpha = Math.min(1, speed * 2) * 0.85;
			if (alpha < 0.02) continue;

			var b = s.brightness;
			var grad = ctx.createLinearGradient(tailX, tailY, headX, headY);
			grad.addColorStop(0,   'rgba(' + b + ',' + b + ',' + Math.min(255, b + 30) + ', 0)');
			grad.addColorStop(0.6, 'rgba(' + b + ',' + b + ',' + Math.min(255, b + 30) + ', ' + (alpha * 0.5) + ')');
			grad.addColorStop(1,   'rgba(' + b + ',' + b + ',' + Math.min(255, b + 30) + ', ' + alpha + ')');

			ctx.beginPath();
			ctx.moveTo(tailX, tailY);
			ctx.lineTo(headX, headY);
			ctx.strokeStyle = grad;
			ctx.lineWidth   = Math.max(0.5, speed * s.speed * 2.5);
			ctx.stroke();
		}

		// ── Flash ────────────────────────────────────────────────────────────
		var flashAlpha = 0;
		if (phase === 'exit') {
			flashAlpha = Math.max(0, (t - 0.80) / 0.20);
		} else {
			flashAlpha = Math.max(0, 1 - t / 0.25);
		}
		if (flashAlpha > 0) {
			ctx.fillStyle = 'rgba(255, 255, 255, ' + flashAlpha + ')';
			ctx.fillRect(0, 0, W, H);
		}
	}

	// ── Animation runner ─────────────────────────────────────────────────────
	var activeRaf   = null;
	var activeStart = null;

	function runAnimation(phase, duration, onComplete) {
		if (activeRaf) cancelAnimationFrame(activeRaf);
		activeStart = null;
		overlay.style.opacity = '1';
		overlay.style.pointerEvents = phase === 'exit' ? 'all' : 'none';

		function step(now) {
			if (!activeStart) activeStart = now;
			var elapsed = now - activeStart;
			var t = Math.min(1, elapsed / duration);

			drawWarp(t, phase);

			if (t < 1) {
				activeRaf = requestAnimationFrame(step);
			} else {
				activeRaf = null;
				if (onComplete) onComplete();
			}
		}
		activeRaf = requestAnimationFrame(step);
	}

	function hideOverlay() {
		if (activeRaf) { cancelAnimationFrame(activeRaf); activeRaf = null; }
		overlay.style.opacity = '0';
		overlay.style.pointerEvents = 'none';
		ctx.clearRect(0, 0, overlay.width, overlay.height);
	}

	// ── Reveal page content ──────────────────────────────────────────────────
	// Two-step removal: first enable transitions, then trigger opacity change.
	function revealContent() {
		var body = document.body;
		// Step 1: remove is-preload (enables transitions) but keep wrapper hidden
		body.classList.remove('is-preload');
		body.classList.add('warp-arriving');

		// Step 2: next frame — remove warp-arriving so wrapper transitions to opacity: 1
		requestAnimationFrame(function () {
			requestAnimationFrame(function () {
				body.classList.remove('warp-arriving');
			});
		});
	}

	// ── Exit warp ─────────────────────────────────────────────────────────────
	// Sequence: content fades → brief planet pause → warp animation → navigate
	var isWarping = false;

	function warpTo(href) {
		if (isWarping) return;
		isWarping = true;

		var body = document.body;

		// Close menu if open (menu lives outside #wrapper)
		body.classList.remove('is-menu-visible');

		// Phase 1: Fade out page content
		body.classList.add('warp-exiting');

		// Phase 2: After content fades, pause briefly to show planet, then warp
		setTimeout(function () {
			// Phase 3: Start warp animation
			setTimeout(function () {
				initStreaks();
				runAnimation('exit', EXIT_DURATION, function () {
					window.location.href = href;
				});
			}, PLANET_PAUSE_MS);
		}, CONTENT_FADE_MS);
	}

	// ── Link interception ────────────────────────────────────────────────────
	function isInternalPage(href) {
		if (!href) return false;
		if (href.charAt(0) === '#') return false;
		if (href.indexOf('mailto:') === 0) return false;
		if (href.indexOf('tel:') === 0) return false;
		try {
			var url = new URL(href, window.location.href);
			if (url.origin !== window.location.origin) return false;
			if (url.pathname === window.location.pathname && url.hash) return false;
		} catch (e) {
			return false;
		}
		return true;
	}

	document.addEventListener('click', function (e) {
		var el = e.target;
		while (el && el.tagName !== 'A') el = el.parentElement;
		if (!el) return;

		var href = el.getAttribute('href');
		if (!isInternalPage(href)) return;
		if (el.target === '_blank') return;
		if (el.hasAttribute('download')) return;
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

		// Prevent default and stop propagation so tile handler doesn't also navigate
		e.preventDefault();
		e.stopImmediatePropagation();
		warpTo(href);
	}, true);

	// ── Arrival animation ─────────────────────────────────────────────────────
	// Sequence: warp deceleration → overlay fades → planet visible → content fades in
	window.addEventListener('load', function () {
		initStreaks();
		runAnimation('arrive', ARRIVE_DURATION, function () {
			// Overlay gone — star canvas + planet now visible
			hideOverlay();

			// Brief pause to appreciate the planet before content appears
			setTimeout(function () {
				revealContent();
			}, PLANET_PAUSE_MS);
		});
	});

	// ── Back/Forward cache support ────────────────────────────────────────────
	window.addEventListener('pageshow', function (e) {
		if (e.persisted) {
			hideOverlay();
			revealContent();
		}
	});

}());
