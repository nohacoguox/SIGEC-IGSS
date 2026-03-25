// frontend/src/context/SiafContext.tsx
import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';
import api from '../api';
import { formatFechaDMA } from '../utils';

// --- Tipos ---
interface Siaf {
  id: string;
  backendId: number;
  date: string;
  unit: string;
  status: string;
  formData: any;
  documentCount: number;
  /** Motivo del último rechazo (cuando status === 'Rechazado') */
  ultimoRechazo?: { comentario: string; fecha: string };
}

interface SiafContextType {
  siafList: Siaf[];
  addSiaf: (newSiafData: any) => void;
  updateSiaf: (siafId: string, updatedSiafData: any) => void;
  loadSiafs: () => Promise<void>;
  clearSiafs: () => void;
}

// --- Contexto ---
const SiafContext = createContext<SiafContextType | undefined>(undefined);

// --- Provider ---
export const SiafProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [siafList, setSiafList] = useState<Siaf[]>([]);

  const loadSiafs = async () => {
    try {
      const response = await api.get('/siaf');
      const siafs = response.data.map((siaf: any) => ({
        id: siaf.correlativo,
        backendId: siaf.id,
        date: formatFechaDMA(siaf.fecha),
        unit: siaf.nombreUnidad,
        status: siaf.estado === 'pendiente' ? 'En Revisión' :
                siaf.estado === 'autorizado' ? 'Aprobado' : 'Rechazado',
        documentCount: (siaf.documentosAdjuntos || []).length,
        ultimoRechazo: siaf.ultimoRechazo || undefined,
        formData: {
          correlativo: siaf.correlativo,
          fecha: siaf.fecha,
          nombreUnidad: siaf.nombreUnidad,
          direccion: siaf.direccion,
          areaId: siaf.area?.id,
          justificacion: siaf.justificacion,
          nombreSolicitante: siaf.nombreSolicitante,
          puestoSolicitante: siaf.puestoSolicitante,
          unidadSolicitante: siaf.unidadSolicitante,
          nombreAutoridad: siaf.nombreAutoridad,
          puestoAutoridad: siaf.puestoAutoridad,
          unidadAutoridad: siaf.unidadAutoridad,
          consistentItem: siaf.consistenteItem,
          items: siaf.items || [],
          subproductos: siaf.subproductos || []
        }
      }));
      setSiafList(siafs);
    } catch (error) {
      console.error('Error al cargar solicitudes SIAF:', error);
    }
  };

  const clearSiafs = () => {
    setSiafList([]);
  };

  // No longer loading on initial mount
  // useEffect(() => {
  //   loadSiafs();
  // }, []);

  const addSiaf = (newSiafFormData: any, backendId?: number) => {
    const newSiaf: Siaf = {
      id: newSiafFormData.correlativo || `TEMP-${String(siafList.length + 1).padStart(3, '0')}`,
      backendId: backendId ?? 0,
      date: formatFechaDMA(newSiafFormData.fecha),
      unit: newSiafFormData.nombreUnidad,
      status: 'En Revisión',
      documentCount: 0,
      formData: newSiafFormData,
    };
    setSiafList(prevList => [newSiaf, ...prevList]);
  };

  const updateSiaf = (siafId: string, updatedSiafData: any) => {
    setSiafList(prevList =>
      prevList.map(siaf => {
        if (siaf.id === siafId) {
          return {
            ...siaf,
            date: formatFechaDMA(updatedSiafData.fecha),
            unit: updatedSiafData.nombreUnidad,
            formData: updatedSiafData,
          };
        }
        return siaf;
      })
    );
  };

  return (
    <SiafContext.Provider value={{ siafList, addSiaf, updateSiaf, loadSiafs, clearSiafs }}>
      {children}
    </SiafContext.Provider>
  );
};

// --- Hook Personalizado ---
export const useSiaf = () => {
  const context = useContext(SiafContext);
  if (context === undefined) {
    throw new Error('useSiaf must be used within a SiafProvider');
  }
  return context;
};
