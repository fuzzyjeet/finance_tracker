/**
 * YYYY-MM-DD in the phone's own time zone. Date.toISOString() gives the UTC date,
 * which in Europe is still "yesterday" for the first hour or two after midnight.
 */
export const localISODate = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
