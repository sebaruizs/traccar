import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import dayjs from 'dayjs';
import { isDeviceArchived } from '../common/util/archived';
import { reportedMatches } from '../common/util/reported';

export default (
  keyword,
  filter,
  filterSort,
  filterMap,
  showArchived,
  positions,
  setFilteredDevices,
  setFilteredPositions,
) => {
  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);

  useEffect(() => {
    const deviceGroups = (device) => {
      const groupIds = [];
      let { groupId } = device;
      while (groupId) {
        groupIds.push(groupId);
        groupId = groups[groupId]?.groupId || 0;
      }
      return groupIds;
    };

    // Ridder: los archivados (el equipo o alguno de sus grupos) se ocultan de la lista y del mapa.
    const visible = Object.values(devices).filter(
      (device) => showArchived || !isDeviceArchived(device, groups),
    );
    const visibleIds = new Set(visible.map((device) => device.id));

    // Ridder: al buscar por chapa, cliente o teléfono se incluyen también los archivados,
    // para poder encontrar un equipo aunque esté archivado (la fila lo marca con el ícono).
    const candidates = keyword
      ? Object.values(devices).filter((device) => {
          const lowerCaseKeyword = keyword.toLowerCase();
          return [device.name, device.uniqueId, device.phone, device.model, device.contact].some(
            (s) => s && s.toLowerCase().includes(lowerCaseKeyword),
          );
        })
      : visible;

    const filtered = candidates
      // Ridder: chips "Hoy" / "1 a 3 días" / "+5 días" según la última señal.
      .filter((device) => reportedMatches(device, filter.reported))
      .filter(
        (device) =>
          !filter.groups.length || deviceGroups(device).some((id) => filter.groups.includes(id)),
      )
      .filter(
        (device) =>
          !filter.geofences.length ||
          (positions[device.id]?.geofenceIds || []).some((id) => filter.geofences.includes(id)),
      );
    switch (filterSort) {
      case 'name':
        filtered.sort((device1, device2) => device1.name.localeCompare(device2.name));
        break;
      case 'lastUpdate':
        filtered.sort((device1, device2) => {
          const time1 = device1.lastUpdate ? dayjs(device1.lastUpdate).valueOf() : 0;
          const time2 = device2.lastUpdate ? dayjs(device2.lastUpdate).valueOf() : 0;
          return time2 - time1;
        });
        break;
      default:
        break;
    }
    setFilteredDevices(filtered);
    setFilteredPositions(
      filterMap
        ? filtered.map((device) => positions[device.id]).filter(Boolean)
        : Object.values(positions).filter((position) => visibleIds.has(position.deviceId)),
    );
  }, [
    keyword,
    filter,
    filterSort,
    filterMap,
    showArchived,
    groups,
    devices,
    positions,
    setFilteredDevices,
    setFilteredPositions,
  ]);
};
