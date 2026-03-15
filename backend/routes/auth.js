import express from 'express';
import bcrypt from 'bcryptjs';
import Usuario from '../models/usuario.js';

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { usuario, senha } = req.body;

    if (!usuario || !senha) {
      return res.status(400).json({
        ok: false,
        message: 'Informe usuário e senha'
      });
    }

    const user = await Usuario.findOne({
      usuario: String(usuario).trim()
    });

    if (!user || !user.ativo) {
      return res.status(401).json({
        ok: false,
        message: 'Usuário ou senha inválidos'
      });
    }

    const senhaOk = await bcrypt.compare(String(senha), user.senhaHash);

    if (!senhaOk) {
      return res.status(401).json({
        ok: false,
        message: 'Usuário ou senha inválidos'
      });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({
          ok: false,
          message: 'Erro ao iniciar sessão'
        });
      }

      req.session.user = {
        id: String(user._id),
        nome: user.nome,
        usuario: user.usuario,
        perfil: user.perfil
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({
            ok: false,
            message: 'Erro ao salvar sessão'
          });
        }

        return res.json({
          ok: true,
          user: req.session.user
        });
      });
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao efetuar login',
      error: error.message
    });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('dashboard.sid');
    return res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({
      ok: false,
      authenticated: false
    });
  }

  return res.json({
    ok: true,
    authenticated: true,
    user: req.session.user
  });
});

export default router;