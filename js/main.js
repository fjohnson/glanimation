import {PuppetMaster} from "./puppetmaster.js";

mapboxgl.accessToken = 'pk.eyJ1IjoiZmpvaG5zODg4IiwiYSI6ImNsaGh6eXo1dDAzMDMzbW1td3BqOXFoaDMifQ.RBC_0mpQ25-GRAZDA0E0oA';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/fjohns888/clt8v4v3z00ct01qk2h369tp4',
  center: [-83.854, 44.65], // starting position [lng, lat]
  zoom: 6 // starting zoom
});

map.on('load', async () => {

  /*Add Map controls - pause, restart, speed, etc */
  // const el = document.createElement('div');
  // el.className = 'marker';
  // const wellandCanalMarker = new mapboxgl.Marker(el, {"anchor":"center"});
  // wellandCanalMarker.setLngLat([-79.21264, 43.048])
  //   .setPopup(new mapboxgl.Popup({maxWidth:'none'}).setHTML("<p>Todo</p>"))
  //   .addTo(map);

  map.addControl(new mapboxgl.FullscreenControl({container: document.querySelector('body')}));
  // Add a map scale control to the map
  map.addControl(new mapboxgl.ScaleControl());
  // Add zoom and rotation controls to the map.
  map.addControl(new mapboxgl.NavigationControl());

  const mbglcc = document.getElementsByClassName("mapboxgl-control-container")[0];
  const cctr = mbglcc.getElementsByClassName("mapboxgl-ctrl-top-right")[0];
  const html = `<div class="mapboxgl-ctrl mapboxgl-ctrl-group">
  <button id="pause-btn" aria-label="play" title="Pause"><i class="fa-solid fa-pause"></i></button>
  <button id="restart-btn" aria-label="restart" title="Restart"><i class="fa-solid fa-rotate-left"></i></button>
  <button id="speed-btn" class="fa-layers fa-fw 1x" title="Adjust speed">
   <span class="fa-layers-text fa-inverse" data-fa-transform="shrink-2" style="color:black">1x</span>
  </button>
  <button id="terrain-btn" class="clt8v4v3z00ct01qk2h369tp4" title="Change Terrain"><i class="fa-solid fa-layer-group"></i></button>
  <button id="focus-btn" class="focus-disabled" title="Focus on a vessel when clicked"><img src=data/binoculars-solidr.png width="14"/></button>
  <button id="debug-btn" title="Debug" aria-label="debug">
    <i class="fa-solid fa-bug-slash"></i>
  </button>
  <div id="calendar-dialog"></div>
  <div id="about-dialog"></div>
  </div>`
  cctr.insertAdjacentHTML('beforeend',html);

  webpackExports.createCalendar(document.getElementById("calendar-dialog"));
  webpackExports.createAboutDialog(document.getElementById("about-dialog"));

  const tbtn = document.getElementById('terrain-btn');
  tbtn.addEventListener("click", ()=>{
    const cycle = new Map([
      ["clt8v4v3z00ct01qk2h369tp4","clt8uqlim00cp01qkewtm6jf8"],["clt8uqlim00cp01qkewtm6jf8","clt8uc45s00cl01qk70jn32y3",],
      ["clt8uc45s00cl01qk70jn32y3","clt8tdpi500pn01qpdncycb5o"],["clt8tdpi500pn01qpdncycb5o","clt8v4v3z00ct01qk2h369tp4"]]);

    for(let current of tbtn.classList.values()){
      if(cycle.has(current)){
        const styleNow = cycle.get(current);
        map.setStyle('mapbox://styles/fjohns888/' + styleNow);
        tbtn.classList.toggle(current);
        tbtn.classList.toggle(styleNow);
        break;
      }
    }
  });

  const response = await fetch(
    'data/manifest.json'
  );
  const data = await response.json();

  for(let vessel of data['manifest']){
    vessel['Date'] = dayjs(vessel['Date']);
  }
  let puppeteer = new PuppetMaster(data, map);
  webpackExports.callbackContainer.push(puppeteer);

  const pauseButton = document.getElementById('pause-btn');
  const restartButton = document.getElementById('restart-btn')
  const speedButton = document.getElementById("speed-btn");
  const focusButton = document.getElementById("focus-btn");
  const aboutButton = document.getElementById("about-btn");

  focusButton.addEventListener('click', ()=>{
    focusButton.classList.toggle('focus-disabled');
    puppeteer.toggleFocus();
    let html;
    if(focusButton.classList.contains('focus-disabled')){
      html = '<img src=data/binoculars-solidr.png width="14"/>';
    }else{
      html = '<i class="fa-solid fa-binoculars"></i>';
    }
    focusButton.replaceChildren();
    focusButton.insertAdjacentHTML('beforeend',html);
  });

  pauseButton.addEventListener('click', ()=>{
    let html;
    if (!puppeteer.isPaused()) {
      puppeteer.pause();
      html = '<i class="fa-solid fa-play"></i>';
      pauseButton.setAttribute('title','Play');
    } else {
      puppeteer.play();
      html = '<i class="fa-solid fa-pause"></i>';
      pauseButton.setAttribute('title','Pause');
    }
    pauseButton.replaceChildren();
    pauseButton.insertAdjacentHTML('beforeend',html);
  });

  restartButton.addEventListener('click', ()=>{
    puppeteer.die();
    puppeteer = new PuppetMaster(data, map);
    webpackExports.callbackContainer.pop();
    webpackExports.callbackContainer.push(puppeteer);

    if(pauseButton.classList.contains('pause')){
      //If the button is paused on restart, change its state to playing
      pauseButton.click();
    }else{
      //Otherwise state is okay, so just begin playing.
      puppeteer.play();
    }
  });

  speedButton.addEventListener("click", ()=>{
    let speedText;
    const cycle = new Map([["0.5x","1x"],["1x","2x"],["2x","4x"],["4x","0.5x"]]);
    for(let current of speedButton.classList.values()){
      if(cycle.has(current)){
        speedButton.classList.toggle(current);
        speedButton.classList.toggle(cycle.get(current));
        speedText = cycle.get(current);
        puppeteer.setSpeed(speedText);
        const html = `<span class="fa-layers-text fa-inverse" data-fa-transform="shrink-2" style="color:black">${speedText}</span>`
        speedButton.replaceChildren();
        speedButton.insertAdjacentHTML('beforeend',html);
        break;
      }
    }
  });

  map.on('styledata', () => {
    //This event is emitted the first time the map is loaded
    //and whenever the style is changed (happening multiple times apparently)
    puppeteer.reinitLayers();
  });

  puppeteer.play();

});

//DEBUG of location estimation
map.on('load', () => {

  const debugButton = document.getElementById('debug-btn');
  const positionInfo = document.getElementById('position-info');
  const featureInfoPane = document.getElementById('features');
  const distanceContainer = document.getElementById('distance');

  const featureNames = ['lines', 'estimation', 'real']
  let debugData = null;

  // Distance debugging definitions
  // GeoJSON object to hold our measurement features
  const geojson = {
    'type': 'FeatureCollection',
    'features': []
  };

  // Used to draw a line between points
  const linestring = {
    'type': 'Feature',
    'geometry': {
      'type': 'LineString',
      'coordinates': []
    }
  };

  function measurePoints(e){
    const features = map.queryRenderedFeatures(e.point, {
      layers: ['measure-points']
    });

    // Remove the linestring from the group
    // so we can redraw it based on the points collection.
    if (geojson.features.length > 1) geojson.features.pop();

    // Clear the distance container to populate it with a new value.
    distanceContainer.innerHTML = '';

    // If a feature was clicked, remove it from the map.
    if (features.length) {
      const id = features[0].properties.id;
      geojson.features = geojson.features.filter(
        (point) => point.properties.id !== id
      );
    } else {
      const point = {
        'type': 'Feature',
        'geometry': {
          'type': 'Point',
          'coordinates': [e.lngLat.lng, e.lngLat.lat]
        },
        'properties': {
          'id': String(new Date().getTime())
        }
      };

      geojson.features.push(point);
    }

    if (geojson.features.length > 1) {
      linestring.geometry.coordinates = geojson.features.map(
        (point) => point.geometry.coordinates
      );

      geojson.features.push(linestring);

      // Populate the distanceContainer with total distance
      const value = document.createElement('pre');
      const distance = turf.length(linestring);
      value.textContent = `Total distance: ${distance.toLocaleString()}km`;
      distanceContainer.appendChild(value);
    }

    map.getSource('distance-geojson').setData(geojson);
  }
  //End distance debugging definitions

  //Feature debugging
  function featureDebug(e){
    document.getElementById('position-info').innerHTML =
      // `e.point` is the x, y coordinates of the `mousemove` event
      // relative to the top-left corner of the map.
      JSON.stringify(e.point) +
      '<br />' +
      // `e.lngLat` is the longitude, latitude geographical position of the event.
      JSON.stringify(e.lngLat.wrap());

    //feature debug code here:
    const features = map.queryRenderedFeatures(e.point, {'layers':['estimation', 'real', 'glpath_outline']});

    const displayProperties = [
      "anode",
      "bnode",
      "length",
      "OBJECTID",
      "linkname"
    ];

    const displayFeatures = {};
    features.forEach((feat) => {
      if('name' in feat.properties){
        if(displayFeatures.names === undefined){
          displayFeatures.names = [];
        }
        displayFeatures.names.push(feat.properties.name);
      }
      else if('linkname' in feat.properties){
        if(displayFeatures.path === undefined){
          displayFeatures.path = [];
        }
        const path_feat = {};
        displayProperties.forEach((prop) => {
          path_feat[prop] = feat['properties'][prop];
        });
        displayFeatures['path'].push(path_feat);
      }
    })

    // Write object as string with an indent of two spaces.
    document.getElementById('features').innerHTML = JSON.stringify(
      displayFeatures,
      null,
      2
    );
  }

  debugButton.addEventListener('click', async()=>{
    debugButton.classList.toggle('on');
    featureInfoPane.classList.toggle('hidden');
    positionInfo.classList.toggle('hidden');

    // Load QGIS geojson (and pruned) version of this to show possible paths ships may take:
    // https://www.arcgis.com/home/item.html?id=a4940deebec84fb9b6afa65afcbf891d#overview

    if(map.getSource('glpaths') === undefined){
      map.addSource('glpaths', {
        'type': 'geojson',
        'data': "data/water_paths.json"
      });
    }

    //Load debugging json file when debug is clicked for the first time
    //This file is for showing actual geocoded locations vs their estimated location on the map
    //Its primary purpose is to aid in the correction of incorrect estimations or geocoded locations
    if(debugData === null) {
      const response = await fetch(
        'data/debug.json'
      );
      debugData = await response.json();
    }

    for (let featName of featureNames.values()){
      if(map.getSource(`${featName}`) === undefined){
        map.addSource(`${featName}`, {
          'type': 'geojson',
          'data': debugData[featName]
        });
      }
    }

    if(map.getSource('distance-geojson') === undefined){
      map.addSource('distance-geojson', {
        'type': 'geojson',
        'data': geojson
      });
    }

    debugButton.replaceChildren();
    //Debug off
    if (!debugButton.classList.contains('on')) {
      for(let featName of featureNames.values()){
        map.removeLayer(featName);
      }

      map.removeLayer('measure-points');
      map.removeLayer('measure-lines');
      map.removeLayer('glpath_outline');
      map.off('mousemove', featureDebug);
      map.off('click', measurePoints);
      map.on('mouseover', ()=>{ map.getCanvas().style.cursor = '';});
      debugButton.insertAdjacentHTML('beforeend','<i class="fa-solid fa-bug"></i>');
    }

    //Debug on
    else{
      map.addLayer({
        'id': 'lines',
        'type': 'line',
        'source': 'lines',
        'layout': {},
        'paint': {
          'line-color': 'yellow',
          'line-width': 2,
          'line-opacity': 0.5}});
      map.addLayer({
        'id': 'estimation',
        'type': 'circle',
        'source': 'estimation',
        'paint': {
          'circle-radius': 4,
          'circle-stroke-width': 2,
          'circle-color': 'green',
          'circle-stroke-color': 'white'}});
      map.addLayer({
        'id': 'real',
        'type': 'circle',
        'source': 'real',
        'paint': {
          'circle-radius': 4,
          'circle-stroke-width': 2,
          'circle-color': 'orange',
          'circle-stroke-color': 'white'}});

      // Show paths
      map.addLayer({
        'id': 'glpath_outline',
        'type': 'line',
        'source': 'glpaths',
        'layout': {},
        'paint': {
          'line-color': '#000',
          'line-width': 3,
          'line-opacity':0.5
        }
      });

      // Distance measuring layers
      map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'distance-geojson',
        paint: {
          'circle-radius': 5,
          'circle-color': '#000'
        },
        filter: ['in', '$type', 'Point']
      });
      map.addLayer({
        id: 'measure-lines',
        type: 'line',
        source: 'distance-geojson',
        layout: {
          'line-cap': 'round',
          'line-join': 'round'
        },
        paint: {
          'line-color': '#000',
          'line-width': 2.5
        },
        filter: ['in', '$type', 'LineString']
      });
      // End distance measuring layers

      map.on('mousemove', featureDebug);
      map.on('click', measurePoints);
      map.on('mouseover', () => {map.getCanvas().style.cursor = 'crosshair';});
      debugButton.insertAdjacentHTML('beforeend','<i class="fa-solid fa-bug-slash"></i>');
    }
  });
});
