const CLIENT_ID = "1068107389496-sapmb6nh9l85vccdke6ju2jsbv5ibs51.apps.googleusercontent.com"; // Client ID from https://console.developers.google.com
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets", "https://www.googleapis.com/auth/drive"]; // The nexessary API scopes
const MIME = "application/vnd.google-apps.spreadsheet";

const q = s=>document.querySelector(s); // Quickly select HTML elements using a CSS selector
const range = N=>Array(N).fill().map((_, i) => i);
const weekdays = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag"];

const COMPONENTS = ["#result-view", "form#update", "form#losetimer", "pre#output"];
const [ RESULT, UPDATE, LOSETIMER, OUTPUT ] = COMPONENTS;
const show = key=>COMPONENTS.forEach(id=>q(id).style.display = key === id ? "block" : "none");
const getActiveTabs = ()=>COMPONENTS.filter(id=>q(id).style.display === "block");

const VERSION = { // Info regarding the current version of the spreadsheet
  key: "tnjioe0fh34j9", // A unique identifier for the document
  title: "Plusstimer høst 2018", // The name the spreadsheet will get in the user's Drive
  template: "1xxb6kZ8qfcaK123nFBmwRFlq37ffipWKVyvXDpUdC3E", // The drive id for the template
  range: "Plusstimer!D7:G7", // The range where days, hours and plusstimer can be found (include name of sheet if more than one sheet in spreadsheet)
  days: [0,0], // The vertical and horizontal position of days in the range, respectively
  hours: [0,1], // The vertical and horizontal position of hours in the range, respectively
  extra: [0,2], // The vertical and horizontal position of extra hours in the range, respectively
  plusstimer: [0,3],  // The vertical and horizontal position of plusstimer in the range, respectively
  losetimer: "Plusstimer!L16:O20" // The range with information about løse studietimer
};

/**
* The point of this array is to copy values from an existing spreadsheet so that the user does not have to re-enter them.
* Each object in this array must have three properties:
*   {String} key        A string of random words only found in that spreadsheet
    {String} days       The cell that contains amount of days abscence
    {String} hours      The cell that contains amount of hours abscence
    {String} losetimer  (Optional) Range with information about løse studietimer
*/
const COMPATIBLE_VERSIONS = [{
  key: "Version sq33hhst18uu",
  days: "D7",
  hours: "E7"
}];

/**
 * Array of keywords in old and outdated spreadsheets created by this web app that should be trashed
 */
const INCOMPATIBLE_VERSIONS = ["Plusstimer 2017 høst Panda Bever", "Plusstimer 2017 høst Ulv Rotte", "Plusstimer 2018 vår gfxksll"];

/**
* Check if current user has authorized this application.
*/
function checkAuth() {
  const timeout = setTimeout(apiLoadErr, 3000);
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
  const qr = q("#loading");
  if (qr) qr.remove();
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
      const sheetId = getID(resp.items);
      if (sheetId) {
        loadSheetsApi(fetchAndOutputData, sheetId, false);
        setEventListener(sheetId);
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
  const match = items.find(item=>item.mimeType === MIME && !item.labels.trashed);
  if (match) return match.id;
  else appendPre("Oppretter regneark"), copyFile();
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
      const range = response.result;
      if (range.values.length > 0) { // Validate response and print result
        clearPre();
        if (getActiveTabs().length) show(RESULT);
        const [days, hours, extra, plusstimer] = ["days", "hours", "extra", "plusstimer"].map(key=>range.values[VERSION[key][0]][VERSION[key][1]]);
        q("#result>.number").innerHTML = plusstimer;
        q("#update")[0].value = days;
        q("#update")[1].value = hours;
        q("#update")[2].value = extra;
        q("#last-update").innerText = "";
        showExtraFormIf(extra > 0);
        displayLastEditDate(sheetId);
      } else { // Handle unsuccessful validation of response
        appendPre("Fant ingen data.", true);
      }
      if (autoShowForm) renderLosetimer();
    }, response=>{ // Handle erroneous response
      appendPre("Feil: " + response.result.error.message, true);
    });
  } else {  // Handle unsuccessful validation of the sheetId variable (this should never happen, but the user should get an explanation if it does)
    appendPre("Something went wrong, refresh the page and try again", true);
  }
}

function displayLastEditDate(sheetId) {
  gapi.client.drive.files.get({
    fileId: sheetId
  }).execute(resp=>{
    const dateStr = resp.modifiedDate;
    q("#last-update").innerText = `Sist oppdatert ${formatDate(dateStr)}.`;
  });
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
    loadSheetsApi(()=>fetchAndOutputData(resp.id, COMPATIBLE_VERSIONS.length === 0));
    setEventListener(resp.id);
  });
}

/**
* Get data from old compatible spreadsheet and insert it into the new one
*/
function copyDataFromOldSheet (newSheetId) {
  appendPre("Prøver å finne et gammelt regneark");
  gapi.client.drive.files.list({ // Query user's Drive
    "q": COMPATIBLE_VERSIONS.map(v=>`fullText contains "${v.key}"`).join(" or ")
  }).execute(resp=>{ // Handle response
    if (!resp.error) { // Stop if an error occurs, but just ignore it because it is not impotant
      const oldSheet = resp.items.find(item=>item.mimeType === MIME && !item.labels.trashed);
      if (oldSheet) {
        appendPre("Fant et gammelt regneark");
        loadSheetsApi(()=>{ // Load sheets api
          gapi.client.sheets.spreadsheets.values.get({ // Get amount of days abscence
            spreadsheetId: oldSheet.id,
            range: COMPATIBLE_VERSIONS[0].days,
          }).then(days_response=>{
            gapi.client.sheets.spreadsheets.values.get({ // Get amount of hours abscence
              spreadsheetId: oldSheet.id,
              range: COMPATIBLE_VERSIONS[0].hours,
            }).then(hours_response=>{
              updateSheet(newSheetId, days_response.result.values[0][0], hours_response.result.values[0][0]); // Update the new sheet with the variables from the old sheet
              renderLosetimer();
              trashFile(oldSheet.id); // Move the old file to the trash
            });
          });
        });
      } else renderLosetimer();
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
  INCOMPATIBLE_VERSIONS.forEach(version=>{
    gapi.client.drive.files.list({ // Query user's Drive
      "q": "fullText contains '"+version+"'"
    }).execute(resp=>resp.items.filter(item=>item.mimeType == MIME && !item.labels.trashed).map(item=>item.id).forEach(trashFile))
  });
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
    const values = [];
    ["days", "hours", "extra"].forEach(key=>values[VERSION[key][0]] = []);
    ["days", "hours", "extra"].forEach(key=>values[VERSION[key][0]][VERSION[key][1]] = eval(key));
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
    show(UPDATE);
  }
}

/**
 * Handle update form submission
 */
function setEventListener(sheetId) {
  q("form").onsubmit = event=>{
    event.preventDefault();
    const children = event.target.children;
    updateSheet(sheetId, ...["days", "hours", "extra"].map(key=>document.getElementsByName(key)[0].value));
  };
}

/**
* Append text to the pre element containing the given message.
* @param {string} message Text to be placed in pre element.
* @param {boolean} error Whether or not the message is an error
*/
function appendPre(message, error) {
  q("pre").innerHTML += `<h4 ${error ? `class="error"` : ``}>${message}</h4>`;
}

/**
 * Clears the pre element
 */
function clearPre() {
  q("pre").innerHTML = "";
  q("pre").style.paddingTop = "40px";
}

/**
 * If condition is true: shows the extra form, checks the "Yes" box and unchecks the "No" box.
 * Otherwise: the opposite happens.
 * @param  {boolean} Whether or not the extra form should be shown
 */
function showExtraFormIf(condition) {
  q("#extra-div").style.display = condition ? "block" : "none";
  [...document.getElementsByName("show_extra")].forEach((checkbox, i)=>checkbox.checked = i == condition);
}

/** Listen for changes in checkbox */
["click", "keyup"].forEach(e=>q("#extra-form").addEventListener(e, event=>{
  showExtraFormIf(q("#show-extra").checked);
}));

/**
 * Render form that allows user to set when their løse studietimer is
 * @param  {Array} data Multidimensional array with data from spreadsheet range
 */
function renderLosetimer(data) {
  show(LOSETIMER);
  const selectTemplate = dayData=>`<select>${["09:00", "09:45", "10:45", "11:30", "13:00", "13:45", "14:45", "15:30", "16:15"].map(time=>`
      <option value="${time}" ${dayData.slice(2).join`:` === time && "selected"}>${time}</option>
    `).join('')}</select>`;
  q("#losetimer").querySelector(".grid-3").innerHTML = data.map(dayData=>`
      <div>${dayData[0]}</div>
      <input name="amount" type="number" value="${dayData[1]}">
      ${selectTemplate(dayData)}
    `).join('');
};