import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Rnd } from 'react-rnd';
import {
  Card,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  CardMedia,
  Link,
  Tooltip,
  Button,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import CloseIcon from '@mui/icons-material/Close';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import SettingsOutlinedIcon from '@mui/icons-material/SettingsOutlined';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

import { useTranslation } from './LocalizationProvider';
import RemoveDialog from './RemoveDialog';
import EngineControl from './EngineControl';
import PositionValue from './PositionValue';
import PlateBadge from './PlateBadge';
import { useAdministrator, useDeviceReadonly, useRestriction } from '../util/permissions';
import usePositionAttributes from '../attributes/usePositionAttributes';
import { devicesActions } from '../../store';
import { useCatch, useCatchCallback } from '../../reactHelper';
import { useAttributePreference } from '../util/preferences';
import { formatStatus, formatTime, getStatusColor } from '../util/formatter';
import fetchOrThrow from '../util/fetchOrThrow';

dayjs.extend(relativeTime);

// "hace 14 min", "hace 3 h", "hace 2 d": entra en la casilla chica de la ficha.
const shortAgo = (value) => {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 60 * 24) return `hace ${Math.round(minutes / 60)} h`;
  return `hace ${Math.round(minutes / (60 * 24))} d`;
};

const useStyles = makeStyles()((theme, { desktopPadding }) => ({
  card: {
    pointerEvents: 'auto',
    width: theme.dimensions.popupMaxWidth,
    maxWidth: `calc(100vw - ${theme.spacing(4)})`,
    boxShadow: '0 10px 30px rgba(17, 24, 39, 0.18)',
    display: 'flex',
    flexDirection: 'column',
  },
  media: {
    height: theme.dimensions.popupImageHeight,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(2, 1.5, 1.5, 2),
    cursor: 'move',
  },
  plateRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  },
  plate: {
    minWidth: 0,
  },
  headerText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  contact: {
    fontWeight: 600,
    fontSize: '0.9375rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    marginTop: 2,
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'currentColor',
    flexShrink: 0,
  },
  close: {
    flexShrink: 0,
    backgroundColor: theme.palette.action.hover,
    borderRadius: 999,
  },
  // Ridder: los datos de la posición van en casillas grandes en vez de la tabla de dos columnas.
  tiles: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
    gap: 1,
    backgroundColor: theme.palette.divider,
    borderTop: `1px solid ${theme.palette.divider}`,
    borderBottom: `1px solid ${theme.palette.divider}`,
  },
  tile: {
    backgroundColor: theme.palette.background.paper,
    padding: theme.spacing(1.25, 1.5),
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  tileLabel: {
    fontSize: '0.6875rem',
    color: theme.palette.text.secondary,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  tileValue: {
    fontWeight: 700,
    fontSize: '0.9375rem',
    fontVariantNumeric: 'tabular-nums',
    overflowWrap: 'anywhere',
  },
  body: {
    padding: theme.spacing(1.5, 2),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    maxHeight: theme.dimensions.cardContentMaxHeight,
    overflow: 'auto',
  },
  address: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    '& svg': {
      flexShrink: 0,
      marginTop: 1,
    },
  },
  actions: {
    display: 'flex',
    gap: theme.spacing(1),
    '& > *': {
      flex: '1 1 0',
      minWidth: 0,
      paddingLeft: theme.spacing(1),
      paddingRight: theme.spacing(1),
      whiteSpace: 'nowrap',
    },
  },
  more: {
    flex: '0 0 auto',
    minWidth: 44,
    paddingLeft: 0,
    paddingRight: 0,
  },
  success: {
    color: theme.palette.success.dark,
  },
  neutral: {
    color: theme.palette.text.secondary,
  },
  root: {
    pointerEvents: 'none',
    position: 'fixed',
    zIndex: 5,
    left: '50%',
    [theme.breakpoints.up('md')]: {
      left: `calc(50% + ${desktopPadding} / 2)`,
      bottom: theme.spacing(3),
    },
    [theme.breakpoints.down('md')]: {
      left: '50%',
      bottom: `calc(${theme.spacing(2)} + ${theme.dimensions.bottomBarHeight}px)`,
    },
    transform: 'translateX(-50%)',
  },
}));

const StatusCard = ({ deviceId, position, onClose, disableActions, desktopPadding = 0 }) => {
  const { classes, cx } = useStyles({ desktopPadding });
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const t = useTranslation();

  const readonly = useRestriction('readonly');
  const deviceReadonly = useDeviceReadonly();
  const disableReports = useRestriction('disableReports');
  const admin = useAdministrator();

  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);
  const device = useSelector((state) => state.devices.items[deviceId]);

  const deviceImage = device?.attributes?.deviceImage;
  const homeLocation = device?.attributes?.['ridder.homeLocation'];

  const positionAttributes = usePositionAttributes(t);
  const positionItems = useAttributePreference(
    'positionItems',
    'fixTime,address,speed,totalDistance',
  );

  const navigationAppLink = useAttributePreference('navigationAppLink');
  const navigationAppTitle = useAttributePreference('navigationAppTitle');

  const [anchorEl, setAnchorEl] = useState(null);

  const [removing, setRemoving] = useState(false);

  const canRemove = !disableActions && !deviceReadonly;

  const handleRemove = useCatch(async (removed) => {
    if (removed) {
      const response = await fetchOrThrow('/api/devices');
      dispatch(devicesActions.refresh(await response.json()));
    }
    setRemoving(false);
  });

  // Ridder: archiva o desarchiva el equipo (atributo ridder.archived).
  const archived = Boolean(device?.attributes?.['ridder.archived']);
  const handleArchive = useCatch(async () => {
    setAnchorEl(null);
    const attributes = { ...device.attributes };
    delete attributes['ridder.archived'];
    const response = await fetchOrThrow(`/api/devices/${deviceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...device,
        attributes: archived ? attributes : { ...attributes, 'ridder.archived': true },
      }),
    });
    dispatch(devicesActions.update([await response.json()]));
  });

  const handleGeofence = useCatchCallback(async () => {
    const newItem = {
      name: t('sharedGeofence'),
      area: `CIRCLE (${position.latitude} ${position.longitude}, 50)`,
    };
    const response = await fetchOrThrow('/api/geofences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newItem),
    });
    const item = await response.json();
    await fetchOrThrow('/api/permissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: position.deviceId, geofenceId: item.id }),
    });
    navigate(`/settings/geofence/${item.id}`);
  }, [navigate, position, t]);

  const closeMenu = () => setAnchorEl(null);
  const go = (path) => () => {
    closeMenu();
    navigate(path);
  };

  const items = position
    ? positionItems
        .split(',')
        .filter((key) => position.hasOwnProperty(key) || position.attributes.hasOwnProperty(key))
    : [];
  const tiles = items.filter((key) => key !== 'address');
  const showAddress = items.includes('address');

  const statusText =
    device && (device.status === 'online' || !device.lastUpdate)
      ? formatStatus(device.status, t)
      : dayjs(device?.lastUpdate).fromNow();
  const motionText =
    device?.status === 'online' && position?.attributes?.hasOwnProperty('motion')
      ? ` · ${t(position.attributes.motion ? 'ridderStatusMoving' : 'ridderStatusStopped')}`
      : '';

  const tileValue = (key) => {
    if (key === 'fixTime') {
      return (
        <Tooltip title={formatTime(position.fixTime, 'seconds')}>
          <span>{shortAgo(position.fixTime)}</span>
        </Tooltip>
      );
    }
    return (
      <PositionValue
        position={position}
        property={position.hasOwnProperty(key) ? key : null}
        attribute={position.hasOwnProperty(key) ? null : key}
      />
    );
  };

  return (
    <>
      <div className={classes.root}>
        {device && (
          <Rnd
            default={{ x: 0, y: 0, width: 'auto', height: 'auto' }}
            enableResizing={false}
            dragHandleClassName="draggable-header"
            style={{ position: 'relative' }}
          >
            <Card elevation={0} className={classes.card}>
              {deviceImage && (
                <CardMedia
                  className={`draggable-header ${classes.media}`}
                  image={`/api/media/${device.uniqueId}/${deviceImage}`}
                />
              )}
              <div className={`draggable-header ${classes.header}`}>
                <div className={classes.plateRow}>
                  <PlateBadge name={device.name} size="large" className={classes.plate} />
                  <IconButton
                    size="small"
                    className={classes.close}
                    onClick={onClose}
                    onTouchStart={onClose}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </div>
                <div className={classes.headerText}>
                  {(device.contact || device.phone) && (
                    <span className={classes.contact}>{device.contact || device.phone}</span>
                  )}
                  {device.contact && device.phone && (
                    <Typography variant="caption" color="textSecondary" noWrap>
                      {device.phone}
                      {device.model ? ` · ${device.model}` : ''}
                    </Typography>
                  )}
                  <span className={cx(classes.status, classes[getStatusColor(device.status)])}>
                    <span className={classes.dot} />
                    {statusText}
                    {motionText}
                  </span>
                </div>
              </div>
              {position && tiles.length > 0 && (
                <div className={classes.tiles}>
                  {tiles.map((key) => (
                    <div key={key} className={classes.tile}>
                      <span className={classes.tileLabel}>
                        {key === 'fixTime'
                          ? t('ridderLastSignal')
                          : positionAttributes[key]?.name || key}
                      </span>
                      <span className={classes.tileValue}>{tileValue(key)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className={classes.body}>
                {position && (showAddress || homeLocation) && (
                  <div className={classes.address}>
                    <PlaceOutlinedIcon fontSize="small" />
                    <span>
                      {showAddress && <PositionValue position={position} property="address" />}
                      {showAddress && homeLocation && ' · '}
                      {homeLocation && (
                        <Link
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(homeLocation)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          underline="none"
                          fontWeight={600}
                        >
                          {`${t('ridderHome')}: ${t('ridderHomeShow').toLowerCase()}`}
                        </Link>
                      )}
                    </span>
                  </div>
                )}
                <EngineControl deviceId={deviceId} disabled={disableActions} />
                <div className={classes.actions}>
                  <Button
                    variant="outlined"
                    color="inherit"
                    onClick={() => navigate(`/replay?deviceId=${deviceId}`)}
                    disabled={disableActions || !position}
                  >
                    {t('ridderReplay')}
                  </Button>
                  {!disableReports && (
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => navigate(`/calendario?deviceId=${deviceId}`)}
                    >
                      {t('ridderSleepMenu')}
                    </Button>
                  )}
                  {!deviceReadonly && (
                    <Tooltip title={t('ridderConfigure')}>
                      <Button
                        variant="outlined"
                        color="inherit"
                        className={classes.more}
                        aria-label={t('ridderConfigure')}
                        onClick={() => navigate(`/settings/device/${deviceId}`)}
                      >
                        <SettingsOutlinedIcon fontSize="small" />
                      </Button>
                    </Tooltip>
                  )}
                  <Button
                    variant="outlined"
                    color="inherit"
                    className={classes.more}
                    aria-label={t('sharedExtra')}
                    onClick={(e) => setAnchorEl(e.currentTarget)}
                  >
                    ···
                  </Button>
                </div>
              </div>
            </Card>
          </Rnd>
        )}
      </div>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={closeMenu}>
        {position && (
          <MenuItem component={RouterLink} to={`/position/${position.id}`} onClick={closeMenu}>
            {t('sharedShowDetails')}
          </MenuItem>
        )}
        {!disableActions && (
          <MenuItem onClick={go(`/settings/device/${deviceId}/command`)}>
            {t('commandTitle')}
          </MenuItem>
        )}
        {!disableActions && !deviceReadonly && (
          <MenuItem onClick={go(`/settings/device/${deviceId}`)}>{t('sharedEdit')}</MenuItem>
        )}
        {admin && (
          <MenuItem onClick={go(`/reports/audit?deviceId=${deviceId}`)}>
            {t('ridderDeviceHistory')}
          </MenuItem>
        )}
        {position && (
          <MenuItem
            onClick={go(`/stream?deviceId=${deviceId}`)}
            disabled={position.protocol !== 'jt808'}
          >
            {t('linkLiveVideo')}
          </MenuItem>
        )}
        {position && !readonly && (
          <MenuItem onClick={handleGeofence}>{t('sharedCreateGeofence')}</MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/search/?api=1&query=${position.latitude}%2C${position.longitude}`}
          >
            {t('linkGoogleMaps')}
          </MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://maps.apple.com/?ll=${position.latitude},${position.longitude}`}
          >
            {t('linkAppleMaps')}
          </MenuItem>
        )}
        {position && (
          <MenuItem
            component="a"
            target="_blank"
            href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${position.latitude}%2C${position.longitude}&heading=${position.course}`}
          >
            {t('linkStreetView')}
          </MenuItem>
        )}
        {position && navigationAppTitle && navigationAppLink && (
          <MenuItem
            component="a"
            target="_blank"
            href={navigationAppLink
              .replace('{latitude}', position.latitude)
              .replace('{longitude}', position.longitude)}
          >
            {navigationAppTitle}
          </MenuItem>
        )}
        {position && !shareDisabled && !user.temporary && (
          <MenuItem onClick={go(`/settings/device/${deviceId}/share`)}>
            <Typography color="secondary">{t('sharedShare')}</Typography>
          </MenuItem>
        )}
        {canRemove && (
          <MenuItem onClick={handleArchive}>
            {t(archived ? 'ridderDeviceUnarchive' : 'ridderDeviceArchive')}
          </MenuItem>
        )}
        {canRemove && (
          <MenuItem
            onClick={() => {
              setAnchorEl(null);
              setRemoving(true);
            }}
          >
            <Typography color="error">{t('sharedRemove')}</Typography>
          </MenuItem>
        )}
      </Menu>
      <RemoveDialog
        open={removing}
        endpoint="devices"
        itemId={deviceId}
        onResult={(removed) => handleRemove(removed)}
      />
    </>
  );
};

export default StatusCard;
