import { useState, useEffect } from 'react';

function getStoredPermissions(): string[] {
  try {
    const p = localStorage.getItem('permissions');
    return p ? JSON.parse(p) : [];
  } catch {
    return [];
  }
}

export const usePermissions = () => {
  const [permissions, setPermissions] = useState<string[]>(getStoredPermissions);

  useEffect(() => {
    setPermissions(getStoredPermissions());
  }, []);

  const hasPermission = (permission: string) => {
    return permissions.includes(permission);
  };

  return { permissions, hasPermission };
};