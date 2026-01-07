/**
 * Multer Configuration
 */

import multer from 'multer';
import { validateAudioFile } from '../utils/fileValidation.js';

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  try {
    validateAudioFile(file);
    cb(null, true);
  } catch (error) {
    cb(error, false);
  }
};

export const upload = multer({ storage, limits: { fileSize: MAX_FILE_SIZE }, fileFilter });