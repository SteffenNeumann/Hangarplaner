(function () {
  function toDateStr(date) {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function nextDateStr(dateStr) {
    try {
      const [y, m, d] = dateStr.split("-").map((v) => parseInt(v, 10));
      const dt = new Date(y, m - 1, d);
      dt.setDate(dt.getDate() + 1);
      return toDateStr(dt);
    } catch (e) {
      const t = new Date();
      t.setDate(t.getDate() + 1);
      return toDateStr(t);
    }
  }

  async function runTimetableReloadUsingThisPageInputs() {
    const airportEl = document.getElementById("airportCodeInput");
    const dateEl = document.getElementById("flightDateInput");
    const fetchStatus =
      typeof window.AeroDataBoxAPI?.updateFetchStatus === "function"
        ? window.AeroDataBoxAPI.updateFetchStatus
        : (msg) => console.log(`[Timetable-Adapter] ${msg}`);

    const airport = (airportEl?.value || "MUC").trim().toUpperCase();
    const currentDate =
      dateEl?.value || new Date().toISOString().split("T")[0];
    const nextDate = nextDateStr(currentDate);

    fetchStatus(
      `Timetable: Starte Übernachtungs-Verarbeitung für ${airport} (${currentDate} → ${nextDate})...`
    );

    if (
      !window.AeroDataBoxAPI ||
      typeof window.AeroDataBoxAPI.generateOvernightTimetable !== "function"
    ) {
      fetchStatus(
        "Timetable: AeroDataBoxAPI.generateOvernightTimetable nicht verfügbar",
        true
      );
      return;
    }

    try {
      const overnight = await window.AeroDataBoxAPI.generateOvernightTimetable(
        airport,
        currentDate,
        nextDate
      );

      const count = Array.isArray(overnight) ? overnight.length : 0;
      fetchStatus(
        `Timetable: Verarbeitung abgeschlossen – ${count} übernachtende Flugzeuge gefunden`
      );
      console.log("[Timetable-Adapter] Overnight results:", overnight);
    } catch (err) {
      console.error("[Timetable-Adapter] Fehler bei Timetable-Reload:", err);
      fetchStatus(`Timetable Fehler: ${err.message}`, true);
    }
  }

  function setup() {
    const btn = document.getElementById("showAirportFlightsBtn");
    if (!btn) return;

    // Zusätzlicher Listener: neben der bestehenden Airport-Flights-Logik auch Timetable-Verarbeitung anstoßen
    btn.addEventListener("click", () => {
      // Leicht verzögern, um parallele UI-Updates nicht zu blockieren
      setTimeout(() => {
        runTimetableReloadUsingThisPageInputs();
      }, 0);
    });

    // Optional global utility for manual triggering
    window.reloadOvernightTimetableFromTimetablePage =
      runTimetableReloadUsingThisPageInputs;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
})();

