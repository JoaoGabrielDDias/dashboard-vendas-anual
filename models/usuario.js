import mongoose from 'mongoose';

const usuarioSchema = new mongoose.Schema(
  {
    nome: { type: String, required: true, trim: true },
    usuario: { type: String, required: true, unique: true, trim: true, index: true },
    senhaHash: { type: String, required: true },
    ativo: { type: Boolean, default: true },
    perfil: { type: String, default: 'admin', trim: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const Usuario = mongoose.model('Usuario', usuarioSchema);

export default Usuario;