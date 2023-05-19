mapboxgl.accessToken = 'pk.eyJ1IjoiZmpvaG5zODg4IiwiYSI6ImNsaGh6eXo1dDAzMDMzbW1td3BqOXFoaDMifQ.RBC_0mpQ25-GRAZDA0E0oA';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/mapbox/light-v11', // style URL
  center: [-83.926, 43.433], // starting position [lng, lat]
  zoom: 5 // starting zoom
});

const routeMap = {};
function elongatePaths(feature, segmentSize = 10){
  //A function for addition additional points along a precomputed shortest path from start->end
  //This is used because the animation draws a point for each vessel every x milliseconds
  //and by adding more points the animation not only becomes smoother, but it slows it down
  //and prevents the vessels from looking like they are "teleporting".
  //segment_size: additional points are added every segment_size KM

  let coords = feature.geometry.coordinates;
  let elongated_coords = [];
  let from = coords[0];

  for(let k =1; k< coords.length; k++){
    let to = coords[k];
    let distance = turf.distance(turf.point(from), turf.point(to));

    if(distance > segmentSize){
      let remaining_distance = distance;
      while(remaining_distance >= segmentSize){
        let line = turf.lineString([from, to]);
        let point = turf.along(line, segmentSize);
        elongated_coords.push(from);
        from = point.geometry.coordinates;
        remaining_distance -= segmentSize;
      }
    }
    else if(distance === segmentSize){
      if(k<coords.length) {
        elongated_coords.push(from);
        from = to;
      }
    }
  }
  elongated_coords.push(from);
  elongated_coords.push(coords[coords.length-1]);
  return {"type": "Feature", "geometry": {"type": "LineString", "coordinates": elongated_coords}};
}

map.on('load', () => {

  map.addSource('glpaths', {
    'type': 'geojson',
    'data': "data/geo.json"
  });

  // Add a black outline around the polygon.
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

  map.addControl(new mapboxgl.FullscreenControl());
  // Add a map scale control to the map
  map.addControl(new mapboxgl.ScaleControl());
  // Add zoom and rotation controls to the map.
  map.addControl(new mapboxgl.NavigationControl());


});

//DEBUG of location estimation
map.on('load', () => {

  const debugButton = document.getElementById('debug');
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

    const displayFeatures = features.map((feat) => {

      const displayFeat = {};
      displayProperties.forEach((prop) => {
        displayFeat[prop] = feat['properties'][prop];
      });
      if('name' in feat['properties']){
        displayFeat['name']=feat['properties']['name'];
      }
      return displayFeat;
    });

    // Write object as string with an indent of two spaces.
    document.getElementById('features').innerHTML = JSON.stringify(
      displayFeatures,
      null,
      2
    );
  }

  debugButton.addEventListener('click', async()=>{
    debugButton.classList.toggle('nodebug');
    featureInfoPane.classList.toggle('hidden');
    positionInfo.classList.toggle('hidden');

    //Load debugging json file when debug is clicked for the first time
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

    //Debug off
    if (debugButton.classList.contains('nodebug')) {
      for(let featName of featureNames.values()){
        map.removeLayer(featName);
      }

      map.removeLayer('measure-points');
      map.removeLayer('measure-lines');
      map.off('mousemove', featureDebug);
      map.off('click', measurePoints);
      map.on('mouseover', ()=>{ map.getCanvas().style.cursor = '';});
    }

    //Debug on
    if (!debugButton.classList.contains('nodebug')) {
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
    }
  });
});

class Puppet{
  #feature;
  #coordinates;
  #nextCordInd;

  name;
  position;
  isDone;
  constructor(feature, name){
    this.#feature = feature;
    this.#coordinates = turf.coordAll(this.#feature);
    this.position = turf.point(this.#coordinates[0]);
    this.name = name;
    this.#nextCordInd = 1;
    this.isDone = false;
  }

  advance() {
    if (this.#nextCordInd < this.#coordinates.length) {
      this.position.geometry.coordinates = this.#coordinates[this.#nextCordInd++];
      return false;
    }
    this.isDone = true;
    return true;
  }
  setupPopup() {

    position.properties = {'description':'<strong>Mad Men Season Five Finale Watch Party</strong><p>Head to Lounge 201 (201 Massachusetts Avenue NE) Sunday for a Mad Men Season Five Finale Watch Party, complete with 60s costume contest, Mad Men trivia, and retro food and drink. 8:00-11:00 p.m. $10 general admission, $20 admission and two hour open bar.</p>'}

    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: false,
      closeOnClick: false
    });

    map.on('mouseenter', 'trace1', (e) => {
      // Change the cursor style as a UI indicator.
      map.getCanvas().style.cursor = 'pointer';

      // Copy coordinates array.
      const coordinates = e.features[0].geometry.coordinates.slice();
      const description = e.features[0].properties.description;

      // Ensure that if the map is zoomed out such that multiple
      // copies of the feature are visible, the popup appears
      // over the copy being pointed to.
      while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
        coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
      }

      // Populate the popup and set its coordinates
      // based on the feature found.
      popup.setLngLat(coordinates).setHTML(description).addTo(map);
    });

    map.on('mouseleave', 'trace1', () => {
      map.getCanvas().style.cursor = '';
      popup.remove();
    });
  }
}
class PuppetMaster {
  #isPaused;
  #manifest;
  #date;
  #puppets;
  #curIndex;
  #finished;
  #timerSlow;
  #timerMed;
  #timerFast;
  #dayTimer;
  #dayDelay;
  #slowDelay;
  #medDelay;
  #fastDelay;
  constructor(manifest) {
    this.#puppets = {'slow':[], 'medium': [], 'fast': []};
    this.#timerSlow = null;
    this.#timerMed = null;
    this.#timerFast = null;
    this.#dayTimer = null;
    this.#dayDelay = 2000;
    this.#slowDelay = 30;
    this.#medDelay = 20;
    this.#fastDelay = 10;
    this.#date = manifest[0].Date;
    this.#manifest = manifest;
    this.#curIndex = 0;
    this.#finished = false;
    this.#isPaused = true;
  }

  addPuppet(vessel, list, color='#4264fb'){
    const name = vessel['Name of Vessel'];
    if (map.getSource(name) !== undefined){
      return;
    }
    const routeName = `${vessel['Where From']}+${vessel['Where Bound']}`;
    const feature = routeMap[routeName];
    const puppet = new Puppet(feature, name);

    map.addSource(name, {type: 'geojson', data: puppet.position});
    map.addLayer({
      'id': name,
      'type': 'circle',
      'source': name,
      'paint': {
        'circle-radius': 4,
        'circle-stroke-width': 2,
        'circle-color': color,
        'circle-stroke-color': 'white'
      }
    });
    list.push(puppet);
  }

  addVesselsToLists(){
    const innerFunc = function(){
      let vessel = this.#manifest[this.#curIndex];
      while (vessel.Date.isSame(this.#date) && !this.#finished) {
        if (vessel['Vessel Type'] === 'Schooner') {
          this.addPuppet(vessel, this.#puppets.slow);
        } else if (vessel['Vessel Type'] === 'Barkentine' || vessel['Vessel Type'] === 'Brigantine') {
          this.addPuppet(vessel, this.#puppets.medium, 'green');
        } else {
          this.addPuppet(vessel, this.#puppets.fast, 'purple');
        }

        if (this.#curIndex + 1 === this.#manifest.length) {
          this.#finished = true;
        } else {
          vessel = this.#manifest[++this.#curIndex]
        }
      }
      this.#date = this.#date.add(1, 'day');
    }.bind(this);

    //Call the logic once before the timer, so that results show up right away.
    innerFunc();
    return setInterval(innerFunc, this.#dayDelay);
  }

  pause() {
    window.clearInterval(this.#timerSlow);
    window.clearInterval(this.#timerMed);
    window.clearInterval(this.#timerFast);
    window.clearInterval(this.#dayTimer);
    this.#isPaused = true;
  }

  addTimer(listName, delay){
    return setInterval(() => {
      const puppetList = this.#puppets[listName];

      for(let i=0; i<puppetList.length;i++){
        const puppet = puppetList[i];
        if(puppet.isDone) continue;
        map.getSource(puppet.name).setData(puppet.position);
        const isDone = puppet.advance();
        if(isDone){
          map.removeLayer(puppet.name);
          map.removeSource(puppet.name);
        }
      }

    }, delay);
  }
  play() {
    //check if we are paused so that this function cannot be called multiple times while running by mistake.
    //that would set up a situation where multiple timers are running.
    if (this.#isPaused) {
      this.#dayTimer = this.addVesselsToLists(this.#dayDelay);
      this.#timerSlow = this.addTimer('slow', this.#slowDelay);
      this.#timerMed = this.addTimer('medium', this.#medDelay);
      this.#timerFast = this.addTimer('fast', this.#fastDelay);
      this.#isPaused = false;
    }
  }

  die(){
    this.pause();
    Object.values(this.#puppets).forEach((list) => {
      list.forEach((puppet)=>{
        map.removeLayer(puppet.name);
        map.removeSource(puppet.name);
      });
    });
  }
}

map.on('load', async () => {

  const response = await fetch(
    'data/manifest.json'
  );

  const data = await response.json();

  turf.featureEach(data['routes'], (feature) => {
    routeMap[feature['properties']['path']] = elongatePaths(feature);
  })
  for(let vessel of data['manifest']){
    vessel['Date'] = dayjs(vessel['Date']);
  }
  let puppeteer = new PuppetMaster(data['manifest']);

  const pauseButton = document.getElementById('pause');
  const restartButton = document.getElementById('restart')

  // click the button to pause or play
  pauseButton.addEventListener('click', ()=>{
    pauseButton.classList.toggle('pause');
    if (pauseButton.classList.contains('pause')) {
      puppeteer.pause();
    } else {
      puppeteer.play();
    }
  });

  restartButton.addEventListener('click', ()=>{
    if(pauseButton.classList.contains('pause')){
      pauseButton.classList.toggle('pause');
    }
    puppeteer.die();
    puppeteer = new PuppetMaster(data['manifest']);
    puppeteer.play();
  });

  puppeteer.play();


});

