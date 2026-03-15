import express from 'express';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import cors from 'cors';
import path from 'path';
import session from 'express-session';
import { fileURLToPath } from 'url';
import dns from 'node:dns';
import helmet from 'helmet';


import vendasRouter from './routes/vendas.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import importsRouter from './routes/imports.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

function requireAuth(req, res, next) {
  if (req.session?.user) return next();
  return res.redirect('/login');
}

function requireAdminPage(req, res, next) {
  if (!req.session?.user) return res.redirect('/login');
  if (req.session.user.perfil !== 'admin') return res.redirect('/');
  return next();
}

app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.use(
  cors({
    origin: true,
    credentials: true
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    name: 'dashboard.sid',
    secret: process.env.SESSION_SECRET || 'troque_essa_chave',
    resave: false,
    saveUninitialized: false,
    proxy: IS_PROD,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: IS_PROD,
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

app.use(
  express.static(publicDir, {
    index: false
  })
);

app.use('/api/auth', authRouter);
app.use('/api/vendas', requireAuth, vendasRouter);
app.use('/api/admin', adminRouter);
app.use('/api/imports', importsRouter);

app.get('/health', (req, res) => {
  res.json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    mongoReadyState: mongoose.connection.readyState,
    authenticated: !!req.session?.user
  });
});

app.get('/login', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  return res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/login.html', (req, res) => {
  if (req.session?.user) return res.redirect('/');
  return res.sendFile(path.join(publicDir, 'login.html'));
});

app.get('/', requireAuth, (req, res) => {
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/index.html', requireAuth, (req, res) => {
  return res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/admin', requireAdminPage, (req, res) => {
  return res.sendFile(path.join(publicDir, 'admin.html'));
});

app.get('/admin.html', requireAdminPage, (req, res) => {
  return res.sendFile(path.join(publicDir, 'admin.html'));
});

app.use((req, res) => {
  if (!req.session?.user) return res.redirect('/login');
  return res.redirect('/');
});

async function startServer() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI não configurado');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB conectado com sucesso');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Servidor rodando na porta ${PORT}`);
    });
  } catch (error) {
    console.error('Erro ao iniciar servidor:', error.message);
    process.exit(1);
  }
}

startServer();