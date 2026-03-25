import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { Snackbar, Alert, AlertColor } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

export type NotificationSeverity = AlertColor;

interface Notification {
  id: number;
  message: string;
  severity: NotificationSeverity;
  duration?: number;
}

interface NotificationContextType {
  showSuccess: (message: string, duration?: number) => void;
  showError: (message: string, duration?: number) => void;
  showWarning: (message: string, duration?: number) => void;
  showInfo: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

let nextId = 0;

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);

  const show = useCallback((message: string, severity: NotificationSeverity, duration = 5000) => {
    setNotification({
      id: ++nextId,
      message,
      severity,
      duration,
    });
    setOpen(true);
  }, []);

  const showSuccess = useCallback((message: string, duration?: number) => {
    show(message, 'success', duration ?? 4000);
  }, [show]);

  const showError = useCallback((message: string, duration?: number) => {
    show(message, 'error', duration ?? 6000);
  }, [show]);

  const showWarning = useCallback((message: string, duration?: number) => {
    show(message, 'warning', duration ?? 5000);
  }, [show]);

  const showInfo = useCallback((message: string, duration?: number) => {
    show(message, 'info', duration ?? 4000);
  }, [show]);

  const handleClose = useCallback((_?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') return;
    setOpen(false);
    setTimeout(() => setNotification(null), 300);
  }, []);

  return (
    <NotificationContext.Provider value={{ showSuccess, showError, showWarning, showInfo }}>
      {children}
      <AnimatePresence>
        {notification && (
          <Snackbar
            open={open}
            autoHideDuration={notification.duration}
            onClose={handleClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            sx={{ mt: 2 }}
          >
            <motion.div
              key={notification.id}
              initial={{ opacity: 0, y: -50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            >
              <Alert
                onClose={() => handleClose()}
                severity={notification.severity}
                variant="filled"
                elevation={6}
                sx={{
                  minWidth: 320,
                  borderRadius: 2,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                  '& .MuiAlert-icon': { fontSize: 28 },
                  '& .MuiAlert-message': { fontSize: '0.95rem', py: 0.5 },
                }}
              >
                {notification.message}
              </Alert>
            </motion.div>
          </Snackbar>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const context = React.useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};
