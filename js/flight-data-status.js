/**
 * Flight Data Status Display Component
 * Visueller Status-Indikator für Flugdaten-Updates
 */

const FlightDataStatusDisplay = (() => {
	let statusElement = null;
	let currentTimeout = null;
	let progressInterval = null;
	let currentProgress = 0;
	let isVisible = false;

	/**
	 * Initialisiert die Statusanzeige
	 */
	const init = () => {
		if (!statusElement) {
			createStatusElement();
		}
	};

	/**
	 * Erstellt das Status-Element im DOM
	 */
	const createStatusElement = () => {
		statusElement = document.createElement("div");
		statusElement.id = "flight-data-status";
		statusElement.innerHTML = `
			<div class="status-header">
				<div class="status-title">
					<span class="status-icon">✈️</span>
					<span class="status-title-text">Flight Data Update</span>
				</div>
				<div class="status-close" onclick="FlightDataStatusDisplay.hide()">×</div>
			</div>
			<div class="status-content">
				<div class="status-main-message">Initialisiere Flugdaten-Abfrage...</div>
				<div class="status-progress">
					<div class="status-progress-bar"></div>
				</div>
				<div class="status-details">
					<div class="status-detail-row">
						<span class="status-detail-label">Flughafen:</span>
						<span class="status-detail-value" id="status-airport">---</span>
					</div>
					<div class="status-detail-row">
						<span class="status-detail-label">Aircraft gefunden:</span>
						<span class="status-detail-value" id="status-aircraft-count">0</span>
					</div>
					<div class="status-detail-row">
						<span class="status-detail-label">Status:</span>
						<span class="status-detail-value" id="status-current">Warte...</span>
					</div>
				</div>
			</div>
		`;

		document.body.appendChild(statusElement);
	};

	/**
	 * Zeigt die Statusanzeige an
	 * @param {string} message - Hauptnachricht
	 * @param {Object} options - Zusätzliche Optionen
	 */
	const show = (message = "Starte Flugdaten-Update...", options = {}) => {
		init();

		const {
			airport = "---",
			aircraftCount = 0,
			currentStatus = "Initialisiere...",
			autoHide = false,
			duration = 5000,
		} = options;

		// Update content
		updateMessage(message);
		updateDetails({ airport, aircraftCount, currentStatus });
		updateProgress(0);
		updateIcon("✈️", "loading");

		// Show element
		statusElement.classList.add("show");
		isVisible = true;

		// Start progress animation für loading state
		startProgressAnimation();

		// Auto-hide if requested
		if (autoHide) {
			currentTimeout = setTimeout(() => {
				hide();
			}, duration);
		}

		console.log(`[FlightDataStatus] Anzeige gestartet: ${message}`);
	};

	/**
	 * Versteckt die Statusanzeige
	 */
	const hide = () => {
		if (statusElement && isVisible) {
			statusElement.classList.remove("show");
			isVisible = false;

			// Clear timeouts and intervals
			if (currentTimeout) {
				clearTimeout(currentTimeout);
				currentTimeout = null;
			}
			stopProgressAnimation();

			console.log("[FlightDataStatus] Anzeige versteckt");
		}
	};

	/**
	 * Aktualisiert die Hauptnachricht
	 * @param {string} message - Neue Nachricht
	 */
	const updateMessage = (message) => {
		if (statusElement) {
			const messageElement = statusElement.querySelector(
				".status-main-message"
			);
			if (messageElement) {
				messageElement.textContent = message;
			}
		}
	};

	/**
	 * Aktualisiert die Detail-Informationen
	 * @param {Object} details - Detail-Objekt
	 */
	const updateDetails = (details) => {
		if (!statusElement) return;

		const { airport, aircraftCount, currentStatus } = details;

		if (airport !== undefined) {
			const airportElement = statusElement.querySelector("#status-airport");
			if (airportElement) airportElement.textContent = airport;
		}

		if (aircraftCount !== undefined) {
			const countElement = statusElement.querySelector(
				"#status-aircraft-count"
			);
			if (countElement) countElement.textContent = aircraftCount;
		}

		if (currentStatus !== undefined) {
			const statusCurrentElement =
				statusElement.querySelector("#status-current");
			if (statusCurrentElement)
				statusCurrentElement.textContent = currentStatus;
		}
	};

	/**
	 * Aktualisiert den Fortschrittsbalken
	 * @param {number} percentage - Fortschritt in Prozent (0-100)
	 * @param {string} type - Typ (default, success, error)
	 */
	const updateProgress = (percentage, type = "default") => {
		if (!statusElement) return;

		const progressBar = statusElement.querySelector(".status-progress-bar");
		if (progressBar) {
			progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;

			// Remove existing type classes
			progressBar.classList.remove("success", "error");

			// Add new type class
			if (type === "success") {
				progressBar.classList.add("success");
			} else if (type === "error") {
				progressBar.classList.add("error");
			}
		}
	};

	/**
	 * Aktualisiert das Icon und seinen Status
	 * @param {string} icon - Emoji oder Text für das Icon
	 * @param {string} status - Status-Typ (loading, success, error)
	 */
	const updateIcon = (icon, status = "default") => {
		if (!statusElement) return;

		const iconElement = statusElement.querySelector(".status-icon");
		if (iconElement) {
			iconElement.textContent = icon;

			// Remove existing status classes
			iconElement.classList.remove("success", "error");

			// Add new status class
			if (status === "success") {
				iconElement.classList.add("success");
			} else if (status === "error") {
				iconElement.classList.add("error");
			}
		}
	};

	/**
	 * Zeigt Erfolgsstatus an
	 * @param {string} message - Erfolgsnachricht
	 * @param {Object} details - Detail-Informationen
	 * @param {number} autoHideDelay - Zeit bis automatisches Verstecken (ms)
	 */
	const showSuccess = (message, details = {}, autoHideDelay = 4000) => {
		updateMessage(message);
		updateDetails(details);
		updateProgress(100, "success");
		updateIcon("✅", "success");
		stopProgressAnimation();

		// Auto-hide after delay
		if (autoHideDelay > 0) {
			currentTimeout = setTimeout(() => {
				hide();
			}, autoHideDelay);
		}

		console.log(`[FlightDataStatus] Erfolgsstatus: ${message}`);
	};

	/**
	 * Zeigt Fehlerstatus an
	 * @param {string} message - Fehlernachricht
	 * @param {Object} details - Detail-Informationen
	 * @param {number} autoHideDelay - Zeit bis automatisches Verstecken (ms)
	 */
	const showError = (message, details = {}, autoHideDelay = 6000) => {
		updateMessage(message);
		updateDetails(details);
		updateProgress(0, "error");
		updateIcon("❌", "error");
		stopProgressAnimation();

		// Auto-hide after delay
		if (autoHideDelay > 0) {
			currentTimeout = setTimeout(() => {
				hide();
			}, autoHideDelay);
		}

		console.log(`[FlightDataStatus] Fehlerstatus: ${message}`);
	};

	/**
	 * Zeigt einen Verarbeitungsschritt an
	 * @param {string} message - Schritt-Nachricht
	 * @param {number} step - Aktueller Schritt
	 * @param {number} totalSteps - Gesamtanzahl Schritte
	 * @param {Object} details - Zusätzliche Details
	 */
	const showStep = (message, step, totalSteps, details = {}) => {
		const percentage = totalSteps > 0 ? (step / totalSteps) * 100 : 0;

		updateMessage(message);
		updateDetails(details);
		updateProgress(percentage);
		updateIcon("⚡", "loading");

		console.log(`[FlightDataStatus] Schritt ${step}/${totalSteps}: ${message}`);
	};

	/**
	 * Startet die Fortschritts-Animation für unbestimmte Prozesse
	 */
	const startProgressAnimation = () => {
		stopProgressAnimation(); // Cleanup existing

		currentProgress = 0;
		progressInterval = setInterval(() => {
			currentProgress += 2;
			if (currentProgress >= 90) {
				currentProgress = 10; // Loop between 10-90%
			}
			updateProgress(currentProgress);
		}, 150);
	};

	/**
	 * Stoppt die Fortschritts-Animation
	 */
	const stopProgressAnimation = () => {
		if (progressInterval) {
			clearInterval(progressInterval);
			progressInterval = null;
		}
	};

	/**
	 * Prüft ob die Anzeige sichtbar ist
	 * @returns {boolean}
	 */
	const isShowing = () => {
		return isVisible;
	};

	/**
	 * Cleanup beim Zerstören
	 */
	const destroy = () => {
		hide();
		if (statusElement && statusElement.parentNode) {
			statusElement.parentNode.removeChild(statusElement);
		}
		statusElement = null;

		// Clear all timers
		if (currentTimeout) {
			clearTimeout(currentTimeout);
			currentTimeout = null;
		}
		stopProgressAnimation();
	};

	// Public API
	return {
		init,
		show,
		hide,
		updateMessage,
		updateDetails,
		updateProgress,
		updateIcon,
		showSuccess,
		showError,
		showStep,
		isShowing,
		destroy,
	};
})();

// Global verfügbar machen
window.FlightDataStatusDisplay = FlightDataStatusDisplay;

// Auto-Initialisierung beim Laden
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", FlightDataStatusDisplay.init);
} else {
	FlightDataStatusDisplay.init();
}
