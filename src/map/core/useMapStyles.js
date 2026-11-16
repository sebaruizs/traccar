import { useMemo } from 'react';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAttributePreference } from '../../common/util/preferences';

const styleCustom = ({ tiles, minZoom, maxZoom, attribution, scheme }) => {
  const source = {
    type: 'raster',
    tiles,
    attribution,
    tileSize: 256,
    minzoom: minZoom,
    maxzoom: maxZoom,
    scheme,
  };
  Object.keys(source).forEach((key) => source[key] === undefined && delete source[key]);
  return {
    version: 8,
    sources: {
      custom: source,
    },
    glyphs: 'https://cdn.traccar.com/map/fonts/{fontstack}/{range}.pbf',
    layers: [
      {
        id: 'custom',
        type: 'raster',
        source: 'custom',
      },
    ],
  };
};

export default () => {
  const t = useTranslation();

  const googleKey = useAttributePreference('googleKey');

  return useMemo(
    () => [
      {
        id: 'googleRoad',
        title: t('mapGoogleRoad'),
        style: styleCustom({
          tiles: googleKey
            ? [`google://roadmap/{z}/{x}/{y}?key=${googleKey}`]
            : [0, 1, 2, 3].map(
                (i) => `https://mt${i}.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}&s=Ga`,
              ),
          maxZoom: 20,
          attribution: '© Google',
        }),
        available: true,
        attribute: 'googleKey',
      },
      {
        id: 'googleSatellite',
        title: t('mapGoogleSatellite'),
        style: styleCustom({
          tiles: googleKey
            ? [`google://satellite/{z}/{x}/{y}?key=${googleKey}`]
            : [0, 1, 2, 3].map(
                (i) => `https://mt${i}.google.com/vt/lyrs=s&hl=en&x={x}&y={y}&z={z}&s=Ga`,
              ),
          maxZoom: 20,
          attribution: '© Google',
        }),
        available: true,
        attribute: 'googleKey',
      },
      {
        id: 'googleHybrid',
        title: t('mapGoogleHybrid'),
        style: styleCustom({
          tiles: googleKey
            ? [`google://satellite/{z}/{x}/{y}?key=${googleKey}&layerType=layerRoadmap`]
            : [0, 1, 2, 3].map(
                (i) => `https://mt${i}.google.com/vt/lyrs=y&hl=en&x={x}&y={y}&z={z}&s=Ga`,
              ),
          maxZoom: 20,
          attribution: '© Google',
        }),
        available: true,
        attribute: 'googleKey',
      },
    ],
    [t, googleKey],
  );
};
