import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import {
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Snackbar,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import { useTranslation } from './LocalizationProvider';
import { useAsyncTask, useCatch } from '../../reactHelper';
import { useRestriction } from '../util/permissions';
import { snackBarDurationLongMs } from '../util/duration';
import fetchOrThrow from '../util/fetchOrThrow';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  status: {
    alignSelf: 'flex-start',
    fontWeight: 600,
  },
  blockedChip: {
    backgroundColor: theme.palette.error.light,
    color: theme.palette.error.dark,
    '& .MuiChip-icon': {
      color: theme.palette.error.dark,
    },
  },
  snackbar: {
    [theme.breakpoints.down('md')]: {
      bottom: `calc(${theme.dimensions.bottomBarHeight}px + ${theme.spacing(1)})`,
    },
  },
}));

// Último comando de motor enviado por equipo. El estado "blocked" recién cambia con el siguiente
// paquete de estado del GPS (hasta ~3 min), así que mientras tanto se muestran los dos botones.
const WAIT_CONFIRMATION_MS = 5 * 60 * 1000;
const sentCommands = {};

const recentCommand = (deviceId) => {
  const entry = sentCommands[deviceId];
  return entry && Date.now() - entry.time < WAIT_CONFIRMATION_MS ? entry : null;
};

// Bloqueo y desbloqueo de motor con confirmación. Solo aparece si el equipo soporta
// engineStop/engineResume; el estado sale del atributo "blocked" de la última posición.
// Los usuarios con comandos limitados (clientes) usan los comandos guardados que tengan asignados.
const EngineControl = ({ deviceId, disabled, className }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const limitCommands = useRestriction('limitCommands');
  const device = useSelector((state) => state.devices.items[deviceId]);
  const blocked = useSelector((state) => state.session.positions[deviceId]?.attributes?.blocked);

  // Tipo de comando -> comando a enviar ({ type } o { id } si es guardado).
  const [supported, setSupported] = useState({});
  const [pending, setPending] = useState(null);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState(null);
  const [sent, setSent] = useState(() => recentCommand(deviceId));

  useEffect(() => {
    if (!sent) {
      return undefined;
    }
    const timer = setTimeout(() => setSent(null), sent.time + WAIT_CONFIRMATION_MS - Date.now());
    return () => clearTimeout(timer);
  }, [sent]);

  useAsyncTask(
    async ({ signal }) => {
      setSupported({});
      if (!deviceId) {
        return;
      }
      const typesResponse = await fetchOrThrow(`/api/commands/types?deviceId=${deviceId}`, {
        signal,
      });
      const types = (await typesResponse.json()).map((item) => item.type);
      const result = {};
      if (limitCommands) {
        // /api/commands/send?deviceId exige el comando asignado también al vehículo; para
        // enviarlo alcanza con que esté asignado al usuario, así que se cruza a mano.
        const savedResponse = await fetchOrThrow('/api/commands', { signal });
        (await savedResponse.json())
          .filter((item) => types.includes(item.type))
          .forEach((item) => {
            result[item.type] = { id: item.id };
          });
      } else {
        types.forEach((type) => {
          result[type] = { type };
        });
      }
      setSupported(result);
    },
    [deviceId, limitCommands],
  );

  const name = device?.name || '';
  const fill = (key) => t(key).replace('{name}', name);

  const handleSend = useCatch(async () => {
    setSending(true);
    try {
      const response = await fetchOrThrow('/api/commands/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...supported[pending], deviceId: Number(deviceId) }),
      });
      setMessage(fill(response.status === 202 ? 'ridderCommandQueued' : 'ridderCommandSent'));
      const entry = { deviceId, type: pending, time: Date.now() };
      sentCommands[deviceId] = entry;
      setSent(entry);
    } finally {
      setSending(false);
      setPending(null);
    }
  });

  const canBlock = Boolean(supported.engineStop);
  const canUnblock = Boolean(supported.engineResume);
  if (!device || (!canBlock && !canUnblock)) {
    return null;
  }

  const blocking = pending === 'engineStop';

  const waiting = sent?.deviceId === deviceId && blocked !== (sent.type === 'engineStop');

  return (
    <div className={className ? `${classes.root} ${className}` : classes.root}>
      {waiting && (
        <Chip
          className={classes.status}
          color="warning"
          size="small"
          icon={<HourglassTopIcon />}
          label={t('ridderEngineWaiting')}
        />
      )}
      {blocked && !waiting && (
        <Chip
          className={`${classes.status} ${classes.blockedChip}`}
          size="small"
          icon={<LockIcon />}
          label={t('ridderEngineBlocked')}
        />
      )}
      {canBlock && (blocked !== true || waiting) && (
        <Button
          variant={blocked === false || blocked === undefined ? 'contained' : 'outlined'}
          color="error"
          startIcon={<LockIcon />}
          disabled={disabled}
          onClick={() => setPending('engineStop')}
        >
          {t('ridderEngineBlock')}
        </Button>
      )}
      {canUnblock && (blocked !== false || waiting) && (
        <Button
          variant={blocked ? 'contained' : 'outlined'}
          color="primary"
          startIcon={<LockOpenIcon />}
          disabled={disabled}
          onClick={() => setPending('engineResume')}
        >
          {t('ridderEngineUnblock')}
        </Button>
      )}
      <Dialog open={Boolean(pending)} onClose={() => !sending && setPending(null)}>
        <DialogTitle>
          {fill(blocking ? 'ridderEngineBlockTitle' : 'ridderEngineUnblockTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(blocking ? 'ridderEngineBlockText' : 'ridderEngineUnblockText')}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPending(null)} disabled={sending}>
            {t('sharedCancel')}
          </Button>
          <Button
            variant="contained"
            color={blocking ? 'error' : 'primary'}
            onClick={handleSend}
            disabled={sending}
          >
            {t(blocking ? 'ridderEngineBlock' : 'ridderEngineUnblock')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        className={classes.snackbar}
        open={Boolean(message)}
        autoHideDuration={snackBarDurationLongMs}
        onClose={() => setMessage(null)}
        message={message}
      />
    </div>
  );
};

export default EngineControl;
