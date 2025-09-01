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
		// console.log(
		//	`💾 Fallback Save: ${fieldType} für Kachel ${cellId} = "${value}"`
		// );

		try {
			// Direkte localStorage-Speicherung als Fallback
			const key = `tile_${cellId}_${fieldType}`;
			// Zentralisierter localStorage-Zugriff
			if (
				window.hangarEventManager &&
				window.hangarEventManager.saveToStorage
			) {
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
			if (
				window.hangarEventManager &&
				window.hangarEventManager.saveToStorage
			) {
				window.hangarEventManager.saveToStorage("hangarPlannerData", existing);
			} else {
				localStorage.setItem("hangarPlannerData", JSON.stringify(existing));
			}

			// console.log(`✅ Fallback: ${fieldType} für Kachel ${cellId} gespeichert`);
		} catch (error) {
			console.error(
				`❌ Fallback-Speicherfehler für ${fieldType} (Kachel ${cellId}):`,
				error
			);
		}
	};
	// console.log(
	//	"🔧 Fallback-Implementierung für saveFlightTimeValueToLocalStorage erstellt"
	// );
}

// Robuste Fallback-Implementierung für collectAllHangarData
if (!window.collectAllHangarData) {
	window.collectAllHangarData = function () {
		// console.log("🔧 Fallback: collectAllHangarData wird ausgeführt");

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

			// console.log("✅ Fallback: Basis-Datenstruktur erstellt");
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
	// console.log("🔧 Fallback-Implementierung für collectAllHangarData erstellt");
}

window.displayOptions = {
	// Standardwerte
	defaults: {
		tilesCount: 8,
		secondaryTilesCount: 4, // KORRIGIERT: Startwert 4 statt 0
		layout: 4,
		darkMode: false,
		viewMode: false, // false = Kachel, true = Tabelle
		zoomLevel: 100,
		// New: Header widgets visibility
		showWeatherWidget: true,
		showTimeWidget: true,
	},

	// Aktuelle Werte
	current: {},

	// Letzte gespeicherte Werte (für Change-Detection)
	lastSavedSettings: null,

	// Ladezustand verfolgen
	isLoading: false,
	isSaving: false,
	saveTimeout: null,

	// Initialisierungsdetails verfolgen
	isInitialized: false,

	/**
	 * Initialisiert die Display Options
	 */
async init() {
		// Verhindere Doppel-Initialisierung
		if (this.isInitialized) {
			console.log("⏸️ Display Options bereits initialisiert");
			return;
		}

		this.isInitialized = true;
		// console.log("🎛️ Display Options werden initialisiert...");

		// Versuche Daten zu laden (Server -> localStorage -> Defaults)
		let loaded = await this.load();

		if (!loaded) {
			// Falls nichts geladen werden konnte, verwende Standardwerte
			this.current = { ...this.defaults };
			// console.log("📋 Standardwerte für Display Options geladen");
		}

		// Respect persisted theme or existing DOM class before applying
		try {
			const persistedTheme = (localStorage.getItem('hangar.theme') || '').toLowerCase();
			if (persistedTheme === 'dark') {
				this.current.darkMode = true;
			} else if (persistedTheme === 'light') {
				this.current.darkMode = false;
			} else {
				// Fallback: detect existing class
				if (document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode')) {
					this.current.darkMode = true;
				}
			}
		} catch(e) { /* noop */ }

		// UI aktualisieren
		this.updateUI();

		// Event-Handler setzen
		this.setupEventHandlers();

		// console.log("✅ Display Options initialisiert:", this.current);
	},

	/**
	 * Lädt Display Options mit intelligenter Priorität (Server > localStorage > Defaults)
	 */
	async load() {
		// Race Condition Guard - verhindert mehrfaches gleichzeitiges Laden
		if (this.isLoading) {
			console.log("⏸️ Display Options werden bereits geladen, überspringe");
			return false;
		}

		this.isLoading = true;

		try {
			// Priorität 1: Server (nur wenn kein Server-Sync aktiv)
			let loaded = false;

			if (!window.isApplyingServerData && !window.isLoadingServerData) {
				loaded = await this.loadFromServer();
			} else {
				console.log("⏸️ Server-Sync aktiv, überspringe Server-Load");
			}

			if (!loaded) {
				// Priorität 2: localStorage
				loaded = this.loadFromLocalStorage();
			}

			if (loaded) {
				// UI aktualisieren falls Daten geladen wurden
				this.updateUI();
				this.applySettings();
			}

			return loaded;
		} finally {
			this.isLoading = false;
		}
	},

	/**
	 * Lädt Display Options vom Server
	 */
	async loadFromServer() {
		try {
			// Verwende den zentralen Server-Sync
			if (window.serverSync && window.serverSync.loadFromServer) {
				const data = await window.serverSync.loadFromServer();

				if (data && data.settings && data.settings.displayOptions) {
					this.current = { ...this.defaults, ...data.settings.displayOptions };
					// Setze auch die letzten gespeicherten Werte um unnötige Saves zu vermeiden
					this.lastSavedSettings = { ...this.current };
					console.log("📥 Display Options vom Server geladen:", this.current);
					return true;
				}
			}

			// Fallback: Direkte Server-Anfrage
			const response = await fetch("sync/data.php?action=load");

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
				// Setze auch die letzten gespeicherten Werte um unnötige Saves zu vermeiden
				this.lastSavedSettings = { ...this.current };
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
		// Race Condition Guard - verhindert mehrfaches gleichzeitiges Speichern
		if (this.isSaving) {
			console.log("⏸️ Display Options werden bereits gespeichert, überspringe");
			return false;
		}

		// Nicht speichern wenn Server-Daten gerade angewendet werden
		if (window.isApplyingServerData) {
			console.log("⏸️ Server-Daten werden angewendet, überspringe Speicherung");
			return false;
		}

		// NEU: Schreibschutz in Read-Only (Sync) Mode – nur lokal speichern und informieren
		const isWriteEnabled =
			(!!window.serverSync && window.serverSync.isMaster === true) ||
			(!!window.sharingManager && window.sharingManager.isMasterMode === true);
		if (!isWriteEnabled) {
			this.collectFromUI();
			this.saveToLocalStorage();
			this.lastSavedSettings = { ...this.current };
			this.showNotification("Saved locally (read-only mode)", "info");
			return true;
		}

		this.isSaving = true;

		try {
			// Aktuelle Werte aus UI sammeln
			this.collectFromUI();

			// Zuerst lokale Kopie speichern (als Fallback)
			this.saveToLocalStorage();

			// *** NEU: Integriere mit dem globalen Server-Sync System ***
			if (
				window.serverSync &&
				typeof window.serverSync.syncWithServer === "function"
			) {
				// Verwende das globale Server-Sync System
				const success = await window.serverSync.syncWithServer();
				if (success) {
					console.log(
						"💾 Display Options über globales Server-Sync gespeichert"
					);
					// Aktualisiere die letzten gespeicherten Werte
					this.lastSavedSettings = { ...this.current };
					// Kleine Toast-Benachrichtigung
					this.showNotification("Saved", "success");
					return true;
				} else {
					console.warn(
						"⚠️ Globales Server-Sync fehlgeschlagen, versuche direktes Speichern"
					);
				}
			}

// Fallback: Keine direkten Server-Schreibvorgänge mehr (zentralisiert über ServerSync)
			console.warn("⚠️ Zentralisierte Speicherung aktiv – kein direkter Server-Write. Speichere lokal.");
			this.lastSavedSettings = { ...this.current };
			this.showNotification("Saved locally (offline or sync unavailable)", "info");
			return false;
		} catch (error) {
			console.error("❌ Fehler beim Speichern der Display Options:", error);
			// Fallback: nur lokal speichern
			// console.log("📋 Fallback: Speichere nur lokal");
			this.saveToLocalStorage();
			// Nach lokalem Speichern: letzten Stand aktualisieren und Toast zeigen
			this.lastSavedSettings = { ...this.current };
			this.showNotification("Saved", "success");
			return false;
		} finally {
			this.isSaving = false;
		}
	}

	/**
	 * Speichert Display Options nur in localStorage (Fallback)
	 */
	saveToLocalStorage() {
		try {
			this.collectFromUI();
			localStorage.setItem("displayOptions", JSON.stringify(this.current));
			// console.log("💾 Display Options lokal gespeichert");
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
				// Setze auch die letzten gespeicherten Werte um unnötige Saves zu vermeiden
				this.lastSavedSettings = { ...this.current };
				// console.log("📥 Display Options aus localStorage geladen");
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
			// New: widget toggles
			weatherWidget: document.getElementById("weatherWidgetToggle"),
			timeWidget: document.getElementById("timeWidgetToggle"),
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

		// New: widget visibility (default to true when control absent)
		this.current.showWeatherWidget = elements.weatherWidget
			? !!elements.weatherWidget.checked
			: true;
		this.current.showTimeWidget = elements.timeWidget
			? !!elements.timeWidget.checked
			: true;
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

		// New: widget toggles
		const weatherToggle = document.getElementById("weatherWidgetToggle");
		if (weatherToggle) weatherToggle.checked = this.current.showWeatherWidget !== false;
		const timeToggle = document.getElementById("timeWidgetToggle");
		if (timeToggle) timeToggle.checked = this.current.showTimeWidget !== false;

		// View/Edit Mode Toggle synchronisieren - NEU HINZUGEFÜGT
		const modeToggle = document.getElementById("modeToggle");
		if (modeToggle) {
			// Edit-Modus ist aktiv wenn Body edit-mode hat
			const isEditMode = document.body.classList.contains("edit-mode");
			modeToggle.checked = isEditMode;
		}

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

		// New: header widgets visibility
		this.applyWidgetsVisibility();

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
		const html = document.documentElement;
		if (enabled) {
			if (html) html.classList.add("dark-mode");
			if (body) body.classList.add("dark-mode");
			try { localStorage.setItem('hangar.theme', 'dark'); } catch (e) {}
		} else {
			if (body) body.classList.remove("dark-mode");
			if (html) html.classList.remove("dark-mode");
			try { localStorage.setItem('hangar.theme', 'light'); } catch (e) {}
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
	 * Sichtbarkeit der Header-Widgets anwenden
	 */
	applyWidgetsVisibility() {
		try {
			const weather = document.getElementById("weather-widget");
			if (weather) {
				const showW = this.current.showWeatherWidget !== false; // default true
				weather.classList.toggle("hidden", !showW);
				if (weather.style) weather.style.display = showW ? "" : "none";
			}
			const time = document.getElementById("time-widget");
			if (time) {
				const showT = this.current.showTimeWidget !== false; // default true
				time.classList.toggle("hidden", !showT);
				if (time.style) time.style.display = showT ? "" : "none";
			}
		} catch (e) { /* noop */ }
	},

	/**
	 * Layout und Tiles anwenden
	 */
	applyLayout() {
		// console.log("=== DISPLAY OPTIONS: LAYOUT ANWENDEN ===");
		// console.log("Aktueller Zustand:", {
		//	tilesCount: this.current.tilesCount,
		//	secondaryTilesCount: this.current.secondaryTilesCount,
		//	layout: this.current.layout,
		// });

		// Secondary Tiles aktualisieren (preserveData = true für Layout-Änderungen)
		if (typeof updateSecondaryTiles === "function") {
			updateSecondaryTiles(
				this.current.secondaryTilesCount,
				this.current.layout,
				true // Daten bei Layout-Änderungen beibehalten
			);
			// console.log(
			//	`✅ Secondary Tiles aktualisiert: ${this.current.secondaryTilesCount}`
			// );
		} else if (typeof window.hangarUI?.updateSecondaryTiles === "function") {
			window.hangarUI.updateSecondaryTiles(
				this.current.secondaryTilesCount,
				this.current.layout,
				true // Daten bei Layout-Änderungen beibehalten
			);
			// console.log(
			//	`✅ Secondary Tiles über hangarUI aktualisiert: ${this.current.secondaryTilesCount}`
			// );
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
				// console.log("✅ uiSettings.apply() aufgerufen");
			}
		}

		// console.log("=== LAYOUT ANGEWENDET ===");
	},

	/**
	 * Event-Handler für alle Display Options Buttons und Controls einrichten
	 */
	setupEventHandlers() {
		// Inputs for Tiles: auto-apply and auto-save on change
		const tilesInput = document.getElementById("tilesCount");
		if (tilesInput) {
			tilesInput.removeEventListener("change", this.onUpdateTiles);
			tilesInput.addEventListener("change", this.onUpdateTiles.bind(this));
		}

		// Ensure pending changes are flushed on navigation
		window.removeEventListener("beforeunload", this.onBeforeUnload);
		window.addEventListener("beforeunload", this.onBeforeUnload.bind(this));
		window.removeEventListener("pagehide", this.onBeforeUnload);
		window.addEventListener("pagehide", this.onBeforeUnload.bind(this));

		const secondaryTilesInput = document.getElementById("secondaryTilesCount");
		if (secondaryTilesInput) {
			secondaryTilesInput.removeEventListener("change", this.onUpdateSecondaryTiles);
			secondaryTilesInput.addEventListener(
				"change",
				this.onUpdateSecondaryTiles.bind(this)
			);
		}

		// Layout-Selector
		const layoutSelect = document.getElementById("layoutType");
		if (layoutSelect) {
			layoutSelect.removeEventListener("change", this.onLayoutChange);
			layoutSelect.addEventListener("change", this.onLayoutChange.bind(this));
		}

		// Dark Mode Toggle
		const darkModeToggle = document.getElementById("darkModeToggle");
		if (darkModeToggle) {
			darkModeToggle.removeEventListener("change", this.onDarkModeChange);
			darkModeToggle.addEventListener(
				"change",
				this.onDarkModeChange.bind(this)
			);
		}

		// View Mode Toggle
		const viewModeToggle = document.getElementById("viewModeToggle");
		if (viewModeToggle) {
			viewModeToggle.removeEventListener("change", this.onViewModeChange);
			viewModeToggle.addEventListener(
				"change",
				this.onViewModeChange.bind(this)
			);
		}

		// View/Edit Mode Toggle (modeToggle) - KORREKTUR
		const modeToggle = document.getElementById("modeToggle");
		if (modeToggle) {
			modeToggle.removeEventListener("change", this.onModeToggleChange);
			modeToggle.addEventListener("change", this.onModeToggleChange.bind(this));
		}

		// Zoom Slider
		const zoomSlider = document.getElementById("displayZoom");
		if (zoomSlider) {
			zoomSlider.removeEventListener("input", this.onZoomChange);
			zoomSlider.addEventListener("input", this.onZoomChange.bind(this));
		}

		// New: widget toggle handlers
		const weatherToggle = document.getElementById("weatherWidgetToggle");
		if (weatherToggle) {
			weatherToggle.removeEventListener("change", this.onWidgetVisibilityChange);
			weatherToggle.addEventListener("change", this.onWidgetVisibilityChange.bind(this));
		}
		const timeToggle = document.getElementById("timeWidgetToggle");
		if (timeToggle) {
			timeToggle.removeEventListener("change", this.onWidgetVisibilityChange);
			timeToggle.addEventListener("change", this.onWidgetVisibilityChange.bind(this));
		}

		console.log("🎛️ Display Options Event-Handler eingerichtet");
	},

	/**
	 * Event-Handler für Update Tiles Button (mit Debouncing)
	 */
	onUpdateTiles() {
		this.collectFromUI();
		this.updateTiles();
		// Debounced Save - verhindert zu häufige Server-Anfragen
		this.debouncedSave();
	},

	/**
	 * Event-Handler für Update Secondary Tiles Button (mit Debouncing)
	 */
	onUpdateSecondaryTiles() {
		this.collectFromUI();
		this.updateSecondaryTiles();
		// Debounced Save - verhindert zu häufige Server-Anfragen
		this.debouncedSave();
	},

	/**
	 * Event-Handler für Layout-Änderung (mit Debouncing)
	 */
	onLayoutChange() {
		this.collectFromUI();
		this.applyLayout();
		// Debounced Save - verhindert zu häufige Server-Anfragen
		this.debouncedSave();
	},

	/**
	 * Event-Handler für View/Edit Mode Toggle (modeToggle) - NEU HINZUGEFÜGT
	 */
onModeToggleChange() {
		// Blurre fokussiertes Element beim Wechsel in den View-Modus, um Tastatureingaben zu stoppen
		try {
			const modeEl = document.getElementById("modeToggle");
			if (modeEl && !modeEl.checked) {
				if (document.activeElement && typeof document.activeElement.blur === "function") {
					document.activeElement.blur();
				}
			}
		} catch (e) { /* noop */ }

		// Rufe die Business Logic Funktion auf
		if (typeof toggleEditMode === "function") {
			toggleEditMode();
		} else if (
			window.hangarEvents &&
			typeof window.hangarEvents.toggleEditMode === "function"
		) {
			window.hangarEvents.toggleEditMode();
		} else {
			// Fallback: Direkte Implementierung
			const body = document.body;
			const modeToggle = document.getElementById("modeToggle");

			if (modeToggle && modeToggle.checked) {
				// Edit-Modus aktivieren
				body.classList.add("edit-mode");
				body.classList.remove("view-mode");
				console.log("✏️ Edit-Modus aktiviert (via display-options)");
			} else {
				// View-Modus aktivieren
				body.classList.remove("edit-mode");
				body.classList.add("view-mode");
				console.log("👁️ View-Modus aktiviert (via display-options)");
			}
		}
	},

	/**
	 * Event-Handler für Dark Mode Toggle (mit Debouncing)
	 */
onDarkModeChange() {
		this.collectFromUI();
		this.applyDarkMode(this.current.darkMode);
		// Save immediately for persistence across page navigation
		try { this.saveToLocalStorage(); this.lastSavedSettings = { ...this.current }; } catch (e) {}
		try { localStorage.setItem('hangar.theme', this.current.darkMode ? 'dark' : 'light'); } catch (e) {}
		// Debounced Server Save - verhindert zu häufige Server-Anfragen
		this.debouncedSave();
	},

	/**
	 * Event-Handler für View Mode Toggle (mit Debouncing)
	 */
	onViewModeChange() {
		this.collectFromUI();
		this.applyViewMode(this.current.viewMode);
		// Debounced Save - verhindert zu häufige Server-Anfragen
		this.debouncedSave();
	},

	/**
	 * Event-Handler für Widget Sichtbarkeit (mit Debouncing)
	 */
	onWidgetVisibilityChange() {
		this.collectFromUI();
		this.applyWidgetsVisibility();
		this.debouncedSave();
	},

	/**
	 * Event-Handler für Zoom-Änderung (mit Debouncing)
	 */
	onZoomChange() {
		this.collectFromUI();
		this.applyZoom(this.current.zoomLevel);

		// Zoom-Anzeige aktualisieren
		const zoomValueDisplay = document.getElementById("zoomValue");
		if (zoomValueDisplay) {
			zoomValueDisplay.textContent = `${this.current.zoomLevel}%`;
		}

		// Debounced Save - verhindert zu häufige Server-Anfragen bei Slider-Bewegung
		this.debouncedSave();
	},

	/**
	 * Debounced Save - sammelt mehrere Änderungen und speichert verzögert
	 * Optimiert: Prüft auf Änderungen bevor gespeichert wird
	 */
	debouncedSave() {
		// Lösche vorherigen Timeout
		if (this.saveTimeout) {
			clearTimeout(this.saveTimeout);
		}

		// Setze neuen Timeout für verzögerte Speicherung
		this.saveTimeout = setTimeout(() => {
			// Prüfe vor dem Speichern ob sich wirklich etwas geändert hat
			if (this.hasSettingsChanged()) {
				console.log("🔄 Einstellungen haben sich geändert, speichere...");
				this.saveToServer();
			} else {
				console.log("⏸️ Keine Änderungen erkannt, überspringe Speicherung");
			}
		}, 1000); // 1 Sekunde Verzögerung für bessere Performance
	},

	/**
	 * Prüft ob sich Einstellungen tatsächlich geändert haben
	 */
	hasSettingsChanged() {
		// Speichere die letzten gespeicherten Werte für Vergleich
		if (!this.lastSavedSettings) {
			this.lastSavedSettings = { ...this.current };
			return true; // Erste Speicherung
		}

		// Vergleiche aktuelle UI-Werte mit letzten gespeicherten Werten
		this.collectFromUI();

		const currentSettings = { ...this.current };
		const lastSettings = this.lastSavedSettings;

		// Deep comparison der wichtigsten Einstellungen
		const hasChanged =
			currentSettings.tilesCount !== lastSettings.tilesCount ||
			currentSettings.secondaryTilesCount !==
				lastSettings.secondaryTilesCount ||
			currentSettings.layout !== lastSettings.layout ||
			currentSettings.darkMode !== lastSettings.darkMode ||
			currentSettings.viewMode !== lastSettings.viewMode ||
			currentSettings.zoomLevel !== lastSettings.zoomLevel ||
			currentSettings.showWeatherWidget !== lastSettings.showWeatherWidget ||
			currentSettings.showTimeWidget !== lastSettings.showTimeWidget;

		if (hasChanged) {
			console.log("📊 Einstellungsänderung erkannt:", {
				vorher: lastSettings,
				nachher: currentSettings,
			});
			this.lastSavedSettings = { ...currentSettings };
		}

		return hasChanged;
	},

	/**
	 * Debug-Funktion: Zeigt aktuellen Status der Display Options
	 */
	debugStatus() {
		console.log("🎛️ === DISPLAY OPTIONS DEBUG ===");
		console.log("Aktuelle Werte:", this.current);
		console.log("Letzte gespeicherte Werte:", this.lastSavedSettings);
		console.log("Ist Loading:", this.isLoading);
		console.log("Ist Saving:", this.isSaving);
		console.log("Save Timeout aktiv:", !!this.saveTimeout);
		console.log("Haben sich Werte geändert:", this.hasSettingsChanged());
		console.log("=== END DEBUG ===");
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

		// console.log(`📦 Fallback: ${targetCount} primäre Kacheln angezeigt`);
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

		// console.log(`📦 Fallback: ${targetCount} sekundäre Kacheln verwaltet`);
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

		// console.log(`➕ ${targetCount - currentCount} sekundäre Kacheln erstellt`);
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
		// console.log("🚨 Starte Notfall-Layout-Reparatur...");

		// Fallback CSS direkt setzen falls Tailwind fehlt
		if (typeof tailwind === "undefined") {
			// console.log("⚠️ Tailwind CSS nicht verfügbar - verwende Fallback-Styles");
			this.injectFallbackCSS();
		}

		// Sekundäre Kacheln reparieren
		const secondaryGrid = document.getElementById("secondaryHangarGrid");
		if (secondaryGrid && secondaryGrid.children.length === 0) {
			// console.log("🔧 Repariere fehlende sekundäre Kacheln...");
			this.fallbackUpdateSecondaryTiles();
		}

		// UI-Felder auf korrekte Werte setzen
		this.forceUpdateUI();

		// console.log("✅ Notfall-Layout-Reparatur abgeschlossen");
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
				border: 1px solid #d5db;
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
			// console.log("💡 Fallback-CSS injiziert");
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

		// console.log("🔄 UI-Werte forciert angewendet");
	},

	/**
	 * Performance-Monitoring für Display Options
	 */
	getPerformanceStats() {
		return {
			isLoading: this.isLoading,
			isSaving: this.isSaving,
			saveTimeout: !!this.saveTimeout,
			lastSaveAttempt: this.lastSaveAttempt || "nie",
			current: this.current,
		};
	},

	/**
	 * Flush pending changes immediately (used on navigation)
	 */
	flushSave() {
		try {
			this.collectFromUI();
			this.saveToLocalStorage();
			this.lastSavedSettings = { ...this.current };
		} catch (e) { /* noop */ }
	},

	/**
	 * Handler to flush before unload/pagehide
	 */
	onBeforeUnload() {
		this.flushSave();
	},
};

// Globale Notfall-Reparatur-Funktion
window.emergencyRepair = {
	fullRepair() {
		// console.log("🚨 NOTFALL-REPARATUR: Repariere alle kritischen Funktionen");

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

		// console.log("✅ Notfall-Reparatur abgeschlossen");
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

		// console.log("🔧 Kritische Funktionen global verfügbar gemacht");

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
			// console.log("✅ Alle kritischen Funktionen sind verfügbar");
		}
	},
};

// Global verfügbare Debug-Funktionen für Display Options
window.debugDisplayOptions = function () {
	if (window.displayOptions) {
		window.displayOptions.debugStatus();
	} else {
		console.log("❌ Display Options nicht verfügbar");
	}
};

// Hilfsfunktion um manuell Einstellungen zu testen
window.testDisplayOptionsSave = function () {
	if (window.displayOptions) {
		console.log("🧪 Teste Display Options Speicherung...");
		window.displayOptions.debouncedSave();
	} else {
		console.log("❌ Display Options nicht verfügbar");
	}
};

// *** ZENTRALE INITIALISIERUNG STATT SEPARATER DOMContentLoaded ***
// Verwende zentrale Initialisierungsqueue statt separate DOMContentLoaded Events
window.hangarInitQueue = window.hangarInitQueue || [];
window.hangarInitQueue.push(async function () {
	console.log(
		"🎛️ Display Options werden über zentrale Initialisierung gestartet..."
	);

	if (window.displayOptions) {
		await window.displayOptions.init();

		// Stelle sicher, dass Secondary Tiles auf Startwert 4 stehen
		if (window.displayOptions.current.secondaryTilesCount === 0) {
			window.displayOptions.current.secondaryTilesCount = 4;
			console.log("🔧 Secondary Tiles Startwert auf 4 korrigiert");
		}

		window.displayOptions.updateUI();
		window.displayOptions.applySettings();

		// Notfall-Layout-Reparatur
		if (window.displayOptions.emergencyLayoutRepair) {
			window.displayOptions.emergencyLayoutRepair();
		}
	}
});

// Weitere Reparatur nach längerer Verzögerung falls immer noch Probleme
setTimeout(() => {
	if (window.displayOptions && window.displayOptions.emergencyLayoutRepair) {
		window.displayOptions.emergencyLayoutRepair();
	}
}, 3000);

// Notfall-Reparatur automatisch nach 5 Sekunden falls Layout kaputt
setTimeout(() => {
	const grid = document.getElementById("secondaryHangarGrid");
	if (grid && grid.children.length === 0) {
		console.warn("⚠️ Layout-Problem erkannt, starte automatische Reparatur");
		if (window.emergencyRepair && window.emergencyRepair.fullRepair) {
			window.emergencyRepair.fullRepair();
		}
	}
}, 5000);

