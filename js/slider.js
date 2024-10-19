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
export const sliderSetters = {};
export const indexToDate = {};

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
let marks = [
  {value: 0, label: '1854'},
  {value: 35, label: '1875'},
  {value: 67, label: '1882'}
];
let i = 0;
let dateIncrement = dayjs(new Date(1854,3,2));
while(dateIncrement.isBefore(dayjs(new Date(1854,11,3)))){
  indexToDate[i++] = dateIncrement;
  dateIncrement = dateIncrement.add(1,'week');
}
dateIncrement = dayjs(new Date(1875,4,3));
while(dateIncrement.isBefore(new Date(1875,11,10))){
  indexToDate[i++] = dateIncrement;
  dateIncrement = dateIncrement.add(1,'week');
}
dateIncrement = dayjs(new Date(1882,3,19));
while(dateIncrement.isBefore(new Date(1882,11,1))){
  indexToDate[i++] = dateIncrement;
  dateIncrement = dateIncrement.add(1,'week');
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

  sliderSetters.setSlider = setSlider;
  sliderSetters.setPause = setPause;

  function sliderChangeCB(event, value, activeThumb){
    if(activeThumb===undefined){
      const puppetMaster = sliderCBContainer[0];
      puppetMaster.changeDateSlider(indexToDate[value])
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
          <p id="slider-date" className="tiny5-regular">Apr 4</p>
        </div>
        <Box
          sx={{ width: "100vw" }}
          display="flex"
          alignItems="center"
          gap={2}
        >
          <IconButton
            aria-label="play-pause-button"
            color="primary"
            onClick={buttonCB}
            disableFocusRipple={true}
            disableRipple={true}
            edge={'start'}
            sx={{
              color:'black',

            }}
          >
            {!isPaused ? <PlayArrowIcon className="trz" sx={{ fontSize: 45 }}/>
              : <PauseIcon className="trz" sx={{ fontSize: 45 }}/>
            }
          </IconButton>
          <Slider
            aria-label="Restricted values"
            getAriaValueText={valuetext}
            step={1}
            marks={marks}
            onChangeCommitted={sliderChangeCB}
            onChange={sliderChangeCB}
            value={sliderVal}
            valueLabelFormat={displayLabel}
            valueLabelDisplay="auto"
            max={99}
            css={css`
              color: #0a3c5f;
              .MuiSlider-markLabel{
                font-weight: 700;
                font-size: clamp(.7rem,.75vw,.85rem);
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

