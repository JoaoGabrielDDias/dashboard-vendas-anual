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

    let validos = 0;
    let ignorados = 0;

    for (const doc of docs) {
      const ano = Math.trunc(toNumberBR(
        doc.ano ?? doc.Ano ?? doc['ANO'] ?? doc['Ano']
      ));

      const mes = Math.trunc(toNumberBR(
        doc.mes ?? doc.Mês ?? doc.Mes ?? doc['MES'] ?? doc['Mês'] ?? doc['Mes']
      ));

      const dia = Math.trunc(toNumberBR(
        doc.dia ?? doc.Dia ?? doc['DIA'] ?? doc['Dia']
      ));

      if (!ano || !mes || !dia) {
        ignorados++;
        continue;
      }

      validos++;

      const venda = toNumberBR(
        doc.vlr_venda_paga_total ??
        doc.VlrVendaPagaTotal ??
        doc['vlr_venda_paga_total'] ??
        doc['Vlr Venda Paga Total']
      );

      const meta = toNumberBR(
        doc.vlr_meta ??
        doc.VlrMeta ??
        doc['vlr_meta'] ??
        doc['Vlr Meta']
      );

      const desvioNaoCalc = toNumberBR(
        doc.vlr_desvio_meta_nao_calcados ??
        doc['vlr_desvio_meta_nao_calcados'] ??
        doc['Vlr Desvio Meta Não Calçados'] ??
        doc['Vlr Desvio Meta Nao Calcados']
      );

      const desvioCalc = toNumberBR(
        doc.vlr_desvio_meta_calcados ??
        doc['vlr_desvio_meta_calcados'] ??
        doc['Vlr Desvio Meta Calçados'] ??
        doc['Vlr Desvio Meta Calcados']
      );

      const desvioMdsaaVlr = toNumberBR(
        doc.vlr_desvio_mdsaa ??
        doc['vlr_desvio_mdsaa'] ??
        doc['Vlr Desvio Mdsaa']
      );

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
      validos,
      ignorados,
      sampleKeys: docs[0] ? Object.keys(docs[0]) : [],
      sampleDoc: docs[0] || null,
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