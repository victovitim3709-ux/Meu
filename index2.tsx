import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { Upload, FileText, Trash2, Scale, Download, Plus, X, Search, FileSpreadsheet, CheckCircle2, LogOut, Users as UsersIcon, Shield } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  getCadastros, saveCadastro, deleteCadastro, updateCadastro,
  getRecibos, saveRecibo, deleteRecibo, fileToDataUrl,
  type Cadastro, type Recibo,
} from "@/lib/storage";
import {
  ensureSeedAdmin, login as authLogin, logout as authLogout, getCurrentUser,
  getUsers, addUser, deleteUser, updateUserPassword, type User,
} from "@/lib/auth";
import * as XLSX from "xlsx";
import logoVL from "@/assets/logo-vl.png";

type Pending = {
  fileName: string;
  numeroProcesso: string;
  dataDistribuicao: string;
  valor: string;
  cpfAutor: string;
  cnpjReu: string;
  materia: string;
  autor: string;
  reu: string;
  advogado: string;
  grupo: string;
};

const empty = (): Pending => ({
  fileName: "", numeroProcesso: "", dataDistribuicao: "", valor: "",
  cpfAutor: "", cnpjReu: "", materia: "", autor: "", reu: "",
  advogado: "", grupo: "",
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Sistema de Cadastros e Recibos" },
      { name: "description", content: "Gestão de processos e recibos com leitura automática de PDF." },
    ],
  }),
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { ensureSeedAdmin(); setUser(getCurrentUser()); }, []);
  if (!user) return <LoginScreen onLogin={(u) => setUser(u)} />;
  return <App user={user} onLogout={() => { authLogout(); setUser(null); }} />;
}

function LoginScreen({ onLogin }: { onLogin: (u: User) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const u = authLogin(username.trim(), password);
    if (!u) { toast.error("Usuário ou senha incorretos."); return; }
    onLogin(u);
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Toaster richColors position="top-right" />
      <Card className="w-full max-w-sm p-6 border-[var(--gold)]/30" style={{ boxShadow: "var(--shadow-elegant)" }}>
        <div className="flex flex-col items-center gap-2 mb-6">
          <img src={logoVL} alt="Logo VL" className="h-16 w-16 rounded-full border-2 border-[var(--gold)]/60 object-cover"/>
          <h1 className="text-xl font-bold">Entrar</h1>
          <p className="text-xs text-muted-foreground text-center">Padrão inicial: admin / admin</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <div>
            <Label className="text-xs">Usuário</Label>
            <Input value={username} onChange={(e)=>setUsername(e.target.value)} autoFocus/>
          </div>
          <div>
            <Label className="text-xs">Senha</Label>
            <Input type="password" value={password} onChange={(e)=>setPassword(e.target.value)}/>
          </div>
          <Button type="submit" className="w-full bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold)]/90 font-semibold">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  );
}

function App({ user, onLogout }: { user: User; onLogout: () => void }) {
  const [cadastros, setCadastros] = useState<Cadastro[]>([]);
  const [recibos, setRecibos] = useState<Recibo[]>([]);
  const [pendings, setPendings] = useState<Pending[]>([]);
  const [parsing, setParsing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const recFileRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  type RecStaged = {
    id: string;
    file: File;
    nome: string;
    numero: string;
    data: string;
    advogado: string;
    grupo: string;
  };
  const [recStaged, setRecStaged] = useState<RecStaged[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<"todos" | "pendente" | "concluido">("todos");
  const [buscaRecibos, setBuscaRecibos] = useState("");

  const refresh = () => { setCadastros(getCadastros()); setRecibos(getRecibos()); };
  useEffect(() => { refresh(); }, []);

  async function handlePdfPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setParsing(true);
    try {
      const { parseReciboPdf } = await import("@/lib/pdf-parser");
      const novos: Pending[] = [];
      for (const file of files) {
        try {
          const p = await parseReciboPdf(file);
          novos.push({
            fileName: file.name,
            numeroProcesso: p.numeroProcesso ?? "",
            dataDistribuicao: p.dataDistribuicao ?? "",
            valor: p.valor ?? "",
            cpfAutor: p.cpfAutor ?? "",
            cnpjReu: p.cnpjReu ?? "",
            materia: p.materia ?? "",
            autor: p.autor ?? "",
            reu: p.reu ?? "",
            advogado: p.advogado ?? "",
            grupo: p.grupo ?? "",
          });
        } catch (err) {
          console.error(err);
          toast.error(`Falha ao ler ${file.name}`);
        }
      }
      setPendings((cur) => [...cur, ...novos]);
      toast.success(`${novos.length} PDF(s) lido(s). Confira e clique em Cadastrar.`);
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function updatePending(idx: number, patch: Partial<Pending>) {
    setPendings((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }
  function removePending(idx: number) {
    setPendings((cur) => cur.filter((_, i) => i !== idx));
  }
  function cadastrarUm(idx: number) {
    const p = pendings[idx];
    if (!p.numeroProcesso && !p.autor) { toast.error("Preencha processo ou autor."); return; }
    const { fileName: _f, ...rest } = p;
    void _f;
    saveCadastro({ id: crypto.randomUUID(), ...rest, createdAt: new Date().toISOString() });
    removePending(idx);
    refresh();
    toast.success("Cadastrado.");
  }
  function cadastrarTodos() {
    if (!pendings.length) return;
    pendings.forEach((p) => {
      const { fileName: _f, ...rest } = p;
      void _f;
      saveCadastro({ id: crypto.randomUUID(), ...rest, createdAt: new Date().toISOString() });
    });
    setPendings([]);
    refresh();
    toast.success("Todos cadastrados.");
  }

  async function handleRecPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setEnviando(true);
    try {
      const { parseReciboPdf } = await import("@/lib/pdf-parser");
      const novos: RecStaged[] = [];
      for (const file of files) {
        let parsed: Awaited<ReturnType<typeof parseReciboPdf>> | null = null;
        try {
          parsed = await parseReciboPdf(file);
        } catch (err) {
          console.error("parse fail", file.name, err);
          toast.warning(`Não consegui ler ${file.name}.`);
        }
        novos.push({
          id: crypto.randomUUID(),
          file,
          nome: parsed?.autor || file.name,
          numero: parsed?.numeroProcesso ?? "",
          data: parsed?.dataDistribuicao ?? "",
          advogado: parsed?.advogado ?? "",
          grupo: parsed?.grupo ?? "",
        });
      }
      setRecStaged((cur) => [...novos, ...cur]);
      toast.success(`${novos.length} PDF(s) lido(s). Envie para Recibos.`);
    } finally {
      setEnviando(false);
      if (recFileRef.current) recFileRef.current.value = "";
    }
  }

  async function enviarRecibo(id: string) {
    const item = recStaged.find((r) => r.id === id);
    if (!item) return;
    try {
      const dataUrl = await fileToDataUrl(item.file);
      saveRecibo({
        id: crypto.randomUUID(),
        nome: item.nome || item.file.name,
        numeroProcesso: item.numero,
        dataDistribuicao: item.data,
        advogado: item.advogado,
        grupo: item.grupo,
        pdfDataUrl: dataUrl,
        createdAt: new Date().toISOString(),
      });
      setRecStaged((cur) => cur.filter((r) => r.id !== id));
      refresh();
      toast.success("Recibo enviado.");
    } catch (err) {
      console.error(err);
      toast.error("Falha ao enviar recibo.");
    }
  }

  function updateStaged(id: string, patch: Partial<RecStaged>) {
    setRecStaged((cur) => cur.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  const cadastrosFiltrados = cadastros.filter((c) => {
    if (filtroStatus === "concluido" && !c.concluido) return false;
    if (filtroStatus === "pendente" && c.concluido) return false;
    if (!busca.trim()) return true;
    const q = busca.toLowerCase();
    return [c.numeroProcesso, c.autor, c.reu, c.cpfAutor, c.cnpjReu, c.advogado, c.grupo, c.materia]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  });

  function exportarPlanilha() {
    if (!cadastrosFiltrados.length) { toast.error("Sem dados para exportar."); return; }
    const rows = cadastrosFiltrados.map((c) => ({
      "Processo": c.numeroProcesso,
      "Distribuição": c.dataDistribuicao,
      "Valor": c.valor,
      "Autor": c.autor,
      "CPF Autor": c.cpfAutor,
      "Réu": c.reu,
      "CNPJ Réu": c.cnpjReu,
      "Matéria": c.materia,
      "Advogado": c.advogado,
      "Grupo": c.grupo,
      "Status": c.concluido ? "Cadastrado no CPJ" : "Pendente",
      "Concluído em": c.concluidoEm ?? "",
      "Criado em": c.createdAt,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cadastros");
    XLSX.writeFile(wb, `cadastros_${new Date().toISOString().slice(0,10)}.xlsx`);
    toast.success("Planilha exportada.");
  }

  function toggleConcluido(c: Cadastro) {
    updateCadastro(c.id, c.concluido
      ? { concluido: false, concluidoEm: undefined }
      : { concluido: true, concluidoEm: new Date().toLocaleString("pt-BR") });
    refresh();
  }

  const recibosFiltrados = recibos.filter((r) => {
    if (!buscaRecibos.trim()) return true;
    const q = buscaRecibos.toLowerCase();
    return [r.nome, r.numeroProcesso, r.dataDistribuicao, r.advogado, r.grupo]
      .some((v) => (v ?? "").toLowerCase().includes(q));
  });

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header
        className="border-b border-[var(--gold)]/30"
        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-elegant)" }}
      >
        <div className="container mx-auto px-6 py-8 flex items-center gap-4">
          <img src={logoVL} alt="Logo VL" className="h-16 w-16 rounded-full border-2 border-[var(--gold)]/60 object-cover"/>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-primary-foreground tracking-tight">
              Sistema de Cadastros e Recibos
            </h1>
            <p className="text-sm text-primary-foreground/80">
              Leitura automática de comprovantes processuais
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="text-right text-primary-foreground">
              <div className="text-sm font-medium flex items-center gap-1 justify-end">
                {user.isAdmin && <Shield className="h-3 w-3 text-[var(--gold)]"/>}
                {user.username}
              </div>
              <div className="text-xs opacity-70">{user.isAdmin ? "Administrador" : "Usuário"}</div>
            </div>
            <Button size="sm" variant="outline" onClick={onLogout}
              className="border-[var(--gold)]/60 text-primary-foreground hover:bg-[var(--gold)]/10">
              <LogOut className="h-4 w-4 mr-1"/> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8">
        <Tabs defaultValue="novo" className="w-full">
          <TabsList className={`grid ${user.isAdmin ? "grid-cols-5" : "grid-cols-4"} w-full max-w-4xl mb-6`}>
            <TabsTrigger value="novo"><Plus className="h-4 w-4 mr-1"/>Cadastrar</TabsTrigger>
            <TabsTrigger value="cadastrados">Cadastrar CPJ ({cadastros.length})</TabsTrigger>
            <TabsTrigger value="recibo"><Upload className="h-4 w-4 mr-1"/>Enviar Recibo</TabsTrigger>
            <TabsTrigger value="recibos">Recibos ({recibos.length})</TabsTrigger>
            {user.isAdmin && (
              <TabsTrigger value="usuarios"><UsersIcon className="h-4 w-4 mr-1"/>Usuários</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="novo">
            <Card className="p-6 space-y-4 border-[var(--gold)]/30">
              <div className="flex flex-wrap items-center gap-3">
                <input ref={fileRef} type="file" accept="application/pdf" multiple onChange={handlePdfPick} className="hidden" id="pdf-input"/>
                <Label htmlFor="pdf-input" className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">
                  <Upload className="h-4 w-4"/> {parsing ? "Lendo PDFs..." : "Selecionar PDFs (pode selecionar vários)"}
                </Label>
                {pendings.length > 0 && (
                  <Button onClick={cadastrarTodos} className="bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold)]/90 font-semibold">
                    Cadastrar todos ({pendings.length})
                  </Button>
                )}
              </div>

              {pendings.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum PDF carregado. Selecione um ou mais comprovantes.</p>
              ) : (
                <div className="space-y-4">
                  {pendings.map((p, idx) => (
                    <div key={idx} className="border border-[var(--gold)]/30 rounded-lg p-4 space-y-3 bg-card">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-[var(--gold)]"/>
                          <span className="font-medium truncate">{p.fileName}</span>
                          {p.grupo && <Badge className="bg-[var(--gold)] text-[var(--navy)]">{p.grupo}</Badge>}
                        </div>
                        <Button size="icon" variant="ghost" onClick={()=>removePending(idx)}>
                          <X className="h-4 w-4"/>
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Número do processo" value={p.numeroProcesso} onChange={(v)=>updatePending(idx,{numeroProcesso:v})}/>
                        <Field label="Data de distribuição" value={p.dataDistribuicao} onChange={(v)=>updatePending(idx,{dataDistribuicao:v})}/>
                        <Field label="Valor da causa" value={p.valor} onChange={(v)=>updatePending(idx,{valor:v})}/>
                        <Field label="Matéria / Assunto" value={p.materia} onChange={(v)=>updatePending(idx,{materia:v})}/>
                        <Field label="Autor" value={p.autor} onChange={(v)=>updatePending(idx,{autor:v})}/>
                        <Field label="CPF do autor" value={p.cpfAutor} onChange={(v)=>updatePending(idx,{cpfAutor:v})}/>
                        <Field label="Réu" value={p.reu} onChange={(v)=>updatePending(idx,{reu:v})}/>
                        <Field label="CNPJ do réu" value={p.cnpjReu} onChange={(v)=>updatePending(idx,{cnpjReu:v})}/>
                        <Field label="Advogado" value={p.advogado} onChange={(v)=>updatePending(idx,{advogado:v})}/>
                        <Field label="Grupo" value={p.grupo} onChange={(v)=>updatePending(idx,{grupo:v})}/>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={()=>cadastrarUm(idx)} className="bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold)]/90 font-semibold">
                          Cadastrar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="cadastrados">
            <Card className="p-6 border-[var(--gold)]/30 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                  <Input
                    placeholder="Pesquisar por processo, autor, CPF, advogado..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <div className="flex gap-1">
                  {(["todos","pendente","concluido"] as const).map((s) => (
                    <Button key={s} size="sm"
                      variant={filtroStatus===s?"default":"outline"}
                      onClick={()=>setFiltroStatus(s)}
                      className={filtroStatus===s?"bg-primary text-primary-foreground":""}>
                      {s==="todos"?"Todos":s==="pendente"?"Pendentes":"Cadastrados no CPJ"}
                    </Button>
                  ))}
                </div>
                <Button onClick={exportarPlanilha} className="bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold)]/90 font-semibold">
                  <FileSpreadsheet className="h-4 w-4 mr-1"/> Exportar planilha
                </Button>
              </div>
              {cadastrosFiltrados.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum cadastro ainda.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary text-primary-foreground">
                      <tr>
                        {["CPJ","Processo","Distribuição","Valor","Autor","CPF","Réu","CNPJ","Matéria","Advogado","Grupo",""].map(h=>(
                          <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cadastrosFiltrados.map(c=>(
                        <tr key={c.id} className={`border-b border-border hover:bg-muted/50 ${c.concluido ? "bg-[var(--gold)]/10" : ""}`}>
                          <td className="px-3 py-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox checked={!!c.concluido} onCheckedChange={()=>toggleConcluido(c)}/>
                              {c.concluido && <CheckCircle2 className="h-4 w-4 text-[var(--gold)]"/>}
                            </label>
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{c.numeroProcesso}</td>
                          <td className="px-3 py-2">{c.dataDistribuicao}</td>
                          <td className="px-3 py-2 font-semibold text-white">{c.valor}</td>
                          <td className="px-3 py-2">{c.autor}</td>
                          <td className="px-3 py-2 font-mono text-xs">{c.cpfAutor}</td>
                          <td className="px-3 py-2">{c.reu}</td>
                          <td className="px-3 py-2 font-mono text-xs">{c.cnpjReu}</td>
                          <td className="px-3 py-2">{c.materia}</td>
                          <td className="px-3 py-2">{c.advogado}</td>
                          <td className="px-3 py-2">{c.grupo && <Badge className="bg-[var(--gold)] text-[var(--navy)]">{c.grupo}</Badge>}</td>
                          <td className="px-3 py-2">
                            <Button size="icon" variant="ghost" onClick={()=>{deleteCadastro(c.id);refresh();}}>
                              <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="recibo">
            <Card className="p-6 space-y-4 border-[var(--gold)]/30">
              <div>
                <Label>Arquivos PDF (pode selecionar vários)</Label>
                <input ref={recFileRef} type="file" accept="application/pdf" multiple onChange={handleRecPick} className="block mt-1 text-sm"/>
                <p className="text-xs text-muted-foreground mt-2">
                  {enviando ? "Lendo PDFs..." : "Cada recibo é enviado individualmente para a aba Recibos."}
                </p>
              </div>
              {recStaged.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum recibo pendente de envio.</p>
              ) : (
                <div className="space-y-3">
                  {recStaged.map((r) => (
                    <div key={r.id} className="border border-[var(--gold)]/30 rounded-lg p-4 space-y-3 bg-card">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          <FileText className="h-4 w-4 text-[var(--gold)] shrink-0"/>
                          <span className="font-medium truncate">{r.file.name}</span>
                          {r.grupo && <Badge className="bg-[var(--gold)] text-[var(--navy)]">{r.grupo}</Badge>}
                        </div>
                        <Button size="icon" variant="ghost" onClick={()=>setRecStaged(cur=>cur.filter(x=>x.id!==r.id))}>
                          <X className="h-4 w-4"/>
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Nome" value={r.nome} onChange={(v)=>updateStaged(r.id,{nome:v})}/>
                        <Field label="Número do processo" value={r.numero} onChange={(v)=>updateStaged(r.id,{numero:v})}/>
                        <Field label="Data de distribuição" value={r.data} onChange={(v)=>updateStaged(r.id,{data:v})}/>
                        <Field label="Advogado" value={r.advogado} onChange={(v)=>updateStaged(r.id,{advogado:v})}/>
                        <Field label="Grupo" value={r.grupo} onChange={(v)=>updateStaged(r.id,{grupo:v})}/>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={()=>enviarRecibo(r.id)} className="bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold)]/90 font-semibold">
                          <Upload className="h-4 w-4 mr-1"/> Enviar para Recibos
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="recibos">
            <Card className="p-6 border-[var(--gold)]/30 space-y-4">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
                <Input
                  placeholder="Pesquisar por nome, processo, advogado, grupo..."
                  value={buscaRecibos}
                  onChange={(e)=>setBuscaRecibos(e.target.value)}
                  className="pl-9"
                />
              </div>
              {recibos.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum recibo arquivado.</p>
              ) : recibosFiltrados.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">Nenhum recibo encontrado para "{buscaRecibos}".</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {recibosFiltrados.map(r=>(
                    <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                      <FileText className="h-8 w-8 text-[var(--gold)]"/>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.nome}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {r.numeroProcesso} · {r.dataDistribuicao || new Date(r.createdAt).toLocaleDateString()}
                          {r.advogado ? ` · ${r.advogado}` : ""}
                        </div>
                        {r.grupo && <Badge className="mt-1 bg-[var(--gold)] text-[var(--navy)]">{r.grupo}</Badge>}
                      </div>
                      <a href={r.pdfDataUrl} download={`${r.nome}.pdf`} target="_blank" rel="noreferrer">
                        <Button size="icon" variant="ghost"><Download className="h-4 w-4"/></Button>
                      </a>
                      <Button size="icon" variant="ghost" onClick={()=>{deleteRecibo(r.id);refresh();}}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {user.isAdmin && (
            <TabsContent value="usuarios">
              <UsersPanel currentUsername={user.username}/>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1"/>
    </div>
  );
}

function UsersPanel({ currentUsername }: { currentUsername: string }) {
  const [users, setUsers] = useState<User[]>([]);
  const [novoUser, setNovoUser] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [novoAdmin, setNovoAdmin] = useState(false);
  const refresh = () => setUsers(getUsers());
  useEffect(() => { refresh(); }, []);

  const MAX_USERS = 20;

  function criar() {
    if (!novoUser.trim() || !novaSenha) { toast.error("Preencha usuário e senha."); return; }
    if (users.length >= MAX_USERS) { toast.error(`Limite de ${MAX_USERS} usuários atingido.`); return; }
    try {
      addUser({ username: novoUser.trim(), password: novaSenha, isAdmin: novoAdmin });
      setNovoUser(""); setNovaSenha(""); setNovoAdmin(false);
      refresh();
      toast.success("Usuário criado.");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  function remover(u: string) {
    if (u === currentUsername) { toast.error("Você não pode remover a si mesmo."); return; }
    deleteUser(u); refresh();
    toast.success("Removido.");
  }
  function trocarSenha(u: string) {
    const nova = window.prompt(`Nova senha para ${u}:`);
    if (!nova) return;
    updateUserPassword(u, nova); refresh();
    toast.success("Senha atualizada.");
  }

  return (
    <Card className="p-6 border-[var(--gold)]/30 space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-[var(--gold)]"/> Cadastrar novo usuário
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            {users.length} / {MAX_USERS} usuários
          </span>
        </h2>
        {users.length >= MAX_USERS && (
          <p className="text-sm text-destructive mb-2 flex items-center gap-1">
            <Shield className="h-4 w-4"/> Limite de {MAX_USERS} usuários atingido. Remova um para criar outro.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div><Label className="text-xs">Usuário</Label><Input value={novoUser} onChange={(e)=>setNovoUser(e.target.value)}/></div>
          <div><Label className="text-xs">Senha</Label><Input type="text" value={novaSenha} onChange={(e)=>setNovaSenha(e.target.value)}/></div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox checked={novoAdmin} onCheckedChange={(v)=>setNovoAdmin(!!v)}/>
            Administrador
          </label>
          <Button onClick={criar} disabled={users.length >= MAX_USERS} className="bg-[var(--gold)] text-[var(--navy)] hover:bg-[var(--gold)]/90 font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
            Criar
          </Button>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">Usuários cadastrados</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-primary text-primary-foreground">
              <tr>
                {["Usuário","Tipo","Criado em",""].map(h=>(
                  <th key={h} className="text-left px-3 py-2 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u=>(
                <tr key={u.username} className="border-b border-border hover:bg-muted/50">
                  <td className="px-3 py-2 font-medium flex items-center gap-1">
                    {u.isAdmin && <Shield className="h-3 w-3 text-[var(--gold)]"/>}
                    {u.username}
                    {u.username === currentUsername && <Badge className="ml-2 bg-[var(--gold)] text-[var(--navy)]">você</Badge>}
                  </td>
                  <td className="px-3 py-2">{u.isAdmin ? "Administrador" : "Usuário"}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleString("pt-BR")}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" onClick={()=>trocarSenha(u.username)}>Trocar senha</Button>
                      <Button size="icon" variant="ghost" onClick={()=>remover(u.username)} disabled={u.username===currentUsername}>
                        <Trash2 className="h-4 w-4 text-destructive"/>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}
