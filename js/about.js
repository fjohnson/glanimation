import * as React from "react";
import Dialog from "@mui/material/Dialog";
import {useState} from "react";
import {createRoot} from "react-dom/client";

export function createAboutDialog(parent){
  createRoot(parent).render(<AboutDialog/>);
}
function AboutDialog() {
  const [open, setOpen] = useState(false);
  function handleClickOpen(){
    setOpen(true);
  }
  function handleClose(){
    setOpen(false);
  }
  return (
    <React.Fragment>
      <button id="about-btn" title="About" onClick={handleClickOpen}>
        <i className="fa-solid fa-info"></i>
      </button>
      <Dialog
        open={open}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description">
        <h1>Todo</h1>
      </Dialog>
    </React.Fragment>);
}
