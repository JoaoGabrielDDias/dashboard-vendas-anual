import mongoose from 'mongoose';

const vendaSchema = new mongoose.Schema(
  {
    ano: { type: Number, required: true, index: true },
    mes: { type: Number, required: true, index: true },
    dia: { type: Number, required: true, index: true },

    vlr_venda_paga_total: { type: Number, default: 0 },
    vlr_meta: { type: Number, default: 0 },

    vlr_desvio_meta_nao_calcados: { type: Number, default: 0 },
    vlr_desvio_meta_calcados: { type: Number, default: 0 },
    vlr_desvio_mdsaa: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

vendaSchema.index({ ano: 1, mes: 1, dia: 1 });

const Venda = mongoose.model('Venda', vendaSchema);

export default Venda;