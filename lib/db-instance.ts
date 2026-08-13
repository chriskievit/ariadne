import path from 'node:path';
import { openDb } from './db';

const dbPath = process.env.ARIADNE_DB_PATH ?? path.join(process.cwd(), 'ariadne.db');

export const db = openDb(dbPath);
