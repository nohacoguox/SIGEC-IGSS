import { randomBytes } from 'crypto';

export function createTemporaryPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%*-_';
  const all = `${upper}${lower}${digits}${symbols}`;
  const randomCharacter = (pool: string) => pool[randomBytes(1)[0] % pool.length];
  const password = [
    randomCharacter(upper),
    randomCharacter(lower),
    randomCharacter(digits),
    randomCharacter(symbols),
    ...Array.from({ length: 12 }, () => randomCharacter(all)),
  ];

  for (let index = password.length - 1; index > 0; index -= 1) {
    const swapIndex = randomBytes(1)[0] % (index + 1);
    [password[index], password[swapIndex]] = [password[swapIndex], password[index]];
  }
  return password.join('');
}

// Validación de contraseña: mínimo 8 caracteres, al menos una mayúscula, un número y un símbolo
export const validatePassword = (password: string): { valid: boolean; message?: string } => {
  if (!password || password.length < 8) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres.' };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: 'La contraseña debe incluir al menos una letra mayúscula.' };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: 'La contraseña debe incluir al menos un número.' };
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return { valid: false, message: 'La contraseña debe incluir al menos un símbolo (ej. ! @ # $ %).' };
  }
  return { valid: true };
};
