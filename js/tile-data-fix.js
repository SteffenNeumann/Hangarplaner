/**
 * TILE-DATA-FIX: Rekursive Problembehebung für Inner/Outer Tile Synchronisation
 * Löst Container-Mapping, Event-Handler und Server-Sync Probleme
 */

class TileDataFix {
	constructor() {
		this.debugMode = true;
		this.fixApplied = false;
		this.eventHandlersRegistered = new Set();
	}

	/**
	 * HAUPTFUNKTION: Vollständige Problembehebung
	 */
	async applyCompleteFix() {
		console.log("🔧 === TILE-DATA-FIX GESTARTET ===");

		try {
			// 1. Event-Handler für sekundäre Tiles reparieren
			this.fixSecondaryTileEventHandlers();

			// 2. Container-Mapping korrigieren
			this.fixContainerMapping();

			// 3. Datensammlung verbessern
			this.enhanceDataCollection();

			// 4. Server-Sync Timing optimieren
			this.optimizeServerSyncTiming();

			// 5. Validierung aller Fixes
			await this.validateFixes();

			this.fixApplied = true;
			console.log("✅ === ALLE FIXES ERFOLGREICH ANGEWENDET ===");
		} catch (error) {
			console.error("❌ Fehler beim Anwenden der Fixes:", error);
		}
	}

	/**
	 * FIX 1: Event-Handler für sekundäre Tiles
	 */
	fixSecondaryTileEventHandlers() {
		console.log("🔧 Fix 1: Event-Handler für sekundäre Tiles...");

		// Warte bis sekundäre Tiles existieren
		const setupSecondaryHandlers = () => {
			const secondaryContainer = document.querySelector("#secondaryHangarGrid");
			if (!secondaryContainer) {
				console.log("⏳ Warte auf sekundäre Container...");
				setTimeout(setupSecondaryHandlers, 500);
				return;
			}

			// Sammle alle sekundären Tile IDs (101, 102, 103, 104...)
			const secondaryTiles =
				secondaryContainer.querySelectorAll(".hangar-cell");

			secondaryTiles.forEach((cell, index) => {
				const tileId = 101 + index; // Sekundäre IDs starten bei 101

				this.registerTileEventHandlers(tileId, true);
			});

			console.log(
				`✅ Event-Handler für ${secondaryTiles.length} sekundäre Tiles registriert`
			);
		};

		setupSecondaryHandlers();
	}

	/**
	 * Registriert Event-Handler für eine einzelne Tile
	 */
	registerTileEventHandlers(tileId, isSecondary = false) {
		const fields = [
			`aircraft-${tileId}`,
			`arrival-time-${tileId}`,
			`departure-time-${tileId}`,
			`position-${tileId}`,
			`hangar-position-${tileId}`,
			`notes-${tileId}`,
			`status-${tileId}`,
			`tow-status-${tileId}`,
		];

		fields.forEach((fieldId) => {
			const element = document.getElementById(fieldId);
			if (element && !this.eventHandlersRegistered.has(fieldId)) {
				// Input Event für sofortige Reaktion
				element.addEventListener("input", (event) => {
					this.handleTileFieldChange(event, tileId, isSecondary);
				});

				// Blur Event für finale Speicherung
				element.addEventListener("blur", (event) => {
					this.handleTileFieldBlur(event, tileId, isSecondary);
				});

				this.eventHandlersRegistered.add(fieldId);

				if (this.debugMode) {
					console.log(
						`📎 Event-Handler registriert: ${fieldId} (${
							isSecondary ? "sekundär" : "primär"
						})`
					);
				}
			}
		});
	}

	/**
	 * Handler für Feld-Änderungen
	 */
	handleTileFieldChange(event, tileId, isSecondary) {
		const fieldId = event.target.id;
		const value = event.target.value;

		if (this.debugMode) {
			console.log(
				`🔄 Feld geändert: ${fieldId} = "${value}" (Tile ${tileId}, ${
					isSecondary ? "sekundär" : "primär"
				})`
			);
		}

		// Sofortige lokale Speicherung
		this.saveFieldValueLocally(fieldId, value, tileId, isSecondary);

		// Debounced Server-Sync
		this.debouncedServerSync();
	}

	/**
	 * Handler für Feld-Verlassen (Blur)
	 */
	handleTileFieldBlur(event, tileId, isSecondary) {
		const fieldId = event.target.id;
		const value = event.target.value;

		if (this.debugMode) {
			console.log(
				`💾 Feld finalisiert: ${fieldId} = "${value}" (Tile ${tileId})`
			);
		}

		// Finale Speicherung
		this.saveFieldValueLocally(fieldId, value, tileId, isSecondary);

		// Sofortiger Server-Sync bei Blur
		this.triggerServerSync();
	}

	/**
	 * FIX 2: Container-Mapping korrigieren
	 */
	fixContainerMapping() {
		console.log("🔧 Fix 2: Container-Mapping korrigieren...");

		// Globale Funktion für sichere Container-Erkennung
		window.getTileContainer = (tileId) => {
			const isSecondary = tileId >= 101;
			const containerSelector = isSecondary
				? "#secondaryHangarGrid"
				: "#hangarGrid";
			const container = document.querySelector(containerSelector);

			return {
				container,
				containerSelector,
				isSecondary,
				exists: !!container,
			};
		};

		// Verbesserte Container-Validierung
		window.validateTileInContainer = (tileId, elementId) => {
			const { container, isSecondary } = window.getTileContainer(tileId);
			const element = document.getElementById(elementId);

			if (!container || !element) {
				return false;
			}

			const isInCorrectContainer = container.contains(element);

			if (!isInCorrectContainer && this.debugMode) {
				console.warn(
					`⚠️ Element ${elementId} ist NICHT im erwarteten Container (${
						isSecondary ? "sekundär" : "primär"
					})`
				);
			}

			return isInCorrectContainer;
		};

		console.log("✅ Container-Mapping-Funktionen installiert");
	}

	/**
	 * FIX 3: Verbesserte Datensammlung
	 */
	enhanceDataCollection() {
		console.log("🔧 Fix 3: Datensammlung verbessern...");

		// Patch hangarData.collectAllHangarData mit verbesserter Logik
		if (window.hangarData && window.hangarData.collectAllHangarData) {
			const originalCollectAll = window.hangarData.collectAllHangarData.bind(
				window.hangarData
			);

			window.hangarData.collectAllHangarData = () => {
				try {
					const result = originalCollectAll();

					// Zusätzliche Validierung und Logging
					if (result) {
						console.log(
							`📊 Datensammlung: ${result.primaryTiles?.length || 0} primär, ${
								result.secondaryTiles?.length || 0
							} sekundär`
						);

						// Debug-Output für leere Tiles
						this.debugEmptyTiles(result);
					}

					return result;
				} catch (error) {
					console.error("❌ Fehler in verbesserter Datensammlung:", error);
					return originalCollectAll(); // Fallback
				}
			};
		}

		console.log("✅ Datensammlung-Patches angewendet");
	}

	/**
	 * FIX 4: Server-Sync Timing optimieren
	 */
	optimizeServerSyncTiming() {
		console.log("🔧 Fix 4: Server-Sync Timing optimieren...");

		// Verbesserte applyServerData Funktion
		if (window.serverSync && window.serverSync.applyServerData) {
			const originalApplyServerData = window.serverSync.applyServerData.bind(
				window.serverSync
			);

			window.serverSync.applyServerData = async (serverData) => {
				try {
					console.log("📥 Verbesserte Server-Data Anwendung gestartet...");

					// 1. Flag setzen um lokale Updates zu verhindern
					window.isApplyingServerData = true;

					// 2. Event-Handler temporär deaktivieren
					this.temporarilyDisableEventHandlers();

					// 3. Originale Funktion ausführen
					const result = await originalApplyServerData(serverData);

					// 4. Kurz warten damit DOM-Updates abgeschlossen sind
					await new Promise((resolve) => setTimeout(resolve, 100));

					// 5. Event-Handler wieder aktivieren
					this.reEnableEventHandlers();

					// 6. Flag zurücksetzen
					window.isApplyingServerData = false;

					console.log("✅ Verbesserte Server-Data Anwendung abgeschlossen");
					return result;
				} catch (error) {
					console.error(
						"❌ Fehler in verbesserter Server-Data Anwendung:",
						error
					);
					window.isApplyingServerData = false;
					this.reEnableEventHandlers();
					return false;
				}
			};
		}

		console.log("✅ Server-Sync Timing-Patches angewendet");
	}

	/**
	 * Lokale Speicherung für Feld-Werte
	 */
	saveFieldValueLocally(fieldId, value, tileId, isSecondary) {
		try {
			// Erstelle eine lokale Zwischenspeicherung für aktuelle Feldwerte
			let currentFields = JSON.parse(
				localStorage.getItem("hangarplanner_current_fields") || "{}"
			);

			currentFields[fieldId] = {
				value: value,
				tileId: tileId,
				isSecondary: isSecondary,
				timestamp: new Date().toISOString(),
			};

			localStorage.setItem(
				"hangarplanner_current_fields",
				JSON.stringify(currentFields)
			);
		} catch (error) {
			console.warn("⚠️ Lokale Speicherung fehlgeschlagen:", error);
		}
	}

	/**
	 * Debounced Server-Sync
	 */
	debouncedServerSync() {
		clearTimeout(this.serverSyncTimeout);
		this.serverSyncTimeout = setTimeout(() => {
			this.triggerServerSync();
		}, 2000); // 2 Sekunden Delay
	}

	/**
	 * Server-Sync auslösen
	 */
	async triggerServerSync() {
		if (window.isApplyingServerData) {
			console.log("⏸️ Server-Sync übersprungen (Server-Data wird angewendet)");
			return;
		}

		if (
			window.serverSync &&
			typeof window.serverSync.syncWithServer === "function"
		) {
			try {
				console.log("🔄 Trigger Server-Sync...");
				await window.serverSync.syncWithServer();
			} catch (error) {
				console.warn("⚠️ Server-Sync Fehler:", error);
			}
		}
	}

	/**
	 * Event-Handler temporär deaktivieren
	 */
	temporarilyDisableEventHandlers() {
		this.handlersDisabled = true;
		console.log("⏸️ Event-Handler temporär deaktiviert");
	}

	/**
	 * Event-Handler wieder aktivieren
	 */
	reEnableEventHandlers() {
		this.handlersDisabled = false;
		console.log("▶️ Event-Handler wieder aktiviert");
	}

	/**
	 * Debug-Ausgabe für leere Tiles
	 */
	debugEmptyTiles(data) {
		if (!this.debugMode) return;

		// Prüfe primäre Tiles
		if (data.primaryTiles) {
			data.primaryTiles.forEach((tile, index) => {
				if (!tile.aircraftId && !tile.position && !tile.notes) {
					console.log(`🔍 Primäre Tile ${tile.tileId || index + 1} ist leer`);
				}
			});
		}

		// Prüfe sekundäre Tiles
		if (data.secondaryTiles) {
			data.secondaryTiles.forEach((tile, index) => {
				if (!tile.aircraftId && !tile.position && !tile.notes) {
					console.log(
						`🔍 Sekundäre Tile ${tile.tileId || index + 101} ist leer`
					);
				}
			});
		}
	}

	/**
	 * Validierung aller angewendeten Fixes
	 */
	async validateFixes() {
		console.log("🔍 Validiere angewendete Fixes...");

		// Test 1: Event-Handler Registrierung
		const primaryContainer = document.querySelector("#hangarGrid");
		const secondaryContainer = document.querySelector("#secondaryHangarGrid");

		let handlerCount = 0;
		if (primaryContainer) {
			handlerCount +=
				primaryContainer.querySelectorAll(".hangar-cell").length * 8; // 8 Felder pro Tile
		}
		if (secondaryContainer) {
			handlerCount +=
				secondaryContainer.querySelectorAll(".hangar-cell").length * 8;
		}

		console.log(
			`📊 Erwartete Event-Handler: ${handlerCount}, Registriert: ${this.eventHandlersRegistered.size}`
		);

		// Test 2: Container-Mapping
		const mappingFunctionsExist = !!(
			window.getTileContainer && window.validateTileInContainer
		);
		console.log(
			`📊 Container-Mapping Funktionen: ${mappingFunctionsExist ? "✅" : "❌"}`
		);

		// Test 3: Datensammlung
		let dataCollectionWorks = false;
		if (window.hangarData && window.hangarData.collectAllHangarData) {
			try {
				const testData = window.hangarData.collectAllHangarData();
				dataCollectionWorks = !!(
					testData &&
					testData.primaryTiles &&
					testData.secondaryTiles
				);
			} catch (error) {
				console.warn("⚠️ Datensammlung-Test fehlgeschlagen:", error);
			}
		}
		console.log(
			`📊 Datensammlung funktioniert: ${dataCollectionWorks ? "✅" : "❌"}`
		);

		// Test 4: Server-Sync
		const serverSyncPatchApplied =
			window.serverSync &&
			typeof window.serverSync.applyServerData === "function";
		console.log(
			`📊 Server-Sync Patches: ${serverSyncPatchApplied ? "✅" : "❌"}`
		);

		// Gesamtbewertung
		const allTestsPassed =
			this.eventHandlersRegistered.size > 0 &&
			mappingFunctionsExist &&
			dataCollectionWorks &&
			serverSyncPatchApplied;

		console.log(
			`🎯 VALIDIERUNG ${
				allTestsPassed ? "ERFOLGREICH" : "TEILWEISE FEHLGESCHLAGEN"
			}`
		);

		return allTestsPassed;
	}

	/**
	 * Manueller Test für Server-Sync Probleme
	 */
	async runServerSyncTest() {
		console.log("🧪 === SERVER-SYNC TEST GESTARTET ===");

		// 1. Fülle Test-Daten in verschiedene Tiles ein
		const testData = [
			{ tileId: 1, field: "aircraft-1", value: "TEST-INNER-1" },
			{ tileId: 2, field: "position-2", value: "A1-INNER" },
			{ tileId: 101, field: "aircraft-101", value: "TEST-OUTER-1" },
			{ tileId: 102, field: "position-102", value: "B1-OUTER" },
		];

		// Teste Eingaben
		testData.forEach((test) => {
			const element = document.getElementById(test.field);
			if (element) {
				element.value = test.value;
				element.dispatchEvent(new Event("input", { bubbles: true }));
				element.dispatchEvent(new Event("blur", { bubbles: true }));
				console.log(`✅ Test-Eingabe: ${test.field} = "${test.value}"`);
			} else {
				console.warn(`❌ Test-Element nicht gefunden: ${test.field}`);
			}
		});

		// Warte kurz und sammle dann Daten
		setTimeout(() => {
			if (window.hangarData && window.hangarData.collectAllHangarData) {
				const collectedData = window.hangarData.collectAllHangarData();
				console.log("📊 Gesammelte Test-Daten:", collectedData);

				// Validiere ob Test-Daten korrekt gesammelt wurden
				let testsPassed = 0;
				testData.forEach((test) => {
					const isSecondary = test.tileId >= 101;
					const tiles = isSecondary
						? collectedData.secondaryTiles
						: collectedData.primaryTiles;

					const tile = tiles?.find((t) => t.tileId === test.tileId);
					if (tile) {
						const fieldName = test.field.split("-")[0]; // "aircraft" aus "aircraft-1"
						const fieldValue =
							tile[fieldName] || tile.aircraftId || tile.position;

						if (fieldValue === test.value) {
							testsPassed++;
							console.log(`✅ Test bestanden: ${test.field} = "${test.value}"`);
						} else {
							console.warn(
								`❌ Test fehlgeschlagen: ${test.field} erwartet "${test.value}", gefunden "${fieldValue}"`
							);
						}
					} else {
						console.warn(
							`❌ Tile ${test.tileId} nicht in gesammelten Daten gefunden`
						);
					}
				});

				console.log(
					`🎯 TEST ERGEBNIS: ${testsPassed}/${testData.length} Tests bestanden`
				);
			}
		}, 1000);

		console.log("🧪 === SERVER-SYNC TEST BEENDET ===");
	}
}

// Globale Instanz erstellen
window.tileDataFix = new TileDataFix();

// Auto-Fix beim DOM-Load
document.addEventListener("DOMContentLoaded", () => {
	console.log("🚀 TileDataFix Auto-Initialisierung...");

	// Warte bis alle anderen Module geladen sind
	setTimeout(() => {
		window.tileDataFix.applyCompleteFix();
	}, 2000);
});

// Zusätzlicher Fix-Trigger für verspätete Initialisierung
setTimeout(() => {
	if (window.tileDataFix && !window.tileDataFix.fixApplied) {
		console.log("🔄 Verzögerter TileDataFix-Trigger...");
		window.tileDataFix.applyCompleteFix();
	}
}, 5000);

// Debug-Funktionen global verfügbar machen
window.runTileDataTest = () => window.tileDataFix.runServerSyncTest();
window.validateTileFixes = () => window.tileDataFix.validateFixes();

console.log("🔧 === TILE-DATA-FIX GELADEN ===");
console.log("Verwende window.runTileDataTest() für manuelle Tests");
console.log("Verwende window.validateTileFixes() für Fix-Validierung");
