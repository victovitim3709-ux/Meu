/* global pdfjsLib */

if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
}

async function extractText(file) {
  if (typeof pdfjsLib === 'undefined') return ''
  const ab = await file.arrayBuffer()
  const doc = await pdfjsLib.getDocument({ data: ab }).promise
  let text = ''
  for (let i = 1; i <= Math.min(doc.numPages, 8); i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    text += content.items.map((x) => x.str).join(' ') + '\n'
  }
  return text
}

function detect(text) {
  if (/Comprovante de protocolo/i.test(text) || /Protocolado por:/i.test(text)) return 'pje'
  if (/Processo cadastrado com sucesso/i.test(text) || /POLO ATIVO/i.test(text)) return 'projudi'
  return 'generic'
}

function get(text, patterns) {
  for (const p of patterns) {
    const m = text.match(p)
    if (m) return (m[1] || '').trim()
  }
  return ''
}

function detectGrupo(text, advogado) {
  const t = text.toLowerCase()
  if (/previdenci[áa]rio|inss|benefício|aposentadoria|pensão|auxílio/i.test(t)) return 'Previdenciário'
  if (/servidor público|funcional|remunera|isonomia|paridade/i.test(t)) return 'Servidor Público'
  if (/consumidor|fornecedor|produto|serviço defei/i.test(t)) return 'Consumidor'
  if (advogado && /pedro/i.test(advogado)) return 'Servidor Público'
  if (advogado && /luciano/i.test(advogado)) return 'Previdenciário'
  if (advogado && /george/i.test(advogado)) return 'Consumidor'
  return ''
}

function parsePJe(text) {
  const numero = get(text, [/Número do processo:\s*([\d\-\.]+)/i])
  const valor = get(text, [/Valor da causa:\s*R\$\s*([\d\.,]+)/i])
  const assunto = get(text, [/Assunto principal:\s*(.+?)(?=\n|Valor)/i])
  const dist = get(text, [/Distribuído em:\s*(\d{2}\/\d{2}\/\d{4})/i])
  const advogado = get(text, [/Protocolado por:\s*([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][^\n]+)/i])

  let autor = '', cpfAutor = '', reu = '', cnpjReu = ''

  // Extrai do bloco "Partes:"
  const partesM = text.match(/Partes:\s*([\s\S]+?)(?=Audiência|Documentos|Assuntos|\n\n)/i)
  if (partesM) {
    const pt = partesM[1]
    const mA = pt.match(/([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ\s]+?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)/)
    if (mA) { autor = mA[1].trim(); cpfAutor = mA[2] }
    const mR = pt.match(/([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ].+?)\s*\((\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\)/)
    if (mR) { reu = mR[1].trim(); cnpjReu = mR[2] }
  }

  // Fallback: busca Polo Ativo/Passivo na tabela
  if (!autor) {
    const m = text.match(/([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ\s]+?)\s*\(AUTOR\)/i)
    if (m) autor = m[1].trim()
    const cf = text.match(/([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ\s]+?)\s*\((\d{3}\.\d{3}\.\d{3}-\d{2})\)/)
    if (cf) { if (!autor) autor = cf[1].trim(); cpfAutor = cf[2] }
  }
  if (!reu) {
    const m = text.match(/([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ].+?)\s*\(REU\)/i)
    if (m) reu = m[1].trim()
    const cf = text.match(/([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ].+?)\s*\((\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\)/)
    if (cf) { if (!reu) reu = cf[1].trim(); cnpjReu = cf[2] }
  }

  return { numeroProcesso: numero, dataDistribuicao: dist, valor, materia: assunto, autor, cpfAutor, reu, cnpjReu, advogado, grupo: detectGrupo(text, advogado), _fmt: 'pje' }
}

function parsePROJUDI(text) {
  const numero = get(text, [/Número Processo\s+([\d\-\.]+)/i])
  const dist = get(text, [/Data Distribui[çc][aã]o\s+(\d{2}\/\d{2}\/\d{4})/i, /(\d{2}\/\d{2}\/\d{4})\s*(?=Prioridade)/])
  const valor = get(text, [/Valor da Causa\s+R?\$?\s*([\d\.,]+)/i])

  let autor = '', cpfAutor = '', reu = '', cnpjReu = ''
  const poloA = text.match(/POLO ATIVO([\s\S]+?)(?=POLO PASSIVO)/i)
  if (poloA) {
    const pt = poloA[1]
    const nm = pt.match(/^\s*([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ\s]+?)(?:\s+CPF|\s+Identidade)/im)
    if (nm) autor = nm[1].trim()
    const cf = pt.match(/CPF\/CNPJ\s+([\d\.\-]+)/i)
    if (cf) cpfAutor = cf[1]
  }
  const poloP = text.match(/POLO PASSIVO([\s\S]+?)(?=OUTRAS INFORMAÇÕES|$)/i)
  if (poloP) {
    const pt = poloP[1]
    const nm = pt.match(/^\s*([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ\s\-]+?)(?:\s+CPF|\s+Identidade)/im)
    if (nm) reu = nm[1].trim()
    const cf = pt.match(/CPF\/CNPJ\s+([\d\.\-\/]+)/i)
    if (cf) cnpjReu = cf[1]
  }

  const assuntoM = text.match(/Assunto\(s\)\s+([\s\S]+?)(?=Valor da Causa|$)/i)
  const assunto = assuntoM ? assuntoM[1].replace(/\s+/g, ' ').trim().slice(0, 150) : ''

  return { numeroProcesso: numero, dataDistribuicao: dist, valor, materia: assunto, autor, cpfAutor, reu, cnpjReu, advogado: '', grupo: detectGrupo(text, ''), _fmt: 'projudi' }
}

function parseGeneric(text) {
  return {
    numeroProcesso: get(text, [/(\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4})/, /Número[^:]*:\s*([\d\-\.\/]+)/i]),
    dataDistribuicao: get(text, [/Distribui[çc][aã]o[^:]*:\s*(\d{2}\/\d{2}\/\d{4})/i, /(\d{2}\/\d{2}\/\d{4})/]),
    valor: get(text, [/Valor[^:]*:\s*R?\$?\s*([\d\.,]+)/i]),
    materia: get(text, [/Assunto[^:]*:\s*(.{5,80}?)(?=\n)/i]),
    autor: get(text, [/Autor[^:]*:\s*([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][^\n]+)/i]),
    cpfAutor: get(text, [/(\d{3}\.\d{3}\.\d{3}-\d{2})/]),
    reu: get(text, [/R[eé]u[^:]*:\s*([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][^\n]+)/i]),
    cnpjReu: get(text, [/(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/]),
    advogado: get(text, [/Advogado[^:]*:\s*([A-ZÀÁÂÃÄÇÉÊÍÓÔÕÚÜ][^\n]+)/i]),
    grupo: '',
    _fmt: 'generic',
  }
}

export async function parsePdf(file) {
  const text = await extractText(file)
  const fmt = detect(text)
  if (fmt === 'pje') return parsePJe(text)
  if (fmt === 'projudi') return parsePROJUDI(text)
  return parseGeneric(text)
}

export function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = (e) => res(e.target.result)
    r.onerror = rej
    r.readAsDataURL(file)
  })
}
