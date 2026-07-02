import path from 'node:path';
import { openDb } from './db';

const dbPath = process.env.ACTIVITYDASH_DB_PATH ?? path.join(process.cwd(), 'activitydash.db');

export const db = openDb(dbPath);
