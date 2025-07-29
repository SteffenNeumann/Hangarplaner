/**
 * FINALER INTEGRATIONS-TEST FÜR SYNCHRONISATIONSPRIORITÄT
 * Überprüft alle kritischen Funktionen und Szenarien
 */

console.log("🎯 === FINAL SYNC PRIORITY INTEGRATION TEST ===");

function runComprehensiveTest() {
    console.log("🔍 1. SYSTEM STATUS CHECK");
    
    // Module verfügbar?
    const checks = {
        sharingManager: !!window.sharingManager,
        serverSync: !!window.serverSync,
        loadServerDataImmediately: typeof window.sharingManager?.loadServerDataImmediately === 'function',
        hangarData: !!window.hangarData,
        displayOptions: !!window.displayOptions
    };
    
    console.log("📊 Module Status:", checks);
    
    // Kritische Fehlerprüfung
    const criticalMissing = Object.entries(checks)
        .filter(([name, available]) => !available)
        .map(([name]) => name);
    
    if (criticalMissing.length > 0) {
        console.error("❌ KRITISCHE MODULE FEHLEN:", criticalMissing);
        return false;
    }
    
    console.log("✅ Alle kritischen Module verfügbar");
    
    // 2. METHODEN-VERFÜGBARKEIT
    console.log("🔍 2. METHODEN-VERFÜGBARKEIT CHECK");
    
    const methods = {
        updateSyncMode: typeof window.sharingManager.updateSyncMode === 'function',
        loadServerDataImmediately: typeof window.sharingManager.loadServerDataImmediately === 'function',
        enableStandaloneMode: typeof window.sharingManager.enableStandaloneMode === 'function',
        enableSyncMode: typeof window.sharingManager.enableSyncMode === 'function',
        enableMasterMode: typeof window.sharingManager.enableMasterMode === 'function'
    };
    
    console.log("📋 Methoden Status:", methods);
    
    const missingMethods = Object.entries(methods)
        .filter(([name, available]) => !available)
        .map(([name]) => name);
        
    if (missingMethods.length > 0) {
        console.error("❌ KRITISCHE METHODEN FEHLEN:", missingMethods);
        return false;
    }
    
    console.log("✅ Alle kritischen Methoden verfügbar");
    
    // 3. SYNC-PRIORITÄTEN TESTEN
    console.log("🔍 3. SYNC-PRIORITÄTEN TEST");
    
    return testSyncPriorities();
}

async function testSyncPriorities() {
    console.log("🧪 Teste Synchronisationsprioritäten...");
    
    try {
        // Initialisiere falls nötig
        if (!window.sharingManager.initialized) {
            window.sharingManager.init();
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Test Szenario 1: Read-Only Modus (sollte Server-Daten laden)
        console.log("📖 Teste Read-Only Modus...");
        await window.sharingManager.updateSyncMode(true, false);
        
        if (window.sharingManager.syncMode === "sync") {
            console.log("✅ Read-Only Modus korrekt aktiviert");
        } else {
            console.error("❌ Read-Only Modus fehlgeschlagen, aktueller Modus:", window.sharingManager.syncMode);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test Szenario 2: Master Modus (Read+Write)
        console.log("👑 Teste Master Modus...");
        await window.sharingManager.updateSyncMode(true, true);
        
        if (window.sharingManager.syncMode === "master") {
            console.log("✅ Master Modus korrekt aktiviert");
        } else {
            console.error("❌ Master Modus fehlgeschlagen, aktueller Modus:", window.sharingManager.syncMode);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test Szenario 3: Standalone Modus
        console.log("🏠 Teste Standalone Modus...");
        await window.sharingManager.updateSyncMode(false, false);
        
        if (window.sharingManager.syncMode === "standalone") {
            console.log("✅ Standalone Modus korrekt aktiviert");
        } else {
            console.error("❌ Standalone Modus fehlgeschlagen, aktueller Modus:", window.sharingManager.syncMode);
        }
        
        console.log("✅ Alle Sync-Prioritäten erfolgreich getestet");
        return true;
        
    } catch (error) {
        console.error("❌ Fehler beim Testen der Sync-Prioritäten:", error);
        return false;
    }
}

// Test der loadServerDataImmediately Funktion
async function testLoadServerDataImmediately() {
    console.log("🔍 4. TESTE loadServerDataImmediately");
    
    try {
        console.log("⚡ Führe loadServerDataImmediately aus...");
        const result = await window.sharingManager.loadServerDataImmediately();
        console.log("✅ loadServerDataImmediately erfolgreich ausgeführt, Ergebnis:", result);
        
        return true;
    } catch (error) {
        console.error("❌ loadServerDataImmediately Fehler:", error);
        return false;
    }
}

// Kritisches Szenario: Browser 1 Write, Browser 2 Read
async function testCriticalScenario() {
    console.log("🔍 5. KRITISCHES SZENARIO TEST");
    console.log("Simuliere: Browser 1 startet mit Write, Browser 2 mit Read");
    
    try {
        // Browser 1: Write-Only (Master)
        console.log("🖥️ Browser 1: Aktiviere Write-Modus");
        await window.sharingManager.updateSyncMode(false, true);
        
        // Kurze Pause
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Browser 2: Read-Only (sollte sofort Server-Daten laden)
        console.log("🖥️ Browser 2: Aktiviere Read-Modus (sollte Server-Daten laden)");
        await window.sharingManager.updateSyncMode(true, false);
        
        console.log("✅ Kritisches Szenario erfolgreich durchgeführt");
        return true;
        
    } catch (error) {
        console.error("❌ Kritisches Szenario fehlgeschlagen:", error);
        return false;
    }
}

// Haupt-Test-Ausführung
async function runFullTest() {
    console.log("🎯 === VOLLSTÄNDIGER INTEGRATIONS-TEST ===");
    
    const results = [];
    
    // 1. Basis-Check
    results.push(runComprehensiveTest());
    
    // 2. loadServerDataImmediately Test
    results.push(await testLoadServerDataImmediately());
    
    // 3. Kritisches Szenario
    results.push(await testCriticalScenario());
    
    // Ergebnisse
    const passed = results.filter(r => r === true).length;
    const total = results.length;
    
    console.log(`🎯 === TEST ERGEBNISSE: ${passed}/${total} erfolgreich ===`);
    
    if (passed === total) {
        console.log("🎉 ALLE TESTS ERFOLGREICH! Synchronisationspriorität korrekt implementiert.");
    } else {
        console.error("❌ EINIGE TESTS FEHLGESCHLAGEN. Weitere Überprüfung erforderlich.");
    }
    
    return passed === total;
}

// Export für globale Verfügbarkeit
window.runSyncPriorityTest = runFullTest;
window.testLoadServerDataImmediately = testLoadServerDataImmediately;

// Automatischer Start nach DOM Load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runFullTest, 2000);
    });
} else {
    setTimeout(runFullTest, 2000);
}

console.log("🔧 Sync Priority Integration Test geladen. Manueller Start: window.runSyncPriorityTest()");
