import { useState } from 'react';
import { useTranslation } from '../../common/components/LocalizationProvider';
import { useAsyncTask } from '../../reactHelper';
import { detectRole, fetchEngineAccess, needsEngineCheck, roleTitleKey } from '../common/userRoles';

// Rol del usuario para la lista. Solo consulta los comandos de motor cuando hace falta
// para distinguir "Cliente con bloqueo" de "Cliente sin bloqueo".
const UserRoleValue = ({ user }) => {
  const t = useTranslation();
  const [engineAccess, setEngineAccess] = useState(null);

  useAsyncTask(
    async ({ signal }) => {
      if (needsEngineCheck(user)) {
        setEngineAccess(await fetchEngineAccess(user.id, signal));
      }
    },
    [user],
  );

  return t(roleTitleKey(detectRole(user, engineAccess)));
};

export default UserRoleValue;
