// Config
const width = 960;
const height = 480;

let marePolygons = [];
let allCraters;
let mareInfo = {};

// Initialize
function init() {
    setupSVG();
    setupSlider();

    const mareFiles = [
        "mareData/mare_imbrium.geojson",
        "mareData/mare_vaporum.geojson",
        "mareData/mare_tranquillitatis.geojson",
        "mareData/mare_serenitatis.geojson",
        "mareData/mare_fecunditatis.geojson",
        "mareData/mare_crisium.geojson",
        "mareData/oceanus_procellarum.geojson"
    ];

    // Load mare info CSV
    d3.csv("mareData/mareInfo.csv").then(data => {
        data.forEach(d => {
            const key = d.Mare.trim().toLowerCase().replace(/\s+/g, "_");
            mareInfo[key] = d;
        });

        // Load all GeoJSONs in parallel
        const promises = mareFiles.map(file =>
            d3.json(file).then(data => {
                let feature = data.features[0];
                const key = file.split("/").pop().replace(".geojson", "").trim().toLowerCase();

                if (mareInfo[key]) feature.properties = { ...feature.properties, ...mareInfo[key] };

                // Reverse Tranquillitatis if needed
                if (key.includes("mare_tranquillitatis")) feature.geometry.coordinates[0].reverse();

                return feature;
            })
        );

        Promise.all(promises).then(features => {
            marePolygons = features;
            drawMarePolygons();
            drawMareCallouts();
            loadCraters(); // now safe to load craters
        });
    });
}

// Projection
function setupSVG() {
    const svg = d3.select("#visualization")
        .append("svg")
        .attr("width", width)
        .attr("height", height);

    const projection = d3.geoEquirectangular()
        .rotate([0, 0])
        .scale(width / (2 * Math.PI))
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    const g = svg.append("g");

    window.svg = svg;
    window.g = g;
    window.projection = projection;
    window.path = path;

    // Moon surface
    g.append("image")
        .attr("class", "moon-surface")
        .attr("href", "Astrogeology_Moon_LRO_LROC-WAC_Mosaic_global_1024.jpg")
        .attr("x", 0).attr("y", 0)
        .attr("width", width).attr("height", height)
        .attr("preserveAspectRatio", "none");

    // Graticule
    const graticule = d3.geoGraticule().step([30, 30]);
    g.append("path")
        .datum(graticule)
        .attr("class", "graticule")
        .attr("d", path);

    // Groups
    g.append("g").attr("class", "mare");
    g.append("g").attr("class", "craters");

    // Setup zoom
    setupZoom(svg, g);
}

// Setup zoom behavior with constrained panning
function setupZoom(svg, g) {
    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .extent([[0, 0], [width, height]])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", (event) => g.attr("transform", event.transform));

    svg.call(zoom);

    // Zoom reset button functionality
    window.resetZoom = function() {
        svg.transition()
            .duration(750)
            .call(zoom.transform, d3.zoomIdentity);
    };
}

function drawMarePolygons() {
    const g = window.g;
    const path = window.path;

    g.select(".mare").selectAll("*").remove();

    g.select(".mare")
        .selectAll("path")
        .data(marePolygons)
        .join("path")
        .attr("class", "mare-polygon")
        .attr("d", path)
        .on("mouseover", (event, d) => {
            d3.select(event.currentTarget).classed("hover", true);

            const info = d.properties;
            d3.select("body").append("div")
                .attr("class", "tooltip")
                .html(`
                    <strong>${info["English Name"]}</strong><br/>
                    Mare: ${info["Mare"]}<br/>
                    Lat: ${info["Latitude"]}<br/>
                    Lon: ${info["Longitude"]}<br/>
                    Diameter: ${info["Diameter"]}
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseout", (event, d) => {
            d3.select(event.currentTarget).classed("hover", false);
            d3.selectAll(".tooltip").remove();
        });
}


function drawMareCallouts() {
    const g = window.g;
    const path = window.path;

    g.select(".mare-callouts").remove();
    const calloutGroup = g.append("g").attr("class", "mare-callouts");

    // Manual label positions
    const mareLabelPositions = {
        "mare_imbrium": { x: 450, y: 90 },
        "mare_vaporum": { x: 490, y: 290 },
        "mare_tranquillitatis": { x: 560, y: 340 },
        "mare_serenitatis": { x: 600, y: 148 },
        "mare_fecunditatis": { x: 670, y: 300 },
        "mare_crisium": { x: 700, y: 200 },
        "oceanus_procellarum": { x: 290, y: 310 }
    };

    // Per-mare arrow shortening (distance from label)
    const mareShorten = {
        "mare_imbrium": 8,
        "mare_vaporum": 7,
        "mare_tranquillitatis": 8,
        "mare_serenitatis": 8,
        "mare_fecunditatis": 9,
        "mare_crisium": 6,
        "oceanus_procellarum": 7
    };

    // Helper: get centroid for Polygon or MultiPolygon
    function getCentroid(d) {
        if (d.geometry.type === "Polygon") return path.centroid(d);
        if (d.geometry.type === "MultiPolygon") {
            let maxArea = 0, centroid = [0, 0];
            d.geometry.coordinates.forEach(coords => {
                const area = Math.abs(d3.polygonArea(coords[0]));
                if (area > maxArea) {
                    maxArea = area;
                    centroid = path.centroid({ type: "Feature", geometry: { type: "Polygon", coordinates: coords } });
                }
            });
            return centroid;
        }
        return [0, 0];
    }

    calloutGroup.selectAll("g")
        .data(marePolygons)
        .enter()
        .append("g")
        .each(function(d) {
            const centroid = getCentroid(d);
            if (!isFinite(centroid[0]) || !isFinite(centroid[1])) return;

            const key = d.properties.Mare.toLowerCase().replace(/\s+/g, "_");
            const labelPos = mareLabelPositions[key];
            if (!labelPos) return;

            const labelX = labelPos.x;
            const labelY = labelPos.y;

            const dx = labelX - centroid[0];
            const dy = labelY - centroid[1];
            const dist = Math.hypot(dx, dy);

            // Use per-mare shorten distance or default 1
            const shorten = mareShorten[key] || 1;
            const arrowX = labelX - (dx / dist) * shorten;
            const arrowY = labelY - (dy / dist) * shorten;

            // Draw line arrow 
            d3.select(this)
                .append("line")
                .attr("class", "mare-arrow")
                .attr("x1", centroid[0])
                .attr("y1", centroid[1])
                .attr("x2", arrowX)
                .attr("y2", arrowY);

            // Draw label 
            d3.select(this)
                .append("text")
                .attr("class", "mare-label")
                .attr("x", labelX)
                .attr("y", labelY)
                .text(d.properties["Mare"])
                .attr("text-anchor", dx >= 0 ? "start" : "end")
                .attr("dy", dy >= 0 ? "0.8em" : "-0.2em");
        });
}


// Load Craters
function loadCraters(file) {
     // mare crater data
    const survivedURL = "craterData/survived_craters_mare.csv";
    const erasedURL = "craterData/erased_craters_mare.csv";

    Promise.all([
        d3.csv(survivedURL),
        d3.csv(erasedURL)
    ])
    .then(([survivedRows, erasedRows]) => {

        // convert CSV to GeoJSON
        const survivedGeo = survivedRows.map(d => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [+d.Longitude, +d.Latitude]
            },
            properties: {
                diameter: +d.diameter,
                TimeStepCreated: +d.TimeStepCreated,
                ErasedTimeStep: Infinity,       // survived = never erased
                status: "survived"
            }
        }));

        const erasedGeo = erasedRows.map(d => ({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [+d.Longitude, +d.Latitude]
            },
            properties: {
                diameter: +d.diameter,
                TimeStepCreated: +d.TimeStepCreated,
                ErasedTimeStep: +d.ErasedTimeStep,
                status: "erased"
            }
        }));

        // merge into one list
        allCraters = [...survivedGeo, ...erasedGeo];

        // set slider max
        const maxTimestep = d3.max(allCraters, d => d.properties.TimeStepCreated);
        const slider = document.getElementById("timestepSlider");
        slider.max = maxTimestep;
        updateCratersForTimestep(+slider.value);
    }).catch(err => console.error(err));
}

// Slider 
function setupSlider() {
    const slider = document.getElementById("timestepSlider");
    const valueLabel = document.getElementById("timestepValue");

    slider.addEventListener("input", () => {
        const t = +slider.value;
        valueLabel.textContent = t;
        updateCratersForTimestep(t);
    });
}

// Tooltip 
function showTooltip(event, d) {
    const tooltip = d3.select("body").append("div").attr("class", "tooltip");

    tooltip.html(`
        <strong>Erased Crater</strong><br/>
        Diameter: ${d.properties.diameter.toFixed(2)} km<br/>
        Lat: ${d.properties.Latitude.toFixed(2)}°<br/>
        Lon: ${d.properties.Longitude.toFixed(2)}°<br/>
        Created: TimeStep ${d.properties.TimeStepCreated}<br/>
        Erased: TimeStep ${d.properties.ErasedTimeStep}
    `).style("left", (event.pageX + 10) + "px")
      .style("top", (event.pageY - 28) + "px");
}

function hideTooltip() {
    d3.selectAll(".tooltip").remove();
}


// Crater legend
const diameterBins = [0, 10, 20, 40, 80];
const colors = [ "#fbbf24", "#f97316", "#dc2626", "#7f1d1d", "#4b0000"];

function getCraterColor(d) {
    for (let i = diameterBins.length - 1; i >= 0; i--) {
        if (d >= diameterBins[i]) return colors[i];
    }
    return colors[0];
}

// Update craters for timestep
function updateCratersForTimestep(timestep) {
    if (!allCraters || marePolygons.length === 0) return;

    const cratersThisStep = allCraters.filter(d =>
        d.properties.TimeStepCreated <= timestep &&
        d.properties.ErasedTimeStep > timestep &&
        marePolygons.some(m => d3.geoContains(m, d.geometry.coordinates))
    );

    const g = window.g;
    const projection = window.projection;
    const craterScale = d3.scaleSqrt().domain([0, 100]).range([2, 8]);

    g.select(".craters").selectAll("*").remove();
    g.select(".craters")
        .selectAll(".crater")
        .data(cratersThisStep)
        .join("circle")
        .attr("class", "crater")
        .attr("cx", d => projection(d.geometry.coordinates)[0])
        .attr("cy", d => projection(d.geometry.coordinates)[1])
        .attr("r", d => craterScale(d.properties.diameter))
        .attr("fill", d => d.properties.status === "erased"? "rgba(180, 180, 180, 0.6)": "rgba(0, 255, 220, 0.9)")
        .attr("stroke", d => d.properties.status === "erased" ? "#cccccc" : "#00ffee")
        .attr("stroke-width", d => d.properties.status === "erased" ? 0.5 : 1.0)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("class", "crater crater-hover");
            showTooltip(event, d);
        })
        .on("mouseout", function() {
            d3.select(this).attr("class", "crater");
            hideTooltip();
        });

    // Legend stays the same
    drawLegend();
}

// Draw legend below SVG
function drawLegend() {
    const container = d3.select("#legendContainer");
    container.selectAll("*").remove();

    const items = [
        { label: "Survived Crater", color: "rgba(0, 255, 220, 0.9)" },  // cyan
        { label: "Erased Crater", color: "rgba(200, 200, 200, 0.6)" }   // gray
    ];

    items.forEach(item => {
        const row = container.append("div")
            .attr("class", "legend-item");

        row.append("div")
            .attr("class", "legend-circle")
            .style("background", item.color);

        row.append("span")
            .text(item.label);
    });
}

// Init 
document.addEventListener("DOMContentLoaded", init);
