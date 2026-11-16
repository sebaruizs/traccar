import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import dayjs from 'dayjs';
import { formatTime } from '../common/util/formatter';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import ReportsMenu from './components/ReportsMenu';
import ReportFilter from './components/ReportFilter';
import { useAsyncTask, useCatchCallback } from '../reactHelper';
import useReportStyles from './common/useReportStyles';
import TableShimmer from '../common/components/TableShimmer';
import fetchOrThrow from '../common/util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  notice: {
    margin: theme.spacing(0, 2, 2),
  },
  filter: {
    minWidth: theme.spacing(20),
  },
  device: {
    fontStyle: 'italic',
  },
  time: {
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  changes: {
    margin: 0,
    paddingLeft: theme.spacing(2),
  },
}));

// Campos del dispositivo que guarda el control de cambios (integraciones/control-cambios).
const changeFields = {
  name: 'ridderChangeName',
  uniqueId: 'ridderChangeUniqueId',
  groupId: 'ridderChangeGroupId',
  phone: 'ridderChangePhone',
  model: 'ridderChangeModel',
  contact: 'ridderChangeContact',
  category: 'ridderChangeCategory',
  disabled: 'ridderChangeDisabled',
  expirationTime: 'ridderChangeExpirationTime',
  calendarId: 'ridderChangeCalendarId',
};
const attributeFields = {
  'ridder.homeLocation': 'ridderChangeHomeLocation',
  'ridder.archived': 'ridderChangeArchived',
  'ridder.previousGroupId': 'ridderChangePreviousGroupId',
  deviceImage: 'ridderChangeDeviceImage',
};

// Objetos cuyos nombres se resuelven para mostrar "el vehículo AALN163" en lugar de un id.
const nameSources = {
  user: '/api/users',
  device: '/api/devices?all=true',
  group: '/api/groups?all=true',
  geofence: '/api/geofences?all=true',
  notification: '/api/notifications?all=true',
  command: '/api/commands?all=true',
};

const objectKeys = [
  'device',
  'user',
  'group',
  'geofence',
  'notification',
  'command',
  'server',
  'driver',
  'maintenance',
  'calendar',
  'attribute',
];

// Historial de quién hizo qué, a partir del registro de acciones del servidor (/api/audit) y del
// control de cambios propio (/ridder-api/cambios: antes/después de cada edición y cada comando).
// Si se filtra por vehículo, suma los cambios de bloqueo de motor que reportó el equipo.
const HistoryPage = () => {
  const { classes: reportClasses } = useReportStyles();
  const { classes } = useStyles();
  const t = useTranslation();

  const [names, setNames] = useState({});
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userFilter, setUserFilter] = useState('all');
  const [searchParams, setSearchParams] = useSearchParams();
  const [deviceFilter, setDeviceFilter] = useState(Number(searchParams.get('deviceId')) || 'all');

  // Ridder: al entrar (sin período en la dirección) se muestra todo lo de los últimos 7 días, de
  // todos los usuarios y vehículos, sin tener que tocar "Mostrar". Si se entra desde el botón de
  // historial de un vehículo, queda filtrado por ese vehículo.
  const ready = searchParams.has('from') && searchParams.has('to');
  useEffect(() => {
    if (!ready) {
      const deviceId = Number(searchParams.get('deviceId')) || null;
      const params = new URLSearchParams({
        period: 'custom',
        from: dayjs().subtract(6, 'day').startOf('day').toISOString(),
        to: dayjs().endOf('day').toISOString(),
      });
      if (deviceId) {
        params.set('deviceId', deviceId);
      }
      setDeviceFilter(deviceId || 'all');
      setUserFilter('all');
      setSearchParams(params, { replace: true });
    }
  }, [ready, searchParams, setSearchParams]);

  useAsyncTask(async ({ signal }) => {
    const entries = await Promise.all(
      Object.entries(nameSources).map(async ([type, url]) => {
        const response = await fetchOrThrow(url, { signal });
        const list = await response.json();
        return [type, new Map(list.map((it) => [it.id, it.name || it.description || it.email]))];
      }),
    );
    setNames(Object.fromEntries(entries));
  }, []);

  const objectText = (form, type, id) => {
    const key = objectKeys.includes(type) ? type : 'other';
    const label = t(`ridder${form}_${key}`);
    if (type === 'server') {
      return label;
    }
    const name = names[type]?.get(id);
    return `${label} ${name || `#${id}`}`;
  };

  const describe = (item) => {
    const object = objectText('Obj', item.objectType, item.objectId);
    const owner = item.attributes?.ownerType && item.attributes?.ownerId;
    switch (item.actionType) {
      case 'login':
        return t('ridderActionLogin');
      case 'logout':
        return t('ridderActionLogout');
      case 'failedLogin':
        return t('ridderActionFailedLogin');
      case 'create':
        return `${t('ridderActionCreate')} ${object}`;
      case 'edit':
        return `${t('ridderActionEdit')} ${object}`;
      case 'remove':
        return `${t('ridderActionRemove')} ${object}`;
      case 'link':
        return owner
          ? `${t('ridderActionLink')} ${object} ${objectText('To', item.attributes.ownerType, item.attributes.ownerId)}`
          : `${t('ridderActionLink')} ${object}`;
      case 'unlink':
        return owner
          ? `${t('ridderActionUnlink')} ${object} ${objectText('From', item.attributes.ownerType, item.attributes.ownerId)}`
          : `${t('ridderActionUnlink')} ${object}`;
      case 'accumulators':
        return `${t('ridderActionAccumulators')} ${objectText('From', item.objectType, item.objectId)}`;
      case 'command':
        return `${t('ridderActionCommand')} ${objectText('To', item.objectType, item.objectId)}`;
      case 'report':
        return t('ridderActionReport');
      case 'engineBlocked':
        return t('ridderEventBlocked');
      case 'engineUnblocked':
        return t('ridderEventUnblocked');
      case 'device_create':
        return `${t('ridderActionCreate')} ${object}`;
      case 'device_edit':
        return `${t('ridderActionEdit')} ${object}`;
      case 'device_remove':
        return `${t('ridderActionRemove')} ${t('ridderObj_device')} ${item.before?.name || `#${item.objectId}`}`;
      case 'device_command': {
        const { type, attributes, status } = item.command;
        const target = objectText('From', item.objectType, item.objectId);
        let text;
        if (type === 'engineStop') {
          text = `${t('ridderCommandEngineStop')} ${target}`;
        } else if (type === 'engineResume') {
          text = `${t('ridderCommandEngineResume')} ${target}`;
        } else if (type === 'custom') {
          text = `${t('ridderCommandCustom')} "${attributes?.data || ''}" ${objectText('To', item.objectType, item.objectId)}`;
        } else {
          text = `${t('ridderCommandOther')} ${type} ${objectText('To', item.objectType, item.objectId)}`;
        }
        let result = t('ridderCommandFailed');
        if (status === 200) {
          result = t('ridderCommandSent');
        } else if (status === 202) {
          result = t('ridderCommandQueued');
        }
        return `${text} (${result})`;
      }
      default:
        return `${item.actionType} ${object}`;
    }
  };

  const who = (item) => {
    if (item.device) {
      return t('ridderWhoDevice');
    }
    if (item.userId) {
      const user =
        names.user?.get(item.userId) || item.userName || item.userEmail || `#${item.userId}`;
      // Persona que informó la integración con usuario compartido (ej. cobranzas).
      return item.actor ? `${user} (${item.actor})` : user;
    }
    if (item.actionType.startsWith('device_')) {
      return t('ridderWhoSystem');
    }
    return item.userEmail || t('ridderWhoUnknown');
  };

  const formatValue = (field, value) => {
    if (value === null || value === undefined || value === '') {
      return t('ridderChangeEmpty');
    }
    if (typeof value === 'boolean') {
      return value ? t('sharedYes') : t('sharedNo');
    }
    if (field === 'groupId' || field === 'ridder.previousGroupId') {
      return value ? names.group?.get(value) || `#${value}` : t('ridderChangeEmpty');
    }
    if (field === 'expirationTime') {
      return formatTime(value, 'date');
    }
    if (field === 'deviceImage') {
      return '…';
    }
    return String(value);
  };

  // Lista "Campo: antes → después" de una edición.
  const changeList = (item) => {
    if (item.actionType !== 'device_edit' || !item.before || !item.after) {
      return [];
    }
    const rows = [];
    Object.entries(changeFields).forEach(([field, key]) => {
      if (JSON.stringify(item.before[field]) !== JSON.stringify(item.after[field])) {
        rows.push([
          t(key),
          formatValue(field, item.before[field]),
          formatValue(field, item.after[field]),
        ]);
      }
    });
    const before = item.before.attributes || {};
    const after = item.after.attributes || {};
    new Set([...Object.keys(before), ...Object.keys(after)]).forEach((field) => {
      if (JSON.stringify(before[field]) !== JSON.stringify(after[field])) {
        const label = attributeFields[field] ? t(attributeFields[field]) : field;
        rows.push([label, formatValue(field, before[field]), formatValue(field, after[field])]);
      }
    });
    return rows;
  };

  // Cambios de "blocked" en las posiciones del vehículo, como filas del historial.
  const engineChanges = async (deviceId, from, to) => {
    const query = new URLSearchParams({ deviceId, from, to });
    const response = await fetchOrThrow(`/api/reports/route?${query.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    const positions = await response.json();
    const changes = [];
    let previous;
    positions.forEach((position) => {
      const blocked = position.attributes?.blocked;
      if (typeof blocked === 'boolean') {
        if (previous !== undefined && blocked !== previous) {
          changes.push({
            id: `p${position.id}`,
            device: true,
            actionTime: position.fixTime,
            actionType: blocked ? 'engineBlocked' : 'engineUnblocked',
            objectType: 'device',
            objectId: deviceId,
          });
        }
        previous = blocked;
      }
    });
    return changes;
  };

  const onShow = useCatchCallback(
    async ({ from, to }) => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ from, to });
        const response = await fetchOrThrow(`/api/audit?${query.toString()}`);
        let result = await response.json();
        if (deviceFilter !== 'all') {
          query.set('deviceId', deviceFilter);
        }
        const changesResponse = await fetchOrThrow(`/ridder-api/cambios?${query.toString()}`);
        const changes = await changesResponse.json();
        // Las acciones de Traccar que ya tienen detalle propio no se repiten.
        const covered = new Set(changes.coveredActionIds);
        result = result.filter((item) => !covered.has(item.id)).concat(changes.items);
        // A las acciones de Traccar del mismo usuario y momento les suma la persona informada.
        result.forEach((item) => {
          if (!item.actor) {
            const time = new Date(item.actionTime).getTime();
            const match = changes.actors.find(
              (actor) =>
                actor.userId === item.userId &&
                Math.abs(new Date(actor.actionTime).getTime() - time) <= 3000,
            );
            if (match) {
              item.actor = match.actor;
            }
          }
        });
        if (deviceFilter !== 'all') {
          result = result.concat(await engineChanges(deviceFilter, from, to));
        }
        result.sort((a, b) => new Date(b.actionTime) - new Date(a.actionTime));
        setItems(result);
      } finally {
        setLoading(false);
      }
    },
    [deviceFilter],
  );

  const visible = useMemo(
    () =>
      items.filter(
        (item) =>
          (userFilter === 'all' || item.userId === userFilter) &&
          (deviceFilter === 'all' ||
            (item.objectType === 'device' && item.objectId === deviceFilter) ||
            (item.attributes?.ownerType === 'device' && item.attributes?.ownerId === deviceFilter)),
      ),
    [items, userFilter, deviceFilter],
  );

  const sortedEntries = (type) =>
    [...(names[type]?.entries() || [])].sort((a, b) => String(a[1]).localeCompare(String(b[1])));

  return (
    <PageLayout menu={<ReportsMenu />} breadcrumbs={['reportTitle', 'reportAudit']}>
      <div className={reportClasses.header}>
        {ready && (
          <ReportFilter onShow={onShow} deviceType="none" loading={loading}>
            <div className={reportClasses.filterItem}>
              <FormControl fullWidth className={classes.filter}>
                <InputLabel id="ridder-history-user">{t('ridderHistoryUser')}</InputLabel>
                <Select
                  labelId="ridder-history-user"
                  label={t('ridderHistoryUser')}
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value)}
                >
                  <MenuItem value="all">{t('ridderAllUsers')}</MenuItem>
                  {sortedEntries('user').map(([id, name]) => (
                    <MenuItem key={id} value={id}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
            <div className={reportClasses.filterItem}>
              <FormControl fullWidth className={classes.filter}>
                <InputLabel id="ridder-history-vehicle">{t('ridderHistoryVehicle')}</InputLabel>
                <Select
                  labelId="ridder-history-vehicle"
                  label={t('ridderHistoryVehicle')}
                  value={deviceFilter}
                  onChange={(e) => setDeviceFilter(e.target.value)}
                >
                  <MenuItem value="all">{t('ridderAllVehicles')}</MenuItem>
                  {sortedEntries('device').map(([id, name]) => (
                    <MenuItem key={id} value={id}>
                      {name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </ReportFilter>
        )}
      </div>
      <Alert severity="info" className={classes.notice}>
        {t('ridderHistoryNotice')}
      </Alert>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>{t('ridderHistoryWhen')}</TableCell>
            <TableCell>{t('ridderHistoryWho')}</TableCell>
            <TableCell>{t('ridderHistoryWhat')}</TableCell>
            <TableCell>{t('ridderHistoryDetail')}</TableCell>
            <TableCell>{t('ridderHistoryFrom')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {!loading ? (
            visible.map((item) => (
              <TableRow key={item.id}>
                <TableCell className={classes.time}>
                  {formatTime(item.actionTime, 'seconds')}
                </TableCell>
                <TableCell className={item.device ? classes.device : undefined}>
                  {who(item)}
                </TableCell>
                <TableCell>{describe(item)}</TableCell>
                <TableCell>
                  {changeList(item).length > 0 && (
                    <ul className={classes.changes}>
                      {changeList(item).map(([label, before, after]) => (
                        <li key={label}>
                          <Typography variant="body2">
                            {`${label}: ${before} → ${after}`}
                          </Typography>
                        </li>
                      ))}
                    </ul>
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="textSecondary">
                    {item.address || ''}
                  </Typography>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableShimmer columns={5} />
          )}
        </TableBody>
      </Table>
    </PageLayout>
  );
};

export default HistoryPage;
