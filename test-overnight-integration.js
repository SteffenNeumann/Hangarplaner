/**
 * Test script to verify the overnight flights integration is working correctly
 * 
 * This script can be run in the browser console to test the new airport-first
 * overnight processing functionality.
 */

console.log("🧪 === OVERNIGHT FLIGHTS INTEGRATION TEST ===");

async function testOvernightIntegration() {
    try {
        console.log("1️⃣ Testing AeroDataBoxAPI availability...");
        
        if (!window.AeroDataBoxAPI) {
            console.error("❌ AeroDataBoxAPI not found!");
            return false;
        }
        
        if (!window.AeroDataBoxAPI.processOvernightFlightsCorrectly) {
            console.error("❌ processOvernightFlightsCorrectly function not found!");
            return false;
        }
        
        console.log("✅ AeroDataBoxAPI and function are available");
        
        console.log("2️⃣ Testing UI elements...");
        
        const button = document.getElementById("processOvernightFlightsBtn");
        if (!button) {
            console.error("❌ Process Overnight Flights button not found!");
            return false;
        }
        
        const statusPanel = document.getElementById("overnightFlightsStatus");
        if (!statusPanel) {
            console.error("❌ Overnight flights status panel not found!");
            return false;
        }
        
        const statusMessage = document.getElementById("overnightFlightsMessage");
        if (!statusMessage) {
            console.error("❌ Overnight flights status message element not found!");
            return false;
        }
        
        console.log("✅ All UI elements found");
        
        console.log("3️⃣ Testing input fields...");
        
        const airportInput = document.getElementById("airportCodeInput");
        const currentDateInput = document.getElementById("currentDateInput");
        const nextDateInput = document.getElementById("nextDateInput");
        
        if (!airportInput || !currentDateInput || !nextDateInput) {
            console.error("❌ Some input fields are missing!");
            return false;
        }
        
        // Set test values if empty
        if (!airportInput.value) airportInput.value = "MUC";
        if (!currentDateInput.value) {
            const today = new Date().toISOString().split('T')[0];
            currentDateInput.value = today;
        }
        if (!nextDateInput.value) {
            const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            nextDateInput.value = tomorrow;
        }
        
        console.log("✅ Input fields configured:", {
            airport: airportInput.value,
            currentDate: currentDateInput.value,
            nextDate: nextDateInput.value
        });
        
        console.log("4️⃣ Testing some aircraft tiles...");
        
        // Add some test aircraft IDs to the first few tiles
        const testAircraftIds = ["D-ACNL", "D-AIBL", "N12345"];
        let tilesFound = 0;
        
        for (let i = 1; i <= 3; i++) {
            const aircraftInput = document.getElementById(`aircraft-${i}`);
            if (aircraftInput) {
                aircraftInput.value = testAircraftIds[i - 1];
                tilesFound++;
                console.log(`✅ Set tile ${i} to ${testAircraftIds[i - 1]}`);
            }
        }
        
        if (tilesFound === 0) {
            console.error("❌ No aircraft tiles found!");
            return false;
        }
        
        console.log(`✅ ${tilesFound} aircraft tiles configured with test data`);
        
        console.log("5️⃣ Testing button click handler...");
        
        if (!button.onclick) {
            console.error("❌ Button has no click handler!");
            return false;
        }
        
        console.log("✅ Button has click handler");
        
        console.log("6️⃣ Ready for live test!");
        console.log("🟢 You can now click the 'Process Overnight Flights' button to test the functionality");
        
        return true;
        
    } catch (error) {
        console.error("❌ Test failed with error:", error);
        return false;
    }
}

// Test API function directly
async function testDirectApiCall() {
    console.log("🧪 Testing direct API call...");
    
    try {
        const result = await window.AeroDataBoxAPI.processOvernightFlightsCorrectly(
            "MUC", // airport
            new Date().toISOString().split('T')[0], // today
            new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] // tomorrow
        );
        
        console.log("✅ Direct API call result:", result);
        
        return result;
    } catch (error) {
        console.error("❌ Direct API call failed:", error);
        return null;
    }
}

// Run the integration test
testOvernightIntegration().then(success => {
    if (success) {
        console.log("🏆 === INTEGRATION TEST PASSED ===");
        console.log("💡 To test manually:");
        console.log("   1. Ensure aircraft IDs are in tiles 1-3");
        console.log("   2. Check the date fields are set");
        console.log("   3. Click 'Process Overnight Flights' button");
        console.log("   4. Watch the console for detailed logs");
        
        // Offer to run direct test
        console.log("\n🚀 To test the API directly, run:");
        console.log("testDirectApiCall()");
        
    } else {
        console.log("❌ === INTEGRATION TEST FAILED ===");
        console.log("Please check the error messages above and ensure all files are loaded correctly.");
    }
});

// Make functions available for manual testing
window.testOvernightIntegration = testOvernightIntegration;
window.testDirectApiCall = testDirectApiCall;
