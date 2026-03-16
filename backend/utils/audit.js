import AuditLog from '../models/auditLog.js';

export async function registerAudit(req, payload) {
  try {
    await AuditLog.create({
      actor: {
        id: req.session?.user?.id || '',
        nome: req.session?.user?.nome || '',
        usuario: req.session?.user?.usuario || '',
        perfil: req.session?.user?.perfil || ''
      },
      action: payload.action,
      entity: payload.entity,
      entityId: payload.entityId || '',
      entityLabel: payload.entityLabel || '',
      details: payload.details || {},
      ip: req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.socket?.remoteAddress || '',
      userAgent: req.headers['user-agent'] || ''
    });
  } catch (error) {
    console.error('Erro ao registrar auditoria:', error.message);
  }
}