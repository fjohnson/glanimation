import * as React from 'react';
import {createRoot} from "react-dom/client";
import Dialog from '@mui/material/Dialog';
import '@iroomit/react-date-range/dist/styles.css'; // main css file
import '@iroomit/react-date-range/dist/theme/default.css'; // theme css file
import { DateRangePicker } from '@iroomit/react-date-range';
import { useState } from 'react';
import { eachDayOfInterval } from "date-fns";

export const callbackContainer = [];
export function createDateRange(parent){
  createRoot(parent).render(<DateRangeDialog/>);
}

const config = { attributes: false, childList: true, subtree: false };
const callback = (mutationList, observer) => {
  for (const mutation of mutationList) {
    if (mutation.type === "childList") {
      console.log("A child node has been added or removed.");
      const targetNode = document.querySelector("span.rdrYearPicker");
      // console.log(targetNode.children[0].children);
    }
  }
};
const observer = new MutationObserver(callback);

let dateSelection = null;
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
    let puppetMaster = callbackContainer[0];
    puppetMaster.pause();
    const targetNode = document.querySelector("body");
    observer.observe(targetNode, config);
    setOpen(true);
  }

  function handleClose(){
    let puppetMaster = callbackContainer[0];
    puppetMaster.changeDate(dateSelection);
    observer.disconnect();
    setOpen(false);
  }

  function handleSelection(item){
    setState([item.selection]);
    dateSelection = item.selection;
  }

  const disabledDates = eachDayOfInterval({
    start: new Date(1854, 0, 1),
    end: new Date(1854, 3, 3)
  }).concat(
    eachDayOfInterval({
      start: new Date(1855, 0, 1),
      end: new Date(1855, 11, 31)
    })
  );

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
        maxDate={new Date(1876,11,31)}
        direction="vertical"
        scroll={{ enabled: true }}
        ranges={state}
        showDateDisplay={false}
        disabledDates={disabledDates}
      />
    </Dialog>
  </React.Fragment>
  );
}


