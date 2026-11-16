import { useTheme, useMediaQuery } from '@mui/material';
import { useSelector } from 'react-redux';
import { makeStyles } from 'tss-react/mui';
import logo from '../resources/images/logo.png';

const useStyles = makeStyles()((theme) => ({
  image: {
    alignSelf: 'center',
    maxWidth: '240px',
    maxHeight: '120px',
    width: 'auto',
    height: 'auto',
    margin: theme.spacing(2),
  },
}));

const LogoImage = ({ className }) => {
  const theme = useTheme();
  const { classes, cx } = useStyles();

  const expanded = !useMediaQuery(theme.breakpoints.down('lg'));

  const customLogo = useSelector((state) => state.session.server.attributes?.logo);
  const logoInverted = useSelector((state) => state.session.server.attributes?.logoInverted);

  const imageClass = cx(classes.image, className);
  if (customLogo) {
    if (expanded && logoInverted) {
      return <img className={imageClass} src={logoInverted} alt="" />;
    }
    return <img className={imageClass} src={customLogo} alt="" />;
  }
  return <img className={imageClass} src={logo} alt="Ridder" />;
};

export default LogoImage;
