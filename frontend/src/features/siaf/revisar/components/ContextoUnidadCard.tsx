import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import type { MetaDD } from '../types';

type ContextoUnidadCardProps = {
  meta: MetaDD;
};

const ContextoUnidadCard: React.FC<ContextoUnidadCardProps> = ({ meta }) => {
  if (!meta.unidadAsignada) return null;
  return (
    <Paper
      elevation={0}
      sx={{
        mb: 3,
        p: 2,
        borderRadius: 2,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'action.hover',
      }}
    >
      <Typography variant="subtitle2" sx={{ textTransform: 'uppercase', letterSpacing: 0.8, mb: 0.5, color: 'grey.800', fontWeight: 700 }}>
        Contexto de revisión
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'baseline' }}>
        <Box>
          <Typography component="span" variant="body2" sx={{ color: 'grey.700', fontWeight: 500 }}>Unidad asignada: </Typography>
          <Typography component="span" variant="body2" fontWeight="600" color="primary.main">{meta.unidadAsignada}</Typography>
        </Box>
        {meta.departamento && (
          <Box>
            <Typography component="span" variant="body2" sx={{ color: 'grey.700', fontWeight: 500 }}>Departamento: </Typography>
            <Typography component="span" variant="body2" fontWeight="600" color="primary.main">{meta.departamento}</Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
};

export default ContextoUnidadCard;
