const xlsx = require('xlsx');

/**
 * Parses learner data from DepEd School Form 2 (SF2) Excel file (.xls / .xlsx)
 * Such as "add learner.xls" or "excel format.xls" (specifically on sheet "MARCH")
 *
 * Extracts available student data (full_name and sex), ignoring attendance ticks,
 * as LRN/contact numbers are to be populated later.
 */
function parseLearnersFromExcel(bufferOrPath, options = {}) {
  let wb;
  if (typeof bufferOrPath === 'string') {
    wb = xlsx.readFile(bufferOrPath);
  } else {
    wb = xlsx.read(bufferOrPath, { type: 'buffer' });
  }

  const sheetNames = wb.SheetNames || [];
  if (!sheetNames.length) {
    throw new Error('The uploaded Excel file contains no worksheets.');
  }

  // Determine target sheet
  let chosenSheetName = options.sheetName;
  if (chosenSheetName && wb.Sheets[chosenSheetName]) {
    // Exact match found
  } else if (chosenSheetName) {
    // Case-insensitive match
    const found = sheetNames.find(s => s.trim().toLowerCase() === chosenSheetName.trim().toLowerCase());
    chosenSheetName = found || null;
  }

  if (!chosenSheetName) {
    // Prefer "MARCH" (as specified by user requirement)
    const marchSheet = sheetNames.find(s => s.trim().toUpperCase() === 'MARCH') ||
                       sheetNames.find(s => s.toLowerCase().includes('march'));
    if (marchSheet) {
      chosenSheetName = marchSheet;
    } else {
      // Fallback: look for other month sheets or first sheet
      const monthSheet = sheetNames.find(s => 
        /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)/i.test(s.trim())
      );
      chosenSheetName = monthSheet || sheetNames[0];
    }
  }

  const ws = wb.Sheets[chosenSheetName];
  if (!ws) {
    throw new Error(`Sheet "${chosenSheetName}" not found in Excel workbook.`);
  }

  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const learners = [];
  let currentSex = 'M'; // Male block comes first in DepEd SF2
  let foundMaleSection = false;
  let reachedEnd = false;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    if (!row || !row.length) continue;

    // Convert row contents to uppercase string for marker detection
    const rowString = row.map(c => String(c || '').trim()).join(' ').toUpperCase();

    // Check for DepEd section markers
    if (rowString.includes('MALE') && rowString.includes('TOTAL')) {
      currentSex = 'F'; // Transition from Male to Female learners
      foundMaleSection = true;
      continue;
    }

    if (rowString.includes('FEMALE') && rowString.includes('TOTAL')) {
      reachedEnd = true;
      break;
    }

    if (rowString.includes('COMBINED TOTAL') || rowString.includes('GUIDELINES:')) {
      reachedEnd = true;
      break;
    }

    // Skip header rows (typically rows 1-7 in DepEd SF2)
    if (rowIndex < 6 && (rowString.includes('SCHOOL FORM') || rowString.includes('SCHOOL ID') || rowString.includes('NAME'))) {
      continue;
    }

    // Learner Name is in Column C (index 2) in DepEd SF2 template.
    // If column C is empty, check Column B (index 1) or Column D (index 3).
    let rawName = null;
    if (row[2] && typeof row[2] === 'string' && row[2].trim()) {
      rawName = row[2];
    } else if (row[1] && typeof row[1] === 'string' && row[1].trim() && isNaN(Number(row[1]))) {
      rawName = row[1];
    } else if (row[3] && typeof row[3] === 'string' && row[3].trim()) {
      rawName = row[3];
    }

    if (!rawName) continue;

    let cleanName = String(rawName).trim();

    // Skip header text or instruction markers
    if (cleanName.startsWith('<===') || 
        cleanName.toUpperCase().includes('TOTAL PER DAY') ||
        cleanName.toUpperCase().includes('NAME (LAST NAME') ||
        cleanName.toUpperCase().includes('REGISTERED LEARNERS') ||
        cleanName.toUpperCase() === 'NAME') {
      continue;
    }

    // Basic validity: name should be at least 2 characters and not just numbers/symbols
    if (cleanName.length >= 2 && !/^[\d\s\-_.,/]+$/.test(cleanName)) {
      learners.push({
        full_name: cleanName,
        sex: currentSex,
        source_row: rowIndex + 1
      });
    }
  }

  // If standard SF2 markers were not found, check if it's a simple columnar table
  if (learners.length === 0 && rows.length > 1) {
    const headerRow = rows.find(r => r && r.some(c => typeof c === 'string' && /name|learner|student/i.test(c)));
    if (headerRow) {
      const nameColIdx = headerRow.findIndex(c => typeof c === 'string' && /name|learner|student/i.test(c));
      const sexColIdx = headerRow.findIndex(c => typeof c === 'string' && /sex|gender/i.test(c));
      const startIdx = rows.indexOf(headerRow) + 1;

      for (let i = startIdx; i < rows.length; i++) {
        const r = rows[i];
        if (!r) continue;
        const nameVal = r[nameColIdx] ? String(r[nameColIdx]).trim() : '';
        const sexVal = (sexColIdx >= 0 && r[sexColIdx]) ? String(r[sexColIdx]).trim().toUpperCase() : 'M';
        if (nameVal && nameVal.length >= 2) {
          learners.push({
            full_name: nameVal,
            sex: sexVal.startsWith('F') ? 'F' : 'M',
            source_row: i + 1
          });
        }
      }
    }
  }

  const maleCount = learners.filter(l => l.sex === 'M').length;
  const femaleCount = learners.filter(l => l.sex === 'F').length;

  return {
    sheetName: chosenSheetName,
    availableSheets: sheetNames,
    totalCount: learners.length,
    maleCount,
    femaleCount,
    learners
  };
}

module.exports = {
  parseLearnersFromExcel
};
