let SESSION_KEY;
let DRIVER_NUMBER;

let speedChart;
let throttleChart;
let brakeChart;
let gearChart;
let rpmChart;

async function loadData(){

    SESSION_KEY =
        document.getElementById("sessionKey").value;

    DRIVER_NUMBER =
        document.getElementById("driverNumber").value;

    await loadDriver();
    await loadLaps();
    await drawTrack();
}

async function loadDriver(){

    const res = await fetch(
        `https://api.openf1.org/v1/drivers?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    const data = await res.json();

    const driver = data[0];

    document.getElementById("driverCard").innerHTML =
    `
    <h2>${driver.full_name}</h2>
    <p>${driver.team_name}</p>
    <p>#${driver.driver_number}</p>
    `;
}

async function loadLaps(){

    const res = await fetch(
        `https://api.openf1.org/v1/laps?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    const laps = await res.json();

    const validLaps =
        laps.filter(l => l.lap_duration);

    const fastest =
        validLaps.reduce(
            (a,b)=>
                a.lap_duration < b.lap_duration
                ? a : b
        );

    document.getElementById("fastestLap")
        .innerText =
        fastest.lap_duration.toFixed(3);

    document.getElementById("position")
        .innerText = "P1";

    document.getElementById("s1")
        .innerText =
        fastest.duration_sector_1 || "--";

    document.getElementById("s2")
        .innerText =
        fastest.duration_sector_2 || "--";

    document.getElementById("s3")
        .innerText =
        fastest.duration_sector_3 || "--";

    loadTelemetry(fastest);
}

async function loadTelemetry(lap){

    const start =
        new Date(lap.date_start);

    const end =
        new Date(
            start.getTime() +
            lap.lap_duration * 1000
        );

    const telemetryRes = await fetch(
        `https://api.openf1.org/v1/car_data?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}&date>=${start.toISOString()}&date<=${end.toISOString()}`
    );

    const telemetry =
        await telemetryRes.json();

    const labels =
        telemetry.map((_,i)=>i);

    createChart(
        "speedChart",
        speedChart,
        "Speed",
        telemetry.map(x=>x.speed),
        "#00d4ff",
        c=>speedChart=c,
        labels
    );

    createChart(
        "throttleChart",
        throttleChart,
        "Throttle",
        telemetry.map(x=>x.throttle),
        "#00ff88",
        c=>throttleChart=c,
        labels
    );

    createChart(
        "brakeChart",
        brakeChart,
        "Brake",
        telemetry.map(x=>x.brake?100:0),
        "#ff4444",
        c=>brakeChart=c,
        labels
    );

    createChart(
        "gearChart",
        gearChart,
        "Gear",
        telemetry.map(x=>x.n_gear),
        "#ffd000",
        c=>gearChart=c,
        labels
    );

    createChart(
        "rpmChart",
        rpmChart,
        "RPM",
        telemetry.map(x=>x.rpm),
        "#b06cff",
        c=>rpmChart=c,
        labels
    );
}

function createChart(
    canvas,
    chart,
    label,
    data,
    color,
    save,
    labels
){

    if(chart)
        chart.destroy();

    const newChart =
        new Chart(
            document.getElementById(canvas),
            {
                type:"line",
                data:{
                    labels,
                    datasets:[{
                        label,
                        data,
                        borderColor:color,
                        tension:.25,
                        pointRadius:0
                    }]
                },
                options:{
                    responsive:true
                }
            }
        );

    save(newChart);
}

async function drawTrack(){

    const res = await fetch(
        `https://api.openf1.org/v1/location?session_key=${SESSION_KEY}&driver_number=${DRIVER_NUMBER}`
    );

    const positions =
        await res.json();

    const canvas =
        document.getElementById("trackMap");

    const ctx =
        canvas.getContext("2d");

    canvas.width = 1000;
    canvas.height = 500;

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    const xs =
        positions.map(p=>p.x);

    const ys =
        positions.map(p=>p.y);

    const minX =
        Math.min(...xs);

    const maxX =
        Math.max(...xs);

    const minY =
        Math.min(...ys);

    const maxY =
        Math.max(...ys);

    ctx.strokeStyle="#e10600";
    ctx.lineWidth=2;

    ctx.beginPath();

    positions.forEach((p,i)=>{

        const x =
            ((p.x-minX)/(maxX-minX))
            *900+50;

        const y =
            ((p.y-minY)/(maxY-minY))
            *400+50;

        if(i===0)
            ctx.moveTo(x,y);
        else
            ctx.lineTo(x,y);

    });

    ctx.stroke();
}
