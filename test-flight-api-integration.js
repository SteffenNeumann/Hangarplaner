/**
 * Test-Skript für die Flugdaten-API-Integration
 * Testet die komplette Kette: Datumseintragung → API-Aufruf → UI-Update
 */

console.log("🧪 Starte Test der Flugdaten-API-Integration...");

// Test 1: Automatische Datumseintragung
function testAutomaticDateSetup() {
    console.log("\n--- Test 1: Automatische Datumseintragung ---");
    
    const currentDateInput = document.getElementById("currentDateInput");
    const nextDateInput = document.getElementById("nextDateInput");
    
    if (currentDateInput && nextDateInput) {
        console.log(`✅ Aktuelles Datum: ${currentDateInput.value}`);
        console.log(`✅ Folgetag: ${nextDateInput.value}`);
        
        // Validierung der Datumsformate
        const currentDate = new Date(currentDateInput.value);
        const nextDate = new Date(nextDateInput.value);
        const dayDifference = (nextDate - currentDate) / (1000 * 60 * 60 * 24);
        
        if (dayDifference === 1) {
            console.log("✅ Datumsdifferenz ist korrekt (1 Tag)");
            return true;
        } else {
            console.error(`❌ Datumsdifferenz ist falsch: ${dayDifference} Tage`);
            return false;
        }
    } else {
        console.error("❌ Datumsfelder nicht gefunden");
        return false;
    }
}

// Test 2: API-Fassade Verfügbarkeit
function testAPIFacadeAvailability() {
    console.log("\n--- Test 2: API-Fassade Verfügbarkeit ---");
    
    if (window.FlightDataAPI) {
        console.log("✅ FlightDataAPI verfügbar");
        
        if (typeof window.FlightDataAPI.updateAircraftData === 'function') {
            console.log("✅ updateAircraftData Funktion verfügbar");
            return true;
        } else {
            console.error("❌ updateAircraftData Funktion nicht verfügbar");
            return false;
        }
    } else {
        console.error("❌ FlightDataAPI nicht verfügbar");
        return false;
    }
}

// Test 3: HangarData Update-Funktion
function testHangarDataUpdateFunction() {
    console.log("\n--- Test 3: HangarData Update-Funktion ---");
    
    if (window.HangarData && typeof window.HangarData.updateAircraftFromFlightData === 'function') {
        console.log("✅ HangarData.updateAircraftFromFlightData verfügbar");
        return true;
    } else {
        console.error("❌ HangarData.updateAircraftFromFlightData nicht verfügbar");
        return false;
    }
}

// Test 4: Event-Handler für Update-Button
function testUpdateButtonEventHandler() {
    console.log("\n--- Test 4: Event-Handler für Update-Button ---");
    
    const updateButton = document.getElementById("fetchFlightData");
    if (updateButton) {
        console.log("✅ Update-Button gefunden");
        
        if (updateButton.onclick) {
            console.log("✅ Event-Handler vorhanden");
            return true;
        } else {
            console.error("❌ Kein Event-Handler am Update-Button");
            return false;
        }
    } else {
        console.error("❌ Update-Button nicht gefunden");
        return false;
    }
}

// Test 5: Simuliere API-Aufruf (Mock-Test)
async function testMockAPICall() {
    console.log("\n--- Test 5: Mock API-Aufruf ---");
    
    // Mock-Flugdaten
    const mockFlightData = {
        originCode: "MUC",
        destCode: "FRA",
        arrivalTime: "14:30",
        departureTime: "16:45",
        positionText: "MUC → FRA",
        data: [
            {
                flight: { number: "LH123" },
                aircraft: { model: "A320" }
            }
        ],
        _isUtc: false
    };
    
    try {
        // Simuliere UI-Update mit Mock-Daten
        if (window.HangarData && window.HangarData.updateAircraftFromFlightData) {
            // Erstelle eine Test-Kachel mit Aircraft ID
            const testAircraftId = "D-TEST";
            
            // Suche nach einer leeren Kachel für den Test
            const firstAircraftInput = document.querySelector('input[id^="aircraft-"]');
            if (firstAircraftInput) {
                const originalValue = firstAircraftInput.value;
                firstAircraftInput.value = testAircraftId;
                
                // Teste die Update-Funktion
                window.HangarData.updateAircraftFromFlightData(testAircraftId, mockFlightData);
                
                // Prüfe, ob Werte aktualisiert wurden
                const cellId = firstAircraftInput.id.split('-')[1];
                const arrivalInput = document.querySelector(`#arrival-${cellId}`);
                const departureInput = document.querySelector(`#departure-${cellId}`);
                const positionInput = document.querySelector(`#position-${cellId}`);
                
                let testPassed = true;
                if (arrivalInput && arrivalInput.value === "14:30") {
                    console.log("✅ Ankunftszeit korrekt gesetzt");
                } else {
                    console.error("❌ Ankunftszeit nicht korrekt gesetzt");
                    testPassed = false;
                }
                
                if (departureInput && departureInput.value === "16:45") {
                    console.log("✅ Abflugzeit korrekt gesetzt");
                } else {
                    console.error("❌ Abflugzeit nicht korrekt gesetzt");
                    testPassed = false;
                }
                
                if (positionInput && positionInput.value === "MUC → FRA") {
                    console.log("✅ Position korrekt gesetzt");
                } else {
                    console.error("❌ Position nicht korrekt gesetzt");
                    testPassed = false;
                }
                
                // Ursprünglichen Wert wiederherstellen
                firstAircraftInput.value = originalValue;
                if (arrivalInput) arrivalInput.value = "";
                if (departureInput) departureInput.value = "";
                if (positionInput) positionInput.value = "";
                
                return testPassed;
            } else {
                console.error("❌ Keine Kachel für Test gefunden");
                return false;
            }
        } else {
            console.error("❌ Update-Funktion nicht verfügbar");
            return false;
        }
    } catch (error) {
        console.error("❌ Fehler beim Mock-Test:", error);
        return false;
    }
}

// Alle Tests ausführen
async function runAllTests() {
    console.log("🧪 Starte vollständige Testsuite...\n");
    
    const results = [];
    
    results.push({ name: "Automatische Datumseintragung", passed: testAutomaticDateSetup() });
    results.push({ name: "API-Fassade Verfügbarkeit", passed: testAPIFacadeAvailability() });
    results.push({ name: "HangarData Update-Funktion", passed: testHangarDataUpdateFunction() });
    results.push({ name: "Event-Handler Update-Button", passed: testUpdateButtonEventHandler() });
    results.push({ name: "Mock API-Aufruf", passed: await testMockAPICall() });
    
    // Zusammenfassung
    console.log("\n🎯 TESTERGEBNISSE:");
    console.log("==================");
    
    const passedTests = results.filter(r => r.passed).length;
    const totalTests = results.length;
    
    results.forEach(result => {
        const symbol = result.passed ? "✅" : "❌";
        console.log(`${symbol} ${result.name}`);
    });
    
    console.log(`\n📊 ${passedTests}/${totalTests} Tests bestanden`);
    
    if (passedTests === totalTests) {
        console.log("🎉 Alle Tests erfolgreich! Die Flugdaten-API-Integration funktioniert korrekt.");
    } else {
        console.log("⚠️ Einige Tests fehlgeschlagen. Bitte prüfen Sie die Implementierung.");
    }
    
    return { passedTests, totalTests, results };
}

// Tests nach dem DOM-Load ausführen
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runAllTests, 2000); // 2 Sekunden warten für vollständige Initialisierung
    });
} else {
    setTimeout(runAllTests, 2000);
}

// Globale Verfügbarkeit für manuelle Tests
window.testFlightAPIIntegration = runAllTests;
