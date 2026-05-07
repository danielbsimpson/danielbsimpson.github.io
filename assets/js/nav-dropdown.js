/**
 * nav-dropdown.js
 * Handles the collapsible Projects sub-menu inside the slide-out nav panel.
 */
(function () {
	'use strict';

	document.addEventListener('DOMContentLoaded', function () {
		var triggers = document.querySelectorAll('#menu ul.links .nav-has-sub > a');
		triggers.forEach(function (trigger) {
			trigger.addEventListener('click', function (e) {
				e.preventDefault();
				var parent = this.closest('.nav-has-sub');
				parent.classList.toggle('is-open');
			});
		});
	});
}());
