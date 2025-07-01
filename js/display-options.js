/**
 * display-options.js
 * Verwaltet Display Options direkt in der data.json (statt localStorage)
 * Arbeitet mit dem sync/data.php Script zusammen
 */

window.displayOptions = {
	// Standardwerte
	defaults: {
		tilesCount: 8,
		secondaryTilesCount: 4,
		layout: 4,
		darkMode: false,
		viewMode: false, // false = Kachel, true = Tabelle
		zoomLevel: 100,
	},

	// Aktuelle Werte
	current: {},

	/**
	 * Initialisiert die Display Options
	 */
	async init() {
		console.log("🎛️ Display Options werden initialisiert...");

		// Versuche Daten zu laden
		const loaded = await this.loadFromServer();

		if (!loaded) {
			// Falls nicht geladen werden konnte, verwende Standardwerte
			this.current = { ...this.defaults };
			console.log("📋 Standardwerte für Display Options geladen");
		}

		// UI aktualisieren
		this.updateUI();

		// Event-Listener setzen
		this.setupEventListeners();

		console.log("✅ Display Options initialisiert");
	},

	/**
	 * Lädt Display Options vom Server
	 */
	async loadFromServer() {
		try {
			const response = await fetch("sync/data.php");

			if (!response.ok) {
				console.warn(
					"⚠️ Keine gespeicherten Daten gefunden, verwende Standardwerte"
				);
				return false;
			}

			const data = await response.json();

			// Display Options aus den Einstellungen extrahieren
			if (data.settings && data.settings.displayOptions) {
				this.current = { ...this.defaults, ...data.settings.displayOptions };
				console.log("📥 Display Options vom Server geladen:", this.current);
				return true;
			} else {
				console.warn("⚠️ Keine Display Options in den Serverdaten gefunden");
				return false;
			}
		} catch (error) {
			console.error("❌ Fehler beim Laden der Display Options:", error);
			return false;
		}
	},

	/**
	 * Speichert Display Options auf dem Server
	 */
	async saveToServer() {
		try {
			// Aktuelle Werte aus UI sammeln
			this.collectFromUI();

			// Zuerst aktuelle Daten vom Server holen
			let serverData = {};
			try {
				const response = await fetch("sync/data.php");
				if (response.ok) {
					serverData = await response.json();
				}
			} catch (error) {
				console.warn(
					"⚠️ Konnte vorhandene Serverdaten nicht laden, erstelle neue"
				);
			}

			// Display Options in die Serverstruktur einbauen
			if (!serverData.settings) {
				serverData.settings = {};
			}
			serverData.settings.displayOptions = { ...this.current };

			// Metadaten aktualisieren
			if (!serverData.metadata) {
				serverData.metadata = {};
			}
			serverData.metadata.lastSaved = new Date().toISOString();
			serverData.metadata.lastModified = new Date().toLocaleString("de-DE");

			// An Server senden
			const response = await fetch("sync/data.php", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(serverData),
			});

			if (!response.ok) {
				throw new Error(`Server-Fehler: ${response.status}`);
			}

			const result = await response.json();

			if (result.success) {
				console.log("💾 Display Options erfolgreich gespeichert");
				this.showNotification("Einstellungen gespeichert", "success");
				return true;
			} else {
				throw new Error(result.error || "Unbekannter Serverfehler");
			}
		} catch (error) {
			console.error("❌ Fehler beim Speichern der Display Options:", error);
			this.showNotification(`Fehler beim Speichern: ${error.message}`, "error");
			return false;
		}
	},

	/**
	 * Sammelt aktuelle Werte aus der UI
	 */
	collectFromUI() {
		const elements = {
			tilesCount: document.getElementById("tilesCount"),
			secondaryTilesCount: document.getElementById("secondaryTilesCount"),
			layout: document.getElementById("layoutType"),
			darkMode: document.getElementById("darkModeToggle"),
			viewMode: document.getElementById("viewModeToggle"),
			zoomLevel: document.getElementById("displayZoom"),
		};

		// Werte sammeln mit Fallback auf Standardwerte
		this.current.tilesCount = elements.tilesCount
			? parseInt(elements.tilesCount.value) || this.defaults.tilesCount
			: this.defaults.tilesCount;

		this.current.secondaryTilesCount = elements.secondaryTilesCount
			? parseInt(elements.secondaryTilesCount.value) ||
			  this.defaults.secondaryTilesCount
			: this.defaults.secondaryTilesCount;

		this.current.layout = elements.layout
			? parseInt(elements.layout.value) || this.defaults.layout
			: this.defaults.layout;

		this.current.darkMode = elements.darkMode
			? elements.darkMode.checked
			: this.defaults.darkMode;

		this.current.viewMode = elements.viewMode
			? elements.viewMode.checked
			: this.defaults.viewMode;

		this.current.zoomLevel = elements.zoomLevel
			? parseInt(elements.zoomLevel.value) || this.defaults.zoomLevel
			: this.defaults.zoomLevel;
	},

	/**
	 * Aktualisiert die UI mit den aktuellen Werten
	 */
	updateUI() {
		// Input-Felder setzen
		const tilesInput = document.getElementById("tilesCount");
		if (tilesInput) tilesInput.value = this.current.tilesCount;

		const secondaryTilesInput = document.getElementById("secondaryTilesCount");
		if (secondaryTilesInput)
			secondaryTilesInput.value = this.current.secondaryTilesCount;

		const layoutSelect = document.getElementById("layoutType");
		if (layoutSelect) layoutSelect.value = this.current.layout;

		const darkModeToggle = document.getElementById("darkModeToggle");
		if (darkModeToggle) darkModeToggle.checked = this.current.darkMode;

		const viewModeToggle = document.getElementById("viewModeToggle");
		if (viewModeToggle) viewModeToggle.checked = this.current.viewMode;

		const zoomSlider = document.getElementById("displayZoom");
		if (zoomSlider) zoomSlider.value = this.current.zoomLevel;

		// Zoom-Anzeige aktualisieren
		const zoomValueDisplay = document.getElementById("zoomValue");
		if (zoomValueDisplay)
			zoomValueDisplay.textContent = `${this.current.zoomLevel}%`;

		// Einstellungen anwenden
		this.applySettings();
	},

	/**
	 * Wendet die aktuellen Einstellungen an
	 */
	applySettings() {
		// Dark Mode anwenden
		this.applyDarkMode(this.current.darkMode);

		// Zoom anwenden
		this.applyZoom(this.current.zoomLevel);

		// View Mode anwenden
		this.applyViewMode(this.current.viewMode);

		// Layout anwenden (falls entsprechende Funktion vorhanden ist)
		if (typeof updateLayout === "function") {
			updateLayout(this.current.layout);
		}
	},

	/**
	 * Dark Mode anwenden
	 */
	applyDarkMode(enabled) {
		const body = document.body;
		if (enabled) {
			body.classList.add("dark-mode");
		} else {
			body.classList.remove("dark-mode");
		}
	},

	/**
	 * Zoom anwenden
	 */
	applyZoom(zoomLevel) {
		document.documentElement.style.setProperty("--zoom-scale", zoomLevel / 100);
	},

	/**
	 * View Mode anwenden (Kachel/Tabelle)
	 */
	applyViewMode(tableView) {
		const body = document.body;
		if (tableView) {
			body.classList.add("table-view");
			body.classList.remove("tile-view");
		} else {
			body.classList.add("tile-view");
			body.classList.remove("table-view");
		}
	},

	/**
	 * Event-Listener für UI-Elemente einrichten
	 */
	setupEventListeners() {
		// Primary Tiles Update Button
		const updateTilesBtn = document.getElementById("updateTilesBtn");
		if (updateTilesBtn) {
			updateTilesBtn.addEventListener("click", () => {
				this.collectFromUI();
				this.updateTiles();
				this.saveToServer();
			});
		}

		// Secondary Tiles Update Button
		const updateSecondaryTilesBtn = document.getElementById(
			"updateSecondaryTilesBtn"
		);
		if (updateSecondaryTilesBtn) {
			updateSecondaryTilesBtn.addEventListener("click", () => {
				this.collectFromUI();
				this.updateSecondaryTiles();
				this.saveToServer();
			});
		}

		// Layout Select
		const layoutSelect = document.getElementById("layoutType");
		if (layoutSelect) {
			layoutSelect.addEventListener("change", () => {
				this.collectFromUI();
				this.applySettings();
				this.saveToServer();
			});
		}

		// Dark Mode Toggle
		const darkModeToggle = document.getElementById("darkModeToggle");
		if (darkModeToggle) {
			darkModeToggle.addEventListener("change", () => {
				this.collectFromUI();
				this.applySettings();
				this.saveToServer();
			});
		}

		// View Mode Toggle
		const viewModeToggle = document.getElementById("viewModeToggle");
		if (viewModeToggle) {
			viewModeToggle.addEventListener("change", () => {
				this.collectFromUI();
				this.applySettings();
				this.saveToServer();
			});
		}

		// Zoom Slider
		const zoomSlider = document.getElementById("displayZoom");
		if (zoomSlider) {
			zoomSlider.addEventListener("input", () => {
				this.collectFromUI();
				this.updateUI(); // Update zoom display
				this.applySettings();
			});

			zoomSlider.addEventListener("change", () => {
				this.saveToServer();
			});
		}
	},

	/**
	 * Aktualisiert die Anzahl der primären Tiles
	 */
	updateTiles() {
		if (typeof updateTiles === "function") {
			updateTiles(this.current.tilesCount);
		} else {
			console.warn("⚠️ updateTiles Funktion nicht gefunden");
		}
	},

	/**
	 * Aktualisiert die Anzahl der sekundären Tiles
	 */
	updateSecondaryTiles() {
		if (typeof updateSecondaryTiles === "function") {
			updateSecondaryTiles(this.current.secondaryTilesCount);
		} else {
			console.warn("⚠️ updateSecondaryTiles Funktion nicht gefunden");
		}
	},

	/**
	 * Zeigt eine Benachrichtigung an
	 */
	showNotification(message, type = "info") {
		if (typeof showNotification === "function") {
			showNotification(message, type);
		} else {
			console.log(`${type.toUpperCase()}: ${message}`);
		}
	},
};

// Beim Laden der Seite initialisieren
document.addEventListener("DOMContentLoaded", () => {
	window.displayOptions.init();
});
