import React from 'react';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { useCountUp } from '../../hooks/useCountUp';

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  delay?: number;
  loading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  color,
  delay = 0,
  loading = false,
}) => {
  const displayValue = useCountUp(value, 1000, !loading);

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card
        sx={{
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          bgcolor: color,
          color: '#fff',
          border: '2px solid rgba(255,255,255,0.25)',
          boxShadow: '0 4px 16px rgba(50, 90, 114, 0.15)',
        }}
      >
        <CardContent sx={{ position: 'relative', zIndex: 1, p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, letterSpacing: 0.3 }}>
                {title}
              </Typography>
              <Typography
                variant="h3"
                fontWeight={800}
                component={motion.span}
                key={displayValue}
                initial={{ opacity: 0.6, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                sx={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {loading ? '—' : displayValue}
              </Typography>
            </Box>
            <Box
              sx={{
                width: 52,
                height: 52,
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.35)',
                '& svg': { fontSize: 32 },
              }}
            >
              {icon}
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default StatCard;
