import mongoose from 'mongoose';

const vendaSchema = new mongoose.Schema(
  {
    ano: { type: Number, required: true },
    mes: { type: Number, required: true },
    dia: { type: Number, required: true },

    vlr_venda_paga_total: { type: Number, default: 0 },
    vlr_meta: { type: Number, default: 0 },

    vlr_desvio_meta: { type: Number, default: 0 },
    pct_desvio_meta: { type: Number, default: 0 },

    vlr_desvio_meta_nao_calcados: { type: Number, default: 0 },
    vlr_desvio_meta_calcados: { type: Number, default: 0 },

    vlr_desvio_mdsaa: { type: Number, default: 0 },
    pct_desvio_mdsaa: { type: Number, default: 0 },

    pct_ee: { type: Number, default: 0 },
    qtd_cupons_2: { type: Number, default: 0 },
    qtd_item: { type: Number, default: 0 },
    itens_por_cliente_2: { type: Number, default: 0 },
    ticket_medio_2: { type: Number, default: 0 },
    preco_medio_2: { type: Number, default: 0 }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

vendaSchema.index({ ano: 1, mes: 1, dia: 1 }, { unique: true });

const Venda = mongoose.model('Venda', vendaSchema);

export default Venda;