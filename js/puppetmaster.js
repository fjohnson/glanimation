import {Puppet} from './puppet.js';

export class PuppetMaster {
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
  #speedFactor = 1;
  #routeMap;
  #map;
  #pauseDate = null;
  //Variables relating to popup / route tracking
  #popup;
  #sourceRemaining = 'hlRouteRemainingSrc';
  #sourceDone = 'hlRouteDoneSrc';
  #layerRemaining = 'hlRouteRemainingLayer';
  #layerDone = 'hlRouteDoneLayer';
  #markerStart = new mapboxgl.Marker({'color':'darkolivegreen'});
  #markerEnd = new mapboxgl.Marker({'color':'firebrick'});
  #zoomStartFunc = null;
  #zoomEndFunc = null;
  #trackingTimer = null;
  #trackingPuppet = null;
  #focusOn = true;


  constructor(data, map) {

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
    this.#date = data.manifest[0].Date;
    this.#manifest = data.manifest;
    this.#curIndex = 0;
    this.#isPaused = true;
    this.#lastDate = data.manifest[data.manifest.length-1].Date;
    this.#map = map;
    this.#popup = this.setupPopup(this.#layers);
    this.#routeMap = {};


    for (const [layer, colour] of Object.entries(this.#layerColours)) {
      this.addPositionLayers(layer, colour);
    }

    turf.featureEach(data['routes'], (feature) => {
      this.#routeMap[feature['properties']['path']] = this.elongatePaths(feature);
    });

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

  elongatePaths(feature, segmentSize = 0.5){
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

  getVesselLayer(puppet){
    if(puppet.vesselInfo['Vessel Type'] === 'Schooner'){
      return this.#puppets.slow;
    }
    else if (puppet.vesselInfo['Vessel Type'] === 'Barkentine' || puppet.vesselInfo['Vessel Type'] === 'Brigantine') {
      return this.#puppets.medium;
    }
    else{
      return this.#puppets.fast;
    }
  }

  setSpeed(speed){
    this.#speedFactor = parseFloat(speed.slice(0,-1))
    if(!this.#isPaused){
      this.pause();
      this.play();
    }

  }

  addPositionLayers(name, color){
    this.#map.addSource(name, {type: 'geojson', data: null});
    this.#map.addLayer({
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

  addPuppet(vesselInfo){
    const name = vesselInfo['Name of Vessel'];

    if (this.#map.getSource(name) !== undefined){
      /*FIXME: Needed right now to prevent the same ship from existing on the map at the same time
     This happens when say ship A is placed on the map at date t1, then ship A is again
     placed on the map on date t2. Really, ship A should have been taken off the map before
     being added at t2, but the speed the at which ships are currently emulated is not 100%
     indicative of real life.*/
      return;
    }
    const routeName = `${vesselInfo['Where From']}+${vesselInfo['Where Bound']}`;
    const feature = this.#routeMap[routeName];
    const puppet = new Puppet(feature, vesselInfo);

    const vesselLayer = this.getVesselLayer(puppet);
    vesselLayer.push(puppet);
    return puppet;
  }

  getCompletionDate(puppet){
    let speedFactor;
    const layer = this.getVesselLayer(puppet);
    if(layer === this.#puppets.slow) speedFactor = this.#slowDelay;
    else if(layer === this.#puppets.medium) speedFactor = this.#medDelay;
    else if(layer === this.#puppets.fast) speedFactor = this.#fastDelay;
    const numDays = Math.floor((puppet.numPositions * speedFactor) / this.#dayDelay);
    return [numDays, puppet.vesselInfo.Date.add(numDays,'day').format('MMM DD YYYY')];

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

      const distance = turf.distance(mcPoint, turf.point(puppet.curPosition));
      if(minimumDistance === null || minimumDistance > distance){
        closest = puppet
        minimumDistance = distance;
      }
    });

    return closest;
  }

  addHLRLayerAndSrc(){
    this.#map.addSource(this.#sourceRemaining, {
      "type": "geojson",
      "data": this.#trackingPuppet.coordsGeoJson
    });

    this.#map.addLayer({
      'id': this.#layerRemaining,
      'type': 'line',
      'source': this.#sourceRemaining,
      'layout': {},
      'paint': {
        'line-color': 'gold',
        'line-opacity': 0.75,
        'line-width': 5
      }});

    this.#map.addSource(this.#sourceDone, {
      "type": "geojson",
      "data": turf.lineString(this.#trackingPuppet.curPosition)
    });

    this.#map.addLayer({
      'id': this.#layerDone,
      'type': 'line',
      'source': this.#sourceDone,
      'layout': {},
      'paint': {
        'line-color': 'royalblue',
        'line-opacity': 0.75,
        'line-width': 5
      }
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
      this.#map.jumpTo({'center':puppetPosition, 'zoom':(zoom)});
      let bounds = this.#map.getBounds();
      let multipt = turf.multiPoint([
        [bounds['_sw'].lng,bounds['_sw'].lat],
        [bounds['_ne'].lng,bounds['_ne'].lat]]);
      let bbox = turf.bbox(multipt);
      let bboxPoly = turf.bboxPolygon(bbox);
      let result = turf.pointsWithinPolygon(points, bboxPoly);

      //if puppet, marker start and end are not visible then zoom out once and stop
      if(result.features.length !== 3){
        if(zoom === minZoom){
          throw new Error("Marker and center point not visible at zoom 0");
        }else{
          this.#map.jumpTo({'center':puppetPosition, 'zoom':(zoom-1)});
          break;
        }
      }
      zoom++;
    } while(zoom <= maxZoom);
  }

  toggleFocus(){
    this.#focusOn = !this.#focusOn;
  }

  removeHLLayer(){
    this.#trackingPuppet = null;
    this.#map.removeLayer(this.#layerRemaining);
    this.#map.removeLayer(this.#layerDone);
    this.#map.removeSource(this.#sourceRemaining);
    this.#map.removeSource(this.#sourceDone);

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

    //this is called also when this.#popup.remove() is called.
    popup.on('close', () => {
      this.removeHLLayer();
    });

    const mouseEnterListener = (e) =>{
      this.#map.getCanvas().style.cursor = 'pointer';
    };
    const mouseLeaveListener = () => {
      this.#map.getCanvas().style.cursor = '';
    }

    layerNames.forEach((layer)=>{
      const mouseDownListener = (e) => {
        // Change the cursor style as a UI indicator.

        const mousePoint = [e.lngLat['lng'], e.lngLat['lat']];
        const puppet = this.findPuppet(mousePoint, layer);
        const vi = puppet.vesselInfo;

        const barkentineSVG = "data/Sail_plan_barquentine.svg";
        const schoonerSVG = "data/Sail_plan_schooner.svg";
        const propellerImg = "data/propeller.jpg";
        const vesselType = vi['Vessel Type'].trim().toLowerCase();
        const departureDate = vi.Date.format('MMM DD YYYY');
        const [duration,arrivalDate] = this.getCompletionDate(puppet);

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
          nationalityImg = "data/Flag_of_the_United_States.svg";
        }
        else if(nationality === "british"){
          nationalityImg = "data/Flag_of_the_United_Kingdom.svg";
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
            <p>${departureDate} - ${arrivalDate}, ${duration} days</p>
            <p>${vi.Cargo.join(', ')}</p>
          </div>
        </div>`

        //addTo() raises a "close" event if it exists on the map already.
        //it actually calls fire() on the popup object which then locates
        //the 'close' listener and executes it. this all happens synchronously
        //so addTo can be seen as calling the 'close' listener synchronously
        //Also when a "close" event is generated, removeHLLayer() is called.
        popup.setLngLat(puppet.curPosition).setHTML(description).addTo(this.#map);

        this.#trackingPuppet = puppet;
        const puppetCoords = puppet.coordsGeoJson.geometry.coordinates;
        this.addHLRLayerAndSrc();
        this.#markerStart.remove().setLngLat(puppetCoords[0]).addTo(this.#map);
        this.#markerEnd.remove().setLngLat(puppetCoords[puppetCoords.length-1]).addTo(this.#map);

        if(this.#focusOn){
          this.zoomToStartEnd(puppet.curPosition,puppetCoords[0],puppetCoords[puppetCoords.length-1]);
        }

        if(!this.#isPaused) {
          this.addTrackerTimer();
        }else{
          //Do this so completion data shows up properly when paused but disable tracking so
          //the user can still scroll around
          this.setRouteCompletionData(puppet);
        }
      }

      this.#map.on('mouseenter', layer, mouseEnterListener);
      this.#map.on('mouseleave', layer, mouseLeaveListener);
      this.#map.on('mousedown', layer, mouseDownListener);
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
        const vesselInfo = this.#manifest[this.#curIndex];
        const puppet = this.addPuppet(vesselInfo);
        const from = vesselInfo['Where From'];
        !collisionMap.has(from) ? collisionMap.set(from,[puppet]) : collisionMap.get(from).push(puppet);
        this.#curIndex++;
      }

      /*This function allows us to sort the vessels that are going to appear simultaneously on the same spot
      * on the map, from those with the least number of path coordinates to the greatest. This is required so that when
      * an offset is supplied, the greater the number of possible path positions that a vessel has, the greater
      * the offset. Of course, it is still possible that some points will be stacked upon one another if there are more
      * points than available starting positions.
      * */
      const compareFn = (a,b) => {
        return a.numPositions - b.numPositions;
      }


      for(const collisions of [...collisionMap.values()]){
        if(collisions.length > 1){
          const offsetDistance = 10; //arbitrary spacing number
          let offset = 0;
          const sortedCollisions = collisions.sort(compareFn);
          for(let i = 1; i<sortedCollisions.length; i++){
            let puppet = sortedCollisions[i];
            if(offset+offsetDistance >= puppet.numPositions){
              //Method of spacing if the offset+offsetDistance would be > last possible (indexable) position
              offset += Math.floor(Math.abs(offset - (puppet.numPositions-1))/2);
            }
            else{
              offset += offsetDistance;
            }
            puppet.setOffset(offset);
          }
        }
      }

      // Don't change the date if we have finished iterating through the manifest
      // This happens at the end of the animation
      if (!this.#date.isSame(this.#lastDate.add(1,'day'))) {
        document.getElementById('date').innerText = this.#date.format('MMMM D YYYY');
        if(this.#pauseDate?.isSame(this.#date)){
          document.getElementById('pause-btn').dispatchEvent(new Event('click'));
          this.#pauseDate = null;
        }
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
      const mapSrc = this.#map.getSource(listName);

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
          curPositions.push(puppet.curPosition);
          puppet.advance();
        }
      });
      this.#puppetPositions[listName].geometry.coordinates = curPositions;
      mapSrc.setData(this.#puppetPositions[listName]);

    }, delay);
  }

  setRouteCompletionData(puppet){
    const {done, remaining} = puppet.coordsProgress;
    /*This may throw an error if the map's style has been changed but reinitLayers() has not executed yet
    * In this case, the error is harmless and the data will be set once reinitLayers() is called*/
    this.#map.getSource(this.#sourceRemaining).setData(remaining);
    this.#map.getSource(this.#sourceDone).setData(done);
  }

  addTrackerTimer(delay=10){
    let puppet = this.#trackingPuppet;
    let paused = false;
    const trackingFunc = ()=>{
      if(paused) return;

      if(puppet.isDone){
        this.#popup.remove();
      }
      else{
        this.#map.panTo(puppet.curPosition, {duration:250});
        this.#popup.setLngLat(puppet.curPosition);

        this.setRouteCompletionData(puppet);
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
    this.#map.on('zoomstart', this.#zoomStartFunc);
    this.#map.on('zoomend', this.#zoomEndFunc);

  }

  zoomFixOff(){
    this.#map.off('zoomstart', this.#zoomStartFunc);
    this.#map.off('zoomend', this.#zoomEndFunc);
  }

  play() {
    //check if we are paused so that this function cannot be called multiple times while running by mistake.
    //that would set up a situation where multiple timers are running.
    if (this.#isPaused) {
      this.#dayTimer = this.addVesselsToLists(this.#dayDelay / this.#speedFactor);
      this.#timerSlow = this.addTimer('slow', this.#slowDelay / this.#speedFactor);
      this.#timerMed = this.addTimer('medium', this.#medDelay / this.#speedFactor);
      this.#timerFast = this.addTimer('fast', this.#fastDelay / this.#speedFactor);
      if(this.#trackingPuppet){
        this.addTrackerTimer();
      }
      this.#isPaused = false;
    }
  }

  isPaused(){
    return this.#isPaused;
  }

  die(){
    this.pause();
    if(this.#trackingPuppet){
      this.#popup.remove();
    }
    clearInterval(this.#listCleaner);
    for(const [event, layer, func] of this.#listenerList){
      this.#map.off(event, layer, func);
    }
    for(const name of this.#layers){
      this.#map.removeLayer(name);
      this.#map.removeSource(name);
    }
  }

  /*When a style is changed all sources/layers are removed. This adds them back*/
  reinitLayers() {
    /*A bit hacky, but this check is necessary since the 'styledata' event can be emitted
      multiple times and at the beginning when the map is first loaded.
    */
    if(this.#map.getSource('slow') !== undefined)
      return;

    for (const [layer, colour] of Object.entries(this.#layerColours)) {
      this.addPositionLayers(layer, colour);
    }
    if(this.#trackingPuppet){
      this.addHLRLayerAndSrc();
    }
  }

  changeDate(dateRange){
    /**
     * Pause - clear timers
     * Clear puppet lists
     * Clear layers
     * Remove tracking puppet popup, distance layers, zoomfix, tracking timer
     * Change date (title)
     * change this#.curIndex to match this.#manifest date
     */


    this.pause();
    this.#puppets = this.getObject(this.#layers,[[],[],[]]);
    this.#puppetPositions = this.getObject(this.#layers,[turf.multiPoint(), turf.multiPoint(),turf.multiPoint()]);

    if(this.#trackingPuppet){
      this.#popup.remove();
    }

    this.#curIndex = 0;

    for(let manifestEntry of this.#manifest){
      if(manifestEntry.Date.month() >= dateRange.startDate.getMonth()
         && manifestEntry.Date.year() >= dateRange.startDate.getFullYear()
         && manifestEntry.Date.date() >= dateRange.startDate.getDate()){
        break;
      }
      else{
        this.#curIndex++;
      }
    }
    this.#date = dayjs(dateRange.startDate);
    this.#pauseDate = !dayjs(dateRange.startDate).isSame(dayjs(dateRange.endDate)) ?
                       dayjs(dateRange.endDate).add(1, 'day') : null;
    this.play();
  }
}
