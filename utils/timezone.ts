/**
 * Construit un objet Date à partir d'une date et heure interprétées en heure de Paris (Europe/Paris).
 *
 * En France métropolitaine :
 *   - Heure d'hiver (CET)  : UTC+01:00 — du dernier dimanche d'octobre au dernier dimanche de mars
 *   - Heure d'été  (CEST) : UTC+02:00 — du dernier dimanche de mars au dernier dimanche d'octobre
 *
 * @param dateStr  Date au format "YYYY-MM-DD"
 * @param timeStr  Heure au format "HH:MM" (ou "HH:MM:SS")
 * @returns Un objet Date représentant l'instant correct en UTC
 */
export function getParisDate(dateStr: string, timeStr: string): Date {
  const time = timeStr.slice(0, 5); // garder HH:MM
  const offset = isParisInSummerTime(dateStr) ? '+02:00' : '+01:00';
  return new Date(`${dateStr}T${time}:00${offset}`);
}

/**
 * Détermine si une date donnée tombe pendant l'heure d'été à Paris.
 * L'heure d'été commence le dernier dimanche de mars à 02:00 CET (→ 03:00 CEST)
 * et se termine le dernier dimanche d'octobre à 03:00 CEST (→ 02:00 CET).
 */
function isParisInSummerTime(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);

  // Trouver le dernier dimanche de mars
  const lastSundayMarch = getLastSundayOfMonth(year, 3);
  // Trouver le dernier dimanche d'octobre
  const lastSundayOctober = getLastSundayOfMonth(year, 10);

  // Avant mars → hiver
  if (month < 3) return false;
  // Après octobre → hiver
  if (month > 10) return false;

  // En mars : été seulement à partir du dernier dimanche (inclus, la bascule est à 2h du matin)
  if (month === 3) return day >= lastSundayMarch;
  // En octobre : été seulement avant le dernier dimanche (la bascule est à 3h du matin)
  if (month === 10) return day < lastSundayOctober;

  // Avril à septembre → toujours été
  return true;
}

/** Retourne le jour (1-31) du dernier dimanche d'un mois donné. */
function getLastSundayOfMonth(year: number, month: number): number {
  // Dernier jour du mois
  const lastDay = new Date(year, month, 0).getDate();
  const lastDayOfWeek = new Date(year, month - 1, lastDay).getDay(); // 0=dimanche
  return lastDay - lastDayOfWeek;
}
