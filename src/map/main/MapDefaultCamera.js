import * as maplibregl from 'maplibre-gl';
import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { map } from '../core/MapView';
import { toMapCoordinates } from '../core/mapUtil';

const MapDefaultCamera = ({ filteredPositions }) => {
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);
  const positions = useSelector((state) => state.session.positions);

  // Una cuenta sin ubicación propia (0,0) usa la del servidor como ubicación por defecto.
  const defaultCamera = useSelector((state) => {
    const { user, server } = state.session;
    return user.latitude && user.longitude && !server.forceSettings ? user : server;
  });
  const defaultLatitude = defaultCamera.latitude;
  const defaultLongitude = defaultCamera.longitude;
  const defaultZoom = defaultCamera.zoom || 0;

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (selectedDeviceId) {
      const position = positions[selectedDeviceId];
      if (position) {
        map.jumpTo({
          center: toMapCoordinates(position.longitude, position.latitude),
          zoom: Math.max(defaultZoom > 0 ? defaultZoom : map.getZoom(), 10),
        });
        setInitialized(true);
      }
    } else {
      if (defaultLatitude && defaultLongitude) {
        map.jumpTo({
          center: toMapCoordinates(defaultLongitude, defaultLatitude),
          zoom: defaultZoom,
        });
        setInitialized(true);
      } else {
        const coordinates = (filteredPositions || Object.values(positions)).map((item) =>
          toMapCoordinates(item.longitude, item.latitude),
        );
        if (coordinates.length > 1) {
          const bounds = coordinates.reduce(
            (bounds, item) => bounds.extend(item),
            new maplibregl.LngLatBounds(coordinates[0], coordinates[1]),
          );
          const canvas = map.getCanvas();
          map.fitBounds(bounds, {
            duration: 0,
            padding: Math.min(canvas.width, canvas.height) * 0.1,
          });
          setInitialized(true);
        } else if (coordinates.length) {
          const [individual] = coordinates;
          map.jumpTo({
            center: individual,
            zoom: Math.max(defaultZoom > 0 ? defaultZoom : map.getZoom(), 10),
          });
          setInitialized(true);
        }
      }
    }
  }, [
    selectedDeviceId,
    initialized,
    defaultLatitude,
    defaultLongitude,
    defaultZoom,
    positions,
    filteredPositions,
  ]);

  return null;
};

export default MapDefaultCamera;
