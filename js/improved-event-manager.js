/**
 * VERBESSERTER ZENTRALER EVENT-MANAGER
 * Löst alle identifizierten Funktionskonflikte
 * Version: 2.0 - Konfliktbereinigt
 */

class HangarEventManager {
	constructor() {
		this.initialized = false;
		this.registeredHandlers = new Map(); // Tracking aller Handler
		this.storageQueue = []; // Queue für localStorage-Operationen
		this.isProcessingStorage = false;
		this.debounceTimers = new Map();

		// Singleton-Pattern
		if (HangarEventManager.instance) {
			return HangarEventManager.instance;
		}
		HangarEventManager.instance = this;
	}

	/**
	 * SICHERE EVENT-HANDLER-REGISTRIERUNG
	 * Verhindert Mehrfachregistrierung automatisch
	 */
	safeAddEventListener(element, eventType, handler, handlerName = null) {
		if (!element || typeof handler !== "function") {
			console.warn("❌ Ungültige Event-Handler-Parameter:", {
				element,
				eventType,
				handler,
			});
			return false;
		}

		const elementId =
			element.id ||
			element.tagName + "_" + Math.random().toString(36).substr(2, 9);
		const key = `${elementId}_${eventType}_${handlerName || "anonymous"}`;

		// Bestehenden Handler entfernen, falls vorhanden
		if (this.registeredHandlers.has(key)) {
			const oldHandler = this.registeredHandlers.get(key);
			element.removeEventListener(eventType, oldHandler);
		}

		// Neuen Handler registrieren
		element.addEventListener(eventType, handler);
		this.registeredHandlers.set(key, handler);

		return true;
	}

	/**
	 * ZENTRALISIERTE LOCALSTORAGE-OPERATIONEN
	 * Verhindert Race Conditions durch Queueing
	 */
	async saveToStorage(key, data, priority = "normal") {
		return new Promise((resolve, reject) => {
			const operation = {
				type: "save",
				key,
				data,
				priority,
				resolve,
				reject,
				timestamp: Date.now(),
			};

			if (priority === "high") {
				this.storageQueue.unshift(operation);
			} else {
				this.storageQueue.push(operation);
			}

			this.processStorageQueue();
		});
	}

	async loadFromStorage(key) {
		return new Promise((resolve, reject) => {
			const operation = {
				type: "load",
				key,
				resolve,
				reject,
				timestamp: Date.now(),
			};

			this.storageQueue.push(operation);
			this.processStorageQueue();
		});
	}

	async processStorageQueue() {
		if (this.isProcessingStorage || this.storageQueue.length === 0) {
			return;
		}

		this.isProcessingStorage = true;

		while (this.storageQueue.length > 0) {
			const operation = this.storageQueue.shift();

			try {
				if (operation.type === "save") {
					localStorage.setItem(operation.key, JSON.stringify(operation.data));
					operation.resolve(true);
				} else if (operation.type === "load") {
					const data = localStorage.getItem(operation.key);
					operation.resolve(data ? JSON.parse(data) : null);
				}
			} catch (error) {
				console.error("localStorage-Operation fehlgeschlagen:", error);
				operation.reject(error);
			}

			// Kleine Pause zwischen Operationen
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		this.isProcessingStorage = false;
	}

	/**
	 * DEBOUNCED FIELD UPDATES
	 * Verhindert zu häufige localStorage-Updates
	 */
	debouncedFieldUpdate(fieldId, value, delay = 500) {
		// Bestehenden Timer löschen
		if (this.debounceTimers.has(fieldId)) {
			clearTimeout(this.debounceTimers.get(fieldId));
		}

		// Neuen Timer setzen
		const timer = setTimeout(async () => {
			await this.updateFieldInStorage(fieldId, value);
			this.debounceTimers.delete(fieldId);
		}, delay);

		this.debounceTimers.set(fieldId, timer);
	}

	async updateFieldInStorage(fieldId, value) {
		try {
			// 1. Lokale Speicherung
			const existing = (await this.loadFromStorage("hangarPlannerData")) || {};
			existing[fieldId] = value;
			existing.lastModified = new Date().toISOString();

			await this.saveToStorage("hangarPlannerData", existing);

			// 2. DIREKTE Server-Synchronisation
			await this.syncFieldToServer(fieldId, value);
		} catch (error) {
			console.error("Fehler beim Speichern von Feld:", fieldId, error);
		}
	}

	/**
	 * Direkte Server-Synchronisation für einzelne Felder
	 */
	async syncFieldToServer(fieldId, value) {
		try {
			// Prüfe ob Server-Sync verfügbar ist
			if (!window.storageBrowser || !window.storageBrowser.serverSyncUrl) {
				console.warn(
					"⚠️ Server-Sync nicht konfiguriert - nur lokale Speicherung"
				);
				return;
			}

			// Sammle alle aktuellen Daten für vollständige Server-Synchronisation
			let allData = null;
			if (
				window.hangarData &&
				typeof window.hangarData.collectAllHangarData === "function"
			) {
				allData = window.hangarData.collectAllHangarData();
			} else {
				// Fallback: Erweiterte Datensammlung für sekundäre Tiles
				const primaryFields = this.collectFieldsFromContainer(
					"hangarGrid",
					false
				);
				const secondaryFields = this.collectFieldsFromContainer(
					"secondaryHangarGrid",
					true
				);

				allData = {
					metadata: {
						lastModified: new Date().toISOString(),
						projectName:
							document.getElementById("projectName")?.value || "HangarPlan",
						syncTriggeredBy: fieldId,
						version: "2.0-enhanced",
					},
					settings: {
						tilesCount:
							parseInt(document.getElementById("tilesCount")?.value) || 8,
						secondaryTilesCount:
							parseInt(document.getElementById("secondaryTilesCount")?.value) ||
							0,
						layout: parseInt(document.getElementById("layoutType")?.value) || 4,
					},
					primaryTiles: primaryFields,
					secondaryTiles: secondaryFields,
					fieldUpdates: {
						[fieldId]: value,
					},
					// Sammle alle aktuell sichtbaren Felder
					currentFields: this.collectAllVisibleFields(),
				};
			}

			// Server-Request mit allen Daten
			const response = await fetch(window.storageBrowser.serverSyncUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(allData),
			});

			if (response.ok) {
				const result = await response.json();
			} else {
				console.warn(
					`⚠️ Server-Sync fehlgeschlagen für ${fieldId}:`,
					response.status,
					await response.text()
				);
			}
		} catch (error) {
			console.error(`❌ Server-Sync Fehler für ${fieldId}:`, error);
		}
	}

	/**
	 * Sammelt Felder aus einem bestimmten Container
	 */
	collectFieldsFromContainer(containerId, isSecondary = false) {
		const container = document.getElementById(containerId);
		if (!container) {
			console.warn(`⚠️ Container ${containerId} nicht gefunden`);
			return [];
		}

		const tiles = [];
		const selectors = [
			'input[id^="aircraft-"]',
			'input[id^="arrival-time-"]',
			'input[id^="departure-time-"]',
			'input[id^="position-"]',
			'input[id^="hangar-position-"]',
			'textarea[id^="notes-"]',
			'select[id^="status-"]',
			'select[id^="tow-status-"]',
		];

		// Sammle alle relevanten Elemente aus diesem Container
		const containerFields = {};
		selectors.forEach((selector) => {
			const elements = container.querySelectorAll(selector);
			elements.forEach((element) => {
				if (element.id && element.value !== undefined) {
					const cellId = this.extractCellIdFromElement(element);
					if (cellId && (isSecondary ? cellId >= 101 : cellId < 101)) {
						containerFields[element.id] = element.value;
					}
				}
			});
		});

		// Gruppiere Felder nach Tile-ID
		const tileGroups = {};
		Object.entries(containerFields).forEach(([fieldId, value]) => {
			const cellId = this.extractCellIdFromElement({ id: fieldId });
			if (cellId) {
				if (!tileGroups[cellId]) {
					tileGroups[cellId] = { tileId: cellId };
				}

				if (fieldId.includes("aircraft-")) {
					tileGroups[cellId].aircraftId = value;
				} else if (
					fieldId.includes("position-") ||
					fieldId.includes("hangar-position-")
				) {
					tileGroups[cellId].position = value;
				} else if (fieldId.includes("notes-")) {
					tileGroups[cellId].notes = value;
				} else if (fieldId.includes("arrival-time-")) {
					tileGroups[cellId].arrivalTime = value;
				} else if (fieldId.includes("departure-time-")) {
					tileGroups[cellId].departureTime = value;
				} else if (fieldId.includes("status-")) {
					tileGroups[cellId].status = value;
				} else if (fieldId.includes("tow-status-")) {
					tileGroups[cellId].towStatus = value;
				}
			}
		});

		const tilesArray = Object.values(tileGroups);
		return tilesArray;
	}

	/**
	 * Sammelt alle sichtbaren Feldwerte
	 */
	collectAllVisibleFields() {
		const fields = {};

		// Alle relevanten Felder durchgehen
		const selectors = [
			'input[id^="aircraft-"]',
			'input[id^="arrival-time-"]',
			'input[id^="departure-time-"]',
			'input[id^="position-"]',
			'input[id^="hangar-position-"]',
			'textarea[id^="notes-"]',
			'select[id^="status-"]',
			'select[id^="tow-status-"]',
		];

		selectors.forEach((selector) => {
			document.querySelectorAll(selector).forEach((element) => {
				if (element.id && element.value !== undefined) {
					fields[element.id] = element.value;
				}
			});
		});

		return fields;
	}

	/**
	 * API-Aufruf-Konsolidierung
	 * Alle API-Aufrufe über zentrale Fassade
	 */
	async callAPI(method, params = {}) {
		if (window.FlightDataAPI && window.FlightDataAPI[method]) {
			return await window.FlightDataAPI[method](params);
		} else {
			throw new Error(`API-Methode ${method} nicht verfügbar`);
		}
	}

	/**
	 * Initialisierung und Cleanup
	 */
	init() {
		if (this.initialized) {
			console.warn("⚠️ Event-Manager bereits initialisiert");
			return;
		}

		// Bestehende Event-Handler bereinigen
		this.cleanupExistingHandlers();

		// Neue Handler registrieren
		this.setupUnifiedEventHandlers();

		this.initialized = true;
	}

	cleanupExistingHandlers() {
		// Alle registrierten Handler entfernen
		this.registeredHandlers.forEach((handler, key) => {
			const [elementId, eventType] = key.split("_");
			const element = document.getElementById(elementId);
			if (element) {
				element.removeEventListener(eventType, handler);
			}
		});

		this.registeredHandlers.clear();
	}

	setupUnifiedEventHandlers() {
		// Unified Input Handler für alle relevanten Felder
		const relevantSelectors = [
			'input[id^="aircraft-"]', // Aircraft ID Felder
			'input[id^="arrival-time-"]', // Ankunftszeit Felder
			'input[id^="departure-time-"]', // Abflugzeit Felder
			'input[id^="position-"]', // Position Felder
			'input[id^="hangar-position-"]', // Hangar Position Felder
			'textarea[id^="notes-"]', // Notizen Felder
			'select[id^="status-"]', // Status Dropdowns
			'select[id^="tow-status-"]', // Tow Status Dropdowns
			'input[type="text"][class*="aircraft"]', // Felder mit aircraft CSS-Klasse
			'input[type="text"][class*="position"]', // Felder mit position CSS-Klasse
			'textarea[class*="notes"]', // Notiz-Textareas mit CSS-Klasse
		];

		// Container-spezifische Registrierung
		const primaryContainer = document.getElementById("hangarGrid");
		const secondaryContainer = document.getElementById("secondaryHangarGrid");

		let handlersRegistered = 0;

		// Event-Handler für primäre Container registrieren
		if (primaryContainer) {
			relevantSelectors.forEach((selector) => {
				const elements = primaryContainer.querySelectorAll(selector);
				elements.forEach((element) => {
					// Prüfe ob Element wirklich im primären Container und primäre ID hat
					const cellId = this.extractCellIdFromElement(element);
					if (cellId && cellId < 101 && primaryContainer.contains(element)) {
						if (this.registerHandlerForElement(element, "primary")) {
							handlersRegistered++;
						}
					}
				});
			});
		}

		// Event-Handler für sekundäre Container registrieren
		if (secondaryContainer) {
			relevantSelectors.forEach((selector) => {
				const elements = secondaryContainer.querySelectorAll(selector);
				elements.forEach((element) => {
					// Prüfe ob Element wirklich im sekundären Container und sekundäre ID hat
					const cellId = this.extractCellIdFromElement(element);
					if (cellId && cellId >= 101 && secondaryContainer.contains(element)) {
						if (this.registerHandlerForElement(element, "secondary")) {
							handlersRegistered++;
						}
					}
				});
			});
		}

		// Zusätzlich: MutationObserver für dynamisch hinzugefügte Felder
		this.setupMutationObserver();
	}

	/**
	 * Registriert Handler für ein einzelnes Element
	 */
	registerHandlerForElement(element, containerType) {
		if (!element || !element.id) return false;

		const elementId = element.id;
		const cellId = this.extractCellIdFromElement(element);

		// Prüfe Container-Kontext für korrekte ID-Zuordnung
		if (containerType === "secondary" && cellId < 101) {
			console.warn(
				`⚠️ Sekundäres Element ${elementId} hat primäre ID ${cellId} - überspringe`
			);
			return false;
		}
		if (containerType === "primary" && cellId >= 101) {
			console.warn(
				`⚠️ Primäres Element ${elementId} hat sekundäre ID ${cellId} - überspringe`
			);
			return false;
		}

		// Input Event (während der Eingabe)
		this.safeAddEventListener(
			element,
			"input",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				this.debouncedFieldUpdate(event.target.id, event.target.value);
			},
			`${containerType}_input`
		);

		// Blur Event (wenn Feld verlassen wird)
		this.safeAddEventListener(
			element,
			"blur",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				this.debouncedFieldUpdate(event.target.id, event.target.value, 100);
			},
			`${containerType}_blur`
		);

		// Change Event (für Dropdowns)
		this.safeAddEventListener(
			element,
			"change",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				this.debouncedFieldUpdate(event.target.id, event.target.value, 50);
			},
			`${containerType}_change`
		);

		return true;
	}

	/**
	 * Extrahiert Cell-ID aus Element-ID
	 */
	extractCellIdFromElement(element) {
		if (!element.id) return null;

		const patterns = [
			/^aircraft-(\d+)$/,
			/^hangar-position-(\d+)$/,
			/^position-(\d+)$/,
			/^arrival-time-(\d+)$/,
			/^departure-time-(\d+)$/,
			/^notes-(\d+)$/,
			/^status-(\d+)$/,
			/^tow-status-(\d+)$/,
		];

		for (const pattern of patterns) {
			const match = element.id.match(pattern);
			if (match) {
				return parseInt(match[1]);
			}
		}

		return null;
	}

	/**
	 * MutationObserver für dynamisch hinzugefügte Felder
	 */
	setupMutationObserver() {
		const observer = new MutationObserver((mutations) => {
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => {
					if (node.nodeType === Node.ELEMENT_NODE) {
						// Prüfe auf neue Input-Felder
						const newInputs = node.querySelectorAll
							? node.querySelectorAll("input, textarea, select")
							: [];

						newInputs.forEach((input) => {
							if (this.isRelevantField(input)) {
								// Bestimme Container-Typ
								const primaryContainer = document.getElementById("hangarGrid");
								const secondaryContainer = document.getElementById(
									"secondaryHangarGrid"
								);

								let containerType = "unknown";
								if (primaryContainer && primaryContainer.contains(input)) {
									containerType = "primary";
								} else if (
									secondaryContainer &&
									secondaryContainer.contains(input)
								) {
									containerType = "secondary";
								}

								this.attachEventHandlersToElement(input, containerType);
							}
						});

						// Zusätzliche Prüfung: Falls ganze Kacheln hinzugefügt wurden
						if (node.classList && node.classList.contains("hangar-cell")) {
							setTimeout(() => {
								// Event-Handler für alle Felder in der neuen Kachel registrieren
								const cellInputs = node.querySelectorAll(
									"input, textarea, select"
								);
								cellInputs.forEach((input) => {
									if (this.isRelevantField(input)) {
										const cellId = this.extractCellIdFromElement(input);
										const containerType =
											cellId >= 101 ? "secondary" : "primary";
										this.attachEventHandlersToElement(input, containerType);
									}
								});
							}, 100);
						}
					}
				});
			});
		});

		// Überwache sowohl Haupt-Container als auch sekundäre Container
		const containersToObserve = ["hangarGrid", "secondaryHangarGrid"];
		containersToObserve.forEach((containerId) => {
			const container = document.getElementById(containerId);
			if (container) {
				observer.observe(container, {
					childList: true,
					subtree: true,
				});
			}
		});

		// Zusätzlich: Überwache Body für größere Strukturänderungen
		observer.observe(document.body, {
			childList: true,
			subtree: true,
		});
	}

	/**
	 * Prüft ob ein Feld für Event-Handling relevant ist
	 */
	isRelevantField(element) {
		const id = element.id;
		const className = element.className;

		return (
			id.startsWith("aircraft-") ||
			id.startsWith("arrival-time-") ||
			id.startsWith("departure-time-") ||
			id.startsWith("position-") ||
			id.startsWith("hangar-position-") ||
			id.startsWith("notes-") ||
			id.startsWith("status-") ||
			id.startsWith("tow-status-") ||
			className.includes("aircraft") ||
			className.includes("position") ||
			className.includes("notes")
		);
	}

	/**
	 * Hängt Event-Handler an ein einzelnes Element an
	 */
	attachEventHandlersToElement(element, containerType = "unknown") {
		const cellId = this.extractCellIdFromElement(element);
		const handlerPrefix = `${containerType}_dynamic_${cellId || "unknown"}`;

		this.safeAddEventListener(
			element,
			"input",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				this.debouncedFieldUpdate(event.target.id, event.target.value);
			},
			`${handlerPrefix}_input`
		);

		this.safeAddEventListener(
			element,
			"blur",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}
				this.debouncedFieldUpdate(event.target.id, event.target.value, 100);
			},
			`${handlerPrefix}_blur`
		);

		this.safeAddEventListener(
			element,
			"change",
			(event) => {
				if (window.isApplyingServerData) {
					return;
				}

				// Spezielle Behandlung für Status-Felder
				if (
					event.target.id.startsWith("status-") &&
					cellId &&
					window.updateStatusLights
				) {
					window.updateStatusLights(cellId);
				}

				this.debouncedFieldUpdate(event.target.id, event.target.value, 50);
			},
			`${handlerPrefix}_change`
		);
	}

	/**
	 * Debugging und Monitoring
	 */
	getStatus() {
		return {
			initialized: this.initialized,
			registeredHandlers: this.registeredHandlers.size,
			storageQueueLength: this.storageQueue.length,
			activeDebounceTimers: this.debounceTimers.size,
			isProcessingStorage: this.isProcessingStorage,
		};
	}

	destroy() {
		this.cleanupExistingHandlers();
		this.debounceTimers.forEach((timer) => clearTimeout(timer));
		this.debounceTimers.clear();
		this.storageQueue.length = 0;
		this.initialized = false;
	}
}

// Globale Instanz erstellen
window.hangarEventManager = new HangarEventManager();

// Auto-Initialization
document.addEventListener("DOMContentLoaded", () => {
	setTimeout(() => {
		window.hangarEventManager.init();
	}, 1000);
});

// Für Debugging
window.getEventManagerStatus = () => window.hangarEventManager.getStatus();
