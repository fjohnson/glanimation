import * as React from 'react';
import {createRoot} from "react-dom/client";
import Dialog from '@mui/material/Dialog';
import '@iroomit/react-date-range/dist/styles.css'; // main css file
import '@iroomit/react-date-range/dist/theme/default.css'; // theme css file
import { DateRangePicker } from '@iroomit/react-date-range';
import { useState } from 'react';

export const dateRangeValues = {};
export function createDateRange(parent){
  createRoot(parent).render(<DateRangeDialog/>);
}
function DateRangeDialog() {
  const [state, setState] = useState([
    {
      startDate: new Date(1854,3,1),
      endDate: new Date(1854,3,1),
      key: 'selection'
    }
  ]);

  const [open, setOpen] = useState(false);

  function handleClickOpen(){
    setOpen(true);

  }

  function handleClose(){
    setOpen(false);
  }

  function handleSelection(item){
    dateRangeValues.selection = item.selection;
    setState([item.selection]);
  }

  return (
    <React.Fragment>
      <button id="calendar-btn" onClick={handleClickOpen}>
        <i className="fa-solid fa-calendar-days"></i>
      </button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description">
      <DateRangePicker
        onChange={handleSelection}
        months={1}
        minDate={new Date(1854,3,1)}
        maxDate={new Date(1854,11,31)}
        direction="vertical"
        scroll={{ enabled: true }}
        ranges={state}
        showDateDisplay={false}
        // showMonthArrow={false}
      />
    </Dialog>
  </React.Fragment>
  );
}


