import { z } from 'zod';
import {
  DELETED_USER_IDENTITY_AND_NAME,
  MAX_USER_NAME_LENGTH
} from './statics';

// shared by user profiles and bots, which are users too
export const zUserName = z
  .string()
  .trim()
  .min(1)
  .max(MAX_USER_NAME_LENGTH)
  .refine((val) => val !== DELETED_USER_IDENTITY_AND_NAME, {
    message: 'Protected username'
  });
