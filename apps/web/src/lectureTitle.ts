const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

/** Default title for a new lecture: its local date, e.g. "Lecture · 16 Oct 2026". */
export const defaultLectureTitle = (date: Date): string => `Lecture · ${DATE_FORMAT.format(date)}`
