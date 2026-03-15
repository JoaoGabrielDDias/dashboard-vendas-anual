import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dns from 'node:dns';
import Usuario from './models/usuario.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);
dotenv.config();

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);

    const usuarioAtual = 'admin';
    const novoUsuario = 'joao.dias';
    const novaSenha = 'Grupo@SBF2024';
    const novoNome = 'João Dias';

    const user = await Usuario.findOne({ usuario: usuarioAtual });

    if (!user) {
      console.log('Usuário não encontrado');
      process.exit(0);
    }

    user.nome = novoNome;
    user.usuario = novoUsuario;
    user.senhaHash = await bcrypt.hash(novaSenha, 10);
    user.ativo = true;
    user.perfil = 'admin';

    await user.save();

    console.log('Usuário atualizado com sucesso');
    console.log('Novo usuário:', novoUsuario);
    console.log('Nova senha:', novaSenha);

    process.exit(0);
  } catch (error) {
    console.error('Erro:', error.message);
    process.exit(1);
  }
}

run();