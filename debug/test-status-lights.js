/**
 * TEST-SCRIPT FÜR AMPELFARBEN-UPDATES
 * Führe in Browser-Konsole aus: loadScript('/test-status-lights.js')
 */

function testStatusLightUpdates() {
	console.log("🚦 AMPELFARBEN UPDATE TEST GESTARTET");

	// Test 1: Überprüfe verfügbare Funktionen
	console.log("📋 Verfügbare Status-Update Funktionen:");
	console.log(
		"- window.updateAllStatusLights:",
		typeof window.updateAllStatusLights
	);
	console.log(
		"- window.updateAllStatusLightsForced:",
		typeof window.updateAllStatusLightsForced
	);
	console.log(
		"- window.updateStatusLightByCellId:",
		typeof window.updateStatusLightByCellId
	);

	// Test 2: Zähle Status-Selektoren
	const statusSelectors = document.querySelectorAll(".status-selector");
	console.log(`📊 Gefundene Status-Selektoren: ${statusSelectors.length}`);

	statusSelectors.forEach((select, index) => {
		const cellId = select.id.split("-")[1];
		const container = select.closest(".hangar-cell");
		const statusLight = container
			? container.querySelector(".status-light")
			: null;

		console.log(
			`  ${index + 1}. ID: ${select.id}, Wert: ${select.value}, Container: ${
				container ? "gefunden" : "FEHLT"
			}, Licht: ${statusLight ? "gefunden" : "FEHLT"}`
		);
	});

	// Test 3: Zähle Status-Lichter
	const statusLights = document.querySelectorAll(".status-light");
	console.log(`💡 Gefundene Status-Lichter: ${statusLights.length}`);

	statusLights.forEach((light, index) => {
		console.log(
			`  ${index + 1}. data-cell: ${light.getAttribute(
				"data-cell"
			)}, data-status: ${light.getAttribute("data-status")}, Klassen: ${
				light.className
			}`
		);
	});

	// Test 4: Teste normale Update-Funktion
	if (typeof window.updateAllStatusLights === "function") {
		console.log("\n🔧 Teste normale updateAllStatusLights...");
		const updated = window.updateAllStatusLights();
		console.log(`✅ Normal aktualisiert: ${updated} Lichter`);
	}

	// Test 5: Teste erzwungene Update-Funktion
	if (typeof window.updateAllStatusLightsForced === "function") {
		console.log("\n🔧 Teste erzwungene updateAllStatusLightsForced...");
		const updated = window.updateAllStatusLightsForced();
		console.log(`✅ Erzwungen aktualisiert: ${updated} Lichter`);
	}

	// Test 6: Teste einzelne Kachel-Updates
	console.log("\n🔧 Teste einzelne Kachel-Updates...");
	statusSelectors.forEach((select, index) => {
		if (index < 3) {
			// Nur die ersten 3 testen
			const cellId = select.id.split("-")[1];
			if (typeof window.updateStatusLightByCellId === "function") {
				const success = window.updateStatusLightByCellId(cellId);
				console.log(
					`  Kachel ${cellId}: ${success ? "erfolgreich" : "fehlgeschlagen"}`
				);
			}
		}
	});

	console.log("\n✅ Ampelfarben Update Test abgeschlossen");
}

// Test für spezifische Synchronisations-Szenarien
function testSyncScenarios() {
	console.log("🔄 SYNC-SZENARIO TEST GESTARTET");

	// Simuliere dataLoaded Event
	console.log("\n📊 Simuliere dataLoaded Event...");
	const dataLoadedEvent = new CustomEvent("dataLoaded", {
		detail: { source: "test" },
	});
	document.dispatchEvent(dataLoadedEvent);

	setTimeout(() => {
		// Simuliere secondaryTilesCreated Event
		console.log("\n🎯 Simuliere secondaryTilesCreated Event...");
		const secondaryEvent = new CustomEvent("secondaryTilesCreated", {
			detail: { count: 4, cellIds: [101, 102, 103, 104] },
		});
		document.dispatchEvent(secondaryEvent);
	}, 1000);

	setTimeout(() => {
		console.log("\n✅ Sync-Szenario Test abgeschlossen");
	}, 2000);
}

// Debug-Funktion für problematische Kacheln
function debugProblematicTiles() {
	console.log("🔍 DEBUG PROBLEMATISCHE KACHELN");

	const statusSelectors = document.querySelectorAll(".status-selector");
	const problematicTiles = [];

	statusSelectors.forEach((select) => {
		const cellId = select.id.split("-")[1];
		const container = select.closest(".hangar-cell");
		const statusLight = container
			? container.querySelector(".status-light")
			: null;

		if (!container || !statusLight) {
			problematicTiles.push({
				id: select.id,
				cellId: cellId,
				hasContainer: !!container,
				hasStatusLight: !!statusLight,
				value: select.value,
			});
		}
	});

	if (problematicTiles.length > 0) {
		console.log(
			`❌ Gefunden ${problematicTiles.length} problematische Kacheln:`
		);
		problematicTiles.forEach((tile) => {
			console.log(
				`  - ${tile.id}: Container=${tile.hasContainer}, Licht=${tile.hasStatusLight}, Wert=${tile.value}`
			);
		});
	} else {
		console.log("✅ Alle Kacheln haben Container und Status-Lichter");
	}

	// Zeige Informationen über primäre vs sekundäre Kacheln
	console.log("\n📊 Verteilung primäre vs sekundäre Kacheln:");
	let primaryCount = 0;
	let secondaryCount = 0;

	statusSelectors.forEach((select) => {
		const cellId = parseInt(select.id.split("-")[1]);
		if (cellId <= 100) {
			primaryCount++;
		} else {
			secondaryCount++;
		}
	});

	console.log(`  Primäre Kacheln (≤100): ${primaryCount}`);
	console.log(`  Sekundäre Kacheln (>100): ${secondaryCount}`);
}

// Lade Test-Funktionen
console.log("🔧 Ampelfarben Test-Funktionen geladen");
console.log("Führe testStatusLightUpdates() aus, um die Ampelfarben zu testen");
console.log("Führe testSyncScenarios() aus, um Sync-Events zu simulieren");
console.log(
	"Führe debugProblematicTiles() aus, um problematische Kacheln zu finden"
);
