import {PuppetMaster} from "./puppetmaster.js";

mapboxgl.accessToken = 'pk.eyJ1IjoiZmpvaG5zODg4IiwiYSI6ImNsaGh6eXo1dDAzMDMzbW1td3BqOXFoaDMifQ.RBC_0mpQ25-GRAZDA0E0oA';
const map = new mapboxgl.Map({
  container: 'map', // container ID
  // Choose from Mapbox's core styles, or make your own style with Mapbox Studio
  style: 'mapbox://styles/fjohns888/clt8v4v3z00ct01qk2h369tp4',
  center: [-83.854, 44.65], // starting position [lng, lat]
  zoom: 6 // starting zoom
});

map.on('load', async () => {

  /*Add Map controls - pause, restart, speed, etc */

  //Set up the LOCK 3 marker using a custom div element
  const el = document.createElement('div');
  el.className = 'lock-marker';
  el.innerHTML = "<p>LOCK 3</p><div class='mapboxgl-popup-tip'></div>";
  const wellandCanalMarker = new mapboxgl.Marker(el,{"anchor":"right"});
  wellandCanalMarker.setLngLat([-79.243,43.154]).addTo(map)
  .setPopup(new mapboxgl.Popup({maxWidth:'none'}).setHTML("<p>Todo</p>"))

  //Alternative way of setting up the LOCK 3 marker but using a popup. Drawback is that it
  //has no option for being clickable and spawning its own popup. Need to implement that if
  //you want this option.
  // const popup = new mapboxgl.Popup({ closeOnClick: false, anchor:'right', closeButton:false, className:"lock-marker-popup" })
  //   .setLngLat([-79.243,43.154])
  //   .setHTML('<h1>LOCK 3</h1>')
  //   .addTo(map);

  map.addControl(new mapboxgl.FullscreenControl({container: document.querySelector('body')}));
  // Add a map scale control to the map
  map.addControl(new mapboxgl.ScaleControl());
  // Add zoom and rotation controls to the map.
  map.addControl(new mapboxgl.NavigationControl());

  const mbglcc = document.getElementsByClassName("mapboxgl-control-container")[0];
  const cctr = mbglcc.getElementsByClassName("mapboxgl-ctrl-top-right")[0];
  const html = `<div class="mapboxgl-ctrl mapboxgl-ctrl-group">
  <button id="pause-btn" aria-label="play" title="Pause"><i class="fa-solid fa-pause"></i></button>
  <button id="restart-btn" aria-label="restart" title="Restart"><i class="fa-solid fa-rotate-left"></i></button>
  <button id="speed-btn" class="fa-layers fa-fw 1x" title="Adjust speed">
   <span class="fa-layers-text fa-inverse" data-fa-transform="shrink-2" style="color:black">1x</span>
  </button>
  <button id="terrain-btn" class="clt8v4v3z00ct01qk2h369tp4" title="Change Terrain"><i class="fa-solid fa-layer-group"></i></button>
  <button id="focus-btn" class="focus-disabled" title="Focus on a vessel when clicked"><img src=data/binoculars-solidr.png width="14"/></button>
  <div id="calendar-dialog"></div>
  </div>`
  cctr.insertAdjacentHTML('beforeend',html);
  const aboutDialogButton = `
  <div class="mapboxgl-ctrl mapboxgl-ctrl-group">
    <div id="about-dialog"></div>
  </div>
  `;
  cctr.insertAdjacentHTML('afterbegin',aboutDialogButton);
  webpackExports.createCalendar(document.getElementById("calendar-dialog"));
  webpackExports.createAboutDialog(document.getElementById("about-dialog"));
  webpackExports.createSlider(document.getElementById("slider-container"));

  const tbtn = document.getElementById('terrain-btn');
  tbtn.addEventListener("click", ()=>{
    const cycle = new Map([
      ["clt8v4v3z00ct01qk2h369tp4","clt8uqlim00cp01qkewtm6jf8"],["clt8uqlim00cp01qkewtm6jf8","clt8uc45s00cl01qk70jn32y3",],
      ["clt8uc45s00cl01qk70jn32y3","clt8tdpi500pn01qpdncycb5o"],["clt8tdpi500pn01qpdncycb5o","clt8v4v3z00ct01qk2h369tp4"]]);

    for(let current of tbtn.classList.values()){
      if(cycle.has(current)){
        const styleNow = cycle.get(current);
        map.setStyle('mapbox://styles/fjohns888/' + styleNow);
        tbtn.classList.toggle(current);
        tbtn.classList.toggle(styleNow);
        break;
      }
    }
  });

  const response = await fetch(
    'data/manifest.json'
  );
  const data = await response.json();

  for(let vessel of data['manifest']){
    vessel['Date'] = dayjs(vessel['Date']);
  }
  let puppeteer = new PuppetMaster(data, map);
  webpackExports.callbackContainer[0]=puppeteer;
  webpackExports.sliderCBContainer[0]=puppeteer;

  const pauseButton = document.getElementById('pause-btn');
  const restartButton = document.getElementById('restart-btn')
  const speedButton = document.getElementById("speed-btn");
  const focusButton = document.getElementById("focus-btn");
  const aboutButton = document.getElementById("about-btn");

  focusButton.addEventListener('click', ()=>{
    focusButton.classList.toggle('focus-disabled');
    puppeteer.toggleFocus();
    let html;
    if(focusButton.classList.contains('focus-disabled')){
      html = '<img src=data/binoculars-solidr.png width="14"/>';
    }else{
      html = '<i class="fa-solid fa-binoculars"></i>';
    }
    focusButton.replaceChildren();
    focusButton.insertAdjacentHTML('beforeend',html);
  });

  pauseButton.addEventListener('click', ()=>{
    let html;
    if (!puppeteer.isPaused()) {
      puppeteer.pause();
      html = '<i class="fa-solid fa-play"></i>';
      pauseButton.setAttribute('title','Play');
      webpackExports.sliderSetters[1](false);
    } else {
      puppeteer.play();
      html = '<i class="fa-solid fa-pause"></i>';
      pauseButton.setAttribute('title','Pause');
      webpackExports.sliderSetters[1](true);
    }
    pauseButton.replaceChildren();
    pauseButton.insertAdjacentHTML('beforeend',html);
  });

  restartButton.addEventListener('click', ()=>{
    puppeteer.die();
    puppeteer = new PuppetMaster(data, map);
    webpackExports.callbackContainer[0] = puppeteer
    webpackExports.sliderCBContainer[0] = puppeteer
    if(pauseButton.getAttribute('title')==='Play'){
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

function setupLockMarker(map){
  //This function is necessary over just using a simple popup as it resizes the image
  //as the screen is zoomed out or zoomed in.
  const lockLocation = [-79.243, 43.154];
  map.loadImage('data/extremecanaller2.png',(error, image) => {
    if (error) {
      throw error;
    }

    // Add the image to the map style.
    map.addImage('lockicon', image);

    // Add a data source containing one point feature.
    map.addSource('lockloc', {
      'type': 'geojson',
      'data': {
        'type': 'FeatureCollection',
        'features': [
          {
            'type': 'Feature',
            'geometry': {
              'type': 'Point',
              'coordinates': lockLocation
            }
          }
        ]
      }
    });

    // Add a layer to use the image to represent the data.
    map.addLayer({
      'id': 'lockicon',
      'type': 'symbol',
      'source': 'lockloc', // reference the data source
      'layout': {
        'icon-image': 'lockicon', // reference the image
        'icon-size': [
          'interpolate',
          ['linear'],
          ['zoom'],
          0,.04,
          12,1,
          // 0,.1,
          // 22,1.8
        ]
      }
    });
  });
  map.on('click','lockicon', (e) => {
    popup.remove();
    popup.setLngLat(lockLocation).setHTML(
      `<h1>TODO</h1>
       <p>
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Donec quis diam tincidunt leo mollis vestibulum. Vestibulum et metus risus. Fusce varius euismod sem id dignissim. Curabitur accumsan finibus augue, rhoncus rutrum velit feugiat quis. Nullam neque dolor, ultrices id pellentesque vitae, convallis ac erat. Sed id odio nec quam tristique lobortis aliquam sit amet arcu. Sed eget purus lorem. Proin finibus, mauris eu dictum fermentum, mi est pulvinar arcu, at pharetra tellus est efficitur eros. Cras vel dui eu nibh lacinia tristique. Nulla facilisi. Ut vitae semper elit, ac varius nunc. Ut aliquet non sem ac porta. In et rutrum orci, vitae condimentum dolor. Morbi pulvinar erat vel est porta dapibus. Class aptent taciti sociosqu ad litora torquent per conubia nostra, per inceptos himenaeos.</p>`
    ).addTo(map);
  });
  map.on('mouseenter','lockicon', (e) => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'lockicon', () => {
    map.getCanvas().style.cursor = '';
  });
  const popup = new mapboxgl.Popup({
    closeButton: true,
    closeOnClick: true,
    className: 'lock-icon',
    maxWidth: '600px'
  });
}

