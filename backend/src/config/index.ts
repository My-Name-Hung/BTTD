import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  db: {
    server: process.env.DB_SERVER || '113.161.208.240',
    port: parseInt(process.env.DB_PORT || '3433', 10),
    database: process.env.DB_NAME || 'DBXMTD',
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'XMTD@@@2025',
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'bttd_secret_key_2025_very_secure',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  email: {
    user: process.env.EMAIL_USER || 'h3481905@gmail.com',
    pass: process.env.EMAIL_PASS || 'iispotnkmslnobal',
    adminEmail: process.env.ADMIN_EMAIL || 'thanhhung11112002@gmail.com',
  },
};
