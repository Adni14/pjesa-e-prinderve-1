const SUPABASE_URL = '';
const SUPABASE_ANON_KEY = '';
const PARENT_ACCESS_ENDPOINT = '/functions/v1/parent-access';
const STORAGE_KEY = 'ditari-online-students';
const TEST_DATES_KEY = 'ditari-online-test-dates';
const monthNamesSq = [
  'janar', 'shkurt', 'mars', 'prill', 'maj', 'qershor',
  'korrik', 'gusht', 'shtator', 'tetor', 'nëntor', 'dhjetor'
];
const weekdayNamesSq = [
  'e diel', 'e hënë', 'e martë', 'e mërkurë', 'e enjte', 'e premte', 'e shtunë'
];

const lookupForm = document.getElementById('lookupForm');
const codeInput = document.getElementById('parentCode');
const lookupButton = document.getElementById('lookupButton');
const lookupMessage = document.getElementById('lookupMessage');
const studentRecord = document.getElementById('studentRecord');
const changeCodeButton = document.getElementById('changeCodeButton');
const parentCalendarMonth = document.getElementById('parentCalendarMonth');
const parentCalendarDays = document.getElementById('parentCalendarDays');
const parentCalendarMessage = document.getElementById('parentCalendarMessage');
const parentUpcomingTestList = document.getElementById('parentUpcomingTestList');
let displayedTestMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
let displayedStudentClass = '';
const remarkLabels = {
  Excellent: 'Shkëlqyeshëm',
  Good: 'Mirë',
  Satisfactory: 'Kënaqshëm',
  'Needs improvement': 'Nevojitet përmirësim',
  'Late submissions': 'Dorëzime me vonesë',
  'Excellent participation': 'Pjesëmarrje e shkëlqyeshme'
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day;
}

function formatTestDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return `${weekdayNamesSq[date.getDay()]}, ${day} ${monthNamesSq[month - 1]} ${year}`;
}

function getParentTestDates(className) {
  const storedTests = localStorage.getItem(TEST_DATES_KEY);
  if (!storedTests) {
    return [];
  }

  const tests = JSON.parse(storedTests);
  if (!Array.isArray(tests)) {
    throw new Error('Të dhënat e testeve nuk janë në formatin e duhur.');
  }

  return tests.filter((test) => {
    if (
      !test ||
      typeof test.id !== 'string' ||
      !isValidDateKey(test.date) ||
      typeof test.className !== 'string' ||
      typeof test.subject !== 'string' ||
      typeof test.details !== 'string'
    ) {
      throw new Error('Të dhënat e ruajtura të testeve nuk janë të vlefshme.');
    }
    return test.className === className;
  });
}

function renderParentTestCalendar() {
  const year = displayedTestMonth.getFullYear();
  const month = displayedTestMonth.getMonth();
  const tests = getParentTestDates(displayedStudentClass);
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cellCount = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7;
  const todayKey = dateKey(new Date());
  const monthName = monthNamesSq[month];

  parentCalendarMessage.textContent = '';
  parentCalendarMonth.textContent =
    `${monthName[0].toLocaleUpperCase('sq-AL')}${monthName.slice(1)} ${year}`;
  parentCalendarDays.innerHTML = Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstDayOffset + 1;
    if (day < 1 || day > daysInMonth) {
      return '<div class="calendar-day calendar-day-empty" aria-hidden="true"></div>';
    }

    const value = dateKey(new Date(year, month, day));
    const dayTests = tests.filter((test) => test.date === value);
    const visibleTests = dayTests.slice(0, 2);
    return `
      <div class="calendar-day${value === todayKey ? ' is-today' : ''}">
        <span class="calendar-day-number">${day}</span>
        ${visibleTests.map((test) => `
          <span class="calendar-event" title="${escapeHtml(test.subject)}">
            ${escapeHtml(test.subject)}
          </span>
        `).join('')}
        ${dayTests.length > visibleTests.length
          ? `<span class="calendar-more">+${dayTests.length - visibleTests.length} të tjera</span>`
          : ''}
      </div>
    `;
  }).join('');

  const todayKeyForList = dateKey(new Date());
  const upcomingTests = tests
    .filter((test) => test.date >= todayKeyForList)
    .sort((first, second) =>
      first.date.localeCompare(second.date) || first.subject.localeCompare(second.subject)
    );
  parentUpcomingTestList.innerHTML = upcomingTests.length
    ? upcomingTests.map((test) => `
        <article class="test-event">
          <div>
            <time datetime="${escapeHtml(test.date)}">${escapeHtml(formatTestDate(test.date))}</time>
            <h4>${escapeHtml(test.subject)}</h4>
            ${test.details ? `<p>${escapeHtml(test.details)}</p>` : ''}
          </div>
        </article>
      `).join('')
    : '<p class="empty-state">Nuk ka data të ardhshme testesh për klasën e nxënësit.</p>';
}

function setMessage(message, type) {
  lookupMessage.textContent = message;
  lookupMessage.dataset.type = type || '';
}

function getStudentFromResponse(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Përgjigjja nga shërbimi nuk është e vlefshme.');
  }

  const candidate = payload.student && typeof payload.student === 'object'
    ? payload.student
    : payload;
  const record = candidate.record && typeof candidate.record === 'object'
    ? { ...candidate.record, className: candidate.class_name || candidate.record.className }
    : candidate;

  if (typeof record.name !== 'string' || !record.name.trim()) {
    throw new Error('Në përgjigje mungon emri i nxënësit.');
  }
  if (typeof record.className !== 'string' || !record.className.trim()) {
    throw new Error('Në përgjigje mungon klasa e nxënësit.');
  }
  if (!Array.isArray(record.subjects)) {
    throw new Error('Në përgjigje mungojnë notat sipas lëndëve.');
  }
  if (!Number.isFinite(Number(record.absenceCount)) || Number(record.absenceCount) < 0) {
    throw new Error('Numri i mungesave në përgjigje nuk është i vlefshëm.');
  }
  if (record.remark !== undefined && typeof record.remark !== 'string') {
    throw new Error('Vlerësimi i mësuesit në përgjigje nuk është i vlefshëm.');
  }
  if (record.teacherNote !== undefined && typeof record.teacherNote !== 'string') {
    throw new Error('Shënimi i mësuesit në përgjigje nuk është i vlefshëm.');
  }

  const subjects = record.subjects.map((subject) => {
    if (!subject || typeof subject.name !== 'string' || !subject.name.trim()) {
      throw new Error('Një lëndë në përgjigje nuk është e vlefshme.');
    }
    const grade = subject.grade === null || subject.grade === '' ? null : Number(subject.grade);
    if (grade !== null && (!Number.isFinite(grade) || grade < 1 || grade > 5)) {
      throw new Error('Një notë në përgjigje nuk është e vlefshme.');
    }
    return { name: subject.name, grade };
  });

  return {
    name: record.name.trim(),
    className: record.className.trim(),
    absenceCount: Number(record.absenceCount),
    remark: record.remark || '',
    teacherNote: record.teacherNote || '',
    subjects
  };
}

function renderStudent(student) {
  document.getElementById('studentName').textContent = student.name;
  document.getElementById('studentClass').textContent = `Klasa ${student.className}`;
  document.getElementById('absenceCount').textContent = String(student.absenceCount);
  document.getElementById('teacherRemark').textContent =
    remarkLabels[student.remark] || student.remark || 'Pa vlerësim';

  const gradesBody = document.getElementById('gradesBody');
  if (student.subjects.length === 0) {
    gradesBody.innerHTML = '<tr><td colspan="2">Nuk ka ende nota të regjistruara.</td></tr>';
  } else {
    gradesBody.innerHTML = student.subjects.map((subject) => `
      <tr>
        <th scope="row">${escapeHtml(subject.name)}</th>
        <td>${subject.grade === null ? '—' : escapeHtml(subject.grade)}</td>
      </tr>
    `).join('');
  }

  const noteSection = document.getElementById('teacherNoteSection');
  const note = document.getElementById('teacherNote');
  note.textContent = student.teacherNote;
  noteSection.hidden = !student.teacherNote.trim();
  displayedStudentClass = student.className;
  displayedTestMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  try {
    renderParentTestCalendar();
  } catch (error) {
    console.error('Leximi i kalendarit të testeve dështoi:', error);
    parentCalendarMonth.textContent = '';
    parentCalendarDays.innerHTML = '';
    parentUpcomingTestList.innerHTML = '';
    parentCalendarMessage.textContent = `Kalendari i testeve nuk mund të shfaqet: ${error.message}`;
    parentCalendarMessage.dataset.type = 'error';
  }
  studentRecord.hidden = false;
}

function getEndpoint() {
  if (!SUPABASE_URL.trim() || !SUPABASE_ANON_KEY.trim()) {
    return null;
  }
  let projectUrl;
  try {
    projectUrl = new URL(SUPABASE_URL);
  } catch {
    throw new Error('URL-ja e projektit Supabase nuk është e vlefshme.');
  }
  if (projectUrl.protocol !== 'https:') {
    throw new Error('URL-ja e projektit Supabase duhet të përdorë HTTPS.');
  }
  return `${projectUrl.origin}${PARENT_ACCESS_ENDPOINT}`;
}

function getLocalStudentByCode(parentCode) {
  const rawStudents = localStorage.getItem(STORAGE_KEY);
  if (!rawStudents) {
    return null;
  }

  try {
    const students = JSON.parse(rawStudents);
    if (!Array.isArray(students)) {
      return null;
    }

    return students.find((student) => {
      if (!student || typeof student !== 'object') {
        return false;
      }
      const storedCode = typeof student.parentCode === 'string'
        ? student.parentCode.trim().toUpperCase()
        : '';
      return storedCode === parentCode;
    }) || null;
  } catch (error) {
    console.error('Leximi i të dhënave lokale për prindërit dështoi:', error);
    return null;
  }
}

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  studentRecord.hidden = true;

  const parentCode = codeInput.value.trim().toUpperCase();
  if (!parentCode) {
    setMessage('Shkruani kodin e hyrjes që ju dha mësuesi.', 'error');
    codeInput.focus();
    return;
  }

  lookupButton.disabled = true;
  lookupButton.textContent = 'Duke kërkuar…';
  setMessage('Po kërkohen të dhënat e nxënësit…', 'loading');

  try {
    const endpoint = getEndpoint();
    if (!endpoint) {
      const localStudent = getLocalStudentByCode(parentCode);
      if (!localStudent) {
        setMessage('Kodi nuk u gjet. Kontrolloni kodin dhe provoni përsëri.', 'error');
        return;
      }
      renderStudent(getStudentFromResponse(localStudent));
      setMessage('Të dhënat u gjetën.', 'success');
      return;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ parentCode })
    });

    if (response.status === 404 || response.status === 400) {
      const localStudent = getLocalStudentByCode(parentCode);
      if (localStudent) {
        renderStudent(getStudentFromResponse(localStudent));
        setMessage('Të dhënat u gjetën.', 'success');
        return;
      }
      setMessage('Kodi nuk u gjet. Kontrolloni kodin dhe provoni përsëri.', 'error');
      return;
    }
    if (response.status === 429) {
      setMessage('U bënë shumë prova. Prisni pak dhe provoni përsëri.', 'error');
      return;
    }
    if (!response.ok) {
      throw new Error(`Shërbimi nuk mundi t’i kërkojë të dhënat (gabimi ${response.status}).`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      throw new Error('Shërbimi ktheu një përgjigje të pavlefshme.');
    }

    renderStudent(getStudentFromResponse(payload));
    setMessage('Të dhënat u gjetën.', 'success');
  } catch (error) {
    console.error('Kërkimi i të dhënave të nxënësit dështoi:', error);
    const localStudent = getLocalStudentByCode(parentCode);
    if (localStudent) {
      renderStudent(getStudentFromResponse(localStudent));
      setMessage('Të dhënat u gjetën.', 'success');
      return;
    }
    setMessage(error instanceof TypeError
      ? 'Nuk u lidhëm me shërbimin. Kontrolloni internetin dhe konfigurimin.'
      : error.message, 'error');
  } finally {
    lookupButton.disabled = false;
    lookupButton.textContent = 'Shiko të dhënat';
  }
});

codeInput.addEventListener('input', () => {
  const start = codeInput.selectionStart;
  const end = codeInput.selectionEnd;
  codeInput.value = codeInput.value.toUpperCase();
  codeInput.setSelectionRange(start, end);
});

changeCodeButton.addEventListener('click', () => {
  studentRecord.hidden = true;
  codeInput.value = '';
  setMessage('Shkruani kodin e hyrjes që ju dha mësuesi.');
  codeInput.focus();
});

document.getElementById('parentPreviousMonth').addEventListener('click', () => {
  displayedTestMonth.setMonth(displayedTestMonth.getMonth() - 1);
  try {
    renderParentTestCalendar();
  } catch (error) {
    parentCalendarMessage.textContent = `Kalendari i testeve nuk mund të shfaqet: ${error.message}`;
    parentCalendarMessage.dataset.type = 'error';
  }
});

document.getElementById('parentNextMonth').addEventListener('click', () => {
  displayedTestMonth.setMonth(displayedTestMonth.getMonth() + 1);
  try {
    renderParentTestCalendar();
  } catch (error) {
    parentCalendarMessage.textContent = `Kalendari i testeve nuk mund të shfaqet: ${error.message}`;
    parentCalendarMessage.dataset.type = 'error';
  }
});