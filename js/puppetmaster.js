import {Puppet} from './puppet.js';

export class PuppetMaster {
  #isPaused = true;
  #manifest;
  #date;
  #puppets = [];
  #curIndex = 0;
  #dayDelay = 100;
  #listCleaner;
  #finalDate;
  #listenerList = [];
  #speedFactor = 1;
  #routeMap = {};
  #map;
  #pauseDate = null;
  #puppetLayerName = 'puppets';
  #animateTimer = null;
  #animateDelay = 20;
  #animateIterations = 0;
  #completedPrecompute = false;
  #vesselSpacing = {};

  //Variables relating to popup / route tracking
  #popup;
  #sourceRemaining = 'hlRouteRemainingSrc';
  #sourceDone = 'hlRouteDoneSrc';
  #layerRemaining = 'hlRouteRemainingLayer';
  #layerDone = 'hlRouteDoneLayer';
  #markerStart = new mapboxgl.Marker({'color':'darkolivegreen'});
  #markerEnd = new mapboxgl.Marker({'color':'firebrick'});
  #trackingPuppet = null;
  #focusOn = false;

  constructor(data, map) {

    this.#date = data.manifest[0].Date;
    this.#manifest = data.manifest;
    this.#finalDate = data.manifest[data.manifest.length-1].Date;
    this.#map = map;
    this.#popup = this.setupPopup();
    this.addPositionLayer(this.#puppetLayerName);

    this.#routeMap = this.groupRouteByYear(data.routes.features);
    //Periodically remove puppets that are no longer on the map
    this.#listCleaner = setInterval(()=>{
      const cleaned = [];
      for(let p of this.#puppets){
        if(!p.isDone){
          cleaned.push(p);
        }
      }
      this.#puppets = cleaned;
    }, 5000);

    const vesselSpeeds = [
      ['Schooner',5],['Brigantine',4], ['Barkentine',4],
      ['Propeller',8],['Steamer',8],['Tug',10],
      ['Scow',4], ['Other',3]];
    for(let [vessel,speed] of vesselSpeeds){
      this.#vesselSpacing[vessel] = this.setVesselSpacing(speed);
    }
    this.preComputeElongatedPaths();

  }

  setVesselSpacing(mph){
    /*Calculate the spacing necessary to achieve a speed for a boat
    * The way this is calculated is as follows:
    * this.#dayDelay is the number of times ships are advanced in a day.
    * This is X it(iterations)/day. From this we have Y it/hr.
    * Units of spacing are in km/it
    * Desired speed - call this 'D' - is then: D km/hr = Y it/hr * S km/it
    * However since speeds are defined in mph, we convert the final answer to mph.
    *
    * - Example calculation 200it/day = 8.33 it/hr. Desired vessel speed is 10km/hr.
    * - Answer is 10km/hr = 8.33 it/hr * x km/it; x = 1.2
    *
    *
    * Some other notes:
    * realistically cannot increase spacing past 1.2, otherwise it looks too jerky, even if the animation is slowed down
    * but we can't use a really fine spacing like 0.1 and increase the speed of the animation because its already at
    * 20ms at 1x, and 5ms at 4x!!!, literally cannot animate any faster, therefore the only realistic solution is to
    * increase the number of iterations per day (stretch the length of a day) if we need to increase the speed of ships
    * */
    const kmPerMile = 1.609;
    const Y = this.#dayDelay / 24;
    const D = mph;
    const S = (D / Y) * kmPerMile;
    return parseFloat(S.toFixed(2));
  }

  groupRouteByYear(routes){
    const routeMap = {
      1854: {},
      1875: {},
      1882: {}
    }
    const pathToCoord = new Map();
    for(let feature of routes){
      pathToCoord.set(feature.properties.path, feature.geometry.coordinates)
    }
    for(let ship of this.#manifest){
      const shipPath = `${ship['Where From']}+${ship['Where Bound']}`;
      routeMap[ship.Date.year()][shipPath] = pathToCoord.get(shipPath);
    }
    return routeMap;
  }
  preComputeElongatedPaths(){
    /*
    * Elongate paths in the background using a webworker. Do it at a bit at a time because if
    * we do it all at once, when the web worker returns the result (70+ MBs of data) there is
    * a significant lag in the main thread of 1-2s.
    * */
    // const pathWorker = new Worker(new URL("js/pathworker.js", import.meta.url));
    const pathWorker = new Worker("js/pathworker.js");
    const ncount = 20;
    let i = ncount;
    const newRouteMap = {1854: {}, 1875: {}, 1882: {}};
    const years = [1882, 1875, 1854];
    let currentYear = years.pop();
    // array of arrays. each array is [path,coords]
    let entries = Object.entries(this.#routeMap[currentYear]);

    function getSlice(start, count){
      if(start>entries.length-1) return null;
      const slice = {};
      for(const [route,coords] of entries.slice(start,start+count)){
        slice[route] = coords;
      }
      return slice;
    }

    pathWorker.onmessage = (e) => {

      let [year,routes] = e.data;
      for(let [path,lengthedRoutes] of Object.entries(routes)){
        newRouteMap[year][path] = lengthedRoutes;
      }

      const slice = getSlice(i,ncount);
      if(slice!==null){
        pathWorker.postMessage([currentYear,slice]);
        i+=ncount;
      }
      else{
        currentYear = years.pop();
        if(currentYear!==undefined){
          entries = Object.entries(this.#routeMap[currentYear]);
          i = ncount;
          pathWorker.postMessage([currentYear, getSlice(0, ncount)]);
        }
        else{
          this.#completedPrecompute = true;
          this.#routeMap = newRouteMap;
          performance.mark('Precompute end');
          const duration = performance.measure('Precompute').duration.toFixed(2)
          console.log(`Path precompute completed in ${duration} ms`);
        }
      }
    };
    performance.mark('Precompute start');
    pathWorker.postMessage([this.#vesselSpacing, currentYear, getSlice(0,ncount)])
  }

  elongatePaths(coords, segmentSize){
    //A function for addition additional points along a precomputed shortest path from start->end
    //This is used because the animation draws a point for each vessel every x milliseconds
    //and by adding more points the animation not only becomes smoother, but it slows it down
    //and prevents the vessels from looking like they are "teleporting".
    //segment_size: additional points are added every segment_size KM

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

  setSpeed(speed){
    this.#speedFactor = parseFloat(speed.slice(0,-1))
    if(!this.#isPaused){
      this.pause();
      this.play();
    }
  }

  addPositionLayer(name){
    this.#map.addSource(name, {type: 'geojson', data: null});
    this.#map.addLayer({
      'id': name,
      'type': 'circle',
      'source': name,
      'paint': {
        'circle-radius': 4,
        'circle-stroke-width': 2,
        'circle-color': [
          'match',
          ['get', 'speed'],
          'slow',
          '#4264fb',
          'medium',
          'green',
          'fast',
          'purple',
          '#ccc' //necessary 'other' case
        ],
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

    /*
     *   Ship Type   Count   Years             Reduced
     *   Schooner    5368    1854 1875 1882    -
     *   Propeller   1004    1854 1875 1882    -
     *   Brigantine  477     1854 1875         -
     *   Barkentine  408     1854 1875         -
     *   Tug         318          1875 1882    -
     *   Barge       266          1875 1882    Schooner
     *   Scow        128          1875 1882    -
     *   Steam Barge 41           1875 1882    Steamer
     *   Barque      13           1875         Barkentine
     *   Yacht       8            1875 1882    Other
     *   Boat        3       1854      1882    Other
     *   Raft        3            1875         Other
     *   Dredge      2            1875         Other
     *   Sailboat    1       1854              Other
     *   Steam Yacht 1                 1882    Steamer
     *   Steamer     1            1875         -
     * */
    let vesselType;
    switch(vesselInfo['Vessel Type']){
      case 'Schooner':
      case 'Propeller':
      case 'Brigantine':
      case 'Barkentine':
      case 'Tug':
      case 'Scow':
      case 'Steamer':
        vesselType = vesselInfo['Vessel Type'];
        break;
      case 'Barge':
        vesselType = 'Schooner';
        break;
      case 'Barque':
        vesselType = 'Barkentine';
        break;
      case 'Steam Barge':
      case 'Steam Yacht':
        vesselType = 'Steamer';
        break;
      case 'Yacht':
      case 'Boat':
      case 'Raft':
      case 'Dredge':
      case 'Sailboat':
        vesselType = 'Other';
        break
    }
    let spacing = this.#vesselSpacing[vesselType];
    if(spacing === undefined) spacing = 0.5; // sane default

    const yearNow = this.#date.year();
    const feature = this.#completedPrecompute ?
      this.#routeMap[yearNow][routeName][spacing] :
      this.elongatePaths(this.#routeMap[yearNow][routeName],spacing);
    const puppet = new Puppet(feature, vesselInfo);

    this.#puppets.push(puppet);
    return puppet;
  }

  getCompletionDate(puppet){
    const numDays = Math.floor(puppet.numPositions / this.#dayDelay );
    return [numDays, puppet.vesselInfo.Date.add(numDays,'day').format('MMM DD YYYY')];
}

  findPuppet(mouseCoord){
    //Find the puppet whose position is closest to the mouse.
    let minimumDistance = null;
    let closest = null;
    const mcPoint = turf.point(mouseCoord);

    this.#puppets.forEach((puppet)=>{
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
  }

  setupPopup(){

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

    const mouseDownListener = (e) => {
      // Change the cursor style as a UI indicator.

      const mousePoint = [e.lngLat['lng'], e.lngLat['lat']];
      const puppet = this.findPuppet(mousePoint);
      const vi = puppet.vesselInfo;

      const barkentineSVG = "data/Sail_plan_barquentine.svg";
      const schoonerSVG = "data/Sail_plan_schooner.svg";
      const propellerImg = "data/propeller.jpg";
      const vesselType = vi['Vessel Type'].trim().toLowerCase();
      const departureDate = vi.Date.format('MMM DD YYYY');
      const [duration,arrivalDate] = this.getCompletionDate(puppet);

      let vesselImg;
      switch(vesselType){
        case "schooner":
          vesselImg = schoonerSVG;
          break;
        case "brigantine":
        case "barkentine":
          vesselImg = barkentineSVG;
          break;
        case "propeller":
          vesselImg = propellerImg;
          break;
        default:
          vesselImg = null;
      }
      const vesselImgString = vesselImg !== null ? `<img src=${vesselImg} width=30/>` : '';

      const nationality = vi.Nationality.trim().toLowerCase();
      let nationalityImg;
      switch(nationality){
        case "american":
          nationalityImg = "data/Flag_of_the_United_States.svg";
          break;
        case "british":
          nationalityImg = "data/Flag_of_the_United_Kingdom.svg";
          break;
        default:
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
      this.setRouteCompletionData(puppet);
    }

    this.#map.on('mouseenter', this.#puppetLayerName , mouseEnterListener);
    this.#map.on('mouseleave', this.#puppetLayerName , mouseLeaveListener);
    this.#map.on('mousedown', this.#puppetLayerName , mouseDownListener);
    this.#listenerList.push(['mouseenter',this.#puppetLayerName , mouseEnterListener]);
    this.#listenerList.push(['mouseleave',this.#puppetLayerName , mouseLeaveListener]);
    this.#listenerList.push(['mousedown',this.#puppetLayerName , mouseDownListener]);

    return popup;
  }
  addVessels(){

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

      for(const collisions of collisionMap.values()){
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
  }

  incrementDate(){
    if(this.#date.isSame(dayjs('1854-12-03'))){
      this.pause();
      this.changeDate({
        "startDate": new Date(1875, 4, 4),
        "endDate": new Date(1875, 4, 4)
      });
    }
    else if(this.#date.isSame(dayjs('1875-12-09'))){
      this.pause();
      this.changeDate({
        "startDate": new Date(1882,3,20),
        "endDate": new Date(1882,3,20),
      });
    }
    else if (!this.#date.isSame(this.#finalDate.add(1,'day'))) {
      document.getElementById('date').innerText = this.#date.format('MMMM D YYYY');
      if(this.#pauseDate?.isSame(this.#date)){
        document.getElementById('pause-btn').dispatchEvent(new Event('click'));
        this.#pauseDate = null;
      }
      this.#date = this.#date.add(1, 'day');
    }
  }
  animate(delay){
    return setInterval(()=>{
      this.advancePuppets();

      //Increase the day and add more vessels after
      //#dayDelay movements of puppets. With a default value of 100
      //and delay set to 20, this means each day is incremented roughly
      //every two seconds.
      this.#animateIterations++;
      if(this.#animateIterations===this.#dayDelay){
        this.addVessels();
        this.incrementDate();
        this.#animateIterations=0;
      }
      if(this.#trackingPuppet){
        if(this.#trackingPuppet.isDone){
          this.#popup.remove();
        }
        else {
          this.#popup.setLngLat(this.#trackingPuppet.curPosition);
          this.setRouteCompletionData(this.#trackingPuppet);
        }
      }

    }, delay);
  }
  advancePuppets(){
      const mapSrc = this.#map.getSource(this.#puppetLayerName);

      /*This happens when the map style changes (i.e, streets-v12, outdoors-v12, etc)
      has been changed. When a style change occurs all layers and sources are cleared
      and need to be re-added. Map emits an on('styledata') event when it's ready for
      the additions. If we got here, it's because this timer happened after a change
      but before the styledata event was emitted. Just return until we can redraw*/
      if(mapSrc === undefined){
        return;
      }

      const slowPositions = [];
      const mediumPositions = [];
      const fastPositions = [];
      for(let puppet of this.#puppets) {
        if (!puppet.isDone) {
          switch (puppet.speed) {
            case 'slow':
              slowPositions.push(puppet.curPosition);
              break;
            case 'medium':
              mediumPositions.push(puppet.curPosition);
              break;
            case 'fast':
              fastPositions.push(puppet.curPosition);
              break;
          }
          puppet.advance();
        }
      }

      let puppetPositions = {
          "type": "FeatureCollection",
          "features": []
      }
      for(let [positions,speed] of [[slowPositions,'slow'],
                                   [mediumPositions,'medium'],
                                   [fastPositions,'fast']]){
        if(positions.length){
          const feature = turf.multiPoint(positions, {'speed': speed});
          puppetPositions.features.push(feature);
        }
      }
      if(puppetPositions.features.length){
        this.#map.getSource(this.#puppetLayerName).setData(puppetPositions);
      }
  }
  setRouteCompletionData(puppet){
    const {done, remaining} = puppet.coordsProgress;
    /*This may throw an error if the map's style has been changed but reinitLayers() has not executed yet
    * In this case, the error is harmless and the data will be set once reinitLayers() is called*/
    this.#map.getSource(this.#sourceRemaining).setData(remaining);
    this.#map.getSource(this.#sourceDone).setData(done);
  }

  play() {
    //check if we are paused so that this function cannot be called multiple times while running by mistake.
    //that would set up a situation where multiple timers are running.
    if (this.#isPaused) {
      this.#animateTimer = this.animate(this.#animateDelay / this.#speedFactor);
      this.#isPaused = false;
    }
  }
  pause() {
    clearInterval(this.#animateTimer);
    this.#isPaused = true;
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
    this.#map.removeLayer(this.#puppetLayerName);
    this.#map.removeSource(this.#puppetLayerName);
  }

  /*When a style is changed all sources/layers are removed. This adds them back*/
  reinitLayers() {
    /*A bit hacky, but this check is necessary since the 'styledata' event can be emitted
      multiple times and at the beginning when the map is first loaded.
    */
    if(this.#map.getSource(this.#puppetLayerName) !== undefined)
      return;

    this.addPositionLayer(this.#puppetLayerName);

    if(this.#trackingPuppet){
      this.addHLRLayerAndSrc();
    }
  }

  getCurrentDate(){
    return this.#date;
  }

  changeDate(dateRange){
    /**
     * Pause - clear timers (Pause done in date_range.js in handleClickOpen)
     * Clear puppet list
     * Clear layers
     * Remove tracking puppet popup, distance layers
     * Change date (title)
     * change this#.curIndex to match this.#manifest date
     * Add puppets
     */

    this.#puppets = [];

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
    //need to add vessels here, otherwise they get added in animate() when the next day happens
    //which makes the animation look like its lagging. Same applies to setting the date.
    this.addVessels();
    document.getElementById('date').innerText = this.#date.format('MMMM D YYYY');
    //need to also clear any puppets on the map because this only happens in advancePuppets()
    //if there are puppets to show. If this line wasn't here, then when a date is switched to
    //that doesn't have any puppets to show, the existing layer is not cleared and any previous
    //puppets are frozen on the map
    this.#map.getSource(this.#puppetLayerName).setData({
      "type": "FeatureCollection",
      "features": []
    });
    //Do this as this.#date points to current date+1
    this.#date = this.#date.add(1, 'day');

    this.#animateIterations = 0;
    //pause the animation if a range with an enddate is provided. pause at the enddate+1.
    this.#pauseDate = !dayjs(dateRange.startDate).isSame(dayjs(dateRange.endDate)) ?
                       dayjs(dateRange.endDate).add(1, 'day') : null;

    //Do this to maintain proper pause-btn display/state
    const pauseButton = document.getElementById("pause-btn");
    pauseButton.click();
  }
}
