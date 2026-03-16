import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actor: {
      id: { type: String, default: '' },
      nome: { type: String, default: '' },
      usuario: { type: String, default: '' },
      perfil: { type: String, default: '' }
    },
    action: { type: String, required: true, trim: true },
    entity: { type: String, required: true, trim: true },
    entityId: { type: String, default: '', trim: true },
    entityLabel: { type: String, default: '', trim: true },
    details: { type: mongoose.Schema.Types.Mixed, default: {} },
    ip: { type: String, default: '', trim: true },
    userAgent: { type: String, default: '', trim: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;