# Welland Lock Animation
This is a prototype for animating historical voyages through the Welland Lock in the year of 1854. It uses Mapbox GL for the animation. 

### Description of files
geo.ipynb - A Jupyter notebook for converting historical shipping data into two separate outputs as described below. This notebook requires two files:

 -  *'1854 1875 1882 WCR.csv'* -  CSV conversion from the same spreadsheet 
 -  *water_paths.json* - The QGIS geojson conversion (with certain paths removed) of the following source https://www.arcgis.com/home/item.html?id=a4940deebec84fb9b6afa65afcbf891d#overview

After running the notebook the output should be placed in data/. Here is a description of what should be in data/

 - *data/manifest.json* - This contains information from the 1854 WCR 2023 CSV, more specifically what ships were being sent out and when. It also contains the paths that the ships should take for the animation.
 - *data/water_paths.json* - Same file as described above.
 - *data/debug.json* - Locations described in the CSV are historical locations and not lon/lat specific locations. The [Mapbox geocoding API](https://docs.mapbox.com/api/search/geocoding/) is used to determine possible locations on the map that correspond to CSV locations. Of course this is not a fool proof process and so some locations are way off the mark.  Also, even if the locations are correct they may not reside on the paths specified in the geojson water_paths.json file. Hence this file is used for showing the difference between geocoded locations and where these locations are actually placed on the water_paths.json paths.

### Deploying
There is nothing serverside in this code and everything is in the client. It can be deployed as a Github page or the repository can be cloned and served from a static location on a webserver. The build process is pretty simple and involves...
1. Check out code 
2. Install `npm`
3. Run `npm install` inside the repository directory
4. Run `npx webpack` to build the required js bundle
5. Deploy as a static site
   
The Jupyter notebook does not need to be run and no files need to be placed in *data/* as this has already been done. If on the other hand something changes in the original spreadsheets or *water_paths.json* needs to change, the notebook will need to be run again. 
