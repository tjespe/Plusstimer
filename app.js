let CLIENT_ID = "1068107389496-sapmb6nh9l85vccdke6ju2jsbv5ibs51.apps.googleusercontent.com"; // Client ID from https://console.developers.google.com
let SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]; // The nexessary API scopes
let spreadsheetId; // ID of the spreadsheet on the user's Drive

let q = s=>document.querySelector(s); // Quickly select HTML elements using a CSS selector

let version = { // Info regarding the current version of the spreadsheet
  key: "Versjon ll20s0gc", // A unique identifier for the document
  title: "Plusstimer vår 2018", // The name the spreadsheet will get in the user's Drive
  template: "18JNjXO_RUPuH4414LOKF0vzgqLVQomnF_LmXMjtKc2A", // The drive id for the template
  range: "Plusstimer!D7:G7", // The range where days, hours and plusstimer can be found (include name of sheet if more than one sheet in spreadsheet)
  days: [0,0], // The vertical and horizontal position of days in the range, respectively
  hours: [0,1], // The vertical and horizontal position of hours in the range, respectively
  extra: [0,2], // The vertical and horizontal position of extra hours in the range, respectively
  plusstimer: [0,3]  // The vertical and horizontal position of plusstimer in the range, respectively
};
let firstVisit = false; // Whether or not the user has visited this page earlier
let apiLoadSuccess = false, errorMessageShown = false;

/**
* The point of this array is to copy values from an existing spreadsheet so that the user does not have to re-enter them.
* Currently only one element is supported in this array but that will be fixed in the future.
*/
let compatible_versions = [{
  key: "Plusstimer 2018 vår gfxksll",         // A string of random words only found in that spreadsheet
  days: "Plusstimer!D7",                      // The cell that contains amount of days abscence
  hours: "Plusstimer!E7"                      // The cell that contains amount of hours abscence
}];

/**
 * The point of this array is to delete old and outdated spreadsheets created by this web app
 */
let incompatible_versions = ["Plusstimer 2017 høst Panda Bever", "Plusstimer 2017 høst Ulv Rotte"];

/**
* Check if current user has authorized this application.
*/
function checkAuth() {
  gapi.auth.authorize({
    "client_id": CLIENT_ID,
    "scope": SCOPES.join(" "),
    "immediate": true
  }, handleAuthResult);
  setTimeout(apiLoadErr, 3000);
}

/**
* Initiate auth flow in response to user clicking authorize button.
*/
function handleAuthClick() {
  gapi.auth.authorize(
    {client_id: CLIENT_ID, scope: SCOPES, immediate: false},
    handleAuthResult
  );
  appendPre("Autoriserer…");
}

/**
* Hide loading text
*/
function hideLoading() {
  apiLoadSuccess = true;
  if (el = document.querySelector("#loading")) el.remove();
}

/**
* Handle response from authorization server.
*
* @param {Object} authResult Authorization result.
*/
function handleAuthResult(authResult) {
  hideLoading();
  if (errorMessageShown) appendPre("Prank, det funka");
  let authDiv = document.getElementById("authorize-div");
  if (authResult && !authResult.error) {
    // Hide auth UI, then load client library.
    authDiv.style.display = "none";
    loadGDriveApi();
  } else {
    // Show auth UI, allowing the user to initiate authorization by clicking a button.
    authDiv.style.display = "block";
  }
}

/**
* Handle API load error
*/
function apiLoadErr() {
  if (!apiLoadSuccess) {
    errorMessageShown = true;
    hideLoading();
    appendPre("Det virker som om det er noe galt. Hvis du er på skole-PC kan du prøve å bruke mobilen eller en annen PC i stedet");  
  }
}

/**
* Load Google Drive API library.
*/
function loadGDriveApi() {
  appendPre("Laster inn viktige filer…");
  gapi.client.load("drive", "v2", findFile);
}

/**
* Find the right file.
*/
function findFile() {
  appendPre("Finner regnearket…");
  gapi.client.drive.files.list({
    "q": "fullText contains '"+version.key+"'"
  }).execute(resp=>{
    if (!resp.error) {
      trashIncompatibles();
      spreadsheetId = getID(resp.items);
      if (spreadsheetId) loadSheetsApi(fetchAndOutputData);
    } else if (resp.error.code == 401) {
      // Access token might have expired.
      checkAuth();
    } else {
      appendPre("En feil oppsto: " + resp.error.message);
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
  appendPre("Oppretter regneark…"); // Create new file if no matches were found
  copyFile();
}

/**
* Load Sheets API client library.
*
* @param {function()} callback Function to execute after loading API.
*/
function loadSheetsApi(callback) {
  appendPre("Laster inn flere viktige filer…");
  gapi.client.load("https://sheets.googleapis.com/$discovery/rest?version=v4").then(callback);
}

/**
* Fetch and print the data
*/
function fetchAndOutputData() {
  appendPre("Laster inn plusstimer…");
  if (typeof spreadsheetId === "string" && spreadsheetId.length > 5) { // Validate the spreadsheetId variable
    gapi.client.sheets.spreadsheets.values.get({  // Get the range of cells from the spreadsheet
      spreadsheetId: spreadsheetId,
      range: version.range
    }).then(response=>{  // Handle successful response
      appendPre("Lasting fullført.");
      let range = response.result;
      if (range.values.length > 0) { // Validate response and print result
        days = range.values[version.days[0]][version.days[1]];
        hours = range.values[version.hours[0]][version.hours[1]];
        appendPre(range.values[version.plusstimer[0]][version.plusstimer[1]] + "plusstimer");
        q("#result>.number").innerHTML = Number(range.values[0][3]);
        q("#result-wrapper").style.display = "flex";
        q("#caption>a").innerText = "Jeg har ikke "+days+" dager og "+hours+" timer fravær. Oppdater";
        q("pre").style.display = "none";
        q("form")[0].value = days;
        q("form")[1].value = hours;
        q("form")[2].value = range.values[version.extra[0]][version.extra[1]];
      } else { // Handle unsuccessful validation of response
        appendPre("Fant ingen data.");
      }
      if (firstVisit) showUpdateForm();
    }, response=>{ // Handle erroneous response
      appendPre("Feil: " + response.result.error.message);
    });
  } else {  // Handle unsuccessful validation of the spreadsheetId variable (this should never happen, but the user should get an explanation if it does)
    appendPre("Something went wrong, refresh the page and try again");
  }
}

/**
* Copy a spreadsheet file because no existing file was found
*/
function copyFile() {
  if (typeof compatible_versions !== "undefined" && compatible_versions.length) { // Check if any older, but compatible, versions of the current spreadsheet exists
    copyDataFromOldSheet();
  } else firstVisit = true;
  gapi.client.drive.files.copy({
    "fileId": version.template,
    "resource": {"title": version.title}
  }).execute(resp=>{
    spreadsheetId = resp.id;
    loadSheetsApi(fetchAndOutputData);
  });
}

/**
* Get data from old compatible spreadsheet and insert it into the new one
*/
function copyDataFromOldSheet () {
  appendPre("Prøver å finne et gammelt regneark…");
  gapi.client.drive.files.list({ // Query user's Drive
    "q": "fullText contains '"+compatible_versions[0].key+"'"
  }).execute(resp=>{ // Handle response
    if (!resp.error) { // Stop if an error occurs, but just ignore it because it is not impotant
      let items = resp.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].mimeType == "application/vnd.google-apps.spreadsheet" && !items[i].labels.trashed) {
          appendPre("Fant et gammelt regneark");
          firstVisit = false;
          let oldSheetId = items[i].id;
          loadSheetsApi(()=>{ // Load sheets api
            gapi.client.sheets.spreadsheets.values.get({ // Get amount of days abscence
              spreadsheetId: oldSheetId,
              range: compatible_versions[0].days,
            }).then(days_response=>{
              gapi.client.sheets.spreadsheets.values.get({ // Get amount of hours abscence
                spreadsheetId: oldSheetId,
                range: compatible_versions[0].hours,
              }).then(hours_response=>{
                updateSheet(days_response.result.values[0][0], hours_response.result.values[0][0]); // Update the new sheet with the variables from the old sheet
                trashFile(oldSheetId); // Move the old file to the trash
              });
            });
          });
        } else firstVisit = true;
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
  appendPre("Flytter gammelt regneark til papirkurven…");
  gapi.client.drive.files.trash({"fileId": fileId});
}

/**
 * Move all outdated files to trash
 * @return {[type]} [description]
 */
function trashIncompatibles() {
  for (let i = 0;i < incompatible_versions.length;i++) {
    gapi.client.drive.files.list({ // Query user's Drive
      "q": "fullText contains '"+incompatible_versions[i]+"'"
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
function updateSheet(days, hours, extra) {
  q("pre").innerHTML = "";
  q("form").style.display = "none";
  if (days && hours) {
    q("pre").style.display = "block";
    firstVisit = false;
    values = [];
    values[version.days[0]] = [];
    values[version.hours[0]] = [];
    values[version.extra[0]] = [];
    values[version.days[0]][version.days[1]] = days;
    values[version.hours[0]][version.hours[1]] = hours;
    values[version.extra[0]][version.extra[1]] = extra;
    appendPre("Oppdaterer fravær…");
    gapi.client.sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: version.range,
      valueInputOption: "USER_ENTERED",
      values: values
    }).then(resp=>{
      appendPre("Fravær er oppdatert, laster inn plusstimer på nytt…");
      fetchAndOutputData();
    });
  } else {
    showUpdateForm();
  }
}

/**
 * Show the update form
 * @param {object} event Click event object
 */
function showUpdateForm(event) {
  if (event) event.preventDefault();
  q("form").style.display = "block";
  q("#result-wrapper").style.display = "none";
}

/**
 * Handle update form submission
 */
document.addEventListener("DOMContentLoaded", ()=>{
  q("form").addEventListener("submit", event=>{
    event.preventDefault();
    updateSheet(q("form")[0].value, q("form")[1].value, q("form")[2].value);
  });
  q("#back").addEventListener("click", event=>{
    q("form").style.display = "none";
    q("#result-wrapper").style.display = "flex";
  });
});

/**
* Append text to the pre element containing the given message.
* @param {string} message Text to be placed in pre element.
*/
function appendPre(message) {
  q("pre").innerHTML += "<h4>"+message+"</h4>";
}
