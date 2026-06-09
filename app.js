let SESSION_KEY;
let DRIVER_NUMBER;

let speedChart;
let throttleChart;
let brakeChart;
let gearChart;
let rpmChart;

let telemetryData = [];
let cachedPositions = null;

let loading = false;

// ========================
// MAIN
// ========================
async function loadData() {
    if (loading) return;
    loading = true;

    try {
        SESSION_KEY = document.getElementById("sessionKey").value;
        DRIVER_NUMBER = document.getElementById("driverNumber").value;

        await loadDriver();
        await loadLaps();
        await drawTrack();

    } finally {
        loading = false;
    }
}

// ========================
// DRIVER
// ========================
async function loadDriver() {
    const res = await fetch(
        `https://api.openf1.org/v1/drivers?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    const data = await res.json();
    const driver = Array.isArray(data) ? data[0] : null;

    if (!driver) return;

    document.getElementById("driverCard").innerHTML = `
        <h2>${driver.full_name}</h2>
        <p>${driver.team_name}</p>
        <p>#${driver.driver_number}</p>
    `;
}

// ========================
// LAPS
// ========================
async function loadLaps() {
    const res = await fetch(
        `https://api.openf1.org/v1/laps?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    const laps = await res.json();
    if (!Array.isArray(laps)) return;

    const validLaps = laps.filter(l => l.lap_duration);
    if (!validLaps.length) return;

    const fastest = validLaps.reduce((a, b) =>
        a.lap_duration < b.lap_duration ? a : b
    );

    document.getElementById("fastestLap").innerText =
        fastest.lap_duration.toFixed(3);

    document.getElementById("position").innerText = "P1";

    document.getElementById("s1").innerText = fastest.duration_sector_1 || "--";
    document.getElementById("s2").innerText = fastest.duration_sector_2 || "--";
    document.getElementById("s3").innerText = fastest.duration_sector_3 || "--";

    await loadTelemetry(fastest);
}

// ========================
// TELEMETRY
// ========================
async function loadTelemetry(lap) {
    const start = new Date(lap.date_start);
    const end = new Date(start.getTime() + lap.lap_duration * 1000);

    const res = await fetch(
        `https://api.openf1.org/v1/car_data?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}&date>=${start.toISOString()}&date<=${end.toISOString()}`
    );

    telemetryData = await res.json();
    if (!Array.isArray(telemetryData) || telemetryData.length === 0) return;

    const labels = telemetryData.map((_, i) => i);

    speedChart = createChart("speedChart", "Speed",
        smooth(telemetryData.map(x => x.speed)), "#00d4ff", labels);

    throttleChart = createChart("throttleChart", "Throttle",
        smooth(telemetryData.map(x => x.throttle)), "#00ff88", labels);

    brakeChart = createChart("brakeChart", "Brake",
        telemetryData.map(x => x.brake ? 100 : 0), "#ff4444", labels);

    gearChart = createChart("gearChart", "Gear",
        telemetryData.map(x => x.n_gear), "#ffd000", labels);

    rpmChart = createChart("rpmChart", "RPM",
        smooth(telemetryData.map(x => x.rpm)), "#b06cff", labels);

    setTimeout(initF1HoverSystem, 150);
}

// ========================
// SMOOTHING
// ========================
function smooth(arr, window = 5) {
    return arr.map((_, i) => {
        let sum = 0;
        let count = 0;

        for (let j = -window; j <= window; j++) {
            if (arr[i + j] != null) {
                sum += arr[i + j];
                count++;
            }
        }

        return sum / count;
    });
}

// ========================
// CHART CREATION
// ========================
function createChart(canvasId, label, data, color, labels) {
    return new Chart(document.getElementById(canvasId), {
        type: "line",
        data: {
            labels,
            datasets: [{
                label,
                data,
                borderColor: color,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.45,
                cubicInterpolationMode: "monotone"
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                tooltip: { enabled: false }
            },

            interaction: {
                mode: "nearest",
                intersect: false
            },

            animation: {
                duration: 120
            }
        }
    });
}

// ========================
// F1 HOVER SYSTEM (FIXED)
// ========================
function initF1HoverSystem() {
    const charts = [
        speedChart,
        throttleChart,
        brakeChart,
        gearChart,
        rpmChart
    ];

    const overlay = createOverlay();

    charts.forEach(chart => {
        chart.canvas.addEventListener("mousemove", (e) => {

            const rect = chart.canvas.getBoundingClientRect();
            const xPixel = e.clientX - rect.left;

            const indexFloat = chart.scales.x.getValueForPixel(xPixel);
            const i = Math.max(0, Math.min(telemetryData.length - 1, Math.floor(indexFloat)));

            const t = telemetryData[i];
            if (!t) return;

            drawCursorAcrossCharts(i);

            overlay.innerHTML = `
                <div><b>Speed:</b> ${t.speed}</div>
                <div><b>Throttle:</b> ${t.throttle}</div>
                <div><b>Brake:</b> ${t.brake ? "ON" : "OFF"}</div>
                <div><b>Gear:</b> ${t.n_gear}</div>
                <div><b>RPM:</b> ${t.rpm}</div>
            `;
        });
    });
}

// ========================
// OVERLAY
// ========================
function createOverlay() {
    let el = document.getElementById("telemetryOverlay");
    if (el) return el;

    el = document.createElement("div");
    el.id = "telemetryOverlay";

    Object.assign(el.style, {
        position: "absolute",
        top: "20px",
        right: "20px",
        background: "rgba(0,0,0,0.75)",
        color: "white",
        padding: "10px",
        fontFamily: "monospace",
        borderRadius: "8px",
        pointerEvents: "none"
    });

    document.body.appendChild(el);
    return el;
}

// ========================
// SYNCHRONIZED CURSOR (NO STRETCH BUG)
// ========================
function drawCursorAcrossCharts(index) {
    [speedChart, throttleChart, brakeChart, gearChart, rpmChart].forEach(chart => {
        if (!chart) return;

        const { ctx, chartArea, scales } = chart;
        if (!chartArea) return;

        const xPixel = scales.x.getPixelForValue(index);

        ctx.save();

        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(xPixel, chartArea.top);
        ctx.lineTo(xPixel, chartArea.bottom);
        ctx.stroke();

        ctx.restore();
    });
}

// ========================
// TRACK (CACHED + SAFE)
// ========================
async function drawTrack() {
    try {
        if (!cachedPositions) {
            const res = await fetch(
                `https://api.openf1.org/v1/location?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
            );

            if (!res.ok) return;

            const data = await res.json();
            if (!Array.isArray(data)) return;

            cachedPositions = data;
        }

        const positions = cachedPositions;

        const canvas = document.getElementById("trackMap");
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

        ctx.strokeStyle = "#e10600";
        ctx.lineWidth = 2;

        ctx.beginPath();

        positions.forEach((p, i) => {
            const x = ((p.x - minX) / (maxX - minX)) * 900 + 50;
            const y = ((p.y - minY) / (maxY - minY)) * 400 + 50;

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.stroke();

    } catch (err) {
        console.error("Track error:", err);
    }
}

// ========================
// GLOBAL EXPORT (IMPORTANT FOR HTML BUTTONS)
// ========================
window.loadData = loadData;
