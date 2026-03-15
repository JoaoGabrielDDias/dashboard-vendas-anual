import mongoose from 'mongoose';

const uploadHistorySchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileType: { type: String, default: '', trim: true },
    uploadedBy: {
      id: { type: String, default: '' },
      nome: { type: String, default: '' },
      usuario: { type: String, default: '' }
    },
    totalLinhas: { type: Number, default: 0 },
    validas: { type: Number, default: 0 },
    novas: { type: Number, default: 0 },
    duplicadasBanco: { type: Number, default: 0 },
    duplicadasArquivo: { type: Number, default: 0 },
    invalidas: { type: Number, default: 0 },
    status: { type: String, default: 'preview', trim: true },
    resumo: { type: String, default: '', trim: true }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

const UploadHistory = mongoose.model('UploadHistory', uploadHistorySchema);

export default UploadHistory;