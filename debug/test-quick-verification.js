/**
 * Schneller Verifikationstest für die HangarData.updateAircraftFromFlightData Funktion
 */

console.log("🧪 Starte schnelle Verifikation...");

// Test 1: Prüfe, ob window.HangarData verfügbar ist
console.log("\n--- Test 1: window.HangarData Verfügbarkeit ---");
if (window.HangarData) {
	console.log("✅ window.HangarData ist verfügbar");
	console.log("HangarData Typ:", typeof window.HangarData);
	console.log("HangarData Eigenschaften:", Object.keys(window.HangarData));
} else {
	console.error("❌ window.HangarData nicht verfügbar");
}

// Test 2: Prüfe, ob updateAircraftFromFlightData Funktion verfügbar ist
console.log("\n--- Test 2: updateAircraftFromFlightData Funktion ---");
if (
	window.HangarData &&
	typeof window.HangarData.updateAircraftFromFlightData === "function"
) {
	console.log("✅ HangarData.updateAircraftFromFlightData ist verfügbar");
	console.log(
		"Funktionstyp:",
		typeof window.HangarData.updateAircraftFromFlightData
	);
} else {
	console.error("❌ HangarData.updateAircraftFromFlightData nicht verfügbar");
}

// Test 3: Prüfe, ob window.hangarData auch noch verfügbar ist (Rückwärtskompatibilität)
console.log("\n--- Test 3: window.hangarData Rückwärtskompatibilität ---");
if (
	window.hangarData &&
	typeof window.hangarData.updateAircraftFromFlightData === "function"
) {
	console.log(
		"✅ hangarData.updateAircraftFromFlightData (klein h) ist auch verfügbar"
	);
} else {
	console.error(
		"❌ hangarData.updateAircraftFromFlightData (klein h) nicht verfügbar"
	);
}

// Test 4: Identitätsprüfung
console.log("\n--- Test 4: Alias-Identitätsprüfung ---");
if (window.HangarData === window.hangarData) {
	console.log("✅ HangarData und hangarData sind identisch (korrekter Alias)");
} else {
	console.error("❌ HangarData und hangarData sind nicht identisch");
}

console.log("\n🎯 Verifikation abgeschlossen");
