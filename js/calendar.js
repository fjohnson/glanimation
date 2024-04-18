import * as React from 'react';
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {createRoot} from "react-dom/client";
import { useRef } from 'react';
export const callbackContainer = [];
export function createCalendar(parent){
    createRoot(parent).render(<CalendarDialog/>);
}

export function CalendarDialog(){
  const [open, setOpen] = useState(false);
  let ref = useRef({
    selected: [new Date(1854, 3, 12),new Date(1854, 3, 12)],
    displayMonth: new Date(1854, 3, 12)
  });

  function handleClickOpen(){
    let puppetMaster = callbackContainer[0];
    puppetMaster.pause();
    setOpen(true);
  }

  function handleClose(){
    let puppetMaster = callbackContainer[0];
    puppetMaster.changeDate({
      startDate: ref.current.selected[0],
      endDate: ref.current.selected[1]
    });
    setOpen(false);
  }
  const [value, setValue] = useState(ref.current.selected);
  function onChange(nextValue){
    const endDate = nextValue[1];
    const noTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    ref.current.selected = [nextValue[0], noTime];
    ref.current.displayMonth = nextValue[1];
    setValue(nextValue);
  }

  function isValidDate(tileArgs){
    const {activeStartDate, date, view} = tileArgs;
    if(view !== 'century') {
      return date.getFullYear() !== 1854 &&
        date.getFullYear() !== 1876 &&
        date.getFullYear() !== 1883;
    }
    else {
      return date.getFullYear() === 1861;
    }
  }
  return (
    <React.Fragment>
      <button id="calendar-btn" title="Calendar" onClick={handleClickOpen}>
        <i className="fa-solid fa-calendar-days"></i>
      </button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description">
        <Calendar onChange={onChange}
                  value={value}
                  defaultActiveStartDate={ref.current.displayMonth}
                  maxDate={new Date(1884,0,1)}
                  minDate={new Date(1854,0,1)}
                  selectRange={true}
                  tileDisabled={isValidDate}
        />
      </Dialog>
    </React.Fragment>
  )
}
