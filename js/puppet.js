export class Puppet{
  #coordinates;
  #cordIdx = 0;

  constructor(feature, vesselInfo){
    this.#coordinates = turf.coordAll(feature);
    this.curPosition = this.#coordinates[0];
    this.name = vesselInfo['Name of Vessel'];
    this.isDone = false;
    this.vesselInfo = vesselInfo;
    this.speed = this.#setSpeed();
  }

  #setSpeed(){
    switch(this.vesselInfo['Vessel Type']){
      case 'Schooner': return 'slow';
      case 'Barkentine':
      case 'Brigantine': return 'medium';
      default: return 'fast';
    }
  }
  setOffset(offset){
    this.#cordIdx = offset;
    this.curPosition = this.#coordinates[offset];
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
