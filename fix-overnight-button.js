/**
 * Script to diagnose and fix the overnight flights button issue
 */

console.log("🔧 === FIXING OVERNIGHT FLIGHTS BUTTON ===");

// Check both buttons
const updateDataBtn = document.getElementById("fetchFlightData");
const overnightBtn = document.getElementById("processOvernightFlightsBtn");

console.log("Button status:");
console.log("- Update Data button found:", !!updateDataBtn);
console.log("- Overnight button found:", !!overnightBtn);

if (overnightBtn) {
    console.log("- Overnight button text:", overnightBtn.textContent.trim());
    console.log("- Overnight button has onclick:", !!overnightBtn.onclick);
    
    // Remove any existing handlers and install the correct one
    overnightBtn.onclick = null;
    
    // Install the CORRECT handler that uses the new airport-first approach
    overnightBtn.onclick = async function(event) {
        event.preventDefault();
        
        console.log("🏢 === CORRECT OVERNIGHT BUTTON CLICKED ===");
        
        // Disable button during processing
        overnightBtn.disabled = true;
        const originalText = overnightBtn.textContent;
        overnightBtn.textContent = "Processing...";
        
        try {
            // Get input values
            const airportCode = document.getElementById("airportCodeInput")?.value?.trim().toUpperCase() || "MUC";
            const currentDate = document.getElementById("currentDateInput")?.value || new Date().toISOString().split("T")[0];
            const nextDate = document.getElementById("nextDateInput")?.value || 
                new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
            
            console.log(`🚀 Starting airport-first processing for ${airportCode} from ${currentDate} to ${nextDate}`);
            
            // Show status panel
            const statusPanel = document.getElementById("overnightFlightsStatus");
            const statusMessage = document.getElementById("overnightFlightsMessage");
            
            if (statusPanel) statusPanel.style.display = "block";
            if (statusMessage) statusMessage.textContent = `Analyzing ${airportCode} flights...`;
            
            // Call the CORRECT function
            if (window.AeroDataBoxAPI && window.AeroDataBoxAPI.processOvernightFlightsCorrectly) {
                const result = await window.AeroDataBoxAPI.processOvernightFlightsCorrectly(
                    airportCode,
                    currentDate, 
                    nextDate
                );
                
                if (result && result.success) {
                    console.log("✅ SUCCESS! Airport-first processing completed:", result);
                    
                    if (statusMessage) {
                        statusMessage.textContent = `✅ Found ${result.overnightAircraft} overnight aircraft from ${result.totalFlights} total flights`;
                    }
                    
                    if (window.showNotification) {
                        window.showNotification(
                            `✅ Overnight processing complete: ${result.overnightAircraft} aircraft found at ${result.airport}`,
                            "success"
                        );
                    }
                } else {
                    console.error("❌ Processing failed:", result);
                    if (statusMessage) {
                        statusMessage.textContent = `❌ Processing failed: ${result?.error || 'Unknown error'}`;
                    }
                }
            } else {
                console.error("❌ processOvernightFlightsCorrectly function not available!");
                if (statusMessage) {
                    statusMessage.textContent = "❌ Overnight processing function not available";
                }
            }
            
        } catch (error) {
            console.error("❌ Error during processing:", error);
            
            const statusMessage = document.getElementById("overnightFlightsMessage");
            if (statusMessage) {
                statusMessage.textContent = `❌ Error: ${error.message}`;
            }
        } finally {
            // Re-enable button
            overnightBtn.disabled = false;
            overnightBtn.textContent = originalText;
            
            // Hide status panel after 10 seconds
            setTimeout(() => {
                const statusPanel = document.getElementById("overnightFlightsStatus");
                if (statusPanel) statusPanel.style.display = "none";
            }, 10000);
        }
    };
    
    console.log("✅ FIXED! Overnight button now has correct handler");
    console.log("🟢 You can now click 'Process Overnight Flights' and it should work correctly");
    
} else {
    console.error("❌ Process Overnight Flights button not found!");
}

// Also test the API function availability
console.log("\n🧪 API Function Test:");
if (window.AeroDataBoxAPI?.processOvernightFlightsCorrectly) {
    console.log("✅ processOvernightFlightsCorrectly is available");
    console.log("🚀 You can test it manually with:");
    console.log("window.AeroDataBoxAPI.processOvernightFlightsCorrectly('MUC', '2025-08-17', '2025-08-18')");
} else {
    console.log("❌ processOvernightFlightsCorrectly is NOT available");
}

console.log("\n💡 After running this fix, click the 'Process Overnight Flights' button again");
console.log("You should see: '🏢 === CORRECT OVERNIGHT BUTTON CLICKED ==='");
