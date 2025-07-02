/**
 * display-options.js
 * Verwaltet Display Options direkt in der data.json (statt localStorage)
 * Arbeitet mit dem sync/data.php Script zusammen
 */

// Robuste Fallback-Implementierung für saveFlightTimeValueToLocalStorage
if (!window.saveFlightTimeValueToLocalStorage) {
	window.saveFlightTimeValueToLocalStorage = function (
		cellId,
		fieldType,
		value
	) {
		console.log(
			`💾 Fallback Save: ${fieldType} für Kachel ${cellId} = "${value}"`
		);

		try {
			// Direkte localStorage-Speicherung als Fallback
			const key = `tile_${cellId}_${fieldType}`;
			// Zentralisierter localStorage-Zugriff
		if (window.hangarEventManager && window.hangarEventManager.saveToStorage) {
			window.hangarEventManager.saveToStorage(key, value);
		} else {
			localStorage.setItem(key, value);
		}

			// Auch in hangarPlannerData integrieren falls verfügbar
			const existing = JSON.parse(
				localStorage.getItem("hangarPlannerData") || "{}"
			);
			if (!existing.tiles) existing.tiles = {};
			if (!existing.tiles[cellId]) existing.tiles[cellId] = {};
			existing.tiles[cellId][fieldType] = value;
			existing.lastModified = new Date().toISOString();
			// Zentralisierter localStorage-Zugriff
		if (window.hangarEventManager && window.hangarEventManager.saveToStorage) {
			window.hangarEventManager.saveToStorage("hangarPlannerData", existing);
		} else {
			localStorage.setItem("hangarPlannerData", JSON.stringify(existing));
		}

			console.log(`✅ Fallback: ${fieldType} für Kachel ${cellId} gespeichert`);
		} catch (error) {
			console.error(
				`❌ Fallback-Speicherfehler für ${fieldType} (Kachel ${cellId}):`,
				error
			);
		}
	};
	console.log(
		"🔧 Fallback-Implementierung für saveFlightTimeValueToLocalStorage erstellt"
	);
}

// Robuste Fallback-Implementierung für collectAllHangarData
if (!window.collectAllHangarData) {
	window.collectAllHangarData = function () {
		console.log("🔧 Fallback: collectAllHangarData wird ausgeführt");

		try {
			// Einfache Implementierung die localStorage nutzt
			const existing = JSON.parse(
				localStorage.getItem("hangarPlannerData") || "{}"
			);

			// Minimale Datenstruktur erstellen
			const result = {
				id: existing.id || Date.now().toString(),
				metadata: existing.metadata || {
					created: new Date().toISOString(),
					lastModified: new Date().toISOString(),
				},
				settings: existing.settings || {},
				primaryTiles: existing.primaryTiles || [],
				secondaryTiles: existing.secondaryTiles || [],
			};

			console.log("✅ Fallback: Basis-Datenstruktur erstellt");
			return result;
		} catch (error) {
			console.error("❌ Fallback-Fehler in collectAllHangarData:", error);
			return {
				id: Date.now().toString(),
				metadata: { created: new Date().toISOString() },
				settings: {},
				primaryTiles: [],
				secondaryTiles: [],
			};
		}
	};
	console.log("🔧 Fallback-Implementierung für collectAllHangarData erstellt");
}

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

		// Versuche Daten zu laden (Server -> localStorage -> Defaults)
		let loaded = await this.loadFromServer();

		if (!loaded) {
			console.log("⚠️ Server-Laden fehlgeschlagen, versuche localStorage...");
			loaded = this.loadFromLocalStorage();
		}

		if (!loaded) {
			// Falls nichts geladen werden konnte, verwende Standardwerte
			this.current = { ...this.defaults };
			console.log("📋 Standardwerte für Display Options geladen");
		}

		// UI aktualisieren
		this.updateUI();

		// Event-Listener setzen
		this.setupEventListeners();

		console.log("✅ Display Options initialisiert:", this.current);
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
	 * Speichert Display Options auf dem Server und lokal
	 */
	async saveToServer() {
		try {
			// Aktuelle Werte aus UI sammeln
			this.collectFromUI();

			// Zuerst lokale Kopie speichern (als Fallback)
			this.saveToLocalStorage();

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
			// Fallback: nur lokal speichern
			console.log("📋 Fallback: Speichere nur lokal");
			this.saveToLocalStorage();
			return false;
		}
	},

	/**
	 * Speichert Display Options nur in localStorage (Fallback)
	 */
	saveToLocalStorage() {
		try {
			this.collectFromUI();
			localStorage.setItem("displayOptions", JSON.stringify(this.current));
			console.log("💾 Display Options lokal gespeichert");
			return true;
		} catch (error) {
			console.error("❌ Fehler beim lokalen Speichern:", error);
			return false;
		}
	},

	/**
	 * Lädt Display Options aus localStorage (Fallback)
	 */
	loadFromLocalStorage() {
		try {
			const saved = localStorage.getItem("displayOptions");
			if (saved) {
				const parsed = JSON.parse(saved);
				this.current = { ...this.defaults, ...parsed };
				console.log("📥 Display Options aus localStorage geladen");
				return true;
			}
			return false;
		} catch (error) {
			console.error("❌ Fehler beim lokalen Laden:", error);
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

		// Layout und Tiles anwenden
		this.applyLayout();

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
	 * Layout und Tiles anwenden
	 */
	applyLayout() {
		console.log("=== DISPLAY OPTIONS: LAYOUT ANWENDEN ===");
		console.log("Aktueller Zustand:", {
			tilesCount: this.current.tilesCount,
			secondaryTilesCount: this.current.secondaryTilesCount,
			layout: this.current.layout,
		});

		// Secondary Tiles aktualisieren (preserveData = true für Layout-Änderungen)
		if (typeof updateSecondaryTiles === "function") {
			updateSecondaryTiles(
				this.current.secondaryTilesCount,
				this.current.layout,
				true // Daten bei Layout-Änderungen beibehalten
			);
			console.log(
				`✅ Secondary Tiles aktualisiert: ${this.current.secondaryTilesCount}`
			);
		} else if (typeof window.hangarUI?.updateSecondaryTiles === "function") {
			window.hangarUI.updateSecondaryTiles(
				this.current.secondaryTilesCount,
				this.current.layout,
				true // Daten bei Layout-Änderungen beibehalten
			);
			console.log(
				`✅ Secondary Tiles über hangarUI aktualisiert: ${this.current.secondaryTilesCount}`
			);
		}

		// Layout-Settings an uiSettings weiterleiten (für Backward Compatibility)
		if (typeof window.hangarUI?.uiSettings === "object") {
			window.hangarUI.uiSettings.tilesCount = this.current.tilesCount;
			window.hangarUI.uiSettings.secondaryTilesCount =
				this.current.secondaryTilesCount;
			window.hangarUI.uiSettings.layout = this.current.layout;

			// uiSettings apply aufrufen falls verfügbar
			if (typeof window.hangarUI.uiSettings.apply === "function") {
				window.hangarUI.uiSettings.apply();
				console.log("✅ uiSettings.apply() aufgerufen");
			}
		}

		console.log("=== LAYOUT ANGEWENDET ===");
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

		console.log("🎛️ Display Options Event-Listener eingerichtet");
	},

	/**
	 * Aktualisiert die Anzahl der primären Tiles
	 */
	updateTiles() {
		// Mehrere Fallback-Strategien ausprobieren
		if (typeof updateTiles === "function") {
			updateTiles(this.current.tilesCount);
		} else if (typeof window.hangarUI?.updateTiles === "function") {
			window.hangarUI.updateTiles(this.current.tilesCount);
		} else if (typeof window.hangarUI?.uiSettings?.apply === "function") {
			// Über uiSettings aktualisieren
			window.hangarUI.uiSettings.tilesCount = this.current.tilesCount;
			window.hangarUI.uiSettings.apply();
		} else {
			console.warn(
				"⚠️ updateTiles Funktion nicht gefunden - verwende Fallback"
			);
			// Fallback: Einfache Anzeige/Verstecken-Logik
			this.fallbackUpdateTiles();
		}
	},

	/**
	 * Fallback für updateTiles wenn Hauptfunktion nicht verfügbar
	 */
	fallbackUpdateTiles() {
		const grid = document.getElementById("hangarGrid");
		if (!grid) return;

		const tiles = grid.querySelectorAll(".hangar-tile");
		const targetCount = this.current.tilesCount;

		tiles.forEach((tile, index) => {
			if (index < targetCount) {
				tile.style.display = "";
			} else {
				tile.style.display = "none";
			}
		});

		console.log(`📦 Fallback: ${targetCount} primäre Kacheln angezeigt`);
	},

	/**
	 * Aktualisiert die Anzahl der sekundären Tiles
	 */
	updateSecondaryTiles() {
		// Mehrere Fallback-Strategien ausprobieren
		if (typeof updateSecondaryTiles === "function") {
			updateSecondaryTiles(this.current.secondaryTilesCount);
		} else if (typeof window.hangarUI?.updateSecondaryTiles === "function") {
			window.hangarUI.updateSecondaryTiles(this.current.secondaryTilesCount);
		} else if (typeof window.hangarUI?.uiSettings?.apply === "function") {
			// Über uiSettings aktualisieren
			window.hangarUI.uiSettings.secondaryTilesCount =
				this.current.secondaryTilesCount;
			window.hangarUI.uiSettings.apply();
		} else {
			console.warn(
				"⚠️ updateSecondaryTiles Funktion nicht gefunden - verwende Fallback"
			);
			// Fallback: Erstelle sekundäre Kacheln falls nicht vorhanden
			this.fallbackUpdateSecondaryTiles();
		}
	},

	/**
	 * Fallback für updateSecondaryTiles wenn Hauptfunktion nicht verfügbar
	 */
	fallbackUpdateSecondaryTiles() {
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (!secondaryGrid) {
			console.warn("⚠️ Sekundärer Grid nicht gefunden");
			return;
		}

		// Bestehende sekundäre Kacheln zählen
		const existingTiles = secondaryGrid.querySelectorAll(".hangar-tile");
		const targetCount = this.current.secondaryTilesCount;

		// Zeige/verstecke bestehende Kacheln
		existingTiles.forEach((tile, index) => {
			if (index < targetCount) {
				tile.style.display = "";
			} else {
				tile.style.display = "none";
			}
		});

		// Erstelle fehlende Kacheln wenn nötig
		if (existingTiles.length < targetCount) {
			this.createMissingSecondaryTiles(existingTiles.length, targetCount);
		}

		console.log(`📦 Fallback: ${targetCount} sekundäre Kacheln verwaltet`);
	},

	/**
	 * Erstellt fehlende sekundäre Kacheln
	 */
	createMissingSecondaryTiles(currentCount, targetCount) {
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (!secondaryGrid) return;

		for (let i = currentCount; i < targetCount; i++) {
			const tileId = 101 + i; // Sekundäre IDs starten bei 101
			const tile = this.createSecondaryTileElement(tileId);
			secondaryGrid.appendChild(tile);
		}

		console.log(`➕ ${targetCount - currentCount} sekundäre Kacheln erstellt`);
	},

	/**
	 * Erstellt ein einzelnes sekundäres Kachel-Element
	 */
	createSecondaryTileElement(tileId) {
		const tile = document.createElement("div");
		tile.className =
			"hangar-tile bg-white rounded-lg shadow-md p-4 relative border-2 border-gray-200";
		tile.innerHTML = `
			<div class="tile-header flex justify-between items-center mb-2">
				<span class="text-sm font-medium text-gray-500">Kachel ${tileId}</span>
				<div class="status-light w-3 h-3 rounded-full bg-gray-300" id="status-light-${tileId}"></div>
			</div>
			<div class="space-y-2">
				<input id="hangar-position-${tileId}" type="text" class="form-input" placeholder="Position">
				<input id="aircraft-${tileId}" type="text" class="form-input" placeholder="Aircraft">
				<input id="arrival-time-${tileId}" type="time" class="info-input">
				<input id="departure-time-${tileId}" type="time" class="info-input">
				<textarea id="notes-${tileId}" class="notes-textarea" placeholder="Notes"></textarea>
				<select id="status-${tileId}" class="status-selector">
					<option value="neutral">Neutral</option>
					<option value="maintenance">Wartung</option>
					<option value="ready">Bereit</option>
					<option value="occupied">Belegt</option>
				</select>
			</div>
		`;
		return tile;
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

	/**
	 * Notfall-Layout-Reparatur falls Tailwind nicht lädt
	 */
	emergencyLayoutRepair() {
		console.log("🚨 Starte Notfall-Layout-Reparatur...");

		// Fallback CSS direkt setzen falls Tailwind fehlt
		if (typeof tailwind === "undefined") {
			console.log("⚠️ Tailwind CSS nicht verfügbar - verwende Fallback-Styles");
			this.injectFallbackCSS();
		}

		// Sekundäre Kacheln reparieren
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (secondaryGrid && secondaryGrid.children.length === 0) {
			console.log("🔧 Repariere fehlende sekundäre Kacheln...");
			this.fallbackUpdateSecondaryTiles();
		}

		// UI-Felder auf korrekte Werte setzen
		this.forceUpdateUI();

		console.log("✅ Notfall-Layout-Reparatur abgeschlossen");
	},

	/**
	 * Injiziert Fallback-CSS falls Tailwind nicht lädt
	 */
	injectFallbackCSS() {
		const fallbackStyle = document.createElement("style");
		fallbackStyle.id = "emergency-fallback-css";
		fallbackStyle.textContent = `
			/* Notfall-Fallback falls Tailwind CSS fehlt */
			.hangar-tile {
				background: white;
				border: 2px solid #e5e7eb;
				border-radius: 8px;
				padding: 16px;
				margin: 8px;
				box-shadow: 0 1px 3px rgba(0,0,0,0.1);
				position: relative;
			}
			
			.form-input, .info-input {
				width: 100%;
				padding: 8px;
				border: 1px solid #d1d5db;
				border-radius: 4px;
				margin: 4px 0;
			}
			
			.notes-textarea {
				width: 100%;
				padding: 8px;
				border: 1px solid #d1d5db;
				border-radius: 4px;
				resize: vertical;
				min-height: 60px;
			}
			
			.status-selector {
				width: 100%;
				padding: 8px;
				border: 1px solid #d1d5db;
				border-radius: 4px;
				background: white;
			}
			
			#hangarGrid, #secondaryHangarGrid {
				display: grid;
				grid-template-columns: repeat(4, 1fr);
				gap: 16px;
				padding: 16px;
			}
			
			.status-light {
				width: 12px;
				height: 12px;
				border-radius: 50%;
				background: #9ca3af;
			}
			
			.tile-header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 8px;
				font-size: 14px;
				font-weight: 500;
				color: #6b7280;
			}
		`;

		// Prüfe ob bereits vorhanden
		if (!document.getElementById("emergency-fallback-css")) {
			document.head.appendChild(fallbackStyle);
			console.log("💡 Fallback-CSS injiziert");
		}
	},

	/**
	 * Forciert UI-Update mit aktuellen Werten
	 */
	forceUpdateUI() {
		// Sammle Werte und wende sie an
		this.collectFromUI();

		// Zoom forcieren
		if (this.current.zoomLevel && this.current.zoomLevel !== 100) {
			document.documentElement.style.setProperty(
				"--zoom-scale",
				this.current.zoomLevel / 100
			);
		}

		// Dark Mode forcieren
		if (this.current.darkMode) {
			document.body.classList.add("dark-mode");
		}

		// View Mode forcieren
		if (this.current.viewMode) {
			document.body.classList.add("table-view");
			document.body.classList.remove("tile-view");
		} else {
			document.body.classList.add("tile-view");
			document.body.classList.remove("table-view");
		}

		console.log("🔄 UI-Werte forciert angewendet");
	},
};

// Globale Notfall-Reparatur-Funktion
window.emergencyRepair = {
	fullRepair() {
		console.log("🚨 NOTFALL-REPARATUR: Repariere alle kritischen Funktionen");

		// 1. Display Options reparieren
		if (window.displayOptions) {
			window.displayOptions.emergencyLayoutRepair();
		}

		// 2. Event Manager reparieren
		if (
			window.hangarEventManager &&
			typeof window.hangarEventManager.init === "function"
		) {
			try {
				window.hangarEventManager.init();
			} catch (error) {
				console.error("Event Manager Reparatur fehlgeschlagen:", error);
			}
		}

		// 3. Missing Funktionen nachimplementieren
		this.ensureCriticalFunctions();

		console.log("✅ Notfall-Reparatur abgeschlossen");
	},

	ensureCriticalFunctions() {
		// updateTiles global verfügbar machen
		if (!window.updateTiles && window.hangarUI?.updateTiles) {
			window.updateTiles = window.hangarUI.updateTiles;
		}

		// updateSecondaryTiles global verfügbar machen
		if (!window.updateSecondaryTiles && window.hangarUI?.updateSecondaryTiles) {
			window.updateSecondaryTiles = window.hangarUI.updateSecondaryTiles;
		}

		// updateCellAttributes global verfügbar machen
		if (!window.updateCellAttributes && window.hangarUI?.updateCellAttributes) {
			window.updateCellAttributes = window.hangarUI.updateCellAttributes;
		}

		// collectTileData global verfügbar machen (NEU HINZUGEFÜGT)
		if (!window.collectTileData && window.hangarUI?.collectTileData) {
			window.collectTileData = window.hangarUI.collectTileData;
		}

		// setupFlightTimeEventListeners global verfügbar machen
		if (
			!window.setupFlightTimeEventListeners &&
			window.hangarEvents?.setupFlightTimeEventListeners
		) {
			window.setupFlightTimeEventListeners =
				window.hangarEvents.setupFlightTimeEventListeners;
		}

		console.log("🔧 Kritische Funktionen global verfügbar gemacht");

		// Debug: Prüfe verfügbarkeit aller kritischen Funktionen
		const criticalFunctions = [
			"updateTiles",
			"updateSecondaryTiles",
			"updateCellAttributes",
			"collectTileData",
			"setupFlightTimeEventListeners",
		];

		const missing = criticalFunctions.filter(
			(fn) => typeof window[fn] !== "function"
		);
		if (missing.length > 0) {
			console.warn("⚠️ Noch fehlende kritische Funktionen:", missing);
		} else {
			console.log("✅ Alle kritischen Funktionen sind verfügbar");
		}
	},
};

// Beim Laden der Seite initialisieren - robuste Version mit Fallbacks
document.addEventListener("DOMContentLoaded", () => {
	console.log("🎛️ Display Options DOMContentLoaded - initialisiere...");

	// Sofort initialisieren, da wir jetzt Fallback-Implementierungen haben
	window.displayOptions.init();

	// Zusätzliche Initialisierung nach kurzer Verzögerung für bessere Integration
	setTimeout(() => {
		console.log(
			"🔄 Display Options - verzögerte Re-Initialisierung für bessere Integration"
		);
		window.displayOptions.updateUI();
		window.displayOptions.applySettings();

		// Notfall-Layout-Reparatur
		window.displayOptions.emergencyLayoutRepair();
	}, 1000);

	// Weitere Reparatur nach längerer Verzögerung falls immer noch Probleme
	setTimeout(() => {
		console.log("🔧 Display Options - finale Layout-Validierung");
		window.displayOptions.emergencyLayoutRepair();
	}, 3000);
});

// Notfall-Reparatur automatisch nach 5 Sekunden falls Layout kaputt
setTimeout(() => {
	const grid = document.getElementById("secondaryHangarGrid");
	if (grid && grid.children.length === 0) {
		console.log("⚠️ Layout-Problem erkannt, starte automatische Reparatur");
		window.emergencyRepair.fullRepair();
	}
}, 5000);
