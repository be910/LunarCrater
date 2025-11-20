// Config
const width = 960;
const height = 480;

let mareImbrium;
let allCraters;

// Initialize
function init() {
    setupSVG();
    setupSlider();
    loadPolygon("mare_imbrium.geojson");
    loadCraters();
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

// Mare Polygon
function loadPolygon(file) {
    d3.json(file).then(data => {
        mareImbrium = data.features[0];

        // Normalize longitudes > 180
        mareImbrium.geometry.coordinates[0] = mareImbrium.geometry.coordinates[0].map(([lon, lat]) => {
            lon = lon - 180;
            if (lon < -180) lon += 360;
            return [lon, lat];
        });

        drawMarePolygon();
    }).catch(err => console.error(err));
}

function drawMarePolygon() {
    const g = window.g;
    const path = window.path;

    g.select(".mare").selectAll("*").remove();
    g.select(".mare")
        .append("path")
        .datum(mareImbrium)
        .attr("class", "mare-polygon")
        .attr("d", path)
        .attr("fill", "rgba(0,0,255,0.1)")
        .attr("stroke", "#00f")
        .attr("stroke-width", 1);
}

// Load Craters
function loadCraters(file) {
    const url = "https://media.githubusercontent.com/media/be910/LunarCrater/main/erased_craters_mare.geojson";
    
    d3.json(url).then(data => {
        allCraters = data.features;

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
    if (!allCraters || !mareImbrium) return;

    const cratersThisStep = allCraters.filter(d =>
        d.properties.TimeStepCreated <= timestep &&
        d.properties.ErasedTimeStep > timestep &&
        d3.geoContains(mareImbrium, d.geometry.coordinates)
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
        .attr("fill", d => getCraterColor(d.properties.diameter))
        .attr("stroke", "#fff")
        .attr("stroke-width", 0.5)
        .on("mouseover", function(event, d) {
            d3.select(this).attr("class", "crater crater-hover");
            showTooltip(event, d);
        })
        .on("mouseout", function() {
            d3.select(this).attr("class", "crater");
            hideTooltip();
        });

    drawLegend();
}

// Draw legend below SVG
function drawLegend() {
    if (!document.getElementById("legendContainer")) {
        d3.select("#visualization")
          .append("div")
          .attr("id", "legendContainer");
    }

    const container = d3.select("#legendContainer");
    container.selectAll("*").remove();

    diameterBins.forEach((bin, i) => {
        const nextBin = diameterBins[i + 1] || ">";
        container.append("div")
            .attr("class", "legend-item")
            .html(`
                <div class="legend-circle" style="background:${colors[i]}; border:1px solid #fff;"></div>
                ${bin}${nextBin !== ">" ? "–" + nextBin + " km" : "+ km"}
            `);
    });
}

// Init 
document.addEventListener("DOMContentLoaded", init);
