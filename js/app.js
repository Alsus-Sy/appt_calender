const form = document.getElementById("appointmentForm");
const dateInput = document.getElementById("appointmentDate");
const timeInput = document.getElementById("appointmentTime");
const result = document.getElementById("result");
const savedAppointment = document.getElementById("savedAppointment");
const showAppointmentButton = document.getElementById("showAppointmentButton");
const calendarSection = document.querySelector(".calendar-section");
const upcomingAppointments = document.getElementById("upcomingAppointments");
const previousMonthButton = document.getElementById("previousMonthButton");
const nextMonthButton = document.getElementById("nextMonthButton");
const calendarMonthLabel = document.getElementById("calendarMonthLabel");
const calendarGrid = document.getElementById("calendarGrid");
const dayDetails = document.getElementById("dayDetails");
const LEGACY_DATE_KEY = "appointmentDate";
const LEGACY_TIME_KEY = "appointmentTime";
const storageScope = window.location.hostname + window.location.pathname.replace(/index\.html$/i, "").replace(/\/+$/, "");
const storageNamespace = "appt-calendar::" + storageScope;
const SCOPED_SINGLE_DATE_KEY = storageNamespace + "::date";
const SCOPED_SINGLE_TIME_KEY = storageNamespace + "::time";
const STORAGE_APPOINTMENTS_KEY = storageNamespace + "::appointments";

const today = new Date().toISOString().split("T")[0];
const monthNames = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

dateInput.min = today;
let appointments = [];
let selectedDate = today;
let isUpcomingVisible = false;
const calendarCursor = new Date(today + "T00:00:00");
calendarCursor.setDate(1);

function isValidDateString(dateValue) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateValue);
}

function isValidTimeString(timeValue) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(timeValue);
}

function formatTime12Hour(timeValue) {
  if (!isValidTimeString(timeValue)) {
    return timeValue;
  }

  const parts = timeValue.split(":");
  let hour = Number(parts[0]);
  const minute = parts[1];
  const period = hour >= 12 ? "PM" : "AM";
  hour = hour % 12;

  if (hour === 0) {
    hour = 12;
  }

  return hour + ":" + minute + " " + period;
}

function formatReadableDate(dateValue) {
  const dateObject = new Date(dateValue + "T00:00:00");
  return dateObject.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function toDateTimeValue(appointment) {
  return new Date(appointment.date + "T" + appointment.time + ":00");
}

function sortAppointmentsByDateTime(items) {
  items.sort(function (left, right) {
    return toDateTimeValue(left).getTime() - toDateTimeValue(right).getTime();
  });
}

function sanitizeAppointments(items) {
  const validAppointments = [];
  const seen = new Set();

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];

    if (!item || typeof item !== "object") {
      continue;
    }

    if (!isValidDateString(item.date) || !isValidTimeString(item.time)) {
      continue;
    }

    const uniqueKey = item.date + "|" + item.time;

    if (seen.has(uniqueKey)) {
      continue;
    }

    seen.add(uniqueKey);
    validAppointments.push({
      date: item.date,
      time: item.time
    });
  }

  sortAppointmentsByDateTime(validAppointments);
  return validAppointments;
}

function loadAppointmentsFromStorage() {
  const rawValue = localStorage.getItem(STORAGE_APPOINTMENTS_KEY);

  if (!rawValue) {
    return [];
  }

  let parsedValue;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch (error) {
    if (error instanceof SyntaxError) {
      localStorage.removeItem(STORAGE_APPOINTMENTS_KEY);
      result.textContent = "Saved appointment data was invalid and has been reset.";
      return [];
    }

    throw error;
  }

  if (!Array.isArray(parsedValue)) {
    localStorage.removeItem(STORAGE_APPOINTMENTS_KEY);
    result.textContent = "Saved appointment data was invalid and has been reset.";
    return [];
  }

  return sanitizeAppointments(parsedValue);
}

function saveAppointmentsToStorage() {
  localStorage.setItem(STORAGE_APPOINTMENTS_KEY, JSON.stringify(appointments));
}

function migrateSingleAppointmentKeys() {
  const candidates = [
    {
      date: localStorage.getItem(SCOPED_SINGLE_DATE_KEY),
      time: localStorage.getItem(SCOPED_SINGLE_TIME_KEY)
    },
    {
      date: localStorage.getItem(LEGACY_DATE_KEY),
      time: localStorage.getItem(LEGACY_TIME_KEY)
    }
  ];
  let hasChanges = false;

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    if (!candidate.date || !candidate.time) {
      continue;
    }

    if (!isValidDateString(candidate.date) || !isValidTimeString(candidate.time)) {
      continue;
    }

    const alreadyExists = appointments.some(function (appointment) {
      return appointment.date === candidate.date && appointment.time === candidate.time;
    });

    if (alreadyExists) {
      continue;
    }

    appointments.push({
      date: candidate.date,
      time: candidate.time
    });
    hasChanges = true;
  }

  if (hasChanges) {
    sortAppointmentsByDateTime(appointments);
    saveAppointmentsToStorage();
  }
}

function getAppointmentsForDate(dateValue) {
  return appointments.filter(function (appointment) {
    return appointment.date === dateValue;
  });
}

function getCurrentOrFutureAppointments() {
  const now = new Date();

  return appointments.filter(function (appointment) {
    return toDateTimeValue(appointment).getTime() >= now.getTime();
  });
}

function updateSavedAppointmentText() {
  savedAppointment.textContent = "";
}

function renderUpcomingAppointments() {
  upcomingAppointments.innerHTML = "";
}

function renderDayDetails(dateValue) {
  const dailyAppointments = getAppointmentsForDate(dateValue);
  sortAppointmentsByDateTime(dailyAppointments);
  dayDetails.innerHTML = "";

  if (dailyAppointments.length === 0) {
    return;
  }

  const countText = dailyAppointments.length === 1 ? "1 appointment" : dailyAppointments.length + " appointments";
  const headerLine = document.createElement("span");
  headerLine.className = "day-details-line";
  headerLine.textContent = formatReadableDate(dateValue) + ": " + countText;
  dayDetails.appendChild(headerLine);

  dailyAppointments.forEach(function (appointment) {
    const timeLine = document.createElement("span");
    timeLine.className = "day-details-line";
    timeLine.textContent = formatTime12Hour(appointment.time);
    dayDetails.appendChild(timeLine);
  });
}

function toDateString(year, monthIndex, dayNumber) {
  const month = String(monthIndex + 1).padStart(2, "0");
  const day = String(dayNumber).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function renderCalendar() {
  const year = calendarCursor.getFullYear();
  const monthIndex = calendarCursor.getMonth();
  const firstWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  calendarMonthLabel.textContent = monthNames[monthIndex] + " " + year;
  calendarGrid.innerHTML = "";

  for (let emptyIndex = 0; emptyIndex < firstWeekday; emptyIndex += 1) {
    const emptyCell = document.createElement("div");
    emptyCell.className = "calendar-empty";
    calendarGrid.appendChild(emptyCell);
  }

  for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
    const dateValue = toDateString(year, monthIndex, dayNumber);
    const dailyAppointments = getAppointmentsForDate(dateValue);
    const dayButton = document.createElement("button");
    dayButton.type = "button";
    dayButton.className = "calendar-day";

    if (dailyAppointments.length > 0) {
      dayButton.classList.add("has-appointments");
    }

    if (dateValue === today) {
      dayButton.classList.add("today");
    }

    if (dateValue === selectedDate) {
      dayButton.classList.add("selected");
    }

    const dayNumberElement = document.createElement("span");
    dayNumberElement.className = "day-number";
    dayNumberElement.textContent = String(dayNumber);
    dayButton.appendChild(dayNumberElement);

    if (dailyAppointments.length > 0) {
      const dayCountElement = document.createElement("span");
      dayCountElement.className = "day-count";
      dayCountElement.textContent = String(dailyAppointments.length);
      dayButton.appendChild(dayCountElement);
    }

    dayButton.addEventListener("click", function () {
      selectedDate = dateValue;
      renderCalendar();
      renderDayDetails(selectedDate);
    });

    calendarGrid.appendChild(dayButton);
  }
}

function setUpcomingVisibility(isVisible) {
  isUpcomingVisible = isVisible;
  calendarSection.style.display = isUpcomingVisible ? "block" : "none";
  showAppointmentButton.textContent = isUpcomingVisible ? "Hide Calendar" : "Show Calendar";
}

function toggleUpcomingAppointments() {
  setUpcomingVisibility(!isUpcomingVisible);
}

function refreshViews() {
  updateSavedAppointmentText();
  renderCalendar();
  renderDayDetails(selectedDate);
}

form.addEventListener("submit", function (event) {
  event.preventDefault();

  if (!dateInput.value || !timeInput.value) {
    result.textContent = "Please select both a date and time.";
    return;
  }

  if (dateInput.value < today) {
    result.textContent = "Please choose today or a future date.";
    return;
  }

  const selectedDateTime = new Date(dateInput.value + "T" + timeInput.value + ":00");

  if (selectedDateTime.getTime() < Date.now()) {
    result.textContent = "Please choose a current or future time.";
    return;
  }

  const alreadyExists = appointments.some(function (appointment) {
    return appointment.date === dateInput.value && appointment.time === timeInput.value;
  });

  if (alreadyExists) {
    result.textContent = "This appointment is already saved.";
    return;
  }

  appointments.push({
    date: dateInput.value,
    time: timeInput.value
  });
  sortAppointmentsByDateTime(appointments);
  saveAppointmentsToStorage();
  localStorage.setItem(SCOPED_SINGLE_DATE_KEY, dateInput.value);
  localStorage.setItem(SCOPED_SINGLE_TIME_KEY, timeInput.value);

  selectedDate = dateInput.value;
  calendarCursor.setFullYear(Number(dateInput.value.slice(0, 4)), Number(dateInput.value.slice(5, 7)) - 1, 1);
  result.textContent = "Appointment added.";
  refreshViews();
});

showAppointmentButton.addEventListener("click", function () {
  toggleUpcomingAppointments();
});

previousMonthButton.addEventListener("click", function () {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar();
});

nextMonthButton.addEventListener("click", function () {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar();
});

appointments = loadAppointmentsFromStorage();
migrateSingleAppointmentKeys();

refreshViews();
setUpcomingVisibility(false);
