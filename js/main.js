mapboxgl.accessToken = 'pk.eyJ1IjoiZmpvaG5zODg4IiwiYSI6ImNsaGh6eXo1dDAzMDMzbW1td3BqOXFoaDMifQ.RBC_0mpQ25-GRAZDA0E0oA';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/mapbox/light-v11', // style URL
  center: [-83.926, 43.433], // starting position [lng, lat]
  zoom: 5 // starting zoom
});

const routeMap = {};

function elongatePaths(feature, segmentSize = 0.5){
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

  map.addControl(new mapboxgl.FullscreenControl());
  // Add a map scale control to the map
  map.addControl(new mapboxgl.ScaleControl());
  // Add zoom and rotation controls to the map.
  map.addControl(new mapboxgl.NavigationControl());

  const mbglcc = document.getElementsByClassName("mapboxgl-control-container")[0];
  const cctr = mbglcc.getElementsByClassName("mapboxgl-ctrl-top-right")[0];
  const html = `<div class="mapboxgl-ctrl mapboxgl-ctrl-group">
  <button id="pause-btn" aria-label="play" title="Playing"><i class="fa-solid fa-pause"></i></button>
  <button id="restart-btn" aria-label="restart" title="Restart"><i class="fa-solid fa-rotate-left"></i></button>
  <button id="speed-btn" class="fa-layers fa-fw 1x" title="Adjust speed">
   <span class="fa-layers-text fa-inverse" data-fa-transform="shrink-2" style="color:black">1x</span>
  </button>
  <button id="terrain-btn" class="navigation-day-v1" title="Change Terrain"><i class="fa-solid fa-layer-group"></i></button>
  <button id="debug-btn" title="Debug" aria-label="debug">
    <i class="fa-solid fa-bug-slash"></i>
  </debug>
</div>`
  cctr.insertAdjacentHTML('beforeend',html);

  const tbtn = document.getElementById('terrain-btn');
  tbtn.addEventListener("click", ()=>{
    const cycle = new Map([
      ["light-v11","navigation-day-v1"],["navigation-day-v1","streets-v12",],
      ["streets-v12","satellite-streets-v12"],["satellite-streets-v12","outdoors-v12"],
      ["outdoors-v12","light-v11"]]);

    for(let current of tbtn.classList.values()){
      if(cycle.has(current)){
        const styleNow = cycle.get(current);
        map.setStyle('mapbox://styles/mapbox/' + styleNow);
        tbtn.classList.toggle(current);
        tbtn.classList.toggle(styleNow);

        if(styleNow === 'satellite-streets-v12'){
          document.getElementById("date").style.color = "#fff";
          document.getElementById("title").style.color = "#fff";
        }
        else{
          document.getElementById("date").style.color = "black";
          document.getElementById("title").style.color = "black";
        }
        break;
      }
    }
  });

});

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

  const pauseButton = document.getElementById('pause-btn');
  const restartButton = document.getElementById('restart-btn')
  const speedButton = document.getElementById("speed-btn");

  pauseButton.addEventListener('click', ()=>{
    pauseButton.classList.toggle('pause');
    let html;
    if (pauseButton.classList.contains('pause')) {
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
    puppeteer = new PuppetMaster(data['manifest']);

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



class Puppet{
  #coordinates;
  #nextCordInd;

  vesselInfo;
  name;
  nextPosition;
  curPosition;
  isDone;
  constructor(feature, vesselInfo, offset=0){
    this.#coordinates = turf.coordAll(feature);
    this.#nextCordInd = 1;
    this.curPosition = null;
    this.name = vesselInfo['Name of Vessel'];
    this.isDone = false;
    this.vesselInfo = vesselInfo;

    if(offset >= this.#coordinates.length){
      /*FIXME, this means that this puppet is going to share the same starting position
      * on the map as another puppet and will be obscured. Use turf.along to generate new points??
      * Is this fixed?? See function PuppetMaster.addVesselsToLists()
      */
      offset = 0;
    }
    this.nextPosition = this.#coordinates[offset];


  }

  advance() {
    if (this.#nextCordInd < this.#coordinates.length) {
      this.curPosition = this.nextPosition;
      this.nextPosition = this.#coordinates[this.#nextCordInd++];
      return false;
    }
    this.isDone = true;
    return true;
  }

  get numPositions(){
    return this.#coordinates.length;
  }

  get coordsGeoJson(){
    return turf.lineString(this.#coordinates);
  }

  get coordsProgress(){
    let doneCoords = this.#coordinates.slice(0,this.#nextCordInd);
    let remainingCoords = this.#coordinates.slice(this.#nextCordInd);

    /*
      Need these conditionals because linestrings must always have two points
      These edge cases happen when either the ship has just been placed on the map
      or the ship is basically finished its voyage.
     */
    if(doneCoords.length<2){
      doneCoords = turf.lineString(this.#coordinates.slice(0,this.#nextCordInd+1));
    }
    else{
      doneCoords = turf.lineString(doneCoords);
    }

    if(remainingCoords.length<2){
      remainingCoords = turf.lineString(this.#coordinates.slice(this.#coordinates.length-2));
    }
    else{
      remainingCoords = turf.lineString(remainingCoords);
    }

    return {
      done: doneCoords,
      remaining: remainingCoords
    }
  }
}
class PuppetMaster {
  #isPaused;
  #manifest;
  #date;
  #puppets;
  #puppetPositions;
  #curIndex;
  #timerSlow;
  #timerMed;
  #timerFast;
  #dayTimer;
  #dayDelay;
  #slowDelay;
  #medDelay;
  #fastDelay;
  #listCleaner;
  #lastDate;
  #layers;
  #layerColours;
  #listenerList = [];

  //Variables relating to popup / route tracking
  #popup;
  #sourceRemaining = 'hlRouteRemainingSrc';
  #sourceDone = 'hlRouteDoneSrc';
  #layerRemaining = 'hlRouteRemainingLayer';
  #layerDone = 'hlRouteDoneLayer';
  #markerStart = new mapboxgl.Marker({'color':'green'});
  #markerEnd = new mapboxgl.Marker({'color':'red'});
  #zoomStartFunc = null;
  #zoomEndFunc = null;
  #trackingTimer = null;
  #trackingPuppet = null;
  constructor(manifest) {

    this.#layers = ['slow','medium','fast'];
    this.#layerColours = this.getObject(this.#layers, ['#4264fb','green','purple']);
    this.#puppets = this.getObject(this.#layers,[[],[],[]]);
    this.#puppetPositions = this.getObject(this.#layers,[turf.multiPoint(), turf.multiPoint(),turf.multiPoint()]);
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
    this.#isPaused = true;
    this.#lastDate = manifest[manifest.length-1].Date;
    this.#popup = this.setupPopup(this.#layers);

    for (const [layer, colour] of Object.entries(this.#layerColours)) {
      this.addPositionLayers(layer, colour);
    }

    this.highlightRouteAndTrack(this.#layers);

    //Periodically remove puppets that are no longer on the map
    this.#listCleaner = setInterval(()=>{
      this.#layers.forEach((name)=>{
        const cleaned = [];
        for(let p of this.#puppets[name].values()){
          if(!p.isDone){
            cleaned.push(p);
          }
        }
        this.#puppets[name] = cleaned;
      })
    }, 5000);
  }
  getObject(keys, vals){
    const newObj = {};
    let i = 0;
    keys.forEach((key)=>{
      newObj[key] = vals[i++];
    })
    return newObj;
  }

  setSpeed(speed){
    const speedFactor = parseFloat(speed.slice(0,-1))
    this.pause()
    this.play(speedFactor)
  }
  addPositionLayers(name, color){
    map.addSource(name, {type: 'geojson', data: null});
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
  }
  addPuppet(vessel, list, offset){
    const name = vessel['Name of Vessel'];

    if (map.getSource(name) !== undefined){
      /*FIXME: Needed right now to prevent the same ship from existing on the map at the same time
     This happens when say ship A is placed on the map at date t2, then ship A is again
     placed on the map on date t2. Really, ship A should have been taken off the map before
     being added at t2, but the speed the at which ships are currently emulated is not 100%
     indicative of real life.*/
      return;
    }
    const routeName = `${vessel['Where From']}+${vessel['Where Bound']}`;
    const feature = routeMap[routeName];
    const puppet = new Puppet(feature, vessel, offset);

    list.push(puppet);
  }
  findPuppet(mouseCoord, listName){
    //Find the puppet whose position is closest to the mouse.
    let minimumDistance = null;
    let closest = null;
    const mcPoint = turf.point(mouseCoord);

    this.#puppets[listName].forEach((puppet)=>{
      if(puppet.isDone){
        //Don't look up vessels that are no longer on the map
        return;
      }
      const pPoint = puppet.curPosition !== null ? puppet.curPosition : puppet.nextPosition;
      const distance = turf.distance(mcPoint, turf.point(pPoint));
      if(minimumDistance === null || minimumDistance > distance){
        closest = puppet
        minimumDistance = distance;
      }
    });

    return closest;
  }

  highlightRouteAndTrack(layerNames) {

    layerNames.forEach((layer) => {
      const mouseDownListener = (e) => {
        console.log('highlightRouteAndTrack mousedown');
        const mousePoint = [e.lngLat['lng'], e.lngLat['lat']];
        const puppet = this.findPuppet(mousePoint, layer);

        map.addSource(this.#sourceRemaining, {
          "type": "geojson",
          "data": puppet.coordsGeoJson
        });

        map.addLayer({
          'id': this.#layerRemaining,
          'type': 'line',
          'source': this.#sourceRemaining,
          'layout': {},
          'paint': {
            'line-color': 'yellow',
            'line-opacity': 0.75,
            'line-width': 5
          }});

        map.addSource(this.#sourceDone, {
          "type": "geojson",
          "data": turf.lineString(puppet.nextPosition)
        });

        map.addLayer({
          'id': this.#layerDone,
          'type': 'line',
          'source': this.#sourceDone,
          'layout': {},
          'paint': {
            'line-color': 'blue',
            'line-opacity': 0.75,
            'line-width': 5
          }
        });

        const puppetCoords = puppet.coordsGeoJson.geometry.coordinates;
        this.#markerStart.remove().setLngLat(puppetCoords[0]).addTo(map);
        this.#markerEnd.remove().setLngLat(puppetCoords[puppetCoords.length-1]).addTo(map);
        this.zoomToStartEnd(puppet.curPosition,puppetCoords[0],puppetCoords[puppetCoords.length-1]);
        this.#trackingPuppet = puppet;
        if(!this.#isPaused) {
          this.addTrackerTimer();
        }
      }
      map.on('mousedown', layer, mouseDownListener);
      this.#listenerList.push(['mousedown',layer,mouseDownListener]);
    });

  }
  /*
  When a vessel is clicked on, zoom the screen in such that it centers on the vessel and
  also shows the start and end positions of its voyage.
  */
  zoomToStartEnd(puppetPosition, markerStart, markerEnd){
    //These are mapbox constants
    const minZoom = 0;
    const maxZoom = 20;

    const points = turf.points([puppetPosition, markerStart, markerEnd]);
    let zoom = 0;
    do {
      map.jumpTo({'center':puppetPosition, 'zoom':(zoom)});
      let bounds = map.getBounds();
      let multipt = turf.multiPoint([
        [bounds['_sw'].lng,bounds['_sw'].lat],
        [bounds['_ne'].lng,bounds['_ne'].lat]]);
      let bbox = turf.bbox(multipt);
      let bboxPoly = turf.bboxPolygon(bbox);
      let result = turf.pointsWithinPolygon(points, bboxPoly);

      if(result.features.length !== 3){
        if(zoom !== minZoom && zoom !== maxZoom){
          map.jumpTo({'center':puppetPosition, 'zoom':(zoom-1)});
          break;
        }else{
          throw new Error("Marker and center point not visible event at zoom 0 or 20");
        }
      }
      zoom++;
    } while(zoom < maxZoom+1);
  }

  removeHLLayer(){
    console.log('              ->removeHLLayer()');
    this.#trackingPuppet = null;
    map.removeLayer(this.#layerRemaining);
    map.removeLayer(this.#layerDone);
    map.removeSource(this.#sourceRemaining);
    map.removeSource(this.#sourceDone);

    this.#markerStart.remove();
    this.#markerEnd.remove();
    this.zoomFixOff();
    clearInterval(this.#trackingTimer);
  }
  setupPopup(layerNames){

    // Create a popup, but don't add it to the map yet.
    const popup = new mapboxgl.Popup({
      closeButton: true,
      closeOnClick: false,
      maxWidth: 'none'
    });
    popup.on('close', () => {
      console.log('popup close ->')
      this.removeHLLayer();
    });

    const mouseEnterListener = (e) =>{
      map.getCanvas().style.cursor = 'pointer';
    };
    const mouseLeaveListener = () => {
      map.getCanvas().style.cursor = '';
    }

    layerNames.forEach((layer)=>{
      const mouseDownListener = (e) => {
        console.log('setupPopup mousedown');
        // Change the cursor style as a UI indicator.

        const mousePoint = [e.lngLat['lng'], e.lngLat['lat']];
        const puppet = this.findPuppet(mousePoint, layer);
        const pPoint = puppet.curPosition !== null ? puppet.curPosition : puppet.nextPosition;
        const vi = puppet.vesselInfo;

        const barkentineSVG = "https://upload.wikimedia.org/wikipedia/commons/f/f1/Sail_plan_barquentine.svg";
        const schoonerSVG = "https://upload.wikimedia.org/wikipedia/commons/e/e1/Sail_plan_schooner.svg";
        const propellerImg = "https://tinyurl.com/yc4c7555";
        const vesselType = vi['Vessel Type'].trim().toLowerCase();

        let vesselImg;
        if(vesselType === "schooner"){
          vesselImg = schoonerSVG;
        }
        else if(vesselType === "brigantine" || vesselType === "barkentine"){
          vesselImg = barkentineSVG;
        }
        else if(vesselType === "propeller"){
          vesselImg = propellerImg;
        }
        else{
          vesselImg = null;
        }
        const vesselImgString = vesselImg !== null ? `<img src=${vesselImg} width=30/>` : '';

        const nationality = vi.Nationality.trim().toLowerCase();
        let nationalityImg;

        if(nationality === "american"){
          nationalityImg = "https://tinyurl.com/22a9e7k4";
        }
        else if(nationality === "british"){
          nationalityImg = "https://tinyurl.com/mryhtu6t";
        }
        else{
          nationalityImg = null;
        }
        const nationalityImgString = nationalityImg !== null ? `<img src=${nationalityImg} width=30>` : '';
        const description =
          `<div class="popup">
          <div class="phead">
            <p>${vi['Name of Vessel']}</p>
            <div>
              ${vesselImgString}
              ${nationalityImgString}
            </div>
          </div>

          <div class=pbody>
            <div class=pbody-location>
              <p><em>${vi['Where From']}</em> to <em>${vi['Where Bound']}</em></p>
            </div>
            <p>${vi.Cargo.join(', ')}</p>
          </div>
        </div>`

        //addTo() raises a "close" event if it exists on the map already.
        //it actually calls fire() on the popup object which then locates
        //the 'close' listener and executes it. this all happens synchronously
        //so addTo can be seen as calling the 'close' listener synchronously
        //and we don't have to worry about order of events happening, i.e.
        //the 'close' listener occurring after highlightRouteAndTrack()
        popup.setLngLat(pPoint).setHTML(description).addTo(map);
      }

      map.on('mouseenter', layer, mouseEnterListener);
      map.on('mouseleave', layer, mouseLeaveListener);
      map.on('mousedown', layer, mouseDownListener);
      this.#listenerList.push(['mouseenter',layer, mouseEnterListener]);
      this.#listenerList.push(['mouseleave',layer, mouseLeaveListener]);
      this.#listenerList.push(['mousedown',layer, mouseDownListener]);
    });

    return popup;
  }
  addVesselsToLists(delay){
    const innerFunc = function(){
      /*This "collision map" serves to find vessels that are leaving from the same location
      * and that will appear stacked upon one another when drawn on the map unless fixed. For stacked
      * vessels, an offset is determined for use (next coordinate in their path). Thus, 12 vessels starting
      * from the same location will end up looking like a line instead of a single dot.*/

      let collisionMap = new Map();
      while ((this.#curIndex < this.#manifest.length) && this.#manifest[this.#curIndex].Date.isSame(this.#date)) {
        const v = this.#manifest[this.#curIndex];
        const from = v['Where From'];
        !collisionMap.has(from) ? collisionMap.set(from,[v]) : collisionMap.get(from).push(v);
        this.#curIndex++;
      }

      /*This function allows us to sort the vessels that are going to appear simultaneously on the same spot
      * on the map, from those with the least number of path coordinates to the greatest. This is required so that when
      * an offset is supplied, the greater the number of possible path positions that a vessel has, the greater
      * the offset. Of course, it is still possible that some points will be stacked upon one another if there are more
      * points than available starting positions.
      * */
      const compareFn = (a,b) => {
        return b.numPositions - a.numPositions;
      }

      for(const collisions of [...collisionMap.values()].sort(compareFn)){
        let offset = 0;
        collisions.forEach((v)=>{
          if (v['Vessel Type'] === 'Schooner') {
            this.addPuppet(v, this.#puppets.slow, offset);
          } else if (v['Vessel Type'] === 'Barkentine' || v['Vessel Type'] === 'Brigantine') {
            this.addPuppet(v, this.#puppets.medium, offset);
          } else {
            this.addPuppet(v, this.#puppets.fast, offset);
          }
          offset++;
        });
      }

      // Don't change the date if we have finished iterating through the manifest
      if (!this.#date.isSame(this.#lastDate.add(1,'day'))) {
        document.getElementById('date').innerText = this.#date.format('MMMM D YYYY');
        this.#date = this.#date.add(1, 'day');
      }
    }.bind(this);

    //Call the logic once before the timer, so that results show up right away.
    innerFunc();
    return setInterval(innerFunc, delay);
  }

  pause() {
    clearInterval(this.#timerSlow);
    clearInterval(this.#timerMed);
    clearInterval(this.#timerFast);
    clearInterval(this.#dayTimer);
    if(this.#trackingPuppet){
      clearInterval(this.#trackingTimer);
      this.zoomFixOff();
    }
    this.#isPaused = true;
  }

  addTimer(listName, delay){
    return setInterval(() => {
      const puppetList = this.#puppets[listName];
      const curPositions = [];
      const mapSrc = map.getSource(listName);

      /*This happens when the map style changes (i.e, streets-v12, outdoors-v12, etc)
      has been changed. When a style change occurs all layers and sources are cleared
      and need to be re-added. Map emits an on('styledata') event when it's ready for
      the additions. If we got here, it's because this timer happened after a change
      but before the styledata event was emitted. Just return until we can redraw*/
      if(mapSrc === undefined){
        return;
      }

      puppetList.forEach((puppet)=>{
        if(!puppet.isDone) {
          curPositions.push(puppet.nextPosition);
          puppet.advance();
        }
      });
      this.#puppetPositions[listName].geometry.coordinates = curPositions;
      mapSrc.setData(this.#puppetPositions[listName]);

    }, delay);
  }
  addTrackerTimer(delay=10){
    let puppet = this.#trackingPuppet;
    let paused = false;
    const trackingFunc = ()=>{
      if(paused) return;
      console.log('tick-tock');
      if(puppet.isDone){
        this.#popup.remove();
      }
      else{
        map.panTo(puppet.curPosition, {duration:250});
        this.#popup.setLngLat(puppet.curPosition);

        const {done, remaining} = puppet.coordsProgress;
        map.getSource(this.#sourceRemaining).setData(remaining);
        map.getSource(this.#sourceDone).setData(done);
      }
    };
    this.#trackingTimer = setInterval(trackingFunc, delay);

    /*When a zoom starts, a zoomstart event is fired. then many 'zoom' events are generated as mapbox zooms in a tiny bit
     at a time to make the animation look smooth. then when it is finished a zoomend event is generated. jumpTo/panTo
     will stop a 'zoom' event, so that if the interval inbetween *To events is something like 1000ms you will see many
     of the 'zoom' events happen, however, if the interval is in the order of 10ms you won't see any of them happen.
     I'm still not sure why this is happening, but its maybe because mapbox can't pan and zoom at the same time,
     when the zoom event is generated outside of the *To function call. So the trick is to suspend the *To calls
     when 'zoomstart' happens, and then reenable them when 'zoomend' occurrs.*/

    this.#zoomStartFunc = (e) => {
      paused = true;
    }
    this.#zoomEndFunc = (e) => {
      paused = false;
    }
    map.on('zoomstart', this.#zoomStartFunc);
    map.on('zoomend', this.#zoomEndFunc);

  }

  zoomFixOff(){
    map.off('zoomstart', this.#zoomStartFunc);
    map.off('zoomend', this.#zoomEndFunc);
  }
  play(speedFactor=1) {
    //check if we are paused so that this function cannot be called multiple times while running by mistake.
    //that would set up a situation where multiple timers are running.
    if (this.#isPaused) {
      this.#dayTimer = this.addVesselsToLists(this.#dayDelay / speedFactor);
      this.#timerSlow = this.addTimer('slow', this.#slowDelay / speedFactor);
      this.#timerMed = this.addTimer('medium', this.#medDelay / speedFactor);
      this.#timerFast = this.addTimer('fast', this.#fastDelay / speedFactor);
      if(this.#trackingPuppet){
        this.addTrackerTimer();
      }
      this.#isPaused = false;
    }
  }

  die(){
    this.pause();
    if(this.#trackingPuppet){
      this.#popup.remove();
    }
    clearInterval(this.#listCleaner);
    for(const [event, layer, func] of this.#listenerList){
      map.off(event, layer, func);
    }
    Object.keys(this.#puppets).forEach((name)=>{
      map.removeLayer(name);
      map.removeSource(name);
    });

  }

  reinitLayers() {
    /*A bit hacky, but this check is necessary since the 'styledata' event can be emitted
      multiple times and at the beginning when the map is first loaded.
    */
    if(map.getSource('slow') !== undefined)
      return;

    for (const [layer, colour] of Object.entries(this.#layerColours)) {
      this.addPositionLayers(layer, colour);
    }

  }
}




