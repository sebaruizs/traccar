import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()((theme, { size }) => ({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    minWidth: 0,
    maxWidth: '100%',
  },
  plate: {
    display: 'inline-flex',
    alignItems: 'center',
    flexShrink: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: size === 'large' ? theme.spacing(0.5, 1.5, 0.375) : theme.spacing(0.25, 1, 0.125),
    border: `${size === 'large' ? 2 : 1.5}px solid ${theme.palette.plate.border}`,
    borderTop: `${size === 'large' ? 6 : 4}px solid ${theme.palette.plate.band}`,
    borderRadius: size === 'large' ? 6 : 5,
    backgroundColor: theme.palette.plate.background,
    color: theme.palette.plate.text,
    fontWeight: 800,
    fontSize: size === 'large' ? '1.25rem' : '0.875rem',
    lineHeight: 1.3,
    letterSpacing: size === 'large' ? '0.1em' : '0.08em',
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Lo que acompaña a la chapa en el nombre ("MC", "Monedas", "No funciona") va en una etiqueta chica.
  suffix: {
    padding: theme.spacing(0.25, 0.75),
    borderRadius: 6,
    backgroundColor: theme.palette.action.hover,
    color: theme.palette.text.secondary,
    fontSize: size === 'large' ? '0.8125rem' : '0.6875rem',
    fontWeight: 600,
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
}));

// "258ABUG-MC" → chapa 258ABUG y agregado MC; "236ABXV - Monedas" → 236ABXV y Monedas.
export const splitPlate = (name) => {
  const match = /^([0-9A-Z]{6,7})(?:[\s-]+(.+))?$/.exec((name || '').trim());
  if (match) {
    return { plate: match[1], suffix: match[2]?.trim() || '' };
  }
  return { plate: name || '', suffix: '' };
};

// Ridder: el nombre del equipo es la chapa, y se muestra como una patente (borde oscuro y
// franja azul arriba) para que se reconozca de un vistazo en la lista, en la ficha y en el mapa.
const PlateBadge = ({ name, size = 'small', className }) => {
  const { classes, cx } = useStyles({ size });
  const { plate, suffix } = splitPlate(name);
  return (
    <span className={cx(classes.root, className)} title={name}>
      <span className={classes.plate}>{plate}</span>
      {suffix && <span className={classes.suffix}>{suffix}</span>}
    </span>
  );
};

export default PlateBadge;
