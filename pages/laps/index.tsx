"use client";

import DefaultLayout from "@/layouts/default";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Input, Textarea} from "@heroui/input";
import {Button} from "@heroui/button";
import {Table, TableHeader, TableColumn, TableBody, TableRow, TableCell} from "@heroui/table";
import {Chip} from "@heroui/chip";
import {Switch} from "@heroui/switch";
import {Select, SelectItem} from "@heroui/select";
import {Spinner} from "@heroui/spinner";
import {Checkbox} from "@heroui/checkbox";
import {Divider} from "@heroui/divider";
import {Tabs, Tab} from "@heroui/tabs";
import {CloseIcon, DeleteIcon, PolicyIcon} from "@/components/icons";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

/* ===================== Types ===================== */

type ClientItem = {
  id: number;
  uuid: string;
  hostname: string;
  ip_address: string;
  mac_address: string;
  is_active: boolean;
  created_at: string;
  last_seen?: string | null;
  has_secret?: boolean;
  expires_at?: string | null;
};

type LapsSecret = {
  client_id: number;
  client_uuid: string;
  account: string;
  password: string;
  version: number;
  last_rotated_at?: string;
  expires_at?: string;
  view_ttl_seconds: number;
};

type HistoryItem = { account_name: string; version: number; rotated_at: string };

type Policy = {
  id?: number;
  name: string;
  description?: string;
  account_name: string;
  length: number;
  use_upper: boolean;
  use_lower: boolean;
  use_digits: boolean;
  use_symbols: boolean;
  rotation_days: number;
  view_ttl_seconds: number;
  history_keep: number;
  backup_directory: "db" | "none";
  post_auth_action: "none" | "reset" | "logoff" | "reboot" | "shutdown";
  post_auth_delay_minutes: number;
  enforce_max_age: boolean;
  rotate_on_unlock: boolean;
  allow_plaintext_backup: boolean;
  rename_admin: boolean;
  rename_admin_to: string;
  readers: string[];
  disabled?: boolean;
};

type EffectivePolicyResp = {
  source: "client"|"group"|"org"|null;
  policy: Policy | null;
};

/* ===================== API ===================== */

const api = {
  async listClients(): Promise<ClientItem[]> {
    const r = await fetch(`${API_BASE}/laps/api/clients/`);
    if (!r.ok) throw new Error("clients load failed");
    return r.json();
  },
  async getSecret(key: string, autogen = false): Promise<LapsSecret> {
    const url = `${API_BASE}/laps/api/clients/${encodeURIComponent(key)}/secret/${autogen ? "?autogen=1": ""}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async rotate(key: string) {
    const r = await fetch(`${API_BASE}/laps/api/clients/${encodeURIComponent(key)}/rotate/`, { method: "POST" });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async bulkRotate(keys: string[]) {
    const r = await fetch(`${API_BASE}/laps/api/clients/bulk-rotate/`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ keys }),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json() as Promise<{ok: boolean; errors: Array<{key: string; error: string}>}>;
  },
  async history(key: string): Promise<HistoryItem[]> {
    const r = await fetch(`${API_BASE}/laps/api/clients/${encodeURIComponent(key)}/history/`);
    if (!r.ok) return [];
    return r.json();
  },
  async listPolicies(): Promise<Policy[]> {
    const r = await fetch(`${API_BASE}/laps/api/policies/`);
    if (!r.ok) return [];
    return r.json();
  },
  async savePolicy(p: Policy) {
    if (p.id) {
      const r = await fetch(`${API_BASE}/laps/api/policies/${p.id}/`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify(p) });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    }
    const r = await fetch(`${API_BASE}/laps/api/policies/`, { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify(p) });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async deletePolicy(id: number) {
    const r = await fetch(`${API_BASE}/laps/api/policies/${id}/`, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return true;
  },
  // ---- new: accounts/effective/assignments ----
  async clientAccounts(key: string): Promise<{account_name: string}[]> {
    const r = await fetch(`${API_BASE}/laps/api/clients/${encodeURIComponent(key)}/accounts/`);
    if (!r.ok) return [];
    return r.json();
  },
  async clientEffectivePolicy(key: string): Promise<EffectivePolicyResp | null> {
    // Bu uç sunucuda opsiyonel. 404 olursa null döndür.
    const url = `${API_BASE}/laps/api/clients/${encodeURIComponent(key)}/effective-policy/`;
    const r = await fetch(url);
    if (!r.ok) return null;
    return r.json();
  },
  async createAssignment(payload: {
    target_type: "client"|"group"|"org";
    target_id: string;
    policy: number;
    account_name_override?: string;
  }) {
    const r = await fetch(`${API_BASE}/laps/api/assignments/`, {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify(payload),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  },
  async listAssignments(): Promise<any[]> {
    const r = await fetch(`${API_BASE}/laps/api/assignments/list/`);
    if (!r.ok) return [];
    return r.json();
  },
  async deleteAssignment(id: number) {
    const r = await fetch(`${API_BASE}/laps/api/assignments/${id}/`, { method: "DELETE" });
    if (!r.ok) throw new Error(await r.text());
    return true;
  },
  async listLogs(params: {
  q?: string;
  action?: "rotate"|"view"|"report"|"bulk_rotate"|"error"|"";
  client?: string;
  date_from?: string; // "YYYY-MM-DD" veya ISO
  date_to?: string;
  page?: number;
  page_size?: number;
}): Promise<{items:any[]; total:number; page:number; page_size:number}> {
  const u = new URL(`${API_BASE}/laps/api/logs/`);
  Object.entries(params || {}).forEach(([k,v]) => {
    if (v !== undefined && v !== null && String(v).length) u.searchParams.set(k, String(v));
  });
  const r = await fetch(u.toString());
  if (!r.ok) throw new Error(await r.text());
  return r.json();
},
async createGrant(params: { client: string; reason: string; ticket?: string; ttl?: number }) {
  const r = await fetch(`${API_BASE}/laps/api/grants/`, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(params),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<{grant: string; expires_in: number}>;
},

async getSecretWithGrant(key: string, grant: string) {
  const r = await fetch(`${API_BASE}/laps/api/clients/${encodeURIComponent(key)}/secret/?grant=${encodeURIComponent(grant)}`);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
},


};

/* ===================== Helpers ===================== */

function formatDate(s?: string | null) {
  if (!s) return "-";
  try { return new Date(s).toLocaleString(); } catch { return s; }
}

function copy(text: string) {
  try { navigator.clipboard.writeText(text); } catch {}
}

type Health = "ok" | "soon" | "expired" | "na";
function healthOf(expires_at?: string | null): Health {
  if (!expires_at) return "na";
  const now = Date.now();
  const ex = new Date(expires_at).getTime();
  if (isNaN(ex)) return "na";
  const diffDays = (ex - now) / 86400000;
  if (diffDays < 0) return "expired";
  if (diffDays <= 7) return "soon";
  return "ok";
}

function healthChip(h: Health) {
  if (h === "ok")    return <Chip size="sm" color="success" variant="flat">Sağlıklı</Chip>;
  if (h === "soon")  return <Chip size="sm" color="warning" variant="flat">Yakında</Chip>;
  if (h === "expired") return <Chip size="sm" color="danger" variant="flat">Süresi doldu</Chip>;
  return <Chip size="sm" variant="flat">—</Chip>;
}

/* ===================== Page ===================== */

export default function LapsSuitePage() {
  const [tab, setTab] = useState<"clients"|"policies"|"assign"|"audit">("clients");

  // common data
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingPolicies(true);
      try { setPolicies(await api.listPolicies()); } finally { setLoadingPolicies(false); }
    })();
  }, []);

  return (
    <DefaultLayout>
      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <PolicyIcon className="text-blue-600" />
        LAPS Yönetimi
      </h1>

      <Tabs
        selectedKey={tab}
        onSelectionChange={k => setTab(k as any)}
        className="mt-6"
        variant="underlined"
        aria-label="LAPS Sekmeleri"
      >
        <Tab key="clients" title="İstemciler">
          <ClientsView policies={policies} refreshPolicies={async () => setPolicies(await api.listPolicies())}/>
        </Tab>
        <Tab key="policies" title="Politikalar">
          <PoliciesView
            policies={policies}
            loading={loadingPolicies}
            onChanged={async () => setPolicies(await api.listPolicies())}
          />
        </Tab>
        <Tab key="assign" title="Atamalar">
          <AssignmentsConnected />
        </Tab>
        <Tab key="audit" title="Kayıtlar">
          <AuditView />
        </Tab>
      </Tabs>
    </DefaultLayout>
  );
}

/* ===================== Clients View ===================== */

function ClientsView({policies, refreshPolicies}:{policies: Policy[]; refreshPolicies: () => Promise<void>}) {
  // data
  const [rows, setRows] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [onlyOnline, setOnlyOnline] = useState(false);
  const [health, setHealth] = useState<Health | "all">("all");
  const [sortBy, setSortBy] = useState<"hostname"|"last"|"expires">("hostname");

  // selection
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  // drawer & detail
  const [openDetail, setOpenDetail] = useState<ClientItem | null>(null);
  const [accounts, setAccounts] = useState<Record<string, {account_name: string}[]>>({});
  const [clientPolicy, setClientPolicy] = useState<Record<string, number | null>>({});
  const [clientPolicySource, setClientPolicySource] = useState<Record<string, EffectivePolicyResp["source"]>>({});
  const [accountOverride, setAccountOverride] = useState<string>("");

  // secret panel
  const [secret, setSecret] = useState<LapsSecret | null>(null);
  const [reveal, setReveal] = useState(false);
  const [revealCountdown, setRevealCountdown] = useState(0);
  const timerRef = useRef<any>(null);

  const selectedKeys = useMemo(
    () => Object.entries(selected).filter(([,v]) => v).map(([k]) => k),
    [selected]
  );

  const bulkColor = useMemo(() => {
    if (!selectedKeys.length) return "default" as const;
    const anyOffline = rows.some(r => selected[r.uuid] && !r.is_active);
    return anyOffline ? ("warning" as const) : ("success" as const);
  }, [selectedKeys.length, rows, selected]);

  // load clients
  async function load() {
    setLoading(true);
    try {
      const cs = await api.listClients();
      setRows(cs);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  // on detail open, fetch accounts + effective policy + history
  useEffect(() => {
    if (!openDetail) return;
    (async () => {
      // accounts
      try {
        const list = await api.clientAccounts(openDetail.uuid);
        setAccounts(prev => ({...prev, [openDetail.uuid]: (list?.length ? list : fallbackAccounts(openDetail))}));
      } catch {
        setAccounts(prev => ({...prev, [openDetail.uuid]: fallbackAccounts(openDetail)}));
      }
      // effective policy (opsiyonel endpoint; yoksa fallback)
      try {
        const eff = await api.clientEffectivePolicy(openDetail.uuid);
        if (eff?.policy?.id) {
          setClientPolicy(prev => ({...prev, [openDetail.uuid]: eff.policy!.id!}));
          setClientPolicySource(prev => ({...prev, [openDetail.uuid]: eff.source || null}));
        } else {
          // fallback: hiçbir şey set etme
        }
      } catch {/* ignore */}
      // history
      const hist = await api.history(openDetail.uuid);
      setHistoryItems(hist);
      // varsayılan override alanını temizle
      setAccountOverride("");
    })();
  }, [openDetail]);

  function fallbackAccounts(c: ClientItem) {
    const pid = clientPolicy[c.uuid];
    const pol = policies.find(p => p.id === pid);
    return [{account_name: pol?.account_name || "Administrator"}];
  }

  // filter & sort
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    const match = (s?: string) => qq ? (s || "").toLowerCase().includes(qq) : true;

    let list = rows.filter(r =>
      (!onlyOnline || r.is_active) &&
      (health === "all" || healthOf(r.expires_at) === health) &&
      (match(r.hostname) || match(r.uuid) || match(r.ip_address) || match(r.mac_address))
    );
    if (sortBy === "hostname") list = [...list].sort((a,b) => (a.hostname||"").localeCompare(b.hostname||""));
    if (sortBy === "last") list = [...list].sort((a,b) => new Date(b.last_seen||0).getTime() - new Date(a.last_seen||0).getTime());
    if (sortBy === "expires") list = [...list].sort((a,b) => new Date(a.expires_at||0).getTime() - new Date(b.expires_at||0).getTime());
    return list;
  }, [rows, q, onlyOnline, sortBy, health]);

  // auto-hide secret
  useEffect(() => {
    if (!reveal || !secret) return;
    setRevealCountdown(secret.view_ttl_seconds || 15);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setRevealCountdown(prev => {
        if (prev <= 1) {
          setReveal(false);
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [reveal, secret]);

  // actions
  const onReveal = async (uuid: string) => {
    try {
      const s = await api.getSecret(uuid, true); // autogen=1: yoksa oluştur
      // grant modal state'leri
      setSecret(s);
      setReveal(true);
    } catch (e: any) {
      alert("Parola alınamadı: " + (e?.message || e));
    }
  };
    const [grantOpen, setGrantOpen] = useState(false);
    const [grantTarget, setGrantTarget] = useState<ClientItem | null>(null);
    const [justification, setJustification] = useState("");
    const [ticket, setTicket] = useState("");
    const [grantLoading, setGrantLoading] = useState(false);

  const onRotate = async (uuid: string) => {
    if (!confirm(`Bu istemci için parolayı hemen döndürmek istiyor musunuz?`)) return;
    try {
      await api.rotate(uuid);
      await load();
      if (openDetail?.uuid === uuid) {
        const hist = await api.history(uuid);
        setHistoryItems(hist);
      }
    } catch (e: any) {
      alert("Dönüşüm başarısız: " + (e?.message || e));
    }
  };

  const onBulkRotate = async () => {
    const keys = selectedKeys;
    if (!keys.length) return alert("Makine seçiniz.");
    if (!confirm(`${keys.length} makine için toplu döndürme başlatılsın mı?`)) return;
    try {
      const res = await api.bulkRotate(keys);
      if (!res.ok) {
        const msg = res.errors?.map(e => `${e.key}: ${e.error}`).join("\n") || "Bilinmeyen hata";
        alert("Toplu iş hataları:\n" + msg);
      }
      await load();
    } catch (e: any) {
      alert("Toplu işlem başarısız: " + (e?.message || e));
    }
  };

  // history (detail)
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const openHistory = async (uuid: string) => {
    const items = await api.history(uuid);
    setHistoryItems(items);
  };

  return (
    <section className="flex flex-col gap-6 py-6">
      {/* Üst kontrol alanı / filtre kartları */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Arama */}
        <CardBox title="Arama">
          <Input
            aria-label="Arama"
            placeholder="Hostname / UUID / IP / MAC"
            value={q}
            onChange={e => setQ(e.target.value)}
          />
        </CardBox>

        {/* Filtreler */}
        <CardBox title="Filtreler">
          <div className="flex flex-col gap-3">
            <Switch aria-label="Sadece çevrimiçi" isSelected={onlyOnline} onValueChange={setOnlyOnline}>
              Sadece çevrimiçi
            </Switch>
            <Select
              aria-label="Parola Sağlığı"
              label="Parola Sağlığı"
              selectedKeys={new Set([health])}
              onSelectionChange={(k) => setHealth(Array.from(k as Set<string>)[0] as any)}
              className="max-w-xs"
            >
              <SelectItem key="all">Tümü</SelectItem>
              <SelectItem key="ok">Sağlıklı</SelectItem>
              <SelectItem key="soon">Yakında</SelectItem>
              <SelectItem key="expired">Süresi doldu</SelectItem>
              <SelectItem key="na">Bilinmiyor</SelectItem>
            </Select>
            <Select
              aria-label="Sıralama"
              label="Sırala"
              selectedKeys={new Set([sortBy])}
              onSelectionChange={(k) => setSortBy(Array.from(k as Set<string>)[0] as any)}
              className="max-w-xs"
            >
              <SelectItem key="hostname">Host adına göre</SelectItem>
              <SelectItem key="last">Son görülme</SelectItem>
              <SelectItem key="expires">Bitiş tarihi</SelectItem>
            </Select>
          </div>
        </CardBox>

        {/* Hızlı Eylemler */}
        <CardBox title="Hızlı Eylemler">
          <div className="flex flex-wrap gap-2">
            <Button color="primary" variant="flat" onPress={load} isDisabled={loading} aria-label="Yenile">
              {loading ? <Spinner size="sm" /> : "Yenile"}
            </Button>
            <Button variant="bordered" onPress={() => setSelected({})} aria-label="Seçimi temizle">
              Seçimi Temizle
            </Button>
            <Button
              color={bulkColor as any}
              variant="solid"
              onPress={onBulkRotate}
              aria-label="Toplu döndür"
            >
              Toplu Döndür {selectedKeys.length ? `(${selectedKeys.length})` : ""}
            </Button>
          </div>
        </CardBox>
      </div>

      {/* İstemciler tablosu */}
      <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200">
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            İstemciler
          </h2>
          <div className="flex items-center gap-2">
            <Button variant="bordered" onPress={() => setSelected({})}>Seçimi Temizle</Button>
            <Button color={bulkColor as any} variant="solid" onPress={onBulkRotate}>Toplu Döndür</Button>
          </div>
        </div>
        <p className="text-sm px-6 pb-4 text-foreground/70">
          LAPS kapsamında izlenen istemciler. Bir satıra tıklayarak detay panelini açabilirsiniz.
        </p>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Spinner label="Yükleniyor..." />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-gray-500">
            <div className="mb-2">Gösterilecek kayıt yok.</div>
            <div>Filtreleri değiştirin ya da Yenile’yi deneyin.</div>
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <Table aria-label="clients table">
            <TableHeader>
              <TableColumn>Seç</TableColumn>
              <TableColumn>Host</TableColumn>
              <TableColumn>UUID</TableColumn>
              <TableColumn>IP</TableColumn>
              <TableColumn>MAC</TableColumn>
              <TableColumn>Durum</TableColumn>
              <TableColumn>Parola Sağlığı</TableColumn>
              <TableColumn>Son Görülme</TableColumn>
              <TableColumn>Bitiş</TableColumn>
              <TableColumn>Aksiyon</TableColumn>
            </TableHeader>
            <TableBody>
              {filtered.map((it) => {
                const h = healthOf(it.expires_at);
                return (
                  <TableRow
                    key={it.uuid}
                    onClick={(e) => {
                      const tag = (e.target as HTMLElement).tagName.toLowerCase();
                      if (["input","button","svg","path"].includes(tag)) return;
                      setOpenDetail(it);
                      openHistory(it.uuid);
                    }}
                    className={it.is_active
                      ? "bg-emerald-50/10 hover:bg-emerald-50/30 cursor-pointer"
                      : "bg-rose-50/10 hover:bg-rose-50/30 cursor-pointer"}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={`seç ${it.hostname || it.uuid}`}
                        isSelected={!!selected[it.uuid]}
                        onValueChange={(v) => setSelected(prev => ({...prev, [it.uuid]: v}))}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-medium">{it.hostname || "-"}</span>
                        <span className="text-xs text-gray-500">#{it.id}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-gray-600 break-all">{it.uuid}</TableCell>
                    <TableCell>{it.ip_address || "-"}</TableCell>
                    <TableCell>{it.mac_address || "-"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${it.is_active ? "bg-emerald-500" : "bg-rose-500"}`} />
                        {it.is_active ? (
                          <Chip size="sm" color="success" variant="flat">Online</Chip>
                        ) : (
                          <Chip size="sm" color="danger" variant="flat">Offline</Chip>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{healthChip(h)}</TableCell>
                    <TableCell>{formatDate(it.last_seen)}</TableCell>
                    <TableCell>{formatDate(it.expires_at)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2" onClick={(e)=>e.stopPropagation()}>
                        <Button size="sm" variant="bordered" onPress={() => { setGrantTarget(it); setGrantOpen(true); }}>
                          Parolayı Göster
                        </Button>
                        <Button size="sm" color={it.is_active ? "success" : "warning"} variant="solid" onPress={() => onRotate(it.uuid)}>
                          Döndür
                        </Button>
                        <Button size="sm" color="secondary" variant="bordered" onPress={() => openHistory(it.uuid)}>
                          Tarihçe
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Seçim aksiyon barı */}
      {selectedKeys.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full border border-gray-200 dark:border-gray-800 bg-background shadow-md flex items-center gap-3">
          <div className="text-sm">Seçili: {selectedKeys.length}</div>
          <Button size="sm" color={bulkColor as any} variant="solid" onPress={onBulkRotate}>
            Toplu Döndür
          </Button>
          <Button size="sm" variant="bordered" onPress={() => setSelected({})}>Temizle</Button>
        </div>
      )}

      {/* Gizli parola paneli (global) */}
      {secret && (
        <div className="inline-block w-full shadow rounded-2xl border border-gray-200 p-4">
          <h4 className="font-medium mb-2">Parola</h4>
          <Divider className="my-2" />
          <div className="flex items-center gap-2">
            <input
              aria-label="Parola alanı"
              className="border border-gray-200 dark:border-gray-800 rounded px-2 py-1 w-full bg-transparent"
              type={reveal ? "text" : "password"}
              value={secret.password}
              readOnly
            />
            {reveal ? (
              <Button size="sm" color="secondary" variant="flat" onPress={() => setReveal(false)}>
                Gizle ({revealCountdown})
              </Button>
            ) : (
              <Button size="sm" color="secondary" variant="flat" onPress={() => setReveal(true)}>
                Göster ({secret.view_ttl_seconds}s)
              </Button>
            )}
            <Button size="sm" color="primary" variant="flat" onPress={() => copy(secret.password)}>Kopyala</Button>
          </div>
          <div className="text-xs text-gray-500 mt-2">
            Hesap: <b>{secret.account}</b> • Sürüm: v{secret.version} • Bitiş: {formatDate(secret.expires_at)}
          </div>
        </div>
      )}

      {/* Sağ detay paneli */}
      {openDetail && (
        <SidePanel title={`Detay • ${openDetail.hostname || openDetail.uuid}`} onClose={() => setOpenDetail(null)}>
          {/* İzlenen Hesaplar */}
          <CardBox title="İzlenen Hesaplar">
            <div className="flex flex-col gap-2">
              {(accounts[openDetail.uuid] || fallbackAccounts(openDetail)).map((a,i) => (
                <div key={i} className="flex items-center justify-between border rounded-lg px-3 py-2">
                  <div className="font-medium">{a.account_name}</div>
                  <div className="flex gap-2">
                    <Button size="sm" color="primary" variant="flat" onPress={() => onReveal(openDetail.uuid)}>Göster</Button>
                    <Button size="sm" color={openDetail.is_active ? "success" : "warning"} variant="solid" onPress={() => onRotate(openDetail.uuid)}>Döndür</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBox>

          {/* Effective Policy */}
          <CardBox title="Effective Policy">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="Bu istemciye politika ata"
                items={policies}
                selectedKeys={new Set([String(clientPolicy[openDetail.uuid] ?? "")])}
                onSelectionChange={(keys) => {
                  const sel = Array.from(keys as Set<string>)[0];
                  const pid = sel ? Number(sel) : null;
                  setClientPolicy(prev => ({...prev, [openDetail.uuid]: pid}));
                }}
              >
                {(p) => (
                  <SelectItem key={String(p.id)} textValue={p.name}>
                    {p.name} — <span className="text-xs text-foreground/60">{p.account_name}</span>
                  </SelectItem>
                )}
              </Select>

              <Input
                label="(Opsiyonel) Hesap adı override"
                placeholder="Örn: svc-admin"
                value={accountOverride}
                onChange={(e) => setAccountOverride(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2 mt-3">
              <Button
                color="primary"
                variant="solid"
                onPress={async () => {
                  const pid = clientPolicy[openDetail.uuid];
                  if (!pid) return alert("Lütfen bir politika seçin.");
                  try {
                    await api.createAssignment({
                      target_type: "client",
                      target_id: openDetail.uuid,
                      policy: pid,
                      account_name_override: accountOverride?.trim() || undefined,
                    });
                    // başarılı: accounts & history & effective (opsiyonel) tazele
                    try {
                      const list = await api.clientAccounts(openDetail.uuid);
                      setAccounts(prev => ({...prev, [openDetail.uuid]: (list?.length ? list : fallbackAccounts(openDetail))}));
                    } catch {/* ignore */}
                    try {
                      const eff = await api.clientEffectivePolicy(openDetail.uuid);
                      if (eff?.policy?.id) {
                        setClientPolicy(prev => ({...prev, [openDetail.uuid]: eff.policy!.id!}));
                        setClientPolicySource(prev => ({...prev, [openDetail.uuid]: eff.source || null}));
                      }
                    } catch {/* ignore */}
                    const hist = await api.history(openDetail.uuid);
                    setHistoryItems(hist);
                    alert("Atama kaydedildi.");
                  } catch (e: any) {
                    alert("Atama başarısız: " + (e?.message || e));
                  }
                }}
                isDisabled={!clientPolicy[openDetail.uuid]}
              >
                Ata
              </Button>
            </div>

            {/* Özet */}
            <Divider className="my-4" />
            {(() => {
              const pid = clientPolicy[openDetail.uuid];
              const p = policies.find(x => x.id === pid);
              const src = clientPolicySource[openDetail.uuid];
              return p ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  <KV k="Politika" v={p.name} />
                  <KV k="Kaynak" v={src ? (src === "client" ? "İstemci" : src === "group" ? "Grup" : "Organizasyon") : "—"} />
                  <KV k="Hesap" v={accountOverride || p.account_name} />
                  <KV k="Uzunluk" v={String(p.length)} />
                  <KV k="Rotasyon (gün)" v={String(p.rotation_days)} />
                  <KV k="TTL (sn)" v={String(p.view_ttl_seconds)} />
                  <KV k="Karakter seti" v={[
                    p.use_upper && "Büyük",
                    p.use_lower && "Küçük",
                    p.use_digits && "Rakam",
                    p.use_symbols && "Sembol"
                  ].filter(Boolean).join(", ")} />
                </div>
              ) : (
                <div className="text-sm text-foreground/70">Bu istemci için atanmış politika yok.</div>
              );
            })()}
          </CardBox>

          {/* Tarihçe */}
          <CardBox title="Parola Tarihçesi">
            {historyItems.length ? (
              <Table aria-label="history">
                <TableHeader>
                  <TableColumn>Hesap</TableColumn>
                  <TableColumn>Versiyon</TableColumn>
                  <TableColumn>Dönüş Tarihi</TableColumn>
                </TableHeader>
                <TableBody>
                  {historyItems.map((h, i) => (
                    <TableRow key={i}>
                      <TableCell>{h.account_name}</TableCell>
                      <TableCell>v{h.version}</TableCell>
                      <TableCell>{formatDate(h.rotated_at)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-sm text-gray-500">Kayıt yok.</div>
            )}
          </CardBox>
        </SidePanel>
      )}

      {/* Grant modal */}
      {grantOpen && (
        <ModalFrame title="Parola Görüntüleme Onayı" onClose={()=>{ setGrantOpen(false); setJustification(""); setTicket(""); }}>
          <div className="grid grid-cols-1 gap-3">
            <Input label="Gerekçe *" placeholder="Neden bu parolayı görmeniz gerekiyor?" value={justification} onChange={e=>setJustification(e.target.value)} />
            <Input label="Ticket #" placeholder="Örn. INC-12345 (opsiyonel)" value={ticket} onChange={e=>setTicket(e.target.value)} />
            <div className="text-xs text-foreground/70">Bu işlem kayıt altına alınacaktır.</div>
            <div className="flex justify-end gap-2 mt-2">
              <Button variant="bordered" onPress={()=>{ setGrantOpen(false); setJustification(""); setTicket(""); }}>İptal</Button>
              <Button color="primary" isDisabled={justification.trim().length < 8 || !grantTarget} isLoading={grantLoading}
                onPress={async ()=>{
                  if (!grantTarget) return;
                  setGrantLoading(true);
                  try {
                    const g = await api.createGrant({
                      client: grantTarget.uuid || String(grantTarget.id) || grantTarget.hostname,
                      reason: justification.trim(),
                      ticket: ticket.trim() || undefined,
                      ttl: 60,
                    });
                    const s = await api.getSecretWithGrant(grantTarget.uuid, g.grant);
                    setSecret(s);
                    setReveal(true);
                    setGrantOpen(false);
                    setJustification(""); setTicket("");
                  } catch (e:any) {
                    alert("Görüntüleme izni alınamadı: " + (e?.message || e));
                  } finally {
                    setGrantLoading(false);
                  }
                }}
              >
                Onayla ve Göster
              </Button>
            </div>
          </div>
        </ModalFrame>
)}

    </section>
  );
}

/* ===================== Policies View ===================== */

function PoliciesView({policies, loading, onChanged}:{policies: Policy[]; loading: boolean; onChanged: () => void}) {
  const [form, setForm] = useState<Policy>({
    name: "",
    description: "",
    account_name: "Administrator",
    length: 16, use_upper: true, use_lower: true, use_digits: true, use_symbols: true,
    rotation_days: 30, view_ttl_seconds: 15, history_keep: 10,
    backup_directory: "db",
    post_auth_action: "none", post_auth_delay_minutes: 0,
    enforce_max_age: true, rotate_on_unlock: false, allow_plaintext_backup: false,
    rename_admin: false, rename_admin_to: "",
    readers: [],
    disabled: false,
  });

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 py-6">
      {/* Liste */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-medium">Mevcut Politikalar</div>
          <Button size="sm" color="primary" onPress={() => setForm({
            id: undefined,
            name: "", description: "",
            account_name: "Administrator",
            length: 16, use_upper: true, use_lower: true, use_digits: true, use_symbols: true,
            rotation_days: 30, view_ttl_seconds: 15, history_keep: 10,
            backup_directory: "db",
            post_auth_action: "none", post_auth_delay_minutes: 0,
            enforce_max_age: true, rotate_on_unlock: false, allow_plaintext_backup: false,
            rename_admin: false, rename_admin_to: "",
            readers: [],
            disabled: false,
          })}>+ Yeni</Button>
        </div>
        <Divider className="my-2" />
        {loading ? (
          <div className="py-8 flex justify-center"><Spinner /></div>
        ) : (
          <Table aria-label="policies">
            <TableHeader>
              <TableColumn>Ad</TableColumn>
              <TableColumn>Hesap</TableColumn>
              <TableColumn>Uzunluk</TableColumn>
              <TableColumn>Rotasyon</TableColumn>
              <TableColumn>Durum</TableColumn>
              <TableColumn>Aksiyon</TableColumn>
            </TableHeader>
            <TableBody>
              {policies.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.account_name}</TableCell>
                  <TableCell>{p.length}</TableCell>
                  <TableCell>{p.rotation_days} gün</TableCell>
                  <TableCell>{p.disabled ? <Chip size="sm" color="danger" variant="flat">Pasif</Chip> : <Chip size="sm" color="success" variant="flat">Aktif</Chip>}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" color="secondary" variant="bordered" onPress={() => setForm(p)}>Düzenle</Button>
                      <Button size="sm" color="danger" variant="bordered" onPress={async () => {
                        if (!p.id) return;
                        if (!confirm(`'${p.name}' politikası silinsin mi?`)) return;
                        await api.deletePolicy(p.id);
                        await onChanged();
                      }}>
                        <DeleteIcon />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {(!policies.length && !loading) && <div className="text-sm text-gray-500 p-3">Politika yok.</div>}
      </div>

      {/* Form */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <div className="font-medium mb-3">{form?.id ? "Politika Düzenle" : "Yeni Politika"}</div>
        <Divider className="my-2" />

        {/* Şifre İlkeleri */}
        <div className="mb-2 font-medium">Şifre İlkeleri</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Input label="* Ad" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
          <Input label="* Hesap Adı" value={form.account_name} onChange={e => setForm(f => ({...f, account_name: e.target.value}))} />
          <Input type="number" label="* Uzunluk" value={String(form.length)} onChange={e => setForm(f => ({...f, length: Number(e.target.value)}))} />
          <Input type="number" label="* Rotasyon (gün)" value={String(form.rotation_days)} onChange={e => setForm(f => ({...f, rotation_days: Number(e.target.value)}))} />
          <Input type="number" label="Reveal TTL (sn)" value={String(form.view_ttl_seconds)} onChange={e => setForm(f => ({...f, view_ttl_seconds: Number(e.target.value)}))} />
          <Input type="number" label="Geçmiş Sakla (adet)" value={String(form.history_keep)} onChange={e => setForm(f => ({...f, history_keep: Number(e.target.value)}))} />
          <div className="col-span-3 grid grid-cols-4 gap-2">
            <Switch isSelected={form.use_upper} onValueChange={v => setForm(f => ({...f, use_upper: v}))}>Büyük</Switch>
            <Switch isSelected={form.use_lower} onValueChange={v => setForm(f => ({...f, use_lower: v}))}>Küçük</Switch>
            <Switch isSelected={form.use_digits} onValueChange={v => setForm(f => ({...f, use_digits: v}))}>Rakam</Switch>
            <Switch isSelected={form.use_symbols} onValueChange={v => setForm(f => ({...f, use_symbols: v}))}>Sembol</Switch>
          </div>
        </div>

        {/* Post-Auth */}
        <div className="mb-2 font-medium">Post-Authentication</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Select
            label="Eylem"
            selectedKeys={new Set([form.post_auth_action])}
            onSelectionChange={(keys) => setForm(f => ({...f, post_auth_action: Array.from(keys as Set<string>)[0] as any}))}
          >
            <SelectItem key="none">Yok</SelectItem>
            <SelectItem key="reset">ResetPassword</SelectItem>
            <SelectItem key="logoff">Logoff</SelectItem>
            <SelectItem key="reboot">Reboot</SelectItem>
            <SelectItem key="shutdown">Shutdown</SelectItem>
          </Select>
          <Input type="number" label="Gecikme (dk)" value={String(form.post_auth_delay_minutes)} onChange={e => setForm(f => ({...f, post_auth_delay_minutes: Number(e.target.value)}))} />
          <Switch isSelected={form.rotate_on_unlock} onValueChange={v => setForm(f => ({...f, rotate_on_unlock: v}))}>Unlock sonrası reset</Switch>
        </div>

        {/* Yedekleme & Erişim */}
        <div className="mb-2 font-medium">Yedekleme & Erişim</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Select
            label="Yedekleme Yeri"
            selectedKeys={new Set([form.backup_directory])}
            onSelectionChange={(keys) => setForm(f => ({...f, backup_directory: Array.from(keys as Set<string>)[0] as any}))}
          >
            <SelectItem key="db">Sunucu DB</SelectItem>
            <SelectItem key="none">Kapalı</SelectItem>
          </Select>
          <Switch isSelected={form.enforce_max_age} onValueChange={v => setForm(f => ({...f, enforce_max_age: v}))}>Maks. yaş zorunlu</Switch>
          <Switch isSelected={form.allow_plaintext_backup} onValueChange={v => setForm(f => ({...f, allow_plaintext_backup: v}))}>Düz metin yedekleme</Switch>
          <div className="md:col-span-3">
            <Input
              label="Parola okuyabilenler (virgülle ayırın)"
              value={form.readers.join(", ")}
              onChange={e => setForm(f => ({...f, readers: e.target.value.split(",").map(s => s.trim()).filter(Boolean)}))}
            />
          </div>
        </div>

        {/* Admin Rename */}
        <div className="mb-2 font-medium">Yönetici Hesabı Yeniden Adlandırma</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <Switch isSelected={form.rename_admin} onValueChange={v => setForm(f => ({...f, rename_admin: v}))}>Yeniden adlandır</Switch>
          <Input label="Yeni Ad" value={form.rename_admin_to} onChange={e => setForm(f => ({...f, rename_admin_to: e.target.value}))} />
        </div>

        {/* Açıklama & Kaydet */}
        <div className="mb-2 font-medium">Açıklama</div>
        <Textarea value={form.description || ""} onChange={(e) => setForm(f => ({...f, description: e.target.value}))} />

        <div className="mt-4 flex items-center justify-between">
          <Switch isSelected={!!form.disabled} onValueChange={(v) => setForm(f => ({...f, disabled: v}))}>Politikayı pasifleştir</Switch>
          <div className="flex gap-2">
            <Button variant="bordered" onPress={() => setForm({
              id: undefined,
              name: "", description: "",
              account_name: "Administrator",
              length: 16, use_upper: true, use_lower: true, use_digits: true, use_symbols: true,
              rotation_days: 30, view_ttl_seconds: 15, history_keep: 10,
              backup_directory: "db",
              post_auth_action: "none", post_auth_delay_minutes: 0,
              enforce_max_age: true, rotate_on_unlock: false, allow_plaintext_backup: false,
              rename_admin: false, rename_admin_to: "",
              readers: [],
              disabled: false,
            })}>Temizle</Button>
            <Button color="primary" variant="solid" onPress={async () => {
              try {
                await api.savePolicy(form);
                await onChanged();
                alert("Kaydedildi.");
              } catch (e: any) {
                alert("Kaydedilemedi: " + (e?.message || e));
              }
            }}>Kaydet</Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ===================== Assignments (Connected) ===================== */

function AssignmentsConnected() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const list = await api.listAssignments();
      setItems(list);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  return (
    <section className="py-8">
      <CardBox title="Atamalar">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm text-foreground/70">İstemci / Grup / Organizasyon seviyesinde yapılan policy atamaları.</div>
          <Button variant="bordered" onPress={load} isDisabled={loading}>
            {loading ? <Spinner size="sm" /> : "Yenile"}
          </Button>
        </div>
        <Table aria-label="assignments">
          <TableHeader>
            <TableColumn>ID</TableColumn>
            <TableColumn>Hedef Tür</TableColumn>
            <TableColumn>Hedef ID</TableColumn>
            <TableColumn>Policy ID</TableColumn>
            <TableColumn>Hesap Override</TableColumn>
            <TableColumn>Durum</TableColumn>
            <TableColumn>Aksiyon</TableColumn>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.id}>
                <TableCell>#{it.id}</TableCell>
                <TableCell>{it.target_type}</TableCell>
                <TableCell className="break-all">{it.target_id}</TableCell>
                <TableCell>{it.policy}</TableCell>
                <TableCell>{it.account_name_override || "—"}</TableCell>
                <TableCell><Chip size="sm" variant="flat">Etkin</Chip></TableCell>
                <TableCell>
                  <Button size="sm" color="danger" variant="bordered" onPress={async ()=>{
                    if (!confirm(`#${it.id} atamayı silmek istiyor musunuz?`)) return;
                    await api.deleteAssignment(it.id);
                    setItems(prev => prev.filter(x => x.id !== it.id));
                  }}>
                    Sil
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {(!items.length && !loading) && <div className="text-sm text-foreground/60 p-3">Atama yok.</div>}
      </CardBox>
    </section>
  );
}

/* ===================== Placeholders ===================== */



function AuditView() {
  const [q, setQ] = useState("");
  const [action, setAction] = useState<""|"rotate"|"view"|"report"|"bulk_rotate"|"error">("");
  const [client, setClient] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  async function load(p=page) {
    setLoading(true);
    try {
      const res = await api.listLogs({
        q, action, client, date_from: dateFrom, date_to: dateTo,
        page: p, page_size: pageSize,
      });
      setRows(res.items);
      setTotal(res.total);
      setPage(res.page);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(1); /* filtre değişince başa dön */ }, [action, pageSize]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function chipFor(a: string) {
    const map: Record<string, any> = {
      rotate:   {label: "Rotate", color: "success"},
      view:     {label: "View", color: "secondary"},
      report:   {label: "Report", color: "warning"},
      bulk_rotate: {label: "Bulk", color: "primary"},
      error:    {label: "Error", color: "danger"},
    };
    const it = map[a] || {label: a, color: "default"};
    return <Chip size="sm" color={it.color as any} variant="flat">{it.label}</Chip>;
  }

  return (
    <section className="py-6 flex flex-col gap-4">
      <div className="inline-block w-full p-3 shadow rounded-lg border border-gray-200">
        <h4 className="flex gap-2 font-medium mb-2">Filtreler</h4>
        <Divider className="my-2" />
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <Input label="Ara (hostname/uuid/user/result/account)" value={q} onChange={e=>setQ(e.target.value)} />
          <Select
            label="Aksiyon"
            selectedKeys={new Set([action])}
            onSelectionChange={(k)=>setAction(Array.from(k as Set<string>)[0] as any)}
          >
            <SelectItem key="">Tümü</SelectItem>
            <SelectItem key="rotate">Rotate</SelectItem>
            <SelectItem key="view">View</SelectItem>
            <SelectItem key="report">Report</SelectItem>
            <SelectItem key="bulk_rotate">Bulk</SelectItem>
            <SelectItem key="error">Error</SelectItem>
          </Select>
          <Input label="Client (id/uuid/hostname)" value={client} onChange={e=>setClient(e.target.value)} />
          <Input type="date" label="Başlangıç" value={dateFrom} onChange={e=>setDateFrom(e.target.value)} />
          <Input type="date" label="Bitiş" value={dateTo} onChange={e=>setDateTo(e.target.value)} />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button color="primary" variant="solid" onPress={()=>load(1)} isDisabled={loading}>
            {loading ? <Spinner size="sm" /> : "Uygula"}
          </Button>
          <Button variant="bordered" onPress={()=>{
            setQ(""); setAction(""); setClient(""); setDateFrom(""); setDateTo("");
            setPage(1); setPageSize(50); load(1);
          }}>Sıfırla</Button>
        </div>
      </div>

      <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200">
        <div className="flex justify-between items-center px-6 pt-6 pb-2">
          <h2 className="text-2xl font-bold tracking-tight">Kayıtlar</h2>
          <div className="flex items-center gap-2">
            <Select
              aria-label="Sayfa boyutu"
              selectedKeys={new Set([String(pageSize)])}
              onSelectionChange={(k)=>setPageSize(Number(Array.from(k as Set<string>)[0]))}
              className="w-28"
            >
              <SelectItem key="25">25</SelectItem>
              <SelectItem key="50">50</SelectItem>
              <SelectItem key="100">100</SelectItem>
              <SelectItem key="200">200</SelectItem>
            </Select>
            <Button variant="bordered" onPress={()=>load(page)} isDisabled={loading}>
              {loading ? <Spinner size="sm" /> : "Yenile"}
            </Button>
          </div>
        </div>
        <p className="text-sm px-6 pb-4 text-foreground/70">
          Rotasyonlar, görüntülemeler, ajan raporlamaları ve toplu işlemler.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Spinner label="Yükleniyor..." />
          </div>
        ) : (
          <Table aria-label="logs table">
            <TableHeader>
              <TableColumn>Zaman</TableColumn>
              <TableColumn>Aksiyon</TableColumn>
              <TableColumn>İstemci</TableColumn>
              <TableColumn>Hesap</TableColumn>
              <TableColumn>Versiyon</TableColumn>
              <TableColumn>İsteyen</TableColumn>
              <TableColumn>Sonuç</TableColumn>
            </TableHeader>
            <TableBody emptyContent={"Kayıt yok."}>
              {rows.map((r:any) => (
                <TableRow key={r.id}>
                  <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                  <TableCell>{chipFor(r.action)}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{r.client_hostname || "—"}</span>
                      <span className="text-xs text-foreground/60 break-all">{r.client_uuid}</span>
                    </div>
                  </TableCell>
                  <TableCell>{r.account_name || "—"}</TableCell>
                  <TableCell>{r.secret_version ? `v${r.secret_version}` : "—"}</TableCell>
                  <TableCell>{r.requested_by || "—"}</TableCell>
                  <TableCell className="max-w-[360px] truncate" title={r.result || ""}>{r.result || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-6 py-4">
          <div className="text-sm text-foreground/70">
            Toplam {total} kayıt • Sayfa {page}/{totalPages}
          </div>
          <div className="flex gap-2">
            <Button
              variant="bordered"
              isDisabled={page <= 1}
              onPress={()=>{ const p = Math.max(1, page-1); load(p); }}
            >
              ‹ Önceki
            </Button>
            <Button
              variant="bordered"
              isDisabled={page >= totalPages}
              onPress={()=>{ const p = Math.min(totalPages, page+1); load(p); }}
            >
              Sonraki ›
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ===================== UI Helpers ===================== */

function CardBox({title, children}:{title: string; children: React.ReactNode}) {
  return (
    <div className="inline-block w-full p-3 shadow rounded-lg border border-gray-200">
      <h4 className="flex gap-2 font-medium mb-2">{title}</h4>
      <Divider className="my-2" />
      {children}
    </div>
  );
}

// Simple ModalFrame implementation
function ModalFrame({title, onClose, children}:{title: string; onClose: () => void; children: React.ReactNode}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-xl shadow-lg border border-gray-200 dark:border-gray-800 p-6 w-full max-w-md mx-auto">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-foreground/70 hover:text-foreground" aria-label="Kapat">
            <CloseIcon />
          </button>
        </div>
        <div className="pt-4">{children}</div>
      </div>
    </div>
  );
}

function SidePanel({title, onClose, children}:{title: string; onClose: () => void; children: React.ReactNode}) {
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[560px] bg-background border-l border-gray-200 dark:border-gray-800 shadow-xl p-6 overflow-y-auto">
        <div className="flex justify-between items-center pb-4 border-b border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-foreground/70 hover:text-foreground" aria-label="Kapat">
            <CloseIcon />
          </button>
        </div>
        <div className="pt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

function KV({k, v}:{k: string; v: React.ReactNode}) {
  return (
    <div className="text-sm">
      <div className="text-foreground/60">{k}</div>
      <div className="font-medium">{v || "—"}</div>
    </div>
  );
}

