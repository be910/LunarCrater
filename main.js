// =======================
// Global Configuration
// =======================
const width = 960;
const height = 480;

let marePolygons = [];
let allCraters = [];
let mareInfo = {};
let mareStats = {}; // Loaded from json/output.json

let tooltip;


// =======================
// Initialization
// =======================
function init() {
    setupTooltip();
    setupSVG();
    setupSlider();
    createMareDetailPanel();

    const mareFiles = [
        "mareData/mare_imbrium.geojson",
        "mareData/mare_vaporum.geojson",
        "mareData/mare_tranquillitatis.geojson",
        "mareData/mare_serenitatis.geojson",
        "mareData/mare_fecunditatis.geojson",
        "mareData/mare_crisium.geojson",
        "mareData/oceanus_procellarum.geojson"
    ];

    d3.csv("mareData/mareInfo.csv").then(data => {
        data.forEach(d => {
            const key = d.Mare.trim().toLowerCase().replace(/\s+/g, "_");
            mareInfo[key] = d;
        });

        const marePromises = mareFiles.map(file =>
            d3.json(file).then(data => {
                const feature = data.features[0];
                const key = file.split("/").pop().replace(".geojson", "").toLowerCase();

                if (mareInfo[key]) {
                    feature.properties = { ...feature.properties, ...mareInfo[key] };
                }

                if (key.includes("mare_tranquillitatis")) {
                    feature.geometry.coordinates[0].reverse();
                }

                return feature;
            })
        );

        Promise.all(marePromises).then(features => {
            marePolygons = features;
            drawMarePolygons();
            drawMareCallouts();

            loadMareStats().then(() => {
                loadCraters();
            }).catch(err => {
                console.warn("Could not load mare stats:", err);
                loadCraters();
            });
        });
    });
}


// =======================
// Tooltip
// =======================
function setupTooltip() {
    tooltip = d3.select("body").append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);
}

function showTooltip(event, html) {
    tooltip.html(html)
        .style("left", event.pageX + 12 + "px")
        .style("top", event.pageY - 28 + "px")
        .transition().duration(120)
        .style("opacity", 1);
}

function hideTooltip() {
    tooltip.transition().duration(120).style("opacity", 0);
}


// =======================
// SVG + Projection
// =======================
function setupSVG() {
    const svg = d3.select("#visualization").append("svg")
        .attr("width", width)
        .attr("height", height);

    const projection = d3.geoEquirectangular()
        .scale(width / (2 * Math.PI))
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const g = svg.append("g");

    window.svg = svg;
    window.g = g;
    window.path = path;
    window.projection = projection;

    g.append("image")
        .attr("href", "Astrogeology_Moon_LRO_LROC-WAC_Mosaic_global_1024.jpg")
        .attr("width", width)
        .attr("height", height);

    const graticule = d3.geoGraticule().step([30, 30]);
    g.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path);

    g.append("g").attr("class", "mare");
    g.append("g").attr("class", "craters");
    g.append("g").attr("class", "panel-markers");

    setupZoom(svg, g);
}


// =======================
// Zoom
// =======================
function setupZoom(svg, g) {
    const zoom = d3.zoom().scaleExtent([1, 8]).on("zoom", e => {
        g.attr("transform", e.transform);
    });

    svg.call(zoom);
}


// =======================
// Mare Polygons
// =======================
function drawMarePolygons() {
    const g = window.g;
    const path = window.path;

    g.select(".mare").selectAll("*").remove();

    g.select(".mare")
        .selectAll("path")
        .data(marePolygons)
        .enter()
        .append("path")
        .attr("class", "mare-polygon")
        .attr("d", path)
        .on("mouseover", (e, d) => {
            const p = d.properties;
            showTooltip(e, `
                <strong>${p["English Name"]}</strong><br/>
                Mare: ${p["Mare"]}
            `);
        })
        .on("mouseout", hideTooltip)
        .on("click", (e, d) => {
            const key = d.properties.Mare.toLowerCase().replace(/\s+/g, "_");
            const t = +document.getElementById("timestepSlider").value;
            d3.select("#mareDetailPanel").attr("data-current-mare", key);
            updateMareDetailPanel(key, t);
        });
}


// =======================
// Callouts
// =======================
function drawMareCallouts() {
    const g = window.g;
    const path = window.path;

    g.select(".mare-callouts").remove();
    const callouts = g.append("g").attr("class", "mare-callouts");

    const positions = {
        "mare_imbrium": { x: 450, y: 90 },
        "mare_vaporum": { x: 490, y: 290 },
        "mare_tranquillitatis": { x: 560, y: 340 },
        "mare_serenitatis": { x: 600, y: 148 },
        "mare_fecunditatis": { x: 670, y: 300 },
        "mare_crisium": { x: 700, y: 200 },
        "oceanus_procellarum": { x: 290, y: 310 }
    };

    callouts.selectAll("g")
        .data(marePolygons)
        .enter()
        .append("g")
        .each(function (d) {
            const centroid = window.path.centroid(d);
            const key = d.properties.Mare.toLowerCase().replace(/\s+/g, "_");
            const pos = positions[key];
            if (!pos) return;

            d3.select(this).append("line")
                .attr("class", "mare-arrow")
                .attr("x1", centroid[0])
                .attr("y1", centroid[1])
                .attr("x2", pos.x)
                .attr("y2", pos.y);

            d3.select(this).append("text")
                .attr("class", "mare-label")
                .attr("x", pos.x)
                .attr("y", pos.y)
                .text(d.properties.Mare);
        });
}


// =======================
// Craters
// =======================
function loadCraters() {
    d3.json("https://media.githubusercontent.com/media/be910/LunarCrater/main/erased_craters_mare.geojson")
        .then(data => {
            allCraters = data.features;
            updateCratersForTimestep(0);
        });
}

function updateCratersForTimestep(t) {
    const g = window.g;
    const projection = window.projection;

    const craters = allCraters.filter(c =>
        c.properties.TimeStepCreated <= t &&
        c.properties.ErasedTimeStep > t &&
        marePolygons.some(m => d3.geoContains(m, c.geometry.coordinates))
    );

    g.select(".craters").selectAll("*").remove();

    const sizeScale = d3.scaleSqrt().domain([0, 100]).range([2, 8]);

    g.select(".craters")
        .selectAll("circle")
        .data(craters)
        .enter()
        .append("circle")
        .attr("class", "crater")
        .attr("cx", d => projection(d.geometry.coordinates)[0])
        .attr("cy", d => projection(d.geometry.coordinates)[1])
        .attr("r", d => sizeScale(d.properties.diameter))
        .attr("fill", d => getCraterColor(d.properties.diameter));

    // resync panel markers
    const panel = d3.select("#mareDetailPanel");
    const mareKey = panel.attr("data-current-mare");
    if (panel.style("display") !== "none" && mareKey)
        drawPanelMarkersForMare(mareKey, t);

    // drawLegend();
}

const diameterBins = [0, 10, 20, 40, 80];
const colors = ["#fbbf24", "#f97316", "#dc2626", "#7f1d1d", "#4b0000"];

function getCraterColor(d) {
    for (let i = diameterBins.length - 1; i >= 0; i--)
        if (d >= diameterBins[i]) return colors[i];
    return colors[0];
}


// =======================
// Slider (0–9, above visualization)
// =======================
function setupSlider() {
    const slider = document.getElementById("timestepSlider");
    const label = document.getElementById("timestepValue");

    slider.min = 0;
    slider.max = 9;
    slider.value = 0;

    slider.addEventListener("input", () => {
        const t = +slider.value;
        label.textContent = t;
        updateCratersForTimestep(t);

        const panel = d3.select("#mareDetailPanel");
        const mareKey = panel.attr("data-current-mare");
        if (mareKey) updateMareDetailPanel(mareKey, t);
    });
}


// =======================
// Legend
// =======================
function drawLegend() {
    const container = d3.select("#legendContainer");
    container.selectAll("*").remove();

    diameterBins.forEach((bin, i) => {
        const next = diameterBins[i + 1] ?? ">";
        container.append("div")
            .attr("class", "legend-item")
            .html(`
                <div class="legend-circle" style="background:${colors[i]}"></div>
                ${bin}${next !== ">" ? `–${next}` : "+"} m
            `);
    });
}


// =======================
// Load mare stats
// =======================
function loadMareStats() {
    return d3.json("json/output.json").then(data => {
        mareStats = data;
    });
}


// =======================
// Mare Detail Panel
// =======================
function createMareDetailPanel() {
    const left = d3.select(".scrolly-text");

    const panel = left.insert("div", ":first-child")
        .attr("id", "mareDetailPanel")
        .attr("data-current-mare", "")
        .style("display", "none")
        .style("background", "rgba(30,30,30,0.95)")
        .style("padding", "16px")
        .style("border-radius", "8px")
        .style("margin-bottom", "20px")
        .style("border", "1px solid #555");

    panel.append("h2").attr("id", "marePanelTitle").style("color", "#ffff00");

    panel.append("div").attr("id", "mareStatsContainer");

    panel.append("h3").text("Size Distribution");

    panel.append("svg")
        .attr("id", "mareSizeHistogram")
        .attr("width", 340)
        .attr("height", 170)
        .style("background", "rgba(255,255,255,0.03)")
        .style("border-radius", "6px");

    panel.append("h3").text("Smallest & Largest Craters");
    panel.append("div").attr("id", "panelCraters");

    panel.append("div")
        .attr("id", "panelMarkerLegend")
        .style("margin-top", "10px")
        .style("font-size", "12px")
        .html(`
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <svg width="14" height="14">
                    <circle cx="7" cy="7" r="6" stroke="#00ffbf" stroke-width="2" fill="none"></circle>
                </svg>
                Smallest crater
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
                <svg width="14" height="14">
                    <circle cx="7" cy="7" r="6" stroke="#ff4d4d" stroke-width="2" fill="none"></circle>
                </svg>
                Largest crater
            </div>
        `);

    panel.append("button")
        .text("Close")
        .style("margin-top", "12px")
        .style("padding", "6px 8px")
        .style("background", "#222")
        .style("color", "#fff")
        .style("border", "1px solid #444")
        .style("border-radius", "4px")
        .on("click", () => {
            panel.style("display", "none");
            clearPanelMarkers();
        });
}


// =======================
// Update mare panel
// =======================
function updateMareDetailPanel(key, t) {
    const panel = d3.select("#mareDetailPanel");
    panel.style("display", "block");

    const data = mareStats[key]?.[String(t)];

    if (!data) {
        d3.select("#marePanelTitle").text("No data available");
        d3.select("#panelCraters").html("");
        d3.select("#mareSizeHistogram").selectAll("*").remove();
        clearPanelMarkers();
        return;
    }

    d3.select("#marePanelTitle")
        .text(key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()));

    const stats = data.summ_stat;

    d3.select("#mareStatsContainer").html(`
        <p><strong>Number of Craters:</strong> ${stats.num_craters}</p>
        <p><strong>Min Diameter:</strong> ${(stats.min_size).toFixed(3)} m</p>
        <p><strong>Max Diameter:</strong> ${(stats.max_size).toFixed(3)} m</p>
        <p><strong>Mean Diameter:</strong> ${(stats.mean_size).toFixed(3)} m</p>
        <p><strong>Median Diameter:</strong> ${(stats.med_size).toFixed(3)} m</p>
    `);

    drawHistogram(data.sizes);
    drawPanelCraterInfo(data.plot_craters);

    drawPanelMarkersForMare(key, t);
}


// =======================
// Histogram (dynamic binning, increased spacing)
// =======================
function drawHistogram(values) {
    const cleaned = values.map(Number).filter(v => !isNaN(v));

    const svg = d3.select("#mareSizeHistogram");
    svg.selectAll("*").remove();

    const width = +svg.attr("width");
    const height = +svg.attr("height");

    const margin = { top: 10, right: 10, bottom: 30, left: 35 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (cleaned.length === 0) {
        g.append("text")
            .attr("x", w / 2)
            .attr("y", h / 2)
            .attr("text-anchor", "middle")
            .text("No data");
        return;
    }

    const x = d3.scaleLinear().domain(d3.extent(cleaned)).nice().range([0, w]);

    const binCount = Math.max(6, Math.ceil(Math.sqrt(cleaned.length)));
    const bins = d3.bin().domain(x.domain()).thresholds(binCount)(cleaned);

    const y = d3.scaleLinear().domain([0, d3.max(bins, d => d.length)]).nice().range([h, 0]);

    g.selectAll("rect")
        .data(bins)
        .enter()
        .append("rect")
        .attr("x", d => x(d.x0) + 1)
        .attr("y", d => y(d.length))
        .attr("width", d => Math.max(0, x(d.x1) - x(d.x0) - 1))
        .attr("height", d => h - y(d.length))
        .attr("fill", "#ffaa00");

    g.append("g")
        .attr("transform", `translate(0, ${h})`)
        .call(d3.axisBottom(x).ticks(6))
        .selectAll("text")
        .style("font-size", "10px")
        .attr("dy", "4px");  // spacing from axis

    g.append("g")
        .call(d3.axisLeft(y).ticks(4))
        .selectAll("text")
        .style("font-size", "10px");

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 2)
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .text("Diameter (m)");
}


// =======================
// Crater info
// =======================
function drawPanelCraterInfo(plot) {
    if (!plot) return;

    const sm = plot.smallest;
    const lg = plot.largest;

    const sLat = sm.lattitude ?? sm.latitude;
    const sLon = sm.longitude;
    const lLat = lg.lattitude ?? lg.latitude;
    const lLon = lg.longitude;

    d3.select("#panelCraters").html(`
        <div style="margin-bottom:6px;">
            <strong>Smallest:</strong><br/>
            Lat: ${sLat.toFixed(3)}, Lon: ${sLon.toFixed(3)}, Diameter: ${(sm.diameter).toFixed(0)} m
        </div>
        <div>
            <strong>Largest:</strong><br/>
            Lat: ${lLat.toFixed(3)}, Lon: ${lLon.toFixed(3)}, Diameter: ${(lg.diameter).toFixed(0)} m
        </div>
    `);
}


// =======================
// Panel markers (map overlay)
// =======================
function drawPanelMarkersForMare(key, t) {
    clearPanelMarkers();

    const data = mareStats[key]?.[String(t)];
    if (!data || !data.plot_craters) return;

    const g = window.g.select(".panel-markers");
    const projection = window.projection;

    const sm = data.plot_craters.smallest;
    const lg = data.plot_craters.largest;

    function addMarker(crater, strokeColor, radius) {
        const lat = crater.lattitude ?? crater.latitude;
        const lon = crater.longitude;
        const p = projection([lon, lat]);
        g.append("circle")
            .attr("cx", p[0])
            .attr("cy", p[1])
            .attr("r", radius)
            .attr("fill", "none")
            .attr("stroke", strokeColor)
            .attr("stroke-width", 2);
    }

    addMarker(sm, "#00ffbf", 6);
    addMarker(lg, "#ff4d4d", 8);
}

function clearPanelMarkers() {
    window.g.select(".panel-markers").selectAll("*").remove();
}


// =======================
// DOM Ready
// =======================
document.addEventListener("DOMContentLoaded", init);
