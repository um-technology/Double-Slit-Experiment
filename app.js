let SESSION_KEY;
let DRIVER_NUMBER;

let speedChart;
let throttleChart;
let brakeChart;
let gearChart;
let rpmChart;

console.log("app.js loaded successfully");

/* =========================================================
   TIME FORMATTER (mm:ss.mmm)
========================================================= */
function formatLapTime(seconds) {

    if (seconds === null || seconds === undefined || isNaN(seconds)) return "--";

    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    const ms = Math.round((seconds - Math.floor(seconds)) * 1000);

    return `${min}:${sec.toString().padStart(2, "0")}.${ms.toString().padStart(3, "0")}`;
}

const cache = new Map();
let lastRequestTime = 0;

async function fetchOpenF1(url) {

    const now = Date.now();

    // enforce 400ms delay between requests
    const wait = 400 - (now - lastRequestTime);

    if (wait > 0) {
        await new Promise(r => setTimeout(r, wait));
    }

    lastRequestTime = Date.now();

    if (cache.has(url)) {
        return cache.get(url);
    }

    try {

        const res = await fetch(url);

        if (res.status === 429) {
            console.warn("Rate limited, retrying in 1s...");
            await new Promise(r => setTimeout(r, 1000));
            return fetchOpenF1(url);
        }

        if (!res.ok) {
            console.warn("API error:", res.status);
            return [];
        }

        const data = await res.json();
        cache.set(url, data);

        return data;

    } catch (err) {
        console.error("Fetch failed:", err);
        return [];
    }
}

/* =========================================================
   ENTRY POINT
========================================================= */
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

/* =========================================================
   DRIVER INFO
========================================================= */
async function loadDriver() {

    const data = await fetchOpenF1(
        `https://api.openf1.org/v1/drivers?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    if (!Array.isArray(data) || !data.length) {
        console.warn("No driver data");
        return;
    }

    const d = data[0];

    const el = document.getElementById("driverCard");

    if (el) {
    el.innerHTML = `
    <div class="driver-header">

        <div class="driver-main">

            <div class="driver-number">
                #${d.driver_number}
            </div>

            <div>

                <h2>${d.full_name}</h2>

                <div class="driver-meta">
                    ${d.name_acronym || ""}
                    •
                    ${d.team_name || "Unknown Team"}
                </div>

            </div>

        </div>

        <div class="driver-extra">

            <div class="driver-stat">
                <span>Nationality</span>
                <strong>${d.country_code || "--"}</strong>
            </div>

            <div class="driver-stat">
                <span>Session</span>
                <strong>${SESSION_KEY}</strong>
            </div>

            <div class="driver-stat">
                <span>Driver No.</span>
                <strong>${d.driver_number}</strong>
            </div>

        </div>

    </div>
    `;
}
}

/* =========================================================
   LAPS + FASTEST LAP
========================================================= */
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
        formatLapTime(fastest.lap_duration);

    document.getElementById("position").innerText =
        "P?";

    document.getElementById("s1").innerText =
        formatLapTime(fastest.duration_sector_1);

    document.getElementById("s2").innerText =
        formatLapTime(fastest.duration_sector_2);

    document.getElementById("s3").innerText =
        formatLapTime(fastest.duration_sector_3);

    await loadTelemetry(fastest);
}

/* =========================================================
   TELEMETRY
========================================================= */
async function loadTelemetry(lap) {

    if (!lap?.date_start || !lap?.lap_duration) {
        console.warn("Invalid lap data");
        return;
    }

    const start = new Date(lap.date_start);
    const end = new Date(start.getTime() + lap.lap_duration * 1000);

    const telemetry = await fetchOpenF1(
        `https://api.openf1.org/v1/car_data?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}&date>=${start.toISOString()}&date<=${end.toISOString()}`
    );

    if (!Array.isArray(telemetry) || !telemetry.length) {
        console.warn("No telemetry data");
        return;
    }

    const labels = telemetry.map((_, i) => i);

    createChart(
        "speedChart",
        speedChart,
        "Speed",
        telemetry.map(t => t.speed),
        "#00d4ff",
        c => speedChart = c,
        labels
    );

    createChart(
        "throttleChart",
        throttleChart,
        "Throttle",
        telemetry.map(t => t.throttle),
        "#00ff88",
        c => throttleChart = c,
        labels
    );

    createChart(
        "brakeChart",
        brakeChart,
        "Brake",
        telemetry.map(t => t.brake ? 100 : 0),
        "#ff4444",
        c => brakeChart = c,
        labels
    );

    createChart(
        "gearChart",
        gearChart,
        "Gear",
        telemetry.map(t => t.n_gear),
        "#ffd000",
        c => gearChart = c,
        labels
    );

    createChart(
        "rpmChart",
        rpmChart,
        "RPM",
        telemetry.map(t => t.rpm),
        "#b06cff",
        c => rpmChart = c,
        labels
    );
}

/* =========================================================
   CHART RENDERER
========================================================= */
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
                tension: 0.35,
                pointRadius: 0,
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: "index",
                intersect: false
            }
        }
    });

    save(newChart);
}

/* =========================================================
   TRACK MAP
========================================================= */
async function drawTrack() {

    const positions = await fetchOpenF1(
        `https://api.openf1.org/v1/location?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    if (!Array.isArray(positions) || positions.length < 10) {
        console.warn("No valid track data");
        return;
    }

    const canvas = document.getElementById("trackMap");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    /* -----------------------------
       CLEAN DATA
    ------------------------------*/
    const clean = positions.filter(p =>
        p && typeof p.x === "number" && typeof p.y === "number"
    );

    if (clean.length < 10) return;

    const xs = clean.map(p => p.x);
    const ys = clean.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const rangeX = maxX - minX || 1;
    const rangeY = maxY - minY || 1;

    const scale = Math.min(
        canvas.width / rangeX,
        canvas.height / rangeY
    ) * 0.9;

    const offsetX = (canvas.width - rangeX * scale) / 2;
    const offsetY = (canvas.height - rangeY * scale) / 2;

    const scaleX = x => (x - minX) * scale + offsetX;
    const scaleY = y => canvas.height - ((y - minY) * scale + offsetY);

    const points = clean.map(p => ({
        x: scaleX(p.x),
        y: scaleY(p.y),
        speed: p.speed || 0
    }));

    /* -----------------------------
       SECTOR SPLITS
    ------------------------------*/
    const s1End = Math.floor(points.length * 0.33);
    const s2End = Math.floor(points.length * 0.66);

    const drawSectorOverlay = (start, end, color, label) => {

        ctx.strokeStyle = "#e10600";
        ctx.lineWidth = 6;
        ctx.globalAlpha = 0.15;

        ctx.beginPath();
        ctx.moveTo(points[start].x, points[start].y);

        for (let i = start + 1; i <= end; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        ctx.stroke();
        ctx.globalAlpha = 1;
    };

    drawSectorOverlay(0, s1End, "#00d4ff", "S1");
    drawSectorOverlay(s1End, s2End, "#ffd000", "S2");
    drawSectorOverlay(s2End, points.length - 1, "#ff4444", "S3");

    /* -----------------------------
       SPEED HEATMAP LINE
    ------------------------------*/
    const maxSpeed = Math.max(...points.map(p => p.speed || 0)) || 1;

    for (let i = 1; i < points.length; i++) {

        const p1 = points[i - 1];
        const p2 = points[i];

        const speed = p2.speed || 0;
        const t = speed / maxSpeed;

        // green (fast) → red (slow)
        const r = Math.floor(255 * (1 - t));
        const g = Math.floor(255 * t);

        ctx.strokeStyle = `rgb(${r},${g},80)`;
        ctx.lineWidth = 3;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
    }

    /* -----------------------------
       ANIMATED CAR DOT
    ------------------------------*/
    let i = 0;
    let animationId;

    function animateCar() {

    if (!points || points.length === 0) return;

    // stop previous loop (prevents stacking loops)
    if (animationId) cancelAnimationFrame(animationId);

    const render = () => {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        /* redraw track */
        for (let j = 1; j < points.length; j++) {

            const p1 = points[j - 1];
            const p2 = points[j];

            const speed = p2.speed || 0;
            const t = speed / maxSpeed;

            const r = Math.floor(255 * (1 - t));
            const g = Math.floor(255 * t);

            ctx.strokeStyle = `rgb(${r},${g},80)`;
            ctx.lineWidth = 3;

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }

        /* moving car */
        const p = points[i];

        if (!p) {
            i = 0;
        } else {

            ctx.fillStyle = "#fff";
            ctx.shadowColor = "#00d4ff";
            ctx.shadowBlur = 15;

            ctx.beginPath();
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.shadowBlur = 0;

            i++;
        }

        animationId = requestAnimationFrame(render);
    };

    render();
}

animateCar();
}
