import React from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import type { OrtografiaSugerencia } from '../types';
import { construirTextoCorregido } from '../utils';

type SiafOrtografiaDialogProps = {
  open: boolean;
  sugerencias: OrtografiaSugerencia[];
  elegidas: Record<number, string>;
  texto: string;
  onClose: () => void;
  onElegidaChange: (idx: number, value: string) => void;
  onAplicar: (textoCorregido: string) => void;
};

const SiafOrtografiaDialog: React.FC<SiafOrtografiaDialogProps> = ({
  open,
  sugerencias,
  elegidas,
  texto,
  onClose,
  onElegidaChange,
  onAplicar,
}) => {
  const textoCorregido = construirTextoCorregido(texto, sugerencias, elegidas);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Correcciones ortográficas ({sugerencias.length})</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Elija la palabra correcta en cada caso. Si ninguna aplica, seleccione &quot;No corregir&quot;.
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
          {sugerencias.map((s, idx) => (
            <Paper key={`${s.original}-${s.offset}`} variant="outlined" sx={{ p: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ textDecoration: 'line-through' }} color="error">
                  {s.original}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  →
                </Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                  <Select
                    value={elegidas[idx] ?? ''}
                    onChange={(e) => onElegidaChange(idx, String(e.target.value))}
                    displayEmpty
                  >
                    <MenuItem value="">
                      <em>No corregir</em>
                    </MenuItem>
                    {s.options.map((opcion) => (
                      <MenuItem key={opcion} value={opcion}>
                        {opcion}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
              {s.message ? (
                <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                  {s.message}
                </Typography>
              ) : null}
            </Paper>
          ))}
        </Box>
        <Typography variant="subtitle2" gutterBottom>
          Texto corregido
        </Typography>
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
            {textoCorregido}
          </Typography>
        </Paper>
        {textoCorregido.length > 500 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            El texto corregido supera 500 caracteres. Acórtelo antes de guardar el SIAF.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={() => onAplicar(textoCorregido)}>
          Aplicar correcciones
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SiafOrtografiaDialog;
