import express from 'express';
import Venda from '../models/venda.js';

const router = express.Router();

function toNumberBR(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let s = String(value).trim();
  if (!s) return 0;

  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\s+/g, '');
  s = s.replace(/^R\$/i, '');
  s = s.replace(/[^0-9,.-]/g, '');

  const hasComma = s.includes(',');
  const hasDot = s.includes('.');

  if (hasComma && hasDot) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (hasComma && !hasDot) {
    s = s.replace(',', '.');
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

router.get('/', async (req, res) => {
  try {
    const dados = await Venda.find({}).lean();

    return res.json({
      ok: true,
      total: dados.length,
      data: dados
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar vendas',
      error: error.message
    });
  }
});

router.get('/normalizado', async (req, res) => {
  try {
    const docs = await Venda.find({}).lean();
    const grouped = new Map();

    for (const doc of docs) {
      const ano = Math.trunc(toNumberBR(doc.ano));
      const mes = Math.trunc(toNumberBR(doc.mes));
      const dia = Math.trunc(toNumberBR(doc.dia));

      if (!ano || !mes || !dia) continue;

      const venda = toNumberBR(doc.vlr_venda_paga_total);
      const meta = toNumberBR(doc.vlr_meta);
      const desvioNaoCalc = toNumberBR(doc.vlr_desvio_meta_nao_calcados);
      const desvioCalc = toNumberBR(doc.vlr_desvio_meta_calcados);
      const desvioMdsaaVlr = toNumberBR(doc.vlr_desvio_mdsaa);

      const key = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

      if (!grouped.has(key)) {
        grouped.set(key, {
          ano,
          mes,
          dia,
          venda: 0,
          meta: 0,
          desvioNaoCalc: 0,
          desvioCalc: 0,
          desvioMdsaaVlr: 0
        });
      }

      const current = grouped.get(key);
      current.venda += venda;
      current.meta += meta;
      current.desvioNaoCalc += desvioNaoCalc;
      current.desvioCalc += desvioCalc;
      current.desvioMdsaaVlr += desvioMdsaaVlr;
    }

    const data = Array.from(grouped.values()).sort(
      (a, b) => a.ano - b.ano || a.mes - b.mes || a.dia - b.dia
    );

    const anosDisponiveis = [...new Set(data.map(r => r.ano))].sort((a, b) => a - b);

    return res.json({
      ok: true,
      totalBruto: docs.length,
      totalConsolidado: data.length,
      anosDisponiveis,
      data
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar dados normalizados',
      error: error.message
    });
  }
});

export default router;