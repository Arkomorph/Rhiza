import postgres from 'postgres';
import { config } from '../config.js';

const sql = postgres({
  host: config.PG_HOST,
  port: config.PG_PORT,
  user: config.PG_USER,
  password: config.PG_PASSWORD,
  database: config.PG_DB,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export default sql;
