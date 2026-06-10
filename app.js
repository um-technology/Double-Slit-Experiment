let SESSION_KEY;
let DRIVER_NUMBER;

let speedChart;
let throttleChart;
let brakeChart;
let gearChart;
let rpmChart;

const cache = new Map();

/* -----------------------------
   SAFE API FETCH (fixes 429)
------------------------------*/
async function fetchOpenF1(url) {

    try {

        if (cache.has(url))
            return cache.get(url);

        const res = await fetch(url);

        if (res.status === 429)
            throw new Error("Rate limited (429)");

        if (!res.ok)
            throw new Error(`HTTP ${res.status}`);

        const data = await res.json();

        cache.set(url, data);

        return data;

    } catch (err) {

        console.error("API error:", err);
        return [];
    }
}

/* -----------------------------
   MAIN ENTRY
------------------------------*/
async function loadData() {

    SESSION_KEY =
        document.getElementById("sessionKey").value.trim();

    DRIVER_NUMBER =
        document.getElementById("driverNumber").value.trim();

    if (!SESSION_KEY || !DRIVER_NUMBER) {
        alert("Please enter session key + driver number");
        return;
    }

    await Promise.all([
        loadDriver(),
        loadLaps(),
        drawTrack()
    ]);
}

/* -----------------------------
   DRIVER INFO
------------------------------*/
async function loadDriver() {

    const data =
        await fetchOpenF1(
            `https://api.openf1.org/v1/drivers?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
        );

    if (!Array.isArray(data) || !data.length)
        return;

    const driver = data[0];

    document.getElementById("driverCard").innerHTML = `
        <h2>${driver.full_name}</h2>
        <p>${driver.team_name}</p>
        <p>#${driver.driver_number}</p>
    `;
}

/* -----------------------------
   LAPS + POSITION LOGIC
------------------------------*/
async function loadLaps() {

    const laps =
        await fetchOpenF1(
            `https://api.openf1.org/v1/laps?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
        );

    if (!Array.isArray(laps) || !laps.length)
        return;

    const validLaps =
        laps.filter(l => l.lap_duration);

    if (!validLaps.length)
        return;

    const fastest =
        validLaps.reduce(
            (a, b) =>
                a.lap_duration < b.lap_duration
                    ? a
                    : b
        );

    const avgLap =
        validLaps.reduce(
            (s, l) => s + l.lap_duration,
            0
        ) / validLaps.length;

    const position =
        await getPosition();

    document.getElementById("fastestLap").innerText =
        fastest.lap_duration.toFixed(3);

    document.getElementById("position").innerText =
        `P${position}`;

    document.getElementById("s1").innerText =
        fastest.duration_sector_1?.toFixed(3) || "--";

    document.getElementById("s2").innerText =
        fastest.duration_sector_2?.toFixed(3) || "--";

    document.getElementById("s3").innerText =
        fastest.duration_sector_3?.toFixed(3) || "--";

    const avgEl =
        document.getElementById("averageLap");

    if (avgEl)
        avgEl.innerText = avgLap.toFixed(3);

    await loadTelemetry(fastest);
}

/* -----------------------------
   REAL POSITION CALCULATION
------------------------------*/
async function getPosition() {

    const laps =
        await fetchOpenF1(
            `https://api.openf1.org/v1/laps?session_key=${SESSION_KEY}`
        );

    if (!Array.isArray(laps))
        return "--";

    const best = {};

    laps.forEach(l => {

        if (!l.lap_duration)
            return;

        const d = l.driver_number;

        if (!best[d] || l.lap_duration < best[d])
            best[d] = l.lap_duration;
    });

    const ranking =
        Object.entries(best)
            .sort((a, b) => a[1] - b[1]);

    const index =
        ranking.findIndex(
            x => Number(x[0]) === Number(DRIVER_NUMBER)
        );

    return index >= 0 ? index + 1 : "--";
}

/* -----------------------------
   TELEMETRY + STATS
------------------------------*/
async function loadTelemetry(lap) {

    const start =
        new Date(lap.date_start);

    const end =
        new Date(
            start.getTime() +
            lap.lap_duration * 1000
        );

    const telemetry =
        await fetchOpenF1(
            `https://api.openf1.org/v1/car_data?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}&date>=${start.toISOString()}&date<=${end.toISOString()}`
        );

    if (!Array.isArray(telemetry) || !telemetry.length)
        return;

    const labels =
        telemetry.map((_, i) => i);

    /* STATS */
    const maxSpeed =
        Math.max(...telemetry.map(t => t.speed));

    const avgThrottle =
        telemetry.reduce((s, t) => s + t.throttle, 0)
        / telemetry.length;

    const brakeUsage =
        telemetry.filter(t => t.brake).length
        / telemetry.length * 100;

    document.getElementById("topSpeed")?.innerText =
        `${maxSpeed} km/h`;

    document.getElementById("avgThrottle")?.innerText =
        `${avgThrottle.toFixed(1)}%`;

    document.getElementById("brakeUsage")?.innerText =
        `${brakeUsage.toFixed(1)}%`;

    /* CHARTS */
    createChart(
        "speedChart",
        speedChart,
        "Speed",
        telemetry.map(x => x.speed),
        "#00d4ff",
        c => speedChart = c,
        labels
    );

    createChart(
        "throttleChart",
        throttleChart,
        "Throttle",
        telemetry.map(x => x.throttle),
        "#00ff88",
        c => throttleChart = c,
        labels
    );

    createChart(
        "brakeChart",
        brakeChart,
        "Brake",
        telemetry.map(x => x.brake ? 100 : 0),
        "#ff4444",
        c => brakeChart = c,
        labels
    );

    createChart(
        "gearChart",
        gearChart,
        "Gear",
        telemetry.map(x => x.n_gear),
        "#ffd000",
        c => gearChart = c,
        labels
    );

    createChart(
        "rpmChart",
        rpmChart,
        "RPM",
        telemetry.map(x => x.rpm),
        "#b06cff",
        c => rpmChart = c,
        labels
    );
}

/* -----------------------------
   CHART FACTORY (CLEANER UI)
------------------------------*/
function createChart(
    canvas,
    chart,
    label,
    data,
    color,
    save,
    labels
) {

    if (chart)
        chart.destroy();

    const ctx =
        document.getElementById(canvas).getContext("2d");

    const newChart =
        new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label,
                    data,
                    borderColor: color,
                    tension: 0.25,
                    pointRadius: 0,
                    fill: false
                }]
            },
            options: {

                responsive: true,

                interaction: {
                    mode: "index",
                    intersect: false
                },

                plugins: {
                    legend: {
                        labels: {
                            color: "#fff"
                        }
                    }
                },

                scales: {
                    x: {
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        },
                        ticks: {
                            color: "#888"
                        }
                    },
                    y: {
                        grid: {
                            color: "rgba(255,255,255,0.05)"
                        },
                        ticks: {
                            color: "#888"
                        }
                    }
                }
            }
        });

    save(newChart);
}

/* -----------------------------
   TRACK MAP (SAFE VERSION)
------------------------------*/
async function drawTrack() {

    const positions =
        await fetchOpenF1(
            `https://api.openf1.org/v1/location?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
        );

    if (!Array.isArray(positions) || positions.length < 2)
        return;

    const canvas =
        document.getElementById("trackMap");

    const ctx =
        canvas.getContext("2d");

    canvas.width = 1000;
    canvas.height = 500;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const xs = positions.map(p => p.x);
    const ys = positions.map(p => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const scaleX =
        x => ((x - minX) / (maxX - minX || 1)) * 900 + 50;

    const scaleY =
        y => ((y - minY) / (maxY - minY || 1)) * 400 + 50;

    /* track base */
    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 10;

    ctx.beginPath();

    positions.forEach((p, i) => {

        const x = scaleX(p.x);
        const y = scaleY(p.y);

        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();

    /* racing line */
    ctx.strokeStyle = "#e10600";
    ctx.lineWidth = 4;

    ctx.shadowColor = "#e10600";
    ctx.shadowBlur = 10;

    ctx.beginPath();

    positions.forEach((p, i) => {

        const x = scaleX(p.x);
        const y = scaleY(p.y);

        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });

    ctx.stroke();
}
