import { useCallback, useReducer, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Table, TableRow, TableCell, TableHead, TableBody, Tooltip } from '@mui/material';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import LinkIcon from '@mui/icons-material/Link';
import PublishIcon from '@mui/icons-material/Publish';
import ShareIcon from '@mui/icons-material/Share';
import { useAsyncTask, useCatch, useScrollToLoad, pageSize } from '../reactHelper';
import { groupsActions } from '../store';
import { useTranslation } from '../common/components/LocalizationProvider';
import PageLayout from '../common/components/PageLayout';
import SettingsMenu from './components/SettingsMenu';
import CollectionFab from './components/CollectionFab';
import CollectionActions from './components/CollectionActions';
import TableShimmer from '../common/components/TableShimmer';
import SearchHeader from './components/SearchHeader';
import { useRestriction } from '../common/util/permissions';
import useSettingsStyles from './common/useSettingsStyles';
import fetchOrThrow from '../common/util/fetchOrThrow';

const GroupsPage = () => {
  const { classes } = useSettingsStyles();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const t = useTranslation();

  const limitCommands = useRestriction('limitCommands');
  const shareDisabled = useSelector((state) => state.session.server.attributes.disableShare);
  const user = useSelector((state) => state.session.user);

  const [reloadKey, reload] = useReducer((k) => k + 1, 0);
  const [items, setItems] = useState([]);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [hasMore, setHasMore] = useState(true);

  const loadItems = useCallback(
    async (offset, signal) => {
      const query = new URLSearchParams({ limit: pageSize, offset });
      if (searchKeyword) {
        query.append('keyword', searchKeyword);
      }
      const response = await fetchOrThrow(`/api/groups?${query.toString()}`, { signal });
      const data = await response.json();
      setItems((previous) => (offset ? [...previous, ...data] : data));
      setHasMore(data.length >= pageSize);
    },
    [searchKeyword],
  );

  const sentinelRef = useScrollToLoad(() => loadItems(items.length));

  useAsyncTask(
    async ({ signal }) => {
      void reloadKey;
      setItems([]);
      await loadItems(0, signal);
    },
    [reloadKey, loadItems],
  );

  const actionCommand = {
    key: 'command',
    title: t('deviceCommand'),
    icon: <PublishIcon fontSize="small" />,
    handler: (groupId) => navigate(`/settings/group/${groupId}/command`),
  };

  const actionShare = {
    key: 'share',
    title: t('sharedShare'),
    icon: <ShareIcon fontSize="small" />,
    handler: (groupId) => navigate(`/settings/group/${groupId}/share`),
  };

  const actionConnections = {
    key: 'connections',
    title: t('sharedConnections'),
    icon: <LinkIcon fontSize="small" />,
    handler: (groupId) => navigate(`/settings/group/${groupId}/connections`),
  };

  // Ridder: archivar un grupo oculta todos sus equipos (y los de sus subgrupos) en el mapa y la lista.
  const handleArchive = useCatch(async (item) => {
    const attributes = { ...item.attributes };
    const archived = Boolean(attributes['ridder.archived']);
    delete attributes['ridder.archived'];
    await fetchOrThrow(`/api/groups/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...item,
        attributes: archived ? attributes : { ...attributes, 'ridder.archived': true },
      }),
    });
    const response = await fetchOrThrow('/api/groups');
    dispatch(groupsActions.refresh(await response.json()));
    reload();
  });

  const actionArchive = (item) =>
    item.attributes?.['ridder.archived']
      ? {
          key: 'archive',
          title: t('ridderDeviceUnarchive'),
          icon: <UnarchiveIcon fontSize="small" />,
          handler: () => handleArchive(item),
        }
      : {
          key: 'archive',
          title: t('ridderDeviceArchive'),
          icon: <ArchiveIcon fontSize="small" />,
          handler: () => handleArchive(item),
        };

  return (
    <PageLayout menu={<SettingsMenu />} breadcrumbs={['settingsTitle', 'settingsGroups']}>
      <SearchHeader keyword={searchKeyword} setKeyword={setSearchKeyword} />
      <Table className={classes.table}>
        <TableHead>
          <TableRow>
            <TableCell>{t('sharedName')}</TableCell>
            <TableCell className={classes.columnAction} />
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell>
                {item.name}
                {item.attributes?.['ridder.archived'] && (
                  <Tooltip title="Archivado">
                    <ArchiveIcon
                      fontSize="inherit"
                      color="disabled"
                      sx={{ ml: 1, verticalAlign: 'middle' }}
                    />
                  </Tooltip>
                )}
              </TableCell>
              <TableCell className={classes.columnAction} padding="none">
                <CollectionActions
                  itemId={item.id}
                  editPath="/settings/group"
                  endpoint="groups"
                  onReload={reload}
                  customActions={[
                    actionArchive(item),
                    actionConnections,
                    ...(!limitCommands ? [actionCommand] : []),
                    ...(!shareDisabled && !user.temporary ? [actionShare] : []),
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
          {hasMore && (
            <TableShimmer ref={items.length > 0 ? sentinelRef : null} columns={2} endAction />
          )}
        </TableBody>
      </Table>
      <CollectionFab editPath="/settings/group" />
    </PageLayout>
  );
};

export default GroupsPage;
