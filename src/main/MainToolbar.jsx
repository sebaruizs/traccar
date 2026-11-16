import { useState, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  IconButton,
  OutlinedInput,
  InputAdornment,
  Popover,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Badge,
  ListItemButton,
  ListItemText,
  Tooltip,
  Chip,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useTheme } from '@mui/material/styles';
import MapIcon from '@mui/icons-material/Map';
import DnsIcon from '@mui/icons-material/Dns';
import AddIcon from '@mui/icons-material/Add';
import TuneIcon from '@mui/icons-material/Tune';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from '../common/components/LocalizationProvider';
import { useDeviceReadonly } from '../common/util/permissions';
import DeviceRow from './DeviceRow';
import { isGroupArchived, isDeviceArchived } from '../common/util/archived';
import { reportedMatches } from '../common/util/reported';
import dayjs from 'dayjs';

const useStyles = makeStyles()((theme) => ({
  toolbar: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    padding: theme.spacing(1.5, 2, 1.25),
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  },
  search: {
    backgroundColor: theme.palette.action.hover,
    '& fieldset': {
      border: 'none',
    },
  },
  // Ridder: filtros rápidos como chips (Todos, En línea, Sin señal, Bloqueados, Archivados).
  chips: {
    display: 'flex',
    gap: theme.spacing(0.75),
    overflowX: 'auto',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
    '& .MuiChip-root': {
      flexShrink: 0,
    },
  },
  count: {
    marginLeft: theme.spacing(0.5),
    fontWeight: 500,
    opacity: 0.75,
  },
  filterPanel: {
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
    gap: theme.spacing(2),
    width: theme.dimensions.drawerWidthTablet,
  },
}));

const MainToolbar = ({
  filteredDevices,
  devicesOpen,
  setDevicesOpen,
  keyword,
  setKeyword,
  filter,
  setFilter,
  filterSort,
  setFilterSort,
  filterMap,
  setFilterMap,
  showArchived,
  setShowArchived,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const navigate = useNavigate();
  const t = useTranslation();

  const deviceReadonly = useDeviceReadonly();

  const groups = useSelector((state) => state.groups.items);
  const devices = useSelector((state) => state.devices.items);
  const devicesLoaded = useSelector((state) => state.devices.loaded);
  const geofences = useSelector((state) => state.geofences.items);

  const toolbarRef = useRef();
  const inputRef = useRef();
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [devicesAnchorEl, setDevicesAnchorEl] = useState(null);

  const active = Object.values(devices).filter((device) => !isDeviceArchived(device, groups));
  // Ridder: chips por última señal (hoy, 1 a 3 días, más de 5 días) con su cantidad.
  const now = dayjs();
  const quickFilters = [
    { key: 'all', label: t('ridderFilterAll') },
    { key: 'today', label: t('ridderFilterToday') },
    { key: 'threeDays', label: t('ridderFilterThreeDays') },
    { key: 'overFive', label: t('ridderFilterOverFive') },
  ];
  const counts = Object.fromEntries(
    quickFilters.map((item) => [
      item.key,
      active.filter((device) => reportedMatches(device, item.key, now)).length,
    ]),
  );
  counts.archived = Object.keys(devices).length - active.length;

  const isQuickSelected = (item) => !showArchived && (filter.reported || 'all') === item.key;
  const selectQuick = (item) => {
    setShowArchived(false);
    setFilter({ ...filter, reported: item.key });
  };

  const formatCount = (value) => value.toLocaleString('es');

  return (
    <div ref={toolbarRef} className={classes.toolbar}>
      <div className={classes.row}>
        <IconButton edge="start" onClick={() => setDevicesOpen(!devicesOpen)}>
          {devicesOpen ? <MapIcon /> : <DnsIcon />}
        </IconButton>
        <OutlinedInput
          ref={inputRef}
          className={classes.search}
          placeholder={t('ridderSearchPlaceholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onFocus={() => setDevicesAnchorEl(toolbarRef.current)}
          onBlur={() => setDevicesAnchorEl(null)}
          startAdornment={
            <InputAdornment position="start">
              <SearchIcon fontSize="small" color="action" />
            </InputAdornment>
          }
          endAdornment={
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                onClick={() => setFilterAnchorEl(inputRef.current)}
              >
                <Badge
                  color="info"
                  variant="dot"
                  invisible={!filter.groups.length && !filter.geofences.length}
                >
                  <TuneIcon fontSize="small" />
                </Badge>
              </IconButton>
            </InputAdornment>
          }
          size="small"
          fullWidth
        />
        <IconButton
          edge="end"
          onClick={() => navigate('/settings/device')}
          disabled={deviceReadonly}
        >
          <Tooltip
            open={!deviceReadonly && devicesLoaded && Object.keys(devices).length === 0}
            title={t('deviceRegisterFirst')}
            arrow
          >
            <AddIcon />
          </Tooltip>
        </IconButton>
      </div>
      <div className={classes.chips}>
        {quickFilters.map((item) => (
          <Chip
            key={item.key}
            size="medium"
            label={
              <>
                {item.label}
                <span className={classes.count}>{formatCount(counts[item.key])}</span>
              </>
            }
            color={isQuickSelected(item) ? 'primary' : 'default'}
            variant={isQuickSelected(item) ? 'filled' : 'outlined'}
            onClick={() => selectQuick(item)}
          />
        ))}
        {counts.archived > 0 && (
          <Chip
            size="medium"
            label={
              <>
                {t('ridderFilterArchived')}
                <span className={classes.count}>{formatCount(counts.archived)}</span>
              </>
            }
            color={showArchived ? 'primary' : 'default'}
            variant={showArchived ? 'filled' : 'outlined'}
            onClick={() => {
              setShowArchived(!showArchived);
              setFilter({ ...filter, reported: 'all' });
            }}
          />
        )}
      </div>
      <Popover
        open={!!devicesAnchorEl && !devicesOpen}
        anchorEl={devicesAnchorEl}
        onClose={() => setDevicesAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: Number(theme.spacing(2).slice(0, -2)),
        }}
        marginThreshold={0}
        slotProps={{
          paper: {
            style: { width: `calc(${toolbarRef.current?.clientWidth}px - ${theme.spacing(4)})` },
          },
        }}
        elevation={1}
        disableAutoFocus
        disableEnforceFocus
      >
        {filteredDevices.slice(0, 3).map((_, index) => (
          <div key={filteredDevices[index].id} style={{ height: 68 }}>
            <DeviceRow devices={filteredDevices} index={index} />
          </div>
        ))}
        {filteredDevices.length > 3 && (
          <ListItemButton alignItems="center" onClick={() => setDevicesOpen(true)}>
            <ListItemText primary={t('notificationAlways')} style={{ textAlign: 'center' }} />
          </ListItemButton>
        )}
      </Popover>
      <Popover
        open={!!filterAnchorEl}
        anchorEl={filterAnchorEl}
        onClose={() => setFilterAnchorEl(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <div className={classes.filterPanel}>
          <FormControl>
            <InputLabel>{t('settingsGroups')}</InputLabel>
            <Select
              label={t('settingsGroups')}
              value={filter.groups}
              onChange={(e) => setFilter({ ...filter, groups: e.target.value })}
              multiple
            >
              {Object.values(groups)
                .filter((group) => showArchived || !isGroupArchived(groups, group.id))
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((group) => (
                  <MenuItem key={group.id} value={group.id}>
                    {isGroupArchived(groups, group.id) ? `${group.name} (archivado)` : group.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('sharedGeofences')}</InputLabel>
            <Select
              label={t('sharedGeofences')}
              value={filter.geofences}
              onChange={(e) => setFilter({ ...filter, geofences: e.target.value })}
              multiple
            >
              {Object.values(geofences)
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((geofence) => (
                  <MenuItem key={geofence.id} value={geofence.id}>
                    {geofence.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>{t('sharedSortBy')}</InputLabel>
            <Select
              label={t('sharedSortBy')}
              value={filterSort}
              onChange={(e) => setFilterSort(e.target.value)}
            >
              <MenuItem value="">{' '}</MenuItem>
              <MenuItem value="name">{t('sharedName')}</MenuItem>
              <MenuItem value="lastUpdate">{t('deviceLastUpdate')}</MenuItem>
            </Select>
          </FormControl>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox checked={filterMap} onChange={(e) => setFilterMap(e.target.checked)} />
              }
              label={t('sharedFilterMap')}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={showArchived}
                  onChange={(e) => {
                    setShowArchived(e.target.checked);
                    setFilter({ ...filter, reported: 'all' });
                  }}
                />
              }
              label={t('ridderShowArchived')}
            />
          </FormGroup>
        </div>
      </Popover>
    </div>
  );
};

export default MainToolbar;
