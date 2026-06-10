let SESSION_KEY;
let DRIVER_NUMBER;

let speedChart;
let throttleChart;
let brakeChart;
let gearChart;
let rpmChart;

console.log("app.js loaded successfully");

/* -----------------------------
   SAFE FETCH (no crash version)
------------------------------*/
async function fetchOpenF1(url) {

    try {

        const res = await fetch(url);

        if (!res.ok) {
            console.warn("API error:", res.status);
            return [];
        }

        return await res.json();

    } catch (err) {
        console.error("Fetch failed:", err);
        return [];
    }
}

/* -----------------------------
   ENTRY POINT (MUST WORK)
------------------------------*/
window.loadData = async function loadData() {

    console.log("loadData triggered");

    const sessionInput = document.getElementById("sessionKey");
    const driverInput = document.getElementById("driverNumber");

    if (!sessionInput || !driverInput) {
        alert("Missing inputs in HTML");
        return;
    }

    SESSION_KEY = sessionInput.value.trim();
    DRIVER_NUMBER = driverInput.value.trim();

    if (!SESSION_KEY || !DRIVER_NUMBER) {
        alert("Enter session key + driver number");
        return;
    }

    try {

        await loadDriver();
        await loadLaps();
        await drawTrack();

    } catch (err) {
        console.error("Main load error:", err);
    }
};

/* -----------------------------
   DRIVER
------------------------------*/
async function loadDriver() {

    const data = await fetchOpenF1(
        `https://api.openf1.org/v1/drivers?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    if (!data.length) {
        console.warn("No driver data");
        return;
    }

    const d = data[0];

    const el = document.getElementById("driverCard");

    if (el) {
        el.innerHTML = `
            <h2>${d.full_name || "Unknown"}</h2>
            <p>${d.team_name || ""}</p>
            <p>#${d.driver_number || ""}</p>
        `;
    }
}

/* -----------------------------
   LAPS (SAFE)
------------------------------*/
async function loadLaps() {

    const laps = await fetchOpenF1(
        `https://api.openf1.org/v1/laps?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    if (!Array.isArray(laps) || !laps.length) {
        console.warn("No laps data");
        return;
    }

    const valid = laps.filter(l => l.lap_duration);

    if (!valid.length) return;

    const fastest = valid.reduce((a, b) =>
        a.lap_duration < b.lap_duration ? a : b
    );

    document.getElementById("fastestLap").innerText =
        fastest.lap_duration.toFixed(3);

    document.getElementById("position").innerText =
        "P?"; // placeholder until safe logic later

    document.getElementById("s1").innerText =
        fastest.duration_sector_1?.toFixed?.(3) || "--";

    document.getElementById("s2").innerText =
        fastest.duration_sector_2?.toFixed?.(3) || "--";

    document.getElementById("s3").innerText =
        fastest.duration_sector_3?.toFixed?.(3) || "--";

    await loadTelemetry(fastest);
}

/* -----------------------------
   TELEMETRY (SAFE)
------------------------------*/
async function loadTelemetry(lap) {

    if (!lap?.date_start || !lap?.lap_duration) {
        console.warn("Invalid lap data");
        return;
    }

    const start = new Date(lap.date_start);

    const end = new Date(
        start.getTime() + lap.lap_duration * 1000
    );

    const telemetry = await fetchOpenF1(
        `https://api.openf1.org/v1/car_data?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}&date>=${start.toISOString()}&date<=${end.toISOString()}`
    );

    if (!Array.isArray(telemetry) || !telemetry.length) {
        console.warn("No telemetry");
        return;
    }

    const labels = telemetry.map((_, i) => i);

    const speeds = telemetry.map(t => t.speed);
    const throttle = telemetry.map(t => t.throttle);
    const brake = telemetry.map(t => t.brake ? 100 : 0);
    const gear = telemetry.map(t => t.n_gear);
    const rpm = telemetry.map(t => t.rpm);

    createChart("speedChart", speedChart, "Speed", speeds, "#00d4ff", c => speedChart = c, labels);
    createChart("throttleChart", throttleChart, "Throttle", throttle, "#00ff88", c => throttleChart = c, labels);
    createChart("brakeChart", brakeChart, "Brake", brake, "#ff4444", c => brakeChart = c, labels);
    createChart("gearChart", gearChart, "Gear", gear, "#ffd000", c => gearChart = c, labels);
    createChart("rpmChart", rpmChart, "RPM", rpm, "#b06cff", c => rpmChart = c, labels);
}

/* -----------------------------
   CHART SAFE VERSION
------------------------------*/
function createChart(canvasId, chart, label, data, color, save, labels) {

    const canvas = document.getElementById(canvasId);

    if (!canvas) {
        console.warn("Missing canvas:", canvasId);
        return;
    }

    const ctx = canvas.getContext("2d");

    if (chart) chart.destroy();

    const newChart = new Chart(ctx, {
        type: "line",
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color,
                tension: 0.3,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true
        }
    });

    save(newChart);
}

/* -----------------------------
   TRACK (ULTRA SAFE)
------------------------------*/
async function drawTrack() {

    const positions = await fetchOpenF1(
        `https://api.openf1.org/v1/location?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    if (!Array.isArray(positions) || positions.length < 2) {
        console.warn("No track data");
        return;
    }

    const canvas = document.getElementById("trackMap");

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    canvas.width = 1000;
    canvas.height = 500;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const scaleX = x => ((x - minX) / (maxX - minX || 1)) * 900 + 50;
    const scaleY = y => ((y - minY) / (maxY - minY || 1)) * 400 + 50;

    ctx.strokeStyle = "#e10600";
    ctx.lineWidth = 3;

    ctx.beginPath();

    for (let i = 0; i < positions.length; i++) {

        const p = positions[i];

        const x = scaleX(p.x);
        const y = scaleY(p.y);

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }

    ctx.stroke();
}
