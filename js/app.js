const CLIENT_ID = "1068107389496-sapmb6nh9l85vccdke6ju2jsbv5ibs51.apps.googleusercontent.com"; // Client ID from https://console.developers.google.com
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]; // The nexessary API scopes
const MIME = "application/vnd.google-apps.spreadsheet";

/** Quickly select HTML elements using a CSS selector */
const q = s => document.querySelector(s);
/** Get an array with length N where each value equals its index */
const range = N => Array(N).fill().map((_, i) => i);

/** @type {Array} CSS selectors for all the components (elements that should not be visible at the same time) */
const COMPONENTS = ["#result-view", "form#update", "form#losetimer", "pre#output"];
/** Make all component selectors available as constants */
const [RESULT, UPDATE, LOSETIMER, PRE] = COMPONENTS;
/** Displays the component with the given key if one is provided, returns an array of active components otherwise */
const show = key =>
  key
    ? COMPONENTS.forEach(id => (q(id).style.display = key === id ? "block" : "none"))
    : COMPONENTS.filter(id => q(id).style.display === "block");

/**
 * Info regarding the current version of the spreadsheet @type {Object}
 * Properties (? marks optional):
 *   {String} key          A string of random words only found in that spreadsheet
 *   {String} title        The name the spreadsheet will get in the user's Drive
 *   {String} template     The drive id for the public template
 *   {String} range        The range where days, hours and extra can be found
 *   {Array<number>} days  The vertical and horizontal position of days in the range, respectively
 *   {Array<number>} hours The vertical and horizontal position of hours in the range, respectively
 *   {Array<number>} extra The vertical and horizontal position of extra hours in the range, respectively
 *   {?String} losetimer   Range with information about løse studietimer (must follow standard format)
 */
const VERSION = {
  key: "ba20e7c6932aff82e4cce69e9693fb2f",
  title: "Plusstimer vår 2019",
  template: "1IUZTdlJlaKUEuQXE4SzRbByYjGW7rnGjTeT-QDFDk2o",
  range: "Plusstimer!D7:G7",
  days: [0, 0],
  hours: [0, 1],
  extra: [0, 2],
  plusstimer: [0, 3],
  losetimer: "Plusstimer!M15:N19",
};

/**
 * Array of objects with info about previous versions of spreadsheets from the same semester as the current version @type {Array<Object>}
 * Each object can have the same properties as a VERSION object, but only `key` and `range` is required.
 * The only difference is that the losetimer prop should be an array of two numbers, the column and the first row of the losetimer cells in the range (and the losetimer cells must be 5 cells directly underneath each other)
 */
const COMPATIBLE_VERSIONS = [{
  key: "2c15975b3cbd3189dd9a776e91da0507",
  title: "Plusstimer vår 2019",
  template: "1TQS9fNNx-TxM4kx8IiZTIe96acp6xLB2ERvzZ-lYNgo",
  range: "Plusstimer!D7:L19",
  days: [0, 0],
  hours: [0, 1],
  extra: [0, 2],
  losetimer: "Plusstimer!K15:L19",
}];

/** Array of keywords in old and outdated spreadsheets created by this web app that should be trashed */
const INCOMPATIBLE_VERSIONS = [
  "Plusstimer 2017 høst Panda Bever",
  "Plusstimer 2017 høst Ulv Rotte",
  "Plusstimer 2018 vår gfxksll",
  "Versjon ll20s0gc",
  "tnjioe0fh34j9",
];

/** Check if current user has authorized this application. */
function checkAuth() {
  const timeout = setTimeout(apiLoadErr, 5000);
  gapi.auth.authorize(
    {
      client_id: CLIENT_ID,
      scope: SCOPES.join(" "),
      immediate: true,
    },
    result => (q("#authorize-div").style.display = "block", handleAuthResult(result), clearTimeout(timeout))
  );
}

/** Initiate auth flow in response to user clicking authorize button. */
function handleAuthClick() {
  gapi.auth.authorize({ client_id: CLIENT_ID, scope: SCOPES, immediate: false }, handleAuthResult);
}


/**
 * Append text to the pre element containing the given message.
 * @param {string} message Text to be placed in pre element.
 * @param {boolean} error Whether or not the message is an error
 */
function log(message, error = false) {
  if (error) {
    show(PRE);
    q("pre").innerHTML = `<h4 class="error">${message}</h4>`;
  }
  console.log(message);
}
/** Clears the pre element and adds a loading icon to it */
function showLoading() {
  show(PRE);
  q(PRE).innerHTML = `<img id="loading" src="img/loading.svg">`;
}

/**
 * Handle response from authorization server.
 * @param {Object} authResult Authorization result.
 */
function handleAuthResult(authResult) {
  if (authResult && !authResult.error) {
    showLoading();
    loadGDriveApi(); // Load client library
  }
}

/** Handle API load error */
function apiLoadErr() {
  log(
    "Det virker som om det er noe galt. Prøv å laste inn siden på nytt, eller å bruke mobilen eller en annen PC.",
    true
  );
}

/** Load Google Drive API library. */
function loadGDriveApi() {
  log("Laster inn...");
  gapi.client.load("drive", "v2", _=>{
    if ("sheetId" in localStorage && "versionKey" in localStorage && localStorage.versionKey === VERSION.key)
      loadSheetsApi(fetchAndOutputData, localStorage.sheetId, false);
    findFile();
  });
}

/** Find the right file. */
function findFile() {
  log("Leter etter regnearket");
  gapi.client.drive.files
    .list({
      q: "fullText contains '" + VERSION.key + "'",
    })
    .execute(resp => {
      if (!resp.error) {
        trashIncompatibles();
        const sheetId = getID(resp.items);
        if (sheetId) {
          loadSheetsApi(fetchAndOutputData, sheetId, false);
          setEventListener(sheetId);
          localStorage.sheetId = sheetId;
          localStorage.versionKey = VERSION.key;
          if ("losetimer" in VERSION) {
            q("#loselink").setAttribute("onclick", `renderLosetimer("${sheetId}"); false`);
          }
        }
      } else if (resp.error.code == 401) {
        checkAuth(); // Access token might have expired.
      } else {
        log("En feil oppsto: " + resp.error.message, true);
      }
    });
}

/**
 * Find ID of the right file or create a file if none exist and return ID
 * @param {Array} items Array of documents in user's Drive that match the search query
 */
function getID(items) {
  const match = items.find(item => item.mimeType === MIME && !item.labels.trashed);
  if (match) return match.id;
  else log("Oppretter regneark"), copyFile();
}

/**
 * Load Sheets API client library.
 * @param {Function} callback Function to execute after loading API.
 * @param {...*} args Arguments to send to callback function.
 */
let sheetsApiLoaded = false;
function loadSheetsApi(callback, ...args) {
  if (sheetsApiLoaded) callback(...args);
  else gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4").then(response => {
    sheetsApiLoaded = true;
    callback(...args);
  });
}

/** Fetch and print the data */
function fetchAndOutputData(sheetId, autoShowForm = false) {
  console.log("fetchAndOutputData called with sheetId", sheetId)
  log("Laster inn plusstimer");
  if (typeof sheetId === "string") {
    gapi.client.sheets.spreadsheets.values
      .get({
        spreadsheetId: sheetId,
        range: VERSION.range,
      })
      .then(response => {
        const range = response.result;
        // Validate response and print result
        if (range.values.length > 0) {
          if (!autoShowForm) show(RESULT);
          ["days", "hours", "extra"].forEach(key=>q(UPDATE).querySelector(`[name="${key}"]`).value = range.values[VERSION[key][0]][VERSION[key][1]]);
          q("#result>.number").innerHTML = range.values[VERSION.plusstimer[0]][VERSION.plusstimer[1]];
          showExtraFormIf(range.values[VERSION.extra[0]][VERSION.extra[1]] > 0);
          displayLastEditDate(sheetId);
        } else {
          // Handle unsuccessful validation of response
          log("Fant ingen data.", true);
        }
        if (autoShowForm) renderLosetimer(sheetId, true);
      })
      .catch(response => {
        log("Feil: " + response.result.error.message, true);
      });
  } else {
    // Handle unsuccessful validation of the sheetId variable (this should never happen, but the user should get an explanation if it does)
    log("Noe gikk galt, vennligst last inn siden på nytt og prøv igjen", true);
  }
}

/** Get last edit date and display it in the result view */
function displayLastEditDate(sheetId) {
  const el = q("#last-update");
  el.innerHTML = '';
  setTimeout(_=>gapi.client.drive.files
  .get({
      fileId: sheetId,
    })
    .execute(resp => {
      const dateStr = resp.modifiedDate;
      el.innerHTML = `(Sist endret ${formatDate(dateStr)})`;
    }), 500);
}

/** Copy a spreadsheet file from public template because no existing file was found */
function copyFile() {
  gapi.client.drive.files
    .copy({
      fileId: VERSION.template,
      resource: { title: VERSION.title },
    })
    .execute(resp => {
      if (COMPATIBLE_VERSIONS.length) copyFromOldSheet(resp.id); // Check if any older, but compatible, versions of the current spreadsheet exists
      else loadSheetsApi(_ => renderLosetimer(resp.id, true));
      setEventListener(resp.id);
    });
}

/** Get data from old compatible spreadsheet and insert it into the new one */
function copyFromOldSheet(newSheetId) {
  if (!COMPATIBLE_VERSIONS.length) return renderLosetimer(newSheetId, true);
  log("Prøver å finne et gammelt regneark");
  gapi.client.drive.files
    .list({
      q: COMPATIBLE_VERSIONS.map(v => `fullText contains "${v.key}"`).join(" or "),
    })
    .execute(resp => {
      if (!resp.error) {
        const oldSheet = resp.items.find(item => item.mimeType === MIME && !item.labels.trashed);
        if (oldSheet) {
          log("Fant et gammelt regneark");
          const version = COMPATIBLE_VERSIONS.find(v => v.title === oldSheet.title) || COMPATIBLE_VERSIONS[0];
          loadSheetsApi(_ => {
            gapi.client.sheets.spreadsheets.values
              .get({
                // Get amount of days abscence
                spreadsheetId: oldSheet.id,
                range: version.range,
              })
              .then(resp => {
                // Update the new sheet with the variables from the old sheet
                const values = resp.result.values;
                const [days, hours, extra] = ["days", "hours", "extra"].map(key => version[key]).map(
                  coords => resp.result.values[coords[0]][coords[1]]
                );
                if (version.losetimer) {
                  gapi.client.sheets.spreadsheets.values.get({
                    // Get losetimer from sheet
                    spreadsheetId: oldSheet.id,
                    range: version.losetimer,
                  }).then(resp => {
                    updateLoseTimer(newSheetId, resp.result.values, ()=>{
                      trashFile(oldSheet.id);
                      updateSheet(newSheetId, days, hours, extra, false);
                    }, version)
                  })
                } else {
                  updateSheet(newSheetId, days, hours, extra, true);
                  trashFile(oldSheet.id);
                }
              });
          });
        } else renderLosetimer(newSheetId, true);
      } else renderLosetimer(newSheetId, true);
    });
}

/**
 * Move a file to the trash.
 * @param {String} fileId ID of the file to trash.
 */
function trashFile(fileId) {
  log("Flytter gammelt regneark til papirkurven");
  gapi.client.drive.files.trash({ fileId: fileId }).execute(resp => {
    if (resp.error) console.warn(resp.error, resp);
  });
}

/** Move all outdated files to trash */
function trashIncompatibles() {
  INCOMPATIBLE_VERSIONS.forEach(version => {
    gapi.client.drive.files
      .list({
        q: "fullText contains '" + version + "'",
      })
      .execute(resp =>
        resp.items
          .filter(item => item.mimeType == MIME && !item.labels.trashed)
          .map(item => item.id)
          .forEach(trashFile)
      );
  });
}

/*
 * Update spreadsheet
 * @param {string|number} days Amount of days abscence
 * @param {string|number} preset_hours Amount of hours abscence
 * @param {string|number} extra Extra school hours worked
 */
function updateSheet(sheetId, days, hours, extra, autoShowForm = false) {
  if (days && hours) {
    show(PRE);
    const values = [];
    const keys = ["days", "hours", "extra"]
    keys.forEach(key => values[VERSION[key][0]] = []);
    keys.forEach((key, i) => values[VERSION[key][0]][VERSION[key][1]] = [days, hours, extra][i]);
    log("Oppdaterer fravær");
    gapi.client.sheets.spreadsheets.values
      .update({
        spreadsheetId: sheetId,
        range: VERSION.range,
        valueInputOption: "USER_ENTERED",
        values: values,
      })
      .then(resp => {
        fetchAndOutputData(sheetId, autoShowForm);
      });
  } else {
    show(UPDATE);
  }
}

/** Handle update form submission */
function setEventListener(sheetId) {
  q(UPDATE).onsubmit = event => {
    event.preventDefault();
    updateSheet(sheetId, ...["days", "hours", "extra"].map(key => document.getElementsByName(key)[0].value));
  };
}

/**
 * If condition is true: shows the extra form, checks the "Yes" box and unchecks the "No" box.
 * Otherwise: the opposite happens.
 * @param {boolean} condition Whether or not the extra form should be shown
 */
function showExtraFormIf(condition) {
  q("#extra-div").style.display = condition ? "block" : "none";
  [...document.getElementsByName("show-extra")].forEach((checkbox, i) => (checkbox.checked = i == condition));
}

/** Listen for changes in checkbox */
["click", "keyup"].forEach(e =>
  q("#extra-form").addEventListener(e, event => {
    showExtraFormIf(q("#show-extra").checked);
    if (!q("#show-extra").checked) q(UPDATE).querySelector`[name="extra"]`.value = "";
  })
);

/**
 * Updates losetimer cell values in sheet
 *
 * @param      {string}    sheetId                The sheet identifier
 * @param      {Array}     values                 The data that should be saved in the sheet (Array<[weekday: string, losetimer: number]>)
 * @param      {Function}  callback               Callback function
 */
function updateLoseTimer(sheetId, values, callback = false) {
  loadSheetsApi(_ => {
    showLoading();
    gapi.client.sheets.spreadsheets.values
      .update({
        spreadsheetId: sheetId,
        range: VERSION.losetimer,
        valueInputOption: "USER_ENTERED",
        values: values,
      })
      .then(callback ? callback : ()=>fetchAndOutputData(sheetId))
      .catch(resp=>{
        log("Det oppsto en feil: "+resp.result.error.message+"\n\nLast inn siden på nytt for å prøve igjen.", true);
      });
  });
}

/** Render form that allows user to set when their løse studietimer is */
function renderLosetimer(sheetId, showFormAfterwards = false) {
  if ("losetimer" in VERSION) {
    if (!show().includes("form#losetimer")) showLoading();
    const form = q(LOSETIMER);
    form.onsubmit = event=>{
      event.preventDefault();
      const values = range(5)
        .map(i=>[...form.querySelectorAll(`[key="${i}"]`)].map(el=>el.value || el.innerText));
      updateLoseTimer(sheetId, values, showFormAfterwards ? ()=>show(UPDATE) : false);
    };
    loadSheetsApi(_ => {
      gapi.client.sheets.spreadsheets.values
        .get({
          spreadsheetId: sheetId,
          range: VERSION.losetimer,
        })
        .then(resp => {
          show(LOSETIMER);
          form.querySelector(".grid-2").innerHTML = `
              <div>Ukedag</div>
              <div>Antall løse studietimer</div>`
            + resp.result.values
              .map((dayData, i) => `
                <div key="${i}">${dayData[0]}</div>
                <input key="${i}" name="amount" type="number" value="${dayData[1]}">`
              ).join("");
        });
    });
  } else show(RESULT);
}


["https://stackpath.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css"].forEach(url=>{
  let link = document.createElement("link");
  link.setAttribute("rel", "stylesheet");
  link.setAttribute("href", url);
  q("head").appendChild(link);
});
