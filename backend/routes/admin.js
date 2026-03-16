import express from 'express';
import bcrypt from 'bcryptjs';
import Usuario from '../models/usuario.js';
import AuditLog from '../models/auditLog.js';
import { registerAudit } from '../utils/audit.js';

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

// listar usuários
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

// listar auditoria
router.get('/audit', async (_req, res) => {
  try {
    const rows = await AuditLog.find({}).sort({ createdAt: -1 }).limit(200).lean();
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao carregar auditoria',
      error: error.message
    });
  }
});

// criar usuário
router.post('/users', async (req, res) => {
  try {
    const { nome, usuario, senha, perfil = 'admin', ativo = true } = req.body;

    if (!nome || !usuario || !senha) {
      return res.status(400).json({
        ok: false,
        message: 'Informe nome, usuário e senha'
      });
    }

    if (String(senha).length < 6) {
      return res.status(400).json({
        ok: false,
        message: 'A senha deve ter pelo menos 6 caracteres'
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

    await registerAudit(req, {
      action: 'USER_CREATE',
      entity: 'Usuario',
      entityId: String(novo._id),
      entityLabel: novo.usuario,
      details: {
        nome: novo.nome,
        usuario: novo.usuario,
        perfil: novo.perfil,
        ativo: novo.ativo
      }
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

// atualizar usuário
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

    const before = {
      nome: user.nome,
      usuario: user.usuario,
      perfil: user.perfil,
      ativo: user.ativo
    };

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

    if (ativo !== undefined) {
      if (user.perfil === 'admin' && user.ativo && !Boolean(ativo)) {
        const totalAdminsAtivos = await Usuario.countDocuments({
          perfil: 'admin',
          ativo: true,
          _id: { $ne: user._id }
        });

        if (totalAdminsAtivos === 0) {
          return res.status(400).json({
            ok: false,
            message: 'Não é permitido desativar o último admin ativo'
          });
        }
      }

      user.ativo = Boolean(ativo);
    }

    await user.save();

    if (req.session?.user?.id === String(user._id)) {
      req.session.user.nome = user.nome;
      req.session.user.usuario = user.usuario;
      req.session.user.perfil = user.perfil;
    }

    await registerAudit(req, {
      action: 'USER_UPDATE',
      entity: 'Usuario',
      entityId: String(user._id),
      entityLabel: user.usuario,
      details: {
        before,
        after: {
          nome: user.nome,
          usuario: user.usuario,
          perfil: user.perfil,
          ativo: user.ativo
        }
      }
    });

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

// atualizar senha
router.put('/users/:id/password', async (req, res) => {
  try {
    const { id } = req.params;
    const { senha } = req.body;

    if (!senha || String(senha).length < 6) {
      return res.status(400).json({
        ok: false,
        message: 'Informe uma senha válida com pelo menos 6 caracteres'
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

    await registerAudit(req, {
      action: 'USER_PASSWORD_UPDATE',
      entity: 'Usuario',
      entityId: String(user._id),
      entityLabel: user.usuario,
      details: {
        senhaAlterada: true
      }
    });

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

// alterar status
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

    if (user.perfil === 'admin' && user.ativo && !Boolean(ativo)) {
      const totalAdminsAtivos = await Usuario.countDocuments({
        perfil: 'admin',
        ativo: true,
        _id: { $ne: user._id }
      });

      if (totalAdminsAtivos === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Não é permitido desativar o último admin ativo'
        });
      }
    }

    user.ativo = Boolean(ativo);
    await user.save();

    await registerAudit(req, {
      action: 'USER_STATUS_UPDATE',
      entity: 'Usuario',
      entityId: String(user._id),
      entityLabel: user.usuario,
      details: {
        ativo: user.ativo
      }
    });

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

// excluir usuário
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (req.session?.user?.id === id) {
      return res.status(400).json({
        ok: false,
        message: 'Você não pode excluir seu próprio usuário logado'
      });
    }

    const user = await Usuario.findById(id);
    if (!user) {
      return res.status(404).json({
        ok: false,
        message: 'Usuário não encontrado'
      });
    }

    if (user.perfil === 'admin') {
      const totalAdmins = await Usuario.countDocuments({
        perfil: 'admin',
        ativo: true,
        _id: { $ne: user._id }
      });

      if (user.ativo && totalAdmins === 0) {
        return res.status(400).json({
          ok: false,
          message: 'Não é permitido excluir o último admin ativo'
        });
      }
    }

    await Usuario.findByIdAndDelete(id);

    await registerAudit(req, {
      action: 'USER_DELETE',
      entity: 'Usuario',
      entityId: String(user._id),
      entityLabel: user.usuario,
      details: {
        nome: user.nome,
        usuario: user.usuario,
        perfil: user.perfil,
        ativo: user.ativo
      }
    });

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