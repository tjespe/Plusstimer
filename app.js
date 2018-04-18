const CLIENT_ID = "1068107389496-sapmb6nh9l85vccdke6ju2jsbv5ibs51.apps.googleusercontent.com"; // Client ID from https://console.developers.google.com
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]; // The nexessary API scopes

const q = s=>document.querySelector(s); // Quickly select HTML elements using a CSS selector

const VERSION = { // Info regarding the current version of the spreadsheet
  key: "Versjon ll20s0gc", // A unique identifier for the document
  title: "Plusstimer vår 2018", // The name the spreadsheet will get in the user's Drive
  template: "18JNjXO_RUPuH4414LOKF0vzgqLVQomnF_LmXMjtKc2A", // The drive id for the template
  range: "Plusstimer!D7:G7", // The range where days, hours and plusstimer can be found (include name of sheet if more than one sheet in spreadsheet)
  days: [0,0], // The vertical and horizontal position of days in the range, respectively
  hours: [0,1], // The vertical and horizontal position of hours in the range, respectively
  extra: [0,2], // The vertical and horizontal position of extra hours in the range, respectively
  plusstimer: [0,3]  // The vertical and horizontal position of plusstimer in the range, respectively
};

/**
* The point of this array is to copy values from an existing spreadsheet so that the user does not have to re-enter them.
* Currently only one element is supported in this array but that will be fixed in the future.
*/
const COMPATIBLE_VERSIONS = [{
  key: "Plusstimer 2018 vår gfxksll",         // A string of random words only found in that spreadsheet
  days: "Plusstimer!D7",                      // The cell that contains amount of days abscence
  hours: "Plusstimer!E7"                      // The cell that contains amount of hours abscence
}];

/**
 * Array of keywords in old and outdated spreadsheets created by this web app that should be trashed
 */
const INCOMPATIBLE_VERSIONS = ["Plusstimer 2017 høst Panda Bever", "Plusstimer 2017 høst Ulv Rotte"];

/**
* Check if current user has authorized this application.
*/
function checkAuth() {
  let timeout = setTimeout(apiLoadErr, 3000);
  gapi.auth.authorize({
    "client_id": CLIENT_ID,
    "scope": SCOPES.join(" "),
    "immediate": true
  }, result=>(q("#authorize-div").style.display = "block", handleAuthResult(result), clearTimeout(timeout)));
}

/**
* Initiate auth flow in response to user clicking authorize button.
*/
function handleAuthClick() {
  gapi.auth.authorize(
    {client_id: CLIENT_ID, scope: SCOPES, immediate: false},
    handleAuthResult
  );
  appendPre("Autoriserer");
}

/**
* Hide loading text
*/
function hideLoading() {
  if (el = document.querySelector("#loading")) el.remove();
}

/**
* Handle response from authorization server.
*
* @param {Object} authResult Authorization result.
*/
function handleAuthResult(authResult) {
  hideLoading();
  if (authResult && !authResult.error) {
    q("#authorize-div").style.display = "none"; // Hide auth UI
    clearPre();
    loadGDriveApi(); // Load client library
  }
}

/**
* Handle API load error
*/
function apiLoadErr() {
  hideLoading();
  document.querySelectorAll("pre h4").forEach(node=>node.remove());
  appendPre("Det virker som om det er noe galt. Hvis du er på skole-PC kan du prøve å bruke mobilen eller en annen PC i stedet.", true);
}

/**
* Load Google Drive API library.
*/
function loadGDriveApi() {
  appendPre("Laster inn viktige filer");
  gapi.client.load("drive", "v2", findFile);
}

/**
* Find the right file.
*/
function findFile() {
  appendPre("Finner regnearket");
  gapi.client.drive.files.list({
    "q": "fullText contains '"+VERSION.key+"'"
  }).execute(resp=>{
    if (!resp.error) {
      trashIncompatibles();
      sheetId = getID(resp.items);
      if (sheetId) {
        loadSheetsApi(fetchAndOutputData, sheetId, false);
        setEventListeners(sheetId);
      }
    } else if (resp.error.code == 401) {
      checkAuth(); // Access token might have expired.
    } else {
      appendPre("En feil oppsto: " + resp.error.message, true);
    }
  });
}

/**
* Find ID of the right file or create a file if none exist and return ID
*
* @param {array} items Array of documents in user's Drive that match the search query
*/
function getID(items) {
  for (let i = 0; i < items.length; i++) { // Loop through items and search for match
    if (items[i].mimeType == "application/vnd.google-apps.spreadsheet" && !items[i].labels.trashed) {
      return items[i].id; // Return ID of matching spreadsheet
    }
  }
  appendPre("Oppretter regneark"); // Create new file if no matches were found
  copyFile();
}

/**
* Load Sheets API client library.
*
* @param {function()} callback Function to execute after loading API.
*/
function loadSheetsApi(callback, ...args) {
  appendPre("Laster inn flere viktige filer");
  gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4").then(response=>{
    args.length ? callback(...args) : callback(response);
  });
}

/**
* Fetch and print the data
*/
function fetchAndOutputData(sheetId, autoShowForm) {
  appendPre("Laster inn plusstimer");
  if (typeof sheetId === "string") { // Validate the sheetId parameter
    gapi.client.sheets.spreadsheets.values.get({  // Get the range of cells from the spreadsheet
      spreadsheetId: sheetId,
      range: VERSION.range
    }).then(response=>{  // Handle successful response
      appendPre("Lasting fullført.");
      let range = response.result;
      if (range.values.length > 0) { // Validate response and print result
        days = range.values[VERSION.days[0]][VERSION.days[1]];
        hours = range.values[VERSION.hours[0]][VERSION.hours[1]];
        appendPre(range.values[VERSION.plusstimer[0]][VERSION.plusstimer[1]] + "plusstimer");
        q("#result>.number").innerHTML = Number(range.values[0][3]);
        q("#result-wrapper").style.display = "flex";
        q("#caption>a").innerText = "Jeg har ikke "+days+" dager og "+hours+" timer fravær. Oppdater";
        q("pre").style.display = "none";
        q("form")[0].value = days;
        q("form")[1].value = hours;
        q("form")[2].value = range.values[VERSION.extra[0]][VERSION.extra[1]];
        q("#doc-link").href = "https://docs.google.com/spreadsheets/d/"+sheetId;
      } else { // Handle unsuccessful validation of response
        appendPre("Fant ingen data.", true);
      }
      if (autoShowForm) showUpdateForm();
    }, response=>{ // Handle erroneous response
      appendPre("Feil: " + response.result.error.message, true);
    });
  } else {  // Handle unsuccessful validation of the spreadsheetId variable (this should never happen, but the user should get an explanation if it does)
    appendPre("Something went wrong, refresh the page and try again", true);
  }
}

/**
* Copy a spreadsheet file because no existing file was found
*/
function copyFile() {
  gapi.client.drive.files.copy({
    "fileId": VERSION.template,
    "resource": {"title": VERSION.title}
  }).execute(resp=>{
    if (COMPATIBLE_VERSIONS.length) copyDataFromOldSheet(resp.id); // Check if any older, but compatible, versions of the current spreadsheet exists
    loadSheetsApi(()=>fetchAndOutputData(resp.id, COMPATIBLE_VERSIONS.length > 0));
    setEventListeners(resp.id);
  });
}

/**
* Get data from old compatible spreadsheet and insert it into the new one
*/
function copyDataFromOldSheet (newSheetId) {
  appendPre("Prøver å finne et gammelt regneark");
  gapi.client.drive.files.list({ // Query user's Drive
    "q": "fullText contains '"+COMPATIBLE_VERSIONS[0].key+"'"
  }).execute(resp=>{ // Handle response
    if (!resp.error) { // Stop if an error occurs, but just ignore it because it is not impotant
      let items = resp.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].mimeType == "application/vnd.google-apps.spreadsheet" && !items[i].labels.trashed) {
          appendPre("Fant et gammelt regneark");
          let oldSheetId = items[i].id;
          loadSheetsApi(()=>{ // Load sheets api
            gapi.client.sheets.spreadsheets.values.get({ // Get amount of days abscence
              spreadsheetId: oldSheetId,
              range: COMPATIBLE_VERSIONS[0].days,
            }).then(days_response=>{
              gapi.client.sheets.spreadsheets.values.get({ // Get amount of hours abscence
                spreadsheetId: oldSheetId,
                range: COMPATIBLE_VERSIONS[0].hours,
              }).then(hours_response=>{
                updateSheet(newSheetId, days_response.result.values[0][0], hours_response.result.values[0][0]); // Update the new sheet with the variables from the old sheet
                trashFile(oldSheetId); // Move the old file to the trash
              });
            });
          });
        }
      }
    }
  });
}

/**
 * Move a file to the trash.
 *
 * @param {String} fileId ID of the file to trash.
 */
function trashFile(fileId) {
  appendPre("Flytter gammelt regneark til papirkurven");
  gapi.client.drive.files.trash({"fileId": fileId}).execute(resp=>{
    if (resp.error) console.warn(resp.error, resp);
  });
}

/**
 * Move all outdated files to trash
 */
function trashIncompatibles() {
  for (let i = 0;i < INCOMPATIBLE_VERSIONS.length;i++) {
    gapi.client.drive.files.list({ // Query user's Drive
      "q": "fullText contains '"+INCOMPATIBLE_VERSIONS[i]+"'"
    }).execute(resp=>{
      for (let j = 0; j < resp.items.length; j++) {
        if (resp.items[j].mimeType == "application/vnd.google-apps.spreadsheet" && !resp.items[j].labels.trashed) trashFile(resp.items[j].id);
      }
    });
  }
}

/*
* Update spreadsheet
*
* @param {string|number} days Amount of days abscence
* @param {string|number} preset_hours Amount of hours abscence
* @param {string|number} extra Extra school hours worked
*/
function updateSheet(sheetId, days, hours, extra) {
  clearPre();
  q("form").style.display = "none";
  if (days && hours) {
    q("pre").style.display = "block";
    values = [];
    values[VERSION.days[0]] = [];
    values[VERSION.hours[0]] = [];
    values[VERSION.extra[0]] = [];
    values[VERSION.days[0]][VERSION.days[1]] = days;
    values[VERSION.hours[0]][VERSION.hours[1]] = hours;
    values[VERSION.extra[0]][VERSION.extra[1]] = extra;
    appendPre("Oppdaterer fravær");
    gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: VERSION.range,
      valueInputOption: "USER_ENTERED",
      values: values
    }).then(resp=>{
      fetchAndOutputData(sheetId, false);
    });
  } else {
    showUpdateForm();
  }
}

/**
 * Show the update form
 * @param {optional} hide  If present and truthy, the form will be hidden instead of shown
 * @param {object}   event Click event object
 */
function showUpdateForm(hide, event) {
  if (event) event.preventDefault();
  q("form").style.display = hide ? "none" : "block";
  q("#result-wrapper").style.display = hide ? "flex" : "none";
}

/**
 * Handle update form submission
 */
function setEventListeners(sheetId) {
  q("form").onsubmit = event=>{
    event.preventDefault();
    updateSheet(sheetId, q("form")[0].value, q("form")[1].value, q("form")[2].value);
  };
}

/**
* Append text to the pre element containing the given message.
* @param {string} message Text to be placed in pre element.
* @param {boolean} error Whether or not the message is an error
*/
function appendPre(message, error) {
  q("pre").innerHTML += "<h4"+(error ? " class=error" : "")+">"+message+"</h4>";
}

/**
 * Clears the pre element
 */
function clearPre() {
  q("pre").innerHTML = "";
  q("pre").style.paddingTop = "40px";
}
