import * as React from "react";
import Dialog from "@mui/material/Dialog";
import {useState} from "react";
import {createRoot} from "react-dom/client";

export function createAboutDialog(parent) {
  createRoot(parent).render(<AboutDialog/>);
}

function AboutDialog() {
  const [open, setOpen] = useState(false);

  function handleClickOpen() {
    setOpen(true);
  }

  function handleClose() {
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
        maxWidth={"md"}
        aria-labelledby="About the project"
        aria-describedby="A description of the project">
        <div id="about-content">
          <h1 id="about-header">About the Welland Canal Register Project</h1>
          <p>The opening of the First Welland Canal in 1829, connecting Lakes Ontario and Erie, generated a new route
            for trade and navigation within the Great Lakes region. Increasing demand for commodities both regionally
            and internationally resulted in the enlargement of the Welland Canal in 1845. The Keeper at Lock 3 on the
            Second Welland Canal (1845-1904) recorded shipping movements, cargoes, and varying additional details, for
            government records of both Canadian and American trade through this important waterway.</p>
          <p>The Welland Canal registers are housed at the Library and Archives of Canada (Ottawa). The 1854, 1875 and
            1882 shipping seasons have been digitized and transcribed, with the completed animations shared here. Team
            members are currently working on transcribing 1864 and also 1882 (Lock 7, Third Welland Canal, 1882-1931). A
            searchable database will be shared online at the <a href="https://shicklunashipyard.com/">Shickluna Shipyard
              Project</a> website after completion of these datasets.</p>
          <p>The time-lapse animations of the Welland Canal register document the changing transport zones through the
            Second Welland Canal. Through geo-visualizing the data, hundreds of sail and steam vessels can be examined
            within the context of the Welland Canal trade, while highlighting the Niagara region’s role as an entrepôt
            on the Great Lakes – Atlantic route.</p>
          <p id="about-author">Kimberly Monk</p>
          <a href="mailto:shipyard@brocku.ca">shipyard@brocku.ca</a>
          <p>Credits: Research Assistants Fletcher Johnson, James Lang, Caylee Mooy, and Manel Belhadji-Domecq for their
            work in visualization, digitization, transcription, and editing. Students on Brock University's HIST/CLAS
            3M61 (2020-2024) for their contribution to data transcription. This project was supported through a Social
            Sciences and Humanities Research Council of Canada, Insight Development Grant,
            <span style={{fontWeight:"bold"}}>Visualizing Past Landscapes: Toward Reengaging the Historic Environment</span> (2018-2023).
          </p>
        </div>
      </Dialog>
    </React.Fragment>);
}
