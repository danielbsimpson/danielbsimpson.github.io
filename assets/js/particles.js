/**
 * Deep Space Star Field Animation
 * Drifting star field + scroll-reactive central star.
 * The central star brightens as the user scrolls deeper into the page.
 */
(function () {
	'use strict';

	var canvas = document.getElementById('star-canvas');
	if (!canvas) return;

	var ctx = canvas.getContext('2d');
	var stars = [];
	var NUM_STARS = 200;
	var DRIFT_SPEED = 0.12;

	// ── Central star state ──────────────────────────────────────────────────
	var starIntensity  = 0.15;   // current (lerped each frame)
	var targetIntensity = 0.15;  // driven by scroll
	var pulsePhase  = 0;         // slow gentle pulse
	var spikeAngle  = 0;         // very slow rotation of diffraction spikes
	var scrollDirty = false;

	// Intensity target for each section — increases as user scrolls deeper
	var SECTION_MAP = [
		{ selector: '#banner',               intensity: 0.15 },
		{ selector: '#one',                  intensity: 0.45 },
		{ selector: '.project-grid-section', intensity: 0.65 },
		{ selector: '#work-section',         intensity: 0.75 },
		{ selector: '#two',                  intensity: 0.88 },
		{ selector: '#contact',              intensity: 1.00 }
	];

	function computeTargetIntensity() {
		var viewH = window.innerHeight;
		var best  = { intensity: 0.15, overlap: 0 };
		SECTION_MAP.forEach(function (s) {
			var el = document.querySelector(s.selector);
			if (!el) return;
			var rect = el.getBoundingClientRect();
			// How much of the section overlaps the central 60 % of the viewport?
			var visTop  = Math.max(rect.top,    viewH * 0.2);
			var visBot  = Math.min(rect.bottom, viewH * 0.8);
			var overlap = Math.max(0, visBot - visTop);
			if (overlap > best.overlap) {
				best = { intensity: s.intensity, overlap: overlap };
			}
		});
		return best.intensity;
	}

	// ── Central star renderer ───────────────────────────────────────────────
	function drawCentralStar() {
		var x   = canvas.width  * 0.5;
		var y   = canvas.height * 0.36;
		var eff = Math.min(1, starIntensity + Math.sin(pulsePhase) * 0.05);

		// 1. Far outer nebula wash
		var nebR = 220 + eff * 260;
		var nebG = ctx.createRadialGradient(x, y, 0, x, y, nebR);
		nebG.addColorStop(0,   'rgba(30, 100, 200, '  + (eff * 0.10) + ')');
		nebG.addColorStop(0.5, 'rgba(10,  60, 160, '  + (eff * 0.05) + ')');
		nebG.addColorStop(1,   'rgba(0,   20,  80, 0)');
		ctx.beginPath();
		ctx.arc(x, y, nebR, 0, Math.PI * 2);
		ctx.fillStyle = nebG;
		ctx.fill();

		// 2. Mid corona
		var coR = 60 + eff * 90;
		var coG = ctx.createRadialGradient(x, y, 0, x, y, coR);
		coG.addColorStop(0,   'rgba(150, 220, 255, ' + (eff * 0.55) + ')');
		coG.addColorStop(0.3, 'rgba( 70, 160, 255, ' + (eff * 0.28) + ')');
		coG.addColorStop(0.7, 'rgba( 20,  90, 200, ' + (eff * 0.10) + ')');
		coG.addColorStop(1,   'rgba(  0,  40, 140, 0)');
		ctx.beginPath();
		ctx.arc(x, y, coR, 0, Math.PI * 2);
		ctx.fillStyle = coG;
		ctx.fill();

		// 3. Diffraction spikes — 8 point (4 cardinal longer, 4 diagonal shorter)
		var spikeOpacity = 0.08 + eff * 0.55;
		for (var s = 0; s < 8; s++) {
			var angle     = spikeAngle + (s / 8) * Math.PI * 2;
			var isPrimary = (s % 2 === 0);
			var spikeLen  = isPrimary ? (20 + eff * 145) : (12 + eff * 65);
			var halfW     = isPrimary ? 2.2 : 1.3;
			var tipX = x + Math.cos(angle) * spikeLen;
			var tipY = y + Math.sin(angle) * spikeLen;

			var sg = ctx.createLinearGradient(x, y, tipX, tipY);
			sg.addColorStop(0,   'rgba(220, 245, 255, ' + spikeOpacity + ')');
			sg.addColorStop(0.4, 'rgba(140, 200, 255, ' + (spikeOpacity * 0.45) + ')');
			sg.addColorStop(1,   'rgba( 80, 150, 255, 0)');

			var px = -Math.sin(angle) * halfW;
			var py =  Math.cos(angle) * halfW;
			ctx.save();
			ctx.beginPath();
			ctx.moveTo(x + px, y + py);
			ctx.lineTo(tipX, tipY);
			ctx.lineTo(x - px, y - py);
			ctx.closePath();
			ctx.fillStyle = sg;
			ctx.fill();
			ctx.restore();
		}

		// 4. Inner bright glow
		var igR = 4 + eff * 12;
		var igG = ctx.createRadialGradient(x, y, 0, x, y, igR);
		igG.addColorStop(0,   'rgba(255, 255, 255, ' + (0.65 + eff * 0.35) + ')');
		igG.addColorStop(0.3, 'rgba(210, 235, 255, ' + (eff * 0.90) + ')');
		igG.addColorStop(0.7, 'rgba(140, 200, 255, ' + (eff * 0.45) + ')');
		igG.addColorStop(1,   'rgba( 80, 160, 255, 0)');
		ctx.beginPath();
		ctx.arc(x, y, igR, 0, Math.PI * 2);
		ctx.fillStyle = igG;
		ctx.fill();

		// 5. Pinpoint white centre
		ctx.beginPath();
		ctx.arc(x, y, 1.5 + eff * 1.5, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.6 + eff * 0.4) + ')';
		ctx.fill();
	}

	// ── Planet renderer ────────────────────────────────────────────────────
	function drawPlanet() {
		var starX = canvas.width  * 0.5;
		var starY = canvas.height * 0.36;
		var radius = 110;
		// Position: lower-right of the star, further out
		var px = starX + 320;
		var py = starY + 260;

		var eff = Math.min(1, Math.max(0, starIntensity));

		// Direction from planet toward star (normalized)
		var dx = starX - px;
		var dy = starY - py;
		var dlen = Math.sqrt(dx * dx + dy * dy);
		dx /= dlen; dy /= dlen;

		// Star-facing edge and opposite dark edge
		var litEdgeX  = px + dx * radius;
		var litEdgeY  = py + dy * radius;
		var darkEdgeX = px - dx * radius;
		var darkEdgeY = py - dy * radius;

		// Terminator position in gradient (0 = darkEdge, 1 = litEdge)
		// eff=0  → 0.94 (tiny crescent, nearly all dark)
		// eff=1  → 0.50 (full half illuminated)
		var termPos = 0.94 - eff * 0.44;

		ctx.save();

		// Clip to planet disc
		ctx.beginPath();
		ctx.arc(px, py, radius, 0, Math.PI * 2);
		ctx.clip();

		// Dark planet base
		ctx.fillStyle = 'rgb(5, 8, 15)';
		ctx.fillRect(px - radius - 1, py - radius - 1, radius * 2 + 2, radius * 2 + 2);

		// Subtle dark surface texture
		var surfG = ctx.createRadialGradient(
			px + dx * radius * 0.3, py + dy * radius * 0.3, 0,
			px, py, radius
		);
		surfG.addColorStop(0, 'rgba(20, 26, 44, 1)');
		surfG.addColorStop(1, 'rgba(5, 8, 15, 1)');
		ctx.fillStyle = surfG;
		ctx.fillRect(px - radius - 1, py - radius - 1, radius * 2 + 2, radius * 2 + 2);

		// Illumination gradient from dark edge → lit edge
		var illumG = ctx.createLinearGradient(darkEdgeX, darkEdgeY, litEdgeX, litEdgeY);
		illumG.addColorStop(0,                                      'rgba(5, 8, 15, 1)');
		illumG.addColorStop(Math.max(0, termPos - 0.09),            'rgba(5, 8, 15, 1)');
		illumG.addColorStop(Math.max(0, termPos - 0.04),            'rgba(12, 28, 55, '  + (eff * 0.55) + ')');
		illumG.addColorStop(termPos,                                'rgba(38, 72, 128, ' + (eff * 0.72) + ')');
		illumG.addColorStop(Math.min(1, termPos + 0.05),            'rgba(72, 116, 178, '+ (eff * 0.84) + ')');
		illumG.addColorStop(Math.min(1, termPos + 0.18),            'rgba(108, 152, 210,'+ (eff * 0.91) + ')');
		illumG.addColorStop(1,                                      'rgba(155, 195, 240, '+ (eff * 0.93) + ')');
		ctx.fillStyle = illumG;
		ctx.fillRect(px - radius - 1, py - radius - 1, radius * 2 + 2, radius * 2 + 2);

		ctx.restore();

		// Atmospheric rim glow on the lit side
		if (eff > 0.05) {
			var atmRad = radius + 5;
			var atmG = ctx.createRadialGradient(
				px + dx * radius * 0.5, py + dy * radius * 0.5, radius * 0.88,
				px, py, atmRad
			);
			atmG.addColorStop(0,   'rgba(70, 120, 220, 0)');
			atmG.addColorStop(0.5, 'rgba(65, 115, 205, ' + (eff * 0.11) + ')');
			atmG.addColorStop(1,   'rgba(45,  85, 175, 0)');
			ctx.beginPath();
			ctx.arc(px, py, atmRad, 0, Math.PI * 2);
			ctx.fillStyle = atmG;
			ctx.fill();
		}

		// Dark rim to define planet edge against background
		ctx.beginPath();
		ctx.arc(px, py, radius, 0, Math.PI * 2);
		ctx.strokeStyle = 'rgba(30, 45, 80, ' + (0.3 + eff * 0.12) + ')';
		ctx.lineWidth = 0.8;
		ctx.stroke();
	}

	// ── Drifting star field ─────────────────────────────────────────────────
	function resize() {
		canvas.width  = window.innerWidth;
		canvas.height = window.innerHeight;
	}

	function Star() { this.reset(true); }

	Star.prototype.reset = function (randomY) {
		this.x           = Math.random() * canvas.width;
		this.y           = randomY ? Math.random() * canvas.height : -2;
		this.radius      = Math.random() * 1.3 + 0.15;
		this.opacity     = Math.random() * 0.65 + 0.1;
		this.twinkleSpeed = Math.random() * 0.012 + 0.004;
		this.twinkleDir  = Math.random() > 0.5 ? 1 : -1;
		this.vy          = DRIFT_SPEED * (Math.random() * 0.4 + 0.08);
		var r = Math.random();
		if      (r > 0.93) this.color = '0, 210, 255';
		else if (r > 0.82) this.color = '120, 190, 255';
		else if (r > 0.72) this.color = '200, 230, 255';
		else               this.color = '230, 240, 255';
	};

	Star.prototype.update = function () {
		this.y += this.vy;
		this.opacity += this.twinkleDir * this.twinkleSpeed;
		if (this.opacity > 0.82 || this.opacity < 0.05) this.twinkleDir *= -1;
		if (this.y > canvas.height + 4) this.reset(false);
	};

	Star.prototype.draw = function () {
		ctx.beginPath();
		ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
		ctx.fillStyle = 'rgba(' + this.color + ', ' + this.opacity + ')';
		ctx.fill();
		if (this.radius > 0.85) {
			ctx.beginPath();
			ctx.arc(this.x, this.y, this.radius * 2.8, 0, Math.PI * 2);
			ctx.fillStyle = 'rgba(' + this.color + ', ' + (this.opacity * 0.1) + ')';
			ctx.fill();
		}
	};

	function init() {
		stars = [];
		for (var i = 0; i < NUM_STARS; i++) stars.push(new Star());
	}

	// ── Main loop ───────────────────────────────────────────────────────────
	function animate() {
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Resolve scroll target once per frame (flagged by scroll event)
		if (scrollDirty) {
			targetIntensity = computeTargetIntensity();
			scrollDirty = false;
		}

		// Smoothly lerp intensity toward target (~1.5 s transition at 60 fps)
		starIntensity += (targetIntensity - starIntensity) * 0.025;

		// Advance animation state
		pulsePhase += 0.018;
		spikeAngle += 0.0015;

		// Central star drawn first (sits behind everything)
		drawCentralStar();

		// Drifting stars on top of star glow, but behind planet
		for (var i = 0; i < stars.length; i++) {
			stars[i].update();
			stars[i].draw();
		}

		// Planet drawn last — fully opaque base ensures stars don't show through
		drawPlanet();

		requestAnimationFrame(animate);
	}

	// ── Event listeners ─────────────────────────────────────────────────────
	window.addEventListener('resize', function () { resize(); init(); });
	window.addEventListener('scroll', function () { scrollDirty = true; }, { passive: true });

	// Seed initial intensity on load (in case page loads mid-scroll)
	window.addEventListener('load', function () {
		targetIntensity = computeTargetIntensity();
	});

	resize();
	init();
	animate();
}());

