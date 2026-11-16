import dayjs from 'dayjs';

// Ridder: tramos según la última señal del equipo (lastUpdate), para los chips de la lista.
// - today: reportó hoy.
// - threeDays: no reportó hoy, pero sí en los últimos 3 días.
// - overFive: hace más de 5 días que no reporta (o nunca reportó).
export const REPORTED_BUCKETS = ['all', 'today', 'threeDays', 'overFive'];

export const reportedMatches = (device, bucket, now = dayjs()) => {
  if (!bucket || bucket === 'all') {
    return true;
  }
  const last = device.lastUpdate ? dayjs(device.lastUpdate) : null;
  switch (bucket) {
    case 'today':
      return Boolean(last) && last.isSame(now, 'day');
    case 'threeDays':
      return Boolean(last) && !last.isSame(now, 'day') && last.isAfter(now.subtract(3, 'day'));
    case 'overFive':
      return !last || last.isBefore(now.subtract(5, 'day'));
    default:
      return true;
  }
};
