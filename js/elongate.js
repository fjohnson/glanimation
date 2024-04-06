// A file for creating elongated paths ahead of time instead of on the fly during rendering
const fs = require('fs');
const turfDistance = require('@turf/distance').default;
const turfAlong = require('@turf/along').default;
const turf = require('@turf/helpers');
const DEFINED_SPACING = [0.5, 1.0, 1.2];

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
    let distance = turfDistance(turf.point(from), turf.point(to));

    if(distance > segmentSize){
      let remaining_distance = distance;
      while(remaining_distance >= segmentSize){
        let line = turf.lineString([from, to]);
        let point = turfAlong(line, segmentSize);
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

// Check if the file path is provided as a command-line argument
if (process.argv.length < 4) {
  console.error('Usage: elongate.js path_to_manifest.json paths.json');
  process.exit(1);
}
const manifestFile = process.argv[2];
const outputPath = process.argv[3];
try {
  const manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
  const routeMap = new Map();
  for(const feature of manifest.routes.features){
    routeMap.set(feature['properties']['path'], feature);
  }
  const jsonMap = {}
  let i = 1;
  for(const [route, feature] of routeMap){
    const lengthenedPaths = {};
    for(const spacing of DEFINED_SPACING){
      lengthenedPaths[spacing]=elongatePaths(feature, spacing);
    }
    jsonMap[route] = lengthenedPaths;
    process.stdout.write(`\rProgress:[${i++}/${routeMap.size}]`);
  }
  process.stdout.write("\n");
  fs.writeFile(outputPath, JSON.stringify(jsonMap), 'utf-8', (err) => {
    if (err) {
      console.error('Error writing to file:', err);
    } else {
      process.exit(0);
    }
  });
} catch (error) {
  console.error('Error occurred while reading the file:', error);
}


