/**
 * localStorage-migration.js
 * Migriert alte localStorage-Einstellungen zum neuen data.json System
 * und bereinigt nicht mehr benötigte localStorage-Einträge
 */

window.localStorageMigration = {
	/**
	 * Führt die Migration von localStorage zu data.json durch
	 */
	async migrate() {
		console.log("🔄 Migration von localStorage zu data.json startet...");

		try {
			// 1. Prüfe, ob alte localStorage-Daten vorhanden sind
			const oldSettings = this.getOldSettings();

			if (oldSettings) {
				console.log(
					"📦 Alte localStorage-Einstellungen gefunden:",
					oldSettings
				);

				// 2. Übertrage zu neuem Display Options System
				await this.transferToDisplayOptions(oldSettings);

				// 3. Bereinige alte localStorage-Einträge
				this.cleanupOldStorage();

				console.log("✅ Migration erfolgreich abgeschlossen");
				return true;
			} else {
				console.log(
					"ℹ️ Keine alte localStorage-Daten gefunden - Migration nicht nötig"
				);
				return false;
			}
		} catch (error) {
			console.error("❌ Fehler bei der Migration:", error);
			return false;
		}
	},

	/**
	 * Holt alte Einstellungen aus localStorage
	 */
	getOldSettings() {
		try {
			const oldSettingsJSON = localStorage.getItem("hangarPlannerSettings");
			if (oldSettingsJSON) {
				return JSON.parse(oldSettingsJSON);
			}
		} catch (error) {
			console.warn("⚠️ Fehler beim Lesen alter localStorage-Daten:", error);
		}
		return null;
	},

	/**
	 * Überträgt alte Einstellungen zum neuen Display Options System
	 */
	async transferToDisplayOptions(oldSettings) {
		if (window.displayOptions) {
			// Übertrage die Werte
			const newSettings = {
				tilesCount: oldSettings.tilesCount || 8,
				secondaryTilesCount: oldSettings.secondaryTilesCount || 4,
				layout: oldSettings.layout || 4,
				darkMode: oldSettings.darkMode || false,
				viewMode: oldSettings.tableView || false,
				zoomLevel: oldSettings.zoomLevel || 100,
			};

			// Setze die Werte im neuen System
			window.displayOptions.current = {
				...window.displayOptions.defaults,
				...newSettings,
			};

			// UI aktualisieren
			window.displayOptions.updateUI();

			// Auf Server speichern
			await window.displayOptions.saveToServer();

			console.log("📤 Einstellungen erfolgreich übertragen:", newSettings);
		}
	},

	/**
	 * Bereinigt alte localStorage-Einträge
	 */
	cleanupOldStorage() {
		const keysToRemove = [
			"hangarPlannerSettings",
			"hangarPlannerData", // Falls vorhanden
			"sidebarCollapsed", // Wird in debug-helpers.js verwendet, aber könnte auch migriert werden
			"debugMode", // Wird in debug-helpers.js verwendet
		];

		keysToRemove.forEach((key) => {
			if (localStorage.getItem(key)) {
				console.log(`🗑️ Entferne alten localStorage-Eintrag: ${key}`);
				localStorage.removeItem(key);
			}
		});
	},

	/**
	 * Warnt vor der Verwendung veralteter localStorage-Funktionen
	 */
	warnAboutDeprecatedUsage() {
		// Überwache localStorage.setItem Aufrufe für 'hangarPlannerSettings'
		const originalSetItem = localStorage.setItem;
		localStorage.setItem = function (key, value) {
			if (key === "hangarPlannerSettings") {
				console.warn(
					'⚠️ DEPRECATED: localStorage.setItem("hangarPlannerSettings") ist veraltet. Verwende window.displayOptions stattdessen.'
				);
				console.trace("Aufgerufen von:");
			}
			return originalSetItem.apply(this, arguments);
		};

		// Überwache localStorage.getItem Aufrufe für 'hangarPlannerSettings'
		const originalGetItem = localStorage.getItem;
		localStorage.getItem = function (key) {
			if (key === "hangarPlannerSettings") {
				console.warn(
					'⚠️ DEPRECATED: localStorage.getItem("hangarPlannerSettings") ist veraltet. Verwende window.displayOptions stattdessen.'
				);
				console.trace("Aufgerufen von:");
			}
			return originalGetItem.apply(this, arguments);
		};
	},
};

// Migration beim Laden der Seite ausführen
document.addEventListener("DOMContentLoaded", async () => {
	// Warte darauf, dass displayOptions initialisiert ist
	if (window.displayOptions) {
		await window.localStorageMigration.migrate();
	} else {
		// Falls displayOptions noch nicht geladen ist, warte kurz
		setTimeout(async () => {
			if (window.displayOptions) {
				await window.localStorageMigration.migrate();
			}
		}, 1000);
	}

	// Aktiviere Deprecated-Warnungen in Development-Modus
	if (
		window.location.hostname === "localhost" ||
		window.location.hostname === "127.0.0.1"
	) {
		window.localStorageMigration.warnAboutDeprecatedUsage();
	}
});
