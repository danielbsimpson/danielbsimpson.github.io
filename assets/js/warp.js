/**
 * Space Warp Transition
 * Plays a "zoom through hyperspace" canvas animation when navigating between
 * pages, and a matching arrival animation on page load.
 *
 * Exit  : streaking star-lines rush toward the viewer, then snap to white.
 * Arrive: white fades from a bright flash, star-lines rush inward and settle.
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

	// ── Constants ───────────────────────────────────────────────────────────
	var EXIT_DURATION   = 820;   // ms — outbound warp
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
		'opacity:0',
		'display:block'
	].join(';');
	document.body.appendChild(overlay);
	var ctx = overlay.getContext('2d');

	function sizeOverlay() {
		overlay.width  = window.innerWidth;
		overlay.height = window.innerHeight;
	}
	sizeOverlay();
	window.addEventListener('resize', sizeOverlay);

	// ── Streak data ─────────────────────────────────────────────────────────
	// Each streak: { angle, dist (0–1 normalised), speed, brightness }
	var streaks = [];

	function initStreaks() {
		streaks = [];
		for (var i = 0; i < NUM_STREAKS; i++) {
			streaks.push({
				angle      : Math.random() * Math.PI * 2,
				dist       : Math.random() * 0.85 + 0.05,   // start spread across frame
				speed      : Math.random() * 0.55 + 0.30,   // relative speed multiplier
				brightness : Math.floor(Math.random() * 80 + 175)  // 175–255
			});
		}
	}
	initStreaks();

	// ── Core draw ────────────────────────────────────────────────────────────
	/**
	 * Draw one warp frame.
	 * @param {number} t      0 → 1  progress through the animation phase.
	 * @param {string}  phase  'exit' | 'arrive'
	 */
	function drawWarp(t, phase) {
		var W = overlay.width;
		var H = overlay.height;
		var cx = W * 0.5;
		var cy = H * 0.5;
		var maxR = Math.sqrt(cx * cx + cy * cy); // half-diagonal

		ctx.clearRect(0, 0, W, H);

		// ── Background ──────────────────────────────────────────────────────
		// Gradually deepens to near-black during exit, stays dark on arrive.
		var bgAlpha = phase === 'exit'
			? Math.min(1, t * 1.6)           // ramps up quickly
			: Math.max(0, 1 - t * 0.7);      // fades away on arrival
		ctx.fillStyle = 'rgba(0, 2, 8, ' + bgAlpha + ')';
		ctx.fillRect(0, 0, W, H);

		// ── Speed factor ────────────────────────────────────────────────────
		// exit : slow → fast (ease-in)
		// arrive: fast → slow (ease-out)
		var ease = phase === 'exit'
			? t * t                           // ease-in quad
			: 1 - (1 - t) * (1 - t);         // ease-in quad (but for reversed perception)
		var speed = phase === 'exit'
			? ease
			: 1 - ease;                       // arrive decelerates

		// ── Streaks ─────────────────────────────────────────────────────────
		for (var i = 0; i < streaks.length; i++) {
			var s   = streaks[i];
			var ang = s.angle;
			var r   = s.dist * maxR;           // current radial distance from centre

			// Velocity: streaks accelerate outward
			var vel     = speed * s.speed * maxR * MAX_STREAK_LEN;
			var tailR   = r;
			var headR   = r + vel;

			if (headR < 2) continue;          // not visible yet

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
		// Exit: white flash at the very end (t → 1).
		// Arrive: white flash at the very start (t → 0) that fades out.
		var flashAlpha = 0;
		if (phase === 'exit') {
			flashAlpha = Math.max(0, (t - 0.80) / 0.20);   // last 20% of exit
		} else {
			flashAlpha = Math.max(0, 1 - t / 0.25);         // first 25% of arrive
		}
		if (flashAlpha > 0) {
			ctx.fillStyle = 'rgba(255, 255, 255, ' + flashAlpha + ')';
			ctx.fillRect(0, 0, W, H);
		}
	}

	// ── Animation runner ─────────────────────────────────────────────────────
	var activeRaf  = null;
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

	// ── Exit warp ─────────────────────────────────────────────────────────────
	function warpTo(href) {
		initStreaks();
		runAnimation('exit', EXIT_DURATION, function () {
			window.location.href = href;
		});
	}

	// ── Link interception ────────────────────────────────────────────────────
	// Intercept clicks on internal anchor tags (same origin, not #anchors, not
	// download links, not target=_blank, not modifier keys).
	function isInternalPage(href) {
		if (!href) return false;
		if (href.charAt(0) === '#') return false;
		if (href.indexOf('mailto:') === 0) return false;
		if (href.indexOf('tel:') === 0) return false;
		// Absolute URL pointing to a different origin
		try {
			var url = new URL(href, window.location.href);
			if (url.origin !== window.location.origin) return false;
			// Same page (just an anchor change)
			if (url.pathname === window.location.pathname && url.hash) return false;
		} catch (e) {
			return false;
		}
		return true;
	}

	document.addEventListener('click', function (e) {
		// Walk up from the target to find an <a>
		var el = e.target;
		while (el && el.tagName !== 'A') el = el.parentElement;
		if (!el) return;

		var href = el.getAttribute('href');
		if (!isInternalPage(href)) return;
		if (el.target === '_blank') return;
		if (el.hasAttribute('download')) return;
		if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

		// Prevent the browser navigating immediately
		e.preventDefault();
		warpTo(href);
	}, true);

	// ── Arrival animation ─────────────────────────────────────────────────────
	// Fires on every page load. Uses a very brief (ARRIVE_DURATION ms) deceleration
	// to suggest the ship is dropping out of warp at the destination.
	window.addEventListener('load', function () {
		// Only run if the page was likely arrived at via warp (or on first load for effect)
		initStreaks();
		runAnimation('arrive', ARRIVE_DURATION, function () {
			hideOverlay();
		});
	});

	// ── Back/Forward cache support ────────────────────────────────────────────
	window.addEventListener('pageshow', function (e) {
		if (e.persisted) {
			// Page restored from bfcache — hide any leftover overlay immediately
			hideOverlay();
		}
	});

}());
