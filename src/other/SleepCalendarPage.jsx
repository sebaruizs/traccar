import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import PageLayout from '../common/components/PageLayout';
import { useTranslation } from '../common/components/LocalizationProvider';
import PlateBadge from '../common/components/PlateBadge';
import { useRestriction } from '../common/util/permissions';
import { useAsyncTask } from '../reactHelper';
import fetchOrThrow from '../common/util/fetchOrThrow';

// Los resultados los guarda el servicio control-noches: todos los días a las 3:00 compara la
// última posición recibida (sin mirar la hora del GPS) con la casa; a 500 m o menos, "en casa".
const HOME_ATTRIBUTE = 'ridder.homeLocation';
// Solo los GPS sin agregado en el nombre (los "236ABXV - Monedas" no van al calendario).
const inCalendar = (device) => !device.name.includes('-');

const useStyles = makeStyles()((theme) => ({
  search: {
    margin: theme.spacing(2, 2, 1),
  },
  list: {
    overflowY: 'auto',
  },
  content: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    maxWidth: theme.spacing(110),
    width: '100%',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(2),
    },
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  title: {
    marginRight: 'auto',
    [theme.breakpoints.down('sm')]: {
      flexBasis: '100%',
    },
  },
  month: {
    minWidth: theme.spacing(18),
    textAlign: 'center',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
    gap: theme.spacing(1),
  },
  weekday: {
    textAlign: 'center',
    color: theme.palette.text.secondary,
  },
  day: {
    minHeight: theme.spacing(9),
    borderRadius: theme.shape.borderRadius,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1, 1.25),
    fontWeight: 600,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    textAlign: 'left',
    font: 'inherit',
    color: 'inherit',
    background: 'none',
    [theme.breakpoints.down('sm')]: {
      minHeight: theme.spacing(6),
      padding: theme.spacing(0.5),
    },
  },
  clickable: {
    cursor: 'pointer',
    '&:hover': {
      outline: `2px solid ${theme.palette.primary.main}`,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.palette.primary.main}`,
    },
  },
  // Ridder: colores suaves (verde, naranja, gris) con texto oscuro, como en el resto de la web.
  home: {
    backgroundColor: theme.palette.success.light,
    borderColor: theme.palette.success.main,
    color: theme.palette.success.dark,
  },
  away: {
    backgroundColor: theme.palette.error.light,
    borderColor: theme.palette.error.main,
    color: theme.palette.error.dark,
  },
  nodata: {
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
  },
  overview: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    padding: theme.spacing(2, 2.5),
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  },
  overviewCount: {
    display: 'flex',
    alignItems: 'baseline',
    gap: theme.spacing(1),
  },
  overviewNumber: {
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: 1,
    letterSpacing: '-0.02em',
    fontVariantNumeric: 'tabular-nums',
  },
  bar: {
    display: 'flex',
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: theme.palette.action.hover,
  },
  barHome: {
    backgroundColor: theme.palette.success.main,
  },
  barAway: {
    backgroundColor: theme.palette.error.main,
  },
  barNodata: {
    backgroundColor: theme.palette.neutral.main,
  },
  plateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
    minWidth: 0,
  },
  dayLabel: {
    fontSize: '0.75rem',
    lineHeight: 1.2,
    [theme.breakpoints.down('sm')]: {
      display: 'none',
    },
  },
  summary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1, 3),
  },
  stats: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
  },
  stat: {
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 16,
    padding: theme.spacing(1.5, 2),
    minWidth: theme.spacing(18),
  },
  nodataSwatch: {
    backgroundColor: theme.palette.neutral.main,
  },
  swatch: {
    display: 'inline-block',
    width: theme.spacing(1.5),
    height: theme.spacing(1.5),
    borderRadius: 2,
    marginRight: theme.spacing(1),
    verticalAlign: 'middle',
  },
}));

const parseHome = (value) => {
  const [lat, lon] = (value || '').split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
};

// Fecha a la hora indicada en la zona horaria dada (no la del navegador).
const zonedDate = (year, month, day, hour, timeZone) => {
  const guess = Date.UTC(year, month, day, hour);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    })
      .formatToParts(new Date(guess))
      .map((part) => [part.type, Number(part.value)]),
  );
  const local = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  return new Date(guess - (local - guess));
};

// Km del reporte de resumen de Traccar. undefined si no hay datos o el total es negativo
// (pasa cuando el equipo reinicia su odómetro).
const summaryDistance = async (deviceId, from, to, signal) => {
  const query = new URLSearchParams({ deviceId, from: from.toISOString(), to: to.toISOString() });
  const response = await fetchOrThrow(`/api/reports/summary?${query.toString()}`, {
    headers: { Accept: 'application/json' },
    signal,
  });
  const summary = await response.json();
  const total = summary.reduce((sum, item) => sum + (item.distance || 0), 0);
  return summary.length && total >= 0 ? total : undefined;
};

const SleepCalendarPage = () => {
  const { classes, cx } = useStyles();
  const t = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const disableReports = useRestriction('disableReports');
  const devices = useSelector((state) => state.devices.items);
  const timeZone = useSelector(
    (state) =>
      state.session.user.attributes.timezone ||
      state.session.server.attributes.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone,
  );

  const [search, setSearch] = useState('');
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [today] = useState(() => new Date());
  const [nights, setNights] = useState({});
  const [loading, setLoading] = useState(false);
  const [distances, setDistances] = useState({ week: null, yesterday: null });

  const deviceId = Number(searchParams.get('deviceId')) || null;
  const device =
    deviceId && devices[deviceId] && inCalendar(devices[deviceId]) ? devices[deviceId] : null;
  const home = parseHome(device?.attributes?.[HOME_ATTRIBUTE]);

  const sortedDevices = useMemo(() => {
    const text = search.trim().toLowerCase();
    return Object.values(devices)
      .filter(inCalendar)
      .filter((item) => !text || item.name.toLowerCase().includes(text))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [devices, search]);

  const daysInMonth = new Date(month.year, month.month + 1, 0).getDate();
  // Lunes primero.
  const leadingBlanks = (new Date(month.year, month.month, 1).getDay() + 6) % 7;
  const isCurrentMonth = month.year === today.getFullYear() && month.month === today.getMonth();

  useAsyncTask(
    async ({ signal }) => {
      setNights({});
      if (!deviceId || disableReports) {
        return;
      }
      setLoading(true);
      try {
        const pad = (value) => String(value).padStart(2, '0');
        const prefix = `${month.year}-${pad(month.month + 1)}`;
        const query = new URLSearchParams({
          deviceId,
          from: `${prefix}-01`,
          to: `${prefix}-${pad(daysInMonth)}`,
        });
        const response = await fetchOrThrow(`/ridder-api/noches?${query.toString()}`, { signal });
        const records = await response.json();
        setNights(
          Object.fromEntries(
            records.map((record) => [
              Number(record.noche.slice(8, 10)),
              {
                status: record.estado,
                distance: record.distancia,
                positionId: record.position_id,
                received: record.recibida && `${record.recibida}Z`,
              },
            ]),
          ),
        );
      } finally {
        setLoading(false);
      }
    },
    [deviceId, disableReports, month.year, month.month, daysInMonth],
  );

  useAsyncTask(
    async ({ signal }) => {
      setDistances({ week: null, yesterday: null });
      if (!deviceId || disableReports) {
        return;
      }
      const now = new Date();
      const today = new Intl.DateTimeFormat('en-CA', { timeZone })
        .format(now)
        .split('-')
        .map(Number);
      const [year, monthIndex, day] = [today[0], today[1] - 1, today[2]];
      const [week, yesterday] = await Promise.all([
        summaryDistance(deviceId, new Date(now - 7 * 24 * 3600000), now, signal),
        summaryDistance(
          deviceId,
          zonedDate(year, monthIndex, day - 1, 0, timeZone),
          zonedDate(year, monthIndex, day, 0, timeZone),
          signal,
        ),
      ]);
      setDistances({ week, yesterday });
    },
    [deviceId, disableReports, timeZone],
  );

  const counts = Object.values(nights).reduce(
    (result, night) => ({ ...result, [night.status]: result[night.status] + 1 }),
    { home: 0, away: 0, nodata: 0 },
  );

  const totalNights = counts.home + counts.away + counts.nodata;

  const changeMonth = (delta) => {
    const date = new Date(month.year, month.month + delta, 1);
    setMonth({ year: date.getFullYear(), month: date.getMonth() });
  };

  const monthName = new Intl.DateTimeFormat('es', { month: 'long', year: 'numeric' }).format(
    new Date(month.year, month.month, 1),
  );
  const monthTitle = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat('es', { weekday: 'short' }).format(new Date(2024, 0, 1 + i)),
  );
  const formatDistance = (meters) =>
    meters < 1000
      ? `${Math.round(meters)} m`
      : `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
  const formatTime = (value) =>
    new Intl.DateTimeFormat('es', {
      timeZone,
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));

  const nightTooltip = (night) => {
    if (!night) {
      return '';
    }
    const received = night.received
      ? ` (${t('ridderSleepReceivedAt')} ${formatTime(night.received)})`
      : '';
    if (night.status === 'nodata') {
      return `${t('ridderSleepNoDataHelp')}${received}`;
    }
    return `${t(night.status === 'home' ? 'ridderSleepHome' : 'ridderSleepAway')}: ${formatDistance(
      night.distance,
    )} ${t('ridderSleepFromHome')}${received}`;
  };

  const menu = (
    <>
      <TextField
        className={classes.search}
        size="small"
        label={t('ridderSleepSearch')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <List className={classes.list} dense>
        {sortedDevices.map((item) => (
          <ListItemButton
            key={item.id}
            selected={item.id === deviceId}
            onClick={() => setSearchParams({ deviceId: item.id })}
          >
            <ListItemText
              primary={<PlateBadge name={item.name} />}
              secondary={
                parseHome(item.attributes?.[HOME_ATTRIBUTE])
                  ? item.contact
                  : t('ridderSleepNoHomeShort')
              }
            />
          </ListItemButton>
        ))}
      </List>
    </>
  );

  return (
    <PageLayout menu={menu} breadcrumbs={['ridderSleepTitle']}>
      <div className={classes.content}>
        {disableReports && <Alert severity="warning">{t('ridderSleepRestricted')}</Alert>}
        {!disableReports && !device && <Alert severity="info">{t('ridderSleepChoose')}</Alert>}
        {disableReports || !device ? null : (
          <>
            <div className={classes.header}>
              <div className={cx(classes.title, classes.plateRow)}>
                <PlateBadge name={device.name} size="large" />
                {device.contact && (
                  <Typography variant="body2" color="textSecondary" noWrap>
                    {device.contact}
                  </Typography>
                )}
              </div>
              <Tooltip title={t('ridderSleepPrevMonth')}>
                <IconButton onClick={() => changeMonth(-1)}>
                  <ChevronLeftIcon />
                </IconButton>
              </Tooltip>
              <Typography variant="subtitle1" className={classes.month}>
                {monthTitle}
              </Typography>
              <Tooltip title={t('ridderSleepNextMonth')}>
                <span>
                  <IconButton onClick={() => changeMonth(1)} disabled={isCurrentMonth}>
                    <ChevronRightIcon />
                  </IconButton>
                </span>
              </Tooltip>
            </div>
            <div className={classes.stats}>
              {[
                ['yesterday', 'ridderYesterdayDistance'],
                ['week', 'ridderWeekDistance'],
              ].map(([key, label]) => (
                <div key={key} className={classes.stat}>
                  <Typography variant="body2" color="textSecondary">
                    {t(label)}
                  </Typography>
                  <Typography variant="h5">
                    {distances[key] === null && '…'}
                    {distances[key] === undefined && '—'}
                    {distances[key] >= 0 &&
                      `${(distances[key] / 1000).toLocaleString('es', { maximumFractionDigits: 1 })} km`}
                  </Typography>
                </div>
              ))}
            </div>
            {!home && <Alert severity="warning">{t('ridderSleepNoHome')}</Alert>}
            {totalNights > 0 && (
              <div className={classes.overview}>
                <div className={classes.overviewCount}>
                  <span className={classes.overviewNumber}>{counts.home}</span>
                  <Typography variant="body1">
                    {t('ridderSleepNightsOf').replace('{total}', totalNights)}
                  </Typography>
                </div>
                <div
                  className={classes.bar}
                  role="img"
                  aria-label={`${t('ridderSleepHome')}: ${counts.home}, ${t('ridderSleepAway')}: ${counts.away}, ${t('ridderSleepNoData')}: ${counts.nodata}`}
                >
                  <span
                    className={classes.barHome}
                    style={{ width: `${(counts.home / totalNights) * 100}%` }}
                  />
                  <span
                    className={classes.barAway}
                    style={{ width: `${(counts.away / totalNights) * 100}%` }}
                  />
                  <span
                    className={classes.barNodata}
                    style={{ width: `${(counts.nodata / totalNights) * 100}%` }}
                  />
                </div>
                <div className={classes.summary}>
                  <Typography variant="body2">
                    <span className={cx(classes.swatch, classes.barHome)} />
                    {`${t('ridderSleepHome')}: ${counts.home}`}
                  </Typography>
                  <Typography variant="body2">
                    <span className={cx(classes.swatch, classes.barAway)} />
                    {`${t('ridderSleepAway')}: ${counts.away}`}
                  </Typography>
                  <Typography variant="body2">
                    <span className={cx(classes.swatch, classes.nodataSwatch)} />
                    {`${t('ridderSleepNoData')}: ${counts.nodata}`}
                  </Typography>
                </div>
              </div>
            )}
            {
              <>
                <Typography variant="body2" color="textSecondary">
                  {t('ridderSleepRule')}
                </Typography>
                {loading ? <LinearProgress /> : <div style={{ height: 4 }} />}
                <div className={classes.grid}>
                  {weekdays.map((weekday) => (
                    <Typography key={weekday} variant="caption" className={classes.weekday}>
                      {weekday}
                    </Typography>
                  ))}
                  {Array.from({ length: leadingBlanks }, (_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1;
                    const night = nights[day];
                    const label =
                      night &&
                      {
                        home: t('ridderSleepHome'),
                        away: formatDistance(night.distance),
                        nodata: t('ridderSleepNoData'),
                      }[night.status];
                    const cell = night?.positionId ? (
                      <button
                        type="button"
                        className={cx(classes.day, classes.clickable, classes[night.status])}
                        onClick={() => navigate(`/position/${night.positionId}`)}
                        aria-label={`${day}: ${nightTooltip(night)}`}
                      >
                        <Typography variant="body2">{day}</Typography>
                        <span className={classes.dayLabel}>{label}</span>
                      </button>
                    ) : (
                      <div className={cx(classes.day, night && classes[night.status])}>
                        <Typography variant="body2">{day}</Typography>
                        {label && <span className={classes.dayLabel}>{label}</span>}
                      </div>
                    );
                    return (
                      <Tooltip key={day} title={nightTooltip(night)}>
                        {cell}
                      </Tooltip>
                    );
                  })}
                </div>
              </>
            }
          </>
        )}
      </div>
    </PageLayout>
  );
};

export default SleepCalendarPage;
