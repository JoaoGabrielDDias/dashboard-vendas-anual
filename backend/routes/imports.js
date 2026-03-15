import express from 'express';
import multer from 'multer';
import XLSX from 'xlsx';
import Venda from '../models/venda.js';
import UploadHistory from '../models/uploadHistory.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, message: 'Não autenticado' });
  }

  if (req.session.user.perfil !== 'admin') {
    return res.status(403).json({ ok: false, message: 'Sem permissão de administrador' });
  }

  next();
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function toNumberBR(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;

  let s = String(value).trim();
  if (!s) return 0;

  s = s.replace(/\u00A0/g, ' ');
  s = s.replace(/\s+/g, '');
  s = s.replace(/^R\$/i, '');
  s = s.replace(/%/g, '');
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

function parseExcelDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const dateInfo = new Date(utcValue * 1000);
  return new Date(dateInfo.getUTCFullYear(), dateInfo.getUTCMonth(), dateInfo.getUTCDate());
}

function parseDateValue(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return parseExcelDate(value);
  }

  const s = String(value || '').trim();
  if (!s) return null;

  const br = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (br) {
    const dia = Number(br[1]);
    const mes = Number(br[2]);
    const ano = Number(br[3].length === 2 ? `20${br[3]}` : br[3]);
    const d = new Date(ano, mes - 1, dia);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const iso = new Date(s);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

const aliases = {
  date: ['date', 'data'],
  vlr_venda_paga_total: ['vlr_venda_paga_total', 'venda paga total', 'vlr venda paga total'],
  vlr_meta: ['vlr_meta', 'meta', 'vlr meta'],
  vlr_desvio_meta: ['vlr desvio meta', 'vlr_desvio_meta'],
  pct_desvio_meta: ['% desvio meta', 'pct desvio meta', 'percentual desvio meta'],
  vlr_desvio_meta_nao_calcados: [
    'vlr desvio meta nao calcados',
    'vlr desvio meta não calcados',
    'vlr_desvio_meta_nao_calcados'
  ],
  vlr_desvio_meta_calcados: [
    'vlr desvio meta calcados',
    'vlr desvio meta calçados',
    'vlr_desvio_meta_calcados'
  ],
  vlr_desvio_mdsaa: ['vlr desvio mdsaa', 'vlr_desvio_mdsaa'],
  pct_desvio_mdsaa: ['% desvio mdsaa', 'pct desvio mdsaa'],
  pct_ee: ['% ee', 'pct ee'],
  qtd_cupons_2: ['qtd cupons 2', 'qtd_cupons_2'],
  qtd_item: ['qtd_item', 'qtd item'],
  itens_por_cliente_2: ['itens por cliente 2', 'itens_por_cliente_2'],
  ticket_medio_2: ['ticket medio 2', 'ticket médio 2', 'ticket_medio_2'],
  preco_medio_2: ['preco medio 2', 'preço médio 2', 'preco_medio_2']
};

function getValueByAlias(row, key) {
  const rowEntries = Object.entries(row);
  const wanted = aliases[key] || [];
  for (const [rawKey, rawValue] of rowEntries) {
    const nk = normalizeHeader(rawKey);
    if (wanted.includes(nk)) return rawValue;
  }
  return undefined;
}

function mapRow(row) {
  const rawDate = getValueByAlias(row, 'date');
  const dateObj = parseDateValue(rawDate);
  if (!dateObj) {
    return { ok: false, error: 'Data inválida', raw: row };
  }

  const ano = dateObj.getFullYear();
  const mes = dateObj.getMonth() + 1;
  const dia = dateObj.getDate();

  if (!ano || !mes || !dia) {
    return { ok: false, error: 'Ano/Mês/Dia inválidos', raw: row };
  }

  return {
    ok: true,
    data: {
      ano,
      mes,
      dia,
      vlr_venda_paga_total: toNumberBR(getValueByAlias(row, 'vlr_venda_paga_total')),
      vlr_meta: toNumberBR(getValueByAlias(row, 'vlr_meta')),
      vlr_desvio_meta: toNumberBR(getValueByAlias(row, 'vlr_desvio_meta')),
      pct_desvio_meta: toNumberBR(getValueByAlias(row, 'pct_desvio_meta')),
      vlr_desvio_meta_nao_calcados: toNumberBR(getValueByAlias(row, 'vlr_desvio_meta_nao_calcados')),
      vlr_desvio_meta_calcados: toNumberBR(getValueByAlias(row, 'vlr_desvio_meta_calcados')),
      vlr_desvio_mdsaa: toNumberBR(getValueByAlias(row, 'vlr_desvio_mdsaa')),
      pct_desvio_mdsaa: toNumberBR(getValueByAlias(row, 'pct_desvio_mdsaa')),
      pct_ee: toNumberBR(getValueByAlias(row, 'pct_ee')),
      qtd_cupons_2: toNumberBR(getValueByAlias(row, 'qtd_cupons_2')),
      qtd_item: toNumberBR(getValueByAlias(row, 'qtd_item')),
      itens_por_cliente_2: toNumberBR(getValueByAlias(row, 'itens_por_cliente_2')),
      ticket_medio_2: toNumberBR(getValueByAlias(row, 'ticket_medio_2')),
      preco_medio_2: toNumberBR(getValueByAlias(row, 'preco_medio_2'))
    }
  };
}

router.use(requireAdmin);

// histórico
router.get('/history', async (_req, res) => {
  try {
    const rows = await UploadHistory.find({}).sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao buscar histórico',
      error: error.message
    });
  }
});

// preview
router.post('/preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'Arquivo não enviado' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows.length) {
      return res.status(400).json({ ok: false, message: 'Arquivo sem dados' });
    }

    const mapped = [];
    const invalidRows = [];
    const fileKeys = new Set();
    const duplicateInFile = [];
    const candidateKeys = [];

    for (let i = 0; i < rows.length; i++) {
      const parsed = mapRow(rows[i]);

      if (!parsed.ok) {
        invalidRows.push({
          linha: i + 2,
          motivo: parsed.error
        });
        continue;
      }

      const row = parsed.data;
      const key = `${row.ano}-${row.mes}-${row.dia}`;

      if (fileKeys.has(key)) {
        duplicateInFile.push({
          linha: i + 2,
          chave: key
        });
        continue;
      }

      fileKeys.add(key);
      candidateKeys.push(key);
      mapped.push(row);
    }

    const existing = await Venda.find(
      {
        $or: mapped.map(r => ({ ano: r.ano, mes: r.mes, dia: r.dia }))
      },
      { ano: 1, mes: 1, dia: 1 }
    ).lean();

    const existingKeys = new Set(
      existing.map(r => `${r.ano}-${r.mes}-${r.dia}`)
    );

    const novas = [];
    const duplicadasBanco = [];

    for (const row of mapped) {
      const key = `${row.ano}-${row.mes}-${row.dia}`;
      if (existingKeys.has(key)) {
        duplicadasBanco.push(key);
      } else {
        novas.push(row);
      }
    }

    req.session.importPreview = {
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      novas
    };

    const history = await UploadHistory.create({
      fileName: req.file.originalname,
      fileType: req.file.mimetype || '',
      uploadedBy: {
        id: req.session.user.id,
        nome: req.session.user.nome,
        usuario: req.session.user.usuario
      },
      totalLinhas: rows.length,
      validas: mapped.length,
      novas: novas.length,
      duplicadasBanco: duplicadasBanco.length,
      duplicadasArquivo: duplicateInFile.length,
      invalidas: invalidRows.length,
      status: 'preview',
      resumo: 'Preview gerado com sucesso'
    });

    return res.json({
      ok: true,
      message: 'Preview gerado com sucesso',
      preview: {
        fileName: req.file.originalname,
        totalLinhas: rows.length,
        validas: mapped.length,
        novas: novas.length,
        duplicadasBanco: duplicadasBanco.length,
        duplicadasArquivo: duplicateInFile.length,
        invalidas: invalidRows.length,
        sample: novas.slice(0, 10),
        invalidRows: invalidRows.slice(0, 20),
        duplicateInFile: duplicateInFile.slice(0, 20),
        duplicateInDb: duplicadasBanco.slice(0, 20)
      },
      previewId: String(history._id)
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      message: 'Erro ao gerar preview',
      error: error.message
    });
  }
});

// confirmar importação
router.post('/confirm', async (req, res) => {
  try {
    const preview = req.session.importPreview;

    if (!preview || !Array.isArray(preview.novas)) {
      return res.status(400).json({
        ok: false,
        message: 'Nenhum preview pendente para confirmar'
      });
    }

    if (!preview.novas.length) {
      return res.json({
        ok: true,
        message: 'Nenhum dado novo para importar',
        inserted: 0
      });
    }

    const result = await Venda.insertMany(preview.novas, { ordered: false });

    await UploadHistory.create({
      fileName: preview.fileName,
      fileType: preview.mimeType || '',
      uploadedBy: {
        id: req.session.user.id,
        nome: req.session.user.nome,
        usuario: req.session.user.usuario
      },
      totalLinhas: preview.novas.length,
      validas: preview.novas.length,
      novas: preview.novas.length,
      duplicadasBanco: 0,
      duplicadasArquivo: 0,
      invalidas: 0,
      status: 'importado',
      resumo: 'Dados enviados para o dashboard'
    });

    req.session.importPreview = null;

    return res.json({
      ok: true,
      message: 'Dados enviados para o dashboard com sucesso',
      inserted: result.length
    });
  } catch (error) {
    if (String(error.message || '').includes('duplicate key')) {
      return res.status(409).json({
        ok: false,
        message: 'Há dados que já existem no banco'
      });
    }

    return res.status(500).json({
      ok: false,
      message: 'Erro ao confirmar importação',
      error: error.message
    });
  }
});

export default router;