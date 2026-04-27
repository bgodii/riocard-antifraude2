import type { SheetJsApi, TransactionRecord } from '@/types/fraud';

const SHEETJS_SCRIPT_ID = 'sheetjs-cdn-script';
const SHEETJS_CDN_URL = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

const columnAliases = {
  cardId: ['idcartao', 'cartao', 'cardid', 'idcard', 'numerocartao', 'codigo_cartao', 'numero_cartao'],
  dateTime: ['datahora', 'data_hora', 'datetime', 'data', 'horario', 'timestamp', 'dtutilizacao', 'datautilizacao'],
  amount: ['valor', 'valorrecarga', 'tarifa', 'preco', 'amount'],
  busLine: ['linhaonibus', 'linha', 'linha_onibus', 'route', 'linhabus'],
  metroStation: ['estacaometro', 'estacao', 'estacao_metro', 'station', 'parada'],
  transportType: ['tipotransporte', 'tipo_transporte', 'modo', 'modal', 'meio_transporte'],
  equipmentLocation: ['localizacaoequipamento', 'localizacao_equipamento', 'local', 'equipamento', 'device_location', 'terminal', 'localizacao'],
  latitude: ['latitude', 'lat'],
  longitude: ['longitude', 'lon', 'lng'],
  externalTransactionId: ['idtransacao', 'id_transacao', 'transactionid'],
  userId: ['idusuarioficticio', 'id_usuario_ficticio', 'usuario', 'userid'],
  userProfile: ['perfilusuario', 'perfil_usuario'],
  status: ['statustransacao', 'status_transacao', 'status'],
  fareType: ['tipotarifa', 'tipo_tarifa'],
  direction: ['sentidoviagem', 'sentido_viagem'],
  timeSincePreviousMinutes: ['tempodesdeultimatransacaomin', 'tempo_desde_ultima_transacao_min'],
  baseRiskScore: ['scoreriscobase', 'score_risco_base'],
  modelRiskScore: ['scoreriscomodelo', 'score_risco_modelo'],
  suspiciousFlag: ['flagsuspeita', 'flag_suspeita'],
  suspiciousCategory: ['categoriasuspeita', 'categoria_suspeita'],
  estimatedFinancialLoss: ['perdafinanceiraestimada', 'perda_financeira_estimada'],
} as const;

function normalizeHeader(header: string) {
  return header
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function normalizeString(value: unknown) {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return '';
}

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = trimmed.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toTimestamp(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000 ? value : Math.round((value - 25569) * 86400 * 1000);
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === 'string') {
    const direct = Date.parse(value);
    if (!Number.isNaN(direct)) {
      return direct;
    }

    const match = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (match) {
      const [, day, month, year, hours = '0', minutes = '0', seconds = '0'] = match;
      const paddedYear = year.length === 2 ? `20${year}` : year;
      return new Date(
        Number(paddedYear),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds),
      ).getTime();
    }
  }

  return NaN;
}

function toBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = normalizeHeader(value);
    return ['sim', 'true', 'yes', 'y', '1'].includes(normalized);
  }

  return false;
}

function normalizeRiskScore(value: number | null) {
  if (value === null) {
    return null;
  }

  return value <= 1 ? Math.round(value * 100) : Math.round(value);
}

function escapeCsvValue(value: string) {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function parseCsvLine(line: string, delimiter: ',' | ';') {
  const values: string[] = [];
  let current = '';
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values.map((value) => value.trim());
}

function parseCsv(content: string) {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = normalized.split('\n').filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    return [];
  }

  const delimiter: ',' | ';' = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
  const headers = parseCsvLine(lines[0], delimiter);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce<Record<string, unknown>>((row, header, index) => {
      row[header] = values[index] ?? '';
      return row;
    }, {});
  });
}

async function ensureSheetJs() {
  if (window.XLSX) {
    return window.XLSX;
  }

  const existingScript = document.getElementById(SHEETJS_SCRIPT_ID) as HTMLScriptElement | null;
  if (existingScript?.dataset.loaded === 'true' && window.XLSX) {
    return window.XLSX;
  }

  await new Promise<void>((resolve, reject) => {
    const script = existingScript ?? document.createElement('script');

    script.id = SHEETJS_SCRIPT_ID;
    script.src = SHEETJS_CDN_URL;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error('Nao foi possivel carregar a biblioteca SheetJS para arquivos XLSX.'));

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  if (!window.XLSX) {
    throw new Error('A biblioteca SheetJS nao ficou disponivel apos o carregamento.');
  }

  return window.XLSX;
}

function detectColumnKey(row: Record<string, unknown>, aliases: readonly string[]) {
  const entries = Object.keys(row);

  for (const key of entries) {
    const normalizedKey = normalizeHeader(key);
    if (aliases.includes(normalizedKey as never)) {
      return key;
    }
  }

  return '';
}

function getValue(row: Record<string, unknown>, aliases: readonly string[]) {
  const match = detectColumnKey(row, aliases);
  return match ? row[match] : undefined;
}

function makeLocationLabel(busLine: string, metroStation: string, equipmentLocation: string, transportType: string) {
  if (metroStation) {
    return metroStation;
  }

  if (busLine) {
    return `Linha ${busLine}`;
  }

  if (equipmentLocation) {
    return equipmentLocation;
  }

  return transportType || 'Local nao informado';
}

export async function parseSpreadsheetFile(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (extension === 'csv') {
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) {
      throw new Error('O arquivo CSV nao possui linhas suficientes para analise.');
    }
    return rows;
  }

  if (extension === 'xlsx' || extension === 'xls') {
    const sheetJs = (await ensureSheetJs()) as SheetJsApi;
    const arrayBuffer = await file.arrayBuffer();
    const workbook = sheetJs.read(arrayBuffer, { type: 'array', cellDates: true });
    const firstSheet = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheet];
    const rows = sheetJs.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });

    if (!rows.length) {
      throw new Error('A planilha XLSX nao possui dados visiveis na primeira aba.');
    }

    return rows;
  }

  throw new Error('Formato nao suportado. Use arquivos .csv, .xls ou .xlsx.');
}

export function normalizeSpreadsheetRows(rows: Record<string, unknown>[]): TransactionRecord[] {
  return rows
    .map((row, index) => {
      const cardId = normalizeString(getValue(row, columnAliases.cardId)) || `SEM-CARTAO-${index + 1}`;
      const timestamp = toTimestamp(getValue(row, columnAliases.dateTime));
      const amount = toNumber(getValue(row, columnAliases.amount));
      const busLine = normalizeString(getValue(row, columnAliases.busLine));
      const metroStation = normalizeString(getValue(row, columnAliases.metroStation));
      const transportType = normalizeString(getValue(row, columnAliases.transportType));
      const equipmentLocation = normalizeString(getValue(row, columnAliases.equipmentLocation));
      const latitude = toNumber(getValue(row, columnAliases.latitude));
      const longitude = toNumber(getValue(row, columnAliases.longitude));
      const externalTransactionId = normalizeString(getValue(row, columnAliases.externalTransactionId)) || `TX-${index + 1}`;
      const userId = normalizeString(getValue(row, columnAliases.userId));
      const userProfile = normalizeString(getValue(row, columnAliases.userProfile));
      const status = normalizeString(getValue(row, columnAliases.status));
      const fareType = normalizeString(getValue(row, columnAliases.fareType));
      const direction = normalizeString(getValue(row, columnAliases.direction));
      const timeSincePreviousMinutes = toNumber(getValue(row, columnAliases.timeSincePreviousMinutes));
      const baseRiskScore = normalizeRiskScore(toNumber(getValue(row, columnAliases.baseRiskScore)));
      const modelRiskScore = normalizeRiskScore(toNumber(getValue(row, columnAliases.modelRiskScore)));
      const suspiciousFlag = toBoolean(getValue(row, columnAliases.suspiciousFlag));
      const suspiciousCategory = normalizeString(getValue(row, columnAliases.suspiciousCategory));
      const estimatedFinancialLoss = toNumber(getValue(row, columnAliases.estimatedFinancialLoss));

      if (Number.isNaN(timestamp)) {
        return null;
      }

      return {
        id: `tx-${index + 1}`,
        externalTransactionId,
        cardId,
        userId,
        userProfile,
        status,
        fareType,
        direction,
        dateTime: new Date(timestamp).toISOString(),
        timestamp,
        amount,
        busLine,
        metroStation,
        transportType,
        equipmentLocation,
        locationLabel: makeLocationLabel(busLine, metroStation, equipmentLocation, transportType),
        latitude,
        longitude,
        timeSincePreviousMinutes,
        baseRiskScore,
        modelRiskScore,
        suspiciousFlag,
        suspiciousCategory,
        estimatedFinancialLoss,
        raw: row,
      } satisfies TransactionRecord;
    })
    .filter((item): item is TransactionRecord => item !== null)
    .sort((left, right) => left.timestamp - right.timestamp);
}

export function transactionsToCsv(rows: TransactionRecord[]) {
  if (!rows.length) {
    return '';
  }

  const headers = ['id_cartao', 'data_hora', 'valor', 'linha_onibus', 'estacao_metro', 'tipo_transporte', 'localizacao'];
  const body = rows.map((row) =>
    [
      row.cardId,
      row.dateTime,
      row.amount?.toString() ?? '',
      row.busLine,
      row.metroStation,
      row.transportType,
      row.locationLabel,
    ]
      .map((value) => escapeCsvValue(value))
      .join(','),
  );

  return [headers.join(','), ...body].join('\n');
}
