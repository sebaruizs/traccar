// Ridder: un equipo está archivado si lo está él (atributo ridder.archived) o alguno de sus grupos,
// incluidos los grupos padre. Archivar un grupo oculta sus equipos sin modificarlos uno por uno.
export const isGroupArchived = (groups, groupId) => {
  const visited = new Set();
  let id = groupId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const group = groups[id];
    if (group?.attributes?.['ridder.archived']) {
      return true;
    }
    id = group?.groupId || 0;
  }
  return false;
};

export const isDeviceArchived = (device, groups) =>
  Boolean(device?.attributes?.['ridder.archived']) || isGroupArchived(groups, device?.groupId);
