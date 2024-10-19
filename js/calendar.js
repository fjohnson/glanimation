import * as React from 'react';
import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import {createRoot} from "react-dom/client";
import { useRef } from 'react';
import * as dayjs from 'dayjs';

export const calendarCBContainer = [];
export const calenderSetters = {}

export function createCalendar(parent){
    createRoot(parent).render(<CalendarDialog/>);
}

export function CalendarDialog(){
  const [open, setOpen] = useState(false);
  let ref = useRef({
    selected: [new Date(1854, 3, 2),new Date(1854, 3, 2)],
    displayMonth: new Date(1854, 3, 2)
  });

  function handleClickOpen(){
    let puppetMaster = calendarCBContainer[0];
    const pauseButton = document.getElementById('pause-btn');
    if(pauseButton.getAttribute('title')==='Pause'){
      pauseButton.click();
    }else{
      puppetMaster.pause();
    }
    setOpen(true);
  }

  function handleClose(){
    let puppetMaster = calendarCBContainer[0];
    puppetMaster.changeDateCalendar({
      startDate: dayjs(ref.current.selected[0]),
      endDate: dayjs(ref.current.selected[1])
    });
    setOpen(false);
  }

  const [value, setValue] = useState(ref.current.selected);
  calenderSetters.setValue = setValue;

  function onChange(nextValue){
    const endDate = nextValue[1];
    const noTime = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    ref.current.selected = [nextValue[0], noTime];
    ref.current.displayMonth = nextValue[1];
    setValue(nextValue);
  }

  function isInvalidDate(tileArgs){
    const {activeStartDate, date, view} = tileArgs;
    const month = date.getMonth();
    const year = date.getFullYear();
    const day = date.getDate();
    if(view === 'month'){
      return !((year === 1854 && month === 3 && day >= 2) ||
               (year === 1854 && month >3 && month < 11) ||
               (year === 1854 && month === 11 && day <= 2) ||

               (year === 1875 && month === 4 && day >= 3)   ||
               (year === 1875 && month >4 && month < 11) ||
               (year === 1875 && month === 11 && day <= 9) ||

               (year === 1882 && month === 3 && day >= 19) ||
               (year === 1882 && month > 3 && month < 11))
    }
    else if (view === 'year'){
      return   (year === 1854 && month < 3) ||
               (year === 1875 && month < 4) ||
               (year === 1882 && (month < 3 || month === 11)) ||
               (![1854,1875,1882].includes(year));
    }
    else if(view === 'decade') {
      return ![1854,1875,1882].includes(year);
    }
    else if(view === 'century') {
      // With min/max dates set only four possible decades are passed in the `date` variable
      // These are 1851, 1861, 1871, 1881.
      return year === 1861;
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
                  maxDate={new Date(1882,11, 31)}
                  minDate={new Date(1854,3,2)}
                  selectRange={true}
                  tileDisabled={isInvalidDate}
        />
      </Dialog>
    </React.Fragment>
  )
}
