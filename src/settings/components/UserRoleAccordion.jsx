import { Link as RouterLink } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  FormControl,
  InputLabel,
  ListItemText,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckIcon from '@mui/icons-material/Check';
import BlockIcon from '@mui/icons-material/Block';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import {
  detectRole,
  fetchEngineAccess,
  needsEngineCheck,
  roleTitleKey,
  userRoles,
} from '../common/userRoles';

const useStyles = makeStyles()((theme) => ({
  details: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  },
  option: {
    whiteSpace: 'normal',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  },
  item: {
    display: 'flex',
    gap: theme.spacing(1),
    alignItems: 'flex-start',
  },
  can: {
    color: theme.palette.success.main,
  },
  cannot: {
    color: theme.palette.error.main,
  },
}));

// Rol del usuario con un resumen de lo que puede y no puede hacer.
// engineAccess vive en la página: se aplica al guardar (comandos guardados de motor).
const UserRoleAccordion = ({ item, setItem, engineAccess, setEngineAccess }) => {
  const { classes } = useStyles();
  const t = useTranslation();

  const checkUserId = item.id && needsEngineCheck(item) ? item.id : null;

  useAsyncTask(
    async ({ signal }) => {
      if (checkUserId && engineAccess === null) {
        setEngineAccess(await fetchEngineAccess(checkUserId, signal));
      }
    },
    [checkUserId, engineAccess, setEngineAccess],
  );

  const roleId = detectRole(item, engineAccess);
  const role = userRoles.find((r) => r.id === roleId);

  const handleChange = (event) => {
    const selected = userRoles.find((r) => r.id === event.target.value);
    setItem({ ...item, ...selected.fields });
    setEngineAccess(selected.engine);
  };

  return (
    <Accordion defaultExpanded>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography variant="subtitle1">{t('ridderRoleTitle')}</Typography>
      </AccordionSummary>
      <AccordionDetails className={classes.details}>
        <FormControl fullWidth>
          <InputLabel id="ridder-role-label">{t('ridderRole')}</InputLabel>
          <Select
            labelId="ridder-role-label"
            label={t('ridderRole')}
            value={roleId}
            onChange={handleChange}
            renderValue={(value) => t(roleTitleKey(value))}
          >
            {userRoles.map((r) => (
              <MenuItem key={r.id} value={r.id} className={classes.option}>
                <ListItemText
                  primary={t(roleTitleKey(r.id))}
                  secondary={t(`${roleTitleKey(r.id)}Help`)}
                />
              </MenuItem>
            ))}
            {roleId === 'custom' && (
              <MenuItem value="custom" disabled>
                {t('ridderRoleCustom')}
              </MenuItem>
            )}
          </Select>
        </FormControl>
        {role ? (
          <ul className={classes.list}>
            {role.can.map((key) => (
              <li key={key} className={classes.item}>
                <CheckIcon fontSize="small" className={classes.can} />
                <Typography variant="body2">{t(key)}</Typography>
              </li>
            ))}
            {role.cannot.map((key) => (
              <li key={key} className={classes.item}>
                <BlockIcon fontSize="small" className={classes.cannot} />
                <Typography variant="body2">{t(key)}</Typography>
              </li>
            ))}
          </ul>
        ) : (
          <Alert severity="info">{t('ridderRoleCustomHelp')}</Alert>
        )}
        {item.id ? (
          <Button
            variant="outlined"
            component={RouterLink}
            to={`/settings/user/${item.id}/connections`}
          >
            {t('ridderAssignVehicles')}
          </Button>
        ) : (
          <Typography variant="body2" color="textSecondary">
            {t('ridderAssignAfterSave')}
          </Typography>
        )}
      </AccordionDetails>
    </Accordion>
  );
};

export default UserRoleAccordion;
