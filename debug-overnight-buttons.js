/**
 * Debug script to check which button was actually clicked and what functions are available
 */

console.log("🔍 === OVERNIGHT FLIGHTS BUTTON DEBUG ===");

// Check if buttons exist
const updateDataBtn = document.getElementById("fetchFlightData");
const overnightBtn = document.getElementById("processOvernightFlightsBtn");

console.log("Button status:");
console.log("- Update Data button found:", !!updateDataBtn);
console.log("- Process Overnight Flights button found:", !!overnightBtn);

if (updateDataBtn) {
    console.log("- Update Data button has onclick handler:", !!updateDataBtn.onclick);
}

if (overnightBtn) {
    console.log("- Overnight button has onclick handler:", !!overnightBtn.onclick);
    console.log("- Overnight button text:", overnightBtn.textContent);
    console.log("- Overnight button disabled:", overnightBtn.disabled);
}

// Check API availability
console.log("\nAPI status:");
console.log("- AeroDataBoxAPI available:", !!window.AeroDataBoxAPI);
if (window.AeroDataBoxAPI) {
    console.log("- processOvernightFlightsCorrectly available:", 
        !!window.AeroDataBoxAPI.processOvernightFlightsCorrectly);
}

// Add temporary click listeners to both buttons to see which one is actually being clicked
if (updateDataBtn) {
    const originalUpdateHandler = updateDataBtn.onclick;
    updateDataBtn.onclick = function(event) {
        console.log("🚨 UPDATE DATA BUTTON CLICKED - This should NOT happen for overnight flights!");
        if (originalUpdateHandler) {
            return originalUpdateHandler.call(this, event);
        }
    };
}

if (overnightBtn) {
    const originalOvernightHandler = overnightBtn.onclick;
    overnightBtn.onclick = function(event) {
        console.log("✅ OVERNIGHT FLIGHTS BUTTON CLICKED - This is correct!");
        if (originalOvernightHandler) {
            return originalOvernightHandler.call(this, event);
        }
    };
}

// Test direct function call
console.log("\n🧪 Testing direct API call...");
if (window.AeroDataBoxAPI && window.AeroDataBoxAPI.processOvernightFlightsCorrectly) {
    console.log("You can test the function directly by running:");
    console.log("window.AeroDataBoxAPI.processOvernightFlightsCorrectly('MUC', '2025-08-17', '2025-08-18')");
} else {
    console.log("❌ processOvernightFlightsCorrectly function not available");
}

console.log("\n💡 If you see 'UPDATE DATA BUTTON CLICKED' when you click 'Process Overnight Flights',");
console.log("then there's a button identification issue in the HTML or event handling.");
