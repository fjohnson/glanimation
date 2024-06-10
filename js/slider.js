/* eslint-disable react/react-in-jsx-scope -- Unaware of jsxImportSource */
/** @jsxImportSource @emotion/react */
import * as React from 'react';
import { css } from '@emotion/react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { createTheme } from '@mui/material/styles';
import { ThemeProvider } from '@mui/material/styles';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import {createRoot} from "react-dom/client";
import * as dayjs from 'dayjs';

export const sliderCBContainer = [];
export const sliderSetters = [];
export function createSlider(parent){
  createRoot(parent).render(<TimelineSlider/>);
}

const theme = createTheme({
  typography: {
    fontFamily: ['Nunito Sans', "Segoe UI Semibold", 'sans-serif'].join(','),
  }
});

const timeLine = [
  [1854,['April -','May -','June -','July -','Aug -','Sep -','Oct -','Nov -','Dec -']],
  [1875,['May -','June -','July -','Aug -','Sep -','Oct -','Nov -','Dec -']],
  [1882,['April -','May -','June -','July -','Aug -','Sep -','Oct -','Nov -']]
]
const marks = [];
let v=0;
const indexToDate = {};
for(let [year,months] of timeLine){
  for(let mark of months){

    if(year === 1854 && mark === 'April -'){
      //Animation starts on April 4th and not the first of the month
      let startDate = dayjs(new Date(year,3,4));
      for(let i=0; i<4;i++){
        indexToDate[v+i] = startDate
        startDate = startDate.add(1,'week');
      }
      marks.push({
        value: v++,
        label: '1854 -'
      });
      marks.push({
        value: v++,
        label: ''
      });
      marks.push({
        value: v++,
        label: ''
      });
      marks.push({
        value: v++,
        label: ''
      });
    }
    else if(year === 1854 && mark === 'Dec -'){
      //Last date for 1854 is Dec 12, so only allow up to Dec 8th selection on the slider
      indexToDate[v] = dayjs(new Date(1854,11,1));
      marks.push({
        value: v++,
        label: mark
      });
      indexToDate[v] = indexToDate[v-1].add(1,'week');
      marks.push({
        value: v++,
        label: ''
      });
    }
    else if(year === 1875 && mark === 'Dec -'){
      //Last date is Dec 17
      indexToDate[v] = dayjs(new Date(1875,11,1));
      marks.push({
        value: v++,
        label: mark
      });
      indexToDate[v] = indexToDate[v-1].add(1,'week');
      marks.push({
        value: v++,
        label: ''
      });
      indexToDate[v] = indexToDate[v-1].add(1,'week');
      marks.push({
        value: v++,
        label: ''
      });
    }
    else{

      //Every other month is 4 weeks. 1882 Ends on Nov 30.
      let startDate = dayjs(`${year} ${mark.split(' -')[0]} 1`);
      for(let i=0; i<4;i++){
        indexToDate[v+i] = startDate
        startDate = startDate.add(1,'week');
      }
      if(year===1875 && mark ==='May -'){
        marks.push({
          value: v++,
          label: '1875 -'
        });
      }else if(year===1882 && mark ==='April -'){
        marks.push({
          value: v++,
          label: '1882 -'
        });
      }else{
        marks.push({
          value: v++,
          label: mark
        });
      }

      marks.push({
        value: v++,
        label: ''
      });
      marks.push({
        value: v++,
        label: ''
      });
      marks.push({
        value: v++,
        label: ''
      });
    }
  }
}
function valuetext(value) {
  return `${value}`;
}
function displayLabel(i){
  return indexToDate[i].format('MMM D')
}
export function TimelineSlider() {
  const [sliderVal, setSlider] = useState(0);
  const [isPaused, setPause] = useState(true);

  sliderSetters[0] = setSlider;
  sliderSetters[1] = setPause;

  function sliderChangeCB(event, value, activeThumb){
    if(activeThumb===undefined){
      const puppetMaster = sliderCBContainer[0];
      //puppetMaster
    }
    setSlider(value);
  }
  function buttonCB(){
    document.getElementById("pause-btn").click();
    setPause(!isPaused);
  }
  return (
    <ThemeProvider theme={theme}>
      <div id="date-slider">
        <div id="slider-date-container">
          <p id="slider-year" className="tiny5-regular">1854</p>
          <p id="slider-date" className="tiny5-regular">April 12</p>
        </div>
        <IconButton
          aria-label="play-pause-button"
          color="primary"
          onClick={buttonCB}
          disableFocusRipple={true}
          disableRipple={true}
          edge={'start'}
          sx={{
            color:'black',
            padding:'16px'
          }}
        >
          {!isPaused ? <PlayArrowIcon className="trz" sx={{ fontSize: 45 }}/>
                     : <PauseIcon className="trz" sx={{ fontSize: 45 }}/>
          }
        </IconButton>
        <Box sx={{ width: "70vw"}}>
          <Slider
            aria-label="Restricted values"
            getAriaValueText={valuetext}
            step={null}
            marks={marks}
            onChangeCommitted={sliderChangeCB}
            onChange={sliderChangeCB}
            value={sliderVal}
            valueLabelFormat={displayLabel}
            valueLabelDisplay="auto"
            css={css`
              color: #0a3c5f;
              .MuiSlider-markLabel{
                transform: translateX(-50%) translateY(5px) rotate(-90deg);
                font-weight: 700;
              }
              .MuiSlider-valueLabel{
                color: white;
                background: #0a3c5f;
              }
            `}
          />
        </Box>
      </div>
    </ThemeProvider>
  );
}

