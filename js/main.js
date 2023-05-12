mapboxgl.accessToken = 'pk.eyJ1IjoiZmpvaG5zODg4IiwiYSI6ImNsaGh6eXo1dDAzMDMzbW1td3BqOXFoaDMifQ.RBC_0mpQ25-GRAZDA0E0oA';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/mapbox/light-v11', // style URL
  center: [-83.926, 43.433], // starting position [lng, lat]
  zoom: 5 // starting zoom
});

map.on('load', () => {
  map.addSource('maine', {
    'type': 'geojson',
    'data': "data/geo.json"
  });

  // Add a black outline around the polygon.
  map.addLayer({
    'id': 'outline',
    'type': 'line',
    'source': 'maine',
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
  //for feature debug
  map.on('mousemove', (e) => {
    document.getElementById('info').innerHTML =
      // `e.point` is the x, y coordinates of the `mousemove` event
      // relative to the top-left corner of the map.
      JSON.stringify(e.point) +
      '<br />' +
      // `e.lngLat` is the longitude, latitude geographical position of the event.
      JSON.stringify(e.lngLat.wrap());

    //feature debug code here:
    const features = map.queryRenderedFeatures(e.point);

    // Limit the number of properties we're displaying for
    // legibility and performance
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
      return displayFeat;
    });

    // Write object as string with an indent of two spaces.
    document.getElementById('features').innerHTML = JSON.stringify(
      displayFeatures,
      null,
      2
    );
  });

});

class Puppet{
  #feature;
  #coordinates;
  #nextCordInd;

  name;
  position;
  constructor(feature, name, segmentSize=0.5){
    this.#feature = feature;
    this.#feature.geometry.coordinates = this.elongatePaths(segmentSize);
    this.#coordinates = turf.coordAll(this.#feature);
    this.position = turf.point(this.#coordinates[0]);
    this.name = name;
    this.#nextCordInd = 1;
  }

  advance() {
    if (this.#nextCordInd < this.#coordinates.length) {
      this.position.geometry.coordinates = this.#coordinates[this.#nextCordInd++];
      return false;
    }
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
  elongatePaths(segmentSize){
    //A function for addition additional points along a precomputed shortest path from start->end
    //This is used because the animation draws a point for each vessel every x milliseconds
    //and by addition more points the animation not only becomes smoother, but it slows it down
    //and prevents the vessels from looking like they are "teleporting".
    //segment_size: additional points are added every segment_size KM

      let coords = this.#feature.geometry.coordinates;
      let elongated_coords = [];
      let from = coords[0];
      let current_segment_size = 0;

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
      elongated_coords.push(coords[coords.length-1])
      return elongated_coords;
  }
}
class PuppetMaster {
  #puppets = [];
  #timer;
  #delay;
  #isPaused;

  constructor(features, delay = 10) {
    const featName = 'vessel';
    let featNum = 1;

    turf.featureEach(features, (feature) => {
      const name = featName + featNum++;
      const puppet = new Puppet(feature, name);
      this.#puppets.push(puppet);

      map.addSource(name, {type: 'geojson', data: puppet.position});
      map.addLayer({
        'id': name,
        'type': 'circle',
        'source': name,
        'paint': {
          'circle-radius': 4,
          'circle-stroke-width': 2,
          'circle-color': '#4264fb',
          'circle-stroke-color': 'white'
        }
      });
    });

    this.#delay = delay;
    this.#isPaused = true;
  }

  pause() {
    window.clearInterval(this.#timer);
    this.#isPaused = true;
  }

  play() {
    //check if we are paused so that this function cannot be called multiple times while running by mistake.
    //that would set up a situation where multiple timers are running.
    if (this.#isPaused) {
      this.#timer = setInterval(() => {
        const finished = [];

        for(let i=0; i<this.#puppets.length;i++){
          const puppet = this.#puppets[i];
          map.getSource(puppet.name).setData(puppet.position);
          // puppet.advance();
          const isDone = puppet.advance();
          if(isDone){
            map.removeLayer(puppet.name);
            map.removeSource(puppet.name);
            finished.push(puppet);
          }
        }
        // remove finished entities from the screen
        if(finished.length){
          const remainingPuppets = [];
          this.#puppets.forEach((puppet)=>{
            if(finished.indexOf(puppet) === -1){
              remainingPuppets.push(puppet);
            }
          });
          this.#puppets = remainingPuppets;
        }
      }, this.#delay);
      this.#isPaused = false;
    }
  }

  die(){
    window.clearInterval(this.#timer);
    this.#puppets.forEach((puppet)=>{
      map.removeLayer(puppet.name);
      map.removeSource(puppet.name);
    });
  }
}

map.on('load', async () => {

  const response = await fetch(
    'data/path.json'
  );
  const data = await response.json();
  let puppeteer = new PuppetMaster(data);

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
    puppeteer = new PuppetMaster(data);
    puppeteer.play();
  });

  puppeteer.play();


});

