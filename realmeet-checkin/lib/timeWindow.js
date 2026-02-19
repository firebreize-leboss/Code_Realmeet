/**
 * Vérifie si le check-in est dans la fenêtre autorisée.
 * Fenêtre : slot_time - 30min → slot_time + 2h
 * Les slots sont en heure Europe/Paris.
 */
function isWithinCheckinWindow(slotDate, slotTime, slotDuration) {
  const slotStr = `${slotDate}T${slotTime}`;
  const offset = getParisTZOffset(new Date());
  const slotUtc = new Date(slotStr + offset);
  const now = new Date();

  const windowStart = new Date(slotUtc.getTime() - 30 * 60_000);
  const windowEnd   = new Date(slotUtc.getTime() + 2 * 3600_000);

  return {
    allowed: now >= windowStart && now <= windowEnd,
    windowStart,
    windowEnd,
    slotTime: slotUtc,
    slotDateStr: slotDate,
    slotTimeStr: slotTime
  };
}

function getCheckinTokenExpiry(slotDate, slotTime) {
  const slotStr = `${slotDate}T${slotTime}`;
  const offset = getParisTZOffset(new Date());
  const slotUtc = new Date(slotStr + offset);
  return new Date(slotUtc.getTime() + 2 * 3600_000);
}

function getParisTZOffset(date) {
  const year = date.getUTCFullYear();
  const marchLast = new Date(Date.UTC(year, 2, 31));
  const octLast = new Date(Date.UTC(year, 9, 31));
  const dstStart = new Date(marchLast.getTime() - (marchLast.getUTCDay() * 86400_000));
  const dstEnd = new Date(octLast.getTime() - (octLast.getUTCDay() * 86400_000));
  return (date >= dstStart && date < dstEnd) ? '+02:00' : '+01:00';
}

module.exports = { isWithinCheckinWindow, getCheckinTokenExpiry };