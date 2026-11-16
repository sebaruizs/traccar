import { useDispatch, useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import { Tooltip, ListItemButton, Typography } from '@mui/material';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull';
import Battery60Icon from '@mui/icons-material/Battery60';
import BatteryCharging60Icon from '@mui/icons-material/BatteryCharging60';
import Battery20Icon from '@mui/icons-material/Battery20';
import BatteryCharging20Icon from '@mui/icons-material/BatteryCharging20';
import ErrorIcon from '@mui/icons-material/Error';
import ArchiveIcon from '@mui/icons-material/Archive';
import LockIcon from '@mui/icons-material/Lock';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { devicesActions } from '../store';
import {
  formatAlarm,
  formatBoolean,
  formatPercentage,
  formatStatus,
  getStatusColor,
} from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useAdministrator } from '../common/util/permissions';
import { isDeviceArchived } from '../common/util/archived';
import EngineIcon from '../resources/images/data/engine.svg?react';
import { useAttributePreference } from '../common/util/preferences';
import GeofencesValue from '../common/components/GeofencesValue';
import DriverValue from '../common/components/DriverValue';
import MotionBar from './components/MotionBar';
import PlateBadge from '../common/components/PlateBadge';

dayjs.extend(relativeTime);

const useStyles = makeStyles()((theme) => ({
  row: {
    margin: theme.spacing(0, 1),
    padding: theme.spacing(1, 1.25),
    gap: theme.spacing(1.5),
    height: `calc(100% - ${theme.spacing(0.5)})`,
    boxSizing: 'border-box',
  },
  plate: {
    maxWidth: '50%',
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    flex: 1,
  },
  // Ridder: el estado ("En línea", "hace 4 horas") va arriba con un punto de color; abajo el contacto.
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    fontSize: '0.75rem',
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  statusText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'currentColor',
    flexShrink: 0,
  },
  secondary: {
    fontSize: '0.8125rem',
    color: theme.palette.text.secondary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  extras: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    fontVariantNumeric: 'tabular-nums',
  },
  // Ridder: en la fila el bloqueo es solo un candado rojo (la palabra completa va en la ficha),
  // para que no tape el estado en pantallas angostas.
  blocked: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    flexShrink: 0,
  },
  success: {
    color: theme.palette.success.dark,
  },
  warning: {
    color: theme.palette.warning.dark,
  },
  error: {
    color: theme.palette.error.main,
  },
  neutral: {
    color: theme.palette.text.secondary,
  },
}));

const DeviceRow = ({ devices, index, style }) => {
  const { classes, cx } = useStyles();
  const dispatch = useDispatch();
  const t = useTranslation();

  const admin = useAdministrator();
  const selectedDeviceId = useSelector((state) => state.devices.selectedId);

  const item = devices[index];
  const position = useSelector((state) => state.session.positions[item.id]);
  const groups = useSelector((state) => state.groups.items);

  const devicePrimary = useAttributePreference('devicePrimary', 'name');
  const deviceSecondary = useAttributePreference('deviceSecondary', '');

  const resolveFieldValue = (field) => {
    if (field === 'geofenceIds') {
      const geofenceIds = position?.geofenceIds;
      return geofenceIds?.length ? <GeofencesValue geofenceIds={geofenceIds} /> : null;
    }
    if (field === 'driverUniqueId') {
      const driverUniqueId = position?.attributes?.driverUniqueId;
      return driverUniqueId ? <DriverValue driverUniqueId={driverUniqueId} /> : null;
    }
    if (field === 'motion') {
      return <MotionBar deviceId={item.id} />;
    }
    return item[field];
  };

  const primaryValue = resolveFieldValue(devicePrimary);
  const secondaryValue = resolveFieldValue(deviceSecondary);

  const statusText =
    item.status === 'online' || !item.lastUpdate
      ? formatStatus(item.status, t)
      : dayjs(item.lastUpdate).fromNow();

  const blocked = position?.attributes?.blocked === true;
  const batteryLevel = position?.attributes?.batteryLevel;
  const batteryClass =
    batteryLevel > 70 ? classes.success : batteryLevel > 30 ? classes.warning : classes.error;
  const batteryIcon = (full, mid, low) =>
    batteryLevel > 70 ? full : batteryLevel > 30 ? mid : low;

  return (
    <div style={style}>
      <ListItemButton
        key={item.id}
        className={classes.row}
        onClick={() => dispatch(devicesActions.selectId(item.id))}
        disabled={!admin && item.disabled}
        selected={selectedDeviceId === item.id}
      >
        {devicePrimary === 'name' ? (
          <PlateBadge name={item.name} className={classes.plate} />
        ) : (
          <Typography noWrap fontWeight={600}>
            {primaryValue}
          </Typography>
        )}
        <div className={classes.text}>
          <span className={cx(classes.status, classes[getStatusColor(item.status)])}>
            <span className={classes.dot} />
            <span className={classes.statusText}>{statusText}</span>
          </span>
          {secondaryValue && <span className={classes.secondary}>{secondaryValue}</span>}
        </div>
        <div className={classes.extras}>
          {isDeviceArchived(item, groups) && (
            <Tooltip title="Archivado">
              <ArchiveIcon fontSize="small" className={classes.neutral} />
            </Tooltip>
          )}
          {blocked && (
            <Tooltip title={t('ridderEngineBlockedShort')}>
              <span className={classes.blocked}>
                <LockIcon sx={{ fontSize: 14 }} />
              </span>
            </Tooltip>
          )}
          {position?.attributes?.hasOwnProperty('alarm') && (
            <Tooltip title={`${t('eventAlarm')}: ${formatAlarm(position.attributes.alarm, t)}`}>
              <ErrorIcon fontSize="small" className={classes.error} />
            </Tooltip>
          )}
          {position?.attributes?.hasOwnProperty('ignition') && (
            <Tooltip
              title={`${t('positionIgnition')}: ${formatBoolean(position.attributes.ignition, t)}`}
            >
              <EngineIcon
                width={18}
                height={18}
                className={position.attributes.ignition ? classes.success : classes.neutral}
              />
            </Tooltip>
          )}
          {position?.attributes?.hasOwnProperty('batteryLevel') && (
            <Tooltip title={`${t('positionBatteryLevel')}: ${formatPercentage(batteryLevel)}`}>
              <span className={cx(classes.extras, batteryClass)} style={{ gap: 2 }}>
                {position.attributes.charge
                  ? batteryIcon(
                      <BatteryChargingFullIcon fontSize="small" />,
                      <BatteryCharging60Icon fontSize="small" />,
                      <BatteryCharging20Icon fontSize="small" />,
                    )
                  : batteryIcon(
                      <BatteryFullIcon fontSize="small" />,
                      <Battery60Icon fontSize="small" />,
                      <Battery20Icon fontSize="small" />,
                    )}
                {formatPercentage(batteryLevel)}
              </span>
            </Tooltip>
          )}
        </div>
      </ListItemButton>
    </div>
  );
};

export default DeviceRow;
