import React, { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useFirestoreData, allocateProcessNumber, createOrcamentoRequest, useOrcamentosLivroCaixa, setUsuarioDoc } from "./firestore-data-layer";
import { auth, firebaseConfig } from "./firebase-config";
import { initializeApp, getApps, deleteApp } from "firebase/app";
import {
  INK,
  PAPER,
  SURFACE,
  TINT,
  BORDER,
  ACCENT,
  ACCENT2,
  MUTED,
  GRAY,
  DANGER,
  WARNING_ORANGE,
  REPLY_BLUE,
  BADGE_BLUE_LIGHT,
  SUCCESS_GREEN,
  DEFAULT_STATUSES,
  styles,
  statusMeta,
  statusPillStyle,
  contrastTextColor,
  htmlToPlainText,
  sectorColorForId,
  processNumberColor,
  sectorLabel,
  sectorIndex,
  fmtDate,
  fmtDateTime,
  plainNumber,
  checklistPercentColor,
  formatDuration,
  deadlineInfo,
} from "./ui-shared";

// Telas secundárias (menos usadas no dia a dia) carregadas SOB DEMANDA — o
// navegador só baixa o código de cada uma quando a pessoa realmente clica
// nela, em vez de baixar tudo de uma vez ao abrir o sistema.
const AguardandoView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.AguardandoView })));
const ArchiveView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.ArchiveView })));
const TrashView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.TrashView })));
const DemandasView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.DemandasView })));
const AdminView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.AdminView })));
const AcessosView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.AcessosView })));
const AtividadeView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.AtividadeView })));
const ConfiguracoesView = React.lazy(() => import("./secondary-views").then((m) => ({ default: m.ConfiguracoesView })));

function LazyViewFallback() {
  return (
    <div style={{ padding: 40, textAlign: "center", color: MUTED, fontFamily: "'Inter', sans-serif", fontSize: 13.5 }}>
      Carregando…
    </div>
  );
}

// Rede de segurança: se alguma tela travar com um erro, mostra a mensagem
// na tela em vez de deixar tudo branco — assim dá pra tirar print do erro
// exato sem precisar abrir o console do navegador (F12).
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("Erro capturado pela ErrorBoundary:", error, info);
    const msg = String((error && error.message) || "");
    // Acontece quando o navegador tinha a página aberta de antes de uma
    // atualização nova ser publicada, e tenta buscar uma parte do sistema
    // que já não existe mais com esse nome (o nome muda a cada publicação).
    // Um recarregamento simples resolve sozinho — só tenta uma vez por
    // sessão, pra não ficar recarregando em loop se o problema for outro.
    const isChunkLoadError = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i.test(
      msg
    );
    if (isChunkLoadError) {
      try {
        const jaTentou = window.sessionStorage.getItem("recarregouPorChunkDesatualizado");
        if (!jaTentou) {
          window.sessionStorage.setItem("recarregouPorChunkDesatualizado", "1");
          window.location.reload();
        }
      } catch (e) {
        // sem acesso a sessionStorage — deixa a tela de erro normal aparecer
      }
    }
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: 24,
            margin: 16,
            background: "#FFF1F0",
            border: "2px solid #B3261E",
            borderRadius: 12,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12.5,
            color: "#0B0D14",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#B3261E" }}>
            ⚠ Algo deu errado nesta tela — tira um print disto:
          </div>
          <div>{String(this.state.error && this.state.error.message)}</div>
          <div style={{ marginTop: 10, opacity: 0.75, fontSize: 11 }}>{this.state.error && this.state.error.stack}</div>
          <button
            style={{
              marginTop: 14,
              padding: "8px 14px",
              background: "#0B0D14",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontFamily: "'Inter', sans-serif",
              fontSize: 13,
              cursor: "pointer",
            }}
            onClick={() => this.setState({ error: null })}
          >
            Tentar de novo
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  createUserWithEmailAndPassword,
  getAuth,
  deleteUser,
} from "firebase/auth";
import {
  Plus,
  Search,
  List as ListIcon,
  Trash2,
  X,
  Clock,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  FileText,
  AlertCircle,
  Menu,
  Paperclip,
  Reply,
  Building2,
  Settings2,
  Image as ImageIcon,
  CheckCircle2,
  Circle,
  Folder,
  DollarSign,
  Users,
  User,
  Settings,
  Gavel,
  UserCircle2,
  Lock,
  Archive,
  ArchiveRestore,
  Printer,
  Mail,
  Link2,
  Timer,
  Zap,
  LayoutDashboard,
  Bold,
  Italic,
  Underline,
  Quote,
  ListOrdered,
  List as ListBulletIcon,
  Palette,
  Ban,
  AtSign,
  Pencil,
  Download,
  BarChart3,
  Activity,
  LogIn,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";

const NONE_SECTOR = "__none__";
const NONE_PARENT = "__none_parent__";
const FINANCEIRO_SECTOR_ID = "setor-financeiro-fixo";
const ADMINISTRATIVO_SECTOR_ID = "setor-administrativo-fixo";
const MANUTENCAO_SECTOR_ID = "setor-manutencao-fixo";

const COLOR_PRESETS = [
  "#1E49E2",
  "#0B2E86",
  "#2F6FED",
  "#0B0D14",
  "#5B6472",
  "#B3261E",
  "#1D7A46",
  "#C2410C",
  "#B45309",
  "#7C3AED",
  "#DB2777",
  "#0891B2",
  "#4D7C0F",
  "#78716C",
  "#EAB308",
];

const PRIORITIES = [
  { id: "baixa", label: "Baixa" },
  { id: "media", label: "Média" },
  { id: "alta", label: "Alta" },
];

const EVENT_STATUSES = [
  { id: "andamento", label: "Em andamento", dot: "#F97316" },
  { id: "aguarda", label: "Aguarda Execução", dot: "#FACC15" },
  { id: "aguarda_compra", label: "Aguardando Compra", dot: "#7C4A25" },
  { id: "aguarda_recebimento", label: "Aguardando Recebimento", dot: "#7C3AED" },
  { id: "aguardando_resposta", label: "Aguardando Resposta", dot: "#39FF14" },
  { id: "fazer_urgente", label: "FAZER URGENTE", dot: "#DC2626" },
  { id: "realizado", label: "Realizado", dot: "#1D7A46" },
  { id: "nao_realizado", label: "Não Realizado no Prazo", dot: "#B3261E" },
  { id: "nao_sera_realizado", label: "Não será realizado", dot: "#F472B6" },
  { id: "execucao_travada", label: "Execução Travada", dot: "#B8860B" },
  { id: "em_votacao", label: "Em Votação", dot: "#F97316" },
  { id: "aprovado", label: "Aprovado (votação)", dot: "#1D7A46" },
  { id: "rejeitado", label: "Rejeitado (votação)", dot: "#B3261E" },
  { id: "em_acompanhamento", label: "Em Acompanhamento", dot: "#9CA3AF" },
];

const SECTOR_PALETTE = COLOR_PRESETS;

const FIXED_FLOW_STATUS_IDS = ["orcamento_fazer", "orcamento_adiado", "para_decisao", "os_fazer", "os_adiado", "parado"];
const ARCHIVE_GRACE_DAYS = 5;
const STALE_DAYS = 10;

function availableStatusesFor(p, statuses) {
  const inOrcamentoFlow = p.sectorId === FINANCEIRO_SECTOR_ID && (p.status === "orcamento_fazer" || p.status === "orcamento_adiado");
  if (inOrcamentoFlow) {
    return statuses.filter((s) => ["orcamento_fazer", "orcamento_adiado", "cancelado", "concluido"].includes(s.id));
  }
  const inOsFlow = p.sectorId === MANUTENCAO_SECTOR_ID && (p.status === "os_fazer" || p.status === "os_adiado");
  if (inOsFlow) {
    return statuses.filter((s) => ["os_fazer", "os_adiado", "cancelado", "concluido"].includes(s.id));
  }
  return statuses.filter((s) => !FIXED_FLOW_STATUS_IDS.includes(s.id) || s.id === p.status);
}

function statusesForSectorBoard(setorId, statuses) {
  const nonFixed = statuses.filter((s) => !FIXED_FLOW_STATUS_IDS.includes(s.id));
  if (setorId === ADMINISTRATIVO_SECTOR_ID)
    return [...nonFixed, ...statuses.filter((s) => s.id === "para_decisao" || s.id === "parado")];
  if (setorId === FINANCEIRO_SECTOR_ID) return [...nonFixed, ...statuses.filter((s) => s.id === "orcamento_fazer" || s.id === "orcamento_adiado")];
  if (setorId === MANUTENCAO_SECTOR_ID) return [...nonFixed, ...statuses.filter((s) => s.id === "os_fazer" || s.id === "os_adiado")];
  return nonFixed;
}

function eventStatusMeta(id) {
  return EVENT_STATUSES.find((s) => s.id === id) || EVENT_STATUSES[0];
}
function sectorColor(index) {
  return SECTOR_PALETTE[index % SECTOR_PALETTE.length];
}
function checklistPercent(p) {
  if (!p.checklistEnabled || !p.checklist || p.checklist.length === 0) return null;
  const done = p.checklist.filter((c) => c.done).length;
  return Math.round((done / p.checklist.length) * 100);
}

function uid() {
  return "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function getDeviceToken() {
  try {
    let token = window.localStorage.getItem("processos-device-token");
    if (!token) {
      token = "dev_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
      window.localStorage.setItem("processos-device-token", token);
    }
    return token;
  } catch (e) {
    return "dev_sem_storage";
  }
}

function draftStorageKey(processId, replyTo) {
  return `processos-draft-${processId}-${replyTo || "root"}`;
}
function loadDraft(processId, replyTo) {
  try {
    return window.localStorage.getItem(draftStorageKey(processId, replyTo)) || "";
  } catch (e) {
    return "";
  }
}
function saveDraftToStorage(processId, replyTo, html) {
  try {
    const key = draftStorageKey(processId, replyTo);
    const plain = (html || "").replace(/<[^>]*>/g, "").trim();
    if (!plain) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, html);
    }
  } catch (e) {
    // sem acesso ao localStorage
  }
}
function clearDraft(processId, replyTo) {
  try {
    window.localStorage.removeItem(draftStorageKey(processId, replyTo));
  } catch (e) {
    // sem acesso ao localStorage
  }
}
function padNumber(n) {
  return String(n).padStart(4, "0");
}

function isNestableReply(e) {
  return !(e.kind === "transferencia" || e.kind === "vencimento" || (e.kind === "evento" && e.auto === true));
}

function buildDisplayOrder(events, collapsedOverrides, forceExpandSeq) {
  const eventsBySeq = {};
  events.forEach((e) => {
    eventsBySeq[e.seq] = e;
  });

  // Acha o andamento "raiz" da conversa, subindo a cadeia de respostas. Uma resposta a uma
  // resposta continua pertencendo à mesma conversa do andamento original (não cria um novo nível).
  function threadRootSeq(e) {
    if (!e.replyTo || !isNestableReply(e)) return null;
    let current = eventsBySeq[e.replyTo];
    let rootSeq = e.replyTo;
    const visited = new Set([e.seq]);
    while (current && current.replyTo && isNestableReply(current) && !visited.has(current.seq)) {
      visited.add(current.seq);
      rootSeq = current.replyTo;
      current = eventsBySeq[current.replyTo];
    }
    return rootSeq;
  }

  const childrenMap = {};
  events.forEach((e) => {
    const key = threadRootSeq(e) || "root";
    if (!childrenMap[key]) childrenMap[key] = [];
    childrenMap[key].push(e);
  });

  const rootsChrono = [...(childrenMap.root || [])].sort((a, b) => a.seq - b.seq); // cronológico, pra numerar 1,2,3... sem furos
  const rootNumberBySeq = {};
  rootsChrono.forEach((e, i) => {
    rootNumberBySeq[e.seq] = plainNumber(i + 1);
  });
  const roots = [...rootsChrono].sort((a, b) => b.seq - a.seq); // mais recente primeiro, pra exibição
  const numberBySeq = {};
  const order = [];
  const nowMs = Date.now();
  const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

  roots.forEach((rootEv) => {
    const number = rootNumberBySeq[rootEv.seq];
    numberBySeq[rootEv.seq] = number;
    const threadMembers = [...(childrenMap[rootEv.seq] || [])].sort((a, b) => a.seq - b.seq); // cronológico
    const hasRecentReply = threadMembers.some((m) => nowMs - new Date(m.date).getTime() < TWO_DAYS_MS);
    const defaultCollapsed = threadMembers.length > 0 && !hasRecentReply;
    let isCollapsed = collapsedOverrides && collapsedOverrides.has(rootEv.seq) ? collapsedOverrides.get(rootEv.seq) : defaultCollapsed;
    if (forceExpandSeq && (rootEv.seq === forceExpandSeq || threadMembers.some((m) => m.seq === forceExpandSeq))) {
      isCollapsed = false;
    }
    order.push({ event: rootEv, number, depth: 0, descendantCount: threadMembers.length, isCollapsed });
    if (!isCollapsed) {
      threadMembers.forEach((child, i) => {
        const childNumber = `${number}.${i + 1}`;
        numberBySeq[child.seq] = childNumber;
        order.push({ event: child, number: childNumber, depth: 1, descendantCount: 0, isCollapsed: false });
      });
    }
  });

  return { order, numberBySeq };
}

// Item pedido pelo usuário: mensagens automáticas (transferências, avisos de
// decisão, etc.) precisam citar o número EXIBIDO do andamento (que respeita a
// numeração de resposta, tipo "22.3"), não o seq bruto — senão o texto cita um
// número que nunca aparece na tela pro usuário achar.
function displayNumberFor(allEventsIncludingTarget, targetSeq) {
  const { numberBySeq } = buildDisplayOrder(allEventsIncludingTarget);
  return numberBySeq[targetSeq] || plainNumber(targetSeq);
}
function formatGlobalNumber(n) {
  const year = new Date().getFullYear();
  return `${String(n).padStart(4, "0")}/${year}`;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderInline(str, colaboradores) {
  const names = (colaboradores || [])
    .map((c) => c.name)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)
    .map(escapeRegExp);
  const mentionGroup = names.length ? `|@(${names.join("|")})` : "";
  const regex = new RegExp(`\\{\\{color:(#[0-9a-fA-F]{6})\\|(.*?)\\}\\}|\\*\\*(.*?)\\*\\*|__(.*?)__|\\*(.*?)\\*${mentionGroup}`, "g");
  const parts = [];
  let lastIndex = 0;
  let m;
  let i = 0;
  while ((m = regex.exec(str)) !== null) {
    if (m.index > lastIndex) parts.push(str.slice(lastIndex, m.index));
    if (m[1] !== undefined) {
      parts.push(
        <span key={i++} style={{ color: m[1] }}>
          {m[2]}
        </span>
      );
    } else if (m[3] !== undefined) {
      parts.push(<strong key={i++}>{m[3]}</strong>);
    } else if (m[4] !== undefined) {
      parts.push(<u key={i++}>{m[4]}</u>);
    } else if (m[5] !== undefined) {
      parts.push(<em key={i++}>{m[5]}</em>);
    } else if (m[6] !== undefined) {
      parts.push(
        <span key={i++} style={styles.mentionTag}>
          @{m[6]}
        </span>
      );
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < str.length) parts.push(str.slice(lastIndex));
  return parts;
}

function renderRichText(text, colaboradores) {
  if (!text) return null;
  const lines = text.split("\n");
  const blocks = [];
  let listBuffer = null;

  function flushList() {
    if (!listBuffer) return;
    const items = listBuffer.items.map((it, i) => <li key={i}>{renderInline(it, colaboradores)}</li>);
    blocks.push(
      listBuffer.type === "ol" ? (
        <ol key={blocks.length} style={styles.richList}>
          {items}
        </ol>
      ) : (
        <ul key={blocks.length} style={styles.richList}>
          {items}
        </ul>
      )
    );
    listBuffer = null;
  }

  lines.forEach((line) => {
    const bulletMatch = /^-\s+(.*)/.exec(line);
    const numberedMatch = /^\d+\.\s+(.*)/.exec(line);
    const quoteMatch = /^>\s?(.*)/.exec(line);
    if (bulletMatch) {
      if (!listBuffer || listBuffer.type !== "ul") {
        flushList();
        listBuffer = { type: "ul", items: [] };
      }
      listBuffer.items.push(bulletMatch[1]);
    } else if (numberedMatch) {
      if (!listBuffer || listBuffer.type !== "ol") {
        flushList();
        listBuffer = { type: "ol", items: [] };
      }
      listBuffer.items.push(numberedMatch[1]);
    } else {
      flushList();
      if (quoteMatch) {
        blocks.push(
          <blockquote key={blocks.length} style={styles.richQuote}>
            {renderInline(quoteMatch[1], colaboradores)}
          </blockquote>
        );
      } else if (line.trim() === "") {
        blocks.push(<div key={blocks.length} style={{ height: 8 }} />);
      } else {
        blocks.push(<div key={blocks.length}>{renderInline(line, colaboradores)}</div>);
      }
    }
  });
  flushList();
  return <>{blocks}</>;
}

function renderDescription(text, colaboradores) {
  if (!text) return null;
  if (looksLikeHTML(text)) {
    return <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHTML(text) }} />;
  }
  return renderRichText(text, colaboradores);
}

function sanitizeHTML(html) {
  if (!html) return "";
  let out = String(html);
  // Tags perigosas inteiras (com o conteúdo de dentro) — remove todas as
  // formas de abrir/fechar, mesmo cortadas/quebradas.
  const perigosas = ["script", "iframe", "object", "embed", "link", "style", "svg", "math", "form", "base", "meta"];
  perigosas.forEach((tag) => {
    out = out.replace(new RegExp(`<${tag}[\\s\\S]*?<\\/${tag}\\s*>`, "gi"), "");
    out = out.replace(new RegExp(`<${tag}[^>]*>`, "gi"), "");
  });
  // Atributos de evento (onclick, onerror, onload...) — com aspas duplas,
  // aspas simples, ou SEM aspas nenhuma (ex: onerror=alert(1)).
  out = out
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "");
  // Links/imagens que executam código via "javascript:" ou "data:" em vez
  // de apontar pra um endereço de verdade.
  out = out
    .replace(/\s(href|src|action)\s*=\s*"(\s*javascript:|\s*data:text\/html)[^"]*"/gi, "")
    .replace(/\s(href|src|action)\s*=\s*'(\s*javascript:|\s*data:text\/html)[^']*'/gi, "");
  return out;
}

function looksLikeHTML(text) {
  return /<\/?(b|i|u|div|br|ul|ol|li|blockquote|span|p|strong|em)\b|&[a-zA-Z]+;|&#\d+;/i.test(text || "");
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function toDisplayHtml(text) {
  if (!text) return "";
  return looksLikeHTML(text) ? sanitizeHTML(text) : escapeHtml(text).replace(/\n/g, "<br/>");
}

function buildProcessoHtml(processo, statuses, setores) {
  const statusL = statusMeta(processo.status, statuses).label;
  const setorL = sectorLabel(processo.sectorId, setores);
  const eventsHtml = [...processo.events]
    .map(
      (e) => `
      <div class="ev">
        <div class="ev-meta">Andamento nº ${plainNumber(e.seq)} — ${fmtDateTime(e.date)}${e.authorName ? " · " + escapeHtml(e.authorName) : ""}</div>
        <div class="ev-body">${toDisplayHtml(e.description)}</div>
      </div>`
    )
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(processo.number)} — ${escapeHtml(processo.title)}</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #12141A; max-width: 780px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #5B6472; font-size: 13px; margin-bottom: 20px; }
  .desc { border: 1px solid #DEDBCF; border-radius: 8px; padding: 12px 14px; margin-bottom: 24px; }
  h2 { font-size: 15px; border-bottom: 1px solid #DEDBCF; padding-bottom: 6px; margin-top: 28px; }
  .ev { border-top: 1px solid #E1E4EB; padding: 10px 0; }
  .ev-meta { font-size: 11.5px; color: #5B6472; margin-bottom: 4px; }
  .ev-body { font-size: 13.5px; line-height: 1.5; }
  ul, ol { margin: 4px 0; padding-left: 22px; }
  blockquote { margin: 4px 0; padding-left: 10px; border-left: 3px solid #DEDBCF; color: #5B6472; font-style: italic; }
  .howto { background: #EEF3FD; border-radius: 8px; padding: 12px 14px; margin-bottom: 24px; font-size: 12.5px; color: #333; }
  @media print { .howto { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="howto">Para salvar como PDF: use o menu de impressão do seu navegador (Ctrl+P ou o botão de compartilhar/imprimir) e escolha "Salvar como PDF".</div>
  <h1>${escapeHtml(processo.number)} — ${escapeHtml(processo.title)}</h1>
  <div class="meta">Status: ${escapeHtml(statusL)} · Setor: ${escapeHtml(setorL)} · Aberto em ${fmtDate(processo.createdAt)} · Prioridade: ${escapeHtml(
    PRIORITIES.find((p) => p.id === processo.priority)?.label || ""
  )}${processo.responsible ? " · Responsável: " + escapeHtml(processo.responsible) : ""}</div>
  ${processo.description ? `<div class="desc">${toDisplayHtml(processo.description)}</div>` : ""}
  <h2>Andamentos (${processo.events.length})</h2>
  ${eventsHtml || "<p>Nenhum andamento registrado.</p>"}
</body>
</html>`;
}

function buildBulkHtml(processos, statuses, setores) {
  const sections = processos
    .map((processo) => {
      const statusL = statusMeta(processo.status, statuses).label;
      const setorL = sectorLabel(processo.sectorId, setores);
      const eventsHtml = [...processo.events]
        .map(
          (e) => `
          <div class="ev">
            <div class="ev-meta">Andamento nº ${plainNumber(e.seq)} — ${fmtDateTime(e.date)}${e.authorName ? " · " + escapeHtml(e.authorName) : ""}</div>
            <div class="ev-body">${toDisplayHtml(e.description)}</div>
          </div>`
        )
        .join("");
      return `
      <section class="processo">
        <h1>${escapeHtml(processo.number)} — ${escapeHtml(processo.title)}</h1>
        <div class="meta">Status: ${escapeHtml(statusL)} · Setor: ${escapeHtml(setorL)} · Aberto em ${fmtDate(processo.createdAt)}</div>
        ${processo.description ? `<div class="desc">${toDisplayHtml(processo.description)}</div>` : ""}
        <h2>Andamentos (${processo.events.length})</h2>
        ${eventsHtml || "<p>Nenhum andamento registrado.</p>"}
      </section>`;
    })
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<title>Exportação de ${processos.length} processo(s)</title>
<style>
  body { font-family: Arial, Helvetica, sans-serif; padding: 32px; color: #12141A; max-width: 780px; margin: 0 auto; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { color: #5B6472; font-size: 13px; margin-bottom: 20px; }
  .desc { border: 1px solid #DEDBCF; border-radius: 8px; padding: 12px 14px; margin-bottom: 24px; }
  h2 { font-size: 15px; border-bottom: 1px solid #DEDBCF; padding-bottom: 6px; margin-top: 28px; }
  .ev { border-top: 1px solid #E1E4EB; padding: 10px 0; }
  .ev-meta { font-size: 11.5px; color: #5B6472; margin-bottom: 4px; }
  .ev-body { font-size: 13.5px; line-height: 1.5; }
  ul, ol { margin: 4px 0; padding-left: 22px; }
  blockquote { margin: 4px 0; padding-left: 10px; border-left: 3px solid #DEDBCF; color: #5B6472; font-style: italic; }
  .processo { margin-bottom: 48px; }
  .processo:not(:first-child) { border-top: 3px double #12141A; padding-top: 32px; page-break-before: always; }
  .howto { background: #EEF3FD; border-radius: 8px; padding: 12px 14px; margin-bottom: 24px; font-size: 12.5px; color: #333; }
  @media print { .howto { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="howto">Para salvar como PDF: use o menu de impressão do seu navegador (Ctrl+P) e escolha "Salvar como PDF". Cada processo começa numa página nova ao imprimir.</div>
  ${sections}
</body>
</html>`;
}

function BulkExportLink({ processos, statuses, setores, label }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    if (processos.length === 0) {
      setUrl(null);
      return;
    }
    const html = buildBulkHtml(processos, statuses, setores);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processos.length, processos.map((p) => p.id + p.updatedAt).join(",")]);

  if (processos.length === 0) return null;

  const dateStr = new Date().toISOString().slice(0, 10);

  return (
    <a href={url || "#"} download={`processos-export-${dateStr}.html`} style={styles.secondaryBtnLink} title="Baixa todos estes processos num único arquivo">
      <Printer size={14} /> {label || `Exportar todos (${processos.length})`}
    </a>
  );
}

function loadJsPDF() {
  return new Promise((resolve, reject) => {
    if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    script.onload = () => {
      if (window.jspdf && window.jspdf.jsPDF) resolve(window.jspdf.jsPDF);
      else reject(new Error("Biblioteca de PDF carregou, mas não ficou disponível."));
    };
    script.onerror = () => reject(new Error("Não foi possível carregar a biblioteca de PDF."));
    document.head.appendChild(script);
  });
}

function buildProcessoPdf(JsPdfClass, processo, statuses, setores, assuntos, colaboradores) {
  const doc = new JsPdfClass({ unit: "pt", format: "a4" });
  const marginX = 44;
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  function ensureSpace(lineHeight) {
    if (y + lineHeight > pageHeight - 46) {
      doc.addPage();
      y = 56;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  const tituloLinhas = doc.splitTextToSize(`${processo.number} — ${processo.title}`, maxWidth);
  tituloLinhas.forEach((line) => {
    ensureSpace(20);
    doc.text(line, marginX, y);
    y += 20;
  });
  y += 4;

  doc.setDrawColor(220, 220, 220);
  doc.line(marginX, y, pageWidth - marginX, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90, 90, 90);
  const statusL = statusMeta(processo.status, statuses).label;
  const setorL = sectorLabel(processo.sectorId, setores);
  const prioridadeL = PRIORITIES.find((p) => p.id === processo.priority)?.label || "—";
  const classificacaoL = processo.classification === "especial" ? "Especial" : "Simples";
  const assuntoL = processo.assuntoId && assuntos ? (assuntos.find((a) => a.id === processo.assuntoId) || {}).name : null;

  const linhaTopo1 = `Status: ${statusL}   ·   Setor: ${setorL}   ·   Prioridade: ${prioridadeL}   ·   Classificação: ${classificacaoL}`;
  doc.splitTextToSize(linhaTopo1, maxWidth).forEach((line) => {
    ensureSpace(15);
    doc.text(line, marginX, y);
    y += 15;
  });
  let linhaTopo2 = `Aberto em ${fmtDateTime(processo.createdAt)}`;
  if (processo.dueDate) linhaTopo2 += `   ·   Prazo do processo: ${fmtDate(processo.dueDate)}`;
  if (assuntoL) linhaTopo2 += `   ·   Assunto: ${assuntoL}`;
  if (processo.pausedAt) linhaTopo2 += `   ·   PROCESSO PARADO`;
  if (processo.archived) linhaTopo2 += `   ·   Arquivado`;
  doc.splitTextToSize(linhaTopo2, maxWidth).forEach((line) => {
    ensureSpace(15);
    doc.text(line, marginX, y);
    y += 15;
  });
  y += 8;
  doc.setTextColor(20, 20, 20);

  if (processo.description) {
    const descPlain = htmlToPlainText(processo.description);
    if (descPlain) {
      doc.setFontSize(10.5);
      const lines = doc.splitTextToSize(descPlain, maxWidth);
      lines.forEach((line) => {
        ensureSpace(15);
        doc.text(line, marginX, y);
        y += 15;
      });
      y += 12;
    }
  }

  // Checklist, se habilitado
  if (processo.checklistEnabled && processo.checklist && processo.checklist.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    ensureSpace(22);
    doc.text(`${processo.checklistName || "Checklist"} (${processo.checklist.filter((i) => i.done).length}/${processo.checklist.length})`, marginX, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    processo.checklist.forEach((item) => {
      const marca = item.done ? "[x]" : "[ ]";
      const prazoTxt = item.deadline ? `  (prazo: ${fmtDateTime(item.deadline)})` : "";
      const lines = doc.splitTextToSize(`${marca} ${item.text}${prazoTxt}`, maxWidth);
      lines.forEach((line) => {
        ensureSpace(14);
        doc.text(line, marginX, y);
        y += 14;
      });
    });
    y += 10;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  ensureSpace(24);
  doc.text(`Andamentos (${processo.events.length})`, marginX, y);
  y += 20;

  [...processo.events]
    .sort((a, b) => a.seq - b.seq)
    .forEach((e) => {
      ensureSpace(34);
      doc.setDrawColor(230, 230, 230);
      doc.line(marginX, y - 8, pageWidth - marginX, y - 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(90, 90, 90);
      doc.text(`Nº ${plainNumber(e.seq)}  ·  ${fmtDateTime(e.date)}${e.authorName ? "  ·  " + e.authorName : ""}`, marginX, y);
      y += 13;

      // Linha de metadados: setor à época, status, prazo, demandado a, kind especial
      const metaBits = [];
      if (e.sectorAtTime) metaBits.push(sectorLabel(e.sectorAtTime, setores));
      if (e.status) metaBits.push(`Status: ${eventStatusMeta(e.status).label}`);
      if (e.deadline) metaBits.push(`Prazo: ${fmtDateTime(e.deadline)}`);
      if (e.assignedToId && colaboradores) {
        const colab = colaboradores.find((c) => c.id === e.assignedToId);
        if (colab) metaBits.push(`Demandado a: ${colab.name}`);
      }
      if (e.kind === "transferencia") metaBits.push("Transferência de setor");
      if (e.kind === "decisao") metaBits.push(e.decisionType === "final" ? "Decisão final" : "Decisão intermediária");
      if (e.kind === "orcamento" && e.orcamentoType === "pedido") metaBits.push(`Pedido de orçamento${e.fornecedor ? " — " + e.fornecedor : ""}${e.valor ? " — R$ " + e.valor : ""}`);
      if (e.kind === "orcamento" && e.orcamentoType === "opcao") metaBits.push(`Resposta de orçamento${e.loja ? " — " + e.loja : ""}${e.preco ? " — R$ " + e.preco : ""}`);
      if (e.driveLink) metaBits.push("Anexo: link do Google Drive");
      if (e.attachments && e.attachments.length > 0) metaBits.push(`${e.attachments.length} anexo(s)`);
      if (e.replyTo) metaBits.push(`Resposta ao andamento nº ${plainNumber(e.replyTo)}`);
      if (metaBits.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.splitTextToSize(metaBits.join("   ·   "), maxWidth).forEach((line) => {
          ensureSpace(12);
          doc.text(line, marginX, y);
          y += 12;
        });
      }
      y += 3;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10.5);
      doc.setTextColor(20, 20, 20);
      const plain = htmlToPlainText(e.description) || "(sem descrição)";
      const lines = doc.splitTextToSize(plain, maxWidth);
      lines.forEach((line) => {
        ensureSpace(14);
        doc.text(line, marginX, y);
        y += 14;
      });
      y += 10;
    });

  return doc;
}

function PdfExportLink({ processo, statuses, setores, assuntos, colaboradores }) {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  async function handleClick() {
    setGerando(true);
    setErro(null);
    try {
      const JsPdfClass = await loadJsPDF();
      const doc = buildProcessoPdf(JsPdfClass, processo, statuses, setores, assuntos, colaboradores);
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${processo.number.replace(/[^\w-]/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 8000);
    } catch (e) {
      setErro("Não foi possível gerar o PDF agora.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <>
      <button
        style={{ ...styles.secondaryBtnLink, border: "none", cursor: gerando ? "default" : "pointer" }}
        onClick={handleClick}
        disabled={gerando}
        title="Baixa este processo em PDF"
      >
        <FileText size={14} /> {gerando ? "Gerando PDF..." : "Exportar PDF"}
      </button>
      {erro && <div style={styles.attachErrorHint}>{erro}</div>}
    </>
  );
}

function ExportLink({ processo, statuses, setores }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const html = buildProcessoHtml(processo, statuses, setores);
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processo.id, processo.updatedAt, processo.events.length]);

  return (
    <a
      href={url || "#"}
      download={`${processo.number.replace(/[^\w-]/g, "_")}.html`}
      style={styles.secondaryBtnLink}
      title="Baixa um arquivo para abrir no navegador e depois salvar como PDF"
    >
      <Printer size={14} /> Exportar
    </a>
  );
}

function BackupExportLink({ data }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => URL.revokeObjectURL(objUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.processos.length, data.processos.map((p) => p.updatedAt).join(","), data.setores, data.statuses, data.usuarios, data.colaboradores]);

  const dateStr = new Date().toISOString().slice(0, 10);

  return (
    <a href={url || "#"} download={`livro-de-processos-backup-${dateStr}.json`} style={styles.backupLink} title="Baixa uma cópia de segurança de todos os processos">
      <Download size={13} /> Exportar backup completo
    </a>
  );
}

function execCmd(editorRef, onChangeHtml, cmd, val) {
  const el = editorRef.current;
  if (!el) return;
  el.focus();
  document.execCommand(cmd, false, val);
  onChangeHtml(el.innerHTML);
}

function insertMention(editorRef, onChangeHtml, name) {
  const el = editorRef.current;
  if (!el) return;
  el.focus();
  const html = `<span style="color:${ACCENT};background:${TINT};border-radius:4px;padding:0 4px;font-weight:600;">@${name}</span>&nbsp;`;
  const ok = document.execCommand("insertHTML", false, html);
  if (!ok) el.innerHTML += html;
  onChangeHtml(el.innerHTML);
}

function insertListItem(editorRef, onChangeHtml, ordered) {
  const el = editorRef.current;
  if (!el) return;
  el.focus();
  const tag = ordered ? "ol" : "ul";
  const sel = window.getSelection();
  const selectedText = sel && sel.rangeCount > 0 ? sel.toString() : "";
  const itemText = selectedText || "Item";

  // Se o cursor já está dentro de uma lista do mesmo tipo, continua a sequência (novo <li>) em vez de criar outra lista.
  let node = sel && sel.rangeCount > 0 ? sel.anchorNode : null;
  let listNode = null;
  while (node && node !== el) {
    if (node.nodeType === 1 && node.tagName && node.tagName.toLowerCase() === tag) {
      listNode = node;
      break;
    }
    node = node.parentNode;
  }

  if (listNode) {
    const li = document.createElement("li");
    li.textContent = itemText;
    listNode.appendChild(li);
    const range = document.createRange();
    range.selectNodeContents(li);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    const html = `<${tag}><li>${escapeHtml(itemText)}</li></${tag}>`;
    const ok = document.execCommand("insertHTML", false, html);
    if (!ok) el.innerHTML += html;
  }
  onChangeHtml(el.innerHTML);
}

function elapsedLabel(createdAt, nowTs) {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  return formatDuration(nowTs - start);
}

function nextDeadlineEvent(events, nowTs) {
  const upcoming = events
    .filter((e) => e.kind === "evento" && e.deadline && new Date(e.deadline).getTime() > nowTs)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  return upcoming[0] || null;
}

function buildMailto(colaboradorIds, colaboradores, subject, body) {
  const emails = (colaboradorIds || [])
    .map((id) => colaboradores.find((c) => c.id === id))
    .filter((c) => c && c.email && c.email.trim())
    .map((c) => c.email.trim());
  if (emails.length === 0) return null;
  const params = new URLSearchParams({ subject, body });
  return `mailto:${emails.join(",")}?${params.toString().replace(/\+/g, "%20")}`;
}

function resizeImageFile(file, maxDim = 1400, quality = 0.78) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
async function filesToAttachments(fileList) {
  const files = Array.from(fileList);
  const results = [];
  const errors = [];
  for (const f of files) {
    const nameLower = (f.name || "").toLowerCase();
    const isImage = f.type.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(nameLower);
    const isPdf = f.type === "application/pdf" || nameLower.endsWith(".pdf");
    try {
      if (isImage) {
        const dataUrl = await resizeImageFile(f);
        results.push({ id: uid(), name: f.name, type: "image", dataUrl });
      } else if (isPdf) {
        if (f.size > 12 * 1024 * 1024) {
          errors.push(`"${f.name}" é muito grande (máx. 12MB por PDF).`);
          continue;
        }
        const dataUrl = await readAsDataURL(f);
        results.push({ id: uid(), name: f.name, type: "pdf", dataUrl });
      } else {
        errors.push(`Tipo não suportado: "${f.name}" (detectado como "${f.type || "desconhecido"}"). Envie apenas imagens ou PDF.`);
      }
    } catch (e) {
      errors.push(`Não foi possível processar "${f.name}".`);
    }
  }
  return { results, errors };
}

function normalizeData(raw) {
  let setores = Array.isArray(raw?.setores)
    ? raw.setores.map((s, i) => ({ ...s, fixed: s.fixed ?? false, color: s.color || SECTOR_PALETTE[i % SECTOR_PALETTE.length] }))
    : [];
  const sectorIdRemap = {};
  function ensureFixedSector(fixedId, name, color) {
    if (setores.some((s) => s.id === fixedId)) return;
    const normalizedName = name.trim().toLowerCase();
    const duplicate = setores.find((s) => !s.fixed && (s.name || "").trim().toLowerCase() === normalizedName);
    if (duplicate) {
      sectorIdRemap[duplicate.id] = fixedId;
      setores = setores.map((s) => (s.id === duplicate.id ? { ...s, id: fixedId, name, fixed: true } : s));
    } else {
      setores = [{ id: fixedId, name, fixed: true, color }, ...setores];
    }
  }
  ensureFixedSector(FINANCEIRO_SECTOR_ID, "Financeiro", "#1E49E2");
  ensureFixedSector(ADMINISTRATIVO_SECTOR_ID, "Administrativo", "#0B0D14");
  ensureFixedSector(MANUTENCAO_SECTOR_ID, "Manutenção e Limpeza", "#0E7490");
  const colaboradores = Array.isArray(raw?.colaboradores)
    ? raw.colaboradores.map((c) => ({ ...c, email: c.email ?? "" }))
    : [];
  let statuses = Array.isArray(raw?.statuses) && raw.statuses.length ? raw.statuses.map((s) => ({ ...s })) : DEFAULT_STATUSES.map((s) => ({ ...s }));
  DEFAULT_STATUSES.filter((s) => s.fixed).forEach((fixedStatus) => {
    if (!statuses.some((s) => s.id === fixedStatus.id)) statuses = [...statuses, { ...fixedStatus }];
  });
  const processos = Array.isArray(raw?.processos)
    ? raw.processos.map((p) => ({
        ...p,
        sectorId: sectorIdRemap[p.sectorId] || p.sectorId || null,
        archived: p.archived ?? false,
        parentId: p.parentId ?? null,
        responsavelIds: Array.isArray(p.responsavelIds) ? p.responsavelIds : [],
        tipo: p.tipo === "demanda_rapida" ? "demanda_rapida" : "padrao",
        classification: p.classification === "especial" ? "especial" : p.classification === "pessoal" ? "pessoal" : "simples",
        assuntoId: p.assuntoId ?? null,
        deletedAt: p.deletedAt ?? null,
        concludedAt: p.concludedAt ?? null,
        pausedAt: p.pausedAt ?? null,
        aguardaDecisao: p.aguardaDecisao === "intermediaria" || p.aguardaDecisao === "final" ? p.aguardaDecisao : null,
        updatedAt: p.updatedAt || p.createdAt || new Date().toISOString(),
        checklistName: p.checklistName || "Checklist",
        checklistEnabled: p.checklistEnabled ?? (p.tipo === "demanda_rapida" || (Array.isArray(p.checklist) && p.checklist.length > 0)),
        checklist: Array.isArray(p.checklist)
          ? p.checklist.map((c) => ({
              id: c.id,
              text: c.text || "",
              done: !!c.done,
              deadline: c.deadline ?? null,
              photos: Array.isArray(c.photos) ? c.photos : [],
            }))
          : [],
        events: Array.isArray(p.events)
          ? p.events.map((e) => ({
              seq: e.seq,
              description: e.description || "",
              date: e.date,
              status: e.status ?? null,
              replyTo: e.replyTo ?? null,
              attachments: Array.isArray(e.attachments) ? e.attachments : [],
              kind: e.kind || "evento",
              decisionType: e.decisionType ?? null,
              orcamentoType: e.orcamentoType ?? null,
              flowType: e.flowType ?? null,
              globalNumero: e.globalNumero ?? null,
              itemNumero: e.itemNumero ?? null,
              aprovacao: e.aprovacao ?? null,
              fornecedor: e.fornecedor ?? null,
              valor: e.valor ?? null,
              loja: e.loja ?? null,
              preco: e.preco ?? null,
              link: e.link ?? null,
              fromSector: sectorIdRemap[e.fromSector] || e.fromSector || null,
              toSector: sectorIdRemap[e.toSector] || e.toSector || null,
              deadline: e.deadline ?? null,
              deadlineNotified: e.deadlineNotified ?? false,
              lateCompletionNotified: e.lateCompletionNotified ?? false,
              deadlineFrozen: e.deadlineFrozen ?? false,
              causedPause: e.causedPause ?? false,
              sectorAtTime: sectorIdRemap[e.sectorAtTime] || e.sectorAtTime || null,
              cumprido: e.cumprido ?? null,
              anulada: e.anulada ?? false,
              auto: e.auto ?? false,
              authorName: e.authorName ?? null,
              assignedToId: e.assignedToId ?? null,
              edited: e.edited ?? false,
              editHistory: Array.isArray(e.editHistory) ? e.editHistory : [],
              resolvedBySeq: e.resolvedBySeq ?? null,
              encaminhamentos: Array.isArray(e.encaminhamentos)
                ? e.encaminhamentos.map((it) => ({
                    id: it.id,
                    seq: it.seq,
                    text: it.text || "",
                    deadline: it.deadline ?? null,
                    done: !!it.done,
                    respostaText: it.respostaText ?? null,
                    respondidoEmSeq: it.respondidoEmSeq ?? null,
                    respostaDate: it.respostaDate ?? null,
                    deadlineNotified: it.deadlineNotified ?? false,
                  }))
                : [],
            }))
          : [],
      }))
    : [];
  const usuarios = Array.isArray(raw?.usuarios) ? raw.usuarios : [];
  const assuntos = Array.isArray(raw?.assuntos) ? raw.assuntos : [];
  const lastSeenByUser = raw?.lastSeenByUser && typeof raw.lastSeenByUser === "object" ? raw.lastSeenByUser : {};
  const accessLog = Array.isArray(raw?.accessLog) ? raw.accessLog : [];
  const emailLog = Array.isArray(raw?.emailLog) ? raw.emailLog : [];
  const clickCounts = raw?.clickCounts && typeof raw.clickCounts === "object" ? raw.clickCounts : {};
  return {
    counter: raw?.counter || 0,
    counterYear: raw?.counterYear || new Date().getFullYear(),
    orcamentoCounter: raw?.orcamentoCounter || 0,
    osCounter: raw?.osCounter || 0,
    setores,
    colaboradores,
    statuses,
    processos,
    usuarios,
    assuntos,
    lastSeenByUser,
    accessLog,
    emailLog,
    clickCounts,
  };
}

const emptyForm = {
  title: "",
  description: "",
  category: "",
  responsible: "",
  priority: "media",
  dueDate: "",
  sectorId: "",
  tipo: "padrao",
  classification: "simples",
};

function RestrictedProcessView({ processo, onBack, autorNome, onReply }) {
  const eventosOrdenados = [...processo.events].sort((a, b) => new Date(b.date) - new Date(a.date));
  const [resposta, setResposta] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState(null);

  async function handleFiles(fileList) {
    setAttaching(true);
    setAttachError(null);
    try {
      const { results, errors } = await filesToAttachments(fileList);
      if (results.length) setPendingAttachments((prev) => [...prev, ...results]);
      if (errors.length) setAttachError(errors.join(" "));
    } catch (e) {
      setAttachError(`Falha ao processar o arquivo: ${e?.message || e}`);
    } finally {
      setAttaching(false);
    }
  }

  return (
    <div style={styles.loginScreen}>
      <div style={{ ...styles.loginBox, width: "min(560px, 92vw)", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
        <div style={styles.loginTitle}>Livro de Processos</div>
        <div style={styles.attachHint}>
          Acesso restrito — você só pode acompanhar e responder neste processo específico, até que uma decisão final seja dada.
        </div>
        <div style={{ marginTop: 12, fontWeight: 700, fontFamily: "'Fraunces', serif", fontSize: 17 }}>
          {processo.number} — {processo.title}
        </div>
        <div style={styles.timeline}>
          {eventosOrdenados.map((e) => (
            <div key={e.seq} style={{ ...styles.timelineItem, marginBottom: 10 }}>
              <div style={styles.timelineMarkerCol}>
                <div style={{ ...styles.timelineBadge, background: ACCENT2, color: "#fff" }}>{plainNumber(e.seq)}</div>
              </div>
              <div style={styles.timelineContent}>
                <div style={styles.timelineDate}>
                  <Clock size={11} /> {fmtDateTime(e.date)}
                  {e.authorName ? ` · ${e.authorName}` : ""}
                </div>
                <div style={styles.timelineText}>{renderDescription(e.description, [])}</div>
                {e.attachments && e.attachments.length > 0 && (
                  <div style={styles.attachmentsRow}>
                    {e.attachments.map((a) =>
                      a.type === "image" ? (
                        <a key={a.id} href={a.dataUrl} target="_blank" rel="noreferrer" title={a.name}>
                          <img src={a.dataUrl} alt={a.name} style={styles.attachmentThumb} />
                        </a>
                      ) : (
                        <a key={a.id} href={a.dataUrl} download={a.name} style={styles.attachmentFileChip} title={a.name}>
                          <FileText size={12} /> {a.name}
                        </a>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {onReply && (
          <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${BORDER}` }}>
            {enviada && <div style={{ ...styles.attachHint, marginBottom: 8 }}>Resposta enviada!</div>}
            <textarea
              style={{ ...styles.richEditorBoxComposer, minHeight: 70 }}
              placeholder="Escreva sua resposta aqui..."
              value={resposta}
              onChange={(e) => setResposta(e.target.value)}
            />

            <label
              style={{
                marginTop: 8,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12.5,
                color: MUTED,
                border: `1px solid ${BORDER}`,
                borderRadius: 6,
                padding: "6px 10px",
                cursor: "pointer",
                fontFamily: "'Inter', sans-serif",
              }}
            >
              <Paperclip size={13} /> Anexar foto ou documento
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                style={{ display: "none" }}
                onChange={(e) => {
                  if (e.target.files && e.target.files.length) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
            {attaching && <div style={styles.attachHint}>Processando arquivo...</div>}
            {attachError && <div style={styles.attachErrorHint}>{attachError}</div>}
            {pendingAttachments.length > 0 && (
              <div style={styles.attachmentsRow}>
                {pendingAttachments.map((a) => (
                  <div key={a.id} style={styles.attachmentFileChip}>
                    {a.type === "image" ? <img src={a.dataUrl} alt={a.name} style={styles.attachmentThumb} /> : <FileText size={12} />}
                    <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    <button
                      style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}
                      onClick={() => setPendingAttachments((prev) => prev.filter((p) => p.id !== a.id))}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              style={{ ...styles.primaryBtn, width: "100%", marginTop: 8, justifyContent: "center" }}
              onClick={() => {
                if (!resposta.trim() && pendingAttachments.length === 0) return;
                onReply(processo.id, autorNome, resposta, pendingAttachments);
                setResposta("");
                setPendingAttachments([]);
                setEnviada(true);
              }}
            >
              Enviar resposta
            </button>
          </div>
        )}

        <button style={{ ...styles.secondaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }} onClick={onBack}>
          Voltar
        </button>
      </div>
    </div>
  );
}

function LoginScreen({
  onLogin,
  error,
  blockedUser,
  pendingUnlockProcess,
  onSubmitUnlockExplanation,
  onRequestPasswordRecovery,
  untrustedDeviceUser,
  pendingDeviceProcess,
  onSubmitDeviceExplanation,
  onSubmitFollowUpReply,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [explicacao, setExplicacao] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [verProcesso, setVerProcesso] = useState(false);
  const [modoRecuperacao, setModoRecuperacao] = useState(false);
  const [emailRecuperacao, setEmailRecuperacao] = useState("");
  const [resultadoRecuperacao, setResultadoRecuperacao] = useState(null);
  const [explicacaoAparelho, setExplicacaoAparelho] = useState("");
  const [enviadoAparelho, setEnviadoAparelho] = useState(false);
  const [verProcessoAparelho, setVerProcessoAparelho] = useState(false);

  if (modoRecuperacao) {
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Recuperar senha</div>
          {resultadoRecuperacao ? (
            <div style={resultadoRecuperacao.ok ? styles.blockedWarningBox : styles.attachErrorHint}>
              {resultadoRecuperacao.ok
                ? "Se esse e-mail estiver cadastrado, enviamos um link para você criar uma nova senha. Confira sua caixa de entrada (e o spam)."
                : resultadoRecuperacao.message}
            </div>
          ) : (
            <>
              <div style={{ ...styles.loginSub, textAlign: "left" }}>Digite seu e-mail cadastrado. Vamos te enviar um link para criar uma senha nova.</div>
              <input style={styles.input} placeholder="Seu e-mail" value={emailRecuperacao} onChange={(e) => setEmailRecuperacao(e.target.value)} autoFocus />
              <button
                style={{ ...styles.primaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }}
                onClick={async () => {
                  if (!emailRecuperacao.trim()) return;
                  const resultado = await onRequestPasswordRecovery(emailRecuperacao);
                  setResultadoRecuperacao(resultado);
                }}
              >
                Enviar link de recuperação
              </button>
            </>
          )}
          <button
            style={{ ...styles.secondaryBtn, width: "100%", marginTop: 10, justifyContent: "center" }}
            onClick={() => {
              setModoRecuperacao(false);
              setResultadoRecuperacao(null);
              setEmailRecuperacao("");
            }}
          >
            Voltar ao login
          </button>
        </div>
      </div>
    );
  }

  if (untrustedDeviceUser && pendingDeviceProcess && verProcessoAparelho) {
    return (
      <RestrictedProcessView
        processo={pendingDeviceProcess}
        onBack={() => setVerProcessoAparelho(false)}
        autorNome={untrustedDeviceUser.name}
        onReply={onSubmitFollowUpReply}
      />
    );
  }

  if (untrustedDeviceUser && pendingDeviceProcess) {
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Livro de Processos</div>
          <div style={styles.blockedWarningBox}>
            Foi notado que você está acessando de um aparelho diferente do cadastrado. Sua solicitação (processo{" "}
            {pendingDeviceProcess.number}) já foi enviada e está aguardando uma decisão da equipe.
          </div>
          <button
            style={{ ...styles.secondaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }}
            onClick={() => setVerProcessoAparelho(true)}
          >
            Ver processo (somente leitura)
          </button>
        </div>
      </div>
    );
  }

  if (untrustedDeviceUser) {
    if (enviadoAparelho) {
      return (
        <div style={styles.loginScreen}>
          <div style={styles.loginBox}>
            <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
            <div style={styles.loginTitle}>Livro de Processos</div>
            <div style={styles.blockedWarningBox}>
              Solicitação enviada! Um processo foi aberto, e a equipe foi avisada. Uma decisão final será dada — se aprovada, este
              aparelho passa a funcionar (e o antigo é travado).
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Livro de Processos</div>
          <div style={styles.blockedWarningBox}>
            Foi notado que o sistema está sendo acessado em um aparelho diferente do cadastrado pra você.
          </div>
          <div style={{ ...styles.loginSub, marginTop: 12, textAlign: "left" }}>
            Pra pedir a liberação deste novo aparelho, explique abaixo o motivo (trocou de celular, formatou, etc). Isso vai abrir um
            processo, a equipe será avisada, e uma decisão final será dada.
          </div>
          <textarea
            style={{ ...styles.richEditorBoxComposer, minHeight: 90, marginTop: 8 }}
            placeholder="Explique aqui o motivo..."
            value={explicacaoAparelho}
            onChange={(e) => setExplicacaoAparelho(e.target.value)}
          />
          <button
            style={{ ...styles.primaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }}
            onClick={() => {
              if (!explicacaoAparelho.trim()) return;
              onSubmitDeviceExplanation(explicacaoAparelho);
              setEnviadoAparelho(true);
            }}
          >
            Enviar solicitação
          </button>
        </div>
      </div>
    );
  }

  if (blockedUser && pendingUnlockProcess && verProcesso) {
    return (
      <RestrictedProcessView
        processo={pendingUnlockProcess}
        onBack={() => setVerProcesso(false)}
        autorNome={blockedUser.name}
        onReply={onSubmitFollowUpReply}
      />
    );
  }

  if (blockedUser && blockedUser.blockedUntil && new Date(blockedUser.blockedUntil).getTime() > Date.now()) {
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Livro de Processos</div>
          <div style={styles.blockedWarningBox}>
            Seu acesso está temporariamente banido, por decisão da equipe. O sistema libera automaticamente em{" "}
            <strong>{fmtDateTime(blockedUser.blockedUntil)}</strong> — não precisa fazer nada, você será avisado(a) por e-mail quando
            isso acontecer.
          </div>
        </div>
      </div>
    );
  }

  if (blockedUser && pendingUnlockProcess) {
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Livro de Processos</div>
          <div style={styles.blockedWarningBox}>
            Seu acesso está bloqueado. Sua solicitação de desbloqueio (processo {pendingUnlockProcess.number}) já foi enviada e está
            aguardando uma decisão da equipe. Essa decisão pode aprovar ou negar o pedido — não é automático. Assim que ela for dada,
            você será avisado(a).
          </div>
          <button style={{ ...styles.secondaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }} onClick={() => setVerProcesso(true)}>
            Ver processo (somente leitura)
          </button>
        </div>
      </div>
    );
  }

  if (blockedUser) {
    if (enviado) {
      return (
        <div style={styles.loginScreen}>
          <div style={styles.loginBox}>
            <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
            <div style={styles.loginTitle}>Livro de Processos</div>
            <div style={styles.blockedWarningBox}>
              Solicitação enviada! Um processo foi aberto explicando sua situação, e a equipe foi avisada. Alguém vai avaliar e dar uma
              decisão final, que pode aprovar ou negar o pedido — você será avisado(a) assim que isso acontecer.
            </div>
          </div>
        </div>
      );
    }
    return (
      <div style={styles.loginScreen}>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Livro de Processos</div>
          <div style={styles.blockedWarningBox}>Seu acesso está bloqueado, porque você ficou vários dias sem acessar o sistema.</div>
          <div style={{ ...styles.loginSub, marginTop: 12, textAlign: "left" }}>
            Pra pedir a liberação, explique abaixo por que você não acessou. Isso vai abrir um processo, a equipe será avisada, e uma
            decisão final será dada — ela pode aprovar ou negar o pedido.
          </div>
          <textarea
            style={{ ...styles.richEditorBoxComposer, minHeight: 90, marginTop: 8 }}
            placeholder="Explique aqui o motivo..."
            value={explicacao}
            onChange={(e) => setExplicacao(e.target.value)}
          />
          <button
            style={{ ...styles.primaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }}
            onClick={() => {
              if (!explicacao.trim()) return;
              onSubmitUnlockExplanation(explicacao);
              setEnviado(true);
            }}
          >
            Enviar solicitação
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.loginScreen}>
      <div style={styles.loginStack}>
        <div style={styles.loginGreetingCard}>
          <div style={styles.loginGreetingBig}>{saudacaoPartes().saudacao}</div>
          <div style={styles.loginGreetingDateTime}>
            {saudacaoPartes().dataExtenso}, {saudacaoPartes().horaExtenso}
          </div>
        </div>
        <div style={styles.loginBox}>
          <div style={{ ...styles.brandMark, alignSelf: "center" }}>§</div>
          <div style={styles.loginTitle}>Livro de Processos</div>
          <div style={styles.loginSub}>Entre com seu e-mail para continuar.</div>
          <input
            style={styles.input}
            placeholder="E-mail"
            type="email"
            value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLogin(username, password)}
          autoFocus
        />
        <input
          style={{ ...styles.input, marginTop: 8 }}
          placeholder="Senha"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onLogin(username, password)}
        />
        {error && <div style={styles.attachErrorHint}>{error}</div>}
        <button style={{ ...styles.primaryBtn, width: "100%", marginTop: 12, justifyContent: "center" }} onClick={() => onLogin(username, password)}>
          Entrar
        </button>
        <button
          style={{ background: "none", border: "none", color: ACCENT, fontSize: 12.5, marginTop: 10, cursor: "pointer", fontFamily: "'Inter', sans-serif" }}
          onClick={() => setModoRecuperacao(true)}
        >
          Esqueci minha senha
        </button>
        <div style={styles.loginFooterCompany}>Viergutz e Krueger Participações e Empreendimentos</div>
      </div>
      </div>
    </div>
  );
}

function saudacaoPartes() {
  const agora = new Date();
  const hora = agora.getHours();
  const saudacao = hora >= 5 && hora < 12 ? "Bom dia" : hora >= 12 && hora < 18 ? "Boa tarde" : "Boa noite";
  const dataExtenso = agora.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const horaExtenso = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return { saudacao, dataExtenso, horaExtenso };
}

function getDayPeriod(hour) {
  if (hour >= 5 && hour < 7) return "dawn";
  if (hour >= 7 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "sunset";
  if (hour >= 19 && hour < 21) return "dusk";
  return "night";
}

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

const DAY_PERIOD_SCENES = {
  night: {
    background: "radial-gradient(ellipse 90% 60% at 75% -10%, rgba(230,225,210,0.16) 0%, rgba(230,225,210,0) 55%), linear-gradient(180deg, #05070F 0%, #0A0F24 35%, #121A3A 65%, #1A2348 100%)",
  },
  dawn: {
    background: "radial-gradient(ellipse 70% 50% at 50% 100%, rgba(255,214,153,0.55) 0%, rgba(255,182,120,0.15) 45%, rgba(255,182,120,0) 70%), linear-gradient(180deg, #2B3B67 0%, #6B5A8A 35%, #C97B72 65%, #F0A868 90%, #F7CE9A 100%)",
  },
  day: {
    background: "radial-gradient(ellipse 60% 70% at 82% 15%, rgba(255,250,230,0.85) 0%, rgba(255,250,230,0.25) 30%, rgba(255,250,230,0) 55%), linear-gradient(180deg, #3E7FCB 0%, #5B9BDB 45%, #8FC2E8 75%, #C8E4F2 100%)",
  },
  sunset: {
    background: "radial-gradient(ellipse 70% 55% at 50% 100%, rgba(255,200,140,0.6) 0%, rgba(240,140,90,0.2) 45%, rgba(240,140,90,0) 70%), linear-gradient(180deg, #233C66 0%, #7A4F72 40%, #C9614E 68%, #EF9856 88%, #F7C589 100%)",
  },
  dusk: {
    background: "radial-gradient(ellipse 70% 45% at 50% 105%, rgba(190,110,110,0.35) 0%, rgba(190,110,110,0) 60%), linear-gradient(180deg, #0C0F26 0%, #241C3E 40%, #4A2C4F 70%, #7A3B4C 100%)",
  },
};

function HeroBanner({ currentUser }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const period = getDayPeriod(hour);
  const greeting = getGreeting(hour);
  const { background } = DAY_PERIOD_SCENES[period];
  const isNightLike = period === "night" || period === "dusk";

  const timeLabel = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", hour12: false });

  const stars = isNightLike
    ? Array.from({ length: 40 }, (_, i) => {
        const seed = i * 137.5;
        const left = (seed * 1.618) % 100;
        const top = (seed * 0.73) % 65;
        const size = 1 + (i % 4 === 0 ? 1.4 : 0);
        const delay = (i % 8) * 0.4;
        const duration = 2.6 + (i % 5) * 0.4;
        return { left, top, size, delay, duration, key: i };
      })
    : [];

  return (
    <div className="no-print" style={{ ...styles.heroBanner, background }}>
      {stars.map((s) => (
        <span
          key={s.key}
          style={{
            position: "absolute",
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: s.size > 1.3 ? "0 0 4px 1px rgba(255,255,255,0.6)" : "none",
            animation: `heroTwinkle ${s.duration}s ease-in-out ${s.delay}s infinite`,
          }}
        />
      ))}
      <div style={styles.heroContent}>
        <div style={styles.heroGreeting}>{greeting}</div>
        {currentUser && (
          <div style={styles.heroNameRow}>
            <span style={styles.heroName}>{currentUser.name}</span>
            <span style={styles.heroTime}>{timeLabel}</span>
          </div>
        )}
        {!currentUser && <div style={styles.heroTime}>{timeLabel}</div>}
      </div>
      <style>{`
        @keyframes heroTwinkle {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function WorkflowApp() {
  // Se chegou até aqui carregando normalmente, limpa a marcação de
  // recarregamento por chunk desatualizado — assim, se acontecer de novo
  // mais tarde (outra publicação nova enquanto a aba ainda está aberta),
  // o sistema tenta se recuperar sozinho de novo.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem("recarregouPorChunkDesatualizado");
    } catch (e) {
      // sem acesso a sessionStorage, tudo bem
    }
  }, []);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [composerVersion, setComposerVersion] = useState(0);
  const [loginChecked, setLoginChecked] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [blockedUser, setBlockedUser] = useState(null);
  const [untrustedDeviceUser, setUntrustedDeviceUser] = useState(null);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showAssuntosModal, setShowAssuntosModal] = useState(false);
  const [showQuickSearch, setShowQuickSearch] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [highlightEventSeq, setHighlightEventSeq] = useState(null);
  const [guidedStatusPrompt, setGuidedStatusPrompt] = useState(null); // { processId, seq } — item 5
  const [selectPrereqPrompt, setSelectPrereqPrompt] = useState(null); // { processId, seq } — escolher de qual andamento este depende (Execução Travada)
  const [travadoDecisionPrompt, setTravadoDecisionPrompt] = useState(null); // { processId, seq } — decidir o que fazer com andamento que estava travado e foi liberado
  const [view, setView] = useState("lista"); // lista | setores | arquivo
  const [setorViewId, setSetorViewId] = useState(null);
  const [prevContext, setPrevContext] = useState({ view: "lista", setorViewId: null });
  // Controle do botão físico/gesto de "voltar" do celular: em vez de deixar o
  // navegador sair do site, ele fecha o processo ou o setor aberto (igual ao
  // botão "Voltar" de dentro do app). historyDepthRef guarda quantos "degraus"
  // artificiais empilhamos no histórico do navegador; suppressNextPopRef evita
  // que uma mudança de tela feita PELO PRÓPRIO APP (ex: clicar em "Voltar" na
  // tela) acione essa lógica de novo e cause um loop.
  const historyDepthRef = useRef(0);
  const suppressNextPopRef = useRef(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterSector, setFilterSector] = useState("todos");
  const [filterAssunto, setFilterAssunto] = useState("todos");
  const [showNewModal, setShowNewModal] = useState(false);
  const [creatingProcess, setCreatingProcess] = useState(false);
  const [showSectorsModal, setShowSectorsModal] = useState(false);
  const [showColaboradoresModal, setShowColaboradoresModal] = useState(false);
  const [showStatusesModal, setShowStatusesModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [newEventText, setNewEventText] = useState("");
  const [newEventStatus, setNewEventStatus] = useState("andamento");
  const [newEventSetStatus, setNewEventSetStatus] = useState(false);
  const [newEventType, setNewEventType] = useState("andamento"); // andamento | intermediaria | final | orcamento_pedido | orcamento_opcao
  const [newEventFornecedor, setNewEventFornecedor] = useState("");
  const [newEventAtivoNome, setNewEventAtivoNome] = useState("");
  const [newEventPatrimonioAcao, setNewEventPatrimonioAcao] = useState("historico");
  const [newEventVotantesIds, setNewEventVotantesIds] = useState([]);
  const [newEventValor, setNewEventValor] = useState("");
  const [newOptionLoja, setNewOptionLoja] = useState("");
  const [newOptionPreco, setNewOptionPreco] = useState("");
  const [newOptionLink, setNewOptionLink] = useState("");
  const [newOrcamentoItens, setNewOrcamentoItens] = useState([{ descricao: "", valor: "" }]);
  const [markProcessConcluded, setMarkProcessConcluded] = useState(true);
  const [newEventBanDays, setNewEventBanDays] = useState("");
  const [newEventApproveDevice, setNewEventApproveDevice] = useState(false);
  const [newEventDeadline, setNewEventDeadline] = useState("");
  const [newEncaminhamentos, setNewEncaminhamentos] = useState([]);
  const [newEventAssignedTo, setNewEventAssignedTo] = useState("");
  const [newEventIsPedidoResposta, setNewEventIsPedidoResposta] = useState("sim");
  const [replyFulfillment, setReplyFulfillment] = useState("");
  const [replyPartialStatus, setReplyPartialStatus] = useState("andamento");
  const [newEventPause, setNewEventPause] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [pendingEncItem, setPendingEncItem] = useState(null);
  const [pendingAttachments, setPendingAttachments] = useState([]);
  const [attaching, setAttaching] = useState(false);
  const [attachError, setAttachError] = useState(null);
  const [newEventDriveLink, setNewEventDriveLink] = useState("");
  const [clockTick, setClockTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setClockTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const apply = () => {
      setIsMobile(mq.matches);
      setSidebarOpen(!mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Mantém o histórico do navegador em sincronia com processo/setor abertos.
  // Só entra em ação quando a pessoa abre um processo ou um setor (empilha um
  // "degrau"); se ela fechar pelo botão de dentro do app, tira esse degrau do
  // histórico também, pra não sobrar nada estranho pro botão físico depois.
  useEffect(() => {
    const desiredDepth = (setorViewId ? 1 : 0) + (selectedId ? 1 : 0);
    if (desiredDepth > historyDepthRef.current) {
      for (let i = historyDepthRef.current; i < desiredDepth; i++) {
        window.history.pushState({ processosAppDepth: i + 1 }, "");
      }
      historyDepthRef.current = desiredDepth;
    } else if (desiredDepth < historyDepthRef.current) {
      const diff = historyDepthRef.current - desiredDepth;
      suppressNextPopRef.current = true;
      window.history.go(-diff);
      historyDepthRef.current = desiredDepth;
    }
  }, [selectedId, setorViewId]);

  // Botão físico/gesto de "voltar" do celular: fecha só o nível mais interno
  // que estiver aberto (processo, depois setor). Se nada estiver aberto, não
  // faz nada especial — o navegador segue o comportamento normal dele (sair
  // do site), que é o esperado nesse caso.
  useEffect(() => {
    function onPopState() {
      if (suppressNextPopRef.current) {
        suppressNextPopRef.current = false;
        return;
      }
      if (selectedId) {
        historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
        backToBoard();
      } else if (setorViewId) {
        historyDepthRef.current = Math.max(0, historyDepthRef.current - 1);
        setSetorViewId(null);
      }
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [selectedId, setorViewId]);

  // Carregamento e gravação agora vêm do Firestore (listeners em tempo real +
  // persist() com diff por coleção), em vez do window.storage/localStorage de antes.
  // Ver firestore-data-layer.js para o detalhe da implementação.
  const { data, loading, saveError, persist, logEmailQueued, logClickQueued, clickLogQueueRef } =
    useFirestoreData(normalizeData);
  // Espelho, só leitura, dos pedidos de orçamento e suas decisões — vem da
  // coleção compartilhada com o Livro Caixa (mesmo projeto Firebase).
  const orcamentosLivroCaixa = useOrcamentosLivroCaixa();

  // Quando o Livro Caixa aprova ou recusa um orçamento pedido daqui, gera
  // sozinho um aviso (andamento automático) no processo correspondente —
  // só uma vez por decisão (marca com orcamentoDecisaoParaDocId pra não
  // duplicar o aviso se essa tela rodar de novo).
  useEffect(() => {
    if (!data || !data.processos || !orcamentosLivroCaixa.length) return;
    let processosAtualizados = data.processos;
    let mudou = false;
    orcamentosLivroCaixa.forEach((orc) => {
      if (orc.status !== "aprovado" && orc.status !== "recusado") return;
      const proc = processosAtualizados.find((p) => p.id === orc.processoId);
      if (!proc) return;
      const pedidoEvent = proc.events.find((e) => e.orcamentoDocId === orc.id);
      if (!pedidoEvent) return;
      const jaNotificado = proc.events.some((e) => e.orcamentoDecisaoParaDocId === orc.id);
      if (jaNotificado) return;
      mudou = true;
      const seq = (proc.events[proc.events.length - 1]?.seq || 0) + 1;
      const numeroTxt = orc.numero ? ` nº ${orc.numero}` : "";
      const aprovado = orc.status === "aprovado";
      const autoEvent = {
        seq,
        kind: "evento",
        description: aprovado
          ? `O orçamento${numeroTxt} foi APROVADO no Livro Caixa.`
          : `O orçamento${numeroTxt} foi RECUSADO no Livro Caixa.`,
        date: new Date().toISOString(),
        status: null,
        replyTo: pedidoEvent.seq,
        attachments: [],
        authorName: "Livro Caixa (automático)",
        sectorAtTime: proc.sectorId,
        edited: false,
        editHistory: [],
        assignedToId: null,
        causedPause: false,
        deadlineFrozen: false,
        deadlineNotified: false,
        auto: true,
        orcamentoDecisaoParaDocId: orc.id,
      };
      processosAtualizados = processosAtualizados.map((p) => (p.id === proc.id ? { ...p, events: [...p.events, autoEvent] } : p));
    });
    // Item pedido pelo usuário: quando o ativo é cadastrado de verdade no Livro
    // Caixa (a partir da fila de compras pendentes), um aviso automático volta
    // pro andamento de origem aqui — fecha o ciclo do card "Orçamentos e Compras".
    orcamentosLivroCaixa.forEach((orc) => {
      if (!orc.ativoCadastrado) return;
      const proc = processosAtualizados.find((p) => p.id === orc.processoId);
      if (!proc) return;
      const eventoOrigem = proc.events.find((e) => e.orcamentoDocId === orc.id);
      if (!eventoOrigem) return;
      const jaNotificado = proc.events.some((e) => e.ativoCadastradoParaDocId === orc.id);
      if (jaNotificado) return;
      mudou = true;
      const seq = (proc.events[proc.events.length - 1]?.seq || 0) + 1;
      const ac = orc.ativoCadastrado;
      const autoEvent = {
        seq,
        kind: "evento",
        description: `Ativo "${ac.nome || "—"}"${ac.numeroPatrimonio ? ` (nº patrimônio ${ac.numeroPatrimonio})` : ""} cadastrado com sucesso em Ativos Patrimoniais no Livro Caixa.`,
        date: new Date().toISOString(),
        status: null,
        replyTo: eventoOrigem.seq,
        attachments: [],
        authorName: "Livro Caixa (automático)",
        sectorAtTime: proc.sectorId,
        edited: false,
        editHistory: [],
        assignedToId: null,
        causedPause: false,
        deadlineFrozen: false,
        deadlineNotified: false,
        auto: true,
        ativoCadastradoParaDocId: orc.id,
      };
      processosAtualizados = processosAtualizados.map((p) => (p.id === proc.id ? { ...p, events: [...p.events, autoEvent] } : p));
    });
    if (mudou) persist({ ...data, processos: processosAtualizados });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orcamentosLivroCaixa, data, persist]);

  const [authUser, setAuthUser] = useState(undefined); // undefined = ainda checando; null = deslogado; objeto = logado

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user || null);
      setLoginChecked(true);
    });
    return () => unsub();
  }, []);

  // Assim que soubermos quem está autenticado no Firebase E os dados dos usuários já
  // tiverem carregado, decide se libera o acesso, bloqueia, ou pede aprovação de
  // aparelho novo — a mesma lógica de antes, só que a senha já foi conferida pelo
  // Firebase Authentication, não mais comparada aqui.
  useEffect(() => {
    if (authUser === undefined) return;
    if (!authUser) {
      setCurrentUserId(null);
      return;
    }
    if (!data) return;
    const usuarios = data.usuarios || [];
    const found = usuarios.find((u) => u.authUid === authUser.uid);
    if (!found) {
      setCurrentUserId(null);
      return;
    }
    if (found.blocked) {
      setCurrentUserId(null);
      setBlockedUser(found);
      return;
    }
    const deviceToken = getDeviceToken();
    const trustedDevices = found.trustedDevices || [];
    if (trustedDevices.length > 0 && !trustedDevices.some((d) => d.token === deviceToken)) {
      setCurrentUserId(null);
      setUntrustedDeviceUser(found);
      return;
    }
    if (trustedDevices.length === 0) {
      updateUsuario(found.id, { trustedDevices: [{ token: deviceToken, label: "Primeiro aparelho", addedAt: new Date().toISOString() }] });
    }
    setBlockedUser(null);
    setUntrustedDeviceUser(null);
    setCurrentUserId(found.id);
  }, [authUser, data]);

  // Detecta prazos de andamentos vencidos (enquanto o app estiver aberto) e lança
  // automaticamente um novo andamento informando o vencimento, em resposta ao original.
  // Também tenta abrir um rascunho de e-mail para os responsáveis quando o prazo vence sem cumprimento
  // (o navegador pode bloquear essa abertura automática por não vir de um clique direto).
  useEffect(() => {
    if (!data) return;
    const now = Date.now();
    let changed = false;
    const newProcessos = data.processos.map((p) => {
      if (p.pausedAt) return p; // prazos ficam congelados enquanto o processo está parado
      const expired = p.events.filter(
        (e) => e.kind === "evento" && e.deadline && !e.deadlineNotified && !e.deadlineFrozen && new Date(e.deadline).getTime() <= now
      );

      // Encaminhamentos de decisões intermediárias com prazo vencido e ainda sem resposta.
      const expiredEncaminhamentos = [];
      p.events.forEach((e) => {
        if (e.kind === "decisao" && Array.isArray(e.encaminhamentos)) {
          e.encaminhamentos.forEach((it) => {
            if (!it.done && it.deadline && !it.deadlineNotified && new Date(it.deadline).getTime() <= now) {
              expiredEncaminhamentos.push({ decisionSeq: e.seq, item: it });
            }
          });
        }
      });

      if (expired.length === 0 && expiredEncaminhamentos.length === 0) return p;
      changed = true;
      let updatedEvents = p.events.map((e) =>
        expired.some((x) => x.seq === e.seq)
          ? { ...e, deadlineNotified: true, status: e.status === "realizado" ? e.status : "nao_realizado" }
          : e
      );
      updatedEvents = updatedEvents.map((e) => {
        const hits = expiredEncaminhamentos.filter((x) => x.decisionSeq === e.seq);
        if (hits.length === 0) return e;
        return {
          ...e,
          encaminhamentos: e.encaminhamentos.map((it) =>
            hits.some((h) => h.item.id === it.id) ? { ...it, deadlineNotified: true } : it
          ),
        };
      });
      let seq = updatedEvents.length;
      const autoEvents = expired.map((e) => {
        seq += 1;
        const cumprido = e.status === "realizado";
        // O e-mail avulso de "prazo vencido" saiu daqui — esse conteúdo passou a ficar
        // dentro do resumo diário das 18h (Firebase). O registro do evento continua igual.
        return {
          seq,
          kind: "vencimento",
          cumprido,
          sectorAtTime: p.sectorId || null,
          description: cumprido
            ? `O andamento nº ${displayNumberFor(p.events, e.seq)} foi realizado dentro do prazo (${fmtDateTime(e.deadline)}).`
            : `O prazo do andamento nº ${displayNumberFor(p.events, e.seq)} venceu em ${fmtDateTime(e.deadline)} sem confirmação de que foi realizado.`,
          date: new Date().toISOString(),
          status: "aguarda",
          replyTo: e.seq,
          attachments: [],
        };
      });
      expiredEncaminhamentos.forEach(({ decisionSeq, item }) => {
        seq += 1;
        autoEvents.push({
          seq,
          kind: "vencimento",
          cumprido: false,
          sectorAtTime: p.sectorId || null,
          description: `O prazo do item ${item.seq} da decisão intermediária do andamento nº ${displayNumberFor(p.events, decisionSeq)} venceu (${fmtDateTime(
            item.deadline
          )}) sem confirmação de que foi cumprido.`,
          date: new Date().toISOString(),
          status: "aguarda",
          replyTo: decisionSeq,
          attachments: [],
        });
      });
      return { ...p, events: [...updatedEvents, ...autoEvents] };
    });
    if (changed) {
      persist({ ...data, processos: newProcessos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clockTick]);

  // Esvazia a lixeira automaticamente: processos excluídos há mais de 30 dias somem de vez.
  useEffect(() => {
    if (!data) return;
    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    const toPurge = data.processos.filter((p) => p.deletedAt && nowMs - new Date(p.deletedAt).getTime() > THIRTY_DAYS);
    if (toPurge.length > 0) {
      persist({ ...data, processos: data.processos.filter((p) => !toPurge.some((x) => x.id === p.id)) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clockTick]);

  // Arquiva automaticamente processos concluídos que ninguém arquivou dentro do prazo de graça.
  useEffect(() => {
    if (!data) return;
    const graceMs = ARCHIVE_GRACE_DAYS * 24 * 60 * 60 * 1000;
    const nowMs = Date.now();
    let changed = false;
    const newProcessos = data.processos.map((p) => {
      if (p.archived || p.deletedAt || !p.concludedAt) return p;
      if (nowMs - new Date(p.concludedAt).getTime() < graceMs) return p;
      changed = true;
      const autoEvent = {
        seq: p.events.length + 1,
        kind: "evento",
        auto: true,
        description: `Processo arquivado automaticamente ${ARCHIVE_GRACE_DAYS} dias após ser concluído, sem ninguém arquivar manualmente.`,
        date: new Date().toISOString(),
        status: null,
        replyTo: null,
        attachments: [],
        sectorAtTime: p.sectorId || null,
      };
      return { ...p, archived: true, events: [...p.events, autoEvent] };
    });
    if (changed) {
      persist({ ...data, processos: newProcessos });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clockTick]);

  // Libera automaticamente usuários cujo banimento temporário (blockedUntil) já venceu.
  useEffect(() => {
    if (!data) return;
    const nowMs = Date.now();
    let changed = false;
    const newUsuarios = (data.usuarios || []).map((u) => {
      if (!u.blocked || !u.blockedUntil) return u;
      if (nowMs < new Date(u.blockedUntil).getTime()) return u;
      changed = true;
      try {
        const emailAlvo = u.email || ((data.colaboradores || []).find((c) => c.name === u.name) || {}).email;
        if (emailAlvo) {
          const mailto = buildMailto(
            ["alvo"],
            [{ id: "alvo", email: emailAlvo }],
            `Seu acesso foi liberado — Livro de Processos`,
            `Olá, ${u.name},\n\nO prazo do seu banimento temporário terminou. Seu acesso ao Livro de Processos foi liberado automaticamente pelo sistema — você já pode entrar normalmente com seu usuário e senha.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
          );
          if (mailto) window.open(mailto, "_blank");
          logEmailQueued(`Seu acesso foi liberado — Livro de Processos`, emailAlvo);
        }
      } catch (err) {
        // silencioso
      }
      return { ...u, blocked: false, blockedUntil: null, blockedReason: null };
    });
    if (changed) {
      persist({ ...data, usuarios: newUsuarios });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, clockTick]);

  // Salva automaticamente o texto ainda não enviado, pra não perder se sair sem enviar.
  useEffect(() => {
    if (!selectedId) return;
    saveDraftToStorage(selectedId, replyingTo, newEventText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newEventText, selectedId, replyingTo]);

  // Cria um novo registro de acesso quando alguém loga (ou volta a abrir já logado).
  useEffect(() => {
    if (!currentUserId || !data) {
      setCurrentSessionId(null);
      return;
    }
    const user = (data.usuarios || []).find((u) => u.id === currentUserId);
    if (!user) return;
    const nowIso = new Date().toISOString();
    const sessionId = uid();
    setCurrentSessionId(sessionId);
    const newSession = {
      id: sessionId,
      userId: currentUserId,
      userName: user.name,
      loginAt: nowIso,
      lastActiveAt: nowIso,
      viewedProcessos: [],
    };
    persist({ ...data, accessLog: [...(data.accessLog || []), newSession] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // "Batimento" que mantém o tempo de acesso atualizado enquanto a aba estiver aberta.
  useEffect(() => {
    if (!currentSessionId || !data) return;
    const session = (data.accessLog || []).find((s) => s.id === currentSessionId);
    if (!session) return;
    const nowMs = Date.now();
    if (nowMs - new Date(session.lastActiveAt).getTime() < 60000) return; // evita gravar toda hora à toa
    const updatedLog = data.accessLog.map((s) => (s.id === currentSessionId ? { ...s, lastActiveAt: new Date(nowMs).toISOString() } : s));
    persist({ ...data, accessLog: updatedLog });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockTick, currentSessionId]);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowQuickSearch((v) => !v);
      }
      if (e.key === "Escape") {
        setShowQuickSearch(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Rastreador simples de cliques (pra saber em que parte do sistema as pessoas mais clicam).
  useEffect(() => {
    function handleClick(e) {
      const target = e.target.closest("button, a, [role='button']");
      if (!target) return;
      const textoBruto = target.getAttribute("aria-label") || target.getAttribute("title") || target.textContent || target.tagName;
      const label = textoBruto.replace(/\s+/g, " ").trim().slice(0, 40);
      if (!label) return;
      logClickQueued(`${view} · ${label}`);
    }
    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // Descarrega a fila de cliques periodicamente, mesmo que nada mais tenha mudado.
  useEffect(() => {
    if (!data || clickLogQueueRef.current.length === 0) return;
    persist(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockTick]);

  // Se já sabemos com certeza que ninguém está autenticado no Firebase, mostra a tela
  // de login direto — sem esperar os dados do Firestore, porque agora eles só carregam
  // depois de logado (as regras de segurança exigem autenticação pra liberar leitura).
  if (authUser === null) {
    return (
      <>
        <style>{fontImports}</style>
        <LoginScreen
          onLogin={attemptLogin}
          error={loginError}
          blockedUser={null}
          pendingUnlockProcess={null}
          onSubmitUnlockExplanation={submitUnlockExplanation}
          onRequestPasswordRecovery={requestPasswordRecovery}
          untrustedDeviceUser={null}
          pendingDeviceProcess={null}
          onSubmitDeviceExplanation={submitDeviceExplanation}
          onSubmitFollowUpReply={submitFollowUpReply}
        />
      </>
    );
  }

  if (authUser === undefined || loading || !data) {
    return (
      <div style={styles.loadingScreen}>
        <div style={styles.loadingStamp}>Carregando processos…</div>
      </div>
    );
  }

  const usuarios = data.usuarios || [];
  const currentUser = usuarios.find((u) => u.id === currentUserId) || null;
  const needsLogin = loginChecked && usuarios.length > 0 && !currentUser;
  // Precisa estar definido ANTES do bloco needsLogin (que retorna antes de chegar
  // na declaração original lá embaixo): as funções de solicitação de desbloqueio/
  // aparelho novo (chamadas a partir da tela de login) usam `statuses` para montar
  // o processo, e do jeito antigo travavam com "Cannot access before initialization"
  // assim que o botão era clicado, sem criar o processo e sem aviso na tela.
  const statuses = data.statuses;

  if (needsLogin) {
    const pendingUnlockProcess = blockedUser
      ? (data.processos || []).find(
          (p) => p.unlockRequestForUserId === blockedUser.id && !p.events.some((e) => e.kind === "decisao" && e.decisionType === "final")
        )
      : null;
    const pendingDeviceProcess = untrustedDeviceUser
      ? (data.processos || []).find(
          (p) => p.deviceRequestForUserId === untrustedDeviceUser.id && !p.events.some((e) => e.kind === "decisao" && e.decisionType === "final")
        )
      : null;
    return (
      <>
        <style>{fontImports}</style>
        <LoginScreen
          onLogin={attemptLogin}
          error={loginError}
          blockedUser={blockedUser}
          pendingUnlockProcess={pendingUnlockProcess}
          onSubmitUnlockExplanation={submitUnlockExplanation}
          onRequestPasswordRecovery={requestPasswordRecovery}
          untrustedDeviceUser={untrustedDeviceUser}
          pendingDeviceProcess={pendingDeviceProcess}
          onSubmitDeviceExplanation={submitDeviceExplanation}
          onSubmitFollowUpReply={submitFollowUpReply}
        />
      </>
    );
  }

  const isAdmin = currentUser && currentUser.role === "admin";
  const processos = isAdmin ? data.processos : data.processos.filter((p) => !p.unlockRequestForUserId && !p.deviceRequestForUserId);
  const setores = data.setores;
  const colaboradores = data.colaboradores;
  const selected = processos.find((p) => p.id === selectedId) || null;

  function resetComposer() {
    setNewEventText("");
    setNewEventStatus("andamento");
    setNewEventSetStatus(false);
    setNewEventType("andamento");
    setMarkProcessConcluded(true);
    setNewEventBanDays("");
    setNewEventApproveDevice(false);
    setNewEventDeadline("");
    setNewEventPause(false);
    setNewEncaminhamentos([]);
    setNewEventAssignedTo("");
    setReplyFulfillment("");
    setReplyPartialStatus("aguarda");
    setNewEventFornecedor("");
    setNewEventVotantesIds([]);
    setNewEventAtivoNome("");
    setNewEventPatrimonioAcao("historico");
    setNewEventValor("");
    setNewOptionLoja("");
    setNewOptionPreco("");
    setNewOptionLink("");
    setNewOrcamentoItens([{ descricao: "", valor: "" }]);
    setNewEventDriveLink("");
    setReplyingTo(null);
    setPendingEncItem(null);
    setPendingAttachments([]);
    setAttachError(null);
    setComposerVersion((v) => v + 1);
  }

  function getAdminEmails() {
    const admins = (data.usuarios || []).filter((u) => u.role === "admin");
    return admins
      .map((a) => a.email || (data.colaboradores.find((c) => c.name === a.name) || {}).email)
      .filter((e) => e && e.trim());
  }

  async function createUnlockRequestProcess(usuarioAlvo, explicacao) {
    const { counter: nextCounter, year: currentYear } = await allocateProcessNumber();
    const yearSuffix = String(currentYear).slice(-2);
    const proc = {
      id: uid(),
      number: `PROC-${String(nextCounter).padStart(3, "0")}/${yearSuffix}`,
      title: `Solicitação de desbloqueio — ${usuarioAlvo.name}`,
      description: "",
      category: "",
      responsible: "",
      responsavelIds: [],
      priority: "alta",
      status: statuses[0]?.id || "aberto",
      dueDate: null,
      sectorId: ADMINISTRATIVO_SECTOR_ID,
      archived: false,
      parentId: null,
      tipo: "padrao",
      classification: "especial",
      checklistEnabled: false,
      checklistName: "Checklist",
      checklist: [],
      createdAt: new Date().toISOString(),
      unlockRequestForUserId: usuarioAlvo.id,
      events: [
        {
          seq: 1,
          kind: "evento",
          description: explicacao,
          date: new Date().toISOString(),
          status: null,
          replyTo: null,
          attachments: [],
          authorName: usuarioAlvo.name,
          sectorAtTime: ADMINISTRATIVO_SECTOR_ID,
          edited: false,
          editHistory: [],
          assignedToId: null,
          causedPause: false,
          deadlineFrozen: false,
          deadlineNotified: false,
        },
      ],
    };
    const next = { ...data, processos: [proc, ...data.processos] };
    persist(next);

    // Avisa só o(s) administrador(es) na hora — exceção à regra do resumo diário, já que isso é urgente.
    try {
      const adminEmails = getAdminEmails();
      if (adminEmails.length > 0) {
        const ids = adminEmails.map((e, i) => `adm${i}`);
        const mailto = buildMailto(
          ids,
          adminEmails.map((e, i) => ({ id: `adm${i}`, email: e })),
          `Solicitação de desbloqueio — ${usuarioAlvo.name}`,
          `Olá,\n\n${usuarioAlvo.name} solicitou a liberação do acesso ao sistema, explicando o motivo de ter ficado inativo.\n\n${usuarioAlvo.blockedReason ? `Motivo do bloqueio: ${usuarioAlvo.blockedReason}\n\n` : ""}Motivo informado por ${usuarioAlvo.name}:\n${explicacao}\n\nAcesse o processo ${proc.number} para avaliar e dar uma decisão final, aprovando ou negando o pedido. Se for aprovado, use o botão "Desbloquear" na tela de Usuários para liberar o acesso.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
        );
        if (mailto) window.open(mailto, "_blank");
        logEmailQueued(`Solicitação de desbloqueio — ${usuarioAlvo.name}`, `${adminEmails.length} administrador(es)`);
      }
    } catch (e) {
      // silencioso
    }

    // Explica pra própria pessoa como funciona o trâmite a partir de agora.
    try {
      const emailAlvo = usuarioAlvo.email || (data.colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email;
      if (emailAlvo) {
        const mailtoAlvo = buildMailto(
          ["alvo"],
          [{ id: "alvo", email: emailAlvo }],
          `Sua solicitação de desbloqueio foi enviada — ${proc.number}`,
          `Olá, ${usuarioAlvo.name},\n\nSua solicitação foi registrada com sucesso, no processo ${proc.number}.\n\nComo funciona a partir de agora:\n\n1. Um processo foi aberto com a explicação que você deu, e a equipe já foi avisada por e-mail.\n2. Alguém vai avaliar sua situação e registrar andamentos ou decisões nesse processo, como em qualquer outro.\n3. Você pode acompanhar de duas formas: acessando o sistema com seu usuário e senha (você vai ver só este processo, em modo somente leitura, até a decisão final), e também por e-mail — você será avisado(a) automaticamente a cada novidade registrada nele.\n4. Uma decisão final será dada — ela pode aprovar ou negar o pedido. Se for aprovada, seu acesso é liberado e você recebe um e-mail avisando.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
        );
        if (mailtoAlvo) window.open(mailtoAlvo, "_blank");
        logEmailQueued(`Sua solicitação de desbloqueio foi enviada — ${proc.number}`, emailAlvo);
      }
    } catch (e) {
      // silencioso
    }

    return proc;
  }

  function submitFollowUpReply(processoId, autorNome, texto, attachments) {
    const proc = (data.processos || []).find((p) => p.id === processoId);
    if (!proc || (!texto.trim() && !(attachments && attachments.length))) return;
    const seq = proc.events.length + 1;
    const novoEvento = {
      seq,
      kind: "evento",
      description: texto.trim(),
      date: new Date().toISOString(),
      status: null,
      replyTo: null,
      attachments: attachments || [],
      authorName: autorNome,
      sectorAtTime: proc.sectorId || null,
      edited: false,
      editHistory: [],
      assignedToId: null,
      causedPause: false,
      deadlineFrozen: false,
      deadlineNotified: false,
    };
    const novosProcessos = data.processos.map((p) => (p.id === processoId ? { ...p, events: [...p.events, novoEvento] } : p));
    persist({ ...data, processos: novosProcessos });
  }

  async function createDeviceRequestProcess(usuarioAlvo, deviceToken, explicacao) {
    const { counter: nextCounter, year: currentYear } = await allocateProcessNumber();
    const yearSuffix = String(currentYear).slice(-2);
    const proc = {
      id: uid(),
      number: `PROC-${String(nextCounter).padStart(3, "0")}/${yearSuffix}`,
      title: `Solicitação de acesso em novo aparelho — ${usuarioAlvo.name}`,
      description: "",
      category: "",
      responsible: "",
      responsavelIds: [],
      priority: "alta",
      status: statuses[0]?.id || "aberto",
      dueDate: null,
      sectorId: ADMINISTRATIVO_SECTOR_ID,
      archived: false,
      parentId: null,
      tipo: "padrao",
      classification: "especial",
      checklistEnabled: false,
      checklistName: "Checklist",
      checklist: [],
      createdAt: new Date().toISOString(),
      deviceRequestForUserId: usuarioAlvo.id,
      deviceRequestToken: deviceToken,
      events: [
        {
          seq: 1,
          kind: "evento",
          description: explicacao,
          date: new Date().toISOString(),
          status: null,
          replyTo: null,
          attachments: [],
          authorName: usuarioAlvo.name,
          sectorAtTime: ADMINISTRATIVO_SECTOR_ID,
          edited: false,
          editHistory: [],
          assignedToId: null,
          causedPause: false,
          deadlineFrozen: false,
          deadlineNotified: false,
        },
      ],
    };
    const next = { ...data, processos: [proc, ...data.processos] };
    persist(next);

    try {
      const adminEmails = getAdminEmails();
      if (adminEmails.length > 0) {
        const ids = adminEmails.map((e, i) => `adm${i}`);
        const mailto = buildMailto(
          ids,
          adminEmails.map((e, i) => ({ id: `adm${i}`, email: e })),
          `Solicitação de acesso em novo aparelho — ${usuarioAlvo.name}`,
          `Olá,\n\n${usuarioAlvo.name} tentou acessar o sistema de um aparelho não reconhecido, e explicou o motivo.\n\nMotivo informado:\n${explicacao}\n\nAcesse o processo ${proc.number} para avaliar e dar uma decisão final, aprovando ou negando este novo aparelho. Se aprovado, o acesso no aparelho antigo é travado e liberado no novo.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
        );
        if (mailto) window.open(mailto, "_blank");
        logEmailQueued(`Solicitação de acesso em novo aparelho — ${usuarioAlvo.name}`, `${adminEmails.length} administrador(es)`);
      }
    } catch (e) {
      // silencioso
    }

    try {
      const emailAlvo = usuarioAlvo.email || (data.colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email;
      if (emailAlvo) {
        const mailtoAlvo = buildMailto(
          ["alvo"],
          [{ id: "alvo", email: emailAlvo }],
          `Sua solicitação de novo aparelho foi enviada — ${proc.number}`,
          `Olá, ${usuarioAlvo.name},\n\nSua solicitação para acessar de um novo aparelho foi registrada, no processo ${proc.number}.\n\nA equipe já foi avisada e vai avaliar. Uma decisão final será dada — ela pode aprovar ou negar o pedido. Se for aprovada, o aparelho antigo é travado e este novo passa a funcionar.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
        );
        if (mailtoAlvo) window.open(mailtoAlvo, "_blank");
        logEmailQueued(`Sua solicitação de novo aparelho foi enviada — ${proc.number}`, emailAlvo);
      }
    } catch (e) {
      // silencioso
    }

    return proc;
  }

  async function createProcess() {
    if (!form.title.trim() || creatingProcess) return;
    setCreatingProcess(true);
    try {
      const { counter: nextCounter, year: currentYear } = await allocateProcessNumber();
      const yearSuffix = String(currentYear).slice(-2);
      const proc = {
        id: uid(),
        number: `PROC-${String(nextCounter).padStart(3, "0")}/${yearSuffix}`,
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        responsible: form.responsible.trim(),
        responsavelIds: [],
        priority: form.priority,
        status: statuses[0]?.id || "aberto",
        dueDate: form.dueDate || null,
        sectorId: form.classification === "pessoal" ? null : form.sectorId || null,
        archived: false,
        parentId: null,
        tipo: form.tipo === "demanda_rapida" ? "demanda_rapida" : "padrao",
        classification: form.classification === "especial" ? "especial" : form.classification === "pessoal" ? "pessoal" : "simples",
        checklistEnabled: form.tipo === "demanda_rapida",
        checklistName: "Checklist",
        checklist: [],
        createdAt: new Date().toISOString(),
        events: [],
      };
      const next = { ...data, processos: [proc, ...data.processos] };
      persist(next);
      setForm(emptyForm);
      setShowNewModal(false);
      setSelectedId(proc.id);
      setView("lista");
      if (isMobile) setSidebarOpen(false);
    } finally {
      setCreatingProcess(false);
    }
  }

  // Ferramenta de manutenção (só admin): renumera TODOS os processos existentes
  // em sequência exata, ano a ano, na ordem em que foram criados — corrigindo
  // duplicidades que ficaram de quando o contador voltava pra 1 por engano.
  // Depois, ajusta o contador em config/appMeta pra continuar do número certo.
  function previewFixProcessNumbering() {
    const byYear = {};
    (data.processos || []).forEach((p) => {
      const m = /^PROC-(\d+)\/(\d{2})$/.exec(p.number || "");
      const yy = m ? m[2] : String(new Date(p.createdAt || Date.now()).getFullYear()).slice(-2);
      byYear[yy] = byYear[yy] || [];
      byYear[yy].push(p);
    });
    let changedCount = 0;
    const renumbered = {};
    Object.keys(byYear).forEach((yy) => {
      const group = [...byYear[yy]].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
      group.forEach((p, idx) => {
        const correctNumber = `PROC-${String(idx + 1).padStart(3, "0")}/${yy}`;
        if (p.number !== correctNumber) changedCount++;
        renumbered[p.id] = correctNumber;
      });
    });
    return { changedCount, renumbered, byYear };
  }

  function fixProcessNumbering() {
    const { changedCount, renumbered, byYear } = previewFixProcessNumbering();
    if (changedCount === 0) {
      window.alert("A numeração já está correta — nenhum processo precisou ser renumerado.");
      return;
    }
    const ok = window.confirm(
      `${changedCount} processo(s) vão ser renumerados pra ficar numa sequência exata (por ano, na ordem de criação). Os números antigos vão aparecer nos e-mails já enviados, mas o processo em si passa a usar o número novo. Continuar?`
    );
    if (!ok) return;
    const newProcessos = data.processos.map((p) => (renumbered[p.id] && renumbered[p.id] !== p.number ? { ...p, number: renumbered[p.id] } : p));
    const currentYear = new Date().getFullYear();
    const currentYearSuffix = String(currentYear).slice(-2);
    const countThisYear = (byYear[currentYearSuffix] || []).length;
    const next = { ...data, processos: newProcessos, counter: countThisYear, counterYear: currentYear };
    persist(next);
    window.alert(`Pronto — ${changedCount} processo(s) renumerados. O próximo processo criado será PROC-${String(countThisYear + 1).padStart(3, "0")}/${currentYearSuffix}.`);
  }

  function selectProcess(id, eventSeq) {
    setPrevContext({ view, setorViewId });
    setSelectedId(id);
    setHighlightEventSeq(eventSeq || null);
    resetComposer();
    const draft = loadDraft(id, null);
    if (draft) {
      setNewEventText(draft);
      setComposerVersion((v) => v + 1);
    }
    if (isMobile) setSidebarOpen(false);
    if (currentUser) {
      const nowIso = new Date().toISOString();
      const prevMap = data.lastSeenByUser || {};
      const userMap = { ...(prevMap[currentUser.id] || {}), [id]: nowIso };
      const patch = { lastSeenByUser: { ...prevMap, [currentUser.id]: userMap } };
      if (currentSessionId) {
        const proc = processos.find((p) => p.id === id);
        if (proc) {
          patch.accessLog = (data.accessLog || []).map((s) => {
            if (s.id !== currentSessionId) return s;
            const others = (s.viewedProcessos || []).filter((v) => v.id !== id);
            const newList = [...others, { id, number: proc.number, title: proc.title, viewedAt: nowIso }].slice(-50);
            return { ...s, viewedProcessos: newList, lastActiveAt: nowIso };
          });
        }
      }
      persist({ ...data, ...patch });
    }
  }

  function backToBoard() {
    setSelectedId(null);
    setView(prevContext.view);
    setSetorViewId(prevContext.setorViewId);
    resetComposer();
  }

  function updateProcessAndData(id, processPatch, dataPatch) {
    const next = {
      ...data,
      ...(dataPatch || {}),
      processos: processos.map((p) => (p.id === id ? { ...p, ...processPatch, updatedAt: processPatch.updatedAt || new Date().toISOString() } : p)),
    };
    persist(next);
  }

  function updateProcess(id, patch) {
    updateProcessAndData(id, patch, null);
  }

  function logAutoEvent(proc, description) {
    const seq = proc.events.length + 1;
    return {
      seq,
      kind: "evento",
      auto: true,
      description,
      date: new Date().toISOString(),
      status: null,
      replyTo: null,
      attachments: [],
      sectorAtTime: proc.sectorId || null,
    };
  }

  function changeProcessStatus(id, newStatusId) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    if (proc.status === newStatusId) return;
    const oldMeta = statusMeta(proc.status, statuses);
    const newMeta = statusMeta(newStatusId, statuses);
    const autoEvent = logAutoEvent(proc, `Status alterado de "${oldMeta.label}" para "${newMeta.label}".`);
    const patch = { status: newStatusId, events: [...proc.events, autoEvent] };
    if (newStatusId !== "concluido" && proc.concludedAt) patch.concludedAt = null;
    updateProcess(id, patch);
  }

  function changeProcessDueDate(id, newDate) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    if ((proc.dueDate || "") === (newDate || "")) return;
    const autoEvent = logAutoEvent(
      proc,
      newDate ? `Prazo do processo alterado para ${fmtDate(newDate)}.` : "Prazo do processo removido."
    );
    updateProcess(id, { dueDate: newDate || null, events: [...proc.events, autoEvent] });
  }

  function changeProcessClassification(id, classification) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    if (classification !== "pessoal" && proc.sectorId !== ADMINISTRATIVO_SECTOR_ID) {
      window.alert("A classificação só pode ser alterada quando o processo está no setor Administrativo.");
      return;
    }
    if (proc.classification === classification) return;
    const label = classification === "especial" ? "Especial" : classification === "pessoal" ? "Pessoal" : "Simples";
    const autoEvent = logAutoEvent(proc, `Classificação do processo alterada para "${label}".`);
    const patch = { classification, events: [...proc.events, autoEvent] };
    // Item 29: processo pessoal não tramita entre setores — some do quadro de setores.
    if (classification === "pessoal") patch.sectorId = null;
    updateProcess(id, patch);
  }

  function anularDecisao(id, seq) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    if (proc.sectorId !== ADMINISTRATIVO_SECTOR_ID && proc.classification !== "pessoal") {
      window.alert("Decisões só podem ser anuladas quando o processo está no setor Administrativo.");
      return;
    }
    const target = proc.events.find((e) => e.seq === seq);
    if (!target || target.anulada) return;
    const updatedEvents = proc.events.map((e) => (e.seq === seq ? { ...e, anulada: true } : e));

    const revertsConclusion = target.decisionType === "final" && proc.status === "concluido" && proc.concludedAt && !proc.archived;
    const revertsPause = target.causedPause && !!proc.pausedAt;
    const autoEvent = logAutoEvent(
      proc,
      `A decisão do andamento nº ${displayNumberFor(proc.events, seq)} (${target.decisionType === "final" ? "decisão final" : "decisão intermediária"}) foi anulada.` +
        (revertsConclusion ? " Como essa era a decisão final que tinha concluído o processo, ele volta a tramitar normalmente." : "") +
        (revertsPause
          ? " Como essa era a decisão que tinha parado o processo, ele volta a tramitar. Os prazos que estavam em andamento ainda precisam ser atualizados."
          : "")
    );

    const patch = { events: [...updatedEvents, autoEvent] };
    if (revertsConclusion) {
      const firstStatus = statuses.find((s) => !FIXED_FLOW_STATUS_IDS.includes(s.id) && s.id !== "concluido") || statuses[0];
      patch.status = firstStatus.id;
      patch.concludedAt = null;
    }
    if (revertsPause) {
      const firstStatus = statuses.find((s) => !FIXED_FLOW_STATUS_IDS.includes(s.id)) || statuses[0];
      patch.status = firstStatus.id;
      patch.pausedAt = null;
      // os eventos com deadlineFrozen continuam assim de propósito — precisam de novo prazo manualmente.
    }
    updateProcess(id, patch);
  }

  function aprovarRejeitarResposta(id, seq, decisao) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    if (proc.pausedAt) {
      window.alert("Este processo está parado. Só é possível dar uma nova decisão (intermediária ou final) para retomá-lo.");
      return;
    }
    const target = proc.events.find((e) => e.seq === seq);
    if (!target || target.orcamentoType !== "opcao" || target.aprovacao) return;
    const isOs = target.flowType === "os";
    const rotulo = isOs ? "Ordem de Serviço" : "Orçamento";
    const numero = target.globalNumero || "";
    const item = target.itemNumero ?? "?";
    const updatedEvents = proc.events.map((e) => (e.seq === seq ? { ...e, aprovacao: decisao } : e));
    let seqCounter = updatedEvents.length;
    const autoEvents = [];
    seqCounter += 1;
    autoEvents.push({
      seq: seqCounter,
      kind: "evento",
      auto: true,
      description:
        decisao === "aprovado"
          ? `${rotulo} ${numero} Item ${item} foi aprovado.`
          : `${rotulo} ${numero} Item ${item} foi rejeitado.`,
      date: new Date().toISOString(),
      status: null,
      replyTo: seq,
      attachments: [],
      sectorAtTime: proc.sectorId || null,
    });
    if (decisao === "aprovado") {
      seqCounter += 1;
      autoEvents.push({
        seq: seqCounter,
        kind: "evento",
        auto: true,
        description: isOs
          ? `Com aprovação da ${rotulo} ${numero} - Item ${item}, o serviço será executado.`
          : `Com aprovação do orçamento ${numero} - Item ${item}, precisa realizar a emissão do número de ordem de compra.`,
        date: new Date().toISOString(),
        status: "aguarda",
        replyTo: seq,
        attachments: [],
        sectorAtTime: proc.sectorId || null,
      });
    }
    updateProcess(id, { events: [...updatedEvents, ...autoEvents] });
  }

  function responderEncaminhamento(id, seq, itemId, respostaText) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    if (proc.pausedAt) {
      window.alert("Este processo está parado. Só é possível dar uma nova decisão (intermediária ou final) para retomá-lo.");
      return;
    }
    const target = proc.events.find((e) => e.seq === seq);
    if (!target || !Array.isArray(target.encaminhamentos)) return;
    const item = target.encaminhamentos.find((it) => it.id === itemId);
    if (!item || item.done) return;
    const updatedEvents = proc.events.map((e) =>
      e.seq === seq
        ? {
            ...e,
            encaminhamentos: e.encaminhamentos.map((it) =>
              it.id === itemId ? { ...it, done: true, respostaText: respostaText || null, respostaDate: new Date().toISOString() } : it
            ),
          }
        : e
    );
    const autoEvent = {
      seq: proc.events.length + 1,
      kind: "evento",
      auto: true,
      description: `Item ${item.seq} da decisão intermediária do andamento nº ${displayNumberFor(proc.events, seq)} foi cumprido.`,
      date: new Date().toISOString(),
      status: null,
      replyTo: seq,
      attachments: [],
      sectorAtTime: proc.sectorId || null,
    };
    updateProcess(id, { events: [...updatedEvents, autoEvent] });
  }

  function deleteProcess(id) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const next = { ...data, processos: processos.map((p) => (p.id === id ? { ...p, deletedAt: new Date().toISOString() } : p)) };
    persist(next);
    if (selectedId === id) setSelectedId(null);
  }

  function restoreProcess(id) {
    persist({ ...data, processos: processos.map((p) => (p.id === id ? { ...p, deletedAt: null } : p)) });
  }

  function permanentlyDeleteProcess(id) {
    persist({ ...data, processos: processos.filter((p) => p.id !== id) });
  }

  function transferSector(id, toSectorId) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const fromSectorId = proc.sectorId || null;
    const normalizedTo = toSectorId || null;
    if (fromSectorId === normalizedTo) return;
    const seq = proc.events.length + 1;
    const event = {
      seq,
      kind: "transferencia",
      fromSector: fromSectorId,
      toSector: normalizedTo,
      sectorAtTime: fromSectorId,
      description: `Transferido de "${sectorLabel(fromSectorId, setores)}" para "${sectorLabel(normalizedTo, setores)}"`,
      date: new Date().toISOString(),
      status: "realizado",
      replyTo: null,
      attachments: [],
    };
    updateProcess(id, { sectorId: normalizedTo, events: [...proc.events, event] });
  }

  function addEvent(id) {
    const text = newEventText;
    const textIsEmpty = !text || !text.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim();
    const isOpcaoFlowEarly = newEventType === "orcamento_opcao" || newEventType === "os_opcao";
    const hasOptionData = newOptionLoja.trim() || newOptionPreco || newOptionLink.trim();
    const isAguardaDecisao = newEventType === "aguarda_intermediaria" || newEventType === "aguarda_final";
    if (newEventType === "orcamento_lista") {
      const proc = processos.find((p) => p.id === id);
      if (!proc) return;
      if (proc.pausedAt) {
        window.alert("Este processo está parado. Só é possível dar uma nova decisão (intermediária ou final) para retomá-lo.");
        return;
      }
      // Pedido de orçamento: fluxo isolado, próprio, que grava primeiro na
      // coleção compartilhada com o Livro Caixa e só cria o andamento aqui
      // DEPOIS que essa gravação for confirmada — assim nunca fica um
      // andamento "órfão" sem o pedido correspondente do outro lado.
      // Item pedido pelo usuário: o pedido inicial é só descritivo — sem
      // lista de itens/valores (isso entra depois, na etapa de pesquisa de
      // preço). Exige só o texto explicando o que precisa.
      const textoLivre = newEventText;
      if (!textoLivre || !textoLivre.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, "").trim()) return;
      const seqLista = proc.events.length + 1;
      const replyToLista = replyingTo;
      const assignedToLista = newEventAssignedTo;
      const attachmentsLista = pendingAttachments;
      const driveLinkLista = newEventDriveLink.trim() || null;
      createOrcamentoRequest({
        processoId: id,
        processoTitulo: proc.title,
        itens: [],
        valorTotal: 0,
        solicitadoPor: currentUser ? currentUser.name : null,
        // Item pedido pelo usuário: a explicação do pedido (texto do andamento
        // e/ou link do Drive) precisa ir junto pro Livro Caixa, pra quem for
        // decidir lá entender o contexto sem precisar voltar aqui.
        descricaoPedido: htmlToPlainText(textoLivre) || null,
        driveLink: driveLinkLista,
      })
        .then((docId) => {
          const eventoLista = {
            seq: seqLista,
            kind: "orcamento",
            orcamentoType: "pedido_lista",
            itens: [],
            valorTotal: 0,
            orcamentoDocId: docId,
            driveLink: driveLinkLista,
            description: textoLivre,
            date: new Date().toISOString(),
            status: "aguarda",
            replyTo: replyToLista,
            attachments: attachmentsLista,
            deadline: null,
            deadlineNotified: false,
            sectorAtTime: proc.sectorId || null,
            authorName: currentUser ? currentUser.name : null,
            assignedToId: assignedToLista || null,
            causedPause: false,
            encaminhamentos: [],
          };
          const procAtual = data.processos.find((p) => p.id === id);
          if (!procAtual) return;
          let eventosNovos = [...procAtual.events, eventoLista];
          let sectorIdNovo = procAtual.sectorId;
          // Item pedido pelo usuário: pedido de orçamento também transfere o processo
          // pro setor Financeiro automaticamente, igual já acontecia no pedido de item único.
          const financeiroLista = setores.find((s) => s.id === FINANCEIRO_SECTOR_ID);
          if (financeiroLista && procAtual.sectorId !== financeiroLista.id) {
            const transferEventLista = {
              seq: eventosNovos.length + 1,
              kind: "transferencia",
              fromSector: procAtual.sectorId || null,
              toSector: financeiroLista.id,
              sectorAtTime: procAtual.sectorId || null,
              description: `Transferido de "${sectorLabel(procAtual.sectorId, setores)}" para "${financeiroLista.name}" para aprovação do pedido de orçamento (andamento nº ${displayNumberFor(eventosNovos, seqLista)}).`,
              date: new Date().toISOString(),
              status: "realizado",
              replyTo: seqLista,
              attachments: [],
            };
            eventosNovos = [...eventosNovos, transferEventLista];
            sectorIdNovo = financeiroLista.id;
          }
          const newProcessos = data.processos.map((p) => (p.id === id ? { ...p, events: eventosNovos, sectorId: sectorIdNovo } : p));
          persist({ ...data, processos: newProcessos });
        })
        .catch(() => {
          window.alert("Não foi possível enviar o pedido de orçamento pro Livro Caixa agora. Tenta de novo em alguns segundos.");
        });
      resetComposer();
      return;
    }
    if (textIsEmpty && !(isOpcaoFlowEarly && hasOptionData) && !isAguardaDecisao) return;
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const isDecision = newEventType === "intermediaria" || newEventType === "final";
    // Item pedido pelo usuário: toda decisão intermediária precisa vir com pelo
    // menos um encaminhamento — é a partir deles que o cumprimento da decisão
    // vai sendo medido automaticamente (% de encaminhamentos concluídos).
    if (newEventType === "intermediaria" && newEncaminhamentos.filter((it) => it.text && it.text.trim()).length === 0) {
      window.alert("Toda decisão intermediária precisa de pelo menos um encaminhamento — adicione abaixo antes de registrar.");
      return;
    }
    if (isDecision && proc.sectorId !== ADMINISTRATIVO_SECTOR_ID && proc.classification !== "pessoal") {
      window.alert("Decisões só podem ser dadas quando o processo está no setor Administrativo.");
      return;
    }
    if (proc.pausedAt && !isDecision) {
      window.alert("Este processo está parado. Só é possível dar uma nova decisão (intermediária ou final) para retomá-lo.");
      return;
    }
    const isVotacao = newEventType === "votacao";
    if (isVotacao && newEventVotantesIds.length === 0) {
      window.alert("Escolha ao menos um colaborador para votar.");
      return;
    }
    const seq = proc.events.length + 1;
    const isPedidoOrcamento = newEventType === "orcamento_pedido";
    const isOpcaoOrcamento = newEventType === "orcamento_opcao";
    const isPedidoOs = newEventType === "os_pedido";
    const isOpcaoOs = newEventType === "os_opcao";
    const isPedido = isPedidoOrcamento || isPedidoOs;
    const isOpcao = isOpcaoOrcamento || isOpcaoOs;
    const isOrcamentoFlow = isPedido || isOpcao;
    const flowType = isPedidoOrcamento || isOpcaoOrcamento ? "orcamento" : isPedidoOs || isOpcaoOs ? "os" : null;
    const aguardaTipo = newEventType === "aguarda_final" ? "final" : "intermediaria";

    // Para uma resposta (opção), acha o pedido de origem (pela resposta apontar para ele) e calcula o número do item.
    let parentPedido = null;
    let itemNumero = null;
    if (isOpcao && replyingTo) {
      parentPedido = proc.events.find((e) => e.seq === replyingTo && e.orcamentoType === "pedido");
      if (parentPedido) {
        const existingItems = proc.events.filter((e) => e.orcamentoType === "opcao" && e.replyTo === parentPedido.seq);
        itemNumero = existingItems.length + 1;
      }
    }

    const event = {
      seq,
      kind: isAguardaDecisao ? "aguarda_decisao" : isDecision ? "decisao" : isOrcamentoFlow ? "orcamento" : "evento",
      decisionType: isAguardaDecisao ? aguardaTipo : isDecision ? newEventType : null,
      orcamentoType: isPedido ? "pedido" : isOpcao ? "opcao" : null,
      flowType,
      globalNumero: null,
      itemNumero,
      aprovacao: null,
      fornecedor: isPedido ? newEventFornecedor.trim() || null : null,
      valor: isPedido && newEventValor ? newEventValor : null,
      loja: isOpcao ? newOptionLoja.trim() || null : null,
      preco: isOpcao && newOptionPreco ? newOptionPreco : null,
      link: isOpcao ? newOptionLink.trim() || null : null,
      description: isAguardaDecisao
        ? `Processo aguarda decisão ${aguardaTipo === "final" ? "final" : "intermediária"}.`
        : text,
      date: new Date().toISOString(),
      status: isDecision || isAguardaDecisao
        ? "realizado"
        : isVotacao
        ? "em_votacao"
        : isOrcamentoFlow
        ? "aguarda"
        : newEventSetStatus
        ? newEventStatus
        : newEventAssignedTo
        ? (newEventIsPedidoResposta === "nao" ? "aguarda" : "aguardando_resposta")
        : newEventDeadline
        ? "aguarda"
        : null,
      votantesIds: isVotacao ? newEventVotantesIds : null,
      votos: isVotacao ? {} : null,
      subTipoPessoal:
        newEventType === "decisao_elia" ? "elia" : newEventType === "decisao_jean" ? "jean" : newEventType === "decisao_ambos" ? "ambos" : null,
      replyTo: replyingTo,
      attachments: isAguardaDecisao ? [] : pendingAttachments,
      driveLink: isAguardaDecisao ? null : newEventDriveLink.trim() || null,
      deadline: isAguardaDecisao ? null : newEventDeadline ? new Date(newEventDeadline).toISOString() : null,
      deadlineNotified: false,
      sectorAtTime: proc.sectorId || null,
      authorName: currentUser ? currentUser.name : null,
      assignedToId: newEventAssignedTo || null,
      causedPause: isDecision && newEventType === "intermediaria" && newEventPause,
      encaminhamentos:
        newEventType === "intermediaria"
          ? newEncaminhamentos.map((it, i) => ({
              id: it.id,
              seq: i + 1,
              text: it.text,
              deadline: it.deadline || null,
              done: false,
              respostaText: null,
              respostaDate: null,
              deadlineNotified: false,
            }))
          : [],
    };

    let events = [...proc.events, event];
    let sectorId = proc.sectorId;
    let statusOverride = null;
    let aguardaDecisaoOverride;
    let dataPatch = {};

    // Pedido de orçamento é enviado automaticamente para o setor Financeiro (fixo) aprovar.
    if (isPedidoOrcamento) {
      const nextNum = (data.orcamentoCounter || 0) + 1;
      event.globalNumero = formatGlobalNumber(nextNum);
      dataPatch.orcamentoCounter = nextNum;
      const financeiro = setores.find((s) => s.id === FINANCEIRO_SECTOR_ID);
      if (financeiro && proc.sectorId !== financeiro.id) {
        const transferEvent = {
          seq: events.length + 1,
          kind: "transferencia",
          fromSector: proc.sectorId || null,
          toSector: financeiro.id,
          sectorAtTime: proc.sectorId || null,
          description: `Transferido de "${sectorLabel(proc.sectorId, setores)}" para "${financeiro.name}" para aprovação do orçamento ${event.globalNumero} (andamento nº ${displayNumberFor([...events, event], seq)}).`,
          date: new Date().toISOString(),
          status: "realizado",
          replyTo: seq,
          attachments: [],
        };
        events = [...events, transferEvent];
        sectorId = financeiro.id;
      }
      if (financeiro && sectorId === financeiro.id && statuses.some((s) => s.id === "orcamento_fazer")) {
        statusOverride = "orcamento_fazer";
      }
    }

    // Pedido de Ordem de Serviço é enviado automaticamente para o setor Manutenção e Limpeza (fixo).
    if (isPedidoOs) {
      const nextNum = (data.osCounter || 0) + 1;
      event.globalNumero = formatGlobalNumber(nextNum);
      dataPatch.osCounter = nextNum;
      const manutencao = setores.find((s) => s.id === MANUTENCAO_SECTOR_ID);
      if (manutencao && proc.sectorId !== manutencao.id) {
        const transferEvent = {
          seq: events.length + 1,
          kind: "transferencia",
          fromSector: proc.sectorId || null,
          toSector: manutencao.id,
          sectorAtTime: proc.sectorId || null,
          description: `Transferido de "${sectorLabel(proc.sectorId, setores)}" para "${manutencao.name}" para atendimento da Ordem de Serviço ${event.globalNumero} (andamento nº ${displayNumberFor([...events, event], seq)}).`,
          date: new Date().toISOString(),
          status: "realizado",
          replyTo: seq,
          attachments: [],
        };
        events = [...events, transferEvent];
        sectorId = manutencao.id;
      }
      if (manutencao && sectorId === manutencao.id && statuses.some((s) => s.id === "os_fazer")) {
        statusOverride = "os_fazer";
      }
    }

    // Preenche o número global/Item da resposta com base no pedido de origem.
    if (isOpcao && parentPedido) {
      event.globalNumero = parentPedido.globalNumero;
    }

    // "Aguarda decisão" transfere automaticamente para o Administrativo, seção "Para Proferir Decisão".
    if (isAguardaDecisao) {
      const administrativo = setores.find((s) => s.id === ADMINISTRATIVO_SECTOR_ID);
      if (administrativo && proc.sectorId !== administrativo.id) {
        const transferEvent = {
          seq: events.length + 1,
          kind: "transferencia",
          fromSector: proc.sectorId || null,
          toSector: administrativo.id,
          sectorAtTime: proc.sectorId || null,
          description: `Transferido de "${sectorLabel(proc.sectorId, setores)}" para "${administrativo.name}" — Para Proferir Decisão (andamento nº ${displayNumberFor([...events, event], seq)}).`,
          date: new Date().toISOString(),
          status: "realizado",
          replyTo: seq,
          attachments: [],
        };
        events = [...events, transferEvent];
        sectorId = administrativo.id;
      }
      if (statuses.some((s) => s.id === "para_decisao")) statusOverride = "para_decisao";
      aguardaDecisaoOverride = aguardaTipo;
    }

    // Uma decisão de verdade resolve a espera: atualiza o andamento "aguarda decisão" original e o status.
    if (isDecision) {
      aguardaDecisaoOverride = null;
      if (proc.aguardaDecisao) {
        const pendingAguarda = [...proc.events].reverse().find((e) => e.kind === "aguarda_decisao" && !e.resolvedBySeq);
        if (pendingAguarda) {
          events = events.map((e) =>
            e.seq === pendingAguarda.seq
              ? {
                  ...e,
                  resolvedBySeq: seq,
                  description: `Processo aguardava decisão ${
                    pendingAguarda.decisionType === "final" ? "final" : "intermediária"
                  } — decisão proferida no andamento nº ${displayNumberFor([...events, event], seq)}.`,
                }
              : e
          );
        }
        if (!(newEventType === "final" && markProcessConcluded)) {
          statusOverride = statuses[0]?.id || null;
        }
      }
    }

    // Se esta resposta foi feita a partir do botão "Responder" de um item de encaminhamento
    // de uma decisão intermediária, marca aquele item como cumprido e, se estiver fora do
    // prazo, lança um aviso automático em laranja.
    if (pendingEncItem && pendingEncItem.decisionSeq === replyingTo) {
      const decisionIdx = events.findIndex((e) => e.seq === pendingEncItem.decisionSeq && e.kind === "decisao");
      if (decisionIdx !== -1) {
        const decisionEvent = events[decisionIdx];
        const itemIdx = (decisionEvent.encaminhamentos || []).findIndex((it) => it.id === pendingEncItem.itemId);
        if (itemIdx !== -1 && !decisionEvent.encaminhamentos[itemIdx].done) {
          const item = decisionEvent.encaminhamentos[itemIdx];
          const updatedEncaminhamentos = decisionEvent.encaminhamentos.map((it, i) =>
            i === itemIdx ? { ...it, done: true, respondidoEmSeq: seq, respostaDate: new Date().toISOString() } : it
          );
          events = events.map((e, i) => (i === decisionIdx ? { ...e, encaminhamentos: updatedEncaminhamentos } : e));
          const isLate = item.deadline && new Date(item.deadline).getTime() < Date.now();
          events = [
            ...events,
            isLate
              ? {
                  seq: events.length + 1,
                  kind: "vencimento",
                  cumprido: "atraso",
                  sectorAtTime: proc.sectorId || null,
                  description: `O item ${item.seq} da decisão intermediária do andamento nº ${displayNumberFor(
                    [...events, event],
                    pendingEncItem.decisionSeq
                  )} foi cumprido fora do prazo (venceu em ${fmtDateTime(item.deadline)}, com ${formatDuration(
                    Date.now() - new Date(item.deadline).getTime()
                  )} de atraso).`,
                  date: new Date().toISOString(),
                  status: null,
                  replyTo: pendingEncItem.decisionSeq,
                  attachments: [],
                }
              : {
                  seq: events.length + 1,
                  kind: "evento",
                  auto: true,
                  description: `Item ${item.seq} da decisão intermediária do andamento nº ${displayNumberFor(
                    [...events, event],
                    pendingEncItem.decisionSeq
                  )} foi cumprido (respondido no andamento nº ${displayNumberFor([...events, event], seq)}).`,
                  date: new Date().toISOString(),
                  status: null,
                  replyTo: pendingEncItem.decisionSeq,
                  attachments: [],
                  sectorAtTime: proc.sectorId || null,
                },
          ];
        }
      }
    }

    // Se esta resposta é sobre um andamento com prazo (o "pai" que estamos respondendo),
    // aplica o que foi dito na pergunta de cumprimento: total (marca Realizado, com
    // detecção de atraso), parcial (aplica o status escolhido) ou nada (só uma atualização).
    if (replyFulfillment && replyingTo) {
      const parentIdx = events.findIndex((e) => e.seq === replyingTo && e.kind === "evento" && e.deadline);
      if (parentIdx !== -1) {
        const parentEv = events[parentIdx];
        if (replyFulfillment === "total") {
          const deadlineTime = new Date(parentEv.deadline).getTime();
          const isLate = !parentEv.lateCompletionNotified && Date.now() > deadlineTime;
          events = events.map((e, i) => (i === parentIdx ? { ...e, status: "realizado", lateCompletionNotified: isLate ? true : e.lateCompletionNotified } : e));
          if (isLate) {
            events = [
              ...events,
              {
                seq: events.length + 1,
                kind: "vencimento",
                cumprido: "atraso",
                sectorAtTime: proc.sectorId || null,
                description: `O andamento nº ${displayNumberFor([...events, event], parentEv.seq)} foi cumprido fora do prazo (venceu em ${fmtDateTime(
                  parentEv.deadline
                )}, com ${formatDuration(Date.now() - deadlineTime)} de atraso).`,
                date: new Date().toISOString(),
                status: null,
                replyTo: parentEv.seq,
                attachments: [],
              },
            ];
          }
        } else if (replyFulfillment === "parcial") {
          events = events.map((e, i) => (i === parentIdx ? { ...e, status: replyPartialStatus } : e));
        }
      }
    }

    // Item 2: se isso é uma resposta a um andamento que estava "Aguardando
    // Resposta", e quem está respondendo é exatamente a pessoa demandada,
    // o andamento volta a ficar sem status (a demanda foi atendida).
    if (replyingTo) {
      const paiRespondido = events.find((e) => e.seq === replyingTo);
      if (paiRespondido && paiRespondido.status === "aguardando_resposta") {
        const colaboradorDemandado = colaboradores.find((c) => c.id === paiRespondido.assignedToId);
        const respondentEhODemandado = colaboradorDemandado && currentUser && colaboradorDemandado.name === currentUser.name;
        if (respondentEhODemandado) {
          events = events.map((e) => (e.seq === replyingTo ? { ...e, status: null } : e));
        }
      }
    }

    const patch = { events };
    if (sectorId !== proc.sectorId) patch.sectorId = sectorId;
    if (statusOverride) patch.status = statusOverride;
    if (aguardaDecisaoOverride !== undefined) patch.aguardaDecisao = aguardaDecisaoOverride;

    const wasPaused = !!proc.pausedAt;

    if (isDecision && newEventType === "intermediaria" && newEventPause) {
      // Ativa a parada temporária: congela os prazos em andamento, muda o status e manda para o Administrativo.
      events = events.map((e) =>
        e.kind === "evento" && e.deadline && e.status !== "realizado" && !e.deadlineFrozen ? { ...e, deadlineFrozen: true } : e
      );
      const paradoStatus = statuses.find((s) => s.id === "parado");
      if (paradoStatus) patch.status = paradoStatus.id;
      patch.pausedAt = new Date().toISOString();
      const administrativoSector = setores.find((s) => s.id === ADMINISTRATIVO_SECTOR_ID);
      if (administrativoSector && sectorId !== administrativoSector.id) {
        events = [
          ...events,
          {
            seq: events.length + 1,
            kind: "transferencia",
            fromSector: sectorId || null,
            toSector: administrativoSector.id,
            sectorAtTime: sectorId || null,
            description: `Transferido de "${sectorLabel(sectorId, setores)}" para "${administrativoSector.name}" — Parado Temporariamente.`,
            date: new Date().toISOString(),
            status: "realizado",
            replyTo: seq,
            attachments: [],
          },
        ];
        sectorId = administrativoSector.id;
        patch.sectorId = sectorId;
      }
      events = [
        ...events,
        {
          seq: events.length + 1,
          kind: "evento",
          auto: true,
          description: `Processo parado por tempo indeterminado. Os prazos em andamento foram congelados. Para retomar, uma nova decisão intermediária ou final precisa ser dada.`,
          date: new Date().toISOString(),
          status: null,
          replyTo: null,
          attachments: [],
          sectorAtTime: sectorId || null,
        },
      ];
      patch.events = events;
    } else if (isDecision && wasPaused) {
      // Uma nova decisão enquanto o processo está parado significa retomada.
      patch.pausedAt = null;
      if (newEventType === "final") {
        events = events.map((e) => (e.deadlineFrozen ? { ...e, deadlineFrozen: false, deadline: null } : e));
      } else {
        const firstStatus = statuses.find((s) => !FIXED_FLOW_STATUS_IDS.includes(s.id)) || statuses[0];
        patch.status = firstStatus.id;
        events = [
          ...events,
          {
            seq: events.length + 1,
            kind: "evento",
            auto: true,
            description: `Processo retomado. Os prazos que estavam em andamento precisam ser atualizados — veja o quadro "Prazos para atualizar" na capa do processo.`,
            date: new Date().toISOString(),
            status: null,
            replyTo: null,
            attachments: [],
            sectorAtTime: sectorId || null,
          },
        ];
      }
      patch.events = events;
    }

    if (newEventType === "final" && markProcessConcluded) {
      const concluidoStatus = statuses.find((s) => s.id === "concluido") || statuses[statuses.length - 1];
      patch.status = concluidoStatus.id;
      patch.concludedAt = new Date().toISOString();
      const finalizadoEvent = {
        seq: events.length + 1,
        kind: "evento",
        auto: true,
        description: `Processo marcado como concluído. Se ninguém arquivar antes, ele será movido automaticamente para o Arquivo em ${ARCHIVE_GRACE_DAYS} dias.`,
        date: new Date().toISOString(),
        status: null,
        replyTo: null,
        attachments: [],
        sectorAtTime: sectorId || null,
      };
      patch.events = [...events, finalizadoEvent];
    }

    // Vínculo com Ativo Patrimonial (Livro Caixa): uma decisão (intermediária ou final)
    // pode anotar automaticamente na ficha de um ativo — histórico, sinalizar "em
    // observação" ou sugerir baixa (que fica pendente de confirmação humana lá no
    // Livro Caixa). patrimonioVinculoSeq marca de qual andamento veio, pra permitir
    // vários vínculos ao longo da vida do mesmo processo sem se confundirem.
    if (isDecision && newEventAtivoNome.trim()) {
      patch.decisaoFinal = htmlToPlainText(text);
      patch.dataDecisao = new Date().toISOString().slice(0, 10);
      patch.ativoNome = newEventAtivoNome.trim();
      patch.patrimonioAcao = newEventPatrimonioAcao;
      patch.patrimonioVinculoSeq = seq;
    }

    if (newEventType === "final" && proc.unlockRequestForUserId && newEventBanDays && Number(newEventBanDays) > 0) {
      const dias = Number(newEventBanDays);
      const liberaEm = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);
      const usuarioAlvo = (data.usuarios || []).find((u) => u.id === proc.unlockRequestForUserId);
      dataPatch = {
        ...dataPatch,
        usuarios: (data.usuarios || []).map((u) =>
          u.id === proc.unlockRequestForUserId
            ? { ...u, blocked: true, blockedUntil: liberaEm.toISOString(), blockedReason: `Banido por decisão do processo ${proc.number} até ${fmtDateTime(liberaEm.toISOString())}.` }
            : u
        ),
      };
      if (usuarioAlvo) {
        try {
          const emailAlvo = usuarioAlvo.email || (colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email;
          if (emailAlvo) {
            const mailtoBan = buildMailto(
              ["alvo"],
              [{ id: "alvo", email: emailAlvo }],
              `Decisão sobre sua solicitação — ${proc.number}`,
              `Olá, ${usuarioAlvo.name},\n\nUma decisão final foi dada na sua solicitação de desbloqueio (processo ${proc.number}).\n\nA decisão foi: seu acesso fica banido por ${dias} dias.\n\nSeu acesso será liberado automaticamente pelo sistema em ${fmtDateTime(liberaEm.toISOString())}, sem precisar fazer mais nada. Você receberá um e-mail confirmando assim que isso acontecer.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
            );
            if (mailtoBan) window.open(mailtoBan, "_blank");
            logEmailQueued(`Decisão sobre sua solicitação — ${proc.number}`, emailAlvo);
          }
        } catch (err) {
          // silencioso
        }
      }
    } else if (newEventType === "final" && proc.unlockRequestForUserId) {
      // Nenhum banimento foi digitado: aprovado, libera o acesso na hora.
      const usuarioAlvo = (data.usuarios || []).find((u) => u.id === proc.unlockRequestForUserId);
      dataPatch = {
        ...dataPatch,
        usuarios: (data.usuarios || []).map((u) =>
          u.id === proc.unlockRequestForUserId ? { ...u, blocked: false, blockedUntil: null, blockedReason: null } : u
        ),
      };
      if (usuarioAlvo) {
        try {
          const emailAlvo = usuarioAlvo.email || (colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email;
          if (emailAlvo) {
            const mailtoOk = buildMailto(
              ["alvo"],
              [{ id: "alvo", email: emailAlvo }],
              `Seu acesso foi liberado — Livro de Processos`,
              `Olá, ${usuarioAlvo.name},\n\nSua solicitação de desbloqueio (processo ${proc.number}) foi avaliada e aprovada. Seu acesso ao Livro de Processos foi liberado — você já pode entrar normalmente com seu usuário e senha.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
            );
            if (mailtoOk) window.open(mailtoOk, "_blank");
            logEmailQueued(`Seu acesso foi liberado — Livro de Processos`, emailAlvo);
          }
        } catch (err) {
          // silencioso
        }
      }
    } else if (newEventType === "final" && proc.deviceRequestForUserId) {
      const usuarioAlvo = (data.usuarios || []).find((u) => u.id === proc.deviceRequestForUserId);
      const aprovado = newEventApproveDevice;
      if (aprovado) {
        dataPatch = {
          ...dataPatch,
          usuarios: (data.usuarios || []).map((u) => {
            if (u.id !== proc.deviceRequestForUserId) return u;
            const jaExiste = (u.trustedDevices || []).some((d) => d.token === proc.deviceRequestToken);
            if (jaExiste) return u;
            return {
              ...u,
              trustedDevices: [
                ...(u.trustedDevices || []),
                { token: proc.deviceRequestToken, label: `Aparelho aprovado em ${new Date().toLocaleDateString("pt-BR")}`, addedAt: new Date().toISOString() },
              ],
            };
          }),
        };
      }
      if (usuarioAlvo) {
        try {
          const emailAlvo = usuarioAlvo.email || (colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email;
          if (emailAlvo) {
            const mailtoDev = buildMailto(
              ["alvo"],
              [{ id: "alvo", email: emailAlvo }],
              aprovado ? `Seu novo aparelho foi aprovado — Livro de Processos` : `Decisão sobre seu pedido de novo aparelho — ${proc.number}`,
              aprovado
                ? `Olá, ${usuarioAlvo.name},\n\nSeu pedido de acesso em um novo aparelho (processo ${proc.number}) foi aprovado. O aparelho anterior foi travado, e este novo já pode ser usado normalmente.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
                : `Olá, ${usuarioAlvo.name},\n\nUma decisão final foi dada no seu pedido de acesso em um novo aparelho (processo ${proc.number}): o pedido foi negado. O aparelho continua sem acesso.\n\nSe quiser tentar de novo: acesse o sistema desse mesmo aparelho, digite seu usuário e senha normalmente — a tela vai te pedir pra explicar de novo o motivo, e isso abre um novo pedido, avaliado do zero.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
            );
            if (mailtoDev) window.open(mailtoDev, "_blank");
            logEmailQueued(aprovado ? `Seu novo aparelho foi aprovado — Livro de Processos` : `Decisão sobre seu pedido de novo aparelho — ${proc.number}`, emailAlvo);
          }
        } catch (err) {
          // silencioso
        }
      }
    }

    updateProcessAndData(id, patch, dataPatch);
    clearDraft(id, replyingTo);

    // O aviso de "novo andamento" saiu daqui — esse conteúdo passou a ficar
    // dentro do resumo diário das 18h (Firebase), pra não gerar e-mail demais.

    // Se este processo é uma solicitação de desbloqueio, avisa a pessoa bloqueada na hora, a cada novidade.
    if (proc.unlockRequestForUserId) {
      try {
        const usuarioAlvo = (data.usuarios || []).find((u) => u.id === proc.unlockRequestForUserId);
        const emailAlvo = usuarioAlvo && (usuarioAlvo.email || (colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email);
        if (usuarioAlvo && emailAlvo) {
          const plainText = htmlToPlainText(event.description);
          const linha = "―――――――――――――――――――――――――";
          const autor = event.authorName || "Alguém";
          const mailto = buildMailto(
            ["alvo"],
            [{ id: "alvo", email: emailAlvo }],
            `Novidade na sua solicitação de desbloqueio — ${proc.number}`,
            `Olá, ${usuarioAlvo.name},\n\nHouve uma novidade na sua solicitação de desbloqueio.\n\n${linha}\nProcesso: ${proc.number}\nAndamento nº: ${plainNumber(
              seq
            )}\nPor: ${autor}\nData: ${fmtDateTime(event.date)}\n${linha}\n\n${plainText}\n\nAcesse o sistema com seu usuário e senha pra acompanhar (você ainda vai ver só este processo, até a decisão final).\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
          );
          if (mailto) window.open(mailto, "_blank");
          logEmailQueued(`Novidade na sua solicitação de desbloqueio — ${proc.number}`, emailAlvo);
        }
      } catch (err) {
        // silencioso
      }
    }

    // Mesma coisa, mas pra solicitação de novo aparelho — se alguém pedir mais informações
    // (um andamento comum, sem ser decisão final ainda), avisa a pessoa na hora.
    if (proc.deviceRequestForUserId && newEventType === "pedir_informacoes") {
      try {
        const usuarioAlvo = (data.usuarios || []).find((u) => u.id === proc.deviceRequestForUserId);
        const emailAlvo = usuarioAlvo && (usuarioAlvo.email || (colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email);
        if (usuarioAlvo && emailAlvo) {
          const plainText = htmlToPlainText(event.description);
          const linha = "―――――――――――――――――――――――――";
          const autor = event.authorName || "Alguém";
          const mailto = buildMailto(
            ["alvo"],
            [{ id: "alvo", email: emailAlvo }],
            `Pediram mais informações — sua solicitação de novo aparelho (${proc.number})`,
            `Olá, ${usuarioAlvo.name},\n\nA equipe pediu mais informações na sua solicitação de novo aparelho.\n\n${linha}\nProcesso: ${proc.number}\nAndamento nº: ${plainNumber(
              seq
            )}\nPor: ${autor}\nData: ${fmtDateTime(event.date)}\n${linha}\n\n${plainText}\n\nPara responder: acesse o sistema, digite seu usuário e senha normalmente, e toque em "Ver processo (somente leitura)" — lá tem um campo pra você escrever a resposta direto.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
          );
          if (mailto) window.open(mailto, "_blank");
          logEmailQueued(`Pediram mais informações — sua solicitação de novo aparelho (${proc.number})`, emailAlvo);
        }
      } catch (err) {
        // silencioso
      }
    }

    resetComposer();

    // Item 5: se isso foi uma resposta a um andamento que estava com status
    // "Aguarda Execução", abre uma telinha guiada perguntando se já está
    // concluído, ainda em andamento, ou não vai ser realizado.
    if (replyingTo) {
      const paiOriginalAguarda = proc.events.find((e) => e.seq === replyingTo);
      if (paiOriginalAguarda && paiOriginalAguarda.status === "aguarda") {
        setGuidedStatusPrompt({ processId: id, seq: replyingTo });
      }
    }

    // Item 2 (lote 2): se este novo andamento foi criado já com status
    // "Execução Travada", abre a telinha pra escolher de qual outro andamento ele depende.
    if (newEventType === "andamento" && newEventSetStatus && newEventStatus === "execucao_travada") {
      setSelectPrereqPrompt({ processId: id, seq });
    }
  }

  function updateEventStatus(id, seq, status) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const target = proc.events.find((e) => e.seq === seq);
    let extraEvent = null;
    let markLateNotified = false;
    if (target && status === "realizado" && target.deadline && !target.lateCompletionNotified) {
      const deadlineTime = new Date(target.deadline).getTime();
      if (Date.now() > deadlineTime) {
        markLateNotified = true;
        extraEvent = {
          seq: proc.events.length + 1,
          kind: "vencimento",
          cumprido: "atraso",
          sectorAtTime: proc.sectorId || null,
          description: `O andamento nº ${displayNumberFor(proc.events, target.seq)} foi cumprido fora do prazo (venceu em ${fmtDateTime(target.deadline)}, com ${formatDuration(
            Date.now() - deadlineTime
          )} de atraso).`,
          date: new Date().toISOString(),
          status: null,
          replyTo: target.seq,
          attachments: [],
        };
      }
    }
    const updatedEvents = proc.events.map((e) =>
      e.seq === seq ? { ...e, status, lateCompletionNotified: markLateNotified ? true : e.lateCompletionNotified } : e
    );
    updateProcess(id, { events: extraEvent ? [...updatedEvents, extraEvent] : updatedEvents });
    if (status === "realizado") checkUnlockTravados(id, seq);
  }

  // Item 2 (lote 2): quando um andamento é marcado como "Realizado", verifica se
  // existe algum andamento "Execução Travada" que dependia dele; se houver, abre a
  // telinha de decisão perguntando se aquele andamento travado ainda vai ser executado.
  // Item 2 (lote 3): registra o voto de um colaborador num andamento de votação/aprovação
  // e recalcula o resultado (maioria simples dos votantes designados) — aprovado fica
  // verde, rejeitado fica vermelho, enquanto não há maioria continua "Em Votação".
  function registerVote(id, seq, colaboradorId, voto) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const target = proc.events.find((e) => e.seq === seq);
    if (!target || !target.votantesIds) return;
    const novosVotos = { ...(target.votos || {}), [colaboradorId]: voto };
    const total = target.votantesIds.length;
    const maioria = Math.floor(total / 2) + 1;
    const aprovacoes = Object.values(novosVotos).filter((v) => v === "aprovar").length;
    const rejeicoes = Object.values(novosVotos).filter((v) => v === "rejeitar").length;
    let novoStatus = "em_votacao";
    if (aprovacoes >= maioria) novoStatus = "aprovado";
    else if (rejeicoes >= maioria) novoStatus = "rejeitado";
    updateProcess(id, {
      events: proc.events.map((e) => (e.seq === seq ? { ...e, votos: novosVotos, status: novoStatus } : e)),
    });
  }

  // Etapa 3 do fluxo de orçamento (segunda aprovação): as pesquisas de preço
  // coletadas viram um SEGUNDO pedido no Livro Caixa, reaproveitando o mesmo
  // mecanismo já testado do pedido inicial (mesma coleção "orcamentos", mesmo
  // hook ao vivo useOrcamentosLivroCaixa, mesmo aviso automático de decisão).
  function enviarPesquisasParaAprovacao(id, seq) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const pedidoEvent = proc.events.find((e) => e.seq === seq);
    if (!pedidoEvent || !(pedidoEvent.pesquisas || []).length) return;
    const itensPesquisa = pedidoEvent.pesquisas.map((pq) => ({
      descricao: `${pq.loja ? pq.loja + " — " : ""}${pq.descricao || pq.link}`,
      valor: pq.valor || 0,
      link: pq.link,
    }));
    const valorTotalPesquisa = itensPesquisa.reduce((sum, it) => sum + it.valor, 0);
    // O número do orçamento é único e não pode mudar entre as etapas — pega o
    // número já atribuído ao pedido original (etapa 1) e manda junto, pra o
    // Livro Caixa reaproveitar em vez de gerar um número novo pra essa etapa.
    const orcInfoPedido = (orcamentosLivroCaixa || []).find((o) => o.id === pedidoEvent.orcamentoDocId);
    const numeroOriginal = orcInfoPedido ? orcInfoPedido.numero : null;
    createOrcamentoRequest({
      processoId: id,
      processoTitulo: `${proc.title} — Pesquisas de preço (orçamento nº ${numeroOriginal || displayNumberFor(proc.events, seq)})`,
      itens: itensPesquisa,
      valorTotal: valorTotalPesquisa,
      solicitadoPor: currentUser ? currentUser.name : null,
      numeroVinculado: numeroOriginal,
    })
      .then((docId) => {
        const procAtual = data.processos.find((p) => p.id === id);
        if (!procAtual) return;
        const seqResposta = procAtual.events.length + 1;
        const eventoResposta = {
          seq: seqResposta,
          kind: "orcamento",
          orcamentoType: "pesquisa_resposta",
          itens: itensPesquisa,
          valorTotal: valorTotalPesquisa,
          orcamentoDocId: docId,
          description: `Pesquisas de preço enviadas para aprovação do Financeiro, referentes ao pedido nº ${displayNumberFor(procAtual.events, seq)}.`,
          date: new Date().toISOString(),
          status: "aguarda",
          replyTo: seq,
          attachments: [],
          deadline: null,
          deadlineNotified: false,
          sectorAtTime: procAtual.sectorId || null,
          authorName: currentUser ? currentUser.name : null,
          assignedToId: null,
          causedPause: false,
          encaminhamentos: [],
        };
        const updatedEvents = procAtual.events.map((e) => (e.seq === seq ? { ...e, pesquisasEnviadas: true } : e));
        const newProcessos = data.processos.map((p) =>
          p.id === id ? { ...p, events: [...updatedEvents, eventoResposta] } : p
        );
        persist({ ...data, processos: newProcessos });
      })
      .catch(() => {
        window.alert("Não foi possível enviar as pesquisas pro Livro Caixa agora. Tenta de novo em alguns segundos.");
      });
  }

  // Etapas 4 e 5: registrar a compra feita grava campos no próprio documento do
  // processo (mesmo padrão já usado pro vínculo com Ativos Patrimoniais) — o
  // Livro Caixa lê isso na sincronização e cria a Conta a Pagar sozinho, e se
  // marcado como objeto físico, também entra numa fila de pendentes de cadastro
  // em Ativos Patrimoniais (revisão humana lá, pra completar vida útil etc.).
  function registrarCompra(id, seq, dadosCompra) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const eventoOrigem = proc.events.find((e) => e.seq === seq);
    const updatedEvents = proc.events.map((e) => (e.seq === seq ? { ...e, compraRegistradaSeq: seq, compraEhAtivo: dadosCompra.ehAtivo } : e));
    updateProcess(id, {
      events: updatedEvents,
      compraRegistrada: {
        seq,
        descricao: dadosCompra.descricao,
        fornecedor: dadosCompra.fornecedor,
        valor: dadosCompra.valor,
        notaFiscal: dadosCompra.notaFiscal,
        ehAtivo: dadosCompra.ehAtivo,
        data: new Date().toISOString().slice(0, 10),
        // Guarda o doc do orçamento (Livro Caixa) dessa etapa, pra quando o ativo
        // for cadastrado lá, o aviso conseguir voltar pro andamento certo aqui.
        orcamentoDocId: eventoOrigem ? eventoOrigem.orcamentoDocId : null,
      },
    });
  }

  function checkUnlockTravados(id, seq) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const travado = proc.events.find((e) => e.status === "execucao_travada" && e.blockedBySeq === seq);
    if (travado) setTravadoDecisionPrompt({ processId: id, seq: travado.seq });
  }

  function updateEventDescription(id, seq, description) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, {
      events: proc.events.map((e) => (e.seq === seq ? { ...e, description, edited: true } : e)),
    });
  }

  function updateEventFields(id, seq, patch) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, {
      events: proc.events.map((e) => {
        if (e.seq !== seq) return e;
        const descriptionChanged = "description" in patch && patch.description !== e.description;
        const editHistory = descriptionChanged
          ? [...(e.editHistory || []), { description: e.description, editedAt: new Date().toISOString() }]
          : e.editHistory || [];
        // Se essa edição está demandando o andamento a alguém novo (não tinha
        // ninguém demandado, ou mudou de pessoa), aplica o mesmo status
        // automático "Aguardando Resposta" que uma demanda nova recebe.
        const ficouDemandadoAgora = "assignedToId" in patch && patch.assignedToId && patch.assignedToId !== e.assignedToId;
        const statusPatch = ficouDemandadoAgora && !("status" in patch) ? { status: "aguardando_resposta" } : {};
        return { ...e, ...patch, ...statusPatch, edited: true, editHistory };
      }),
    });
    if (patch.status === "realizado") checkUnlockTravados(id, seq);
  }

  function updateFrozenDeadline(id, seq, newDeadlineIso) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const target = proc.events.find((e) => e.seq === seq);
    if (!target) return;
    const updatedEvents = proc.events.map((e) => (e.seq === seq ? { ...e, deadline: newDeadlineIso, deadlineFrozen: false, deadlineNotified: false } : e));
    const autoEvent = logAutoEvent(
      { ...proc, events: updatedEvents },
      `O prazo do andamento nº ${displayNumberFor(updatedEvents, seq)} foi atualizado após a retomada do processo, para ${fmtDateTime(newDeadlineIso)}.`
    );
    updateProcess(id, { events: [...updatedEvents, autoEvent] });
  }

  function deleteEvent(id, seq) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const events = proc.events.filter((e) => e.seq !== seq).map((e) => (e.replyTo === seq ? { ...e, replyTo: null } : e));
    updateProcess(id, { events });
  }

  function concluirProcesso(id) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const concluidoStatus = statuses.find((s) => s.id === "concluido") || statuses[statuses.length - 1];
    const autoEvent = logAutoEvent(
      proc,
      `Processo marcado como concluído. Se ninguém arquivar antes, ele será movido automaticamente para o Arquivo em ${ARCHIVE_GRACE_DAYS} dias.`
    );
    updateProcess(id, { status: concluidoStatus.id, concludedAt: new Date().toISOString(), events: [...proc.events, autoEvent] });
  }

  function setArchived(id, archived) {
    updateProcess(id, { archived });
  }

  function setParent(id, parentId) {
    updateProcess(id, { parentId: parentId || null });
  }

  function addChecklistItem(id, text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    const item = { id: uid(), text: trimmed, done: false, deadline: null };
    updateProcess(id, { checklist: [...proc.checklist, item] });
  }
  function toggleChecklistItem(id, itemId) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, { checklist: proc.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c)) });
  }
  function setChecklistDeadline(id, itemId, deadlineIso) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, { checklist: proc.checklist.map((c) => (c.id === itemId ? { ...c, deadline: deadlineIso } : c)) });
  }
  function deleteChecklistItem(id, itemId) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, { checklist: proc.checklist.filter((c) => c.id !== itemId) });
  }
  function enableChecklist(id) {
    updateProcess(id, { checklistEnabled: true });
  }
  function renameChecklist(id, name) {
    updateProcess(id, { checklistName: name });
  }
  function addChecklistPhoto(id, itemId, photo) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, {
      checklist: proc.checklist.map((c) => (c.id === itemId ? { ...c, photos: [...(c.photos || []), photo] } : c)),
    });
  }
  function removeChecklistPhoto(id, itemId, photoId) {
    const proc = processos.find((p) => p.id === id);
    if (!proc) return;
    updateProcess(id, {
      checklist: proc.checklist.map((c) => (c.id === itemId ? { ...c, photos: (c.photos || []).filter((ph) => ph.id !== photoId) } : c)),
    });
  }

  async function handleAttachFiles(fileList) {
    setAttaching(true);
    setAttachError(null);
    try {
      const { results, errors } = await filesToAttachments(fileList);
      if (results.length) setPendingAttachments((prev) => [...prev, ...results]);
      if (errors.length) setAttachError(errors.join(" "));
    } catch (e) {
      setAttachError(`Falha inesperada ao processar o arquivo: ${e?.message || e}`);
    } finally {
      setAttaching(false);
    }
  }

  function addSector(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const newSector = { id: uid(), name: trimmed };
    persist({ ...data, setores: [...setores, newSector] });
  }
  function renameSector(id, name) {
    const sector = setores.find((s) => s.id === id);
    if (sector?.fixed) return;
    persist({ ...data, setores: setores.map((s) => (s.id === id ? { ...s, name } : s)) });
  }
  function deleteSector(id) {
    const sector = setores.find((s) => s.id === id);
    if (sector?.fixed) {
      window.alert("Este setor é fixo e não pode ser removido.");
      return;
    }
    const next = {
      ...data,
      setores: setores.filter((s) => s.id !== id),
      processos: processos.map((p) => (p.sectorId === id ? { ...p, sectorId: null } : p)),
    };
    persist(next);
    if (filterSector === id) setFilterSector("todos");
  }
  function setSectorColor(id, color) {
    persist({ ...data, setores: setores.map((s) => (s.id === id ? { ...s, color } : s)) });
  }

  function addColaborador(name, cargo, email) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const novo = { id: uid(), name: trimmed, cargo: (cargo || "").trim(), email: (email || "").trim() };
    persist({ ...data, colaboradores: [...colaboradores, novo] });
  }
  function updateColaborador(id, patch) {
    persist({ ...data, colaboradores: colaboradores.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }
  function deleteColaborador(id) {
    persist({ ...data, colaboradores: colaboradores.filter((c) => c.id !== id) });
  }

  async function attemptLogin(email, password) {
    setLoginError("");
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Se der certo, o useEffect que observa o estado de login (authUser + data.usuarios)
      // cuida do resto: checar bloqueio, aparelho de confiança, e liberar o acesso.
    } catch (e) {
      const codigo = e && e.code;
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(codigo)) {
        setLoginError("E-mail ou senha incorretos.");
      } else if (codigo === "auth/too-many-requests") {
        setLoginError("Muitas tentativas erradas seguidas. Espere alguns minutos e tente de novo.");
      } else if (codigo === "auth/user-disabled") {
        setLoginError("Este usuário foi desativado.");
      } else if (codigo === "auth/invalid-email") {
        setLoginError("Digite um e-mail válido.");
      } else {
        setLoginError("Não foi possível entrar. Verifique sua internet e tente de novo.");
      }
      setBlockedUser(null);
    }
  }

  function submitDeviceExplanation(explicacao) {
    if (!untrustedDeviceUser || !explicacao.trim()) return;
    createDeviceRequestProcess(untrustedDeviceUser, getDeviceToken(), explicacao.trim());
  }

  async function requestPasswordRecovery(email) {
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (e) {
      // Por segurança, não revelamos se o e-mail existe ou não no sistema — a mensagem
      // de sucesso é sempre a mesma, mesmo se o e-mail nem estiver cadastrado.
      if (e && e.code === "auth/invalid-email") {
        return { ok: false, message: "Digite um e-mail válido." };
      }
    }
    return { ok: true };
  }

  function submitUnlockExplanation(explicacao) {
    if (!blockedUser || !explicacao.trim()) return;
    createUnlockRequestProcess(blockedUser, explicacao.trim());
  }

  function logout() {
    signOut(auth);
  }

  // Cria o usuário no Firebase Authentication (login de verdade) sem derrubar a sessão
  // do administrador que está cadastrando — usamos um "app" temporário e secundário do
  // Firebase só pra essa criação, e descartamos ele logo em seguida.
  function gerarSenhaTemporaria() {
    // Senha temporária curta e fácil de digitar (o admin vê e passa pra
    // pessoa por WhatsApp ou outro meio; ela pode trocar depois de entrar).
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem O/0/I/1 pra evitar confusão
    let out = "";
    for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
    return out;
  }

  async function addUsuario(name, email) {
    const emailLimpo = email.trim().toLowerCase();
    const senhaTemporaria = gerarSenhaTemporaria();
    const nomeAppTemporario = `criacao-usuario-${Date.now()}`;
    const appTemporario = initializeApp(firebaseConfig, nomeAppTemporario);
    const authTemporario = getAuth(appTemporario);
    let credCriada = null;
    try {
      const cred = await createUserWithEmailAndPassword(authTemporario, emailLimpo, senhaTemporaria);
      credCriada = cred;
      const novo = { id: uid(), name: name.trim(), email: emailLimpo, authUid: cred.user.uid };
      // Grava o registro de forma GARANTIDA (espera confirmação de verdade do
      // Firestore) antes de considerar sucesso — se isso falhar, desfaz a
      // conta de login criada acima, pra nunca ficar uma "meia-conta" presa
      // (login existindo sem o sistema reconhecer a pessoa).
      await setUsuarioDoc(novo);
      // O e-mail de redefinição às vezes é bloqueado silenciosamente pelo
      // Gmail (domínio padrão do Firebase) — tenta mandar como um extra, mas
      // NÃO deixa isso derrubar o cadastro: a senha temporária abaixo é o
      // caminho garantido.
      try {
        await sendPasswordResetEmail(auth, emailLimpo);
      } catch (e2) {
        // silencioso — a senha temporária mostrada ao admin já resolve
      }
      return { ok: true, senhaTemporaria };
    } catch (e) {
      if (e && e.code === "auth/email-already-in-use") {
        return { ok: false, message: "Já existe uma conta com esse e-mail." };
      }
      if (credCriada) {
        try {
          await deleteUser(credCriada.user);
        } catch (e2) {
          // se nem isso der certo, ao menos não passamos a falsa impressão de sucesso
        }
      }
      return { ok: false, message: "Não foi possível criar o usuário. Confira o e-mail digitado e tente de novo." };
    } finally {
      await deleteApp(appTemporario);
    }
  }
  function updateUsuario(id, patch) {
    const usuarios = data.usuarios || [];
    persist({ ...data, usuarios: usuarios.map((u) => (u.id === id ? { ...u, ...patch } : u)) });
  }

  function unblockUsuario(id) {
    const usuarios = data.usuarios || [];
    const usuarioAlvo = usuarios.find((u) => u.id === id);
    persist({ ...data, usuarios: usuarios.map((u) => (u.id === id ? { ...u, blocked: false, blockedAt: null, blockedReason: null } : u)) });

    if (usuarioAlvo) {
      try {
        const emailAlvo = usuarioAlvo.email || (data.colaboradores.find((c) => c.name === usuarioAlvo.name) || {}).email;
        if (emailAlvo) {
          const mailto = buildMailto(
            ["alvo"],
            [{ id: "alvo", email: emailAlvo }],
            `Seu acesso foi liberado — Livro de Processos`,
            `Olá, ${usuarioAlvo.name},\n\nBoa notícia: seu acesso ao Livro de Processos foi liberado. Você já pode entrar normalmente com seu usuário e senha.\n\nEste e-mail foi enviado automaticamente pelo § Livro de Processos. Não responda esta mensagem — ela não é monitorada.\n\n§ Livro de Processos\nViergutz e Krueger Participações e Empreendimentos`
          );
          if (mailto) window.open(mailto, "_blank");
          logEmailQueued(`Seu acesso foi liberado — Livro de Processos`, emailAlvo);
        }
      } catch (e) {
        // silencioso
      }
    }
  }

  function deleteUsuario(id) {
    const usuarios = data.usuarios || [];
    persist({ ...data, usuarios: usuarios.filter((u) => u.id !== id) });
    if (currentUserId === id) logout();
  }

  function addAssunto(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const assuntos = data.assuntos || [];
    persist({ ...data, assuntos: [...assuntos, { id: uid(), name: trimmed }] });
  }
  function renameAssunto(id, name) {
    const assuntos = data.assuntos || [];
    persist({ ...data, assuntos: assuntos.map((a) => (a.id === id ? { ...a, name } : a)) });
  }
  function deleteAssunto(id) {
    const assuntos = data.assuntos || [];
    persist({
      ...data,
      assuntos: assuntos.filter((a) => a.id !== id),
      processos: processos.map((p) => (p.assuntoId === id ? { ...p, assuntoId: null } : p)),
    });
    if (filterAssunto === id) setFilterAssunto("todos");
  }
  function setProcessoAssunto(id, assuntoId) {
    updateProcess(id, { assuntoId: assuntoId || null });
  }

  function addStatus(label) {
    const trimmed = label.trim();
    if (!trimmed) return;
    const novo = { id: uid(), label: trimmed, color: COLOR_PRESETS[statuses.length % COLOR_PRESETS.length] };
    persist({ ...data, statuses: [...statuses, novo] });
  }
  function updateStatus(id, patch) {
    const st = statuses.find((s) => s.id === id);
    if (st?.fixed && patch.label !== undefined) return;
    persist({ ...data, statuses: statuses.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  }
  function deleteStatus(id) {
    const st = statuses.find((s) => s.id === id);
    if (st?.fixed) {
      window.alert("Este status é fixo (usado pelo fluxo de orçamento/decisão) e não pode ser removido.");
      return;
    }
    if (statuses.length <= 1) {
      window.alert("É preciso manter ao menos um status.");
      return;
    }
    const fallback = statuses.find((s) => s.id !== id);
    const next = {
      ...data,
      statuses: statuses.filter((s) => s.id !== id),
      processos: processos.map((p) => (p.status === id ? { ...p, status: fallback.id } : p)),
    };
    persist(next);
    if (filterStatus === id) setFilterStatus("todos");
  }

  const sortedByRecent = [...processos].filter((p) => !p.deletedAt).sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  const visibleProcessos = sortedByRecent.filter((p) => !p.archived && p.classification !== "pessoal");
  const pessoaisProcessos = sortedByRecent.filter((p) => !p.archived && p.classification === "pessoal");
  const pendingAttentionCount = visibleProcessos.filter((p) => {
    const flags = getListHighlightFlags(p, Date.now());
    return flags.isOverdue || flags.isPaused || flags.isStale;
  }).length;
  const archivedProcessos = sortedByRecent.filter((p) => p.archived);
  const aguardandoProcessos = visibleProcessos.filter((p) => (p.events || []).length === 0);
  const aguardandoCount = aguardandoProcessos.length;

  // Item 6 (lote 6): alerta luminoso pra Elia Krueger — pisca pra todo mundo
  // enquanto ela mesma não abrir a tela e ler o que foi demandado pra ela.
  const eliaColaboradora = colaboradores.find((c) => c.name && c.name.toLowerCase().includes("elia"));
  const eliaUsuario = eliaColaboradora ? usuarios.find((u) => u.name === eliaColaboradora.name) : null;
  const eliaAlertaCount = eliaColaboradora
    ? visibleProcessos.reduce((total, p) => {
        return (
          total +
          p.events.filter((e) => {
            if (e.kind !== "evento" || e.assignedToId !== eliaColaboradora.id) return false;
            if (e.status === "realizado" || e.status === "nao_sera_realizado" || e.status === "nao_realizado") return false;
            if (!eliaUsuario) return true;
            const seenMap = data.lastSeenByUser && data.lastSeenByUser[eliaUsuario.id];
            const lastSeen = seenMap ? seenMap[p.id] : null;
            if (!lastSeen) return true;
            return new Date(e.date).getTime() > new Date(lastSeen).getTime();
          }).length
        );
      }, 0)
    : 0;
  const trashedProcessos = processos
    .filter((p) => p.deletedAt)
    .sort((a, b) => new Date(b.deletedAt) - new Date(a.deletedAt));

  const filtered = visibleProcessos.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.title.toLowerCase().includes(q) ||
      p.number.toLowerCase().includes(q) ||
      (p.responsible || "").toLowerCase().includes(q) ||
      p.events.some((e) => (e.description || "").replace(/<[^>]*>/g, " ").toLowerCase().includes(q));
    const matchesStatus = filterStatus === "todos" || p.status === filterStatus;
    const matchesSector =
      filterSector === "todos" || (filterSector === NONE_SECTOR ? !p.sectorId : p.sectorId === filterSector);
    const matchesAssunto =
      filterAssunto === "todos" || (filterAssunto === NONE_SECTOR ? !p.assuntoId : p.assuntoId === filterAssunto);
    return matchesSearch && matchesStatus && matchesSector && matchesAssunto;
  });

  return (
    <div style={styles.app}>
      <style>{fontImports + printStyles + layoutFixStyles}</style>

      {isMobile && sidebarOpen && <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />}

      {!isMobile && sidebarCollapsed && (
        <button className="no-print" style={styles.expandSidebarBtn} onClick={() => setSidebarCollapsed(false)} title="Mostrar barra lateral">
          <ChevronRight size={16} />
        </button>
      )}

      <aside
        className="no-print"
        style={{
          ...styles.sidebar,
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: 45,
                transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
                transition: "transform 0.22s ease",
                boxShadow: sidebarOpen ? "0 0 24px rgba(0,0,0,0.25)" : "none",
                width: "82vw",
                maxWidth: 320,
              }
            : sidebarCollapsed
            ? { width: 0, minWidth: 0, padding: 0, border: "none", overflow: "hidden" }
            : {}),
        }}
      >
        <div style={styles.sidebarHeader}>
          <div style={styles.brandRow}>
            <div style={styles.brandMark}>§</div>
            <div>
              <div style={styles.brandTitle}>Livro de Processos</div>
              <div style={styles.brandSub}>{visibleProcessos.length} ativos</div>
            </div>
            {isMobile ? (
              <button style={{ ...styles.iconBtn, marginLeft: "auto" }} onClick={() => setSidebarOpen(false)}>
                <X size={16} />
              </button>
            ) : (
              <button style={{ ...styles.iconBtn, marginLeft: "auto" }} onClick={() => setSidebarCollapsed(true)} title="Minimizar barra lateral">
                <ChevronLeft size={16} />
              </button>
            )}
          </div>
          <button style={styles.newBtn} onClick={() => setShowNewModal(true)}>
            <Plus size={15} strokeWidth={2.5} />
            Novo processo
          </button>
          <button style={styles.quickSearchTriggerBtn} onClick={() => setShowQuickSearch(true)}>
            <Search size={14} />
            Busca rápida <span style={styles.quickSearchKbd}>Ctrl+K</span>
          </button>
        </div>

        <div style={styles.searchBox}>
          <Search size={14} color={MUTED} />
          <input
            style={styles.searchInput}
            placeholder="Buscar por número, título, responsável ou texto nos andamentos"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div style={styles.sidebarLinksCol}>
          <button
            style={{ ...(view === "atividade" ? styles.sidebarLinkActive : styles.sidebarLink), fontSize: 14 }}
            onClick={() => {
              setView("atividade");
              setSelectedId(null);
            }}
          >
            <Activity size={15} /> Atividade recente
          </button>
          <button
            style={{ ...(view === "aguardando" ? styles.sidebarLinkActive : styles.sidebarLink), fontSize: 14 }}
            onClick={() => {
              setView("aguardando");
              setSelectedId(null);
            }}
          >
            <Clock size={15} /> Aguardando {aguardandoCount > 0 ? `(${aguardandoCount})` : ""}
          </button>
        </div>

        <div style={styles.sectorFilterHeader}>
          <span style={styles.sectorFilterLabel}>Status</span>
          <button style={styles.manageSectorsBtn} onClick={() => setShowStatusesModal(true)}>
            <Settings2 size={12} /> Gerenciar
          </button>
        </div>
        <div style={styles.filterRow}>
          <button style={filterStatus === "todos" ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterStatus("todos")}>
            Todos
          </button>
          {statuses.map((s) => (
            <button key={s.id} style={filterStatus === s.id ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterStatus(s.id)}>
              <span style={{ ...styles.dot, background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>

        <div style={styles.sectorFilterHeader}>
          <span style={styles.sectorFilterLabel}>Setores</span>
          <button style={styles.manageSectorsBtn} onClick={() => setShowSectorsModal(true)}>
            <Settings2 size={12} /> Gerenciar
          </button>
        </div>
        <div style={styles.filterRow}>
          <button style={filterSector === "todos" ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterSector("todos")}>
            Todos
          </button>
          <button style={filterSector === NONE_SECTOR ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterSector(NONE_SECTOR)}>
            Sem setor
          </button>
          {setores.map((s, i) => (
            <button key={s.id} style={filterSector === s.id ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterSector(s.id)}>
              <span style={{ ...styles.dot, background: s.color || sectorColor(i) }} />
              {s.name}
            </button>
          ))}
        </div>

        <div style={styles.sectorFilterHeader}>
          <span style={styles.sectorFilterLabel}>Assuntos</span>
          <button style={styles.manageSectorsBtn} onClick={() => setShowAssuntosModal(true)}>
            <Settings2 size={12} /> Gerenciar
          </button>
        </div>
        <div style={styles.filterRow}>
          <button style={filterAssunto === "todos" ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterAssunto("todos")}>
            Todos
          </button>
          <button style={filterAssunto === NONE_SECTOR ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterAssunto(NONE_SECTOR)}>
            Sem assunto
          </button>
          {(data.assuntos || []).map((a) => (
            <button key={a.id} style={filterAssunto === a.id ? styles.filterChipActive : styles.filterChip} onClick={() => setFilterAssunto(a.id)}>
              {a.name}
            </button>
          ))}
        </div>

        <div style={styles.sectorFilterHeader}>
          <span style={styles.sectorFilterLabel}>Colaboradores</span>
          <button style={styles.manageSectorsBtn} onClick={() => setShowColaboradoresModal(true)}>
            <Users size={12} /> Gerenciar
          </button>
        </div>

        <div style={styles.sectorFilterHeader}>
          <span style={styles.sectorFilterLabel}>Usuários</span>
          <button style={styles.manageSectorsBtn} onClick={() => setShowUsersModal(true)}>
            <AtSign size={12} /> Gerenciar
          </button>
        </div>
        {currentUser && (
          <div style={styles.currentUserRow}>
            <span style={styles.brandSub}>Logado como {currentUser.name}</span>
            <button style={styles.logoutBtn} onClick={logout}>
              Sair
            </button>
          </div>
        )}

        <div style={styles.sectorFilterHeader}>
          <span style={styles.sectorFilterLabel}>Mais</span>
        </div>
        <div style={styles.sidebarLinksCol}>
          <button
            style={view === "pessoais" ? styles.sidebarLinkActive : styles.sidebarLink}
            onClick={() => {
              setView("pessoais");
              setSelectedId(null);
            }}
          >
            <User size={13} /> Processos Pessoais {pessoaisProcessos.length > 0 ? `(${pessoaisProcessos.length})` : ""}
          </button>
          <button
            style={view === "arquivo" ? styles.sidebarLinkActive : styles.sidebarLink}
            onClick={() => {
              setView("arquivo");
              setSelectedId(null);
            }}
          >
            <Archive size={13} /> Arquivo {archivedProcessos.length > 0 ? `(${archivedProcessos.length})` : ""}
          </button>
          <button
            style={view === "acessos" ? styles.sidebarLinkActive : styles.sidebarLink}
            onClick={() => {
              setView("acessos");
              setSelectedId(null);
            }}
          >
            <LogIn size={13} /> Acessos
          </button>
          {currentUser && currentUser.role === "admin" && (
            <button
              style={view === "admin" ? styles.sidebarLinkActive : styles.sidebarLink}
              onClick={() => {
                setView("admin");
                setSelectedId(null);
              }}
            >
              <ShieldCheck size={13} /> Administrador
            </button>
          )}
          {currentUser && currentUser.role === "admin" && (
            <button
              style={view === "configuracoes" ? styles.sidebarLinkActive : styles.sidebarLink}
              onClick={() => {
                setView("configuracoes");
                setSelectedId(null);
              }}
            >
              <Settings size={13} /> Configurações
            </button>
          )}
          <button
            style={view === "lixeira" ? styles.sidebarLinkActive : styles.sidebarLink}
            onClick={() => {
              setView("lixeira");
              setSelectedId(null);
            }}
          >
            <Trash2 size={13} /> Lixeira {trashedProcessos.length > 0 ? `(${trashedProcessos.length})` : ""}
          </button>
        </div>

        <div style={styles.backupRow}>
          <BackupExportLink data={data} />
          <BulkExportLink processos={visibleProcessos} statuses={statuses} setores={setores} label={`Exportar processos (${visibleProcessos.length})`} />
        </div>
      </aside>

      <main style={styles.main}>
      <ErrorBoundary>
        {!selected && !setorViewId && <HeroBanner currentUser={currentUser} />}
        {!selected && (
        <div className="no-print" style={styles.topBar}>
          {isMobile && (
            <button style={styles.menuBtn} onClick={() => setSidebarOpen(true)}>
              <Menu size={18} />
            </button>
          )}
          {isMobile && (
            <button style={styles.topBarSearchBtn} onClick={() => setShowQuickSearch(true)}>
              <Search size={15} />
              Buscar processo…
            </button>
          )}
          <div style={styles.viewToggle}>
            <button
              style={view === "demandas" ? styles.toggleBtnActive : styles.toggleBtn}
              className={eliaAlertaCount > 0 ? "urgent-blink-row" : ""}
              onClick={() => {
                setView("demandas");
                setSelectedId(null);
              }}
            >
              <Users size={14} /> Elia Krueger {eliaAlertaCount > 0 ? `(${eliaAlertaCount})` : ""}
            </button>
            <button
              style={view === "setores" ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => {
                setView("setores");
                setSetorViewId(null);
                setSelectedId(null);
              }}
            >
              <Folder size={14} /> Setores
            </button>
            <button style={view === "lista" ? styles.toggleBtnActive : styles.toggleBtn} onClick={() => setView("lista")}>
              <ListIcon size={14} /> Processos
              {pendingAttentionCount > 0 && <span style={styles.pendingBadge}>{pendingAttentionCount}</span>}
            </button>
          </div>
          {saveError && (
            <div style={styles.saveError}>
              <AlertCircle size={13} />
              <span>
                Não foi possível salvar{saveError.sizeKB ? ` (dados: ${saveError.sizeKB}KB)` : ""}: {saveError.message || "erro desconhecido"}. Tentando de novo automaticamente…
              </span>
              <button
                style={styles.retrySaveBtn}
                onClick={() => pendingSaveRef.current && writeToStorage(pendingSaveRef.current)}
              >
                Tentar agora
              </button>
            </div>
          )}
        </div>
        )}

        {selected ? (
          <ProcessDetail
            processo={selected}
            processos={processos}
            setores={setores}
            statuses={statuses}
            colaboradores={colaboradores}
            currentUser={currentUser}
            onBack={backToBoard}
            onUpdate={(patch) => updateProcess(selected.id, patch)}
            onChangeStatus={(status) => changeProcessStatus(selected.id, status)}
            onChangeDueDate={(date) => changeProcessDueDate(selected.id, date)}
            onChangeClassification={(c) => changeProcessClassification(selected.id, c)}
            assuntos={data.assuntos || []}
            onSetAssunto={(assuntoId) => setProcessoAssunto(selected.id, assuntoId)}
            onAnularDecisao={(seq) => anularDecisao(selected.id, seq)}
            onAprovarRejeitar={(seq, decisao) => aprovarRejeitarResposta(selected.id, seq, decisao)}
            onResponderEncaminhamento={(seq, itemId, resposta) => responderEncaminhamento(selected.id, seq, itemId, resposta)}
            pendingEncItem={pendingEncItem}
            setPendingEncItem={setPendingEncItem}
            onDelete={() => deleteProcess(selected.id)}
            onTransferSector={(toId) => transferSector(selected.id, toId)}
            onUpdateEventStatus={(seq, status) => updateEventStatus(selected.id, seq, status)}
            onUpdateEventDescription={(seq, description) => updateEventDescription(selected.id, seq, description)}
            onUpdateEventFields={(seq, patch) => updateEventFields(selected.id, seq, patch)}
            onRequestPrereqPicker={(seq) => setSelectPrereqPrompt({ processId: selected.id, seq })}
            onRegisterVote={(seq, colaboradorId, voto) => registerVote(selected.id, seq, colaboradorId, voto)}
            onEnviarPesquisasParaAprovacao={(seq) => enviarPesquisasParaAprovacao(selected.id, seq)}
            onRegistrarCompra={(seq, dados) => registrarCompra(selected.id, seq, dados)}
            onUpdateFrozenDeadline={(seq, newDeadlineIso) => updateFrozenDeadline(selected.id, seq, newDeadlineIso)}
            onDeleteEvent={(seq) => deleteEvent(selected.id, seq)}
            onConcluir={() => concluirProcesso(selected.id)}
            onSetArchived={(archived) => setArchived(selected.id, archived)}
            onSetParent={(parentId) => setParent(selected.id, parentId)}
            onAddChecklistItem={(text) => addChecklistItem(selected.id, text)}
            onToggleChecklistItem={(itemId) => toggleChecklistItem(selected.id, itemId)}
            onSetChecklistDeadline={(itemId, deadline) => setChecklistDeadline(selected.id, itemId, deadline)}
            onDeleteChecklistItem={(itemId) => deleteChecklistItem(selected.id, itemId)}
            onRenameChecklist={(name) => renameChecklist(selected.id, name)}
            onEnableChecklist={() => enableChecklist(selected.id)}
            composerVersion={composerVersion}
            setComposerVersion={setComposerVersion}
            onAddChecklistPhoto={(itemId, photo) => addChecklistPhoto(selected.id, itemId, photo)}
            onRemoveChecklistPhoto={(itemId, photoId) => removeChecklistPhoto(selected.id, itemId, photoId)}
            onSelectProcess={selectProcess}
            newEventText={newEventText}
            setNewEventText={setNewEventText}
            newEventStatus={newEventStatus}
            setNewEventStatus={setNewEventStatus}
            newEventSetStatus={newEventSetStatus}
            setNewEventSetStatus={setNewEventSetStatus}
            newEventType={newEventType}
            setNewEventType={setNewEventType}
            markProcessConcluded={markProcessConcluded}
            setMarkProcessConcluded={setMarkProcessConcluded}
            newEventBanDays={newEventBanDays}
            setNewEventBanDays={setNewEventBanDays}
            newEventApproveDevice={newEventApproveDevice}
            setNewEventApproveDevice={setNewEventApproveDevice}
            newEventDeadline={newEventDeadline}
            setNewEventDeadline={setNewEventDeadline}
            newEventPause={newEventPause}
            setNewEventPause={setNewEventPause}
            newEncaminhamentos={newEncaminhamentos}
            setNewEncaminhamentos={setNewEncaminhamentos}
            newEventAssignedTo={newEventAssignedTo}
            setNewEventAssignedTo={setNewEventAssignedTo}
            newEventIsPedidoResposta={newEventIsPedidoResposta}
            setNewEventIsPedidoResposta={setNewEventIsPedidoResposta}
            replyFulfillment={replyFulfillment}
            setReplyFulfillment={setReplyFulfillment}
            replyPartialStatus={replyPartialStatus}
            setReplyPartialStatus={setReplyPartialStatus}
            newEventFornecedor={newEventFornecedor}
            setNewEventFornecedor={setNewEventFornecedor}
            newEventAtivoNome={newEventAtivoNome}
            setNewEventAtivoNome={setNewEventAtivoNome}
            newEventPatrimonioAcao={newEventPatrimonioAcao}
            setNewEventPatrimonioAcao={setNewEventPatrimonioAcao}
            newEventVotantesIds={newEventVotantesIds}
            setNewEventVotantesIds={setNewEventVotantesIds}
            newEventValor={newEventValor}
            setNewEventValor={setNewEventValor}
            newOptionLoja={newOptionLoja}
            setNewOptionLoja={setNewOptionLoja}
            newOptionPreco={newOptionPreco}
            setNewOptionPreco={setNewOptionPreco}
            newOptionLink={newOptionLink}
            setNewOptionLink={setNewOptionLink}
            newOrcamentoItens={newOrcamentoItens}
            setNewOrcamentoItens={setNewOrcamentoItens}
            orcamentosLivroCaixa={orcamentosLivroCaixa}
            replyingTo={replyingTo}
            setReplyingTo={setReplyingTo}
            pendingAttachments={pendingAttachments}
            setPendingAttachments={setPendingAttachments}
            attaching={attaching}
            attachError={attachError}
            onAttachFiles={handleAttachFiles}
            newEventDriveLink={newEventDriveLink}
            setNewEventDriveLink={setNewEventDriveLink}
            onAddEvent={() => addEvent(selected.id)}
            clockTick={clockTick}
            highlightEventSeq={highlightEventSeq}
          />
        ) : view === "lista" ? (
          <ListView
            processos={filtered}
            setores={setores}
            statuses={statuses}
            onSelect={selectProcess}
            onUpdateStatus={(id, status) => changeProcessStatus(id, status)}
            currentUser={currentUser}
            lastSeenByUser={data.lastSeenByUser}
          />
        ) : view === "pessoais" ? (
          <ListView
            processos={pessoaisProcessos}
            setores={setores}
            statuses={statuses}
            onSelect={selectProcess}
            onUpdateStatus={(id, status) => changeProcessStatus(id, status)}
            currentUser={currentUser}
            lastSeenByUser={data.lastSeenByUser}
          />
        ) : view === "arquivo" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <ArchiveView processos={archivedProcessos} setores={setores} statuses={statuses} onSelect={selectProcess} onUnarchive={(id) => setArchived(id, false)} />
          </Suspense>
        ) : view === "aguardando" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <AguardandoView processos={aguardandoProcessos} setores={setores} onSelect={selectProcess} />
          </Suspense>
        ) : view === "demandas" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <DemandasView
              processos={processos}
              colaboradores={colaboradores}
              usuarios={usuarios}
              lastSeenByUser={data.lastSeenByUser}
              onSelect={selectProcess}
            />
          </Suspense>
        ) : view === "lixeira" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <TrashView processos={trashedProcessos} onRestore={restoreProcess} onDeleteForever={permanentlyDeleteProcess} />
          </Suspense>
        ) : view === "atividade" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <AtividadeView processos={processos} onSelect={selectProcess} />
          </Suspense>
        ) : view === "acessos" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <AcessosView accessLog={data.accessLog || []} onSelect={selectProcess} />
          </Suspense>
        ) : view === "admin" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <AdminView
              processos={processos}
              usuarios={usuarios}
              colaboradores={colaboradores}
              onSelect={selectProcess}
              emailLog={data.emailLog || []}
              clickCounts={data.clickCounts || {}}
              onFixNumbering={fixProcessNumbering}
            />
          </Suspense>
        ) : view === "configuracoes" ? (
          <Suspense fallback={<LazyViewFallback />}>
            <ConfiguracoesView
              processos={processos}
              setores={setores}
              usuarios={usuarios}
              colaboradores={colaboradores}
              emailLog={data.emailLog || []}
              accessLog={data.accessLog || []}
              firebaseConfig={firebaseConfig}
              currentUserEmail={currentUser?.email}
            />
          </Suspense>
        ) : setorViewId ? (
          <SectorBoard
            setor={setores.find((s) => s.id === setorViewId)}
            setorIndex={sectorIndex(setorViewId, setores)}
            processos={visibleProcessos.filter((p) => p.sectorId === setorViewId && (p.events || []).length > 0)}
            statuses={statuses}
            onSelect={selectProcess}
            onBack={() => setSetorViewId(null)}
            onManageStatuses={() => setShowStatusesModal(true)}
            onToggleDone={(id, status) => {
              const concluidoStatus = statuses.find((s) => s.id === "concluido") || statuses[statuses.length - 1];
              changeProcessStatus(id, status === concluidoStatus.id ? statuses[0].id : concluidoStatus.id);
            }}
            onChangeStatus={(id, newStatusId) => changeProcessStatus(id, newStatusId)}
          />
        ) : (
          <SetoresHome
            setores={setores}
            processos={visibleProcessos}
            onOpenSector={(id) => setSetorViewId(id)}
            onAddSector={addSector}
            onManage={() => setShowSectorsModal(true)}
          />
        )}
      </ErrorBoundary>
      </main>

      {showNewModal && (
        <NewProcessModal
          form={form}
          setForm={setForm}
          setores={setores}
          colaboradores={colaboradores}
          onCancel={() => {
            setShowNewModal(false);
            setForm(emptyForm);
          }}
          onCreate={createProcess}
          creating={creatingProcess}
          nextNumber={`PROC-${String(data.counterYear !== new Date().getFullYear() ? 1 : data.counter + 1).padStart(3, "0")}/${String(
            new Date().getFullYear()
          ).slice(-2)}`}
        />
      )}

      {showSectorsModal && (
        <SectorsModal setores={setores} onClose={() => setShowSectorsModal(false)} onAdd={addSector} onRename={renameSector} onDelete={deleteSector} onSetColor={setSectorColor} />
      )}

      {showColaboradoresModal && (
        <ColaboradoresModal
          colaboradores={colaboradores}
          onClose={() => setShowColaboradoresModal(false)}
          onAdd={addColaborador}
          onUpdate={updateColaborador}
          onDelete={deleteColaborador}
        />
      )}

      {showStatusesModal && (
        <StatusesModal
          statuses={setorViewId ? statusesForSectorBoard(setorViewId, statuses) : statuses}
          allStatuses={statuses}
          sectorName={setorViewId ? (setores.find((s) => s.id === setorViewId) || {}).name : null}
          onClose={() => setShowStatusesModal(false)}
          onAdd={addStatus}
          onUpdate={updateStatus}
          onDelete={deleteStatus}
        />
      )}

      {guidedStatusPrompt && (
        <div style={styles.modalOverlay} onClick={() => setGuidedStatusPrompt(null)}>
          <div style={{ ...styles.modal, maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <div>
                <div style={styles.modalStampLabel}>Andamento respondido</div>
                <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 18.5 }}>Como fica o status agora?</div>
              </div>
              <button style={styles.iconBtn} onClick={() => setGuidedStatusPrompt(null)}>
                <X size={16} />
              </button>
            </div>
            <div style={{ ...styles.attachHint, marginBottom: 14 }}>Esta demanda já está concluída, ainda falta algo, ou não vai ser feita?</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                style={{ ...styles.addEventBtn, justifyContent: "center" }}
                onClick={() => {
                  updateEventFields(guidedStatusPrompt.processId, guidedStatusPrompt.seq, { status: "realizado" });
                  setGuidedStatusPrompt(null);
                }}
              >
                ✓ Já está concluído
              </button>
              <button
                style={{ ...styles.secondaryBtn, justifyContent: "center" }}
                onClick={() => {
                  updateEventFields(guidedStatusPrompt.processId, guidedStatusPrompt.seq, { status: "andamento" });
                  setGuidedStatusPrompt(null);
                }}
              >
                Ainda falta algo (Em andamento)
              </button>
              <button
                style={{ ...styles.secondaryBtn, justifyContent: "center", color: DANGER }}
                onClick={() => {
                  updateEventFields(guidedStatusPrompt.processId, guidedStatusPrompt.seq, { status: "nao_sera_realizado" });
                  setGuidedStatusPrompt(null);
                }}
              >
                Foi cancelado (Não será realizado)
              </button>
            </div>
          </div>
        </div>
      )}

      {selectPrereqPrompt && (() => {
        const proc = processos.find((p) => p.id === selectPrereqPrompt.processId);
        const opcoes = proc
          ? proc.events.filter((e) => e.kind === "evento" && !e.auto && e.seq !== selectPrereqPrompt.seq)
          : [];
        return (
          <div style={styles.modalOverlay} onClick={() => setSelectPrereqPrompt(null)}>
            <div style={{ ...styles.modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.modalStampLabel}>Execução Travada</div>
                  <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 18.5 }}>
                    De qual andamento este depende?
                  </div>
                </div>
                <button style={styles.iconBtn} onClick={() => setSelectPrereqPrompt(null)}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ ...styles.attachHint, marginBottom: 14 }}>
                Escolha qual andamento precisa ser realizado primeiro para que este possa continuar.
              </div>
              {opcoes.length === 0 ? (
                <div style={styles.attachHint}>Não há outros andamentos neste processo ainda.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
                  {opcoes.map((o) => (
                    <button
                      key={o.seq}
                      style={{ ...styles.secondaryBtn, justifyContent: "flex-start", textAlign: "left" }}
                      onClick={() => {
                        updateEventFields(selectPrereqPrompt.processId, selectPrereqPrompt.seq, {
                          status: "execucao_travada",
                          blockedBySeq: o.seq,
                        });
                        setSelectPrereqPrompt(null);
                      }}
                    >
                      Nº {plainNumber(o.seq)} — {htmlToPlainText(o.description).slice(0, 70)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {travadoDecisionPrompt && (() => {
        const proc = processos.find((p) => p.id === travadoDecisionPrompt.processId);
        const ev = proc ? proc.events.find((e) => e.seq === travadoDecisionPrompt.seq) : null;
        const prereq = proc && ev ? proc.events.find((e) => e.seq === ev.blockedBySeq) : null;
        return (
          <div style={styles.modalOverlay} onClick={() => setTravadoDecisionPrompt(null)}>
            <div style={{ ...styles.modal, maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.modalStampLabel}>Andamento liberado</div>
                  <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 18.5 }}>
                    O andamento nº {plainNumber(travadoDecisionPrompt.seq)} ainda vai ser executado?
                  </div>
                </div>
                <button style={styles.iconBtn} onClick={() => setTravadoDecisionPrompt(null)}>
                  <X size={16} />
                </button>
              </div>
              <div style={{ ...styles.attachHint, marginBottom: 14 }}>
                {prereq ? `O andamento nº ${plainNumber(prereq.seq)}, do qual ele dependia, foi realizado.` : "O andamento do qual ele dependia foi realizado."}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button
                  style={{ ...styles.addEventBtn, justifyContent: "center" }}
                  onClick={() => {
                    updateEventFields(travadoDecisionPrompt.processId, travadoDecisionPrompt.seq, {
                      status: "aguarda",
                      blockedBySeq: null,
                    });
                    setTravadoDecisionPrompt(null);
                  }}
                >
                  Sim, ainda vai ser executado
                </button>
                <button
                  style={{ ...styles.secondaryBtn, justifyContent: "center", color: DANGER }}
                  onClick={() => {
                    updateEventFields(travadoDecisionPrompt.processId, travadoDecisionPrompt.seq, {
                      status: "nao_sera_realizado",
                      blockedBySeq: null,
                    });
                    setTravadoDecisionPrompt(null);
                  }}
                >
                  Não será realizado
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {showUsersModal && (
        <UsersModal
          usuarios={usuarios}
          onClose={() => setShowUsersModal(false)}
          onAdd={addUsuario}
          onUpdate={updateUsuario}
          onDelete={deleteUsuario}
          onUnblock={unblockUsuario}
          onSendReset={requestPasswordRecovery}
        />
      )}

      {showAssuntosModal && (
        <AssuntosModal
          assuntos={data.assuntos || []}
          onClose={() => setShowAssuntosModal(false)}
          onAdd={addAssunto}
          onRename={renameAssunto}
          onDelete={deleteAssunto}
        />
      )}

      {showQuickSearch && (
        <QuickSearchModal
          processos={processos}
          query={quickSearchQuery}
          onQueryChange={setQuickSearchQuery}
          onSelect={(id) => {
            selectProcess(id);
            setShowQuickSearch(false);
            setQuickSearchQuery("");
          }}
          onClose={() => {
            setShowQuickSearch(false);
            setQuickSearchQuery("");
          }}
        />
      )}
    </div>
  );
}

function hasUnreadForUser(p, currentUser, lastSeenByUser) {
  if (!currentUser) return false;
  const lastSeen = lastSeenByUser && lastSeenByUser[currentUser.id] ? lastSeenByUser[currentUser.id][p.id] : null;
  if (p.events.length === 0) return false;
  const latestEventMs = Math.max(...p.events.map((e) => new Date(e.date).getTime()));
  if (!lastSeen) return true; // nunca visto por este usuário
  return latestEventMs > new Date(lastSeen).getTime();
}

function getListHighlightFlags(p, now) {
  const soonestDeadlineEvent = [...p.events]
    .filter((e) => e.kind === "evento" && e.deadline && e.status !== "realizado")
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
  const dInfo = soonestDeadlineEvent ? deadlineInfo(soonestDeadlineEvent.deadline, now) : null;
  const isOverdue = !!(dInfo && dInfo.overdue);
  const isUrgent = !!(dInfo && dInfo.urgent && !dInfo.overdue);
  const isConcludedPending = !!(p.status === "concluido" && p.concludedAt);
  const isPaused = !!p.pausedAt;
  const daysSinceActivity = Math.floor((now - new Date(p.updatedAt || p.createdAt).getTime()) / (24 * 60 * 60 * 1000));
  const isStale = !isOverdue && !isUrgent && !isPaused && !isConcludedPending && daysSinceActivity >= STALE_DAYS;
  return { isOverdue, isUrgent, isConcludedPending, isPaused, isStale };
}

function ListView({ processos, setores, statuses, onSelect, onUpdateStatus, currentUser, lastSeenByUser }) {
  const now = Date.now();
  const [highlightFilter, setHighlightFilter] = useState(null);

  function toggleFilter(key) {
    setHighlightFilter((prev) => (prev === key ? null : key));
  }

  const filteredByHighlight = highlightFilter
    ? processos.filter((p) => getListHighlightFlags(p, now)[highlightFilter])
    : processos;
  // Item 4: processos que têm ALGUM andamento marcado como FAZER URGENTE
  // sempre aparecem primeiro, não importa a ordenação normal.
  const temAndamentoUrgente = (p) => (p.events || []).some((e) => e.status === "fazer_urgente");
  const sortedProcessos = [...filteredByHighlight].sort((a, b) => (temAndamentoUrgente(b) ? 1 : 0) - (temAndamentoUrgente(a) ? 1 : 0));

  return (
    <div style={styles.listViewWrap}>
      <div style={styles.listLegend}>
        <button
          style={highlightFilter === "isOverdue" ? styles.listLegendItemActive : styles.listLegendItem}
          onClick={() => toggleFilter("isOverdue")}
        >
          <AlertCircle size={11} color={DANGER} /> Prazo vencido
        </button>
        <button
          style={highlightFilter === "isUrgent" ? styles.listLegendItemActive : styles.listLegendItem}
          onClick={() => toggleFilter("isUrgent")}
        >
          <Clock size={11} color={WARNING_ORANGE} /> Vence em breve
        </button>
        <button
          style={highlightFilter === "isPaused" ? styles.listLegendItemActive : styles.listLegendItem}
          onClick={() => toggleFilter("isPaused")}
        >
          <Clock size={11} color="#92620A" /> Parado
        </button>
        <button
          style={highlightFilter === "isConcludedPending" ? styles.listLegendItemActive : styles.listLegendItem}
          onClick={() => toggleFilter("isConcludedPending")}
        >
          <CheckCircle2 size={11} color={SUCCESS_GREEN} /> Concluído
        </button>
        <button
          style={highlightFilter === "isStale" ? styles.listLegendItemActive : styles.listLegendItem}
          onClick={() => toggleFilter("isStale")}
        >
          <Clock size={11} color={MUTED} /> Sem atividade há {STALE_DAYS}+ dias
        </button>
        {highlightFilter && (
          <button style={styles.listLegendClear} onClick={() => setHighlightFilter(null)}>
            <X size={11} /> Limpar filtro
          </button>
        )}
      </div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Número</th>
            <th style={styles.th}>Título</th>
            <th style={styles.th}>Setor</th>
          </tr>
        </thead>
        <tbody>
          {sortedProcessos.length === 0 && (
            <tr>
              <td style={styles.tdEmpty} colSpan={3}>
                {highlightFilter ? "Nenhum processo nessa condição no momento." : 'Nenhum processo por aqui ainda. Crie o primeiro no botão "Novo processo".'}
              </td>
            </tr>
          )}
          {sortedProcessos.map((p) => {
            const { isOverdue, isUrgent, isConcludedPending, isPaused, isStale } = getListHighlightFlags(p, now);
            const isUnread = hasUnreadForUser(p, currentUser, lastSeenByUser);
            const isFazerUrgente = temAndamentoUrgente(p);
            const rowStyle = isFazerUrgente
              ? styles.trFazerUrgente
              : isOverdue
              ? styles.trHighlight
              : isPaused
              ? styles.trPaused
              : isUrgent
              ? styles.trUrgent
              : isConcludedPending
              ? styles.trConcluded
              : isStale
              ? styles.trStale
              : styles.tr;
            return (
              <tr key={p.id} style={rowStyle} className={isFazerUrgente ? "urgent-blink-row" : undefined} onClick={() => onSelect(p.id)}>
                <td style={{ ...styles.tdMono, color: isFazerUrgente ? "#FDE047" : processNumberColor(p) }}>
                  {isUnread && <span style={styles.unreadDot} title="Você ainda não viu as novidades deste processo" />}
                  {isFazerUrgente && <span style={{ marginRight: 3 }}>🔥</span>}
                  {isOverdue && <AlertCircle size={12} color={DANGER} style={{ verticalAlign: "middle", marginRight: 3 }} />}
                  {isUrgent && <Clock size={12} color={WARNING_ORANGE} style={{ verticalAlign: "middle", marginRight: 3 }} />}
                  {isPaused && <Clock size={12} color="#92620A" style={{ verticalAlign: "middle", marginRight: 3 }} />}
                  {isConcludedPending && <CheckCircle2 size={12} color={SUCCESS_GREEN} style={{ verticalAlign: "middle", marginRight: 3 }} />}
                  {isStale && <Clock size={12} color={MUTED} style={{ verticalAlign: "middle", marginRight: 3 }} />}
                  {p.parentId && "↳ "}
                  {p.number}
                </td>
                <td style={{ ...styles.td, color: isFazerUrgente ? "#FDE047" : undefined, fontWeight: isFazerUrgente ? 700 : undefined }}>{p.title}</td>
                <td style={styles.td}>
                  <span style={styles.statusPill}>
                    <span style={{ ...styles.dot, background: sectorColorForId(p.sectorId, setores) }} /> {sectorLabel(p.sectorId, setores)}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PainelView({ processos, setores, statuses, onSelect }) {
  const now = Date.now();

  const deadlineRows = processos
    .map((p) => {
      const soonest = [...p.events]
        .filter((e) => e.kind === "evento" && e.deadline)
        .sort((a, b) => new Date(a.deadline) - new Date(b.deadline))[0];
      if (!soonest) return null;
      const info = deadlineInfo(soonest.deadline, now);
      if (!info.overdue && !info.urgent) return null;
      return { p, seq: soonest.seq, info };
    })
    .filter(Boolean)
    .sort((a, b) => new Date(a.p.events.find((e) => e.seq === a.seq).deadline) - new Date(b.p.events.find((e) => e.seq === b.seq).deadline));

  const decisionRows = processos.filter((p) => p.aguardaDecisao);

  const oldestRows = [...processos].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)).slice(0, 10);

  const checklistRows = processos
    .map((p) => ({ p, pct: checklistPercent(p) }))
    .filter(({ pct }) => pct !== null && pct < 100)
    .sort((a, b) => b.pct - a.pct);

  return (
    <div style={styles.sectorsHomeWrap}>
      <div style={styles.sectorsHomeTitle}>Painel</div>
      <div style={styles.brandSub}>Uma visão rápida do que precisa de atenção agora.</div>

      <div style={styles.panelSection}>
        <div style={styles.panelSectionHeader}>
          <Clock size={15} color={DANGER} />
          <span style={styles.timelineTitle}>Prazos vencidos ou próximos do vencimento</span>
          <span style={styles.timelineCount}>{deadlineRows.length}</span>
        </div>
        {deadlineRows.length === 0 && <div style={styles.emptySmall}>Nada vencendo no momento.</div>}
        {deadlineRows.map(({ p, seq, info }) => (
          <button key={p.id + seq} style={styles.panelRow} onClick={() => onSelect(p.id)}>
            <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
            <span style={styles.panelRowTitle}>{p.title}</span>
            <span style={info.overdue ? styles.deadlineTagOverdue : styles.deadlineTagUrgent}>{info.label}</span>
          </button>
        ))}
      </div>

      <div style={styles.panelSection}>
        <div style={styles.panelSectionHeader}>
          <FileText size={15} color="#6D28D9" />
          <span style={styles.timelineTitle}>Aguardando decisão</span>
          <span style={styles.timelineCount}>{decisionRows.length}</span>
        </div>
        {decisionRows.length === 0 && <div style={styles.emptySmall}>Nenhum processo aguardando decisão.</div>}
        {decisionRows.map((p) => (
          <button key={p.id} style={styles.panelRow} onClick={() => onSelect(p.id)}>
            <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
            <span style={styles.panelRowTitle}>{p.title}</span>
            <span style={styles.statusPill}>{p.aguardaDecisao === "final" ? "Decisão final" : "Decisão intermediária"}</span>
          </button>
        ))}
      </div>

      <div style={styles.panelSection}>
        <div style={styles.panelSectionHeader}>
          <Timer size={15} color={MUTED} />
          <span style={styles.timelineTitle}>Processos mais antigos em aberto</span>
        </div>
        {oldestRows.length === 0 && <div style={styles.emptySmall}>Nenhum processo aberto.</div>}
        {oldestRows.map((p) => (
          <button key={p.id} style={styles.panelRow} onClick={() => onSelect(p.id)}>
            <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
            <span style={styles.panelRowTitle}>{p.title}</span>
            <span style={styles.deadlineTag}>há {elapsedLabel(p.createdAt, now)}</span>
          </button>
        ))}
      </div>

      <div style={styles.panelSection}>
        <div style={styles.panelSectionHeader}>
          <Zap size={15} color={ACCENT} />
          <span style={styles.timelineTitle}>Checklists em andamento</span>
          <span style={styles.timelineCount}>{checklistRows.length}</span>
        </div>
        {checklistRows.length === 0 && <div style={styles.emptySmall}>Nenhum checklist pendente.</div>}
        {checklistRows.map(({ p, pct }) => (
          <button key={p.id} style={styles.panelRow} onClick={() => onSelect(p.id)}>
            <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
            <span style={styles.panelRowTitle}>{p.title}</span>
            <span style={styles.checklistPercentBadge(pct)}>{pct}%</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DecisionsHub({ processos, onSelect }) {
  const [filter, setFilter] = useState("todas"); // todas | intermediaria | final

  const rows = [];
  processos.forEach((p) => {
    p.events
      .filter((e) => e.kind === "decisao")
      .forEach((e) => rows.push({ p, e }));
  });
  rows.sort((a, b) => new Date(b.e.date) - new Date(a.e.date));
  const filtered = filter === "todas" ? rows : rows.filter(({ e }) => e.decisionType === filter);

  return (
    <div style={styles.sectorsHomeWrap}>
      <div style={styles.sectorsHomeHeader}>
        <div>
          <div style={styles.sectorsHomeTitle}>
            <span aria-hidden="true">⚜️</span> Central de Decisões
          </div>
          <div style={styles.brandSub}>Todas as decisões intermediárias e finais já registradas, para encontrar com facilidade.</div>
        </div>
      </div>

      <div style={styles.filterRow}>
        <button style={filter === "todas" ? styles.filterChipActive : styles.filterChip} onClick={() => setFilter("todas")}>
          Todas
        </button>
        <button style={filter === "intermediaria" ? styles.filterChipActive : styles.filterChip} onClick={() => setFilter("intermediaria")}>
          Intermediárias
        </button>
        <button style={filter === "final" ? styles.filterChipActive : styles.filterChip} onClick={() => setFilter("final")}>
          Finais
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {filtered.length === 0 && <div style={styles.emptySmall}>Nenhuma decisão registrada ainda.</div>}
        {filtered.map(({ p, e }) => (
          <button key={p.id + "-" + e.seq} style={styles.panelRow} onClick={() => onSelect(p.id)}>
            <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
            <div style={styles.decisionHubTextCol}>
              <div style={styles.decisionHubTitle}>
                {p.title} — {e.decisionType === "final" ? "Decisão final" : "Decisão intermediária"} <span aria-hidden="true">⚜️</span>
                {e.anulada && <span style={styles.anuladaTag}>ANULADA</span>}
              </div>
              <div style={styles.decisionHubSnippet}>{(e.description || "").slice(0, 140)}</div>
            </div>
            <span style={styles.deadlineTag}>{fmtDate(e.date)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}


function SetoresHome({ setores, processos, onOpenSector, onAddSector, onManage }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  function submit() {
    if (name.trim()) {
      onAddSector(name);
      setName("");
      setAdding(false);
    }
  }

  return (
    <div style={styles.sectorsHomeWrap}>
      <div style={styles.sectorsHomeHeader}>
        <div>
          <div style={styles.sectorsHomeTitle}>Setores</div>
          <div style={styles.brandSub}>Cada setor reúne os processos que estão sob sua responsabilidade</div>
        </div>
        <button style={styles.manageSectorsBtn} onClick={onManage}>
          <Settings2 size={13} /> Gerenciar
        </button>
      </div>

      <div style={styles.sectorsGrid}>
        {setores.map((s, i) => {
          const count = processos.filter((p) => p.sectorId === s.id).length;
          return (
            <button key={s.id} style={styles.sectorCard} onClick={() => onOpenSector(s.id)}>
              <div style={{ ...styles.sectorCardIcon, background: s.color || sectorColor(i) }}>
                <Building2 size={18} color="#fff" />
              </div>
              <div style={styles.sectorCardBody}>
                <div style={styles.sectorCardName}>
                  {s.fixed && <Lock size={11} />} {s.name}
                </div>
                <div style={styles.sectorCardCount}>{count} processo{count === 1 ? "" : "s"}</div>
              </div>
              <ChevronRight size={16} color={MUTED} />
            </button>
          );
        })}

        {adding ? (
          <div style={styles.sectorCardAddForm}>
            <input
              autoFocus
              style={styles.input}
              placeholder="Nome do setor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={styles.secondaryBtn} onClick={() => setAdding(false)}>
                Cancelar
              </button>
              <button style={styles.primaryBtn} onClick={submit}>
                Criar
              </button>
            </div>
          </div>
        ) : (
          <button style={styles.sectorCardAddBtn} onClick={() => setAdding(true)}>
            <Plus size={16} /> Novo setor
          </button>
        )}
      </div>

      {setores.length === 0 && !adding && (
        <div style={styles.emptySmall}>Nenhum setor criado ainda. Setores representam as áreas pelas quais os processos transitam (ex.: Financeiro, Compras, Jurídico).</div>
      )}
    </div>
  );
}

function SectorBoard({ setor, setorIndex: idx, processos, statuses, onSelect, onBack, onToggleDone, onManageStatuses, onChangeStatus }) {
  const sectorStatuses = statusesForSectorBoard(setor?.id, statuses);
  const [openGroups, setOpenGroups] = useState(() => Object.fromEntries(sectorStatuses.map((s) => [s.id, true])));
  const concluidoId = (statuses.find((s) => s.id === "concluido") || statuses[statuses.length - 1]).id;
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverStatusId, setDragOverStatusId] = useState(null);

  if (!setor) {
    return (
      <div style={styles.detailWrap}>
        <button style={styles.backBtn} onClick={onBack}>
          <ChevronLeft size={15} /> Voltar aos setores
        </button>
        <div style={styles.emptySmall}>Este setor não existe mais.</div>
      </div>
    );
  }

  return (
    <div style={styles.detailWrap}>
      <button style={styles.backBtn} onClick={onBack}>
        <ChevronLeft size={15} /> Voltar aos setores
      </button>

      <div style={styles.sectorBoardHeader}>
        <div style={{ ...styles.sectorCardIcon, background: setor.color || sectorColor(idx >= 0 ? idx : 0) }}>
          <Building2 size={18} color="#fff" />
        </div>
        <div style={styles.sectorsHomeTitle}>{setor.name}</div>
        <button style={{ ...styles.manageSectorsBtn, marginLeft: "auto" }} onClick={onManageStatuses}>
          <Settings2 size={12} /> Editar status
        </button>
      </div>

      {sectorStatuses.map((st) => {
        const items = processos.filter((p) => p.status === st.id);
        const isOpen = openGroups[st.id];
        const isDropTarget = dragOverStatusId === st.id;
        return (
          <div
            key={st.id}
            style={{
              ...styles.statusGroup,
              ...(isDropTarget ? { outline: `2px dashed ${st.color || ACCENT}`, outlineOffset: 2, borderRadius: 10 } : {}),
            }}
            onDragOver={(e) => {
              if (!draggingId) return;
              e.preventDefault();
              setDragOverStatusId(st.id);
            }}
            onDragLeave={() => setDragOverStatusId((cur) => (cur === st.id ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStatusId(null);
              const id = e.dataTransfer.getData("text/plain") || draggingId;
              if (id) onChangeStatus(id, st.id);
              setDraggingId(null);
            }}
          >
            <button style={styles.statusGroupHeader} onClick={() => setOpenGroups({ ...openGroups, [st.id]: !isOpen })}>
              {isOpen ? <ChevronDown size={14} color={MUTED} /> : <ChevronRight size={14} color={MUTED} />}
              <span style={{ ...styles.dot, background: st.color }} />
              <span style={styles.statusGroupLabel}>{st.label}</span>
              <span style={styles.columnCount}>{items.length}</span>
            </button>
            {isOpen && (
              <div style={styles.taskRows}>
                {items.length === 0 && (
                  <div style={{ ...styles.emptySmall, ...(isDropTarget ? { color: st.color || ACCENT, fontWeight: 600 } : {}) }}>
                    {isDropTarget ? "Solte aqui para mover" : "Nada aqui."}
                  </div>
                )}
                {items.map((p) => (
                  <div
                    key={p.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", p.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(p.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setDragOverStatusId(null);
                    }}
                    style={{ ...styles.taskRow, opacity: draggingId === p.id ? 0.4 : 1, cursor: "grab" }}
                    title="Arraste para outro status, ou use o menu ao lado para mudar manualmente"
                  >
                    <button
                      style={styles.taskCheckbox}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleDone(p.id, p.status);
                      }}
                      title={p.status === concluidoId ? "Reabrir" : "Marcar como concluído"}
                    >
                      {p.status === concluidoId ? <CheckCircle2 size={21} color={ACCENT} /> : <Circle size={21} color={MUTED} />}
                    </button>
                    <button style={styles.taskRowTextCol} onClick={() => onSelect(p.id)}>
                      <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
                      <span style={styles.taskRowTitleWrap}>{p.title}</span>
                    </button>
                    {p.priority === "alta" && <span style={styles.cardPriority("alta")}>Alta</span>}
                    <select
                      value={p.status}
                      onChange={(e) => onChangeStatus(p.id, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      style={styles.statusQuickSelect}
                      title="Mover para outro status (alternativa ao arrastar)"
                    >
                      {sectorStatuses.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProcessDetail({
  processo,
  processos,
  setores,
  statuses,
  colaboradores,
  currentUser,
  onBack,
  onUpdate,
  onChangeStatus,
  onChangeDueDate,
  onChangeClassification,
  assuntos,
  onSetAssunto,
  onAnularDecisao,
  onAprovarRejeitar,
  onResponderEncaminhamento,
  pendingEncItem,
  setPendingEncItem,
  onDelete,
  onTransferSector,
  onUpdateEventStatus,
  onUpdateEventDescription,
  onUpdateEventFields,
  onRequestPrereqPicker,
  onRegisterVote,
  onEnviarPesquisasParaAprovacao,
  onRegistrarCompra,
  onUpdateFrozenDeadline,
  onDeleteEvent,
  onConcluir,
  onSetArchived,
  onSetParent,
  onAddChecklistItem,
  onToggleChecklistItem,
  onSetChecklistDeadline,
  onDeleteChecklistItem,
  onRenameChecklist,
  onEnableChecklist,
  composerVersion,
  setComposerVersion,
  onAddChecklistPhoto,
  onRemoveChecklistPhoto,
  onSelectProcess,
  newEventText,
  setNewEventText,
  newEventStatus,
  setNewEventStatus,
  newEventSetStatus,
  setNewEventSetStatus,
  newEventType,
  setNewEventType,
  markProcessConcluded,
  setMarkProcessConcluded,
  newEventBanDays,
  setNewEventBanDays,
  newEventApproveDevice,
  setNewEventApproveDevice,
  newEventDeadline,
  setNewEventDeadline,
  newEventPause,
  setNewEventPause,
  newEncaminhamentos,
  setNewEncaminhamentos,
  newEventAssignedTo,
  setNewEventAssignedTo,
  newEventIsPedidoResposta,
  setNewEventIsPedidoResposta,
  replyFulfillment,
  setReplyFulfillment,
  replyPartialStatus,
  setReplyPartialStatus,
  newEventFornecedor,
  setNewEventFornecedor,
  newEventAtivoNome,
  setNewEventAtivoNome,
  newEventPatrimonioAcao,
  setNewEventPatrimonioAcao,
  newEventVotantesIds,
  setNewEventVotantesIds,
  newEventValor,
  setNewEventValor,
  newOptionLoja,
  setNewOptionLoja,
  newOptionPreco,
  setNewOptionPreco,
  newOptionLink,
  setNewOptionLink,
  newOrcamentoItens,
  setNewOrcamentoItens,
  orcamentosLivroCaixa,
  replyingTo,
  setReplyingTo,
  pendingAttachments,
  setPendingAttachments,
  attaching,
  attachError,
  onAttachFiles,
  newEventDriveLink,
  setNewEventDriveLink,
  onAddEvent,
  clockTick,
  highlightEventSeq,
}) {
  const replyingEvent = processo.events.find((e) => e.seq === replyingTo);
  const eventoUrgente = processo.events.find((e) => e.status === "fazer_urgente");
  const hasEventoUrgente = !!eventoUrgente;
  const now = Date.now();
  const [openStatusSeq, setOpenStatusSeq] = useState(null);
  const [highlightedSeq, setHighlightedSeq] = useState(highlightEventSeq || null);
  const [visibleRootCount, setVisibleRootCount] = useState(25);
  const scrolledToSeqRef = useRef(null);

  useEffect(() => {
    if (!highlightEventSeq) return;
    setHighlightedSeq(highlightEventSeq);
    scrolledToSeqRef.current = null; // permite rolar de novo pra esse seq (pode ser um clique novo pro mesmo andamento)
    // Se o andamento demandado for mais antigo que os que já aparecem na
    // tela (escondido atrás do "carregar mais"), mostra tudo — senão o
    // elemento nem existe ainda na página pra gente rolar até ele.
    setVisibleRootCount((v) => (v < 9999 ? 9999 : v));
    const clearHighlight = setTimeout(() => setHighlightedSeq(null), 4000);
    return () => {
      clearTimeout(clearHighlight);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightEventSeq]);
  const [confirmAnularSeq, setConfirmAnularSeq] = useState(null);
  const [editingEventSeq, setEditingEventSeq] = useState(null);
  const [addingPesquisaSeq, setAddingPesquisaSeq] = useState(null);
  const [novaPesquisaDescricao, setNovaPesquisaDescricao] = useState("");
  const [novaPesquisaLoja, setNovaPesquisaLoja] = useState("");
  const [novaPesquisaLink, setNovaPesquisaLink] = useState("");
  const [novaPesquisaValor, setNovaPesquisaValor] = useState("");
  const [registrandoCompraSeq, setRegistrandoCompraSeq] = useState(null);
  const [compraDescricao, setCompraDescricao] = useState("");
  const [compraFornecedor, setCompraFornecedor] = useState("");
  const [compraValor, setCompraValor] = useState("");
  const [compraNotaFiscal, setCompraNotaFiscal] = useState("");
  const [compraEhAtivo, setCompraEhAtivo] = useState(false);
  const [collapsedThreads, setCollapsedThreads] = useState(() => new Map());

  function toggleThreadCollapse(seq, currentlyCollapsed) {
    setCollapsedThreads((prev) => {
      const next = new Map(prev);
      next.set(seq, !currentlyCollapsed);
      return next;
    });
  }
  const [editDraft, setEditDraft] = useState("");
  const [editDeadlineDraft, setEditDeadlineDraft] = useState("");
  const [updatingDeadlineSeq, setUpdatingDeadlineSeq] = useState(null);
  const [showEditHistorySeq, setShowEditHistorySeq] = useState(null);
  const [editAssignedToDraft, setEditAssignedToDraft] = useState("");
  const [editIsPedidoRespostaDraft, setEditIsPedidoRespostaDraft] = useState("sim");
  const editEventRef = useRef(null);
  const [confirmDeleteProcess, setConfirmDeleteProcess] = useState(false);
  const [confirmDeleteEventSeq, setConfirmDeleteEventSeq] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const descriptionRef = useRef(null);
  const titleRef = useRef(null);

  useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = "auto";
      titleRef.current.style.height = titleRef.current.scrollHeight + "px";
    }
  }, [processo.id, processo.title]);
  const eventTextRef = useRef(null);
  const composerRef = useRef(null);

  function handleReply(seq) {
    setReplyingTo(seq);
    const draft = loadDraft(processo.id, seq);
    setNewEventText(draft);
    setComposerVersion((v) => v + 1);
    requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      eventTextRef.current?.focus();
    });
  }

  function scrollToEvent(seq) {
    const el = document.getElementById(`event-${processo.id}-${seq}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  useEffect(() => {
    if (processo.pausedAt && newEventType !== "intermediaria" && newEventType !== "final") {
      setNewEventType("intermediaria");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processo.pausedAt, processo.id]);

  useEffect(() => {
    setVisibleRootCount(25);
  }, [processo.id]);

  const hasFinalDecision = processo.events.some((e) => e.kind === "decisao" && e.decisionType === "final");
  const parentProcess = processo.parentId ? processos.find((p) => p.id === processo.parentId) : null;
  const subProcessos = processos.filter((p) => p.parentId === processo.id);
  const linkableProcessos = processos.filter((p) => p.id !== processo.id && p.parentId !== processo.id);
  const elapsed = elapsedLabel(processo.createdAt, now);

  function renderComposer() {
    return (
          processo.archived ? (
            <div className="no-print" style={styles.archivedComposerNote}>
              <Archive size={13} /> Este processo está arquivado. Desarquive-o para adicionar novos andamentos.
            </div>
          ) : (
          <div className="no-print" ref={composerRef}>
            {replyingEvent && (
              <div style={styles.replyingBar}>
                <Reply size={12} />
                {pendingEncItem && pendingEncItem.decisionSeq === replyingEvent.seq
                  ? `Respondendo ao item ${pendingEncItem.itemSeq} da decisão intermediária do andamento nº ${displayNumberFor(processo.events, replyingEvent.seq)}`
                  : `Respondendo ao andamento nº ${displayNumberFor(processo.events, replyingEvent.seq)}`}
                <button
                  style={styles.replyingCancel}
                  onClick={() => {
                    setReplyingTo(null);
                    setPendingEncItem(null);
                    setNewEventText(loadDraft(processo.id, null));
                    setComposerVersion((v) => v + 1);
                  }}
                >
                  <X size={12} />
                </button>
              </div>
            )}
  
            {replyingEvent && replyingEvent.deadline && replyingEvent.kind === "evento" && !pendingEncItem && (
              <div className="no-print" style={styles.fulfillmentBox}>
                <div style={styles.deadlineComposerLabel}>Essa resposta cumpre o que foi pedido no andamento nº {displayNumberFor(processo.events, replyingEvent.seq)}?</div>
                <div style={styles.fulfillmentOptions}>
                  <button
                    style={replyFulfillment === "total" ? styles.fulfillmentBtnActive : styles.fulfillmentBtn}
                    onClick={() => setReplyFulfillment(replyFulfillment === "total" ? "" : "total")}
                  >
                    Sim, cumpre totalmente
                  </button>
                  <button
                    style={replyFulfillment === "parcial" ? styles.fulfillmentBtnActive : styles.fulfillmentBtn}
                    onClick={() => {
                      setReplyFulfillment(replyFulfillment === "parcial" ? "" : "parcial");
                      setReplyPartialStatus("andamento");
                    }}
                  >
                    Parcialmente
                  </button>
                  <button
                    style={replyFulfillment === "nao" ? styles.fulfillmentBtnActive : styles.fulfillmentBtn}
                    onClick={() => setReplyFulfillment(replyFulfillment === "nao" ? "" : "nao")}
                  >
                    Não, é só uma atualização
                  </button>
                </div>
                {replyFulfillment === "parcial" && (
                  <div style={styles.orcamentoHint}>Isso vai atualizar o status do andamento nº {displayNumberFor(processo.events, replyingEvent.seq)} para "Em andamento".</div>
                )}
              </div>
            )}
  
            {pendingAttachments.length > 0 && (
              <div style={styles.attachmentsRow}>
                {pendingAttachments.map((a) => (
                  <div key={a.id} style={styles.pendingAttachmentChip}>
                    {a.type === "image" ? <ImageIcon size={12} /> : <FileText size={12} />}
                    <span style={styles.pendingAttachmentName}>{a.name}</span>
                    <button style={styles.pendingAttachmentRemove} onClick={() => setPendingAttachments(pendingAttachments.filter((x) => x.id !== a.id))}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
  
            <div style={styles.deadlineComposerRow}>
              <label style={styles.deadlineComposerLabel}>
                <Clock size={12} />
                {replyingEvent ? `Prazo para cumprir o andamento nº ${displayNumberFor(processo.events, replyingEvent.seq)}` : "Prazo deste andamento (opcional)"}
              </label>
              <input type="datetime-local" style={styles.deadlineInput} value={newEventDeadline} onChange={(e) => setNewEventDeadline(e.target.value)} />
              {newEventDeadline && (
                <button style={styles.pendingAttachmentRemove} onClick={() => setNewEventDeadline("")} title="Remover prazo">
                  <X size={13} />
                </button>
              )}
            </div>
  
            {colaboradores.length > 0 && processo.classification !== "pessoal" && (
              <div style={styles.deadlineComposerRow}>
                <label style={styles.deadlineComposerLabel}>
                  <Users size={12} />
                  Demandar para (opcional)
                </label>
                <select style={styles.composerStatusSelect} value={newEventAssignedTo} onChange={(e) => setNewEventAssignedTo(e.target.value)}>
                  <option value="">Ninguém em especial</option>
                  {colaboradores.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {newEventAssignedTo && (
              <div style={styles.deadlineComposerRow}>
                <label style={styles.deadlineComposerLabel}>Isso é um pedido de resposta?</label>
                <select style={styles.composerStatusSelect} value={newEventIsPedidoResposta} onChange={(e) => setNewEventIsPedidoResposta(e.target.value)}>
                  <option value="sim">Sim — preciso que essa pessoa responda</option>
                  <option value="nao">Não — só preciso que ela execute (aguarda execução)</option>
                </select>
              </div>
            )}
  
            <div style={styles.typeComposerRow}>
              <label style={styles.deadlineComposerLabel}>Tipo de andamento</label>
              <select style={styles.composerStatusSelect} value={newEventType} onChange={(e) => setNewEventType(e.target.value)}>
                {processo.classification === "pessoal" ? (
                  <>
                    {!processo.pausedAt && <option value="andamento">Andamento comum</option>}
                    <option value="decisao_elia">Decisão da Elia</option>
                    <option value="decisao_jean">Decisão do Jean</option>
                    <option value="decisao_ambos">Decisão dos dois</option>
                  </>
                ) : (
                  <>
                    {!processo.pausedAt && <option value="andamento">Andamento comum</option>}
                    {!processo.pausedAt && !hasEventoUrgente && (processo.unlockRequestForUserId || processo.deviceRequestForUserId) && (
                      <option value="pedir_informacoes">Pedir mais informações (avisa a pessoa por e-mail)</option>
                    )}
                    {!processo.pausedAt && !hasEventoUrgente && <option value="aguarda_intermediaria">Aguarda decisão intermediária</option>}
                    {!processo.pausedAt && !hasEventoUrgente && <option value="aguarda_final">Aguarda decisão final</option>}
                    {processo.sectorId === ADMINISTRATIVO_SECTOR_ID && !hasEventoUrgente && <option value="intermediaria">Decisão intermediária</option>}
                    {processo.sectorId === ADMINISTRATIVO_SECTOR_ID && !hasEventoUrgente && <option value="final">Decisão final</option>}
                    {!processo.pausedAt && !hasEventoUrgente && <option value="orcamento_lista">Pedido de orçamento (vários itens — vai pro Livro Caixa)</option>}
                    {!processo.pausedAt && !hasEventoUrgente && <option value="votacao">Andamento com votação/aprovação</option>}
                  </>
                )}
              </select>
              {newEventType === "final" && (
                <label style={styles.markConcludedLabel}>
                  <input type="checkbox" checked={markProcessConcluded} onChange={(e) => setMarkProcessConcluded(e.target.checked)} />
                  Marcar processo como concluído (e arquivar)
                </label>
              )}
            </div>

            {(newEventType === "intermediaria" || newEventType === "final") && (
              <div style={styles.composerRow}>
                <label style={styles.deadlineComposerLabel}>Vincular a um ativo patrimonial (opcional — Livro Caixa)</label>
                <input
                  style={styles.input}
                  value={newEventAtivoNome}
                  onChange={(e) => setNewEventAtivoNome(e.target.value)}
                  placeholder="Nome do ativo, ex.: Balança"
                />
                {newEventAtivoNome.trim() && (
                  <select
                    style={{ ...styles.select, marginTop: 8 }}
                    value={newEventPatrimonioAcao}
                    onChange={(e) => setNewEventPatrimonioAcao(e.target.value)}
                  >
                    <option value="historico">Só registrar no histórico da ficha</option>
                    <option value="observacao">Marcar ativo como "Em observação"</option>
                    <option value="sugerir_baixa">Sugerir baixa do ativo (fica pendente de confirmação lá no Livro Caixa)</option>
                  </select>
                )}
                <div style={styles.attachHint}>
                  O texto desta decisão vai virar uma anotação na ficha do ativo com esse nome, lá no Livro Caixa, na próxima sincronização.
                </div>
              </div>
            )}

            {hasEventoUrgente && (
              <div style={styles.pauseCheckboxLabel}>
                🔥 Este processo tem um andamento marcado como <strong>FAZER URGENTE</strong> (nº {plainNumber(eventoUrgente.seq)}). Só
                dá pra responder esse andamento até ele ser resolvido — mude o status dele (clique no selo vermelho, abaixo) pra
                liberar os outros de novo.
              </div>
            )}

            {processo.pausedAt && (
              <div style={styles.pauseCheckboxLabel}>
                Este processo está parado. Enquanto isso, só é possível dar uma nova decisão (intermediária ou final) para retomá-lo —
                nenhum outro andamento pode ser registrado.
              </div>
            )}

            {(newEventType === "intermediaria" || newEventType === "final") && processo.sectorId !== ADMINISTRATIVO_SECTOR_ID && processo.classification !== "pessoal" && (
              <div style={styles.orcamentoHint}>Decisões só podem ser dadas quando o processo está no setor Administrativo.</div>
            )}

            {newEventType === "final" && processo.unlockRequestForUserId && (
              <div style={styles.pauseCheckboxLabel}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, marginBottom: newEventBanDays ? 8 : 0 }}>
                  <input
                    type="checkbox"
                    checked={newEventBanDays !== ""}
                    onChange={(e) => setNewEventBanDays(e.target.checked ? "20" : "")}
                  />
                  Banir por tempo determinado (em vez de negar ou aprovar direto)
                </label>
                {newEventBanDays !== "" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min="1"
                      style={{ ...styles.deadlineInput, maxWidth: 80 }}
                      value={newEventBanDays}
                      onChange={(e) => setNewEventBanDays(e.target.value)}
                    />
                    <span>dias a partir de hoje. O sistema libera o acesso sozinho quando o prazo terminar, e avisa a pessoa por e-mail nos dois momentos (na decisão, e no dia da liberação).</span>
                  </div>
                )}
              </div>
            )}

            {newEventType === "orcamento_lista" && (
              <div style={styles.orcamentoHint}>
                O pedido é só descritivo — escreva abaixo o que precisa ser comprado/orçado (e anexe um link do Drive se tiver fotos ou
                documentos). Ele vai aparecer pro Financeiro no Livro Caixa decidir; os itens e valores entram depois, na etapa de
                pesquisa de preço.
              </div>
            )}
  
            {newEventType === "final" && processo.deviceRequestForUserId && (
              <div style={styles.pauseCheckboxLabel}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600 }}>
                  <input type="checkbox" checked={newEventApproveDevice} onChange={(e) => setNewEventApproveDevice(e.target.checked)} />
                  Aprovar este novo aparelho (o aparelho anterior é travado, e este passa a funcionar)
                </label>
                <div style={{ marginTop: 6 }}>Se deixar desmarcado, a decisão final nega o pedido — o aparelho novo continua sem acesso.</div>
              </div>
            )}

            {(newEventType === "orcamento_opcao" || newEventType === "os_opcao") && !replyingTo && (
              <div style={styles.orcamentoHint}>
                Clique em "Responder" no pedido de origem para que esta resposta seja numerada corretamente (Item 1, 2...).
              </div>
            )}
  
            {(newEventType === "aguarda_intermediaria" || newEventType === "aguarda_final") && (
              <div style={styles.orcamentoHint}>
                Este é apenas um registro (sem texto ou anexo). O processo será movido automaticamente para o setor Administrativo, na
                seção "Para Proferir Decisão".
              </div>
            )}
  
            {(newEventType === "orcamento_pedido" || newEventType === "os_pedido") && (
              <div style={styles.orcamentoComposerRow}>
                <input
                  style={styles.input}
                  placeholder={newEventType === "os_pedido" ? "Responsável / prestador do serviço" : "Fornecedor / prestador"}
                  value={newEventFornecedor}
                  onChange={(e) => setNewEventFornecedor(e.target.value)}
                />
                <input
                  style={{ ...styles.input, maxWidth: 160 }}
                  type="number"
                  step="0.01"
                  placeholder="Valor estimado (R$)"
                  value={newEventValor}
                  onChange={(e) => setNewEventValor(e.target.value)}
                />
              </div>
            )}
            {newEventType === "orcamento_pedido" && (
              <div style={styles.orcamentoHint}>Este pedido será enviado automaticamente para o setor Financeiro aprovar.</div>
            )}
            {newEventType === "os_pedido" && (
              <div style={styles.orcamentoHint}>Este pedido será enviado automaticamente para o setor Manutenção e Limpeza atender.</div>
            )}
  
            {(newEventType === "orcamento_opcao" || newEventType === "os_opcao") && (
              <div style={styles.orcamentoComposerRow}>
                <input style={styles.input} placeholder="Loja / fornecedor" value={newOptionLoja} onChange={(e) => setNewOptionLoja(e.target.value)} />
                <input
                  style={{ ...styles.input, maxWidth: 140 }}
                  type="number"
                  step="0.01"
                  placeholder="Preço (R$)"
                  value={newOptionPreco}
                  onChange={(e) => setNewOptionPreco(e.target.value)}
                />
                <input style={styles.input} placeholder="Link (https://...)" value={newOptionLink} onChange={(e) => setNewOptionLink(e.target.value)} />
              </div>
            )}
  
            {newEventType === "votacao" && (
              <div style={styles.composerRow}>
                <label style={styles.deadlineComposerLabel}>Quem precisa votar (aprovar/rejeitar)?</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {colaboradores.map((c) => (
                    <label key={c.id} style={styles.markConcludedLabel}>
                      <input
                        type="checkbox"
                        checked={newEventVotantesIds.includes(c.id)}
                        onChange={(e) => {
                          setNewEventVotantesIds((prev) =>
                            e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                          );
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {colaboradores.length === 0 && <div style={styles.attachHint}>Cadastre colaboradores primeiro.</div>}
              </div>
            )}

            {newEventType === "andamento" && (
              <div style={styles.composerRow}>
                <label style={styles.markConcludedLabel}>
                  <input type="checkbox" checked={newEventSetStatus} onChange={(e) => setNewEventSetStatus(e.target.checked)} />
                  Definir status deste andamento
                </label>
                {newEventSetStatus && (
                  <select style={styles.composerStatusSelect} value={newEventStatus} onChange={(e) => setNewEventStatus(e.target.value)}>
                    {EVENT_STATUSES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
  
            {newEventType !== "aguarda_intermediaria" && newEventType !== "aguarda_final" && (
              <>
                <RichFormatToolbar editorRef={eventTextRef} onChangeHtml={setNewEventText} colaboradores={colaboradores} />
                <RichEditor
                  key={composerVersion}
                  editorRef={eventTextRef}
                  initialValue={newEventText}
                  onChangeHtml={setNewEventText}
                  onSubmit={onAddEvent}
                  placeholder={
                    newEventType === "final"
                      ? "Descreva a decisão final…"
                      : newEventType === "intermediaria"
                      ? "Descreva a decisão intermediária…"
                      : newEventType === "orcamento_pedido"
                      ? "Descreva o que está sendo orçado…"
                      : newEventType === "orcamento_opcao" || newEventType === "os_opcao"
                      ? "Observações sobre esta resposta (opcional)…"
                      : newEventType === "os_pedido"
                      ? "Descreva o serviço de manutenção/limpeza necessário…"
                      : "Descreva o novo andamento…"
                  }
                  style={styles.richEditorBoxComposer}
                />
  
                {newEventType === "intermediaria" && (
                  <>
                    <label className="no-print" style={styles.pauseCheckboxLabel}>
                      <input type="checkbox" checked={newEventPause} onChange={(e) => setNewEventPause(e.target.checked)} />
                      Parar o processo por tempo indeterminado (congela os prazos em andamento, manda para o Administrativo em "Processo
                      Parado")
                    </label>
                    <div className="no-print" style={{ ...styles.attachHint, fontWeight: 600, marginTop: 4 }}>
                      Encaminhamentos (obrigatório pelo menos 1) — é a partir deles que o cumprimento desta decisão vai sendo medido
                      automaticamente.
                    </div>
                    <EncaminhamentosBuilder items={newEncaminhamentos} onChange={setNewEncaminhamentos} />
                  </>
                )}
  
                <div style={styles.deadlineComposerRow}>
                  <label style={styles.deadlineComposerLabel}>
                    <Link2 size={12} />
                    Link do Google Drive com fotos (opcional)
                  </label>
                  <input
                    type="url"
                    style={styles.input}
                    placeholder="https://drive.google.com/..."
                    value={newEventDriveLink}
                    onChange={(e) => setNewEventDriveLink(e.target.value)}
                  />
                </div>
              </>
            )}
            <div style={styles.composerSubmitRow}>
              <span style={styles.composerSubmitHint}>
                {newEventType === "aguarda_intermediaria" || newEventType === "aguarda_final" ? "" : "Ctrl+Enter registra direto"}
              </span>
              <button style={styles.addEventBtn} onClick={onAddEvent}>
                Registrar
              </button>
            </div>
          </div>
          )
    );
  }

  return (
    <div style={styles.detailWrap}>
      <datalist id="colaboradores-datalist">
        {colaboradores.map((c) => (
          <option key={c.id} value={c.name} />
        ))}
      </datalist>
      <div className="no-print" style={styles.backBtnStickyBar}>
        <button style={styles.backBtnInBox} onClick={onBack}>
          <ChevronLeft size={15} /> Voltar
        </button>
      </div>

      <div style={styles.detailHeader}>
        <div style={styles.detailHeaderTop}>
          <div style={styles.detailHeaderLeftGroup}>
            <div style={styles.stamp(processNumberColor(processo))}>{processo.number}</div>
          </div>
          <div className="no-print" style={styles.detailHeaderActions}>
            {processo.archived ? (
              <button style={styles.secondaryBtn} onClick={() => onSetArchived(false)}>
                <ArchiveRestore size={14} /> Desarquivar
              </button>
            ) : (
              hasFinalDecision && (
                <button style={styles.secondaryBtn} onClick={() => onSetArchived(true)}>
                  <Archive size={14} /> Enviar para o arquivo
                </button>
              )
            )}
            {(processo.archived || processo.status === "concluido") && (
              <>
                <ExportLink processo={processo} statuses={statuses} setores={setores} />
                <PdfExportLink processo={processo} statuses={statuses} setores={setores} assuntos={assuntos} colaboradores={colaboradores} />
              </>
            )}
            {confirmDeleteProcess ? (
              <span style={styles.confirmDeleteGroup}>
                <button style={styles.confirmDeleteYes} onClick={onDelete}>
                  Mover para a lixeira
                </button>
                <button style={styles.confirmDeleteNo} onClick={() => setConfirmDeleteProcess(false)}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button style={styles.deleteBtn} onClick={() => setConfirmDeleteProcess(true)} title="Excluir processo (vai para a lixeira)">
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
        <textarea
          ref={titleRef}
          style={styles.titleInput}
          value={processo.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
          rows={1}
          readOnly={processo.archived}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = e.target.scrollHeight + "px";
          }}
        />
        <div style={styles.detailSub}>
          <span>Aberto em {fmtDateTime(processo.createdAt)}</span>
          <span style={styles.elapsedGroup}>
            <Timer size={11} /> há {elapsed}
          </span>
          {checklistPercent(processo) !== null && (
            <span style={styles.checklistPercentBadge(checklistPercent(processo))}>{checklistPercent(processo)}% do checklist</span>
          )}
        </div>
        {parentProcess && (
          <button className="no-print" style={styles.parentTag} onClick={() => onSelectProcess(parentProcess.id)}>
            <Link2 size={11} /> Subprocesso de {parentProcess.number} — {parentProcess.title}
          </button>
        )}
        {processo.archived && (
          <div style={styles.archivedBanner}>
            <Archive size={12} /> Este processo está arquivado.
          </div>
        )}
        {!processo.archived && processo.status === "concluido" && processo.concludedAt && (
          <div style={styles.concludedBanner}>
            <CheckCircle2 size={12} color={SUCCESS_GREEN} /> Concluído — será arquivado automaticamente em{" "}
            {Math.max(0, ARCHIVE_GRACE_DAYS - Math.floor((Date.now() - new Date(processo.concludedAt).getTime()) / (24 * 60 * 60 * 1000)))} dia(s), se
            ninguém arquivar antes.
          </div>
        )}
      </div>

      {editMode ? (
        <>
          <div className="no-print" style={styles.editModeBar}>
            <button style={styles.secondaryBtn} onClick={() => setEditMode(false)}>
              <X size={13} /> Fechar edição
            </button>
          </div>

          <div style={styles.fieldsGrid}>
            <Field label="Status">
              <select style={styles.select} value={processo.status} onChange={(e) => onChangeStatus(e.target.value)}>
                {availableStatusesFor(processo, statuses).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
            {processo.classification !== "pessoal" && (
              <Field label="Setor atual">
                <select style={styles.select} value={processo.sectorId || NONE_SECTOR} onChange={(e) => onTransferSector(e.target.value === NONE_SECTOR ? null : e.target.value)}>
                  <option value={NONE_SECTOR}>Sem setor</option>
                  {setores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {processo.classification !== "pessoal" && (
              <Field label="Prioridade">
                <select style={styles.select} value={processo.priority} onChange={(e) => onUpdate({ priority: e.target.value })}>
                  {PRIORITIES.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {processo.classification !== "pessoal" && (
              <Field label="Responsável">
                <input
                  style={styles.input}
                  value={processo.responsible || ""}
                  onChange={(e) => onUpdate({ responsible: e.target.value })}
                  placeholder="Quem conduz este processo"
                  list="colaboradores-datalist"
                />
              </Field>
            )}
            {processo.classification !== "pessoal" && (
              <Field label="Prazo">
                <input type="date" style={styles.input} value={processo.dueDate || ""} onChange={(e) => onChangeDueDate(e.target.value)} />
              </Field>
            )}
            <Field label="Categoria (classificação)">
              <select style={styles.select} value={processo.classification || "simples"} onChange={(e) => onChangeClassification(e.target.value)}>
                <option value="simples">Simples</option>
                <option value="especial">Especial (número em vermelho)</option>
                <option value="pessoal">Pessoal (número em verde — não tramita entre setores)</option>
              </select>
              {processo.classification !== "pessoal" && processo.sectorId !== ADMINISTRATIVO_SECTOR_ID && (
                <div style={styles.attachHint}>Simples ↔ Especial só pode ser alterado no setor Administrativo. Virar Pessoal funciona de qualquer setor.</div>
              )}
            </Field>
            {processo.classification !== "pessoal" && (
              <Field label="Assunto">
                <select style={styles.select} value={processo.assuntoId || ""} onChange={(e) => onSetAssunto(e.target.value || null)}>
                  <option value="">Sem assunto</option>
                  {assuntos.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {processo.classification !== "pessoal" && (
            <Field label="Subprocesso de">
              <select
                className="no-print"
                style={styles.select}
                value={processo.parentId || NONE_PARENT}
                onChange={(e) => onSetParent(e.target.value === NONE_PARENT ? null : e.target.value)}
              >
                <option value={NONE_PARENT}>Processo independente</option>
                {linkableProcessos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} — {p.title}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {processo.classification !== "pessoal" && (
            <Field label="Responsáveis para notificação por e-mail">
              <div className="no-print" style={styles.emailChecklist}>
                {colaboradores.length === 0 && <div style={styles.emptySmall}>Cadastre colaboradores (com e-mail) na barra lateral para poder notificá-los.</div>}
                {colaboradores.map((c) => {
                  const checked = (processo.responsavelIds || []).includes(c.id);
                  return (
                    <label key={c.id} style={styles.emailCheckboxLabel}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const ids = new Set(processo.responsavelIds || []);
                          if (e.target.checked) ids.add(c.id);
                          else ids.delete(c.id);
                          onUpdate({ responsavelIds: Array.from(ids) });
                        }}
                      />
                      {c.name} {c.email ? <span style={styles.emailHint}>({c.email})</span> : <span style={styles.emailHintMissing}>(sem e-mail cadastrado)</span>}
                    </label>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Descrição">
            <div className="no-print">
              <RichFormatToolbar editorRef={descriptionRef} onChangeHtml={(html) => onUpdate({ description: html })} colaboradores={colaboradores} />
            </div>
            <RichEditor
              key={processo.id}
              editorRef={descriptionRef}
              initialValue={processo.description}
              onChangeHtml={(html) => onUpdate({ description: html })}
              placeholder="Descreva o que este processo trata."
              style={styles.richEditorBox}
            />
          </Field>
        </>
      ) : (
        <div style={styles.summaryBox}>
          <div style={styles.summaryTopRow}>
            <span style={styles.summaryTitle}>Resumo</span>
            {processo.archived ? (
              <span style={styles.archivedLockNote}>
                <Archive size={11} /> Arquivado — desarquive para editar
              </span>
            ) : (
              <button className="no-print" style={styles.editProcessBtnSmall} onClick={() => setEditMode(true)}>
                <Settings2 size={10} /> Editar
              </button>
            )}
          </div>

          <div style={styles.summaryList}>
            <div style={styles.summaryRow}>
              <span style={styles.summaryRowLabel}>Status</span>
              <span
                style={
                  statusMeta(processo.status, statuses).id === "nao_sera_realizado"
                    ? { ...styles.summaryValue, background: statusMeta(processo.status, statuses).color, color: "#000", padding: "2px 8px", borderRadius: 20 }
                    : styles.summaryValue
                }
              >
                <span style={{ ...styles.dot, background: statusMeta(processo.status, statuses).color }} /> {statusMeta(processo.status, statuses).label}
              </span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryRowLabel}>Setor</span>
              <span style={styles.summaryValue}>
                <span style={{ ...styles.dot, background: sectorColorForId(processo.sectorId, setores) }} /> {sectorLabel(processo.sectorId, setores)}
              </span>
            </div>
            <div style={styles.summaryRow}>
              <span style={styles.summaryRowLabel}>Prioridade</span>
              <span style={styles.summaryValue}>{PRIORITIES.find((pr) => pr.id === processo.priority)?.label}</span>
            </div>
            {processo.responsible && (
              <div style={styles.summaryRow}>
                <span style={styles.summaryRowLabel}>Responsável</span>
                <span style={styles.summaryValue}>{processo.responsible}</span>
              </div>
            )}
            {processo.dueDate && (
              <div style={styles.summaryRow}>
                <span style={styles.summaryRowLabel}>Prazo</span>
                <span style={styles.summaryValue}>{fmtDate(processo.dueDate)}</span>
              </div>
            )}
            <div style={styles.summaryRow}>
              <span style={styles.summaryRowLabel}>Categoria</span>
              <span style={{ ...styles.summaryValue, color: processo.classification === "especial" ? DANGER : INK }}>
                {processo.classification === "especial" ? "Especial" : "Simples"}
              </span>
            </div>
            {processo.assuntoId && assuntos.find((a) => a.id === processo.assuntoId) && (
              <div style={styles.summaryRow}>
                <span style={styles.summaryRowLabel}>Assunto</span>
                <span style={styles.summaryValue}>{assuntos.find((a) => a.id === processo.assuntoId).name}</span>
              </div>
            )}
          </div>

          {processo.description && (
            <div style={styles.summaryDescriptionWrap}>
              <div style={styles.fieldLabel}>Descrição</div>
              <div style={styles.summaryDescription}>{renderDescription(processo.description, colaboradores)}</div>
            </div>
          )}
        </div>
      )}

      {!processo.archived &&
        (processo.checklistEnabled ? (
          <ChecklistSection
            checklistName={processo.checklistName}
            checklist={processo.checklist || []}
            onAdd={onAddChecklistItem}
            onToggle={onToggleChecklistItem}
            onSetDeadline={onSetChecklistDeadline}
            onDelete={onDeleteChecklistItem}
            onRename={onRenameChecklist}
            onRemovePhoto={onRemoveChecklistPhoto}
            disabled={!!processo.pausedAt}
          />
        ) : (
          <button className="no-print" style={styles.enableChecklistBtn} onClick={onEnableChecklist}>
            <Zap size={14} /> Adicionar checklist a este processo
          </button>
        ))}

      {(processo.sectorId === ADMINISTRATIVO_SECTOR_ID || processo.classification === "pessoal") && !processo.archived && (
        <div className="no-print" style={styles.deadlinesPanel}>
          <div style={styles.deadlinesPanelHeader}>
            <Gavel size={13} />
            <span style={styles.timelineTitle}>Decisões do processo</span>
          </div>
          {(() => {
            const decisoes = processo.events.filter((e) => e.kind === "decisao");
            if (decisoes.length === 0) return <div style={styles.emptySmall}>Nenhuma decisão dada neste processo ainda.</div>;
            return decisoes.map((e) => {
              const encs = e.encaminhamentos || [];
              const temEncaminhamentos = e.decisionType !== "final" && encs.length > 0;
              const cumpridoPercent = temEncaminhamentos ? Math.round((encs.filter((it) => it.done).length / encs.length) * 100) : null;
              return (
                <div key={e.seq} style={{ ...styles.anularRow, opacity: e.anulada ? 0.5 : 1, flexWrap: "wrap" }}>
                  <span style={styles.taskRowNumber}>{plainNumber(e.seq)}</span>
                  <span style={styles.panelRowTitle}>
                    {e.decisionType === "final" ? "Decisão final" : "Decisão intermediária"}
                    {e.anulada ? " (anulada)" : ""}
                  </span>
                  {!e.anulada && temEncaminhamentos && (
                    <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                      <div style={{ width: 70, height: 6, background: BORDER, borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${cumpridoPercent}%`,
                            height: "100%",
                            background: cumpridoPercent === 100 ? SUCCESS_GREEN : cumpridoPercent > 0 ? WARNING_ORANGE : MUTED,
                          }}
                        />
                      </div>
                      {cumpridoPercent}% cumprida ({encs.filter((it) => it.done).length}/{encs.length} encaminhamentos)
                    </span>
                  )}
                  {!e.anulada && !temEncaminhamentos && e.decisionType === "final" && (
                    <select
                      style={{ ...styles.select, maxWidth: 160, fontSize: 12 }}
                      value={e.cumprimentoPercent != null ? e.cumprimentoPercent : ""}
                      onChange={(ev) => onUpdateEventFields(e.seq, { cumprimentoPercent: ev.target.value === "" ? null : Number(ev.target.value) })}
                    >
                      <option value="">Cumprimento: não avaliado</option>
                      <option value="0">Cumprimento: 0%</option>
                      <option value="25">Cumprimento: 25%</option>
                      <option value="50">Cumprimento: 50%</option>
                      <option value="75">Cumprimento: 75%</option>
                      <option value="100">Cumprimento: 100% (cumprida)</option>
                    </select>
                  )}
                  {!e.anulada &&
                    (confirmAnularSeq === e.seq ? (
                      <>
                        <span style={styles.deadlineTagOverdue}>Confirma?</span>
                        <button
                          style={styles.anularBtn}
                          onClick={() => {
                            onAnularDecisao(e.seq);
                            setConfirmAnularSeq(null);
                          }}
                        >
                          Sim, anular
                        </button>
                        <button style={styles.secondaryBtn} onClick={() => setConfirmAnularSeq(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <button style={styles.anularBtn} onClick={() => setConfirmAnularSeq(e.seq)}>
                        Anular
                      </button>
                    ))}
                </div>
              );
            });
          })()}
        </div>
      )}

      {subProcessos.length > 0 && (
        <div style={styles.subProcessSection}>
          <div style={styles.fieldLabel}>Subprocessos vinculados</div>
          {subProcessos.map((p) => (
            <button key={p.id} style={styles.subProcessRow} onClick={() => onSelectProcess(p.id)}>
              <span style={styles.taskRowNumber}>{p.number}</span> {p.title}
            </button>
          ))}
        </div>
      )}

      <div style={styles.timelineSection}>
        <div style={styles.timelineHeader}>
          <FileText size={15} color={MUTED} />
          <span style={styles.timelineTitle}>Andamentos</span>
          <span style={styles.timelineCount}>{processo.events.length} registrados</span>
        </div>

        {(() => {
          const { numberBySeq } = buildDisplayOrder(processo.events);
          const deadlineEvents = processo.events
            .filter((e) => e.kind === "evento" && e.deadline)
            .map((e) => {
              const lateEvent = processo.events.find((x) => x.kind === "vencimento" && x.replyTo === e.seq && x.cumprido === "atraso");
              return { e, info: deadlineInfo(e.deadline, now), lateEvent };
            })
            .sort((a, b) => new Date(a.e.deadline) - new Date(b.e.deadline));
          if (deadlineEvents.length === 0) return null;
          return (
            <div className="no-print" style={styles.deadlinesPanel}>
              <div style={styles.deadlinesPanelHeader}>
                <Clock size={13} color={ACCENT2} />
                <span style={styles.timelineTitle}>Prazos deste processo</span>
                <span style={styles.timelineCount}>{deadlineEvents.length}</span>
              </div>
              {deadlineEvents.map(({ e, info, lateEvent }) => (
                <button key={e.seq} style={styles.deadlinesPanelRowBtn} onClick={() => scrollToEvent(e.seq)}>
                  <span style={styles.taskRowNumber}>
                    {processo.number} · {numberBySeq[e.seq] || plainNumber(e.seq)}
                  </span>
                  <span style={styles.panelRowTitle}>{htmlToPlainText(e.description) || "(sem descrição)"}</span>
                  {lateEvent ? (
                    <span style={styles.deadlineTagWarning}>
                      Cumprido em atraso — {formatDuration(new Date(lateEvent.date).getTime() - new Date(e.deadline).getTime())}
                    </span>
                  ) : e.status === "realizado" ? (
                    <span style={styles.deadlineTagOk}>Cumprido no prazo</span>
                  ) : (
                    <span style={info.overdue ? styles.deadlineTagOverdue : info.urgent ? styles.deadlineTagUrgent : styles.deadlineTag}>
                      {fmtDateTime(e.deadline)} — {info.label}
                    </span>
                  )}
                </button>
              ))}
            </div>
          );
        })()}

        {(() => {
          const frozenEvents = processo.pausedAt ? [] : processo.events.filter((e) => e.kind === "evento" && e.deadlineFrozen);
          if (frozenEvents.length === 0) return null;
          return (
            <div className="no-print" style={styles.frozenPanel}>
              <div style={styles.deadlinesPanelHeader}>
                <Clock size={13} color="#92620A" />
                <span style={styles.timelineTitle}>Prazos para atualizar</span>
                <span style={styles.timelineCount}>{frozenEvents.length}</span>
              </div>
              <div style={styles.attachHint}>
                Estes andamentos tiveram o prazo congelado quando o processo foi parado. Defina o novo prazo de cada um pra retomar a
                contagem.
              </div>
              {frozenEvents.map((e) => (
                <div key={e.seq} style={styles.encaminhamentoRow}>
                  <span style={styles.taskRowNumber}>{plainNumber(e.seq)}</span>
                  <span style={styles.panelRowTitle}>{htmlToPlainText(e.description) || "(sem descrição)"}</span>
                  {updatingDeadlineSeq === e.seq ? (
                    <input
                      type="datetime-local"
                      autoFocus
                      style={styles.deadlineInput}
                      defaultValue=""
                      onBlur={(ev) => {
                        if (ev.target.value) {
                          onUpdateFrozenDeadline(e.seq, new Date(ev.target.value).toISOString());
                        }
                        setUpdatingDeadlineSeq(null);
                      }}
                    />
                  ) : (
                    <button style={styles.checklistDeadlineBtn} onClick={() => setUpdatingDeadlineSeq(e.seq)}>
                      <Clock size={13} /> Definir novo prazo
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })()}

        {processo.aguardaDecisao && (() => {
          const pendingAguarda = [...processo.events].reverse().find((e) => e.kind === "aguarda_decisao" && !e.resolvedBySeq);
          if (!pendingAguarda) return null;
          return (
            <div className="no-print" style={styles.deadlinesPanel}>
              <div style={styles.deadlinesPanelHeader}>
                <Clock size={13} color={WARNING_ORANGE} />
                <span style={styles.timelineTitle}>
                  Aguardando decisão {processo.aguardaDecisao === "final" ? "final" : "intermediária"}
                </span>
              </div>
              <button style={styles.deadlinesPanelRowBtn} onClick={() => scrollToEvent(pendingAguarda.seq)}>
                <span style={styles.taskRowNumber}>{plainNumber(pendingAguarda.seq)}</span>
                <span style={styles.panelRowTitle}>{htmlToPlainText(pendingAguarda.description) || "(sem descrição)"}</span>
              </button>
            </div>
          );
        })()}

        {(() => {
          const eventosOrcamento = processo.events.filter(
            (e) => e.kind === "orcamento" && (e.orcamentoType === "pedido_lista" || e.orcamentoType === "pesquisa_resposta")
          );
          if (eventosOrcamento.length === 0) return null;
          return (
            <div className="no-print" style={styles.deadlinesPanel}>
              <div style={styles.deadlinesPanelHeader}>
                <DollarSign size={13} />
                <span style={styles.timelineTitle}>Orçamentos e Compras</span>
                <span style={styles.timelineCount}>{eventosOrcamento.length}</span>
              </div>
              {eventosOrcamento.map((e) => {
                const orcInfoCard = (orcamentosLivroCaixa || []).find((o) => o.id === e.orcamentoDocId);
                const statusCard = orcInfoCard ? orcInfoCard.status : "pendente";
                const etapaLabel = e.orcamentoType === "pesquisa_resposta" ? "Pesquisas de preço" : "Pedido de orçamento";
                const statusLabel =
                  statusCard === "aprovado" ? "Aprovado" : statusCard === "recusado" ? "Recusado" : "Aguardando no Livro Caixa";
                const proximoPasso =
                  e.orcamentoType === "pedido_lista" && statusCard === "aprovado" && !e.pesquisasEnviadas
                    ? " — adicione pesquisas de preço"
                    : e.orcamentoType === "pesquisa_resposta" && statusCard === "aprovado" && !e.compraRegistradaSeq
                    ? " — registre a compra"
                    : e.compraRegistradaSeq
                    ? " — compra já registrada"
                    : "";
                return (
                  <button key={e.seq} style={styles.deadlinesPanelRowBtn} onClick={() => scrollToEvent(e.seq)}>
                    <span style={styles.taskRowNumber}>
                      {orcInfoCard && orcInfoCard.numero ? `nº ${orcInfoCard.numero}` : plainNumber(e.seq)}
                    </span>
                    <span style={styles.panelRowTitle}>
                      {etapaLabel} — {statusLabel}
                      {proximoPasso}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })()}

        {(() => {
          const { numberBySeq: numberBySeq2 } = buildDisplayOrder(processo.events);
          const eventosComStatus = processo.events.filter((e) => e.kind === "evento" && e.status && e.status !== "realizado");
          const statusPresentes = EVENT_STATUSES.filter((s) => eventosComStatus.some((e) => e.status === s.id));
          if (statusPresentes.length === 0) return null;
          return statusPresentes.map((statusDef) => {
            const eventosDoStatus = eventosComStatus.filter((e) => e.status === statusDef.id);
            return (
              <div key={statusDef.id} className="no-print" style={styles.deadlinesPanel}>
                <div style={styles.deadlinesPanelHeader}>
                  <span style={{ ...styles.dot, background: statusDef.dot }} />
                  <span style={styles.timelineTitle}>{statusDef.label}</span>
                  <span style={styles.timelineCount}>{eventosDoStatus.length}</span>
                </div>
                {eventosDoStatus.map((e) => (
                  <button key={e.seq} style={styles.deadlinesPanelRowBtn} onClick={() => scrollToEvent(e.seq)}>
                    <span style={styles.taskRowNumber}>
                      {processo.number} · {numberBySeq2[e.seq] || plainNumber(e.seq)}
                    </span>
                    <span style={styles.panelRowTitle}>{htmlToPlainText(e.description) || "(sem descrição)"}</span>
                  </button>
                ))}
              </div>
            );
          });
        })()}

        {!replyingTo && !hasEventoUrgente && renderComposer()}
        {!replyingTo && hasEventoUrgente && (
          <div style={{ ...styles.pauseCheckboxLabel, marginBottom: 12 }}>
            🔥 Esse processo tem um andamento marcado como <strong>FAZER URGENTE</strong>. Responda ele primeiro (botão "Responder" no
            andamento nº {plainNumber(eventoUrgente.seq)}, mais abaixo) — os outros ficam disponíveis de novo assim que esse for
            resolvido.
          </div>
        )}

        <div style={styles.timeline}>
          {processo.events.length === 0 && <div style={styles.emptySmall}>Nenhum andamento registrado. Adicione o primeiro acima.</div>}
          {(() => {
            const { order, numberBySeq } = buildDisplayOrder(processo.events, collapsedThreads, highlightEventSeq);
            const totalRoots = order.filter((o) => o.depth === 0).length;
            let rootsSeen = 0;
            let cutIndex = order.length;
            for (let i = 0; i < order.length; i++) {
              if (order[i].depth === 0) {
                rootsSeen++;
                if (rootsSeen > visibleRootCount) {
                  cutIndex = i;
                  break;
                }
              }
            }
            const visibleOrder = order.slice(0, cutIndex);
            const hasMore = totalRoots > visibleRootCount;
            return (
              <>
                {visibleOrder.map(({ event: ev, number, depth, descendantCount, isCollapsed }, idx) => {
            const isTransfer = ev.kind === "transferencia";
            const isVencimento = ev.kind === "vencimento";
            const isDecision = ev.kind === "decisao";
            const isDecisionFinal = isDecision && ev.decisionType === "final";
            const isOrcamento = ev.kind === "orcamento";
            const isAguardaDecisao = ev.kind === "aguarda_decisao";
            const isAutoLog = ev.kind === "evento" && ev.auto === true;
            const isSystem = isTransfer || isVencimento || isAutoLog;
            const isEvento = ev.kind === "evento" && !isAutoLog;
            const hasStatus = isEvento && !!ev.status;
            const parent = ev.replyTo ? processo.events.find((e) => e.seq === ev.replyTo) : null;
            const evMeta = ev.status ? eventStatusMeta(ev.status) : null;
            const dInfo = !isSystem && ev.deadline ? deadlineInfo(ev.deadline, now) : null;
            const badgeBg = isTransfer || isAutoLog
              ? MUTED
              : isVencimento
              ? ev.cumprido === true
                ? SUCCESS_GREEN
                : ev.cumprido === "atraso"
                ? WARNING_ORANGE
                : DANGER
              : isDecisionFinal
              ? INK
              : isDecision
              ? "#6D28D9"
              : isAguardaDecisao
              ? INK
              : isOrcamento
              ? ACCENT2
              : ev.replyTo
              ? BADGE_BLUE_LIGHT
              : ACCENT2;
            return (
              <div
                key={ev.seq}
                id={`event-${processo.id}-${ev.seq}`}
                ref={(el) => {
                  if (el && highlightEventSeq === ev.seq && scrolledToSeqRef.current !== ev.seq) {
                    scrolledToSeqRef.current = ev.seq;
                    requestAnimationFrame(() => el.scrollIntoView({ behavior: "smooth", block: "center" }));
                  }
                }}
                style={{
                  ...styles.timelineItem,
                  marginLeft: depth * 26,
                  ...(depth > 0 ? styles.timelineItemReplyBg : {}),
                  ...(highlightedSeq === ev.seq ? styles.timelineItemHighlighted : {}),
                }}
              >
                <div style={styles.timelineMarkerCol}>
                  {!isSystem ? (
                    <div
                      style={{
                        ...styles.timelineBadge,
                        ...styles.timelineBadgeSized(number),
                        background: badgeBg,
                        color: contrastTextColor(badgeBg),
                        cursor: "pointer",
                      }}
                      title="Clique para excluir este andamento"
                      onClick={() => setConfirmDeleteEventSeq((cur) => (cur === ev.seq ? null : ev.seq))}
                    >
                      {number}
                    </div>
                  ) : (
                    <div style={{ ...styles.timelineBadge, ...styles.timelineBadgeSized(number), background: badgeBg, color: contrastTextColor(badgeBg) }}>{number}</div>
                  )}
                  {idx < order.length - 1 && <div style={styles.timelineLine} />}
                </div>
                <div style={styles.timelineContent}>
                  <div style={styles.timelineTopRow}>
                    {ev.sectorAtTime && (
                      <span style={styles.timelineSectorTag}>{sectorLabel(ev.sectorAtTime, setores).toUpperCase()}</span>
                    )}
                    <div style={styles.timelineDate}>
                      <Clock size={11} /> {fmtDateTime(ev.date)}
                    </div>
                    {ev.authorName && <span style={styles.timelineDate}>· {ev.authorName}</span>}
                    {ev.edited && ev.editHistory && ev.editHistory.length > 0 && (
                      <button
                        className="no-print"
                        style={styles.editedTag}
                        onClick={() => setShowEditHistorySeq(showEditHistorySeq === ev.seq ? null : ev.seq)}
                      >
                        (editado · ver histórico)
                      </button>
                    )}
                    {now - new Date(ev.date).getTime() < 48 * 60 * 60 * 1000 && <span style={styles.newTag}>Novo</span>}
                    {hasStatus &&
                      (openStatusSeq === ev.seq ? (
                        <>
                          <span style={styles.eventStatusPillBig(evMeta.dot, evMeta.id === "fazer_urgente" ? "#FDE047" : undefined)}>
                            {evMeta.label}
                          </span>
                          <select
                            style={styles.statusMiniSelect}
                            value={ev.status}
                            onChange={(e) => {
                              if (e.target.value === "execucao_travada") {
                                onRequestPrereqPicker(ev.seq);
                              } else {
                                onUpdateEventStatus(ev.seq, e.target.value || null);
                              }
                              setOpenStatusSeq(null);
                            }}
                          >
                            <option value="">Sem status (remover)</option>
                            {EVENT_STATUSES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button className="no-print" style={styles.statusCollapseBtn} onClick={() => setOpenStatusSeq(null)} title="Fechar (sem mudar nada)">
                            <X size={11} />
                          </button>
                        </>
                      ) : (
                        <button
                          style={styles.eventStatusPillBig(evMeta.dot, evMeta.id === "fazer_urgente" ? "#FDE047" : undefined)}
                          onClick={() => setOpenStatusSeq(ev.seq)}
                          title="Clique para alterar o status"
                        >
                          <span style={{ ...styles.dot, background: "#fff", width: 6, height: 6 }} />
                          {evMeta.label}
                        </button>
                      ))}
                    {isEvento &&
                      !hasStatus &&
                      (openStatusSeq === ev.seq ? (
                        <>
                          <select
                            style={styles.statusMiniSelect}
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value === "execucao_travada") {
                                onRequestPrereqPicker(ev.seq);
                                setOpenStatusSeq(null);
                              } else if (e.target.value) {
                                onUpdateEventStatus(ev.seq, e.target.value);
                                setOpenStatusSeq(null);
                              }
                            }}
                          >
                            <option value="" disabled>
                              Escolher status…
                            </option>
                            {EVENT_STATUSES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>
                          <button className="no-print" style={styles.statusCollapseBtn} onClick={() => setOpenStatusSeq(null)} title="Fechar">
                            <X size={11} />
                          </button>
                        </>
                      ) : (
                        <button className="no-print" style={styles.addStatusGhostBtn} onClick={() => setOpenStatusSeq(ev.seq)}>
                          + Status
                        </button>
                      ))}
                    {isVencimento && (
                      <AlertCircle size={13} color={ev.cumprido === true ? SUCCESS_GREEN : ev.cumprido === "atraso" ? WARNING_ORANGE : DANGER} />
                    )}
                  </div>

                  {parent && (
                    <div style={styles.replyTag}>
                      <Reply size={11} /> Resposta ao andamento {numberBySeq[parent.seq] || padNumber(parent.seq)}
                    </div>
                  )}

                  {editingEventSeq === ev.seq ? (
                    <div className="no-print" style={styles.eventEditBox}>
                      <RichFormatToolbar
                        editorRef={editEventRef}
                        onChangeHtml={(html) => {
                          setEditDraft(html);
                          saveDraftToStorage(processo.id, `edit-${ev.seq}`, html);
                        }}
                        colaboradores={colaboradores}
                      />
                      <RichEditor
                        key={"edit-" + ev.seq}
                        editorRef={editEventRef}
                        initialValue={editDraft || ev.description}
                        onChangeHtml={(html) => {
                          setEditDraft(html);
                          saveDraftToStorage(processo.id, `edit-${ev.seq}`, html);
                        }}
                        style={styles.richEditorBoxComposer}
                      />
                      <div style={styles.deadlineComposerRow}>
                        <label style={styles.deadlineComposerLabel}>
                          <Clock size={12} /> Prazo
                        </label>
                        <input
                          type="datetime-local"
                          style={styles.deadlineInput}
                          value={editDeadlineDraft}
                          onChange={(e) => setEditDeadlineDraft(e.target.value)}
                        />
                        {editDeadlineDraft && (
                          <button style={styles.pendingAttachmentRemove} onClick={() => setEditDeadlineDraft("")} title="Remover prazo">
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {colaboradores.length > 0 && (
                        <div style={styles.deadlineComposerRow}>
                          <label style={styles.deadlineComposerLabel}>
                            <Users size={12} /> Demandado a
                          </label>
                          <select style={styles.composerStatusSelect} value={editAssignedToDraft} onChange={(e) => setEditAssignedToDraft(e.target.value)}>
                            <option value="">Ninguém em especial</option>
                            {colaboradores.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {editAssignedToDraft && (
                        <div style={styles.deadlineComposerRow}>
                          <label style={styles.deadlineComposerLabel}>Isso é um pedido de resposta?</label>
                          <select style={styles.composerStatusSelect} value={editIsPedidoRespostaDraft} onChange={(e) => setEditIsPedidoRespostaDraft(e.target.value)}>
                            <option value="sim">Sim — preciso que essa pessoa responda</option>
                            <option value="nao">Não — só preciso que ela execute (aguarda execução)</option>
                          </select>
                        </div>
                      )}
                      <div style={styles.composerSubmitRow}>
                        <span />
                        <span style={{ display: "flex", gap: 8 }}>
                          <button
                            style={styles.secondaryBtn}
                            onClick={() => {
                              clearDraft(processo.id, `edit-${ev.seq}`);
                              setEditingEventSeq(null);
                            }}
                          >
                            Cancelar
                          </button>
                          <button
                            style={styles.addEventBtn}
                            onClick={() => {
                              const ficouDemandadoAgora = editAssignedToDraft && editAssignedToDraft !== ev.assignedToId;
                              onUpdateEventFields(ev.seq, {
                                description: editDraft,
                                deadline: editDeadlineDraft ? new Date(editDeadlineDraft).toISOString() : null,
                                assignedToId: editAssignedToDraft || null,
                                ...(ficouDemandadoAgora
                                  ? { status: editIsPedidoRespostaDraft === "nao" ? "aguarda" : "aguardando_resposta" }
                                  : {}),
                              });
                              clearDraft(processo.id, `edit-${ev.seq}`);
                              setEditingEventSeq(null);
                            }}
                          >
                            Salvar
                          </button>
                        </span>
                      </div>
                    </div>
                  ) : isDecision ? (
                    <div style={isDecisionFinal ? styles.decisionBoxFinal : styles.decisionBoxIntermediaria}>
                      <div style={isDecisionFinal ? styles.decisionHeaderFinal : styles.decisionHeaderIntermediaria}>
                        <span aria-hidden="true" style={styles.decisionSymbol}>⚜️</span>
                        {isDecisionFinal ? "Decisão final" : "Decisão intermediária"}
                        {ev.anulada && <span style={styles.anuladaTag}>ANULADA</span>}
                      </div>
                      <div style={{ ...(isDecisionFinal ? styles.decisionTextFinal : styles.decisionTextIntermediaria), ...(ev.anulada ? styles.textAnulado : {}) }}>
                        {renderDescription(ev.description, colaboradores)}
                      </div>
                      {ev.encaminhamentos && ev.encaminhamentos.length > 0 && (
                        <div style={styles.encaminhamentosList}>
                          {ev.encaminhamentos.map((it) => {
                            const itInfo = it.deadline ? deadlineInfo(it.deadline, now) : null;
                            return (
                              <div key={it.id} style={styles.encaminhamentoRow}>
                                <span style={styles.taskRowNumber}>{it.seq}</span>
                                <div style={styles.encaminhamentoTextCol}>
                                  <span style={it.done ? styles.encaminhamentoTextDone : styles.checklistText}>
                                    {it.done && <CheckCircle2 size={13} color={SUCCESS_GREEN} style={{ verticalAlign: "middle", marginRight: 4 }} />}
                                    {it.text}
                                  </span>
                                  {it.deadline && !it.done && (
                                    <span style={itInfo.overdue ? styles.deadlineTagOverdue : itInfo.urgent ? styles.deadlineTagUrgent : styles.deadlineTag}>
                                      Prazo: {fmtDateTime(it.deadline)} — {itInfo.label}
                                    </span>
                                  )}
                                  {it.done && it.respondidoEmSeq && (
                                    <span style={styles.deadlineTag}>Respondido no andamento nº {plainNumber(it.respondidoEmSeq)}</span>
                                  )}
                                </div>
                                {!it.done && !ev.anulada && (
                                  <button
                                    className="no-print"
                                    style={styles.checklistDeadlineBtn}
                                    onClick={() => {
                                      setPendingEncItem({ decisionSeq: ev.seq, itemId: it.id, itemSeq: it.seq });
                                      handleReply(ev.seq);
                                    }}
                                  >
                                    Responder
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ) : isAguardaDecisao ? (
                    <div style={styles.aguardaDecisaoPlainText}>{ev.description}</div>
                  ) : isOrcamento && ev.orcamentoType === "pedido_lista" ? (
                    (() => {
                      const itensLista = ev.itens || [];
                      const orcInfo = (orcamentosLivroCaixa || []).find((o) => o.id === ev.orcamentoDocId);
                      const statusLC = orcInfo ? orcInfo.status : "pendente";
                      return (
                        <div style={styles.orcamentoBoxFor(null, "pedido")}>
                          <div style={styles.orcamentoHeaderFor(null, "pedido")}>
                            <DollarSign size={13} />
                            Pedido de orçamento{orcInfo && orcInfo.numero ? ` nº ${orcInfo.numero}` : ""} (Livro Caixa) — {itensLista.length}{" "}
                            item(ns)
                            {statusLC === "aprovado" ? (
                              <span style={styles.aprovacaoTagOk}>APROVADO</span>
                            ) : statusLC === "recusado" ? (
                              <span style={styles.aprovacaoTagNo}>RECUSADO</span>
                            ) : statusLC === "adiado" ? (
                              <span style={styles.aprovacaoTagAguardando}>ADIADO</span>
                            ) : (
                              <span style={styles.aprovacaoTagAguardando}>AGUARDANDO NO LIVRO CAIXA</span>
                            )}
                          </div>
                          <div style={styles.orcamentoMeta}>
                            {itensLista.map((it, i) => (
                              <div key={i}>
                                {it.descricao} — {(it.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </div>
                            ))}
                          </div>
                          <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>
                            Total: {(ev.valorTotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </div>
                          {ev.description && <div style={styles.orcamentoText}>{renderDescription(ev.description, colaboradores)}</div>}
                          {ev.driveLink && (
                            <div style={styles.attachmentsRow}>
                              <a href={ev.driveLink} target="_blank" rel="noreferrer" style={styles.attachmentFileChip}>
                                <Link2 size={12} /> Ver documento/fotos no Google Drive
                              </a>
                            </div>
                          )}
                          {orcInfo && orcInfo.resposta && (
                            <div style={{ ...styles.attachHint, marginTop: 8, fontStyle: "italic" }}>Resposta do Financeiro: "{orcInfo.resposta}"</div>
                          )}
                          {statusLC === "recusado" && orcInfo && orcInfo.motivoRecusa && (
                            <div style={{ ...styles.attachHint, marginTop: 8, color: DANGER }}>Motivo da recusa: {orcInfo.motivoRecusa}</div>
                          )}
                          {orcInfo && orcInfo.detalhesCompra && (
                            <div style={{ ...styles.attachHint, marginTop: 8 }}>
                              Detalhes da compra aprovada: {orcInfo.detalhesCompra.loja ? `${orcInfo.detalhesCompra.loja} — ` : ""}
                              {orcInfo.detalhesCompra.descricao}
                              {orcInfo.detalhesCompra.valor ? ` — ${orcInfo.detalhesCompra.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : ""}
                              {orcInfo.detalhesCompra.link && (
                                <>
                                  {" — "}
                                  <a href={orcInfo.detalhesCompra.link} target="_blank" rel="noreferrer">
                                    link
                                  </a>
                                </>
                              )}
                            </div>
                          )}

                          {statusLC === "aprovado" && !ev.pesquisasEnviadas && (
                            <div className="no-print" style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                              <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>
                                Pesquisas de preço ({(ev.pesquisas || []).length})
                              </div>
                              {(ev.pesquisas || []).length === 0 && (
                                <div style={{ ...styles.attachHint, marginBottom: 8 }}>
                                  Nenhuma pesquisa adicionada ainda. Vá anexando aqui conforme for cotando (PDF no Drive, link de site,
                                  etc.).
                                </div>
                              )}
                              {(ev.pesquisas || []).map((pq) => (
                                <div key={pq.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, marginBottom: 4 }}>
                                  <a href={pq.link} target="_blank" rel="noreferrer" style={styles.orcamentoLink}>
                                    {pq.loja ? `${pq.loja} — ` : ""}
                                    {pq.descricao || pq.link}
                                  </a>
                                  {pq.valor > 0 && <span>— {pq.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</span>}
                                </div>
                              ))}
                              {addingPesquisaSeq === ev.seq ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                                  <input
                                    style={styles.input}
                                    placeholder="Loja / fornecedor"
                                    value={novaPesquisaLoja}
                                    onChange={(e) => setNovaPesquisaLoja(e.target.value)}
                                  />
                                  <input
                                    style={styles.input}
                                    placeholder="Descrição (ex.: modelo, condições)"
                                    value={novaPesquisaDescricao}
                                    onChange={(e) => setNovaPesquisaDescricao(e.target.value)}
                                  />
                                  <input
                                    style={styles.input}
                                    placeholder="Link (Google Drive, site, etc.)"
                                    value={novaPesquisaLink}
                                    onChange={(e) => setNovaPesquisaLink(e.target.value)}
                                  />
                                  <input
                                    style={styles.input}
                                    placeholder="Valor cotado (opcional)"
                                    inputMode="decimal"
                                    value={novaPesquisaValor}
                                    onChange={(e) => setNovaPesquisaValor(e.target.value)}
                                  />
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                      style={styles.addEventBtn}
                                      onClick={() => {
                                        if (!novaPesquisaLink.trim()) return;
                                        const nova = {
                                          id: uid(),
                                          loja: novaPesquisaLoja.trim(),
                                          descricao: novaPesquisaDescricao.trim(),
                                          link: novaPesquisaLink.trim(),
                                          valor: parseFloat(novaPesquisaValor.replace(",", ".")) || 0,
                                          addedAt: new Date().toISOString(),
                                        };
                                        onUpdateEventFields(ev.seq, { pesquisas: [...(ev.pesquisas || []), nova] });
                                        setNovaPesquisaLoja("");
                                        setNovaPesquisaDescricao("");
                                        setNovaPesquisaLink("");
                                        setNovaPesquisaValor("");
                                        setAddingPesquisaSeq(null);
                                      }}
                                    >
                                      Adicionar
                                    </button>
                                    <button style={styles.secondaryBtn} onClick={() => setAddingPesquisaSeq(null)}>
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button className="no-print" style={styles.secondaryBtn} onClick={() => setAddingPesquisaSeq(ev.seq)}>
                                  + Adicionar pesquisa
                                </button>
                              )}
                              {(ev.pesquisas || []).length > 0 && (
                                <button
                                  className="no-print"
                                  style={{ ...styles.addEventBtn, marginTop: 10 }}
                                  onClick={() => onEnviarPesquisasParaAprovacao(ev.seq)}
                                >
                                  Enviar pesquisas para aprovação do Financeiro
                                </button>
                              )}
                            </div>
                          )}
                          {ev.pesquisasEnviadas && (
                            <div style={{ ...styles.attachHint, marginTop: 10 }}>
                              Pesquisas enviadas pro Financeiro decidir — veja o andamento de resposta abaixo.
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : isOrcamento && ev.orcamentoType === "pesquisa_resposta" ? (
                    (() => {
                      const itensPesquisa = ev.itens || [];
                      const orcInfo2 = (orcamentosLivroCaixa || []).find((o) => o.id === ev.orcamentoDocId);
                      const statusLC2 = orcInfo2 ? orcInfo2.status : "pendente";
                      return (
                        <div style={styles.orcamentoBoxFor(null, "pedido")}>
                          <div style={styles.orcamentoHeaderFor(null, "pedido")}>
                            <DollarSign size={13} />
                            Pesquisas de preço enviadas{orcInfo2 && orcInfo2.numero ? ` (nº ${orcInfo2.numero})` : ""} — {itensPesquisa.length}{" "}
                            opção(ões)
                            {statusLC2 === "aprovado" ? (
                              <span style={styles.aprovacaoTagOk}>APROVADO</span>
                            ) : statusLC2 === "recusado" ? (
                              <span style={styles.aprovacaoTagNo}>RECUSADO</span>
                            ) : (
                              <span style={styles.aprovacaoTagAguardando}>AGUARDANDO NO LIVRO CAIXA</span>
                            )}
                          </div>
                          <div style={styles.orcamentoMeta}>
                            {itensPesquisa.map((it, i) => (
                              <div key={i}>
                                {it.descricao} — {(it.valor || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                              </div>
                            ))}
                          </div>

                          {statusLC2 === "aprovado" && !ev.compraRegistradaSeq && (
                            <div className="no-print" style={{ marginTop: 12, borderTop: "1px solid rgba(0,0,0,0.08)", paddingTop: 10 }}>
                              <div style={{ fontWeight: 700, fontSize: 12.5, marginBottom: 6 }}>Registrar compra</div>
                              {registrandoCompraSeq === ev.seq ? (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <input
                                    style={styles.input}
                                    placeholder="O que foi comprado"
                                    value={compraDescricao}
                                    onChange={(e) => setCompraDescricao(e.target.value)}
                                  />
                                  <input
                                    style={styles.input}
                                    placeholder="Fornecedor/loja"
                                    value={compraFornecedor}
                                    onChange={(e) => setCompraFornecedor(e.target.value)}
                                  />
                                  <input
                                    style={styles.input}
                                    placeholder="Valor pago (R$)"
                                    inputMode="decimal"
                                    value={compraValor}
                                    onChange={(e) => setCompraValor(e.target.value)}
                                  />
                                  <input
                                    style={styles.input}
                                    placeholder="Número da nota fiscal (opcional)"
                                    value={compraNotaFiscal}
                                    onChange={(e) => setCompraNotaFiscal(e.target.value)}
                                  />
                                  <label style={styles.markConcludedLabel}>
                                    <input type="checkbox" checked={compraEhAtivo} onChange={(e) => setCompraEhAtivo(e.target.checked)} />
                                    É um objeto físico — incluir em Ativos Patrimoniais (Livro Caixa)
                                  </label>
                                  <div style={{ display: "flex", gap: 8 }}>
                                    <button
                                      style={styles.addEventBtn}
                                      onClick={() => {
                                        if (!compraValor.trim()) return;
                                        onRegistrarCompra(ev.seq, {
                                          descricao: compraDescricao.trim() || itensPesquisa[0]?.descricao || "",
                                          fornecedor: compraFornecedor.trim(),
                                          valor: parseFloat(compraValor.replace(",", ".")) || 0,
                                          notaFiscal: compraNotaFiscal.trim(),
                                          ehAtivo: compraEhAtivo,
                                        });
                                        setCompraDescricao("");
                                        setCompraFornecedor("");
                                        setCompraValor("");
                                        setCompraNotaFiscal("");
                                        setCompraEhAtivo(false);
                                        setRegistrandoCompraSeq(null);
                                      }}
                                    >
                                      Confirmar compra
                                    </button>
                                    <button style={styles.secondaryBtn} onClick={() => setRegistrandoCompraSeq(null)}>
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button className="no-print" style={styles.addEventBtn} onClick={() => setRegistrandoCompraSeq(ev.seq)}>
                                  Registrar compra realizada
                                </button>
                              )}
                            </div>
                          )}
                          {ev.compraRegistradaSeq && (
                            <div style={{ ...styles.attachHint, marginTop: 10, fontWeight: 600 }}>
                              ✓ Compra registrada — enviada pro Livro Caixa como Conta a Pagar
                              {ev.compraEhAtivo ? " e como pendente de cadastro em Ativos Patrimoniais" : ""}.
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : isOrcamento ? (
                    <div style={styles.orcamentoBoxFor(ev.flowType, ev.orcamentoType)}>
                      <div style={styles.orcamentoHeaderFor(ev.flowType, ev.orcamentoType)}>
                        <DollarSign size={13} />
                        {ev.orcamentoType === "opcao"
                          ? `Resposta ${ev.flowType === "os" ? "à Ordem de Serviço" : "ao Pedido Orçamento"} ${ev.globalNumero || ""} — Item ${ev.itemNumero ?? "?"}`
                          : `Pedido de ${ev.flowType === "os" ? "Ordem de Serviço" : "Orçamento"} ${ev.globalNumero || ""}`}
                        {ev.aprovacao && (
                          <span style={ev.aprovacao === "aprovado" ? styles.aprovacaoTagOk : styles.aprovacaoTagNo}>
                            {ev.aprovacao === "aprovado" ? "APROVADO" : "REJEITADO"}
                          </span>
                        )}
                      </div>
                      {ev.orcamentoType === "opcao" ? (
                        <div style={styles.orcamentoMeta}>
                          {ev.loja && <span>Loja: {ev.loja}</span>}
                          {ev.preco && <span>Preço: R$ {Number(ev.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                          {ev.link && (
                            <a href={ev.link} target="_blank" rel="noreferrer" style={styles.orcamentoLink}>
                              Ver link
                            </a>
                          )}
                        </div>
                      ) : (
                        (ev.fornecedor || ev.valor) && (
                          <div style={styles.orcamentoMeta}>
                            {ev.fornecedor && <span>{ev.flowType === "os" ? "Responsável" : "Fornecedor"}: {ev.fornecedor}</span>}
                            {ev.valor && <span>Valor estimado: R$ {Number(ev.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>}
                          </div>
                        )
                      )}
                      {ev.description && <div style={styles.orcamentoText}>{renderDescription(ev.description, colaboradores)}</div>}
                      {ev.orcamentoType === "opcao" &&
                        !ev.aprovacao &&
                        ((ev.flowType === "os" && processo.sectorId === MANUTENCAO_SECTOR_ID) ||
                          (ev.flowType !== "os" && processo.sectorId === FINANCEIRO_SECTOR_ID)) && (
                          <div className="no-print" style={styles.aprovacaoRow}>
                            <button style={styles.aprovarBtn} onClick={() => onAprovarRejeitar(ev.seq, "aprovado")}>
                              Aprovar
                            </button>
                            <button style={styles.rejeitarBtn} onClick={() => onAprovarRejeitar(ev.seq, "rejeitado")}>
                              Rejeitar
                            </button>
                          </div>
                        )}
                    </div>
                  ) : (
                    <div
                      style={{
                        ...(isVencimento
                          ? ev.cumprido === true
                            ? styles.timelineTextSuccess
                            : ev.cumprido === "atraso"
                            ? styles.timelineTextWarning
                            : styles.timelineTextDanger
                          : isTransfer || isAutoLog
                          ? styles.timelineTextMuted
                          : ev.replyTo
                          ? styles.timelineTextReply
                          : styles.timelineText),
                        ...(ev.subTipoPessoal
                          ? {
                              background:
                                ev.subTipoPessoal === "elia"
                                  ? "rgba(255, 105, 180, 0.16)"
                                  : ev.subTipoPessoal === "jean"
                                  ? "rgba(59, 130, 246, 0.16)"
                                  : "linear-gradient(90deg, rgba(255,105,180,0.16) 0%, rgba(255,105,180,0.16) 50%, rgba(59,130,246,0.16) 50%, rgba(59,130,246,0.16) 100%)",
                              borderLeft: `4px solid ${ev.subTipoPessoal === "elia" ? "#FF69B4" : ev.subTipoPessoal === "jean" ? "#3B82F6" : "#A855F7"}`,
                              borderRadius: 6,
                              padding: "8px 10px",
                            }
                          : {}),
                      }}
                    >
                      {ev.subTipoPessoal && (
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4, opacity: 0.75 }}>
                          {ev.subTipoPessoal === "elia" ? "Decisão da Elia" : ev.subTipoPessoal === "jean" ? "Decisão do Jean" : "Decisão dos dois"}
                        </div>
                      )}
                      {renderDescription(ev.description, colaboradores)}
                    </div>
                  )}

                  {showEditHistorySeq === ev.seq && ev.editHistory && ev.editHistory.length > 0 && (
                    <div className="no-print" style={styles.editHistoryBox}>
                      <div style={styles.editHistoryTitle}>Versões anteriores deste andamento</div>
                      {[...ev.editHistory].reverse().map((h, i) => (
                        <div key={i} style={styles.editHistoryEntry}>
                          <div style={styles.editHistoryDate}>{fmtDateTime(h.editedAt)}</div>
                          <div style={styles.editHistoryText}>{renderDescription(h.description, colaboradores)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {dInfo && (
                    <div style={dInfo.overdue ? styles.deadlineTagOverdue : dInfo.urgent ? styles.deadlineTagUrgent : styles.deadlineTag}>
                      <Clock size={11} /> Prazo: {fmtDateTime(ev.deadline)} — {dInfo.label}
                    </div>
                  )}

                  {ev.assignedToId && (
                    <div style={styles.deadlineTag}>
                      <Users size={11} /> Demandado a: {(colaboradores.find((c) => c.id === ev.assignedToId) || {}).name || "—"}
                    </div>
                  )}

                  {ev.attachments && ev.attachments.length > 0 && (
                    <div style={styles.attachmentsRow}>
                      {ev.attachments.map((a) =>
                        a.type === "image" ? (
                          <a key={a.id} href={a.dataUrl} target="_blank" rel="noreferrer" title={a.name}>
                            <img src={a.dataUrl} alt={a.name} style={styles.attachmentThumb} />
                          </a>
                        ) : a.type === "link" ? (
                          <a key={a.id} href={a.dataUrl} target="_blank" rel="noreferrer" style={styles.attachmentFileChip} title={a.name}>
                            <FileText size={12} /> {a.name}
                          </a>
                        ) : (
                          <a key={a.id} href={a.dataUrl} download={a.name} style={styles.attachmentFileChip} title={a.name}>
                            <FileText size={12} /> {a.name}
                          </a>
                        )
                      )}
                    </div>
                  )}

                  {ev.driveLink && (
                    <div style={styles.attachmentsRow}>
                      <a href={ev.driveLink} target="_blank" rel="noreferrer" style={styles.attachmentFileChip}>
                        <Link2 size={12} /> Ver fotos no Google Drive
                      </a>
                    </div>
                  )}

                  {ev.votantesIds && ev.votantesIds.length > 0 && (() => {
                    const votos = ev.votos || {};
                    const meuColaborador = currentUser ? colaboradores.find((c) => c.name === currentUser.name) : null;
                    const souVotante = meuColaborador && ev.votantesIds.includes(meuColaborador.id);
                    const jaVotei = meuColaborador && votos[meuColaborador.id];
                    return (
                      <div className="no-print" style={{ ...styles.attachHint, background: "rgba(0,0,0,0.03)", borderRadius: 8, padding: 10, marginTop: 6 }}>
                        <div style={{ fontWeight: 600, marginBottom: 6 }}>
                          Votação: {Object.keys(votos).length}/{ev.votantesIds.length} votaram
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, marginBottom: souVotante && !jaVotei ? 8 : 0 }}>
                          {ev.votantesIds.map((cid) => {
                            const colab = colaboradores.find((c) => c.id === cid);
                            const voto = votos[cid];
                            return (
                              <span key={cid} style={{ fontSize: 12.5 }}>
                                {colab ? colab.name : "—"}:{" "}
                                {voto === "aprovar" ? "✅ Aprovou" : voto === "rejeitar" ? "❌ Rejeitou" : "⏳ Aguardando"}
                              </span>
                            );
                          })}
                        </div>
                        {souVotante && !jaVotei && (ev.status === "em_votacao") && (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              style={{ ...styles.addEventBtn, padding: "5px 12px", fontSize: 12.5 }}
                              onClick={() => onRegisterVote(ev.seq, meuColaborador.id, "aprovar")}
                            >
                              Aprovar
                            </button>
                            <button
                              style={{ ...styles.secondaryBtn, padding: "5px 12px", fontSize: 12.5, color: DANGER }}
                              onClick={() => onRegisterVote(ev.seq, meuColaborador.id, "rejeitar")}
                            >
                              Rejeitar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {!isSystem && editingEventSeq !== ev.seq && (!hasEventoUrgente || ev.seq === eventoUrgente.seq) && (
                    <span style={styles.eventActionsRow}>
                      <button className="no-print" style={styles.replyBtn} onClick={() => handleReply(ev.seq)}>
                        <Reply size={14} /> Responder
                      </button>
                      {!isAguardaDecisao && (
                        <button
                          className="no-print"
                          style={styles.editEventBtn}
                          onClick={() => {
                            setEditingEventSeq(ev.seq);
                            const rascunho = loadDraft(processo.id, `edit-${ev.seq}`);
                            setEditDraft(rascunho || ev.description);
                            setEditDeadlineDraft(ev.deadline ? ev.deadline.slice(0, 16) : "");
                            setEditAssignedToDraft(ev.assignedToId || "");
                          }}
                        >
                          <Pencil size={11} /> Editar
                        </button>
                      )}
                      {descendantCount > 0 && (
                        <button className="no-print" style={styles.editEventBtn} onClick={() => toggleThreadCollapse(ev.seq, isCollapsed)}>
                          {isCollapsed ? (
                            <>
                              <ChevronDown size={11} /> Mostrar {descendantCount} resposta{descendantCount > 1 ? "s" : ""}
                            </>
                          ) : (
                            <>
                              <ChevronUp size={11} /> Ocultar respostas
                            </>
                          )}
                        </button>
                      )}
                    </span>
                  )}

                  {confirmDeleteEventSeq === ev.seq && (
                    <div className="no-print" style={styles.confirmDeleteGroup}>
                      <span style={{ fontSize: 12.5, color: INK, marginRight: 4 }}>Excluir este andamento?</span>
                      <button
                        style={styles.confirmDeleteYes}
                        onClick={() => {
                          onDeleteEvent(ev.seq);
                          setConfirmDeleteEventSeq(null);
                        }}
                      >
                        Sim
                      </button>
                      <button style={styles.confirmDeleteNo} onClick={() => setConfirmDeleteEventSeq(null)}>
                        Não
                      </button>
                    </div>
                  )}

                  {replyingTo === ev.seq && <div style={{ marginTop: 10 }}>{renderComposer()}</div>}
                </div>
              </div>
            );
                })}
                {hasMore && (
                  <button
                    className="no-print"
                    style={styles.loadMoreBtn}
                    onClick={() => setVisibleRootCount((n) => n + 25)}
                  >
                    <ChevronDown size={14} /> Carregar mais andamentos ({totalRoots - visibleRootCount} restantes)
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

function RichEditor({ editorRef, initialValue, onChangeHtml, placeholder, onSubmit, style }) {
  const localRef = useRef(null);
  const ref = editorRef || localRef;
  const loadedRef = useRef(false);

  useEffect(() => {
    if (ref.current && !loadedRef.current) {
      ref.current.innerHTML = initialValue || "";
      loadedRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className="rich-editor rich-content"
      data-placeholder={placeholder || ""}
      style={style}
      onInput={(e) => onChangeHtml(e.currentTarget.innerHTML)}
      onPaste={(e) => {
        // Item 3 (lote 3): texto colado não pode trazer fonte/estilo externo — força
        // a usar sempre a fonte padrão do sistema, mantendo apenas quebras de parágrafo.
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        const html = text
          .split(/\r\n|\r|\n/)
          .map((line) => escapeHtml(line))
          .join("<br>");
        document.execCommand("insertHTML", false, html);
        onChangeHtml(e.currentTarget.innerHTML);
      }}
      onKeyDown={(e) => {
        if (onSubmit && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onSubmit();
        }
      }}
    />
  );
}

function RichFormatToolbar({ editorRef, onChangeHtml, colaboradores }) {
  const [showColors, setShowColors] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const keepFocus = (e) => e.preventDefault();
  return (
    <div className="no-print" style={styles.formatToolbar}>
      <button type="button" style={styles.formatBtn} onMouseDown={keepFocus} onClick={() => execCmd(editorRef, onChangeHtml, "bold")} title="Negrito">
        <Bold size={13} />
      </button>
      <button type="button" style={styles.formatBtn} onMouseDown={keepFocus} onClick={() => execCmd(editorRef, onChangeHtml, "italic")} title="Itálico">
        <Italic size={13} />
      </button>
      <button type="button" style={styles.formatBtn} onMouseDown={keepFocus} onClick={() => execCmd(editorRef, onChangeHtml, "underline")} title="Sublinhado">
        <Underline size={13} />
      </button>
      <button
        type="button"
        style={styles.formatBtn}
        onMouseDown={keepFocus}
        onClick={() => execCmd(editorRef, onChangeHtml, "formatBlock", "blockquote")}
        title="Citação"
      >
        <Quote size={13} />
      </button>
      <button
        type="button"
        style={styles.formatBtn}
        onMouseDown={keepFocus}
        onClick={() => insertListItem(editorRef, onChangeHtml, false)}
        title="Lista com pontos"
      >
        <ListBulletIcon size={13} />
      </button>
      <button
        type="button"
        style={styles.formatBtn}
        onMouseDown={keepFocus}
        onClick={() => insertListItem(editorRef, onChangeHtml, true)}
        title="Lista numerada"
      >
        <ListOrdered size={13} />
      </button>
      <div style={{ position: "relative" }}>
        <button type="button" style={styles.formatBtn} onMouseDown={keepFocus} onClick={() => setShowColors(!showColors)} title="Cor do texto">
          <Palette size={13} />
        </button>
        {showColors && (
          <div style={styles.formatColorPopover}>
            {COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                style={{ ...styles.colorSwatch, background: c }}
                onMouseDown={keepFocus}
                onClick={() => {
                  execCmd(editorRef, onChangeHtml, "foreColor", c);
                  setShowColors(false);
                }}
              />
            ))}
          </div>
        )}
      </div>
      {colaboradores && colaboradores.length > 0 && (
        <div style={{ position: "relative" }}>
          <button type="button" style={styles.formatBtn} onMouseDown={keepFocus} onClick={() => setShowMentions(!showMentions)} title="Mencionar colaborador">
            <AtSign size={13} />
          </button>
          {showMentions && (
            <div style={styles.mentionPopover}>
              {colaboradores.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  style={styles.mentionOption}
                  onMouseDown={keepFocus}
                  onClick={() => {
                    insertMention(editorRef, onChangeHtml, c.name);
                    setShowMentions(false);
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConfirmDeleteButton({ onConfirm, title }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span style={styles.confirmDeleteGroup}>
        <button
          type="button"
          style={styles.confirmDeleteYes}
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
        >
          Sim
        </button>
        <button type="button" style={styles.confirmDeleteNo} onClick={() => setConfirming(false)}>
          Não
        </button>
      </span>
    );
  }
  return (
    <button type="button" style={styles.iconBtn} onClick={() => setConfirming(true)} title={title || "Remover"}>
      <Trash2 size={14} color={DANGER} />
    </button>
  );
}

function Field({ label, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function EncaminhamentosBuilder({ items, onChange }) {
  const [text, setText] = useState("");
  const [deadline, setDeadline] = useState("");

  function add() {
    if (!text.trim()) return;
    onChange([...items, { id: uid(), text: text.trim(), deadline: deadline ? new Date(deadline).toISOString() : null }]);
    setText("");
    setDeadline("");
  }
  function remove(id) {
    onChange(items.filter((it) => it.id !== id));
  }

  return (
    <div className="no-print" style={styles.encaminhamentosBuilder}>
      <div style={styles.timelineTitle}>Encaminhamentos desta decisão</div>
      {items.length === 0 && <div style={styles.emptySmall}>Nenhum encaminhamento adicionado ainda (opcional).</div>}
      {items.map((it, i) => (
        <div key={it.id} style={styles.encaminhamentoRow}>
          <span style={styles.taskRowNumber}>{i + 1}</span>
          <span style={styles.panelRowTitle}>{it.text}</span>
          {it.deadline && <span style={styles.deadlineTag}>{fmtDateTime(it.deadline)}</span>}
          <button className="no-print" style={styles.pendingAttachmentRemove} onClick={() => remove(it.id)} title="Remover">
            <X size={14} />
          </button>
        </div>
      ))}
      <div style={styles.encaminhamentoAddRow}>
        <input
          style={styles.input}
          placeholder="Ex.: Fazer os relatórios..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <input type="datetime-local" style={styles.deadlineInput} value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        <button type="button" style={styles.addEventBtn} onClick={add}>
          <Plus size={14} /> Adicionar
        </button>
      </div>
    </div>
  );
}

function ChecklistSection({ checklistName, checklist, onAdd, onToggle, onSetDeadline, onDelete, onRename, onRemovePhoto, disabled }) {
  const [text, setText] = useState("");
  const [openDeadlineId, setOpenDeadlineId] = useState(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(checklistName || "Checklist");
  const now = Date.now();

  function submit() {
    if (disabled) return;
    if (text.trim()) {
      onAdd(text);
      setText("");
    }
  }

  function submitName() {
    if (disabled) return;
    onRename(nameDraft.trim() || "Checklist");
    setEditingName(false);
  }

  const done = checklist.filter((c) => c.done).length;

  return (
    <div style={{ ...styles.checklistSection, ...(disabled ? styles.checklistSectionDisabled : {}) }}>
      {disabled && (
        <div className="no-print" style={styles.checklistLockedNote}>
          <Clock size={12} /> Checklist travado — o processo está parado.
        </div>
      )}
      <div style={styles.checklistHeader}>
        <Zap size={15} color={ACCENT} />
        {editingName ? (
          <input
            autoFocus
            style={styles.checklistNameInput}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={submitName}
            onKeyDown={(e) => e.key === "Enter" && submitName()}
          />
        ) : (
          <button className="no-print" style={styles.checklistNameBtn} onClick={() => !disabled && setEditingName(true)} title="Renomear checklist">
            {checklistName || "Checklist"}
          </button>
        )}
        <span style={styles.timelineCount}>
          {done}/{checklist.length} concluídos
        </span>
      </div>

      <div style={styles.checklistAddRow}>
        <input
          style={styles.input}
          placeholder="Adicionar item ao checklist e pressione Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button style={styles.addEventBtn} onClick={submit}>
          <Plus size={14} /> Adicionar
        </button>
      </div>

      {checklist.length === 0 && <div style={styles.emptySmall}>Nenhum item ainda. Adicione o primeiro acima.</div>}

      <div style={styles.checklistItems}>
        {checklist.map((item) => {
          const dInfo = item.deadline ? deadlineInfo(item.deadline, now) : null;
          return (
            <div key={item.id} style={styles.checklistRow}>
              <button style={styles.taskCheckbox} onClick={() => onToggle(item.id)} title={item.done ? "Reabrir" : "Marcar como concluído"}>
                {item.done ? <CheckCircle2 size={20} color={SUCCESS_GREEN} /> : <Circle size={20} color={MUTED} />}
              </button>
              <div style={styles.checklistTextCol}>
                <span style={item.done ? styles.checklistTextDone : styles.checklistText}>{item.text}</span>
                {item.deadline && (
                  <span style={dInfo.overdue ? styles.deadlineTagOverdue : dInfo.urgent ? styles.deadlineTagUrgent : styles.deadlineTag}>
                    <Clock size={11} /> Prazo: {fmtDateTime(item.deadline)} — {dInfo.label}
                  </span>
                )}
                {item.photos && item.photos.length > 0 && (
                  <div style={styles.attachmentsRow}>
                    {item.photos.map((p) => (
                      <div key={p.id} style={{ position: "relative" }}>
                        <a href={p.dataUrl} target="_blank" rel="noreferrer" title={p.name}>
                          <img src={p.dataUrl} alt={p.name} style={styles.attachmentThumb} />
                        </a>
                        <button
                          className="no-print"
                          style={styles.checklistPhotoRemove}
                          onClick={() => onRemovePhoto(item.id, p.id)}
                          title="Remover foto"
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {openDeadlineId === item.id ? (
                <input
                  type="datetime-local"
                  autoFocus
                  style={styles.deadlineInput}
                  defaultValue={item.deadline ? item.deadline.slice(0, 16) : ""}
                  onBlur={(e) => {
                    onSetDeadline(item.id, e.target.value ? new Date(e.target.value).toISOString() : null);
                    setOpenDeadlineId(null);
                  }}
                />
              ) : (
                <button style={styles.checklistDeadlineBtn} onClick={() => setOpenDeadlineId(item.id)} title="Definir prazo">
                  <Clock size={13} /> Prazo
                </button>
              )}
              <button style={styles.pendingAttachmentRemove} onClick={() => onDelete(item.id)} title="Remover item">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NewProcessModal({ form, setForm, setores, colaboradores, onCancel, onCreate, creating, nextNumber }) {
  return (
    <div style={styles.modalOverlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <datalist id="colaboradores-datalist-modal">
          {colaboradores.map((c) => (
            <option key={c.id} value={c.name} />
          ))}
        </datalist>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalStampLabel}>Próximo número</div>
            <div style={styles.modalStamp}>{nextNumber}</div>
          </div>
          <button style={styles.iconBtn} onClick={onCancel}>
            <X size={16} />
          </button>
        </div>

        <Field label="Título do processo">
          <input style={styles.input} autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Renovação de contrato com fornecedor X" />
        </Field>

        <Field label="Descrição">
          <textarea style={styles.textarea} rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="O que precisa ser feito neste processo?" />
        </Field>

        <Field label="Classificação">
          <select style={styles.select} value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value })}>
            <option value="simples">Processo simples</option>
            <option value="especial">Processo especial (número em vermelho)</option>
            <option value="pessoal">Processo pessoal (número em verde — não tramita entre setores)</option>
          </select>
        </Field>

        <div style={styles.fieldsGrid}>
          <Field label="Setor inicial">
            <select
              style={styles.select}
              value={form.sectorId}
              onChange={(e) => setForm({ ...form, sectorId: e.target.value })}
              disabled={form.classification === "pessoal"}
            >
              <option value="">Sem setor</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Prioridade">
            <select style={styles.select} value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Responsável">
            <input style={styles.input} value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Nome" list="colaboradores-datalist-modal" />
          </Field>
          <Field label="Prazo">
            <input type="date" style={styles.input} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <input style={styles.input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Opcional" />
          </Field>
        </div>

        <div style={styles.modalActions}>
          <button style={styles.secondaryBtn} onClick={onCancel}>
            Cancelar
          </button>
          <button style={{ ...styles.primaryBtn, opacity: creating ? 0.7 : 1 }} onClick={onCreate} disabled={!form.title.trim() || creating}>
            {creating ? "Criando…" : `Abrir processo ${nextNumber}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectorsModal({ setores, onClose, onAdd, onRename, onDelete, onSetColor }) {
  const [name, setName] = useState("");
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalStampLabel}>Fluxo de trabalho</div>
            <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 19.5 }}>Setores</div>
          </div>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.sectorList}>
          {setores.length === 0 && <div style={styles.emptySmall}>Nenhum setor ainda. Crie o primeiro abaixo.</div>}
          {setores.map((s, i) =>
            s.fixed ? (
              <div key={s.id} style={styles.sectorRowColumn}>
                <div style={styles.sectorRow}>
                  <span style={{ ...styles.dot, background: s.color || sectorColor(i) }} />
                  <span style={styles.fixedSectorName}>
                    <Lock size={11} /> {s.name}
                  </span>
                  <span style={styles.fixedSectorTag}>fixo</span>
                </div>
                <div style={styles.colorSwatchRow}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      style={{ ...styles.colorSwatch, background: c, outline: s.color === c ? `2px solid ${INK}` : "none" }}
                      onClick={() => onSetColor(s.id, c)}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div key={s.id} style={styles.sectorRowColumn}>
                <div style={styles.sectorRow}>
                  <span style={{ ...styles.dot, background: s.color || sectorColor(i) }} />
                  <input style={styles.sectorRowInput} value={s.name} onChange={(e) => onRename(s.id, e.target.value)} />
                  <ConfirmDeleteButton onConfirm={() => onDelete(s.id)} title="Remover setor" />
                </div>
                <div style={styles.colorSwatchRow}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      style={{ ...styles.colorSwatch, background: c, outline: s.color === c ? `2px solid ${INK}` : "none" }}
                      onClick={() => onSetColor(s.id, c)}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        <div style={styles.addEventRow}>
          <input
            style={styles.input}
            placeholder="Nome do novo setor (ex.: Financeiro)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onAdd(name);
                setName("");
              }
            }}
          />
          <button
            style={styles.addEventBtn}
            onClick={() => {
              if (name.trim()) {
                onAdd(name);
                setName("");
              }
            }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function ColaboradoresModal({ colaboradores, onClose, onAdd, onUpdate, onDelete }) {
  const [name, setName] = useState("");
  const [cargo, setCargo] = useState("");
  const [email, setEmail] = useState("");

  function submit() {
    if (!name.trim()) return;
    onAdd(name, cargo, email);
    setName("");
    setCargo("");
    setEmail("");
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalStampLabel}>Cadastro</div>
            <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 19.5 }}>Colaboradores</div>
          </div>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.sectorList}>
          {colaboradores.length === 0 && <div style={styles.emptySmall}>Nenhum colaborador cadastrado ainda.</div>}
          {colaboradores.map((c) => (
            <div key={c.id} style={styles.colaboradorRow}>
              <UserCircle2 size={18} color={MUTED} />
              <input style={styles.sectorRowInput} value={c.name} onChange={(e) => onUpdate(c.id, { name: e.target.value })} placeholder="Nome" />
              <input
                style={{ ...styles.sectorRowInput, maxWidth: 100 }}
                value={c.cargo || ""}
                onChange={(e) => onUpdate(c.id, { cargo: e.target.value })}
                placeholder="Função"
              />
              <input
                style={{ ...styles.sectorRowInput, maxWidth: 150 }}
                value={c.email || ""}
                onChange={(e) => onUpdate(c.id, { email: e.target.value })}
                placeholder="E-mail"
                type="email"
              />
              <ConfirmDeleteButton onConfirm={() => onDelete(c.id)} title="Remover colaborador" />
            </div>
          ))}
        </div>

        <div style={styles.addEventRow}>
          <input style={styles.input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <input style={{ ...styles.input, maxWidth: 100 }} placeholder="Função" value={cargo} onChange={(e) => setCargo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <input
            style={{ ...styles.input, maxWidth: 150 }}
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button style={styles.addEventBtn} onClick={submit}>
            <Plus size={14} /> Adicionar
          </button>
        </div>
        <div style={styles.attachHint}>
          <Mail size={11} style={{ verticalAlign: "middle" }} /> O e-mail é usado para abrir um rascunho de notificação quando um andamento é adicionado ou um prazo vence.
        </div>
      </div>
    </div>
  );
}

function QuickSearchModal({ processos, query, onQueryChange, onSelect, onClose }) {
  const q = query.trim().toLowerCase();
  const results = q
    ? processos
        .filter((p) => p.number.toLowerCase().includes(q) || p.title.toLowerCase().includes(q))
        .slice(0, 12)
    : [...processos].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)).slice(0, 8);

  return (
    <div style={styles.quickSearchOverlay} onClick={onClose}>
      <div style={styles.quickSearchBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.quickSearchInputRow}>
          <Search size={16} color={MUTED} />
          <input
            autoFocus
            style={styles.quickSearchInput}
            placeholder="Buscar processo por número ou título…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) onSelect(results[0].id);
            }}
          />
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>
        <div style={styles.quickSearchResults}>
          {results.length === 0 && <div style={styles.emptySmall}>Nenhum processo encontrado.</div>}
          {results.map((p) => (
            <button key={p.id} style={styles.quickSearchResultRow} onClick={() => onSelect(p.id)}>
              <span style={{ ...styles.taskRowNumber, color: processNumberColor(p) }}>{p.number}</span>
              <span style={styles.panelRowTitle}>{p.title}</span>
            </button>
          ))}
        </div>
        <div style={styles.quickSearchHint}>Ctrl+K (ou Cmd+K) abre esta busca de qualquer tela · Esc fecha</div>
      </div>
    </div>
  );
}

function AssuntosModal({ assuntos, onClose, onAdd, onRename, onDelete }) {
  const [name, setName] = useState("");
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalStampLabel}>Classificação</div>
            <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 19.5 }}>Assuntos</div>
          </div>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.sectorList}>
          {assuntos.length === 0 && <div style={styles.emptySmall}>Nenhum assunto cadastrado ainda.</div>}
          {assuntos.map((a) => (
            <div key={a.id} style={styles.sectorRow}>
              <input style={styles.sectorRowInput} value={a.name} onChange={(e) => onRename(a.id, e.target.value)} />
              <ConfirmDeleteButton onConfirm={() => onDelete(a.id)} title="Remover assunto" />
            </div>
          ))}
        </div>

        <div style={styles.addEventRow}>
          <input
            style={styles.input}
            placeholder="Nome do assunto (ex.: Manutenção predial)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                onAdd(name);
                setName("");
              }
            }}
          />
          <button
            style={styles.addEventBtn}
            onClick={() => {
              if (name.trim()) {
                onAdd(name);
                setName("");
              }
            }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersModal({ usuarios, onClose, onAdd, onUpdate, onDelete, onUnblock, onSendReset }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resetEnviado, setResetEnviado] = useState({});
  const [senhaGerada, setSenhaGerada] = useState(null); // { nome, email, senha } do último cadastro feito

  async function submit() {
    if (!name.trim() || !email.trim()) return;
    setEnviando(true);
    setErro("");
    setSenhaGerada(null);
    const resultado = await onAdd(name, email);
    setEnviando(false);
    if (!resultado || !resultado.ok) {
      setErro((resultado && resultado.message) || "Não foi possível cadastrar.");
      return;
    }
    if (resultado.senhaTemporaria) {
      setSenhaGerada({ nome: name.trim(), email: email.trim(), senha: resultado.senhaTemporaria });
    }
    setName("");
    setEmail("");
  }

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalStampLabel}>Cadastro</div>
            <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 19.5 }}>Usuários</div>
          </div>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.attachHint}>
          O login é feito por e-mail e senha, protegido de verdade pelo Firebase. Ao cadastrar alguém aqui, o sistema gera uma senha
          temporária pra você passar pra pessoa (por WhatsApp, por exemplo) — o e-mail automático de redefinição às vezes não chega
          (bloqueado pelo provedor de e-mail), então a senha temporária é o jeito garantido.
        </div>

        {senhaGerada && (
          <div style={styles.senhaGeradaBox}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>
              Cadastro de {senhaGerada.nome} concluído — repassa isso pra pessoa:
            </div>
            <div>
              E-mail: <strong>{senhaGerada.email}</strong>
            </div>
            <div>
              Senha temporária: <strong style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 15 }}>{senhaGerada.senha}</strong>
            </div>
            <button style={{ ...styles.secondaryBtn, marginTop: 8 }} onClick={() => setSenhaGerada(null)}>
              Ok, já anotei
            </button>
          </div>
        )}

        <div style={styles.sectorList}>
          {usuarios.length === 0 && <div style={styles.emptySmall}>Nenhum usuário cadastrado ainda.</div>}
          {usuarios.map((u) => (
            <div key={u.id} style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              <div style={styles.colaboradorRow}>
                <UserCircle2 size={18} color={u.blocked ? DANGER : u.role === "admin" ? ACCENT2 : MUTED} />
                <input style={styles.sectorRowInput} value={u.name} onChange={(e) => onUpdate(u.id, { name: e.target.value })} placeholder="Nome" />
                <span style={{ ...styles.sectorRowInput, maxWidth: 190, color: MUTED, display: "flex", alignItems: "center" }}>{u.email}</span>
                <button
                  style={{ ...styles.secondaryBtn, whiteSpace: "nowrap" }}
                  disabled={resetEnviado[u.id]}
                  onClick={async () => {
                    await onSendReset(u.email);
                    setResetEnviado({ ...resetEnviado, [u.id]: true });
                  }}
                  title="Manda um e-mail pra pessoa escolher uma senha nova (pode não chegar — veja acima)"
                >
                  {resetEnviado[u.id] ? "Link enviado" : "Redefinir senha"}
                </button>
                <ConfirmDeleteButton onConfirm={() => onDelete(u.id)} title="Remover usuário" />
              </div>
              <label style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 26, fontSize: 12.5, color: MUTED }}>
                <input type="checkbox" checked={u.role === "admin"} onChange={(e) => onUpdate(u.id, { role: e.target.checked ? "admin" : null })} />
                Administrador (acesso à tela de gerenciamento)
              </label>
              {u.blocked && (
                <div style={styles.blockedRowNote}>
                  <span>
                    🔒 Bloqueado{u.blockedReason ? ` — ${u.blockedReason}` : ""}
                  </span>
                  <button
                    style={styles.unblockBtn}
                    onClick={() => onUnblock(u.id)}
                  >
                    Desbloquear
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={styles.addEventRow}>
          <input style={styles.input} placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
          <input
            style={{ ...styles.input, maxWidth: 220 }}
            placeholder="E-mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
          <button style={styles.addEventBtn} onClick={submit} disabled={enviando}>
            <Plus size={14} /> {enviando ? "Cadastrando..." : "Adicionar"}
          </button>
        </div>
        {erro && <div style={styles.attachErrorHint}>{erro}</div>}
      </div>
    </div>
  );
}

function StatusesModal({ statuses, allStatuses, sectorName, onClose, onAdd, onUpdate, onDelete }) {
  const [label, setLabel] = useState("");
  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <div>
            <div style={styles.modalStampLabel}>{sectorName ? `Fluxo de trabalho — ${sectorName}` : "Fluxo de trabalho"}</div>
            <div style={{ ...styles.modalStamp, fontFamily: "'Fraunces', serif", fontSize: 19.5 }}>Status dos processos</div>
          </div>
          <button style={styles.iconBtn} onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div style={styles.sectorList}>
          {statuses.map((s) => (
            <div key={s.id} style={styles.statusRow}>
              {s.fixed ? (
                <span style={styles.fixedSectorName}>
                  <Lock size={11} /> {s.label}
                </span>
              ) : (
                <input style={styles.sectorRowInput} value={s.label} onChange={(e) => onUpdate(s.id, { label: e.target.value })} />
              )}
              <div style={styles.colorSwatchRow}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    style={{ ...styles.colorSwatch, background: c, outline: s.color === c ? `2px solid ${INK}` : "none" }}
                    onClick={() => onUpdate(s.id, { color: c })}
                    title={c}
                  />
                ))}
              </div>
              {s.fixed ? (
                <span style={styles.fixedSectorTag}>fixo</span>
              ) : (
                <ConfirmDeleteButton onConfirm={() => onDelete(s.id)} title="Remover status" />
              )}
            </div>
          ))}
        </div>

        <div style={styles.statusesHint}>
          Os status fixos (usados pelo fluxo de orçamento e de decisão) têm o nome travado, mas a cor pode ser trocada.
        </div>

        <div style={styles.addEventRow}>
          <input
            style={styles.input}
            placeholder="Nome do novo status (ex.: Em revisão)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && label.trim()) {
                onAdd(label);
                setLabel("");
              }
            }}
          />
          <button
            style={styles.addEventBtn}
            onClick={() => {
              if (label.trim()) {
                onAdd(label);
                setLabel("");
              }
            }}
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

const fontImports = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap');
`;

const printStyles = `
@media print {
  .no-print { display: none !important; }
}
`;

const layoutFixStyles = `
html, body { height: 100%; margin: 0; padding: 0; }
#root { height: 100%; min-height: 100vh; }
.rich-editor:empty:before { content: attr(data-placeholder); color: #8B93A3; pointer-events: none; }
.rich-content blockquote { margin: 4px 0; padding-left: 10px; border-left: 3px solid #DEDBCF; color: #5B6472; font-style: italic; }
.rich-content ul, .rich-content ol { margin: 4px 0; padding-left: 22px; }
.rich-content p { margin: 0 0 6px 0; }
.rich-content b, .rich-content strong { font-weight: 700; }
@keyframes urgentBlink {
  0%, 100% { background-color: #DC2626; color: #FFFFFF; }
  50% { background-color: #FFFFFF; color: #111318; }
}
.urgent-blink-row { animation: urgentBlink 0.7s ease-in-out infinite; }
.urgent-blink-row * { color: inherit !important; }
`;

