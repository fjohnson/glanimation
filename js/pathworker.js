// import turfDistance from "@turf/distance";
// import turfAlong from "@turf/along";
// import turf from "@turf/helpers";

importScripts('https://unpkg.com/@turf/turf@6/turf.min.js');
const DEFINED_VESSELS = {
  1854:['Schooner','Propeller','Brigantine','Barkentine','Other'],
  1875:['Schooner','Propeller','Brigantine','Barkentine','Tug','Scow', 'Steamer','Other'],
  1882:['Schooner','Propeller','Tug','Scow','Steamer','Other'],
};
let DEFINED_SPACING;
let DAY_DELAY;
function elongatePaths(coords, segmentSize){
  //A function for addition additional points along a precomputed shortest path from start->end
  //This is used because the animation draws a point for each vessel every x milliseconds
  //and by adding more points the animation not only becomes smoother, but it slows it down
  //and prevents the vessels from looking like they are "teleporting".
  //segment_size: additional points are added every segment_size KM

  let elongated_coords = [];
  let from = coords[0];
  let lockpoly = turf.polygon([[
    [-79.219,43.221],
    [-79.2598,42.8823],
    [-79.2259,42.8762],
    [-79.16,43.215],
    [-79.219,43.221]
  ]])
  let originalSeg = segmentSize;

  for(let k =1; k< coords.length; k++){
    let to = coords[k];
    let distance = turf.distance(turf.point(from), turf.point(to));

    //Slow down passage in the canal so that it takes two days to cross
    //the passage is aprox 38KM, so we want to move 19KM/h. This equals aprox
    //.19KM/it if a day is 100 it
    let toWithin = turf.pointsWithinPolygon(turf.points([to]), lockpoly)
    if(toWithin.features.length){
      segmentSize = 38/(DAY_DELAY*2);
    }else{
      segmentSize = originalSeg;
    }

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

onmessage = (e) => {
  let year, routes;
  if(!DEFINED_SPACING){
    [DEFINED_SPACING,DAY_DELAY,year,routes] = e.data;
  }else{
    [year,routes] = e.data;
  }

  const computedPaths = {}
  for(const [route,coords] of Object.entries(routes)){
    const lengthenedPath = {}
    for(const vessel of DEFINED_VESSELS[year]){
      const spacing = DEFINED_SPACING[vessel];
      if(!(spacing in lengthenedPath)){ // some vessels have the same spacing so no point in calcing again
        lengthenedPath[spacing] = elongatePaths(coords, spacing);
      }
    }
    computedPaths[route] = lengthenedPath;
  }
  postMessage([year,computedPaths]);
}
