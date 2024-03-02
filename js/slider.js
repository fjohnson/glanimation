import * as React from 'react';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import {createRoot} from "react-dom/client";

export const verticalSliderValues = {};
export function createVerticalSlider(parent){
  createRoot(parent).render(<VerticalSlider/>);
}
function valuetext(value) {
  const dateMap = new Map([
    [0, "Apr 1854"],
    [1, "May 1854"],
    [2, "Jun 1854"],
    [3, "Jul 1854"],
    [4, "Aug 1854"],
    [5, "Sep 1854"],
    [6, "Oct 1854"],
    [7, "Nov 1854"],
    [8, "Dec 1854"],
    [9, "Jan 1875"],
    [10, "Feb 1875"],
    [11, "Mar 1875"],
    [12, "Apr 1875"],
    [13, "May 1875"],
    [14, "Jun 1875"],
    [15, "Jul 1875"],
    [16, "Aug 1875"],
    [17, "Sep 1875"],
    [18, "Oct 1875"],
    [19, "Nov 1875"],
    [20, "Dec 1875"],
    [21, "Jan 1875"],
    [22, "Feb 1882"],
    [23, "Mar 1882"],
    [24, "Apr 1882"],
    [25, "May 1882"],
    [26, "Jun 1882"],
    [27, "Jul 1882"],
    [28, "Aug 1882"],
    [29, "Sep 1882"],
    [30, "Oct 1882"],
    [31, "Nov 1882"],
    [32, "Dec 1882"]]);
  return dateMap.get(value);
}

const marks = [
  {
    value: 0,
    label: '1854',
  },
  {
    value: 8,
    label: '1875',
  },
  {
    value: 20,
    label: '1882',
  },

];
function VerticalSlider() {
  return (
    <Stack sx={{ height: 300 }} spacing={1} direction="row">
      <Slider
        getAriaLabel={() => 'Temperature'}
        orientation="vertical"
        getAriaValueText={valuetext}
        defaultValue={[20, 37]}
        valueLabelDisplay="auto"
        valueLabelFormat={valuetext}
        marks={marks}
        min={0}
        max={31}
        // sx={{height:'50vh'}}
      />
    </Stack>
  );
}

