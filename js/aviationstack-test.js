/**
 * Aviationstack API Test-Funktionen
 * Für direktes Testen der neuen API-Implementierung
 *
 * Aufruf in Browser-Konsole:
 * - testAviationstackAPI()
 * - testOvernightLogic('D-AIBL')
 * - testFutureFlights('D-AIBL')
 */

// Test der Aviationstack API mit verschiedenen Szenarien
window.testAviationstackAPI = async function (aircraftRegistration = "D-AIBL") {
	console.log("🧪 STARTE AVIATIONSTACK API TESTS 🧪");
	console.log("=====================================");

	try {
		// API verfügbar?
		if (!window.aviationstackAPI) {
			console.error("❌ AviationstackAPI nicht verfügbar!");
			return false;
		}

		console.log("✅ AviationstackAPI gefunden");
		console.log("📋 API Info:", window.aviationstackAPI.getAPIInfo());

		// 1. Basis API-Test
		console.log("\n🔬 TEST 1: Basis API-Test");
		const apiTest = await window.aviationstackAPI.testAPI(aircraftRegistration);
		console.log("API Test Ergebnis:", apiTest);

		// 2. Zukünftige Flüge Test
		console.log("\n🔮 TEST 2: Zukünftige Flüge");
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		const tomorrowStr = tomorrow.toISOString().split("T")[0];

		const futureFlights = await window.aviationstackAPI.getFutureFlights(
			aircraftRegistration,
			{
				flight_date: tomorrowStr,
				limit: 5,
			}
		);
		console.log(`Zukünftige Flüge für ${aircraftRegistration}:`, futureFlights);

		// 3. Übernachtungslogik Test
		console.log("\n🌙 TEST 3: Übernachtungslogik");
		const overnightData = await window.aviationstackAPI.getOvernightFlights(
			aircraftRegistration
		);
		console.log("Übernachtungsdaten:", overnightData);

		if (overnightData.overnight) {
			console.log("✅ Übernachtung erkannt!");
		} else {
			console.log("ℹ️ Keine Übernachtung erkannt");
		}

		// 4. API-Facade Integration Test
		console.log("\n🔄 TEST 4: API-Facade Integration");

		// Provider auf Aviationstack setzen
		window.FlightDataAPI.setProvider("aviationstack");
		console.log("✅ Provider auf Aviationstack gesetzt");

		const today = new Date().toISOString().split("T")[0];
		const facadeResult = await window.FlightDataAPI.updateAircraftData(
			aircraftRegistration,
			today,
			tomorrowStr
		);

		console.log("API-Facade Ergebnis:", facadeResult);

		console.log("\n🎉 ALLE TESTS ABGESCHLOSSEN 🎉");
		console.log("============================");

		return {
			success: true,
			tests: {
				apiTest,
				futureFlights: futureFlights.length,
				overnightData,
				facadeResult,
			},
		};
	} catch (error) {
		console.error("❌ TEST FEHLER:", error);
		return {
			success: false,
			error: error.message,
		};
	}
};

// Spezifischer Test für Übernachtungslogik
window.testOvernightLogic = async function (aircraftRegistration = "D-AIBL") {
	console.log(`🌙 TESTE ÜBERNACHTUNGSLOGIK FÜR ${aircraftRegistration}`);

	try {
		const result = await window.aviationstackAPI.getOvernightFlights(
			aircraftRegistration
		);

		console.log("📊 ÜBERNACHTUNGSLOGIK ERGEBNIS:");
		console.log(`Aircraft: ${result.aircraft}`);
		console.log(`Heute: ${result.today.length} Flüge`);
		console.log(`Morgen: ${result.tomorrow.length} Flüge`);
		console.log(`Übernachtung: ${result.overnight ? "JA" : "NEIN"}`);

		if (result.today.length > 0) {
			console.log("\n✈️ HEUTIGE FLÜGE:");
			result.today.forEach((flight, i) => {
				console.log(
					`${i + 1}. ${flight.route} - Status: ${flight.flight_status}`
				);
				if (flight.departure.scheduled)
					console.log(
						`   Abflug: ${new Date(
							flight.departure.scheduled
						).toLocaleString()}`
					);
				if (flight.arrival.scheduled)
					console.log(
						`   Ankunft: ${new Date(flight.arrival.scheduled).toLocaleString()}`
					);
			});
		}

		if (result.tomorrow.length > 0) {
			console.log("\n🌅 MORGIGE FLÜGE:");
			result.tomorrow.forEach((flight, i) => {
				console.log(
					`${i + 1}. ${flight.route} - Status: ${flight.flight_status}`
				);
				if (flight.departure.scheduled)
					console.log(
						`   Abflug: ${new Date(
							flight.departure.scheduled
						).toLocaleString()}`
					);
				if (flight.arrival.scheduled)
					console.log(
						`   Ankunft: ${new Date(flight.arrival.scheduled).toLocaleString()}`
					);
			});
		}

		return result;
	} catch (error) {
		console.error("❌ Übernachtungslogik Test Fehler:", error);
		throw error;
	}
};

// Test für zukünftige Flüge
window.testFutureFlights = async function (
	aircraftRegistration = "D-AIBL",
	days = 3
) {
	console.log(
		`🔮 TESTE ZUKÜNFTIGE FLÜGE FÜR ${aircraftRegistration} (nächste ${days} Tage)`
	);

	try {
		const results = [];

		for (let i = 1; i <= days; i++) {
			const date = new Date();
			date.setDate(date.getDate() + i);
			const dateStr = date.toISOString().split("T")[0];

			console.log(`\n📅 Tag +${i} (${dateStr}):`);

			const flights = await window.aviationstackAPI.getFutureFlights(
				aircraftRegistration,
				{
					flight_date: dateStr,
					limit: 10,
				}
			);

			console.log(`   Gefunden: ${flights.length} Flüge`);

			flights.forEach((flight, j) => {
				console.log(`   ${j + 1}. ${flight.route} [${flight.flight_iata}]`);
				if (flight.departure.scheduled) {
					console.log(
						`      Abflug: ${new Date(
							flight.departure.scheduled
						).toLocaleTimeString()}`
					);
				}
				if (flight.arrival.scheduled) {
					console.log(
						`      Ankunft: ${new Date(
							flight.arrival.scheduled
						).toLocaleTimeString()}`
					);
				}
			});

			results.push({
				date: dateStr,
				flights: flights.length,
				data: flights,
			});
		}

		console.log("\n📈 ZUSAMMENFASSUNG:");
		const totalFlights = results.reduce((sum, day) => sum + day.flights, 0);
		console.log(`Gesamt: ${totalFlights} Flüge in ${days} Tagen`);

		return results;
	} catch (error) {
		console.error("❌ Zukünftige Flüge Test Fehler:", error);
		throw error;
	}
};

// Automatischer Test beim Laden (falls gewünscht)
window.autoTestAviationstack = function () {
	console.log("🚀 Auto-Test Aviationstack API in 3 Sekunden...");
	setTimeout(() => {
		window.testAviationstackAPI("D-AIBL");
	}, 3000);
};

console.log("📝 Aviationstack Test-Funktionen verfügbar:");
console.log("   - testAviationstackAPI() - Vollständiger API-Test");
console.log('   - testOvernightLogic("D-AIBL") - Übernachtungslogik testen');
console.log('   - testFutureFlights("D-AIBL", 3) - Zukünftige Flüge testen');
console.log("   - autoTestAviationstack() - Automatischer Test in 3s");
