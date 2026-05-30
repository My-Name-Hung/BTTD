import mssql, { ConnectionPool } from 'mssql';
import { config } from './index';

let pool: ConnectionPool | null = null;

export async function getConnection(): Promise<ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }

  pool = await mssql.connect({
    server: config.db.server,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    options: {
      encrypt: config.db.encrypt,
      trustServerCertificate: config.db.trustServerCertificate,
    },
  });

  return pool;
}

export async function query<T>(
  sql: string,
  params?: Record<string, unknown>
): Promise<T[]> {
  const connection = await getConnection();
  const request = connection.request();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query(sql);
  return result.recordset as T[];
}

export async function execute<T>(
  procedureName: string,
  params?: Record<string, unknown>
): Promise<{ recordset: T[]; rowsAffected: number[] }> {
  const connection = await getConnection();
  const request = connection.request();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.execute(procedureName);
  return { recordset: result.recordset as T[], rowsAffected: result.rowsAffected };
}

/** Luôn trả về giờ Việt Nam */
export const vnNow = (): string => "GETDATE()";
