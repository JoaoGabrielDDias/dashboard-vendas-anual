import express from 'express';
import bcrypt from 'bcryptjs';
import Usuario from '../models/usuario.js';

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, message: 'Não autenticado' });
  }

  if (req.session.user.perfil !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Sem permissão de administrador' });
  }

  next();
}

router.use(requireAdmin);

// Listar usuários
router.get('/users', async (_req, res) => {
  try {
    const users = await Usuario.find({})
      .select('-senhaHash')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ ok: true, data: users });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao listar usuários',
      error: error.message
    });
  }
});

// Criar usuário
router.post('/users', async (req, res) => {
  try {
    const { nome, usuario, senha, perfil = 'admin', ativo = true } = req.body;

    if (!nome || !usuario || !senha) {
      return res.status(400).json({
        ok: false,
        message: 'Informe nome, usuário e senha'
      });
    }

    const usuarioNormalizado = String(usuario).trim();

    const exists = await Usuario.findOne({ usuario: usuarioNormalizado }).lean();
    if (exists) {
      return res.status(409).json({
        ok: false,
        message: 'Já existe um usuário com esse login'
      });
    }

    const senhaHash = await bcrypt.hash(String(senha), 10);

    const novo = await Usuario.create({
      nome: String(nome).trim(),
      usuario: usuarioNormalizado,
      senhaHash,
      ativo: Boolean(ativo),
      perfil: String(perfil || 'admin').trim()
    });

    return res.status(201).json({
      ok: true,
      message: 'Usuário criado com sucesso',
      data: {
        _id: novo._id,
        nome: novo.nome,
        usuario: novo.usuario,
        ativo: novo.ativo,
        perfil: novo.perfil,
        createdAt: novo.createdAt,
        updatedAt: novo.updatedAt
      }
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao criar usuário',
      error: error.message
    });
  }
});

// Atualizar nome, login, perfil e ativo
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, usuario, perfil, ativo } = req.body;

    const user = await Usuario.findById(id);
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado'
      });
    }

    if (usuario && String(usuario).trim() !== user.usuario) {
      const exists = await Usuario.findOne({
        usuario: String(usuario).trim(),
        _id: { $ne: id }
      }).lean();

      if (exists) {
        return res.status(409).json({
          ok: false,
          message: 'Já existe um usuário com esse login'
        });
      }

      user.usuario = String(usuario).trim();
    }

    if (nome !== undefined) user.nome = String(nome).trim();
    if (perfil !== undefined) user.perfil = String(perfil).trim();
    if (ativo !== undefined) user.ativo = Boolean(ativo);

    await user.save();

    // mantém sessão sincronizada se o próprio admin editou a si mesmo
    if (req.session?.user?.id === String(user._id)) {
      req.session.user.nome = user.nome;
      req.session.user.usuario = user.usuario;
      req.session.user.perfil = user.perfil;
    }

    return res.json({
      ok: true,
      message: 'Usuário atualizado com sucesso'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao atualizar usuário',
      error: error.message
    });
  }
});

// Atualizar senha
router.put('/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { senha } = req.body;

    if (!senha || String(senha).length < 4) {
      return res.status(400).json({
        ok: false,
        message: 'Informe uma senha válida'
      });
    }

    const user = await Usuario.findById(id);
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado'
      });
    }

    user.senhaHash = await bcrypt.hash(String(senha), 10);
    await user.save();

    return res.json({
      ok: true,
      message: 'Senha atualizada com sucesso'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao atualizar senha',
      error: error.message
    });
  }
});

// Alternar status
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { ativo } = req.body;

    const user = await Usuario.findById(id);
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado'
      });
    }

    user.ativo = Boolean(ativo);
    await user.save();

    return res.json({
      ok: true,
      message: `Usuário ${user.ativo ? 'ativado' : 'desativado'} com sucesso`
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao alterar status',
      error: error.message
    });
  }
});

// Excluir usuário
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.session?.user?.id === id) {
      return res.status(400).json({
        ok: false,
        message: 'Você não pode excluir seu próprio usuário logado'
      });
    }

    const deleted = await Usuario.findByIdAndDelete(id);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado'
      });
    }

    return res.json({
      ok: true,
      message: 'Usuário excluído com sucesso'
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao excluir usuário',
      error: error.message
    });
  }
});

export default router;