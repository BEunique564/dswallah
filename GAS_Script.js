// ============================================================
// DSWallah — Google Apps Script Backend
// Copy karo: script.google.com → New Project → Paste → Deploy
// ============================================================

const SHEET_NAME   = 'Enrollments';
const ADMIN_EMAIL  = 'your-admin@gmail.com'; // <-- APNA EMAIL DAALO

// ── Columns in Sheet ────────────────────────────────────────
// A: timestamp | B: name | C: email | D: course
// E: upiRef   | F: screenshotUrl | G: status | H: ebookAccess

function doGet(e) {
  return handleRequest(e);
}
function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const p      = e.parameter || {};
  const action = p.action || '';
  const cb     = p.callback || 'cb';

  let result;
  try {
    switch (action) {
      case 'enroll':    result = enroll(p);          break;
      case 'getPlans':  result = getPlans(p.email);  break;
      case 'getAll':    result = getAll(p);          break;
      case 'updateStatus': result = updateStatus(p); break;
      default: result = { success: false, msg: 'Unknown action' };
    }
  } catch(err) {
    result = { success: false, msg: err.toString() };
  }

  const json = JSON.stringify(result);
  return ContentService
    .createTextOutput(cb + '(' + json + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ── ENROLL ────────────────────────────────────────────────────
function enroll(p) {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  let   sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['Timestamp','Name','Email','Course','UPI Ref','Screenshot URL','Status','Ebook Access']);
  }

  // Duplicate check
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === p.email && data[i][3] === p.course && data[i][6] === 'Pending') {
      return { success: false, msg: 'Tumhari request already pending hai.' };
    }
  }

  sheet.appendRow([
    new Date(),
    p.name        || '',
    p.email       || '',
    p.course      || '',
    p.upiRef      || '',
    p.screenshotUrl || '',
    'Pending',
    'No'
  ]);

  // Admin ko email
  try {
    MailApp.sendEmail(
      ADMIN_EMAIL,
      '📩 New Enrollment: ' + (p.name||p.email),
      'Name: '    + (p.name||'') + '\n' +
      'Email: '   + (p.email||'') + '\n' +
      'Course: '  + (p.course||'') + '\n' +
      'UPI Ref: ' + (p.upiRef||'') + '\n' +
      'Screenshot: ' + (p.screenshotUrl||'N/A')
    );
  } catch(_) {}

  return { success: true, msg: 'Enrollment request submit ho gayi! Admin approval ka wait karo.' };
}

// ── GET PLANS (Ebook access check) ───────────────────────────
function getPlans(email) {
  if (!email) return { success: false, plans: [] };
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: false, plans: [] };

  const data   = sheet.getDataRange().getValues();
  const plans  = [];
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === email && data[i][7] === 'Yes') {
      plans.push({ course: data[i][3], status: data[i][6] });
    }
  }
  return { success: plans.length > 0, plans };
}

// ── GET ALL (Admin panel) ─────────────────────────────────────
function getAll(p) {
  // Simple admin key check
  if (p.adminKey !== 'dsw2024admin') return { success: false, msg: 'Unauthorized' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) return { success: true, rows: [] };

  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    rows.push({
      row:         i + 1,
      timestamp:   data[i][0] ? new Date(data[i][0]).toLocaleString('en-IN') : '',
      name:        data[i][1],
      email:       data[i][2],
      course:      data[i][3],
      upiRef:      data[i][4],
      screenshot:  data[i][5],
      status:      data[i][6],
      ebookAccess: data[i][7]
    });
  }
  return { success: true, rows };
}

// ── UPDATE STATUS (Admin approve/reject) ──────────────────────
function updateStatus(p) {
  if (p.adminKey !== 'dsw2024admin') return { success: false, msg: 'Unauthorized' };

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  const row   = parseInt(p.row);
  if (!sheet || isNaN(row)) return { success: false, msg: 'Invalid row' };

  const newStatus = p.status;   // 'Approved' / 'Rejected'
  const ebookOk   = (newStatus === 'Approved' && p.giveEbook === 'true') ? 'Yes' : 'No';

  sheet.getRange(row, 7).setValue(newStatus);
  sheet.getRange(row, 8).setValue(ebookOk);

  // Student ko email
  try {
    const email = sheet.getRange(row, 3).getValue();
    const name  = sheet.getRange(row, 2).getValue();
    if (email) {
      if (newStatus === 'Approved') {
        MailApp.sendEmail(email,
          '✅ DSWallah — Enrollment Approved!',
          'Hi ' + (name||'Student') + ',\n\n' +
          'Tumhari enrollment approve ho gayi hai!' +
          (ebookOk === 'Yes' ? '\nTumhe eBook access bhi mil gayi hai. Login karo: https://dswallah.com/Ebook.html' : '') +
          '\n\nTeam DSWallah'
        );
      } else {
        MailApp.sendEmail(email,
          '❌ DSWallah — Enrollment Rejected',
          'Hi ' + (name||'Student') + ',\n\n' +
          'Tumhari enrollment request reject ho gayi. Koi issue ho to contact karo.\n\nTeam DSWallah'
        );
      }
    }
  } catch(_) {}

  return { success: true, msg: 'Status updated: ' + newStatus };
}
