import { useState, useEffect, useCallback } from 'react';
import { hasScreenAccess } from '../config/appScreens';
import api from '../api';

function getStoredPermissions(): string[] {
  try {
    const p = localStorage.getItem('permissions');
    return p ? JSON.parse(p) : [];
  } catch {
    return [];
  }
}

function isSuperAdmin(): boolean {
  const role = (localStorage.getItem('userRole') || '').toLowerCase();
  if (role === 'super administrador') return true;
  try {
    const roles = JSON.parse(localStorage.getItem('userRoles') || '[]') as string[];
    return roles.some((r) => (r || '').toLowerCase() === 'super administrador');
  } catch {
    return false;
  }
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<string[]>(getStoredPermissions);
  const [superAdmin, setSuperAdmin] = useState(isSuperAdmin);

  useEffect(() => {
    setPermissions(getStoredPermissions());
    setSuperAdmin(isSuperAdmin());

    // Refrescar permisos desde el servidor (roles recién asignados)
    const refresh = async () => {
      try {
        const res = await api.get('/auth/me');
        const roles = res.data?.roles ?? [];
        const roleNames: string[] = roles.map((r: { name?: string }) => r.name).filter(Boolean);
        const perms = new Set<string>();
        roles.forEach((r: { permissions?: Array<{ name: string }> }) => {
          r.permissions?.forEach((p) => perms.add(p.name));
        });
        const list = Array.from(perms);
        localStorage.setItem('permissions', JSON.stringify(list));
        if (roleNames[0]) localStorage.setItem('userRole', roleNames[0]);
        localStorage.setItem('userRoles', JSON.stringify(roleNames));
        setPermissions(list);
        setSuperAdmin(roleNames.some((r) => r.toLowerCase() === 'super administrador'));
      } catch {
        /* sin sesión o sin red */
      }
    };
    void refresh();
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (superAdmin) return true;
      return hasScreenAccess(permissions, permission);
    },
    [permissions, superAdmin]
  );

  const hasAnyPermission = useCallback(
    (perms: string[]) => {
      if (superAdmin) return true;
      return perms.some((p) => hasScreenAccess(permissions, p));
    },
    [permissions, superAdmin]
  );

  return { permissions, hasPermission, hasAnyPermission, isSuperAdmin: superAdmin };
};
