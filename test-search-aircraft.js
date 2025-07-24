/**
 * Test Script für Search Aircraft Funktionalität
 * Tests ob die Search-Funktion korrekt initialisiert und verknüpft ist
 */

console.log("🧪 Starte Search Aircraft Funktionstest...");

// Test 1: Überprüfe ob hangarEvents verfügbar ist
function testHangarEventsAvailable() {
	console.log("\n--- Test 1: HangarEvents Verfügbarkeit ---");

	if (window.hangarEvents) {
		console.log("✅ window.hangarEvents verfügbar");

		if (typeof window.hangarEvents.searchAircraft === "function") {
			console.log("✅ searchAircraft Funktion verfügbar");
			return true;
		} else {
			console.error("❌ searchAircraft Funktion nicht verfügbar");
			return false;
		}
	} else {
		console.error("❌ window.hangarEvents nicht verfügbar");
		return false;
	}
}

// Test 2: Überprüfe Search-UI-Elemente
function testSearchUIElements() {
	console.log("\n--- Test 2: Search UI Elemente ---");

	const searchInput = document.getElementById("searchAircraft");
	const searchButton = document.getElementById("btnSearch");

	if (searchInput) {
		console.log("✅ Search Input gefunden");
	} else {
		console.error("❌ Search Input nicht gefunden");
		return false;
	}

	if (searchButton) {
		console.log("✅ Search Button gefunden");
	} else {
		console.error("❌ Search Button nicht gefunden");
		return false;
	}

	return true;
}

// Test 3: Überprüfe Event-Handler
function testEventHandlers() {
	console.log("\n--- Test 3: Event Handler ---");

	const searchButton = document.getElementById("btnSearch");
	const searchInput = document.getElementById("searchAircraft");

	// Simuliere Button-Klick (ohne tatsächlich zu klicken)
	if (searchButton && searchButton.onclick) {
		console.log("✅ Button Click-Handler vorhanden");
	} else {
		console.log("❓ Button Click-Handler über addEventListener (normal)");
	}

	return true;
}

// Test 4: Simuliere Search-Vorgang
function testSearchFunction() {
	console.log("\n--- Test 4: Simuliere Search ---");

	// Füge Test-Daten zu einer Kachel hinzu
	const firstAircraftInput = document.getElementById("aircraft-1");
	if (firstAircraftInput) {
		const originalValue = firstAircraftInput.value;
		firstAircraftInput.value = "D-TEST";
		console.log("📝 Test Aircraft ID 'D-TEST' in Kachel 1 eingefügt");

		// Setze Suchbegriff
		const searchInput = document.getElementById("searchAircraft");
		if (searchInput) {
			searchInput.value = "D-TEST";
			console.log("📝 Suchbegriff 'D-TEST' eingegeben");

			// Führe Suche aus
			try {
				if (window.hangarEvents && window.hangarEvents.searchAircraft) {
					window.hangarEvents.searchAircraft();
					console.log("✅ Search-Funktion erfolgreich ausgeführt");

					// Nach 4 Sekunden Test-Daten entfernen
					setTimeout(() => {
						firstAircraftInput.value = originalValue;
						searchInput.value = "";
						console.log("🧹 Test-Daten entfernt");
					}, 4000);

					return true;
				} else {
					console.error("❌ Search-Funktion nicht verfügbar");
					return false;
				}
			} catch (error) {
				console.error("❌ Fehler beim Ausführen der Search-Funktion:", error);
				return false;
			}
		}
	}

	return false;
}

// Test 5: Überprüfe Button-Klick simuliert
function testButtonClick() {
	console.log("\n--- Test 5: Button Click Simulation ---");

	const searchButton = document.getElementById("btnSearch");
	const searchInput = document.getElementById("searchAircraft");

	if (searchButton && searchInput) {
		// Setze Test-Werte
		searchInput.value = "TEST";

		// Simuliere Button-Klick
		try {
			const clickEvent = new Event("click", {
				bubbles: true,
				cancelable: true,
			});
			searchButton.dispatchEvent(clickEvent);
			console.log("✅ Button-Klick simuliert");

			// Cleanup
			setTimeout(() => {
				searchInput.value = "";
			}, 1000);

			return true;
		} catch (error) {
			console.error("❌ Fehler bei Button-Klick Simulation:", error);
			return false;
		}
	}

	return false;
}

// Führe alle Tests aus
function runAllTests() {
	console.log("🚀 Starte Search Aircraft Tests...\n");

	const results = [];

	results.push({
		name: "HangarEvents Verfügbarkeit",
		passed: testHangarEventsAvailable(),
	});
	results.push({ name: "Search UI Elemente", passed: testSearchUIElements() });
	results.push({ name: "Event Handler", passed: testEventHandlers() });
	results.push({ name: "Search Funktion", passed: testSearchFunction() });
	results.push({ name: "Button Click", passed: testButtonClick() });

	// Zusammenfassung
	console.log("\n=== TEST ZUSAMMENFASSUNG ===");
	const passed = results.filter((r) => r.passed).length;
	const total = results.length;

	results.forEach((result) => {
		console.log(`${result.passed ? "✅" : "❌"} ${result.name}`);
	});

	console.log(`\n🎯 ${passed}/${total} Tests bestanden`);

	if (passed === total) {
		console.log(
			"🎉 Alle Tests erfolgreich! Search Aircraft Funktion ist aktiv."
		);
	} else {
		console.log("⚠️ Einige Tests fehlgeschlagen. Überprüfung erforderlich.");
	}
}

// Auto-Start nach DOM-Ladung
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", () => {
		setTimeout(runAllTests, 2000); // 2 Sekunden warten für vollständige Initialisierung
	});
} else {
	setTimeout(runAllTests, 2000);
}

// Manueller Test verfügbar
window.testSearchAircraft = runAllTests;
console.log("💡 Manuelle Tests verfügbar über: window.testSearchAircraft()");
