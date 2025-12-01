// =======================
// Global Configuration
// =======================
const width = 960;
const height = 480;

let marePolygons = [];
let allCraters = [];  
let erasedCraters = [];
let survivedCraters = [];   
let mareInfo = {};
let mareStats = {}; // Loaded from json/output.json

let tooltip;

// Track multiple SVG instances
let svgInstances = {};

// Mare-specific crater data for Section 6
let survivedByMare = {};
let erasedByMare = {};

// =======================
// Initialization
// =======================
function init() {
    setupTooltip();
    
    // Initialize different SVG instances for different sections
    initializeSVGForSection('mareMapVisualization', 'mare-hover'); // Section 3
    initializeSVGForSection('craterVizVisualization', 'crater-info'); // Section 4
    initializeSVGForSection('timelineVisualization', 'timeline'); // Section 5
    initializeSVGForSection('mareStatsVisualization', 'mare-stats'); // Section 6

    setupSlider();
    setupPageIndicator();
    createMareDetailPanel(); // Create panel for Section 6
    loadData();
}

// =======================
// Page Indicator
// =======================
function setupPageIndicator() {
    const sections = document.querySelectorAll('.fullpage-section');
    const currentPageEl = document.getElementById('currentPage');
    const totalPagesEl = document.getElementById('totalPages');
    
    if (!currentPageEl || !totalPagesEl) return;
    
    totalPagesEl.textContent = sections.length;
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const sectionNumber = entry.target.getAttribute('data-section');
                currentPageEl.textContent = sectionNumber;
                updateActiveVisualization(sectionNumber);
            }
        });
    }, { threshold: 0.5 });
    
    sections.forEach(section => observer.observe(section));
    
    const firstSection = sections[0];
    if (firstSection) {
        const sectionNumber = firstSection.getAttribute('data-section');
        updateActiveVisualization(sectionNumber);
    }
}

// =======================
// Update active visualization
// =======================
function updateActiveVisualization(sectionNumber) {
    const activeMap = {
        '3': 'mare-hover',
        '4': 'crater-info',
        '5': 'timeline',
        '6': 'mare-stats'
    }[sectionNumber];

    Object.entries(svgInstances).forEach(([key, instance]) => {
        if (instance.svg) {
            instance.svg.style.display = (key === activeMap) ? 'block' : 'none';
        }
    });

    if (!activeMap) return;

    if (sectionNumber === '4') animateCraterFormation();
    const panel = document.getElementById("mareStatsPanel");

    if (panel) {
        if (sectionNumber === "6") {
            panel.style.display = "block";
    } else {
        panel.style.display = "none";
  }
}

}

// =======================
// Initialize SVG for Section
// =======================
function initializeSVGForSection(containerId, interactionType) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (svgInstances[interactionType]) return;

    const svg = d3.create("svg")
        .attr("width", width)
        .attr("height", height)
        .style("background", "transparent")
        .style("display", "block");

    const projection = d3.geoEquirectangular()
        .scale(width / (2 * Math.PI))
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);
    const g = svg.append("g");

    g.append("image")
        .attr("href", "Astrogeology_Moon_LRO_LROC-WAC_Mosaic_global_1024.jpg")
        .attr("width", width)
        .attr("height", height);

    const graticule = d3.geoGraticule().step([30, 30]);
    g.append("path").datum(graticule).attr("class", "graticule").attr("d", path);

    g.append("g").attr("class", "mare");
    g.append("g").attr("class", "craters");
    g.append("g").attr("class", "hexbin-group");
    g.append("g").attr("class", "panel-markers");
    g.append("g").attr("class", "mare-callouts");
    g.append("g").attr("class", "formation-animation");

    const zoom = d3.zoom()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [width, height]])
        .on("zoom", e => g.attr("transform", e.transform));

    svg.call(zoom);
    container.appendChild(svg.node());
    svgInstances[interactionType] = { svg: svg.node(), svgSelection: svg, g, path, projection, interactionType };
}

// =======================
// Section 4: Crater Formation
// =======================
function animateCraterFormation() {
    const instance = svgInstances['crater-info'];
    if (!instance) return;

    const { g, projection } = instance;
    g.select(".formation-animation").selectAll("*").remove();
    const animGroup = g.select(".formation-animation");

    const impactLocations = [
        { lon: 20, lat: 15 },
        { lon: -30, lat: -20 },
        { lon: 45, lat: 25 },
        { lon: -15, lat: 30 },
        { lon: 60, lat: -15 }
    ];

    impactLocations.forEach((loc, i) => {
        setTimeout(() => animateSingleImpact(animGroup, projection, loc, i), i * 1500);
    });
}

function animateSingleImpact(animGroup, projection, loc, index) {
    const targetPos = projection([loc.lon, loc.lat]);
    const startX = Math.max(20, Math.min(width - 20, targetPos[0] - 100 + index*10));
    const startY = Math.max(20, Math.min(height - 20, targetPos[1] - 100 + index*5));

    const impactor = animGroup.append("circle").attr("cx", startX).attr("cy", startY).attr("r", 6).attr("class", "impactor");
    const trail = animGroup.append("line").attr("x1", startX).attr("y1", startY).attr("x2", startX).attr("y2", startY).attr("class", "impact-trail");

    impactor.transition().duration(800).ease(d3.easeQuadIn).attr("cx", targetPos[0]).attr("cy", targetPos[1]).on("end", () => createImpactEffects(animGroup, targetPos));
    trail.transition().duration(800).ease(d3.easeQuadIn).attr("x2", targetPos[0]).attr("y2", targetPos[1]).transition().duration(300).remove();
}

function createImpactEffects(animGroup, targetPos) {
    animGroup.append("circle").attr("cx", targetPos[0]).attr("cy", targetPos[1]).attr("class", "impact-flash").transition().duration(200).remove();
    animGroup.append("circle").attr("cx", targetPos[0]).attr("cy", targetPos[1]).attr("class", "impact-shockwave").transition().duration(600).remove();

    const craterSize = 15 + Math.random() * 15;
    animGroup.append("circle").attr("cx", targetPos[0]).attr("cy", targetPos[1]).attr("class", "impact-crater").transition().duration(400).attr("r", craterSize).transition().delay(800).duration(500).attr("opacity", 0.4);

    for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        animGroup.append("circle").attr("cx", targetPos[0]).attr("cy", targetPos[1]).attr("class", "impact-ejecta").transition().duration(500).attr("cx", targetPos[0] + Math.cos(angle) * 30).attr("cy", targetPos[1] + Math.sin(angle) * 30).remove();
    }
}

// =======================
// Load Data
// =======================
function loadData() {
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
                if (mareInfo[key]) feature.properties = { ...feature.properties, ...mareInfo[key] };
                if (key.includes("mare_tranquillitatis")) feature.geometry.coordinates[0].reverse();
                return feature;
            })
        );

        Promise.all(marePromises).then(features => {
            marePolygons = features.filter(f => f && f.geometry && f.geometry.coordinates && f.geometry.coordinates.length > 0);
            console.log("Valid mare polygons:", marePolygons.length);
            
            drawMarePolygonsForAll();
            drawMareCalloutsForAll();

            loadMareStats().then(() => {
                console.log("Mare stats loaded, now loading craters");
                loadCraters();
            }).catch(() => {
                console.log("Mare stats failed, loading craters anyway");
                loadCraters();
            });
        });
    }).catch(error => console.error("Error loading mare data:", error));
}

// =======================
// Draw Mare Polygons
// =======================
function drawMarePolygonsForAll() {
    Object.keys(svgInstances).forEach(key => drawMarePolygons(svgInstances[key]));
}

function drawMarePolygons(instance) {
    const { g, path, interactionType } = instance;

    if (g.select(".mare").empty()) {
        g.append("g").attr("class", "mare");
    }

    g.select(".mare").selectAll("*").remove();

    const mareGroup = g.select(".mare")
        .selectAll("path")
        .data(marePolygons)
        .enter()
        .append("path")
        .attr("class", "mare-polygon")
        .attr("d", path)
        .attr("fill", "rgba(0,0,0,0.2)")
        .attr("stroke", "#aaa")
        .attr("stroke-width", 0.6);

    // Bring labels/arrows to front if they exist
    const callouts = g.select(".mare-callouts");
    if (!callouts.empty()) callouts.raise();

    if (interactionType === 'mare-hover' || interactionType === 'crater-info') {

        mareGroup
            .on("mouseover", function(e, d) {
                d3.select(this).attr("stroke-width", 1.5);

                showTooltip(e, `
                    <strong>${d.properties["English Name"]}</strong><br/>
                    Type: ${d.properties.Mare}<br/>
                    Lat: ${d.properties.Latitude}<br/>
                    Lon: ${d.properties.Longitude}<br/>
                    Diameter: ${d.properties.Diameter}
                `);
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 0.6);
                hideTooltip();
            });

    } else if (interactionType === 'mare-stats') {

        mareGroup
            .on("mouseover", function(e, d) {
                d3.select(this).attr("stroke-width", 1.5);
                showTooltip(e, `
                    <strong>${d.properties["English Name"] || d.properties.Mare}</strong><br/>
                    Click to view detailed statistics
                `);
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 0.6);
                hideTooltip();
            })
            .on("click", (e, d) => {
                const mareKey = d.properties.Mare
                    .toLowerCase()
                    .replace(/\s+/g, "_");

                console.log("Clicked mare:", mareKey);

                // Get current slider value
                const slider = document.getElementById("timestepSlider");
                const timestep = slider ? +slider.value : 0;

                // Store current mare and update the detail panel
                d3.select("#mareStatsPanel").attr("data-current-mare", mareKey);
                updateMareDetailPanel(mareKey, timestep);
            });

    } else {
        // Simple hover effect
        mareGroup
            .on("mouseover", function() {
                d3.select(this).attr("stroke-width", 1.2);
            })
            .on("mouseout", function() {
                d3.select(this).attr("stroke-width", 0.6);
            });
    }
}

// =======================
// Draw Mare Callouts
// =======================
function drawMareCalloutsForAll() {
    const instance = svgInstances['mare-hover'];
    if (instance) drawMareCallouts(instance);
}

function drawMareCallouts(instance) {
    const { svgSelection, g, path } = instance;

    // Select or create the callouts group OUTSIDE the zoomed g
    let calloutGroup = svgSelection.select(".mare-callouts");
    if (calloutGroup.empty()) {
        calloutGroup = svgSelection.append("g").attr("class", "mare-callouts");
    }

    calloutGroup.selectAll("*").remove();

    const positions = {
        "mare_imbrium": { x: 430, y: 80 },
        "mare_vaporum": { x: 490, y: 290 },
        "mare_tranquillitatis": { x: 560, y: 340 },
        "mare_serenitatis": { x: 600, y: 148 },
        "mare_fecunditatis": { x: 670, y: 300 },
        "mare_crisium": { x: 720, y: 200 },
        "oceanus_procellarum": { x: 290, y: 290 }
    };

    calloutGroup.selectAll("g")
        .data(marePolygons)
        .enter()
        .append("g")
        .each(function(d) {
            const centroid = path.centroid(d);
            const key = d.properties.Mare.toLowerCase().replace(/\s+/g, "_");
            const pos = positions[key];
            if (!pos) return;

            const gNode = d3.select(this);

            // Arrow from mare centroid (inside g, projected coords) to fixed label position
            gNode.append("line")
                .attr("class", "mare-arrow")
                .attr("x1", centroid[0])
                .attr("y1", centroid[1])
                .attr("x2", pos.x)
                .attr("y2", pos.y)
                .attr("stroke", "#fff")
                .attr("stroke-width", 1);

            gNode.append("text")
                .attr("class", "mare-label")
                .attr("x", pos.x)
                .attr("y", pos.y)
                .attr("dy", d => {
                    const key = d.properties.Mare.toLowerCase().replace(/\s+/g, "_");
                    const pos = positions[key];
                    const centroid = path.centroid(d);
                if (!pos) return "0.35em";
                return pos.y > centroid[1] ? "1em" : "-0.35em";
                })

                .attr("text-anchor", "middle")
                .text(d.properties.Mare)
                .attr("fill", "#fff")
                .style("font-size", "12px");
        });
}

// =======================
// Tooltip
// =======================
function setupTooltip() {
    if (!d3.select(".tooltip").empty()) return;
    tooltip = d3.select("body").append("div").attr("class", "tooltip");
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
// Load Craters
// =======================
const diameterBins = [0, 1, 2, 3, 5, 6, 7, 8, 9, 10];

function updateTimeline(binIndex) {
    const instance = svgInstances['timeline'];
    if (!instance) return;

    const { g, projection } = instance;
    const craterGroup = g.select(".craters");
    craterGroup.selectAll("*").remove();

    if (binIndex < 0 || binIndex >= diameterBins.length) return;
    let minD = diameterBins[binIndex];
    let maxD;

    if (binIndex === diameterBins.length - 1) {
        maxD = Infinity;
    } else {
        maxD = diameterBins[binIndex + 1];
    }

    const filtered = allCraters.filter(c => c.size >= minD && c.size < maxD);

    // Plot craters
    craterGroup.selectAll("circle")
        .data(filtered)
        .enter()
        .append("circle")
        .attr("cx", d => projection([d.longitude, d.latitude])[0])
        .attr("cy", d => projection([d.longitude, d.latitude])[1])
        .attr("r", d => Math.max(1, Math.log10(d.size + 2) * 4))
        // .attr("r", d => Math.max(1, Math.sqrt(d.size)))
        .attr("fill", "rgba(66, 67, 80, 0.6)")
        .attr("stroke", "#fdf8f8ff")
        .attr("stroke-width", 0.5)
        .append("title")
        .text(d => `${d.size.toFixed(2)} m`);

    console.log(`Plotted ${filtered.length} craters in bin ${binIndex} (${minD}–${maxD === Infinity ? '∞' : maxD} m)`);
}


function loadCraters() {
    d3.json("filtered_craters.json").then(data => {
        allCraters = data; // all craters already filtered with mare names
        console.log("Loaded craters:", allCraters.length);

        // Initialize Section 5 timeline with all craters
        updateTimeline(+document.getElementById("timestepSlider").value);
    }).catch(err => console.error("Error loading crater data:", err));
}



// =======================
// Prepare crater data by mare for diameter filtering
// =======================
function computeCratersByMare() {
    // Initialize survivedByMare (we're repurposing it for diameter filtering)
    marePolygons.forEach(mare => {
        const key = mare.properties.Mare.toLowerCase().replace(/\s+/g, "_");
        survivedByMare[key] = [];
    });

    // Populate survivedByMare with crater info from allCraters
    allCraters.forEach(crater => {
        const mareKey = crater.polygon_name?.toLowerCase().replace(/\s+/g, "_");
        if (mareKey && survivedByMare[mareKey] !== undefined) {
            survivedByMare[mareKey].push({
                latitude: crater.latitude,
                longitude: crater.longitude,
                diameter: crater.size
            });
        }
    });

    console.log("Prepared survivedByMare for diameter filtering:", Object.keys(survivedByMare));
}

// =======================
// Slider (0–9, above visualization)
// =======================
function setupSlider() {
    // Section 5 slider: diameter bins
    const slider = document.getElementById("timestepSlider");
    const label = document.getElementById("timestepValue");

    if (slider && label) {
        slider.min = 0;
        slider.max = diameterBins.length - 1;
        slider.value = 0;

        let sliderTimeout;
        slider.addEventListener("input", () => {
            clearTimeout(sliderTimeout);
            sliderTimeout = setTimeout(() => {
                const binIndex = +slider.value;

                // Update label to show actual meter range
                const minD = diameterBins[binIndex];
                const maxD = diameterBins[binIndex + 1];
                label.textContent = maxD ? `${minD}–${maxD} m` : `> ${minD} m`;

                // Section 5: update timeline visualization
                updateTimeline(binIndex);

                // Section 6: keep timestep behavior unchanged
                const panel = d3.select("#mareStatsPanel");
                const mareKey = panel.attr("data-current-mare");
                if (mareKey && panel.style("display") !== "none") {
                    const mareSlider = document.getElementById("mareTimestepSliderInput");
                    const mareLabel = document.getElementById("mareTimestepValue");
                    if (mareSlider) mareSlider.value = mareSlider.value; // leave unchanged
                    if (mareLabel) mareLabel.textContent = mareSlider.value; // leave unchanged
                }
            }, 50);
        });
    }

    // Section 6 slider (independent, timestep)
    const mareSlider = document.getElementById("mareTimestepSliderInput");
    const mareLabel = document.getElementById("mareTimestepValue");

    if (mareSlider && mareLabel) {
        mareSlider.min = 0;
        mareSlider.max = 9;
        mareSlider.value = 0;

        let sliderTimeout;
        mareSlider.addEventListener("input", () => {
            clearTimeout(sliderTimeout);
            sliderTimeout = setTimeout(() => {
                const t = +mareSlider.value;
                mareLabel.textContent = t;

                // Update mare stats panel (still timestep)
                const panel = d3.select("#mareStatsPanel");
                const mareKey = panel.attr("data-current-mare");
                if (mareKey) {
                    updateMareDetailPanel(mareKey, t);
                }
            }, 50);
        });
    }
}


// =======================
// Load mare stats
// =======================
function loadMareStats() {
    return d3.json("json/output_new.json").then(data => {
        mareStats = data;
    });
}

// =======================
// Mare Detail Panel (Section 6)
// =======================
function createMareDetailPanel() {
  // If already exists, stop
  if (document.getElementById("mareStatsPanel")) return;

  const panel = document.createElement("div");
  panel.id = "mareStatsPanel";

  panel.style.position = "fixed";   // IMPORTANT
  panel.style.top = "0";
  panel.style.right = "0";
  panel.style.width = "350px";
  panel.style.height = "100vh";
  panel.style.background = "#111";
  panel.style.color = "#fff";
  panel.style.padding = "16px";
  panel.style.overflowY = "auto";
  panel.style.zIndex = "9999";      // float above SVG
  panel.style.display = "none";     // hidden by default
  panel.style.boxShadow = "-4px 0 10px rgba(0,0,0,0.4)";

  panel.innerHTML = `
    <h2 id="panelTitle">Mare Details</h2>
    <div id="panelBody">Click on a mare to view stats.</div>
  `;

  // Append to BODY, not to svg container
  document.body.appendChild(panel);
}


// =======================
// Update mare panel
// =======================
function updateMareDetailPanel(key, t) {
    const panel = d3.select("#mareStatsPanel");
    panel.style("display", "block");
    panel.attr("data-current-mare", key);

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
// Histogram
// =======================
function drawHistogram(values) {
    const cleaned = values.map(Number).filter(v => !isNaN(v));

    const svg = d3.select("#mareSizeHistogram");
    if (svg.empty()) return;
    
    svg.selectAll("*").remove();

    // Get the container's dimensions, accounting for padding (20px on each side = 40px total)
    const container = document.querySelector('.histogram-container');
    const containerWidth = container ? container.clientWidth - 40 : 400; // subtract padding
    const width = Math.max(280, containerWidth);
    const height = Math.min(350, width * 0.75); // Constrained responsive height
    
    // Set SVG dimensions dynamically
    svg.attr("width", width).attr("height", height);

    const margin = { top: 20, right: 20, bottom: 40, left: 50 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    if (cleaned.length === 0) {
        g.append("text")
            .attr("x", w / 2)
            .attr("y", h / 2)
            .attr("text-anchor", "middle")
            .attr("fill", "#999")
            .style("font-size", "14px")
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

    // X-axis
    g.append("g")
        .attr("transform", `translate(0, ${h})`)
        .call(d3.axisBottom(x).ticks(6))
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#ccc")
        .attr("dy", "8px");

    // Y-axis
    g.append("g")
        .call(d3.axisLeft(y).ticks(5))
        .selectAll("text")
        .style("font-size", "11px")
        .style("fill", "#ccc");

    // Axis lines
    g.selectAll(".domain, .tick line")
        .style("stroke", "#666");

    // X-axis label
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", height - 8)
        .attr("text-anchor", "middle")
        .style("font-size", "12px")
        .style("fill", "#999")
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
    <div style="margin-bottom:12px; font-size: 20px;">
        <strong style="font-size: 20px;">Smallest:</strong><br/>
        Lat: ${sLat.toFixed(3)}, Lon: ${sLon.toFixed(3)}, Diameter: ${(sm.diameter).toFixed(0)} m
    </div>
    <div style="font-size: 20px;">
        <strong style="font-size: 20px;">Largest:</strong><br/>
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

    // Only add markers to mare-stats instance (Section 6)
    const instance = svgInstances['mare-stats'];
    if (!instance) return;

    const { g, projection } = instance;
    const markersGroup = g.select(".panel-markers");

    const sm = data.plot_craters.smallest;
    const lg = data.plot_craters.largest;

    function addMarker(crater, strokeColor, radius) {
        const lat = crater.lattitude ?? crater.latitude;
        const lon = crater.longitude;
        const p = projection([lon, lat]);
        markersGroup.append("circle")
            .attr("cx", p[0])
            .attr("cy", p[1])
            .attr("r", radius)
            .attr("fill", "none")
            .attr("stroke", strokeColor)
            .attr("stroke-width", 2);
    }

    addMarker(sm, "#00ffbf", 8);
    addMarker(lg, "#ff4d4d", 10);
}

function clearPanelMarkers() {
    // Clear markers from Section 6 only
    const instance = svgInstances['mare-stats'];
    if (instance) {
        instance.g.select(".panel-markers").selectAll("*").remove();
    }
}

// =======================
// DOM Ready
// =======================
document.addEventListener("DOMContentLoaded", () => {
    const playButton = document.getElementById("playCraterAnimation");
    if (playButton) {
        playButton.addEventListener("click", () => {
            animateCraterFormation();
        });
    }
});

document.addEventListener("DOMContentLoaded", init);