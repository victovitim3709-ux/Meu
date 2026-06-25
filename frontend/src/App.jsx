import { useState, useEffect, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { api } from './api.js'
import { parsePdf, fileToBase64 } from './pdfParser.js'

// ── Estilos inline ────────────────────────────────────────────────────────────
const G = {
  gold: '#C9A84C',
  navy: '#1a2540',
  red: '#E24B4A',
  green: '#1D9E75',
}

const css = `
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; font-family: 'Inter', system-ui, sans-serif; }
  input, select, button, textarea { font-family: inherit; }
  input[type=text], input[type=password], select {
    width: 100%; padding: 7px 10px;
    border: 1px solid #ddd; border-radius: 7px;
    font-size: 13px; color: #1a1a1a; background: #fff;
    transition: border-color .15s;
  }
  input:focus, select:focus { outline: none; border-color: #C9A84C; box-shadow: 0 0 0 2px rgba(201,168,76,.15); }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #1a2540; color: #fff; padding: 8px 10px; text-align: left; font-weight: 500; white-space: nowrap; }
  td { padding: 7px 10px; border-bottom: 1px solid #f0f0ec; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
  tr:hover td { background: #fafaf7; }
  .concluded td { background: rgba(201,168,76,.06) !important; }
  .check { accent-color: #C9A84C; width: 15px; height: 15px; cursor: pointer; }
  @keyframes fadeIn { from { opacity:0; transform:translateY(-4px); } to { opacity:1; transform:none; } }
  @keyframes spin { to { transform: rotate(360deg); } }
  .spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(201,168,76,.3); border-top-color:#C9A84C; border-radius:50%; animation:spin .7s linear infinite; }
`

// ── Componentes base ──────────────────────────────────────────────────────────
function Btn({ gold, sm, icon: Icon, danger, disabled, onClick, children, style, ...p }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: sm ? '5px 12px' : '7px 15px',
    borderRadius: 8, border: '1px solid',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: sm ? 12 : 13, fontWeight: 500,
    opacity: disabled ? 0.45 : 1,
    transition: 'opacity .15s, background .15s',
    ...style,
  }
  if (gold) Object.assign(base, { background: G.gold, color: G.navy, borderColor: 'transparent' })
  else if (danger) Object.assign(base, { background: 'transparent', color: G.red, borderColor: '#fdd' })
  else Object.assign(base, { background: '#fff', color: '#1a1a1a', borderColor: '#ddd' })
  return <button style={base} disabled={disabled} onClick={onClick} {...p}>{children}</button>
}

function Field({ label, value, onChange, mono, wide }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, gridColumn: wide ? 'span 2' : undefined }}>
      <label style={{ fontSize: 11, color: '#888', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</label>
      <input type="text" value={value || ''} onChange={e => onChange(e.target.value)}
        style={mono ? { fontFamily: 'monospace', fontSize: 12 } : {}} />
    </div>
  )
}

function Card({ children, style }) {
  return <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '1.25rem', ...style }}>{children}</div>
}

function Badge({ children, color = G.gold }) {
  return <span style={{ background: color, color: color === G.gold ? G.navy : '#fff', fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20 }}>{children}</span>
}

function FmtBadge({ fmt }) {
  if (fmt === 'pje') return <span style={{ background: '#eaf3de', color: '#3B6D11', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>PJe/TRF</span>
  if (fmt === 'projudi') return <span style={{ background: '#e6f1fb', color: '#0C447C', fontSize: 10, padding: '1px 7px', borderRadius: 10, fontWeight: 500 }}>PROJUDI</span>
  return null
}

let _toastId = 0
function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'ok') => {
    const id = ++_toastId
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, toast: add }
}

function Toasts({ toasts }) {
  const colors = { ok: G.green, err: G.red, warn: G.gold }
  const textColors = { ok: '#fff', err: '#fff', warn: G.navy }
  return (
    <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {toasts.map(t => (
        <div key={t.id} style={{ padding: '10px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, background: colors[t.type], color: textColors[t.type], animation: 'fadeIn .2s ease', maxWidth: 300 }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── App principal ─────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(undefined) // undefined = carregando
  const { toasts, toast } = useToast()

  useEffect(() => {
    api.me().then(d => setUser(d.user)).catch(() => setUser(null))
  }, [])

  return (
    <>
      <style>{css}</style>
      <Toasts toasts={toasts} />
      {user === undefined && <Loading />}
      {user === null && <Login onLogin={setUser} toast={toast} />}
      {user && <Main user={user} onLogout={() => setUser(null)} toast={toast} />}
    </>
  )
}

function Loading() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function Login({ onLogin, toast }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      const { user } = await api.login(username.trim(), password)
      onLogin(user)
    } catch (err) {
      toast(err.message || 'Erro ao entrar', 'err')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f4f4f0' }}>
      <div style={{ width: 320, background: '#fff', border: '1px solid rgba(201,168,76,.3)', borderRadius: 16, padding: '2rem' }}>
        <div style={{ width: 60, height: 60, background: G.navy, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem', color: G.gold, fontSize: 22, fontWeight: 600, border: `2px solid rgba(201,168,76,.4)` }}>VL</div>
        <h1 style={{ textAlign: 'center', fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Entrar</h1>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: '1.5rem' }}>Sistema de Cadastros e Recibos</p>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Usuário</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} autoFocus />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label style={{ fontSize: 12, color: '#666', fontWeight: 500 }}>Senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <Btn gold style={{ justifyContent: 'center', marginTop: 4 }} disabled={loading}>
            {loading ? <span className="spinner" /> : 'Entrar'}
          </Btn>
        </form>
      </div>
    </div>
  )
}

// ── Main layout ───────────────────────────────────────────────────────────────
function Main({ user, onLogout, toast }) {
  const [tab, setTab] = useState('novo')
  const [cadastros, setCadastros] = useState([])
  const [recibos, setRecibos] = useState([])
  const [loadingData, setLoadingData] = useState(true)

  const refreshAll = useCallback(async () => {
    try {
      const [c, r] = await Promise.all([api.getCadastros(), api.getRecibos()])
      setCadastros(c)
      setRecibos(r)
    } catch (e) {
      toast('Erro ao carregar dados', 'err')
    } finally {
      setLoadingData(false)
    }
  }, [toast])

  useEffect(() => { refreshAll() }, [refreshAll])

  async function handleLogout() {
    await api.logout().catch(() => {})
    onLogout()
  }

  const tabs = [
    { id: 'novo', label: '+ Novo Cadastro' },
    { id: 'cadastrados', label: `Cadastros (${cadastros.length})` },
    { id: 'recibo', label: '↑ Enviar Recibo' },
    { id: 'recibos', label: `Recibos (${recibos.length})` },
    ...(user.isAdmin ? [{ id: 'usuarios', label: 'Usuários' }] : []),
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f0' }}>
      {/* Header */}
      <header style={{ background: G.navy, padding: '.9rem 1.5rem', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ width: 40, height: 40, background: 'rgba(201,168,76,.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: G.gold, fontSize: 14, fontWeight: 700, border: `1.5px solid rgba(201,168,76,.4)`, flexShrink: 0 }}>VL</div>
        <div>
          <h1 style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>Sistema de Cadastros e Recibos</h1>
          <p style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>PROJUDI · PJe · TRF</p>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#fff', fontSize: 13, fontWeight: 500 }}>{user.username}</div>
            <div style={{ color: 'rgba(255,255,255,.5)', fontSize: 11 }}>{user.isAdmin ? 'Administrador' : 'Usuário'}</div>
          </div>
          <Btn sm onClick={handleLogout} style={{ borderColor: 'rgba(201,168,76,.4)', color: '#fff', background: 'transparent' }}>Sair</Btn>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #eee', padding: '.6rem 1.5rem', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: tab === t.id ? G.navy : 'transparent', color: tab === t.id ? '#fff' : '#666', transition: 'all .15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '1.25rem 1.5rem', maxWidth: 1200, margin: '0 auto' }}>
        {loadingData ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} /></div>
        ) : (
          <>
            {tab === 'novo' && <TabNovo toast={toast} onSaved={refreshAll} />}
            {tab === 'cadastrados' && <TabCadastrados cadastros={cadastros} toast={toast} onRefresh={refreshAll} />}
            {tab === 'recibo' && <TabEnviarRecibo toast={toast} onSaved={refreshAll} />}
            {tab === 'recibos' && <TabRecibos recibos={recibos} toast={toast} onRefresh={refreshAll} />}
            {tab === 'usuarios' && user.isAdmin && <TabUsuarios toast={toast} currentUser={user} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Tab: Novo Cadastro ────────────────────────────────────────────────────────
function emptyPending(fn = '') {
  return { fileName: fn, numeroProcesso: '', dataDistribuicao: '', valor: '', cpfAutor: '', cnpjReu: '', materia: '', autor: '', reu: '', advogado: '', grupo: '', _fmt: '' }
}

function TabNovo({ toast, onSaved }) {
  const [pendings, setPendings] = useState([])
  const [parsing, setParsing] = useState(false)
  const fileRef = useRef()

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setParsing(true)
    const novos = []
    for (const f of files) {
      let parsed = emptyPending(f.name)
      try { const r = await parsePdf(f); parsed = { ...emptyPending(f.name), ...r, fileName: f.name } }
      catch (err) { console.error(err); toast(`Falha ao ler ${f.name}`, 'err') }
      novos.push(parsed)
    }
    fileRef.current.value = ''
    setParsing(false)
    setPendings(cur => [...cur, ...novos])
    toast(`${novos.length} PDF(s) processado(s)`)
  }

  function upd(i, k, v) { setPendings(cur => cur.map((p, idx) => idx === i ? { ...p, [k]: v } : p)) }
  function rem(i) { setPendings(cur => cur.filter((_, idx) => idx !== i)) }

  async function cadastrar(i) {
    const p = pendings[i]
    if (!p.numeroProcesso && !p.autor) { toast('Preencha processo ou autor', 'err'); return }
    const { fileName: _f, _fmt: _m, ...rest } = p
    try {
      await api.createCadastro(rest)
      rem(i)
      onSaved()
      toast('Cadastrado com sucesso!')
    } catch (err) { toast(err.message, 'err') }
  }

  async function cadastrarTodos() {
    let ct = 0
    for (let i = 0; i < pendings.length; i++) {
      const p = pendings[i]
      if (!p.numeroProcesso && !p.autor) continue
      const { fileName: _f, _fmt: _m, ...rest } = p
      try { await api.createCadastro(rest); ct++ } catch (e) { console.error(e) }
    }
    setPendings([])
    onSaved()
    toast(`${ct} processo(s) cadastrado(s)!`)
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer', fontSize: 13, fontWeight: 500, background: '#fff' }}>
          ↑ {parsing ? 'Lendo PDFs...' : 'Selecionar PDFs'}
          <input ref={fileRef} type="file" accept="application/pdf" multiple onChange={handleFiles} style={{ display: 'none' }} />
        </label>
        <Btn onClick={() => setPendings(cur => [...cur, emptyPending()])}>+ Adicionar manualmente</Btn>
        {pendings.length > 0 && <Btn gold onClick={cadastrarTodos}>✓ Cadastrar todos ({pendings.length})</Btn>}
      </div>

      {parsing && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(201,168,76,.1)', borderRadius: 8, marginBottom: 12, fontSize: 13 }}>
          <div className="spinner" /> Interpretando PDFs (PROJUDI / PJe)...
        </div>
      )}

      {pendings.length === 0 && !parsing && (
        <p style={{ color: '#888', fontSize: 13 }}>Nenhum PDF carregado. Detecta automaticamente PROJUDI (TJGO) e PJe/TRF.</p>
      )}

      {pendings.map((p, i) => (
        <div key={i} style={{ border: '1px solid rgba(201,168,76,.35)', borderRadius: 12, padding: '1rem', marginTop: 10, background: '#fffdf7' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500 }}>📄 {p.fileName || 'Novo cadastro'}</span>
              <FmtBadge fmt={p._fmt} />
              {p.grupo && <Badge>{p.grupo}</Badge>}
            </div>
            <Btn sm onClick={() => rem(i)}>✕</Btn>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
            <Field label="Número do processo" value={p.numeroProcesso} onChange={v => upd(i, 'numeroProcesso', v)} mono />
            <Field label="Data de distribuição" value={p.dataDistribuicao} onChange={v => upd(i, 'dataDistribuicao', v)} />
            <Field label="Valor da causa" value={p.valor} onChange={v => upd(i, 'valor', v)} />
            <Field label="Matéria / Assunto" value={p.materia} onChange={v => upd(i, 'materia', v)} />
            <Field label="Autor" value={p.autor} onChange={v => upd(i, 'autor', v)} />
            <Field label="CPF do autor" value={p.cpfAutor} onChange={v => upd(i, 'cpfAutor', v)} mono />
            <Field label="Réu" value={p.reu} onChange={v => upd(i, 'reu', v)} />
            <Field label="CNPJ do réu" value={p.cnpjReu} onChange={v => upd(i, 'cnpjReu', v)} mono />
            <Field label="Advogado" value={p.advogado} onChange={v => upd(i, 'advogado', v)} />
            <Field label="Grupo" value={p.grupo} onChange={v => upd(i, 'grupo', v)} />
          </div>
          <div style={{ textAlign: 'right', marginTop: 12 }}>
            <Btn gold onClick={() => cadastrar(i)}>✓ Cadastrar</Btn>
          </div>
        </div>
      ))}
    </Card>
  )
}

// ── Tab: Cadastros ────────────────────────────────────────────────────────────
function TabCadastrados({ cadastros, toast, onRefresh }) {
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState('todos')

  const filtered = cadastros.filter(c => {
    if (filtro === 'concluido' && !c.concluido) return false
    if (filtro === 'pendente' && c.concluido) return false
    const q = busca.toLowerCase()
    if (!q) return true
    return [c.numeroProcesso, c.autor, c.reu, c.cpfAutor, c.cnpjReu, c.advogado, c.grupo, c.materia].some(v => (v || '').toLowerCase().includes(q))
  })

  async function togCpj(c) {
    try {
      await api.updateCadastro(c.id, c.concluido
        ? { concluido: false, concluidoEm: null }
        : { concluido: true, concluidoEm: new Date().toLocaleString('pt-BR') })
      onRefresh()
    } catch (e) { toast(e.message, 'err') }
  }

  async function del(id) {
    if (!confirm('Excluir cadastro?')) return
    try { await api.deleteCadastro(id); onRefresh(); toast('Excluído.') }
    catch (e) { toast(e.message, 'err') }
  }

  function exportXls() {
    if (!filtered.length) { toast('Sem dados para exportar', 'err'); return }
    const rows = filtered.map(c => ({
      'Processo': c.numeroProcesso, 'Distribuição': c.dataDistribuicao, 'Valor': c.valor,
      'Autor': c.autor, 'CPF Autor': c.cpfAutor, 'Réu': c.reu, 'CNPJ Réu': c.cnpjReu,
      'Matéria': c.materia, 'Advogado': c.advogado, 'Grupo': c.grupo,
      'Status': c.concluido ? 'No CPJ' : 'Pendente', 'Criado em': c.createdAt,
    }))
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Cadastros')
    XLSX.writeFile(wb, `cadastros_${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast('Planilha exportada!')
  }

  return (
    <Card>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 14 }}>🔍</span>
          <input type="text" placeholder="Pesquisar..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30 }} />
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {['todos', 'pendente', 'concluido'].map(s => (
            <button key={s} onClick={() => setFiltro(s)}
              style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid #ddd', cursor: 'pointer', fontSize: 12, background: filtro === s ? G.navy : '#fff', color: filtro === s ? '#fff' : '#555', fontWeight: 500 }}>
              {s === 'todos' ? 'Todos' : s === 'pendente' ? 'Pendentes' : 'No CPJ'}
            </button>
          ))}
        </div>
        <Btn gold sm onClick={exportXls}>📊 Exportar .xlsx</Btn>
      </div>

      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2.5rem', color: '#888', fontSize: 13 }}>{cadastros.length === 0 ? 'Nenhum cadastro ainda.' : 'Nenhum resultado.'}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table>
            <colgroup>
              <col style={{ width: 36 }} /><col style={{ width: 145 }} /><col style={{ width: 82 }} />
              <col style={{ width: 85 }} /><col style={{ width: 120 }} /><col style={{ width: 105 }} />
              <col style={{ width: 130 }} /><col style={{ width: 110 }} /><col style={{ width: 100 }} />
              <col style={{ width: 115 }} /><col style={{ width: 85 }} /><col style={{ width: 36 }} />
            </colgroup>
            <thead>
              <tr>{['CPJ', 'Processo', 'Distribuição', 'Valor', 'Autor', 'CPF', 'Réu', 'CNPJ', 'Matéria', 'Advogado', 'Grupo', ''].map(h => <th key={h}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.id} className={c.concluido ? 'concluded' : ''}>
                  <td style={{ textAlign: 'center' }}><input type="checkbox" className="check" checked={!!c.concluido} onChange={() => togCpj(c)} /></td>
                  <td title={c.numeroProcesso} style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.numeroProcesso}</td>
                  <td>{c.dataDistribuicao}</td>
                  <td style={{ fontWeight: 600 }}>{c.valor}</td>
                  <td title={c.autor}>{c.autor}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.cpfAutor}</td>
                  <td title={c.reu}>{c.reu}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{c.cnpjReu}</td>
                  <td title={c.materia}>{(c.materia || '').slice(0, 28)}{(c.materia || '').length > 28 ? '…' : ''}</td>
                  <td title={c.advogado}>{c.advogado}</td>
                  <td>{c.grupo && <Badge>{c.grupo}</Badge>}</td>
                  <td><button onClick={() => del(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: G.red }}>🗑</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ── Tab: Enviar Recibo ────────────────────────────────────────────────────────
function TabEnviarRecibo({ toast, onSaved }) {
  const [staged, setStaged] = useState([])
  const [loading, setLoading] = useState(false)

  async function handleFiles(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setLoading(true)
    const novos = []
    for (const f of files) {
      let parsed = {}
      try { parsed = await parsePdf(f) } catch (err) { console.error(err) }
      novos.push({ _id: Math.random().toString(36).slice(2), file: f, nome: parsed.autor || f.name, numero: parsed.numeroProcesso || '', data: parsed.dataDistribuicao || '', advogado: parsed.advogado || '', grupo: parsed.grupo || '', _fmt: parsed._fmt || '' })
    }
    e.target.value = ''
    setLoading(false)
    setStaged(cur => [...novos, ...cur])
    toast(`${novos.length} PDF(s) lido(s)`)
  }

  function upd(id, k, v) { setStaged(cur => cur.map(r => r._id === id ? { ...r, [k]: v } : r)) }
  function rem(id) { setStaged(cur => cur.filter(r => r._id !== id)) }

  async function enviar(id) {
    const item = staged.find(r => r._id === id)
    if (!item) return
    try {
      const pdfData = await fileToBase64(item.file)
      await api.createRecibo({ nome: item.nome || item.file.name, numeroProcesso: item.numero, dataDistribuicao: item.data, advogado: item.advogado, grupo: item.grupo, pdfData })
      rem(id)
      onSaved()
      toast('Recibo arquivado!')
    } catch (err) { toast(err.message, 'err') }
  }

  async function enviarTodos() { for (const r of [...staged]) await enviar(r._id) }

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Selecione os PDFs de recibo:</p>
        <input type="file" accept="application/pdf" multiple onChange={handleFiles} style={{ fontSize: 13 }} />
        {loading && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, color: '#888' }}><div className="spinner" /> Lendo PDFs...</div>}
      </div>

      {staged.length === 0 ? (
        <p style={{ color: '#888', fontSize: 13 }}>Nenhum recibo aguardando envio.</p>
      ) : (
        <>
          <Btn gold onClick={enviarTodos} style={{ marginBottom: 12 }}>↑ Enviar TODOS ({staged.length})</Btn>
          {staged.map(r => (
            <div key={r._id} style={{ border: '1px solid rgba(201,168,76,.35)', borderRadius: 12, padding: '1rem', marginTop: 10, background: '#fffdf7' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>📄 {r.file.name}</span>
                  <FmtBadge fmt={r._fmt} />
                  {r.grupo && <Badge>{r.grupo}</Badge>}
                </div>
                <Btn sm onClick={() => rem(r._id)}>✕</Btn>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
                <Field label="Nome / Autor" value={r.nome} onChange={v => upd(r._id, 'nome', v)} />
                <Field label="Número do processo" value={r.numero} onChange={v => upd(r._id, 'numero', v)} mono />
                <Field label="Data de distribuição" value={r.data} onChange={v => upd(r._id, 'data', v)} />
                <Field label="Advogado" value={r.advogado} onChange={v => upd(r._id, 'advogado', v)} />
                <Field label="Grupo" value={r.grupo} onChange={v => upd(r._id, 'grupo', v)} />
              </div>
              <div style={{ textAlign: 'right', marginTop: 12 }}>
                <Btn gold onClick={() => enviar(r._id)}>↑ Arquivar recibo</Btn>
              </div>
            </div>
          ))}
        </>
      )}
    </Card>
  )
}

// ── Tab: Recibos ──────────────────────────────────────────────────────────────
function TabRecibos({ recibos, toast, onRefresh }) {
  const [busca, setBusca] = useState('')
  const filtered = recibos.filter(r => {
    const q = busca.toLowerCase()
    if (!q) return true
    return [r.nome, r.numeroProcesso, r.dataDistribuicao, r.advogado, r.grupo].some(v => (v || '').toLowerCase().includes(q))
  })

  async function baixar(r) {
    try {
      const { pdfData } = await api.getReciboPdf(r.id)
      const a = document.createElement('a')
      a.href = pdfData; a.download = `${r.nome || 'recibo'}.pdf`
      document.body.appendChild(a); a.click(); a.remove()
    } catch (e) { toast('PDF não encontrado', 'err') }
  }

  async function del(id) {
    if (!confirm('Excluir recibo?')) return
    try { await api.deleteRecibo(id); onRefresh(); toast('Excluído.') }
    catch (e) { toast(e.message, 'err') }
  }

  return (
    <Card>
      <div style={{ position: 'relative', maxWidth: 400, marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#aaa', fontSize: 14 }}>🔍</span>
        <input type="text" placeholder="Pesquisar recibos..." value={busca} onChange={e => setBusca(e.target.value)} style={{ paddingLeft: 30 }} />
      </div>
      {filtered.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '2.5rem', color: '#888', fontSize: 13 }}>{recibos.length === 0 ? 'Nenhum recibo arquivado.' : 'Nenhum resultado.'}</p>
      ) : filtered.map(r => (
        <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', border: '1px solid #eee', borderRadius: 9, marginBottom: 7, background: '#fff' }}>
          <span style={{ fontSize: 20, color: G.gold, flexShrink: 0 }}>📄</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{r.numeroProcesso}{r.dataDistribuicao ? ' · ' + r.dataDistribuicao : ''}{r.advogado ? ' · ' + r.advogado : ''}</div>
            {r.grupo && <Badge style={{ marginTop: 3 }}>{r.grupo}</Badge>}
          </div>
          <Btn sm onClick={() => baixar(r)}>↓ PDF</Btn>
          <button onClick={() => del(r.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: G.red }}>🗑</button>
        </div>
      ))}
    </Card>
  )
}

// ── Tab: Usuários ─────────────────────────────────────────────────────────────
function TabUsuarios({ toast, currentUser }) {
  const [users, setUsers] = useState([])
  const [novoUser, setNovoUser] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)

  const load = useCallback(() => api.getUsers().then(setUsers).catch(e => toast(e.message, 'err')), [toast])
  useEffect(() => { load() }, [load])

  async function criar() {
    if (!novoUser.trim() || !novaSenha) { toast('Preencha usuário e senha', 'err'); return }
    try {
      await api.createUser({ username: novoUser.trim(), password: novaSenha, isAdmin })
      setNovoUser(''); setNovaSenha(''); setIsAdmin(false)
      load(); toast('Usuário criado!')
    } catch (e) { toast(e.message, 'err') }
  }

  async function remover(username) {
    if (username === currentUser.username) { toast('Não pode remover a si mesmo', 'err'); return }
    if (!confirm(`Remover "${username}"?`)) return
    try { await api.deleteUser(username); load(); toast('Removido.') }
    catch (e) { toast(e.message, 'err') }
  }

  async function trocarSenha(username) {
    const nova = window.prompt(`Nova senha para "${username}":`)
    if (!nova) return
    try { await api.updatePassword(username, nova); toast('Senha atualizada!') }
    catch (e) { toast(e.message, 'err') }
  }

  return (
    <Card>
      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Cadastrar novo usuário</h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 8, alignItems: 'end', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>USUÁRIO</label>
          <input type="text" value={novoUser} onChange={e => setNovoUser(e.target.value)} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: '#888', fontWeight: 500 }}>SENHA</label>
          <input type="text" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} style={{ width: 14, height: 14, accentColor: G.gold }} />
          Admin
        </label>
        <Btn gold onClick={criar}>Criar</Btn>
      </div>

      <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Usuários cadastrados</h2>
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead><tr><th>Usuário</th><th>Tipo</th><th>Criado em</th><th style={{ width: 160 }}></th></tr></thead>
          <tbody>
            {users.map(u => (
              <tr key={u.username}>
                <td style={{ fontWeight: 500 }}>{u.username}{u.username === currentUser.username && <Badge style={{ marginLeft: 6 }}>você</Badge>}</td>
                <td>{u.isAdmin ? '🛡 Administrador' : 'Usuário'}</td>
                <td style={{ fontSize: 11, color: '#888' }}>{new Date(u.createdAt).toLocaleString('pt-BR')}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    <Btn sm onClick={() => trocarSenha(u.username)}>Trocar senha</Btn>
                    <button onClick={() => remover(u.username)} disabled={u.username === currentUser.username}
                      style={{ background: 'none', border: 'none', cursor: u.username === currentUser.username ? 'not-allowed' : 'pointer', fontSize: 15, color: G.red, opacity: u.username === currentUser.username ? 0.3 : 1 }}>🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
