import { useMediaQuery, Paper, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import LogoImage from './LogoImage';
import { useTranslation } from '../common/components/LocalizationProvider';

const useStyles = makeStyles()((theme) => ({
  root: {
    display: 'flex',
    height: '100%',
    [theme.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  // Ridder: en escritorio el logo va en la franja azul de la izquierda; en el celular,
  // en una franja azul arriba con el nombre y el lema.
  sidebar: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: theme.palette.secondary.main,
    paddingBottom: theme.spacing(5),
    width: theme.dimensions.sidebarWidth,
    [theme.breakpoints.down('lg')]: {
      width: theme.dimensions.sidebarWidthTablet,
    },
    [theme.breakpoints.down('sm')]: {
      width: 'auto',
      padding: theme.spacing(6, 3, 3),
      justifyContent: 'flex-start',
      gap: theme.spacing(1.5),
    },
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    color: theme.palette.common.white,
    lineHeight: 1.15,
  },
  brandName: {
    fontWeight: 800,
    fontSize: '1.75rem',
    letterSpacing: '-0.02em',
  },
  brandTagline: {
    fontSize: '0.875rem',
    opacity: 0.85,
  },
  mobileLogo: {
    width: 56,
    height: 56,
    margin: 0,
  },
  paper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    borderRadius: 0,
    boxShadow: '-2px 0px 16px rgba(0, 0, 0, 0.25)',
    [theme.breakpoints.up('lg')]: {
      padding: theme.spacing(0, 25, 0, 0),
    },
    [theme.breakpoints.down('sm')]: {
      justifyContent: 'flex-start',
      boxShadow: 'none',
    },
  },
  form: {
    maxWidth: theme.spacing(52),
    padding: theme.spacing(5),
    width: '100%',
    boxSizing: 'border-box',
    [theme.breakpoints.down('sm')]: {
      padding: theme.spacing(3),
    },
  },
}));

const LoginLayout = ({ children }) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const t = useTranslation();

  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const expanded = !useMediaQuery(theme.breakpoints.down('lg'));

  return (
    <main className={classes.root}>
      <div className={classes.sidebar}>
        {expanded && <LogoImage />}
        {phone && (
          <>
            <LogoImage className={classes.mobileLogo} />
            <div className={classes.brand}>
              <Typography component="span" className={classes.brandName}>
                Ridder GPS
              </Typography>
              <Typography component="span" className={classes.brandTagline}>
                {t('ridderLoginTagline')}
              </Typography>
            </div>
          </>
        )}
      </div>
      <Paper className={classes.paper}>
        <form className={classes.form}>{children}</form>
      </Paper>
    </main>
  );
};

export default LoginLayout;
