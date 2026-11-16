import fetchOrThrow from '../../common/util/fetchOrThrow';

// Roles de Ridder expresados con los permisos nativos de Traccar. El servidor es quien los
// hace cumplir; la web solo los agrupa con nombres claros.
const clientFields = {
  administrator: false,
  readonly: true,
  deviceReadonly: true,
  limitCommands: true,
  disableReports: false,
  userLimit: 0,
  deviceLimit: 0,
};

export const userRoles = [
  {
    id: 'admin',
    fields: { administrator: true },
    engine: true,
    can: ['ridderCanEverything'],
    cannot: [],
  },
  {
    id: 'operator',
    fields: {
      administrator: false,
      readonly: false,
      deviceReadonly: false,
      limitCommands: false,
      disableReports: false,
      userLimit: 0,
      deviceLimit: -1,
    },
    engine: true,
    can: [
      'ridderCanSeeAssigned',
      'ridderCanEngine',
      'ridderCanEditVehicles',
      'ridderCanZones',
      'ridderCanReports',
    ],
    cannot: ['ridderCannotUsers'],
  },
  {
    id: 'clientEngine',
    fields: clientFields,
    engine: true,
    can: ['ridderCanSeeAssigned', 'ridderCanEngine', 'ridderCanReports'],
    cannot: ['ridderCannotEdit', 'ridderCannotOtherCommands'],
  },
  {
    id: 'client',
    fields: clientFields,
    engine: false,
    can: ['ridderCanSeeAssigned', 'ridderCanReports'],
    cannot: ['ridderCannotEdit', 'ridderCannotCommands'],
  },
  {
    id: 'viewer',
    fields: { ...clientFields, disableReports: true },
    engine: false,
    can: ['ridderCanSeeAssigned'],
    cannot: ['ridderCannotEdit', 'ridderCannotCommands', 'ridderCannotReports'],
  },
];

export const roleTitleKey = (roleId) =>
  `ridderRole${roleId.charAt(0).toUpperCase()}${roleId.slice(1)}`;

const matchesFields = (user, fields) =>
  Object.entries(fields).every(([key, value]) => {
    if (key === 'userLimit' || key === 'deviceLimit') {
      // Para límites solo importa si permite crear (distinto de 0) o no.
      return ((user[key] || 0) === 0) === (value === 0);
    }
    return Boolean(user[key]) === value;
  });

// Devuelve el id del rol o "custom". engineAccess es null mientras no se sabe.
export const detectRole = (user, engineAccess) => {
  if (user.administrator) {
    return 'admin';
  }
  const candidates = userRoles.filter(
    (role) => role.id !== 'admin' && matchesFields(user, role.fields),
  );
  if (candidates.length === 1) {
    return candidates[0].id;
  }
  if (candidates.length > 1 && engineAccess !== null) {
    return candidates.find((role) => role.engine === engineAccess)?.id || 'custom';
  }
  return candidates.length ? candidates[0].id : 'custom';
};

export const needsEngineCheck = (user) =>
  !user.administrator && Boolean(user.limitCommands) && Boolean(user.readonly);

const engineTypes = ['engineStop', 'engineResume'];

export const fetchEngineAccess = async (userId, signal) => {
  const response = await fetchOrThrow(`/api/commands?userId=${userId}`, { signal });
  const commands = await response.json();
  return commands.some((command) => command.type === 'engineStop');
};

// Comandos guardados "Bloquear motor" y "Desbloquear motor", creados una sola vez.
const ensureEngineCommands = async (t) => {
  const response = await fetchOrThrow('/api/commands?all=true');
  const existing = await response.json();
  return Promise.all(
    engineTypes.map(async (type) => {
      const found = existing.find((command) => command.type === type);
      if (found) {
        return found;
      }
      const created = await fetchOrThrow('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: t(type === 'engineStop' ? 'ridderEngineBlock' : 'ridderEngineUnblock'),
          type,
          attributes: {},
        }),
      });
      return created.json();
    }),
  );
};

// Asigna o quita al usuario los comandos guardados de motor según su rol.
export const syncEngineAccess = async (userId, allowed, t) => {
  const response = await fetchOrThrow(`/api/commands?userId=${userId}`);
  const linked = (await response.json()).filter((command) => engineTypes.includes(command.type));
  if (allowed) {
    const commands = await ensureEngineCommands(t);
    const missing = commands.filter((command) => !linked.some((item) => item.id === command.id));
    await Promise.all(
      missing.map((command) =>
        fetchOrThrow('/api/permissions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, commandId: command.id }),
        }),
      ),
    );
  } else {
    await Promise.all(
      linked.map((command) =>
        fetchOrThrow('/api/permissions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, commandId: command.id }),
        }),
      ),
    );
  }
};
