import { z } from "zod";

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(72, "La contraseña no puede superar 72 caracteres.")
  .regex(/[a-z]/, "Incluya al menos una letra minúscula.")
  .regex(/[A-Z]/, "Incluya al menos una letra mayúscula.")
  .regex(/[0-9]/, "Incluya al menos un número.");
