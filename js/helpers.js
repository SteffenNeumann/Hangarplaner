/**
 * helpers.js
 * Enthält allgemeine Hilfsfunktionen für die HangarPlanner-Anwendung
 */

/**
 * Zeigt Benachrichtigungen für den Benutzer an
 * @param {string} message - Die anzuzeigende Nachricht
 * @param {string} type - Der Typ der Nachricht (info, success, error, warning)
 * @param {number} duration - Wie lange die Nachricht angezeigt wird (in ms)
 */
function showNotification(message, type = "info", duration = 3000) {
	// Prüfe, ob bereits eine Benachrichtigung angezeigt wird
	let notification = document.getElementById("notification");
	if (!notification) {
		notification = document.createElement("div");
		notification.id = "notification";
		notification.style.position = "fixed";
		notification.style.bottom = "20px";
		notification.style.right = "20px";
		notification.style.padding = "10px 20px";
		notification.style.borderRadius = "4px";
		notification.style.minWidth = "200px";
		notification.style.maxWidth = "400px";
		notification.style.boxShadow = "0 3px 6px rgba(0,0,0,0.16)";
		notification.style.zIndex = "9999";
		notification.style.transition = "opacity 0.3s";
		document.body.appendChild(notification);
	}

	// Stil basierend auf Typ setzen
	switch (type) {
		case "success":
			notification.style.backgroundColor = "#4CAF50";
			notification.style.color = "#fff";
			break;
		case "error":
			notification.style.backgroundColor = "#F44336";
			notification.style.color = "#fff";
			break;
		case "warning":
			notification.style.backgroundColor = "#FFC107";
			notification.style.color = "#000";
			break;
		default:
			notification.style.backgroundColor = "#2196F3";
			notification.style.color = "#fff";
	}

	notification.textContent = message;
	notification.style.opacity = "1";

	// Nach der angegebenen Zeit ausblenden
	setTimeout(() => {
		notification.style.opacity = "0";
		setTimeout(() => {
			if (notification.parentNode) {
				notification.parentNode.removeChild(notification);
			}
		}, 300);
	}, duration);
}

/**
 * Erstellt einen Zeitstempel für die Benennung von Dateien
 * @returns {string} Formatierter Zeitstempel
 */
function generateTimestamp() {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	const seconds = String(now.getSeconds()).padStart(2, "0");

	return `HangarPlan_${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
}

/**
 * Hilfsfunktion zum Herunterladen einer Datei
 * @param {string|object} content - Dateiinhalt (wird zu JSON konvertiert, wenn es ein Objekt ist)
 * @param {string} filename - Name der Datei
 */
function downloadFile(content, filename) {
	const contentStr =
		typeof content === "object" ? JSON.stringify(content, null, 2) : content;
	const blob = new Blob([contentStr], { type: "application/json" });
	const downloadLink = document.createElement("a");
	downloadLink.href = URL.createObjectURL(blob);
	downloadLink.download = filename;
	document.body.appendChild(downloadLink);
	downloadLink.click();
	document.body.removeChild(downloadLink);
}

/**
 * Überprüft die Browser-Unterstützung für verschiedene APIs
 * @returns {Object} Ein Objekt mit Informationen über unterstützte Features
 */
function checkBrowserSupport() {
	const support = {
		fileSystem: "showSaveFilePicker" in window,
		indexedDB: "indexedDB" in window,
		localStorage: "localStorage" in window,
		permissions: "permissions" in navigator,
	};

	// Browser-API-Unterstützung prüfen

	// Als Meldung anzeigen, wenn Debug aktiviert ist
	if (localStorage.getItem("debugMode") === "true") {
		let message = "Browser-Unterstützung:\n";
		for (const [key, value] of Object.entries(support)) {
			message += `- ${key}: ${value ? "✓" : "✗"}\n`;
		}
		showNotification(message, "info", 5000);

		// Explizit auf localStorage-Unterstützung prüfen
		if (!support.localStorage) {
			showNotification(
				"LocalStorage wird nicht unterstützt! Einstellungen können nicht gespeichert werden.",
				"error",
				10000
			);
		} else {
			// Test-Speichervorgang durchführen
			try {
				localStorage.setItem("test", "test");
				localStorage.removeItem("test");
			} catch (e) {
				showNotification(
					"LocalStorage Test fehlgeschlagen: " + e.message,
					"error",
					10000
				);
			}
		}
	}

	return support;
}

// Funktion für den globalen Zugriff verfügbar machen
window.showNotification = showNotification;

/**
 * Storage Helper für localStorage Operationen
 * Bietet eine einheitliche Schnittstelle für Speicherzugriffe
 */
const storageHelper = {
	/**
	 * Speichert Daten im localStorage
	 * @param {string} key - Schlüssel für die Daten
	 * @param {any} data - Die zu speichernden Daten (werden zu JSON konvertiert)
	 * @returns {boolean} - Gibt an, ob die Speicherung erfolgreich war
	 */
	set: function (key, data) {
		try {
			const jsonData = typeof data === "string" ? data : JSON.stringify(data);
			localStorage.setItem(key, jsonData);
			return true;
		} catch (error) {
			console.error(
				`Fehler beim Speichern von Daten mit Schlüssel "${key}":`,
				error
			);
			return false;
		}
	},

	/**
	 * Lädt Daten aus dem localStorage
	 * @param {string} key - Schlüssel für die Daten
	 * @param {boolean} parseJson - Ob die Daten als JSON geparst werden sollen
	 * @returns {any} - Die geladenen Daten oder null, wenn keine Daten vorhanden
	 */
	get: function (key, parseJson = true) {
		try {
			const data = localStorage.getItem(key);
			if (data === null) return null;
			return parseJson ? JSON.parse(data) : data;
		} catch (error) {
			console.error(
				`Fehler beim Laden von Daten mit Schlüssel "${key}":`,
				error
			);
			return null;
		}
	},

	/**
	 * Löscht Daten aus dem localStorage
	 * @param {string} key - Schlüssel für die zu löschenden Daten
	 * @returns {boolean} - Gibt an, ob das Löschen erfolgreich war
	 */
	remove: function (key) {
		try {
			localStorage.removeItem(key);
			return true;
		} catch (error) {
			console.error(
				`Fehler beim Löschen von Daten mit Schlüssel "${key}":`,
				error
			);
			return false;
		}
	},
};

// Storage Helper zum globalen Hilfsobjekt hinzufügen
window.helpers = window.helpers || {};
window.helpers.storageHelper = storageHelper;

/**
 * Verzögert die Ausführung einer Funktion
 * @param {Function} func - Die zu verzögernde Funktion
 * @param {number} wait - Verzögerung in Millisekunden
 * @returns {Function} - Verzögerte Funktion
 */
function debounce(func, wait) {
	let timeout;
	return function () {
		const context = this;
		const args = arguments;
		clearTimeout(timeout);
		timeout = setTimeout(() => func.apply(context, args), wait);
	};
}

/**
 * Erstellt eine Auto-Save-Funktion mit Debouncing und Änderungsverfolgung
 * @param {Function} saveFunction - Die eigentliche Speicherfunktion
 * @param {Object} options - Konfigurationsoptionen
 * @param {number} options.debounceTime - Verzögerungszeit in ms (Standard: 1000)
 * @param {number} options.maxRetries - Maximale Anzahl von Wiederholungsversuchen (Standard: 3)
 * @param {Function} options.onChange - Optional: Callback-Funktion, die bei Änderungen aufgerufen wird
 * @param {Function} options.compareFunction - Optional: Funktion zum Vergleich von altem und neuem Zustand
 * @param {boolean} options.preserveExisting - Bestehende Daten erhalten und nur neue Felder hinzufügen (Standard: true)
 * @param {boolean} options.forceSyncSave - Erzwingt eine sofortige synchrone Speicherung, ohne Debouncing (Standard: false)
 * @returns {Function} - Eine optimierte Autosave-Funktion
 */
function createAutoSave(saveFunction, options = {}) {
	const {
		debounceTime = 1000,
		maxRetries = 3,
		onChange = null,
		compareFunction = null,
		preserveExisting = true,
		forceSyncSave = false,
	} = options;

	let lastSavedData = null;
	let saveRetryCount = 0;
	let savePending = false;
	let saveQueue = [];

	// Funktion, um die nächste ausstehende Speicherung zu verarbeiten
	const processQueue = () => {
		if (saveQueue.length > 0 && !savePending) {
			const nextData = saveQueue.shift();
			executeSave(nextData);
		}
	};

	/**
	 * Prüft, ob ein Teil der Daten Positionswerte enthält, die spezielle Behandlung benötigen
	 * @param {Object} data - Die zu prüfenden Daten
	 * @returns {boolean} - True, wenn Positionsdaten enthalten sind
	 */
	const hasPositionData = (data) => {
		if (!data || typeof data !== "object") return false;

		// Prüfe auf typische Strukturen von Positionsdaten
		if (data.tileValues && Array.isArray(data.tileValues)) {
			return true;
		}

		// Prüfe auf sekundäre Kacheln mit Positionsangaben
		if (
			Array.isArray(data) &&
			data.some(
				(item) => item && item.position && item.id >= 101 && item.id <= 104
			)
		) {
			return true;
		}

		// Prüfe auf einzelne Positionsfelder
		if (data.position && data.id && data.id >= 101 && data.id <= 104) {
			return true;
		}

		return false;
	};

	/**
	 * Versucht, Positionswerte für sekundäre Kacheln zu setzen
	 * @param {Object} data - Die zu speichernden Daten
	 * @returns {Promise<boolean>} - True, wenn die Werte gesetzt wurden
	 */
	const trySetPositionValues = async (data) => {
		// Extrahiere Positionsdaten, falls vorhanden
		const positions = extractPositions(data);
		if (Object.keys(positions).length === 0) return true;

		// Warten bis DOM bereit ist
		await new Promise((resolve) => {
			// Versuche, die Positionsfelder zu finden und Werte zu setzen
			const maxAttempts = 5;
			let attempts = 0;

			const trySetValues = () => {
				attempts++;
				let allSet = true;

				// Versuche jeden Positionswert zu setzen
				for (const [id, value] of Object.entries(positions)) {
					const fieldId = `hangar-position-${id}`;
					const field = document.getElementById(fieldId);

					if (field) {
						field.value = value;
					} else {
						if (attempts === maxAttempts) {
							console.warn(
								`Position für Kachel ${id} konnte nicht gesetzt werden - Feld nicht gefunden`
							);
						}
						allSet = false;
					}
				}

				if (allSet || attempts >= maxAttempts) {
					resolve(allSet);
				} else {
					setTimeout(trySetValues, 300 * attempts);
				}
			};

			trySetValues();
		});

		return true;
	};

	/**
	 * Extrahiert Positionsdaten aus verschiedenen Datenformaten
	 * @param {Object} data - Die zu analysierenden Daten
	 * @returns {Object} - Gefundene Positionsdaten als {id: wert}
	 */
	const extractPositions = (data) => {
		const positions = {};

		if (!data || typeof data !== "object") return positions;

		// Extrahiere aus tileValues Array
		if (data.tileValues && Array.isArray(data.tileValues)) {
			for (const tile of data.tileValues) {
				if (
					tile &&
					tile.id &&
					tile.position &&
					tile.id >= 101 &&
					tile.id <= 104
				) {
					positions[tile.id] = tile.position;
				}
			}
		}

		// Extrahiere aus einem Array von Tiles
		if (Array.isArray(data)) {
			for (const tile of data) {
				if (
					tile &&
					tile.id &&
					tile.position &&
					tile.id >= 101 &&
					tile.id <= 104
				) {
					positions[tile.id] = tile.position;
				}
			}
		}

		// Extrahiere aus einem einzelnen Tile
		if (data.id && data.position && data.id >= 101 && data.id <= 104) {
			positions[data.id] = data.position;
		}

		return positions;
	};

	// Hauptspeicherfunktion
	const executeSave = async (data) => {
		// Wenn keine Änderungen vorliegen, nicht speichern
		if (compareFunction && lastSavedData !== null) {
			if (!compareFunction(lastSavedData, data)) {
				savePending = false;
				processQueue(); // Verarbeite die nächste Speicherung, falls vorhanden
				return;
			}
		}

		savePending = true;

		// Prüfe, ob Positionsdaten enthalten sind
		const containsPositionData = hasPositionData(data);

		try {
			// Bei Positionsdaten: Versuche zuerst, die Werte in die Felder zu schreiben
			if (containsPositionData) {
				await trySetPositionValues(data);
			}

			// Führe dann die eigentliche Speicherfunktion aus
			await saveFunction(data);
			lastSavedData = JSON.parse(JSON.stringify(data)); // Deep copy
			saveRetryCount = 0;
			savePending = false;

			// Verarbeite die nächste Speicherung, falls vorhanden
			processQueue();
		} catch (error) {
			console.error("Fehler beim automatischen Speichern:", error);

			// Wiederholungsversuch, wenn maximale Anzahl nicht erreicht
			if (saveRetryCount < maxRetries) {
				saveRetryCount++;
				setTimeout(() => executeSave(data), saveRetryCount * 1000);
			} else {
				saveRetryCount = 0;
				savePending = false;
				showNotification(
					"Automatisches Speichern fehlgeschlagen. Bitte manuell speichern.",
					"error",
					5000
				);
				// Verarbeite trotzdem die nächste Speicherung
				processQueue();
			}
		}
	};

	// Debounce-Wrapper für die Speicherfunktion
	const debouncedSave = debounce((data) => {
		if (savePending) {
			// Wenn bereits eine Speicherung läuft, füge die Daten zur Warteschlange hinzu
			saveQueue.push(data);
		} else {
			executeSave(data);
		}
	}, debounceTime);

	// Die zurückgegebene Funktion
	return function (data, key = null, forceSync = false) {
		// Optional: Callback bei Änderungen aufrufen
		if (onChange) {
			onChange(data, key);
		}

		let dataToSave;

		// Bestehende Daten erhalten, wenn Option gesetzt
		if (
			preserveExisting &&
			typeof data === "object" &&
			data !== null &&
			lastSavedData !== null
		) {
			// Tiefe Kopie von bestehenden Daten erstellen
			dataToSave = JSON.parse(JSON.stringify(lastSavedData));

			// Neuen Daten hinzufügen oder aktualisieren
			Object.keys(data).forEach((key) => {
				dataToSave[key] = data[key];
			});
		} else {
			// Neues Datenobjekt erstellen
			dataToSave =
				typeof data === "object" && data !== null ? { ...data } : data;
		}

		// Zeitstempel für letzte Änderung hinzufügen
		if (typeof dataToSave === "object" && dataToSave !== null) {
			dataToSave.lastSaved = new Date().toISOString();
		}

		// Entscheide, ob synchron oder mit Verzögerung gespeichert werden soll
		if (forceSync || forceSyncSave) {
			executeSave(dataToSave);
		} else {
			debouncedSave(dataToSave);
		}
	};
}

/**
 * Stellt eine optimierte Version der localStorage API bereit
 * @type {Object}
 */
const storageHelperExtended = {
	/**
	 * Speichert Daten im localStorage mit Fehlerbehandlung
	 * @param {string} key - Der Schlüssel unter dem gespeichert wird
	 * @param {any} value - Der zu speichernde Wert (wird zu JSON serialisiert)
	 * @param {boolean} merge - Ob bestehende Daten zusammengeführt werden sollen
	 * @returns {boolean} - Erfolg der Operation
	 */
	set(key, value, merge = false) {
		try {
			// Wenn merge aktiviert ist, bestehende Daten laden und zusammenführen
			if (merge) {
				const existingData = this.get(key, {});

				// Bei Arrays, verwende Concat
				if (Array.isArray(value) && Array.isArray(existingData)) {
					value = [...existingData, ...value];
				}
				// Bei Objekten, führe Eigenschaften zusammen
				else if (
					typeof value === "object" &&
					value !== null &&
					typeof existingData === "object" &&
					existingData !== null
				) {
					value = { ...existingData, ...value };
				}
			}

			localStorage.setItem(key, JSON.stringify(value));
			return true;
		} catch (e) {
			console.error("Fehler beim Speichern im localStorage:", e, {
				key,
				value,
			});
			if (e.name === "QuotaExceededError") {
				showNotification(
					"Speicherplatz erschöpft. Bitte einige Daten exportieren und löschen.",
					"error",
					5000
				);
			}
			return false;
		}
	},

	/**
	 * Liest Daten aus dem localStorage mit Fehlerbehandlung
	 * @param {string} key - Der zu lesende Schlüssel
	 * @param {any} defaultValue - Standardwert, falls der Schlüssel nicht existiert
	 * @returns {any} - Der gelesene Wert oder der Standardwert
	 */
	get(key, defaultValue = null) {
		try {
			const item = localStorage.getItem(key);
			const value = item ? JSON.parse(item) : defaultValue;

			return value;
		} catch (e) {
			console.error("Fehler beim Lesen aus localStorage:", e, { key });
			return defaultValue;
		}
	},

	/**
	 * Speichert Daten für sekundäre Kacheln
	 * @param {Array} tiles - Array mit Kacheldaten
	 * @param {string} key - Der Schlüssel unter dem gespeichert wird (Standard: 'uiSettings')
	 * @returns {boolean} - Erfolg der Operation
	 */
	saveSecondaryTiles(tiles, key = "uiSettings") {
		try {
			if (!Array.isArray(tiles)) {
				console.error("Fehler: tiles muss ein Array sein");
				return false;
			}

			// Aktuellen UI-Status holen, falls vorhanden
			const uiSettings = this.get(key, {
				tilesCount: 8,
				secondaryTilesCount: 4,
				layout: 4,
				tileValues: [],
			});

			// Sekundäre Kacheln aktualisieren
			uiSettings.secondaryTilesCount = tiles.length;

			// Stelle sicher, dass tileValues existiert und die richtige Größe hat
			if (!uiSettings.tileValues) {
				uiSettings.tileValues = [];
			}

			// Erstelle eine vollständige Kopie des aktuellen tileValues-Arrays
			const allTilesData = Array.isArray(uiSettings.tileValues)
				? [...uiSettings.tileValues]
				: [];

			// Füge sekundäre Kacheldaten hinzu oder aktualisiere sie
			tiles.forEach((tile, index) => {
				if (!tile) return;

				const tileIndex = uiSettings.tilesCount + index;
				const tileId = 100 + index + 1; // IDs für sekundäre Kacheln beginnen bei 101

				// Stelle sicher, dass der Index im Array existiert
				while (allTilesData.length <= tileIndex) {
					allTilesData.push(null);
				}

				// Bewahre vorhandene Daten, falls vorhanden
				const existingTile = allTilesData[tileIndex] || {};

				// Stelle sicher, dass die Datenstruktur konsistent ist
				allTilesData[tileIndex] = {
					...existingTile,
					...tile,
					id: tileId,
					position: tile.position || existingTile.position || "",
					data: tile.data || existingTile.data || {},
				};
			});

			// Aktualisiere das vollständige tileValues-Array
			uiSettings.tileValues = allTilesData;

			// In localStorage speichern
			const success = this.set(key, uiSettings);

			if (!success) {
				console.error(
					"Fehler beim Speichern der sekundären Kacheln im localStorage"
				);
			}

			return success;
		} catch (e) {
			console.error("Fehler beim Speichern der sekundären Kacheln:", e);
			return false;
		}
	},

	/**
	 * Lädt Daten für sekundäre Kacheln
	 * @param {string} key - Der Schlüssel aus dem geladen wird (Standard: 'uiSettings')
	 * @returns {Array|null} - Array mit Kacheldaten oder leeres Array bei Fehler
	 */
	loadSecondaryTiles(key = "uiSettings") {
		try {
			const uiSettings = this.get(key);

			if (
				!uiSettings ||
				!uiSettings.tileValues ||
				!Array.isArray(uiSettings.tileValues)
			) {
				console.log("Keine sekundären Kacheln zum Laden gefunden");
				return [];
			}

			const primaryCount = uiSettings.tilesCount || 12;
			const secondaryCount = uiSettings.secondaryTilesCount || 4;

			// Sekundäre Kacheln aus tileValues extrahieren
			const secondaryTiles = uiSettings.tileValues
				.slice(primaryCount, primaryCount + secondaryCount)
				.filter((tile) => tile !== null && tile !== undefined);

			console.log(`${secondaryTiles.length} sekundäre Kacheln geladen`);

			if (localStorage.getItem("debugMode") === "true") {
				console.log("Geladene sekundäre Kacheln:", secondaryTiles);
			}

			return secondaryTiles;
		} catch (e) {
			console.error("Fehler beim Laden der sekundären Kacheln:", e);
			return [];
		}
	},

	/**
	 * Prüft und repariert die Datenstruktur für UI-Einstellungen
	 * @param {string} key - Der Schlüssel der zu prüfenden Daten (Standard: 'uiSettings')
	 * @returns {boolean} - Erfolg der Operation
	 */
	validateUISettings(key = "uiSettings") {
		try {
			const uiSettings = this.get(key);

			if (!uiSettings) {
				console.log("Keine UI-Einstellungen gefunden, nichts zu validieren");
				return true;
			}

			let isModified = false;

			// Standard-Werte sicherstellen
			if (typeof uiSettings.tilesCount !== "number") {
				uiSettings.tilesCount = 12;
				isModified = true;
			}

			if (typeof uiSettings.secondaryTilesCount !== "number") {
				uiSettings.secondaryTilesCount = 4;
				isModified = true;
			}

			if (typeof uiSettings.layout !== "number") {
				uiSettings.layout = 4;
				isModified = true;
			}

			// tileValues-Array prüfen und reparieren
			if (!Array.isArray(uiSettings.tileValues)) {
				uiSettings.tileValues = [];
				isModified = true;
			}

			// Stelle sicher, dass das Array groß genug ist
			const requiredLength =
				uiSettings.tilesCount + uiSettings.secondaryTilesCount;
			if (uiSettings.tileValues.length < requiredLength) {
				while (uiSettings.tileValues.length < requiredLength) {
					uiSettings.tileValues.push(null);
				}
				isModified = true;
			}

			// Sicherstellen, dass alle sekundären Kacheln eine gültige ID haben
			for (let i = uiSettings.tilesCount; i < requiredLength; i++) {
				if (uiSettings.tileValues[i]) {
					const secondaryIndex = i - uiSettings.tilesCount;
					const expectedId = 100 + secondaryIndex + 1;

					if (uiSettings.tileValues[i].id !== expectedId) {
						uiSettings.tileValues[i].id = expectedId;
						isModified = true;
					}
				}
			}

			// Speichern, wenn Änderungen vorgenommen wurden
			if (isModified) {
				return this.set(key, uiSettings);
			}

			return true;
		} catch (e) {
			console.error("Fehler bei der Validierung der UI-Einstellungen:", e);
			return false;
		}
	},

	/**
	 * Warten auf die Verfügbarkeit eines DOM-Elements mit wiederholten Versuchen
	 * @param {string} selector - CSS-Selektor, nach dem gesucht wird
	 * @param {number} maxAttempts - Maximale Anzahl von Versuchen (Standard: 10)
	 * @param {number} interval - Zeitabstand zwischen den Versuchen in ms (Standard: 200)
	 * @returns {Promise<Element|null>} - Promise mit dem gefundenen Element oder null
	 */
	waitForElement(selector, maxAttempts = 10, interval = 200) {
		return new Promise((resolve) => {
			let attempts = 0;

			const checkElement = () => {
				attempts++;
				const element = document.querySelector(selector);

				if (element) {
					return resolve(element);
				}

				if (attempts >= maxAttempts) {
					console.warn(
						`Element mit Selektor "${selector}" wurde nach ${maxAttempts} Versuchen nicht gefunden`
					);
					return resolve(null);
				}

				setTimeout(checkElement, interval);
			};

			checkElement();
		});
	},

	/**
	 * Initialisiert ein Ereignis, wenn alle Felder einer bestimmten Klasse verfügbar sind
	 * @param {string} className - Klassenname der zu überwachenden Felder
	 * @param {Function} callback - Funktion, die aufgerufen wird, wenn alle Felder bereit sind
	 * @param {number} timeout - Maximale Wartezeit in ms (Standard: 5000)
	 * @param {Object} options - Zusätzliche Optionen
	 */
	whenFieldsReady(className, callback, timeout = 5000, options = {}) {
		const {
			checkInterval = 500,
			alternativeSelectors = [],
			onTimeout = null,
			minElements = 1,
		} = options;

		// Suche nach Elementen über verschiedene Selektoren
		const findElements = () => {
			let elements = document.getElementsByClassName(className);

			if (elements.length >= minElements) {
				return elements;
			}

			// Versuche alternative Selektoren
			for (const selector of alternativeSelectors) {
				const altElements = document.querySelectorAll(selector);
				if (altElements.length >= minElements) {
					return altElements;
				}
			}

			return null;
		};

		// Überprüfe zuerst, ob die Elemente bereits existieren
		const existingElements = findElements();
		if (existingElements) {
			console.log(
				`${existingElements.length} Elemente mit Klasse '${className}' direkt gefunden`
			);
			setTimeout(() => callback(existingElements), 50);
			return;
		}

		// MutationObserver für DOM-Änderungen einrichten
		const observer = new MutationObserver((mutations, observer) => {
			const elements = findElements();
			if (elements && elements.length >= minElements) {
				// Kurze Verzögerung für vollständige Initialisierung
				setTimeout(() => {
					observer.disconnect();
					console.log(
						`${elements.length} Elemente mit Klasse '${className}' durch MutationObserver gefunden`
					);
					callback(elements);
				}, 100);
			}
		});

		// DOM-Änderungen beobachten
		observer.observe(document.body, {
			childList: true,
			subtree: true,
			attributes: true,
			attributeFilter: ["class"],
		});

		// Regelmäßige Überprüfung als zusätzliche Sicherheit
		const intervalCheck = setInterval(() => {
			const elements = findElements();
			if (elements && elements.length >= minElements) {
				clearInterval(intervalCheck);
				observer.disconnect();
				console.log(
					`${elements.length} Elemente mit Klasse '${className}' durch Interval-Check gefunden`
				);
				callback(elements);
			}
		}, checkInterval);

		// Timeout, falls keine Elemente gefunden werden
		setTimeout(() => {
			observer.disconnect();
			clearInterval(intervalCheck);

			// Letzte Chance zur Überprüfung
			const elements = findElements();
			if (elements && elements.length >= minElements) {
				console.log(
					`${elements.length} Elemente mit Klasse '${className}' durch finalen Check gefunden`
				);
				callback(elements);
			} else {
				console.warn(
					`Keine Elemente mit Klasse '${className}' oder alternativen Selektoren nach ${timeout}ms gefunden`
				);
				if (onTimeout) {
					onTimeout();
				}
			}
		}, timeout);
	},
};

// Zum vorhandenen helpers-Objekt hinzufügen
if (window.helpers) {
	window.helpers.debounce = debounce;
	window.helpers.createAutoSave = createAutoSave;
	window.helpers.storage = storageHelper;
} else {
	window.helpers = {
		debounce,
		createAutoSave,
		storage: storageHelper,
	};
}

// Initialisierung der UI-Verbesserungen NACH der storage-Definition
function initializeUIEnhancements() {
	// Warten bis DOM vollständig geladen ist
	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initializeUIEnhancements);
		return;
	}

	setTimeout(() => {
		// Validiere UI-Einstellungen
		if (
			typeof storageHelper !== "undefined" &&
			storageHelper &&
			typeof storageHelper.validateUISettings === "function"
		) {
			console.log("Validiere UI-Einstellungen...");
			storageHelper.validateUISettings();
		} else {
			console.log(
				"storageHelper noch nicht verfügbar, überspringe UI-Validierung"
			);
		}

		// Event für die Initialisierung der sekundären Kacheln einrichten
		if (
			window.helpers &&
			window.helpers.storage &&
			window.helpers.storage.whenFieldsReady
		) {
			// Verwende erweiterte Konfiguration für die Erkennung
			window.helpers.storage.whenFieldsReady(
				"secondary-tile",
				(elements) => {
					console.log(
						`${elements.length} sekundäre Kacheln im DOM gefunden, initialisiere Positionsfelder...`
					);
					document.dispatchEvent(
						new CustomEvent("secondaryTilesReady", {
							detail: { count: elements.length },
						})
					);
				},
				15000,
				{
					checkInterval: 1000,
					alternativeSelectors: [
						'[data-tile-type="secondary"]',
						".tile-section-secondary .hangar-tile",
						'input[id^="hangar-position-10"]',
					],
					onTimeout: () => {
						// Versuche explizit nach Positionsfeldern zu suchen
						const positionFields = Array.from({ length: 4 }, (_, i) =>
							document.getElementById(`hangar-position-${101 + i}`)
						).filter(Boolean);

						if (positionFields.length > 0) {
							console.log(
								`${positionFields.length} Positionsfelder für sekundäre Kacheln gefunden, obwohl keine sekundären Kacheln erkannt wurden`
							);
							document.dispatchEvent(
								new CustomEvent("secondaryTilesReady", {
									detail: { count: positionFields.length },
								})
							);
						} else {
							console.error(
								"Keine sekundären Kacheln oder Positionsfelder gefunden"
							);
						}
					},
				}
			);

			// Auch auf manuelle Aktualisierungen der sekundären Kacheln lauschen
			document.addEventListener("secondarySectionToggled", (event) => {
				if (event.detail && event.detail.visible) {
					console.log(
						"Sekundäre Sektion wurde sichtbar gemacht, initiiere Überprüfung der Positionsfelder"
					);
					setTimeout(() => {
						const positionFields = Array.from({ length: 4 }, (_, i) =>
							document.getElementById(`hangar-position-${101 + i}`)
						).filter(Boolean);

						if (positionFields.length > 0) {
							console.log(
								`${positionFields.length} Positionsfelder nach Toggle gefunden`
							);
							document.dispatchEvent(
								new CustomEvent("secondaryTilesReady", {
									detail: { count: positionFields.length },
								})
							);
						}
					}, 500);
				}
			});
		} else {
			console.warn(
				"window.helpers.storage.whenFieldsReady nicht verfügbar, verwende Fallback für sekundäre Kacheln"
			);
			// Fallback: Direkte Überprüfung nach kurzer Verzögerung
			setTimeout(() => {
				const secondaryTiles = document.querySelectorAll(".secondary-tile");
				if (secondaryTiles.length > 0) {
					console.log(
						`${secondaryTiles.length} sekundäre Kacheln über Fallback gefunden`
					);
					document.dispatchEvent(
						new CustomEvent("secondaryTilesReady", {
							detail: { count: secondaryTiles.length },
						})
					);
				}
			}, 1000);
		}
	}, 500);
}

// Initialisierung starten
initializeUIEnhancements();

/**
 * Verzögerungsbasierte DOM-Manipulation, sobald ein Element verfügbar ist
 * @param {string} selector - CSS-Selektor zum Finden des Elements
 * @param {Function} callback - Funktion, die mit dem Element aufgerufen wird
 * @param {Object} options - Optionen für die Suche
 */
function whenElementReady(selector, callback, options = {}) {
	const { maxAttempts = 10, interval = 200, errorCallback = null } = options;

	if (window.helpers && window.helpers.storage) {
		window.helpers.storage
			.waitForElement(selector, maxAttempts, interval)
			.then((element) => {
				if (element) {
					callback(element);
				} else if (errorCallback) {
					errorCallback();
				}
			});
	} else {
		// Fallback, wenn helpers nicht verfügbar
		let attempts = 0;

		const checkElement = () => {
			attempts++;
			const element = document.querySelector(selector);

			if (element) {
				callback(element);
				return;
			}

			if (attempts >= maxAttempts) {
				console.warn(
					`Element mit Selektor "${selector}" wurde nach ${maxAttempts} Versuchen nicht gefunden`
				);
				if (errorCallback) {
					errorCallback();
				}
				return;
			}

			setTimeout(checkElement, interval);
		};

		checkElement();
	}
}

// Füge whenElementReady zum window.helpers-Objekt hinzu
if (window.helpers) {
	window.helpers.whenElementReady = whenElementReady;

	// Stelle sicher, dass Debug-Namespace existiert
	if (!window.helpers.debug) {
		window.helpers.debug = {};
	}

	// Registriere verfügbare Debug-Funktionen aus anderen Modulen
	// Diese Funktion wird aufgerufen, nachdem alle Module geladen sind
	window.helpers.registerDebugFunctions = function () {
		const debugFunctions = [
			"validateContainerMapping",
			"debugSyncDetailed",
			"debugSync",
			"debugContainerMapping",
			"getAllPrimaryTileData",
			"getAllSecondaryTileData",
		];

		debugFunctions.forEach((fn) => {
			if (window[fn] && typeof window[fn] === "function") {
				window.helpers.debug[fn] = window[fn];
			}
		});

		// Auch hangarDebug-Objekt in helpers einbinden falls verfügbar
		if (window.hangarDebug) {
			window.helpers.hangarDebug = window.hangarDebug;
		}

		console.log(
			"🔧 Debug-Funktionen in helpers.debug registriert:",
			Object.keys(window.helpers.debug)
		);
	};

	// Registriere Debug-Funktionen nach einer kurzen Verzögerung
	setTimeout(() => {
		if (window.helpers.registerDebugFunctions) {
			window.helpers.registerDebugFunctions();
		}
	}, 3000);
}

// === HELPERS MODULE BEREIT ===

// Date/Time helpers for datetime-local handling in UTC context
(function(){
  // Validates ISO local datetime YYYY-MM-DDTHH:mm (no seconds)
  function isISODateTimeLocal(str){
    return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(str);
  }

  // Back-compat alias (old name)
  function isDateTimeLocal(str){ return isISODateTimeLocal(str); }

  // Validates HH:mm only
  function isHHmm(str){
    return typeof str === 'string' && /^\d{1,2}:\d{2}$/.test(str);
  }

  // Validates 4-digit time format (HHMM)
  function is4DigitTime(str){
    return typeof str === 'string' && /^\d{4}$/.test(str);
  }

  // Converts 4-digit time (1230) to HH:mm format (12:30)
  function convert4DigitTimeToHHmm(str){
    if (!is4DigitTime(str)) return '';
    const hh = str.substring(0, 2);
    const mm = str.substring(2, 4);
    const h = parseInt(hh, 10);
    const m = parseInt(mm, 10);
    // Validate time ranges
    if (h < 0 || h > 23 || m < 0 || m > 59) return '';
    return `${pad2(h)}:${pad2(m)}`;
  }

  // Validates compact format dd.mm.yy,HH:MM (accepts both HH:mm and HH:MM)
  function isCompactDateTime(str){
    return typeof str === 'string' && /^\d{2}\.\d{2}\.\d{2},\d{2}:[\d]{2}$/.test(str);
  }

  // Pads to 2-digit
  function pad2(n){ return String(n).padStart(2,'0'); }

  // Adds N days to a YYYY-MM-DD string (UTC-safe by parsing parts only)
  function addDaysToDateString(dateStr, days){
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m-1, d));
    dt.setUTCDate(dt.getUTCDate() + (days||0));
    const yy = dt.getUTCFullYear();
    const mm = pad2(dt.getUTCMonth()+1);
    const dd = pad2(dt.getUTCDate());
    return `${yy}-${mm}-${dd}`;
  }

  // Reads base dates from UI; arrival := #currentDateInput; departure := arrival+1 day
  function getBaseDates(){
    const baseEl = document.getElementById('currentDateInput');
    const base = (baseEl && /^\d{4}-\d{2}-\d{2}$/.test(baseEl.value)) ? baseEl.value : '';
    return {
      arrivalBase: base,
      departureBase: base ? addDaysToDateString(base, 1) : ''
    };
  }

  // Converts HH:mm to datetime-local ISO (YYYY-MM-DDTHH:mm) using provided base date (YYYY-MM-DD)
  // Returns '' if invalid inputs
  function coerceHHmmToDateTimeLocalUtc(hhmm, baseDateStr){
    if (!isHHmm(hhmm) || !/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) return '';
    const [h, min] = hhmm.split(':').map(x=>parseInt(x,10));
    if (isNaN(h) || isNaN(min) || h<0 || h>23 || min<0 || min>59) return '';
    return `${baseDateStr}T${pad2(h)}:${pad2(min)}`;
  }

  // Formats ISO local datetime to DD.MMM hh:mm (UTC-based display requested)
  function formatISOToCompactUTC(iso){
    if (!isISODateTimeLocal(iso)) return '';
    const [date, time] = iso.split('T');
    const [y,m,d] = date.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthName = months[parseInt(m,10)-1] || m;
    return `${d}.${monthName} ${time}`;
  }

  // Parse compact dd.mm.yy,HH:mm to ISO local datetime YYYY-MM-DDTHH:mm
  // Assumes years 2000-2099 for two-digit year (UTC context)
  function parseCompactToISOUTC(compact){
    if (!isCompactDateTime(compact)) return '';
    const [datePart, timePart] = compact.split(',');
    const [dd, mm, yy] = datePart.split('.');
    const [HH, MM] = timePart.split(':');
    const yyyy = String(2000 + parseInt(yy,10));
    return `${yyyy}-${mm}-${dd}T${HH}:${MM}`;
  }

  // Formats datetime-local to yy.mm.dd,HH:mm for PDF display (accepts ISO string)
  function formatDateTimeLocalForPdf(dt){
    if (!isISODateTimeLocal(dt)) return '';
    return formatISOToCompactUTC(dt);
  }

  // Canonicalize value for a date-time field (arrival/departure) to ISO for storage
  function canonicalizeDateTimeFieldValue(fieldId, value){
    const v = (value||'').trim();
    if (!v) return '';
    // Field type discovery (arrival vs departure) only matters for HH:mm base selection
    const isArrival = fieldId.startsWith('arrival-time-');
    const isDeparture = fieldId.startsWith('departure-time-');
    if (!isArrival && !isDeparture) return v; // not our concern

    if (isISODateTimeLocal(v)) return v;
    if (isCompactDateTime(v)) return parseCompactToISOUTC(v);
    if (isHHmm(v)){
      const bases = getBaseDates();
      const base = isArrival ? bases.arrivalBase : bases.departureBase;
      return base ? coerceHHmmToDateTimeLocalUtc(v, base) : '';
    }
    if (is4DigitTime(v)){
      // Convert 4-digit time (1230) to HH:mm format first
      const hhmm = convert4DigitTimeToHHmm(v);
      if (hhmm) {
        const bases = getBaseDates();
        const base = isArrival ? bases.arrivalBase : bases.departureBase;
        return base ? coerceHHmmToDateTimeLocalUtc(hhmm, base) : '';
      }
    }
    return '';
  }

  // Helper: create masked compact value from digits (max 10 digits: DDMMYYHHmm)
  function digitsToCompact(digits){
    const d = (digits||'').replace(/\D+/g,'').slice(0,10);
    let out = '';
    for (let i=0;i<d.length;i++){
      out += d[i];
      if (i===1) out += '.'; // after DD
      if (i===3) out += '.'; // after DD.MM
      if (i===5) out += ','; // after DD.MM.YY
      if (i===7) out += ':'; // after DD.MM.YY,HH
    }
    return out;
  }

  // Helper: mask for just a date portion dd.mm.yy
  function digitsToDdMmYy(digits){
    const d = (digits||'').replace(/\D+/g,'').slice(0,6);
    let out = '';
    for (let i=0;i<d.length;i++){
      out += d[i];
      if (i===1) out += '.'; // after DD
      if (i===3) out += '.'; // after DD.MM
    }
    return out;
  }

  // Helper: get default time based on field type
  function getDefaultTimeForField(fieldId) {
    if (fieldId && fieldId.includes('arrival')) {
      return '09:00'; // Default arrival time
    } else if (fieldId && fieldId.includes('departure')) {
      return '17:00'; // Default departure time  
    }
    return '12:00'; // Generic default
  }

  // Attach input mask and interactions to a compact datetime input
  function attachCompactMask(input){
    if (!input || input.__compactMaskAttached) return;
    input.setAttribute('inputmode','numeric');
    input.setAttribute('placeholder','1230 or dd.mm.yy,HH:MM');
    input.dataset.dtCompact = 'true';

    // Ensure input fills its cell and leave space for absolute calendar button
    try {
      input.style.display = 'block';
      input.style.width = '100%';
      input.style.paddingRight = '28px';
    } catch(e){}

  const onInput = (e)=>{
    const raw = e.target.value || '';
    // Handle special shortcuts first (do not transform while typing)
    if (raw === '.') return;
    if (/^[+-]\d+$/.test(raw)) return; // +1, -2, etc.

    // If user types full ISO, show compact immediately
    if (isISODateTimeLocal(raw)){
      e.target.value = formatISOToCompactUTC(raw);
      return;
    }

    // Allow time-only typing without interfering; normalize on blur
    if (isHHmm(raw)) return;

    // Allow partial numeric typing (1, 12, 123, 1234) without forcing format
    if (/^\d{1,4}$/.test(raw)) return;

    // Allow full compact pattern dd.mm.yy,HH:MM to pass through as-is
    if (isCompactDateTime(raw)) return;

    // For other mixed input, attempt a gentle digits-to-compact transformation,
    // but only if it actually produces a more structured string; otherwise, keep raw
    const next = digitsToCompact(raw);
    if (next && next !== raw) {
      e.target.value = next;
    }
  };

  const onBlur = (e)=>{
    const raw = (e.target.value||'').trim();
    let iso = '';
    
    // Handle special shortcuts
    if (raw === '.') {
      // Dot means "today" - set to today with default time
      const now = new Date();
      const yy = String(now.getUTCFullYear()).slice(-2);
      const mm = pad2(now.getUTCMonth()+1);
      const dd = pad2(now.getUTCDate());
      const timeDefault = getDefaultTimeForField(e.target.id);
      const todayCompact = `${dd}.${mm}.${yy},${timeDefault}`;
      iso = parseCompactToISOUTC(todayCompact);
    } else if (/^[+-]\d+$/.test(raw)) {
      // Handle +/- day shortcuts like +1, -2, etc.
      const dayOffset = parseInt(raw, 10);
      const baseDate = new Date();
      baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
      const yy = String(baseDate.getUTCFullYear()).slice(-2);
      const mm = pad2(baseDate.getUTCMonth()+1);
      const dd = pad2(baseDate.getUTCDate());
      const timeDefault = getDefaultTimeForField(e.target.id);
      const offsetCompact = `${dd}.${mm}.${yy},${timeDefault}`;
      iso = parseCompactToISOUTC(offsetCompact);
    } else if (isISODateTimeLocal(raw)) {
      iso = raw;
    } else if (isCompactDateTime(raw)) {
      iso = parseCompactToISOUTC(raw);
    } else if (isHHmm(raw)) {
      // Time-only input: add today's date automatically
      const now = new Date();
      const yy = String(now.getUTCFullYear()).slice(-2);
      const mm = pad2(now.getUTCMonth()+1);
      const dd = pad2(now.getUTCDate());
      const todayWithTime = `${dd}.${mm}.${yy},${raw}`;
      iso = parseCompactToISOUTC(todayWithTime);
    } else if (is4DigitTime(raw)) {
      // 4-digit time input (1230): convert to HH:mm and add today's date
      const hhmm = convert4DigitTimeToHHmm(raw);
      if (hhmm) {
        const now = new Date();
        const yy = String(now.getUTCFullYear()).slice(-2);
        const mm = pad2(now.getUTCMonth()+1);
        const dd = pad2(now.getUTCDate());
        const todayWithTime = `${dd}.${mm}.${yy},${hhmm}`;
        iso = parseCompactToISOUTC(todayWithTime);
      }
    } else {
      iso = canonicalizeDateTimeFieldValue(e.target.id, raw);
    }

    if (iso){
      e.target.value = formatISOToCompactUTC(iso); // keep display compact
      e.target.dataset.iso = iso; // store ISO reference on the element
    } else {
      // invalid input: leave the user's raw string to let them correct it
      // do not force-clear while staying in the field; only clear if completely empty
      if (!raw) {
        e.target.value = '';
        delete e.target.dataset.iso;
      } else {
        // keep as typed and remove any stale ISO reference
        delete e.target.dataset.iso;
      }
    }
  };

    input.addEventListener('input', onInput);
    input.addEventListener('blur', onBlur);

    // Double-click to open lightweight picker
    input.addEventListener('dblclick', ()=> openCompactDateTimePicker(input));

    // Calendar button placed absolutely inside a wrapper so grid stays 2-column
    try{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.title = 'Open date/time picker';
      btn.className = 'compact-dt-btn';
      // SVG calendar icon using currentColor so it adapts to dark/light
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><line x1="16" y1="2" x2="16" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="8" y1="2" x2="8" y2="6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="2"/><rect x="7" y="14" width="3" height="3" fill="currentColor"/><rect x="12" y="14" width="3" height="3" fill="currentColor"/></svg>';
      // inline fallback; full look via CSS
      btn.style.position = 'absolute';
      btn.style.right = '2px';
      btn.style.top = '50%';
      btn.style.transform = 'translateY(-50%)';
      btn.style.width = '22px';
      btn.style.height = '22px';
      btn.style.display = 'inline-flex';
      btn.style.alignItems = 'center';
      btn.style.justifyContent = 'center';
      btn.style.padding = '0';
      // Use CSS for theme-specific border/background; do not override inline
      btn.style.border = '';
      btn.style.borderRadius = '4px';
      btn.style.background = '';
      btn.style.cursor = 'pointer';
      btn.addEventListener('click', ()=> openCompactDateTimePicker(input));

      const parent = input.parentElement;
      if (parent){
        // If not already wrapped, create a wrapper to keep input as a single grid item
        if (!parent.classList || !parent.classList.contains('compact-dt-wrap')){
          const wrap = document.createElement('div');
          wrap.className = 'compact-dt-wrap';
          wrap.style.position = 'relative';
          wrap.style.display = 'block';
          wrap.style.width = '100%';
          wrap.style.minWidth = '0';
          parent.insertBefore(wrap, input);
          wrap.appendChild(input);
          wrap.appendChild(btn);
        } else {
          parent.appendChild(btn);
        }
      }
    } catch(e){}

    input.__compactMaskAttached = true;
  }

  // Transform existing datetime-local inputs to compact text inputs
  function transformDateTimeLocalInputsToCompact(root){
    const scope = root || document;
    const nodes = scope.querySelectorAll('input[type="datetime-local"][id^="arrival-time-"], input[type="datetime-local"][id^="departure-time-"]');
    nodes.forEach(inp => {
      try{ inp.setAttribute('type','text'); } catch(e){}
      inp.classList.add('compact-datetime');
      inp.setAttribute('placeholder','1230 or dd.mm.yy,HH:MM');
      attachCompactMask(inp);
      // If value is ISO from storage, show compact
      const val = (inp.value||'').trim();
      if (isISODateTimeLocal(val)){
        inp.value = formatISOToCompactUTC(val);
      }
    });
  }

  // Lightweight picker overlay (single instance)
  let picker = null;
  let pickerTarget = null;

  function ensurePicker(){
    if (picker) return picker;
    picker = document.createElement('div');
    picker.style.position = 'fixed';
    picker.style.zIndex = '99999';
    picker.style.background = '#ffffff';
    picker.style.color = '#111827';
    picker.style.border = '1px solid #cbd5e1';
    picker.style.borderRadius = '6px';
    picker.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';
    picker.style.padding = '8px';
    picker.style.display = 'none';
    picker.style.width = '320px'; // default width for single mode
    picker.style.minHeight = '300px'; // ensure minimum height
    picker.style.overflow = 'hidden'; // prevent any hidden calendars from bleeding out

    // Header quick-jump controls (± 1 day) removed per request; keep internal date state only
    const dateContainer = document.createElement('div');
    dateContainer.style.display = 'none';
    const date = document.createElement('input');
    date.type = 'text';
    date.style.display = 'none';
    // keep for internal compact value handling
    dateContainer.appendChild(date);
    
    // Calendar view (month grid)
    const cal = document.createElement('div');
    cal.className = 'dtp-cal';

    // Controls row (range toggle)
    const controls = document.createElement('div');
    controls.className = 'dtp-controls';
    const rangeLabel = document.createElement('label');
    rangeLabel.className = 'dtp-range-label';
    const rangeCheckbox = document.createElement('input');
    rangeCheckbox.type = 'checkbox';
    rangeCheckbox.className = 'dtp-range-checkbox';
    const rangeText = document.createElement('span');
    rangeText.textContent = 'Range';
    rangeLabel.appendChild(rangeCheckbox);
    rangeLabel.appendChild(rangeText);
    controls.appendChild(rangeLabel);

    // Range state
    picker._rangeMode = false;
    picker._rangeStart = null;
    picker._rangeEnd = null;

    rangeCheckbox.addEventListener('change', () => {
      picker._rangeMode = !!rangeCheckbox.checked;
      // adjust header layout (3 cols) and picker width, and show/hide end time
      header.classList.toggle('range-mode', picker._rangeMode);
      timeEnd.style.display = picker._rangeMode ? 'inline-block' : 'none';
      picker.style.width = picker._rangeMode ? '640px' : '320px';
      
      // reset selection to current selectedDate
      picker._rangeStart = null; picker._rangeEnd = null;
      if (picker._rangeMode) {
        if (picker._selectedDate) picker._rangeStart = new Date(picker._selectedDate);
        // prefill default end time = start time
        timeEnd.value = (picker._normalizeTime24 ? picker._normalizeTime24(timeStart.value) : (timeStart.value||'')) || '00:00';
        // Set dual month state for consecutive months
        const currentDate = picker._selectedDate || new Date();
        picker._leftMonth = currentDate.getMonth();
        picker._leftYear = currentDate.getFullYear();
        picker._rightMonth = (currentDate.getMonth() + 1) % 12;
        picker._rightYear = currentDate.getFullYear() + (currentDate.getMonth() === 11 ? 1 : 0);
      }
      
      if (picker._headerDate) picker._headerDate.textContent = formatLongDateLabel(picker._selectedDate || new Date());
      
      // Switch between single and dual calendar rendering with proper cleanup
      if (picker._rangeMode) {
        // Ensure dual calendar is attached just before actions
        if (picker._dualDetached && picker._column) {
          try { picker._column.insertBefore(dualCalContainer, picker._actions || null); } catch(_){}
          picker._dualDetached = false;
        }
        // Show dual calendar, hide single calendar
        cal.style.display = 'none';
        dualCalContainer.removeAttribute('hidden');
        dualCalContainer.style.display = 'flex';
        dualCalContainer.style.flexDirection = 'row';
        dualCalContainer.style.flexWrap = 'nowrap';
        buildDualCalendar(picker._leftYear, picker._leftMonth, picker._rightYear, picker._rightMonth, picker._selectedDate);
      } else {
        // Show single calendar, hide and clear dual calendar completely
        cal.style.display = 'block';
        dualCalContainer.style.display = 'none';
        dualCalContainer.setAttribute('hidden','hidden');
        leftGrid.innerHTML = '';
        rightGrid.innerHTML = '';
        // Detach from DOM to avoid any rendering glitches
        try {
          if (dualCalContainer.parentElement) {
            dualCalContainer.parentElement.removeChild(dualCalContainer);
            picker._dualDetached = true;
          }
        } catch(_){}
        buildCalendar(picker._viewYear || new Date().getFullYear(), picker._viewMonth || new Date().getMonth(), picker._selectedDate);
      }
    });

    // expose for example/demo
    picker._rangeCheckbox = rangeCheckbox;

    const calNav = document.createElement('div');
    calNav.className = 'dtp-nav';

    const prevMonthBtn = document.createElement('button');
    prevMonthBtn.type = 'button';
    prevMonthBtn.className = 'date-nav-btn';
    prevMonthBtn.textContent = '‹';

    const monthYearLabel = document.createElement('div');
    monthYearLabel.className = 'dtp-month-label';

    const nextMonthBtn = document.createElement('button');
    nextMonthBtn.type = 'button';
    nextMonthBtn.className = 'date-nav-btn';
    nextMonthBtn.textContent = '›';

    calNav.appendChild(prevMonthBtn);
    calNav.appendChild(monthYearLabel);
    calNav.appendChild(nextMonthBtn);

    const dow = document.createElement('div');
    dow.className = 'dtp-dow-row';
    const dows = ['Mo','Tu','We','Th','Fr','Sa','Su'];
    dows.forEach(dn => {
      const el = document.createElement('div');
      el.className = 'dtp-dow';
      el.textContent = dn;
      dow.appendChild(el);
    });

    const daysGrid = document.createElement('div');
    daysGrid.className = 'dtp-grid';

    cal.appendChild(calNav);
    cal.appendChild(dow);
    cal.appendChild(daysGrid);

    // Dual calendar container (for range mode) - hidden by default
    const dualCalContainer = document.createElement('div');
    dualCalContainer.className = 'dtp-dual-months';
    dualCalContainer.style.display = 'none';
    dualCalContainer.style.flexDirection = 'row';
    dualCalContainer.style.flexWrap = 'nowrap';
    dualCalContainer.style.alignItems = 'flex-start';

    // Left month
    const leftMonth = document.createElement('div');
    leftMonth.className = 'dtp-month';
    
    const leftNav = document.createElement('div');
    leftNav.className = 'dtp-nav';
    const leftPrev = document.createElement('button');
    leftPrev.type = 'button';
    leftPrev.className = 'date-nav-btn';
    leftPrev.textContent = '‹';
    const leftLabel = document.createElement('div');
    leftLabel.className = 'dtp-month-label';
    const leftNext = document.createElement('button');
    leftNext.type = 'button';
    leftNext.className = 'date-nav-btn';
    leftNext.textContent = '›';
    leftNav.appendChild(leftPrev);
    leftNav.appendChild(leftLabel);
    leftNav.appendChild(leftNext);

    const leftDow = document.createElement('div');
    leftDow.className = 'dtp-dow-row';
    dows.forEach(dn => {
      const el = document.createElement('div');
      el.className = 'dtp-dow';
      el.textContent = dn;
      leftDow.appendChild(el);
    });

    const leftGrid = document.createElement('div');
    leftGrid.className = 'dtp-grid';

    leftMonth.appendChild(leftNav);
    leftMonth.appendChild(leftDow);
    leftMonth.appendChild(leftGrid);

    // Right month
    const rightMonth = document.createElement('div');
    rightMonth.className = 'dtp-month';
    
    const rightNav = document.createElement('div');
    rightNav.className = 'dtp-nav';
    const rightPrev = document.createElement('button');
    rightPrev.type = 'button';
    rightPrev.className = 'date-nav-btn';
    rightPrev.textContent = '‹';
    const rightLabel = document.createElement('div');
    rightLabel.className = 'dtp-month-label';
    const rightNext = document.createElement('button');
    rightNext.type = 'button';
    rightNext.className = 'date-nav-btn';
    rightNext.textContent = '›';
    rightNav.appendChild(rightPrev);
    rightNav.appendChild(rightLabel);
    rightNav.appendChild(rightNext);

    const rightDow = document.createElement('div');
    rightDow.className = 'dtp-dow-row';
    dows.forEach(dn => {
      const el = document.createElement('div');
      el.className = 'dtp-dow';
      el.textContent = dn;
      rightDow.appendChild(el);
    });

    const rightGrid = document.createElement('div');
    rightGrid.className = 'dtp-grid';

    rightMonth.appendChild(rightNav);
    rightMonth.appendChild(rightDow);
    rightMonth.appendChild(rightGrid);

    dualCalContainer.appendChild(leftMonth);
    dualCalContainer.appendChild(rightMonth);

    // Build and update calendar helpers
    function isSameDay(a,b){ return a && b && a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }
    function toDdMmYy(dt){ const dd = String(dt.getDate()).padStart(2,'0'); const mm = String(dt.getMonth()+1).padStart(2,'0'); const yy = String(dt.getFullYear()).slice(-2); return `${dd}.${mm}.${yy}`; }

    function buildCalendar(year, month, selected){
      const first = new Date(year, month, 1);
      // Monday as first day of week
      const startOffset = (first.getDay() + 6) % 7; // 0..6 (Mon..Sun)
      const start = new Date(year, month, 1 - startOffset);
      const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      monthYearLabel.textContent = monthLabel;
      daysGrid.innerHTML = '';
      for (let i=0; i<42; i++){
        const d = new Date(start); d.setDate(start.getDate() + i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dtp-day';
        if (d.getMonth() !== month) btn.classList.add('muted');
        const today = new Date();
        if (isSameDay(d, today)) btn.classList.add('today');
        if (selected && isSameDay(d, selected)) btn.classList.add('selected');
        // Range highlights
        if (picker._rangeMode) {
          const rs = picker._rangeStart, re = picker._rangeEnd;
          if (rs && isSameDay(d, rs)) btn.classList.add('range-start');
          if (re && isSameDay(d, re)) btn.classList.add('range-end');
          if (rs && re && d >= rs && d <= re) btn.classList.add('in-range');
        }
        btn.textContent = String(d.getDate());
        btn.addEventListener('click', () => {
          const clicked = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (picker._rangeMode) {
            if (!picker._rangeStart || (picker._rangeStart && picker._rangeEnd)) {
              picker._rangeStart = clicked;
              picker._rangeEnd = null;
              picker._selectedDate = clicked;
            } else {
              // set end
              if (clicked < picker._rangeStart) {
                picker._rangeEnd = picker._rangeStart;
                picker._rangeStart = clicked;
              } else {
                picker._rangeEnd = clicked;
              }
              picker._selectedDate = clicked;
            }
          } else {
            picker._selectedDate = clicked;
          }
          date.value = toDdMmYy(picker._selectedDate);
          if (picker._headerDate) {
            const f = picker._formatLongDateLabel;
            if (picker._rangeMode && picker._rangeStart && picker._rangeEnd) {
              picker._headerDate.textContent = `${f(picker._rangeStart)} — ${f(picker._rangeEnd)}`;
            } else if (picker._rangeMode && picker._rangeStart && !picker._rangeEnd) {
              picker._headerDate.textContent = f(picker._rangeStart);
            } else {
              picker._headerDate.textContent = f(picker._selectedDate);
            }
          }
          buildCalendar(year, month, picker._selectedDate);
        });
        daysGrid.appendChild(btn);
      }
      picker._viewYear = year; picker._viewMonth = month;
    }

    function buildDualCalendar(leftYear, leftMonth, rightYear, rightMonth, selected) {
      // Build left month
      buildMonthGrid(leftYear, leftMonth, leftGrid, leftLabel, selected);
      // Build right month  
      buildMonthGrid(rightYear, rightMonth, rightGrid, rightLabel, selected);
      
      // Update picker state
      picker._leftYear = leftYear;
      picker._leftMonth = leftMonth;
      picker._rightYear = rightYear;
      picker._rightMonth = rightMonth;
    }

    function buildMonthGrid(year, month, grid, label, selected) {
      const first = new Date(year, month, 1);
      // Monday as first day of week
      const startOffset = (first.getDay() + 6) % 7; // 0..6 (Mon..Sun)
      const start = new Date(year, month, 1 - startOffset);
      const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      label.textContent = monthLabel;
      grid.innerHTML = '';
      
      for (let i = 0; i < 42; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'dtp-day';
        
        if (d.getMonth() !== month) btn.classList.add('muted');
        
        const today = new Date();
        if (isSameDay(d, today)) btn.classList.add('today');
        if (selected && isSameDay(d, selected)) btn.classList.add('selected');
        
        // Range highlights
        if (picker._rangeMode) {
          const rs = picker._rangeStart, re = picker._rangeEnd;
          if (rs && isSameDay(d, rs)) btn.classList.add('range-start');
          if (re && isSameDay(d, re)) btn.classList.add('range-end');
          if (rs && re && d >= rs && d <= re) btn.classList.add('in-range');
        }
        
        btn.textContent = String(d.getDate());
        btn.addEventListener('click', () => {
          const clicked = new Date(d.getFullYear(), d.getMonth(), d.getDate());
          if (picker._rangeMode) {
            if (!picker._rangeStart || (picker._rangeStart && picker._rangeEnd)) {
              picker._rangeStart = clicked;
              picker._rangeEnd = null;
              picker._selectedDate = clicked;
            } else {
              // set end
              if (clicked < picker._rangeStart) {
                picker._rangeEnd = picker._rangeStart;
                picker._rangeStart = clicked;
              } else {
                picker._rangeEnd = clicked;
              }
              picker._selectedDate = clicked;
            }
          } else {
            picker._selectedDate = clicked;
          }
          
          date.value = toDdMmYy(picker._selectedDate);
          if (picker._headerDate) {
            const f = picker._formatLongDateLabel;
            if (picker._rangeMode && picker._rangeStart && picker._rangeEnd) {
              picker._headerDate.textContent = `${f(picker._rangeStart)} — ${f(picker._rangeEnd)}`;
            } else if (picker._rangeMode && picker._rangeStart && !picker._rangeEnd) {
              picker._headerDate.textContent = f(picker._rangeStart);
            } else {
              picker._headerDate.textContent = f(picker._selectedDate);
            }
          }
          
          // Refresh both calendars in dual mode
          if (picker._rangeMode) {
            buildDualCalendar(picker._leftYear, picker._leftMonth, picker._rightYear, picker._rightMonth, picker._selectedDate);
          } else {
            buildCalendar(year, month, picker._selectedDate);
          }
        });
        
        grid.appendChild(btn);
      }
    }

    prevMonthBtn.addEventListener('click', () => {
      let y = picker._viewYear || new Date().getFullYear();
      let m = (picker._viewMonth || 0) - 1; if (m < 0){ m = 11; y--; }
      buildCalendar(y, m, picker._selectedDate);
    });
    nextMonthBtn.addEventListener('click', () => {
      let y = picker._viewYear || new Date().getFullYear();
      let m = (picker._viewMonth || 0) + 1; if (m > 11){ m = 0; y++; }
      buildCalendar(y, m, picker._selectedDate);
    });

    // Dual month navigation handlers - truly independent
    leftPrev.addEventListener('click', () => {
      let y = picker._leftYear;
      let m = picker._leftMonth - 1;
      if (m < 0) { m = 11; y--; }
      
      // Only update left month, keep right month independent
      picker._leftYear = y;
      picker._leftMonth = m;
      buildDualCalendar(y, m, picker._rightYear, picker._rightMonth, picker._selectedDate);
    });
    
    leftNext.addEventListener('click', () => {
      let y = picker._leftYear;
      let m = picker._leftMonth + 1;
      if (m > 11) { m = 0; y++; }
      
      // Only update left month, keep right month independent
      picker._leftYear = y;
      picker._leftMonth = m;
      buildDualCalendar(y, m, picker._rightYear, picker._rightMonth, picker._selectedDate);
    });
    
    rightPrev.addEventListener('click', () => {
      let y = picker._rightYear;
      let m = picker._rightMonth - 1;
      if (m < 0) { m = 11; y--; }
      
      // Only update right month, keep left month independent
      picker._rightYear = y;
      picker._rightMonth = m;
      buildDualCalendar(picker._leftYear, picker._leftMonth, y, m, picker._selectedDate);
    });
    
    rightNext.addEventListener('click', () => {
      let y = picker._rightYear;
      let m = picker._rightMonth + 1;
      if (m > 11) { m = 0; y++; }
      
      // Only update right month, keep left month independent
      picker._rightYear = y;
      picker._rightMonth = m;
      buildDualCalendar(picker._leftYear, picker._leftMonth, y, m, picker._selectedDate);
    });

    // Expose for open() to call
    picker._buildCalendar = buildCalendar;
    picker._buildDualCalendar = buildDualCalendar;
    picker._monthYearLabel = monthYearLabel;
    picker._daysGrid = daysGrid;
    picker._dualCalContainer = dualCalContainer;
    picker._leftGrid = leftGrid;
    picker._rightGrid = rightGrid;
    picker._leftLabel = leftLabel;
    picker._rightLabel = rightLabel;

    
    // Add input handling for shortcuts
    date.addEventListener('input', (e) => {
      const raw = e.target.value || '';
      // Handle special shortcuts
      if (raw === '.' || /^[+-]\d+$/.test(raw)) {
        // Don't mask shortcuts, let them be processed
        return;
      }
      e.target.value = digitsToDdMmYy(raw);
    });
    
    // Handle shortcut expansion on blur
    date.addEventListener('blur', (e) => {
      const raw = (e.target.value || '').trim();
      if (raw === '.') {
        // Set to today
        const now = new Date();
        const yy = String(now.getUTCFullYear()).slice(-2);
        const mm = pad2(now.getUTCMonth()+1);
        const dd = pad2(now.getUTCDate());
        e.target.value = `${dd}.${mm}.${yy}`;
      } else if (/^[+-]\d+$/.test(raw)) {
        // Handle +/- day shortcuts
        const dayOffset = parseInt(raw, 10);
        const baseDate = new Date();
        baseDate.setUTCDate(baseDate.getUTCDate() + dayOffset);
        const yy = String(baseDate.getUTCFullYear()).slice(-2);
        const mm = pad2(baseDate.getUTCMonth()+1);
        const dd = pad2(baseDate.getUTCDate());
        e.target.value = `${dd}.${mm}.${yy}`;
      }
    });
    
    // Navigation button handlers
    const adjustDate = (offset) => {
      let currentDate;
      if (date.value && /^\d{2}\.\d{2}\.\d{2}$/.test(date.value)) {
        // Parse current date
        const [dd, mm, yy] = date.value.split('.');
        currentDate = new Date(2000 + parseInt(yy, 10), parseInt(mm, 10) - 1, parseInt(dd, 10));
      } else {
        // Use today if no valid date
        currentDate = new Date();
      }
      
      currentDate.setDate(currentDate.getDate() + offset);
      const yy = String(currentDate.getFullYear()).slice(-2);
      const mm = pad2(currentDate.getMonth() + 1);
      const dd = pad2(currentDate.getDate());
      date.value = `${dd}.${mm}.${yy}`;
    };
    
    // prev/next day buttons removed; keep month navigation only

    // 24h time input (text-based to avoid OS 12/24h locale switching)
    const time = document.createElement('input');
    time.type = 'text';
    time.setAttribute('inputmode','numeric');
    time.setAttribute('placeholder','HH:MM');
    time.setAttribute('aria-label','Time (24h)');
    time.pattern = '^([01]?\\d|2[0-3]):[0-5]\\d$';
    // Narrower time field for header
    time.style.width = '90px';
    // Comfortable sizing
    time.style.height = '28px';
    time.style.fontSize = '14px';
    time.style.lineHeight = '24px';
    time.className = 'dtp-time-input';

    // Header with long date on left and time on right
    const header = document.createElement('div');
    header.className = 'dtp-header';
    const headerDate = document.createElement('div');
    headerDate.className = 'dtp-header-date';
    header.appendChild(headerDate);
    // time start (always visible)
    const timeStart = time; // keep existing variable as start input
    header.appendChild(timeStart);
    // time end (visible only in range mode)
    const timeEnd = document.createElement('input');
    timeEnd.type = 'text';
    timeEnd.setAttribute('inputmode','numeric');
    timeEnd.setAttribute('placeholder','HH:MM');
    timeEnd.setAttribute('aria-label','End time (24h)');
    timeEnd.pattern = '^([01]?\\d|2[0-3]):[0-5]\\d$';
    timeEnd.style.width = '90px';
    timeEnd.style.height = '28px';
    timeEnd.style.fontSize = '14px';
    timeEnd.style.lineHeight = '24px';
    timeEnd.className = 'dtp-time-input';
    timeEnd.style.display = 'none';
    header.appendChild(timeEnd);

    function formatLongDateLabel(d){
      if (!(d instanceof Date)) return '';
      const dd = String(d.getDate()).padStart(2,'0');
      const mm = String(d.getMonth()+1).padStart(2,'0');
      const yy = String(d.getFullYear()).slice(-2);
      return `${dd}.${mm}.${yy}`;
    }
    // helper: normalize arbitrary input to HH:MM (24h) or ''
    function normalizeTime24(raw){
      const s = String(raw||'').trim().toLowerCase();
      if (!s) return '';
      // 0930 / 930 -> 09:30
      if (/^\d{3,4}$/.test(s)){
        const h = s.length===3 ? s.slice(0,1) : s.slice(0,2);
        const m = s.slice(-2);
        let hh = parseInt(h,10), mm = parseInt(m,10);
        if (isNaN(hh) || isNaN(mm) || hh>23 || mm>59) return '';
        return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
      }
      const m = s.match(/^(\d{1,2})(?::?(\d{2}))?\s*([ap]m)?$/i);
      if (m){
        let hh = parseInt(m[1],10);
        let mm = typeof m[2]!== 'undefined' ? parseInt(m[2],10) : 0;
        const ap = m[3] ? m[3].toLowerCase() : '';
        if (ap){
          if (ap.startsWith('p') && hh < 12) hh += 12;
          if (ap.startsWith('a') && hh === 12) hh = 0;
        }
        if (hh>=0 && hh<=23 && mm>=0 && mm<=59){
          return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
        }
      }
      // Already HH:MM? return sanitized
      const mmatch = s.match(/^(\d{2}):(\d{2})$/);
      if (mmatch){
        let hh = parseInt(mmatch[1],10), mm = parseInt(mmatch[2],10);
        if (hh>=0 && hh<=23 && mm>=0 && mm<=59){
          return `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}`;
        }
      }
      return '';
    }

    // sanitize on blur; allow digits and ':' while typing
    time.addEventListener('input', ()=>{ time.value = time.value.replace(/[^0-9:]/g,''); });
    time.addEventListener('blur', ()=>{ const v = normalizeTime24(time.value); if (v) time.value = v; });
    timeEnd.addEventListener('input', ()=>{ timeEnd.value = timeEnd.value.replace(/[^0-9:]/g,''); });
    timeEnd.addEventListener('blur', ()=>{ const v = normalizeTime24(timeEnd.value); if (v) timeEnd.value = v; });

    // expose to picker so openCompactDateTimePicker can use it safely
    picker._formatLongDateLabel = formatLongDateLabel;
    picker._normalizeTime24 = normalizeTime24;

    const ok = document.createElement('button'); ok.type='button'; ok.textContent='OK';
    ok.style.marginRight = '6px'; ok.style.padding='6px 10px'; ok.style.height='30px'; ok.style.border='1px solid #0ea5e9'; ok.style.background='#e0f2fe'; ok.style.borderRadius='4px';
    const cancel = document.createElement('button'); cancel.type='button'; cancel.textContent='Cancel';
    cancel.style.padding='6px 10px'; cancel.style.height='30px'; cancel.style.border='1px solid #cbd5e1'; cancel.style.background='#f8fafc'; cancel.style.borderRadius='4px';

    // Apply theme-aware colors (dark/light) using CSS variables if available
    function applyPickerTheme(){
      const root = getComputedStyle(document.documentElement);
      const isDark = document.documentElement.classList.contains('dark-mode') || document.body.classList.contains('dark-mode');
      const get = (name, fallback) => (root.getPropertyValue(name) || '').trim() || fallback;
      const bgPrimary = get('--bg-primary', '#202224');
      const bgSecondary = get('--bg-secondary', '#303437');
      const border = get('--border-color', '#303437');
      const text = get('--text-primary', '#f7fafc');
      const textSecondary = get('--text-secondary', '#e2e8f0');
      const accent = '#FF7043';

      if (isDark){
        picker.style.background = bgSecondary;
        picker.style.color = text;
        picker.style.border = `1px solid ${border}`;
        picker.style.boxShadow = '0 12px 28px rgba(0,0,0,0.45)';

        date.style.background = bgPrimary;
        date.style.color = text;
        date.style.border = `1px solid ${border}`;
        date.style.outline = 'none';
        date.style.colorScheme = 'dark';

        timeStart.style.background = bgPrimary;
        timeStart.style.color = text;
        timeStart.style.border = `1px solid ${border}`;
        timeStart.style.outline = 'none';
        timeStart.style.colorScheme = 'dark';
        timeEnd.style.background = bgPrimary;
        timeEnd.style.color = text;
        timeEnd.style.border = `1px solid ${border}`;
        timeEnd.style.outline = 'none';
        timeEnd.style.colorScheme = 'dark';

        ok.style.background = accent;
        ok.style.border = `1px solid ${accent}`;
        ok.style.color = '#ffffff';
        cancel.style.background = bgPrimary;
        cancel.style.border = `1px solid ${border}`;
        cancel.style.color = textSecondary;
      } else {
        // light theme defaults already set above; ensure text colors readable
        picker.style.background = '#ffffff';
        picker.style.color = '#111827';
        picker.style.border = '1px solid #cbd5e1';
        picker.style.boxShadow = '0 10px 20px rgba(0,0,0,0.15)';

        date.style.background = '#ffffff';
        date.style.color = '#111827';
        date.style.border = '1px solid #cbd5e1';

        timeStart.style.background = '#ffffff';
        timeStart.style.color = '#111827';
        timeStart.style.border = '1px solid #cbd5e1';
        timeEnd.style.background = '#ffffff';
        timeEnd.style.color = '#111827';
        timeEnd.style.border = '1px solid #cbd5e1';

        ok.style.background = '#e0f2fe';
        ok.style.border = '1px solid #0ea5e9';
        ok.style.color = '#0c4a6e';
        cancel.style.background = '#f8fafc';
        cancel.style.border = '1px solid #cbd5e1';
        cancel.style.color = '#334155';
      }
    }

    const column = document.createElement('div');
    column.style.display='flex';
    column.style.flexDirection='column';
    column.style.alignItems='stretch';

    const actions = document.createElement('div');
    actions.style.display='flex';
    actions.style.justifyContent='flex-end';
    actions.style.gap = '8px';
    // Improve button alignment
    ok.style.display='inline-flex'; ok.style.alignItems='center'; ok.style.justifyContent='center'; ok.style.lineHeight='1'; ok.style.minWidth='56px';
    cancel.style.display='inline-flex'; cancel.style.alignItems='center'; cancel.style.justifyContent='center'; cancel.style.lineHeight='1'; cancel.style.minWidth='72px';
    actions.appendChild(ok); actions.appendChild(cancel);

    // Header contains long date and time input
    column.appendChild(header);
    column.appendChild(controls);
    column.appendChild(cal);
    column.appendChild(dualCalContainer);
    column.appendChild(actions);

    picker.appendChild(column);
    document.body.appendChild(picker);

    // Store references for later re-attach/detach of dual calendar
    picker._column = column;
    picker._actions = actions;

    // Initial theme apply and on dark-mode toggles if your app toggles classes
    applyPickerTheme();

    function close(){
      picker.style.display='none';
      // detach listeners safely using stored refs
      try { if (picker._onKey) document.removeEventListener('keydown', picker._onKey); } catch(_){}
      try { if (picker._onDocDown) document.removeEventListener('mousedown', picker._onDocDown, true); } catch(_){}
      picker._onKey = null; picker._onDocDown = null;
      pickerTarget = null;
    }

    ok.addEventListener('click', ()=>{
      const tStart = (picker._normalizeTime24 ? picker._normalizeTime24(timeStart.value) : (timeStart.value||'').trim()) || '00:00';
      const tEnd = (picker._normalizeTime24 ? picker._normalizeTime24(timeEnd.value) : (timeEnd.value||'').trim()) || tStart;
      if (typeof picker._onConfirm === 'function'){
        const payload = {};
        if (picker._rangeMode && picker._rangeStart && picker._rangeEnd){
          const f = picker._formatLongDateLabel;
          const s = f(picker._rangeStart), e = f(picker._rangeEnd);
          payload.mode = 'range'; payload.start = s; payload.end = e; payload.timeStart = tStart; payload.timeEnd = tEnd;
          payload.startIso = parseCompactToISOUTC(`${s},${tStart}`);
          payload.endIso = parseCompactToISOUTC(`${e},${tEnd}`);
        } else {
          const d = (date.value || '').trim();
          if (/^\d{2}\.\d{2}\.\d{2}$/.test(d)){
            payload.mode = 'single';
            payload.value = d; payload.time = tStart; payload.iso = parseCompactToISOUTC(`${d},${tStart}`);
          }
        }
        try { picker._onConfirm(payload); } catch(_){}
      } else if (pickerTarget) {
        const d = (date.value || '').trim();
        if (/^\d{2}\.\d{2}\.\d{2}$/.test(d) && /^\d{2}:\d{2}$/.test(tStart)){
          const iso = parseCompactToISOUTC(`${d},${tStart}`);
          if (iso){
            if (picker._rangeMode && picker._rangeStart && picker._rangeEnd){
              const f = picker._formatLongDateLabel; const s=f(picker._rangeStart), e=f(picker._rangeEnd);
              // Fill both tile inputs (arrival/departure)
              const id = pickerTarget.id || '';
              const m = id.match(/-(\d+)$/);
              const idx = m ? m[1] : null;
              const startCompact = `${s},${tStart}`;
              const endCompact = `${e},${tEnd}`;
              const startIso = parseCompactToISOUTC(startCompact);
              const endIso = parseCompactToISOUTC(endCompact);
              let applied = false;
              if (idx){
                const arrEl = document.getElementById(`arrival-time-${idx}`);
                const depEl = document.getElementById(`departure-time-${idx}`);
                if (arrEl){ arrEl.value = startCompact; arrEl.dataset.iso = startIso; arrEl.dispatchEvent(new Event('input',{bubbles:true})); arrEl.dispatchEvent(new Event('change',{bubbles:true})); }
                if (depEl){ depEl.value = endCompact; depEl.dataset.iso = endIso; depEl.dispatchEvent(new Event('input',{bubbles:true})); depEl.dispatchEvent(new Event('change',{bubbles:true})); }
                // Also update Planner Table inputs if present
                const arrTable = document.getElementById(`arrival-time-table-${idx}`);
                const depTable = document.getElementById(`departure-time-table-${idx}`);
                if (arrTable){ arrTable.value = startCompact; arrTable.dataset.iso = startIso; arrTable.dispatchEvent(new Event('input',{bubbles:true})); arrTable.dispatchEvent(new Event('change',{bubbles:true})); }
                if (depTable){ depTable.value = endCompact; depTable.dataset.iso = endIso; depTable.dispatchEvent(new Event('input',{bubbles:true})); depTable.dispatchEvent(new Event('change',{bubbles:true})); }
                // Ensure the clicked field reflects the appropriate value
                try {
                  const tid = id.toLowerCase();
                  if (tid.includes('arrival')) pickerTarget.value = startCompact;
                  else if (tid.includes('departure')) pickerTarget.value = endCompact;
                } catch(_){ }
                if (arrEl || depEl || arrTable || depTable) applied = true;
              }
              if (!applied){
                // Fallback: write summary into the clicked field and attach datasets
                pickerTarget.value = `${s} — ${e}`;
                pickerTarget.dataset.rangeStartIso = startIso;
                pickerTarget.dataset.rangeEndIso = endIso;
              }
            } else {
              pickerTarget.dataset.iso = iso;
              pickerTarget.value = formatISOToCompactUTC(iso);
            }
            pickerTarget.dispatchEvent(new Event('input', {bubbles:true}));
            pickerTarget.dispatchEvent(new Event('change', {bubbles:true}));
            pickerTarget.dispatchEvent(new Event('blur', {bubbles:true}));
          }
        }
      }
      close();
    });
    cancel.addEventListener('click', close);

    picker._date = date; picker._timeStart = timeStart; picker._timeEnd = timeEnd; picker._close = close; picker._applyTheme = applyPickerTheme;
    picker._header = header; picker._headerDate = headerDate;
    return picker;
  }

  function openCompactDateTimePicker(input){
    const p = ensurePicker();
    // Ensure container is visible in case a prior bug hid it
    if (p._column && p._column.style.display === 'none') p._column.style.display = 'flex';
    // Re-apply theme in case user toggled dark mode since creation
    if (typeof p._applyTheme === 'function') p._applyTheme();
    pickerTarget = input;

    // Set width based on mode and toggle calendar display
    p.style.width = p._rangeMode ? '640px' : '320px';
    if (p._header) p._header.classList.toggle('range-mode', p._rangeMode);
    if (p._timeEnd) p._timeEnd.style.display = p._rangeMode ? 'inline-block' : 'none';
    
    // Toggle between single and dual calendar with proper cleanup
    const singleCal = p._daysGrid && p._daysGrid.parentElement; // .dtp-cal
    if (p._rangeMode) {
      // Range mode: show dual calendar, hide single calendar
      if (p._dualCalContainer) {
        // Re-attach if previously detached
        if (p._dualDetached && p._column) {
          try { p._column.insertBefore(p._dualCalContainer, p._actions || null); } catch(_){}
          p._dualDetached = false;
        }
        p._dualCalContainer.removeAttribute('hidden');
        p._dualCalContainer.style.display = 'flex';
        p._dualCalContainer.style.flexDirection = 'row';
        p._dualCalContainer.style.flexWrap = 'nowrap';
      }
      if (singleCal) singleCal.style.display = 'none';
    } else {
      // Single mode: show single calendar, hide and clear dual calendar
      if (p._dualCalContainer) {
        p._dualCalContainer.style.display = 'none';
        p._dualCalContainer.setAttribute('hidden','hidden');
        if (p._leftGrid) p._leftGrid.innerHTML = '';
        if (p._rightGrid) p._rightGrid.innerHTML = '';
        try {
          if (p._dualCalContainer.parentElement) {
            p._dualCalContainer.parentElement.removeChild(p._dualCalContainer);
            p._dualDetached = true;
          }
        } catch(_){}
      }
      if (singleCal) singleCal.style.display = 'block';
    }

    // Keyboard navigation and close handlers
    function onKey(e){
      if (!p) return;
      const delta = (days)=>{
        const cur = p._selectedDate || new Date();
        const nd = new Date(cur); nd.setDate(cur.getDate()+days);
        p._selectedDate = nd;
        p._date.value = toDdMmYy(nd);
        if (p._headerDate){
          const f = p._formatLongDateLabel; p._headerDate.textContent = f(nd);
        }
        if (p._rangeMode) {
          const currentDate = nd;
          const leftYear = currentDate.getFullYear();
          const leftMonth = currentDate.getMonth();
          const rightMonth = (leftMonth + 1) % 12;
          const rightYear = leftYear + (leftMonth === 11 ? 1 : 0);
          p._buildDualCalendar(leftYear, leftMonth, rightYear, rightMonth, nd);
        } else {
          p._buildCalendar(nd.getFullYear(), nd.getMonth(), nd);
        }
      };
      if (e.key === 'ArrowLeft'){ e.preventDefault(); delta(-1); }
      else if (e.key === 'ArrowRight'){ e.preventDefault(); delta(1); }
      else if (e.key === 'ArrowUp'){ e.preventDefault(); delta(-7); }
      else if (e.key === 'ArrowDown'){ e.preventDefault(); delta(7); }
      else if (e.key === 'Enter'){ e.preventDefault(); ok.click(); }
      else if (e.key === 'Escape'){ e.preventDefault(); if (typeof p._close === 'function') p._close(); }
      else if (e.key === 'PageUp'){ 
        e.preventDefault(); 
        if (p._rangeMode) {
          let leftY = p._leftYear || new Date().getFullYear();
          let leftM = (p._leftMonth || 0) - 1;
          if (leftM < 0) { leftM = 11; leftY--; }
          const rightY = leftY;
          const rightM = (leftM + 1) % 12 === 0 && leftM === 11 ? 0 : (leftM + 1) % 12;
          const actualRightY = leftY + (leftM === 11 ? 1 : 0);
          p._buildDualCalendar(leftY, leftM, actualRightY, rightM, p._selectedDate);
        } else {
          p._buildCalendar((p._viewYear||new Date().getFullYear()), (p._viewMonth||0)-1, p._selectedDate);
        }
      }
      else if (e.key === 'PageDown'){ 
        e.preventDefault(); 
        if (p._rangeMode) {
          let leftY = p._leftYear || new Date().getFullYear();
          let leftM = (p._leftMonth || 0) + 1;
          if (leftM > 11) { leftM = 0; leftY++; }
          const rightY = leftY;
          const rightM = (leftM + 1) % 12;
          const actualRightY = leftY + (leftM === 11 ? 1 : 0);
          p._buildDualCalendar(leftY, leftM, actualRightY, rightM, p._selectedDate);
        } else {
          p._buildCalendar((p._viewYear||new Date().getFullYear()), (p._viewMonth||0)+1, p._selectedDate);
        }
      }
    }
    function onDocDown(ev){
      const within = picker && picker.contains(ev.target);
      const isTarget = input && input.contains && input.contains(ev.target);
      if (!within && !isTarget){ if (typeof p._close === 'function') p._close(); }
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocDown, true);
    p._onKey = onKey; p._onDocDown = onDocDown;

    // Pre-fill from input
    const raw = (input.value||'').trim();
    let iso = '';
    if (isISODateTimeLocal(raw)) iso = raw;
    else if (isCompactDateTime(raw)) iso = parseCompactToISOUTC(raw);
    else if (isHHmm(raw)) iso = canonicalizeDateTimeFieldValue(input.id, raw);
    else if (is4DigitTime(raw)) iso = canonicalizeDateTimeFieldValue(input.id, raw);

    if (iso){
      const compact = formatISOToCompactUTC(iso);
      const parts = compact.split(',');
      p._date.value = parts[0] || '';
      const tp = parts[1] || '00:00';
      if (p._timeStart) p._timeStart.value = tp;
      if (p._rangeMode && p._timeEnd) p._timeEnd.value = tp;
      // derive selected date from compact (dd.mm.yy)
      if (parts[0]){
        const [dd,mm,yy] = parts[0].split('.');
        const yFull = 2000 + parseInt(yy,10);
        p._selectedDate = new Date(yFull, parseInt(mm,10)-1, parseInt(dd,10));
      }
    } else {
      // default to today UTC + 00:00
      const now = new Date();
      const yy = String(now.getUTCFullYear()).slice(-2);
      const mm = pad2(now.getUTCMonth()+1);
      const dd = pad2(now.getUTCDate());
      p._date.value = `${dd}.${mm}.${yy}`;
      if (p._timeStart) p._timeStart.value = '00:00';
      if (p._rangeMode && p._timeEnd) p._timeEnd.value = '00:00';
      p._selectedDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }

    // Update header date label
    if (p._headerDate && p._selectedDate) {
      const f = p._formatLongDateLabel || ((d)=> d ? d.toLocaleDateString() : '');
      if (p._rangeMode && p._rangeStart && p._rangeEnd) p._headerDate.textContent = `${f(p._rangeStart)} — ${f(p._rangeEnd)}`;
      else p._headerDate.textContent = f(p._selectedDate);
    }

    // Build calendar for current view around selected date
    if (typeof p._selectedDate === 'object') {
      if (p._rangeMode && typeof p._buildDualCalendar === 'function') {
        // Initialize dual month state if not set
        if (typeof p._leftMonth === 'undefined') {
          const currentDate = p._selectedDate;
          p._leftMonth = currentDate.getMonth();
          p._leftYear = currentDate.getFullYear();
          p._rightMonth = (currentDate.getMonth() + 1) % 12;
          p._rightYear = currentDate.getFullYear() + (currentDate.getMonth() === 11 ? 1 : 0);
        }
        p._buildDualCalendar(p._leftYear, p._leftMonth, p._rightYear, p._rightMonth, p._selectedDate);
      } else if (typeof p._buildCalendar === 'function') {
        p._buildCalendar(p._selectedDate.getFullYear(), p._selectedDate.getMonth(), p._selectedDate);
      }
    }

    // Position near input with proper height calculation
    const rect = input.getBoundingClientRect();
    const assumedWidth = parseInt(p.style.width,10) || (p._rangeMode ? 640 : 320);
    const assumedHeight = p._rangeMode ? 400 : 350; // More height for dual calendar
    p.style.left = `${Math.min(rect.left, window.innerWidth - assumedWidth - 4)}px`;
    p.style.top = `${Math.min(rect.bottom + 4, window.innerHeight - assumedHeight)}px`;
    // Ensure minimum dimensions before showing
    p.style.minWidth = p._rangeMode ? '640px' : '320px';
    p.style.minHeight = p._rangeMode ? '400px' : '350px';
    p.style.display = 'block';
  }

  // Attach compact behavior to arrival/departure inputs
  function attachCompactDateTimeInputs(root){
    const scope = root || document;
    const inputs = scope.querySelectorAll('input[id^="arrival-time-"], input[id^="departure-time-"]');
    inputs.forEach(attachCompactMask);
  }

  // Centralized init hookup
  window.hangarInitQueue = window.hangarInitQueue || [];
  window.hangarInitQueue.push(function(){
    try{
      transformDateTimeLocalInputsToCompact();
      attachCompactDateTimeInputs();
    } catch(e){ console.warn('Compact datetime init failed', e); }
  });

  // Also react to secondary tile creation
  document.addEventListener('secondaryTilesCreated', function(evt){
    try{
      transformDateTimeLocalInputsToCompact();
      attachCompactDateTimeInputs();
    } catch(e){}
  });

  // Export globals
  window.helpers = window.helpers || {};
  window.helpers.isDateTimeLocal = isDateTimeLocal; // legacy
  window.helpers.isISODateTimeLocal = isISODateTimeLocal;
  window.helpers.isCompactDateTime = isCompactDateTime;
  window.helpers.isHHmm = isHHmm;
  window.helpers.is4DigitTime = is4DigitTime;
  window.helpers.convert4DigitTimeToHHmm = convert4DigitTimeToHHmm;
  window.helpers.getBaseDates = getBaseDates;
  window.helpers.coerceHHmmToDateTimeLocalUtc = coerceHHmmToDateTimeLocalUtc;
  window.helpers.formatDateTimeLocalForPdf = formatDateTimeLocalForPdf;
  window.helpers.addDaysToDateString = addDaysToDateString;
  window.helpers.formatISOToCompactUTC = formatISOToCompactUTC;
  window.helpers.parseCompactToISOUTC = parseCompactToISOUTC;
  window.helpers.canonicalizeDateTimeFieldValue = canonicalizeDateTimeFieldValue;
  window.helpers.attachCompactDateTimeInputs = attachCompactDateTimeInputs;
  window.helpers.transformDateTimeLocalInputsToCompact = transformDateTimeLocalInputsToCompact;
  window.helpers.openCompactDateTimePicker = openCompactDateTimePicker;

  // Example: open picker in range mode (no bound input)
  window.helpers.openRangePickerExample = function(){
    const p = ensurePicker();
    if (typeof p._applyTheme === 'function') p._applyTheme();
    // turn on range mode
    p._rangeMode = true; if (p._rangeCheckbox) p._rangeCheckbox.checked = true;
    const now = new Date();
    p._rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    p._rangeEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate()+3);
    p._selectedDate = new Date(p._rangeStart);
    if (p._header){ p._header.classList.add('range-mode'); }
    if (p._timeStart) p._timeStart.value = '09:00';
    if (p._timeEnd) { p._timeEnd.value = '17:00'; p._timeEnd.style.display='inline-block'; }
    p.style.width = '640px';
    // Set dual month state
    p._leftMonth = p._selectedDate.getMonth();
    p._leftYear = p._selectedDate.getFullYear();
    p._rightMonth = (p._selectedDate.getMonth() + 1) % 12;
    p._rightYear = p._selectedDate.getFullYear() + (p._selectedDate.getMonth() === 11 ? 1 : 0);
    
    // Toggle calendar display
    if (p._dualCalContainer) {
      p._dualCalContainer.style.display = 'flex';
      p._dualCalContainer.style.flexDirection = 'row';
    }
    if (p._daysGrid && p._daysGrid.parentElement) p._daysGrid.parentElement.style.display = 'none';
    
    if (p._headerDate && p._formatLongDateLabel){
      const f=p._formatLongDateLabel; p._headerDate.textContent = `${f(p._rangeStart)} — ${f(p._rangeEnd)}`;
    }
    p._buildDualCalendar(p._leftYear, p._leftMonth, p._rightYear, p._rightMonth, p._selectedDate);
    p._onConfirm = (payload)=>{
      console.log('Range picked:', payload);
      if (typeof p._close === 'function') p._close();
    };
    // show at top-left
    p.style.left = '20px'; p.style.top = '20px'; p.style.display='block';
    // attach close listeners
    function onKey(e){ if (e.key==='Escape'){ if (typeof p._close==='function') p._close(); } }
    function onDocDown(ev){ const within = picker && picker.contains(ev.target); if (!within){ if (typeof p._close==='function') p._close(); } }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocDown, true);
  };
})();
