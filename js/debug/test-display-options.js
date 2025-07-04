/**
 * Test-Skript für Display Options und Settings-Synchronisation
 * Dieses Skript kann in der Browser-Konsole ausgeführt werden
 */

(function () {
	console.log("🧪 === DISPLAY OPTIONS TEST GESTARTET ===");

	// Test 1: Prüfe ob Display Options verfügbar sind
	console.log("Test 1: Display Options Verfügbarkeit");
	if (window.displayOptions) {
		console.log("✅ window.displayOptions ist verfügbar");
		console.log("Aktuelle Werte:", window.displayOptions.current);
	} else {
		console.log("❌ window.displayOptions ist NICHT verfügbar");
		return;
	}

	// Test 2: Prüfe Server-Sync System
	console.log("\nTest 2: Server-Sync System");
	if (window.serverSync) {
		console.log("✅ window.serverSync ist verfügbar");
	} else {
		console.log("❌ window.serverSync ist NICHT verfügbar");
	}

	// Test 3: Prüfe UI-Elemente
	console.log("\nTest 3: UI-Elemente");
	const uiElements = [
		"tilesCount",
		"secondaryTilesCount",
		"layoutType",
		"darkModeToggle",
		"viewModeToggle",
		"displayZoom",
		"updateTilesBtn",
		"updateSecondaryTilesBtn",
	];

	uiElements.forEach((id) => {
		const element = document.getElementById(id);
		if (element) {
			console.log(
				`✅ ${id}: gefunden (Typ: ${element.tagName}, Wert: ${
					element.value || element.checked
				})`
			);
		} else {
			console.log(`❌ ${id}: NICHT gefunden`);
		}
	});

	// Test 4: Teste Speichern und Laden
	console.log("\nTest 4: Speichern/Laden Test");

	// Originale Werte sichern
	const originalValues = { ...window.displayOptions.current };
	console.log("Originale Werte:", originalValues);

	// Test-Werte setzen
	const testValues = {
		tilesCount: 6,
		secondaryTilesCount: 2,
		layout: 3,
		darkMode: !originalValues.darkMode,
		viewMode: !originalValues.viewMode,
		zoomLevel: 120,
	};

	window.displayOptions.current = { ...testValues };
	console.log("Test-Werte gesetzt:", testValues);

	// UI aktualisieren
	window.displayOptions.updateUI();
	console.log("✅ UI mit Test-Werten aktualisiert");

	// Speichern testen
	window.displayOptions
		.saveToServer()
		.then((success) => {
			if (success) {
				console.log("✅ Speichern erfolgreich");

				// Werte zurücksetzen und laden testen
				window.displayOptions.current = { ...originalValues };
				return window.displayOptions.loadFromServer();
			} else {
				console.log("❌ Speichern fehlgeschlagen");
				return false;
			}
		})
		.then((success) => {
			if (success) {
				console.log("✅ Laden erfolgreich");
				console.log("Geladene Werte:", window.displayOptions.current);

				// Prüfe ob Test-Werte korrekt geladen wurden
				const isCorrect = Object.keys(testValues).every(
					(key) => window.displayOptions.current[key] === testValues[key]
				);

				if (isCorrect) {
					console.log("✅ Alle Test-Werte korrekt geladen!");
				} else {
					console.log("❌ Test-Werte nicht korrekt geladen");
					console.log("Erwartet:", testValues);
					console.log("Erhalten:", window.displayOptions.current);
				}
			} else {
				console.log("❌ Laden fehlgeschlagen");
			}

			// Originale Werte wiederherstellen
			window.displayOptions.current = { ...originalValues };
			window.displayOptions.updateUI();
			console.log("🔄 Originale Werte wiederhergestellt");

			console.log("🧪 === DISPLAY OPTIONS TEST BEENDET ===");
		})
		.catch((error) => {
			console.error("❌ Test-Fehler:", error);

			// Originale Werte wiederherstellen
			window.displayOptions.current = { ...originalValues };
			window.displayOptions.updateUI();
			console.log("🔄 Originale Werte nach Fehler wiederhergestellt");
		});
})();
