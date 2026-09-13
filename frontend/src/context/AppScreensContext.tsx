import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api';
import {
  AppScreenDefinition,
  FALLBACK_APP_SCREENS,
  FALLBACK_PERMISSION_ALIASES,
  setAppScreensCatalog,
} from '../config/appScreens';

type CatalogSource = 'fallback' | 'api';

interface AppScreensContextValue {
  screens: AppScreenDefinition[];
  aliases: Record<string, string[]>;
  source: CatalogSource;
  loaded: boolean;
  refreshAppScreens: () => Promise<void>;
}

const AppScreensContext = createContext<AppScreensContextValue | null>(null);

export function AppScreensProvider({ children }: { children: React.ReactNode }) {
  const [screens, setScreens] = useState<AppScreenDefinition[]>(FALLBACK_APP_SCREENS);
  const [aliases, setAliases] = useState<Record<string, string[]>>(FALLBACK_PERMISSION_ALIASES);
  const [source, setSource] = useState<CatalogSource>('fallback');
  const [loaded, setLoaded] = useState(false);

  const applyFallback = useCallback(() => {
    setAppScreensCatalog(FALLBACK_APP_SCREENS, FALLBACK_PERMISSION_ALIASES);
    setScreens(FALLBACK_APP_SCREENS);
    setAliases(FALLBACK_PERMISSION_ALIASES);
    setSource('fallback');
  }, []);

  const refreshAppScreens = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      applyFallback();
      setLoaded(true);
      return;
    }
    try {
      const res = await api.get('/app-screens/catalog');
      const nextScreens: AppScreenDefinition[] = res.data?.screens?.length
        ? res.data.screens
        : FALLBACK_APP_SCREENS;
      const nextAliases: Record<string, string[]> = res.data?.aliases ?? FALLBACK_PERMISSION_ALIASES;
      setAppScreensCatalog(nextScreens, nextAliases);
      setScreens(nextScreens);
      setAliases(nextAliases);
      setSource('api');
    } catch {
      applyFallback();
    } finally {
      setLoaded(true);
    }
  }, [applyFallback]);

  useEffect(() => {
    void refreshAppScreens();
  }, [refreshAppScreens]);

  const value = useMemo(
    () => ({ screens, aliases, source, loaded, refreshAppScreens }),
    [screens, aliases, source, loaded, refreshAppScreens]
  );

  return <AppScreensContext.Provider value={value}>{children}</AppScreensContext.Provider>;
}

export function useAppScreens(): AppScreensContextValue {
  const ctx = useContext(AppScreensContext);
  if (!ctx) {
    return {
      screens: FALLBACK_APP_SCREENS,
      aliases: FALLBACK_PERMISSION_ALIASES,
      source: 'fallback',
      loaded: true,
      refreshAppScreens: async () => undefined,
    };
  }
  return ctx;
}
