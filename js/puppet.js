export class Puppet{
  #coordinates;
  #cordIdx = 0;

  constructor(feature, vesselInfo){
    this.#coordinates = turf.coordAll(feature);
    this.curPosition = this.#coordinates[0];
    this.name = vesselInfo['Name of Vessel'];
    this.isDone = false;
    this.vesselInfo = vesselInfo;
    // this.vesselInfo['Vessel Type']
  }

  setOffset(offset){
    this.#cordIdx = offset;
    this.curPosition = this.#coordinates[offset];
  }

  static getVesselType(vesselInfo){
    /*   Vessel type influences two factors:
     * 1) The speed of the craft
     * 2) The color of the craft on the map, as dictated by the legend
     *
     * Below is a rundown of the counts and types of vessels in the entire dataset
     * For the purposes of the legend, certain vessels should be grouped together.
     * For instance Barge are treated as Schooners, but Scow and Tugs are their own group.
     *
     * In terms of speed, see puppetmaster.#vesselSpeed for a definition of the speeds
     *
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
    switch(vesselInfo['Vessel Type']){
      case 'Schooner':
      case 'Propeller':
      case 'Brigantine':
      case 'Barkentine':
      case 'Tug':
      case 'Scow':
      case 'Steamer':
        return vesselInfo['Vessel Type'];
      case 'Barge':
        return 'Schooner';
      case 'Barque':
        return 'Barkentine';
      case 'Steam Barge':
      case 'Steam Yacht':
        return 'Steamer';
      case 'Yacht':
      case 'Boat':
      case 'Raft':
      case 'Dredge':
      case 'Sailboat':
        return 'Other';
    }
  }
  advance() {

    if (this.#cordIdx < this.#coordinates.length) {
      this.curPosition = this.#coordinates[this.#cordIdx++];
    }
    else{
      this.isDone = true;
    }
  }

  get numPositions(){
    return this.#coordinates.length;
  }

  get coordsGeoJson(){
    return turf.lineString(this.#coordinates);
  }

  get coordsProgress(){
    let doneCoords = this.#coordinates.slice(0,this.#cordIdx);
    let remainingCoords = this.#coordinates.slice(this.#cordIdx);

    /*
      Need these conditionals because linestrings must always have two points
      These edge cases happen when either the ship has just been placed on the map
      or the ship is basically finished its voyage.
     */
    if(doneCoords.length<2){
      doneCoords = turf.lineString(this.#coordinates.slice(0,this.#cordIdx+1));
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
