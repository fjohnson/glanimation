mapboxgl.accessToken = 'pk.eyJ1IjoiZmpvaG5zODg4IiwiYSI6ImNsaGh6eXo1dDAzMDMzbW1td3BqOXFoaDMifQ.RBC_0mpQ25-GRAZDA0E0oA';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/mapbox/light-v11', // style URL
  center: [-83.926, 43.433], // starting position [lng, lat]
  zoom: 5 // starting zoom
});

function testPaths(){
  var point = turf.point([-75.343, 39.984]);
  var distance = 25;
  var bearing = 90;
}
function elongatePaths(features_collection, segment_size){
  //A function for addition additional points along a precomputed shortest path from start->end
  //This is used because the animation draws a point for each vessel every x milliseconds
  //and by addition more points the animation not only becomes smoother, but it slows it down
  //and prevents the vessels from looking like they are "teleporting".
  //segment_size: additional points are added every segment_size KM
  for(let i =0; i<features_collection.features.length; i++){
    let feature = features_collection.features[i];
    let coords = feature.geometry.coordinates;
    let elongated_coords = []
    let from = coords[0];
    let current_segment_size = 0;

    for(let k =1; k< coords.length; k++){
        let to = coords[k];
        let distance = turf.distance(turf.point(from), turf.point(to));

        if(distance > segment_size){
          let remaining_distance = distance;
          while(remaining_distance >= segment_size){
            let line = turf.lineString([from, to]);
            let point = turf.along(line, segment_size);
            elongated_coords.push(from);
            from = point.geometry.coordinates;
            remaining_distance -= segment_size;
          }
        }
        else if(distance === segment_size){
          if(k<coords.length) {
            elongated_coords.push(from);
            from = to;
          }
        }
    }
    elongated_coords.push(from);
    elongated_coords.push(coords[coords.length-1])
    feature.geometry.coordinates = elongated_coords;
  }
}

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
      //'type',
      // 'properties',
      "anode",
      "bnode",
      "length",
      "OBJECTID",
      "linkname"
      // 'id',
      // 'layer',
      // 'source',
      // 'sourceLayer',
      // 'state'
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

map.on('load', async () => {
// We fetch the JSON here so that we can parse and use it separately
// from GL JS's use in the added source.
  const response = await fetch(
    'data/path.json'
  );
  const data = await response.json();
  elongatePaths(data, 0.5);
  function addPath(source, data, delay=10){
    const coordinates = data.geometry.coordinates;
    // start by showing just the first coordinate
    data.geometry.coordinates = [coordinates[0]];

    map.addSource(source, { type: 'geojson', data: data });
    map.addLayer({
      'id': source,
      'type': 'line',
      'source': source,
      'paint': {
        'line-color': 'yellow',
        'line-opacity': 0.75,
        'line-width': 5
      }
    });

  // on a regular basis, add more coordinates from the saved list and update the map
    let i = 0;
    const timer = setInterval(() => {
      if (i < coordinates.length) {
        data.geometry.coordinates.push(coordinates[i]);
        map.getSource(source).setData(data);
        i++;
      } else {
        window.clearInterval(timer);
      }
    }, delay);
  }

  let pathc = 0;
  data.features.forEach(feature => addPath('trace'+pathc++, feature));

});
