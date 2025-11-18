'use client';

import DefaultLayout from "@/layouts/default";
import React, {useEffect, useMemo, useRef, useState} from "react";
import {Input} from "@heroui/input";
import {Select, SelectItem} from "@heroui/select";
import {Button} from "@heroui/button";
import {Chip} from "@heroui/chip";
import {Table, TableBody, TableCell, TableColumn, TableHeader, TableRow} from "@heroui/table";
import {CloseIcon, DeleteIcon, EditIcon, OrganizationIcon, UserGroupIcon, UserIcon} from "@/components/icons";

// ===================== Types =====================

type LdapUser = {
  dn: string;
  uid: string;
  givenName: string;
  sn: string;
  mail?: string;
  phone?: string;
  userPassword?: string;
  uidNumber?: number;
  gidNumber?: number;
  homeDirectory?: string;
  isActive?: boolean;
  groups?: string[]; 
};

type LdapGroup = {
  dn: string;
  name: string;
  description?: string;
  members: string[]; 
};

type LdapOrganization = {
  dn: string;
  name: string;
  description?: string;
  groups: LdapGroup[];
  users: LdapUser[];
};

type LdapTree = {
  domain: string; 
  organizations: LdapOrganization[];
};

type NodeKind = "domain" | "organization" | "group" | "user";

type TreeNodeRef = {
  kind: NodeKind;
  dn: string;
};

// ===================== Helper utils =====================

const MIN_UID_GID = 10000;

function nextFreeNumber(taken: Set<number>, start = MIN_UID_GID) {
  let n = start;
  while (taken.has(n)) n++;
  return n;
}

function classNames(...parts: (string | false | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}
function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
function downloadAsFile(filename: string, data: any) {
  const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], { type: "application/json" });
  downloadBlob(filename, blob);
}
function b64(str: string) { return btoa(unescape(encodeURIComponent(str))); }
function b64p(str: string) { return encodeURIComponent(btoa(unescape(encodeURIComponent(str)))); }

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// ===================== API =====================

const api = {
  // ---- Tree ----
  async loadTree(): Promise<LdapTree> {
     const res = await fetch(`${API_BASE}/ldap/api/tree/`);
     if (!res.ok) throw new Error('Tree load failed');
     return res.json();
  },

  async suggestIds(orgDn: string, groupDn?: string): Promise<{uidNumber: number; gidNumber: number}> {
    const qs = new URLSearchParams({ orgDn });
    if (groupDn) qs.set("groupDn", groupDn);
    const res = await fetch(`${API_BASE}/ldap/api/next-ids/?${qs.toString()}`);
    if (!res.ok) throw new Error("next-ids failed");
    return res.json();
  },

  // ---- Orgs ----
  async createOrganization(payload: {name: string; description?: string}) {
    const r = await fetch(`${API_BASE}/ldap/api/organizations/`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`createOrganization failed: ${r.status}`);
    return r.json() as Promise<{dn: string}>;
  },
  async updateOrganization(dn: string, payload: {name?: string; description?: string}) {
    const r = await fetch(`${API_BASE}/ldap/api/organizations/${b64p(dn)}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`updateOrganization failed: ${r.status}`);
    return {dn, ...payload};
  },
  async deleteOrganization(dn: string) {
    const r = await fetch(`${API_BASE}/ldap/api/organizations/${b64p(dn)}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`deleteOrganization failed: ${r.status}`);
    return {dn};
  },

  // ---- Groups ----
  async createGroup(payload: {organizationDn: string; name: string; description?: string}) {
    const r = await fetch(`${API_BASE}/ldap/api/groups/`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`createGroup failed: ${r.status}`);
    return r.json() as Promise<{dn: string}>;
  },
  async updateGroup(dn: string, payload: {name?: string; description?: string}) {
    const r = await fetch(`${API_BASE}/ldap/api/groups/${b64p(dn)}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (!r.ok) throw new Error(`updateGroup failed: ${r.status}`);
    return {dn, ...payload};
  },
  async deleteGroup(dn: string) {
    const r = await fetch(`${API_BASE}/ldap/api/groups/${b64p(dn)}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`deleteGroup failed: ${r.status}`);
    return {dn};
  },

  // ---- Users ----
  async createUser(payload: {organizationDn: string; groupDn: string; user: Partial<LdapUser>}) {
    const res = await fetch(`${API_BASE}/ldap/api/users/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`createUser failed: ${res.status} ${t}`);
    }
    return res.json() as Promise<{dn: string}>;
  },
  async updateUser(dn: string, payload: Partial<LdapUser>) {
    const res = await fetch(`${API_BASE}/ldap/api/users/${b64p(dn)}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      throw new Error(`updateUser failed: ${res.status} ${t}`);
    }
    return {dn, ...payload};
  },
  async deleteUser(dn: string) {
    const r = await fetch(`${API_BASE}/ldap/api/users/${b64p(dn)}/`, { method: 'DELETE' });
    if (!r.ok) throw new Error(`deleteUser failed: ${r.status}`);
    return {dn};
  },
  async moveUser(dn: string, toGroupDn: string) {
    const r = await fetch(`${API_BASE}/ldap/api/users/${b64p(dn)}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({toGroupDn}) });
    if (!r.ok) throw new Error(`moveUser failed: ${r.status}`);
    return {dn, toGroupDn};
  },

  // ---- Export  ----
  async export(scope: { kind: string; dn?: string }, file_format: "ldif" | "pdf" | "json") {
    const qs = new URLSearchParams({ kind: scope.kind, file_format });
    if (scope.dn) qs.set("dn_b64", b64(scope.dn));
    const url = `${API_BASE}/ldap/api/export/?${qs.toString()}`;
    const res = await fetch(url, { method: "GET", credentials: "include" });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Backend dışa aktarma hatası: ${res.status} ${txt}`);
    }
    const disposition = res.headers.get("Content-Disposition") || '';
    let filename = `ldap_export_${scope.kind}.${file_format}`;
    const m = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (m && m[1]) filename = m[1].replace(/['"]/g, "");
    const blob = await res.blob();
    return { filename, blob };
  },

    // ---- Import ----
  async validateImport(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`${API_BASE}/ldap/api/import/validate/`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Doğrulama başarısız");
    return data; 
  },

  async applyImport(opts: { file?: File; planId?: string }) {
    const fd = new FormData();
    if (opts.planId) fd.append("planId", opts.planId);
    if (opts.file)   fd.append("file", opts.file);
    const res = await fetch(`${API_BASE}/ldap/api/import/apply/`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Apply başarısız");
    return data; 
  },

};

// ===================== Tree helpers =====================

function findOrg(tree: LdapTree, orgDn: string) {
  return tree.organizations.find((o) => o.dn === orgDn);
}
function findGroup(org: LdapOrganization, groupDn: string) {
  return org.groups.find((g) => g.dn === groupDn);
}
function findUser(org: LdapOrganization, userDn: string) {
  return org.users.find((u) => u.dn === userDn);
}

function useOrgOptions(tree: LdapTree | null) {
  return useMemo(() => tree?.organizations.map((o) => ({key: o.dn, label: o.name})) ?? [], [tree]);
}
function useGroupOptions(tree: LdapTree | null, orgDn?: string) {
  return useMemo(() => {
    if (!tree) return [] as {key: string; label: string}[];
    const groups = orgDn ? findOrg(tree, orgDn)?.groups ?? [] : tree.organizations.flatMap((o) => o.groups);
    return groups.map((g) => ({key: g.dn, label: g.name}));
  }, [tree, orgDn]);
}

function buildTreeNodes(tree: LdapTree, query: string) {
  const q = query.trim().toLowerCase();
  const match = (s: string | undefined) => (q ? (s || "").toLowerCase().includes(q) : true);
  const result: { id: string; kind: NodeKind; label: string; dn: string; children?: any[] } = {
    id: tree.domain,
    dn: tree.domain,
    kind: "domain",
    label: tree.domain,
    children: [],
  };
  for (const org of tree.organizations) {
    const orgNode = {
      id: org.dn,
      dn: org.dn,
      kind: "organization" as const,
      label: org.name,
      children: [] as any[],
    };
    let includeOrg = match(org.name) || match(org.description);

    for (const grp of org.groups) {
      const grpNode = {
        id: grp.dn,
        dn: grp.dn,
        kind: "group" as const,
        label: grp.name,
        children: [] as any[],
      };
      let includeGroup = match(grp.name) || match(grp.description);

      for (const usr of org.users) {
        const inGroup = grp.members.includes(usr.dn);
        if (!inGroup) continue;
        const usrNode = {
          id: usr.dn,
          dn: usr.dn,
          kind: "user" as const,
          label: usr.uid + (usr.givenName ? ` (${usr.givenName} ${usr.sn})` : ""),
        };
        if (includeGroup || match(usr.uid) || match(usr.givenName) || match(usr.sn) || match(usr.mail)) {
          grpNode.children.push(usrNode);
          includeGroup = true;
        }
      }
      if (includeGroup) {
        orgNode.children.push(grpNode);
        includeOrg = true;
      }
    }

    const directUsers = org.users.filter((u) => !org.groups.some((g) => g.members.includes(u.dn)));
    for (const usr of directUsers) {
      const usrNode = {
        id: usr.dn,
        dn: usr.dn,
        kind: "user" as const,
        label: usr.uid + (usr.givenName ? ` (${usr.givenName} ${usr.sn})` : ""),
      };
      if (match(usr.uid) || match(usr.givenName) || match(usr.sn) || match(usr.mail)) {
        orgNode.children.push(usrNode);
        includeOrg = true;
      }
    }

    if (includeOrg) result.children!.push(orgNode);
  }
  return result;
}

// ===================== Page =====================

export default function LdapManagementPage() {
  const [tree, setTree] = useState<LdapTree | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<TreeNodeRef | null>(null);

  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [moveUserModalOpen, setMoveUserModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "ldif" | "pdf">("json");

  const [orgForm, setOrgForm] = useState<{dn?: string; name: string; description?: string}>({name: ""});
  const [groupForm, setGroupForm] = useState<{dn?: string; name: string; description?: string; organizationDn: string | ""}>({name: "", description: "", organizationDn: ""});
  const [userForm, setUserForm] = useState<
  Partial<LdapUser> & {
    organizationDn: string | "";
    groupDn?: string | "";
    manualUidGid?: boolean;
    manualHome?: boolean;
  }
>({
  organizationDn: "",
  groupDn: "",
  uid: "",
  givenName: "",
  sn: "",
  userPassword: "",
  manualUidGid: false,
  manualHome: false,
});
  const [moveUser, setMoveUser] = useState<{userDn: string; fromGroupDn?: string; toGroupDn: string | ""}>({userDn: "", toGroupDn: ""});

  const orgOptions = useOrgOptions(tree);
  const groupOptions = useGroupOptions(tree, userForm.organizationDn || undefined);
  const builtTree = useMemo(() => (tree ? buildTreeNodes(tree, search) : null), [tree, search]);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any | null>(null); 
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);


  useEffect(() => {
    if (!userModalOpen) return;
    if (!userForm.organizationDn || !userForm.groupDn) return;
    if (userForm.manualUidGid) return;
    if (userForm.dn) return;
    api
      .suggestIds(userForm.organizationDn, userForm.groupDn || undefined)
      .then(({ uidNumber, gidNumber }) => {
        setUserForm(f => ({ ...f, uidNumber, gidNumber }));
      })
      .catch((e) => console.error("suggestIds error:", e));
  }, [userModalOpen, userForm.organizationDn, userForm.groupDn, userForm.manualUidGid, userForm.dn]);

  const load = async () => {
    try {
      setLoading(true);
      const data = await api.loadTree();
      setTree(data);
      setExpanded(new Set([data.domain]));
    } catch (e) {
      console.error(e);
      alert("Ağaç yüklenemedi.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const toggle = (dn: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(dn)) n.delete(dn);
      else n.add(dn);
      return n;
    });
  };
  const expandAll = () => {
    if (!tree) return;
    const all = new Set<string>();
    all.add(tree.domain);
    for (const o of tree.organizations) {
      all.add(o.dn);
      for (const g of o.groups) all.add(g.dn);
    }
    setExpanded(all);
  };
  const collapseAll = () => setExpanded(new Set());

  const currentDetails = useMemo(() => {
    if (!tree || !selected) return null;
    if (selected.kind === "domain") return {kind: selected.kind, node: {dn: tree.domain}};
    if (selected.kind === "organization") {
      const org = findOrg(tree, selected.dn);
      return org ? {kind: selected.kind, node: org} : null;
    }
    if (selected.kind === "group") {
      for (const org of tree.organizations) {
        const grp = findGroup(org, selected.dn);
        if (grp) return {kind: selected.kind, node: grp, org};
      }
      return null;
    }
    if (selected.kind === "user") {
      for (const org of tree.organizations) {
        const usr = findUser(org, selected.dn);
        if (usr) return {kind: selected.kind, node: usr, org};
      }
      return null;
    }
    return null;
  }, [selected, tree]);

  // ===================== CRUD handlers  =====================
  const handleOpenCreateOrg = () => { setOrgForm({name: "", description: ""}); setOrgModalOpen(true); };
  const handleOpenEditOrg = (org: LdapOrganization) => { setOrgForm({dn: org.dn, name: org.name, description: org.description}); setOrgModalOpen(true); };
  const handleSubmitOrg = async () => {
    if (!tree) return;
    if (!orgForm.name) return alert("Organizasyon adı zorunlu");
    if (orgForm.dn) {
      await api.updateOrganization(orgForm.dn, {name: orgForm.name, description: orgForm.description});
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const org = findOrg(copy, orgForm.dn!);
        if (org) { org.name = orgForm.name; org.description = orgForm.description; }
        return copy;
      });
    } else {
      const {dn} = await api.createOrganization({name: orgForm.name, description: orgForm.description});
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        copy.organizations.push({dn, name: orgForm.name, description: orgForm.description, groups: [], users: []});
        return copy;
      });
    }
    setOrgModalOpen(false);
  };

  const handleDeleteOrg = async (org: LdapOrganization) => {
    if (!confirm(`${org.name} organizasyonu silinsin mi?`)) return;
    await api.deleteOrganization(org.dn);
    setTree((prev) => {
      if (!prev) return prev;
      const copy: LdapTree = JSON.parse(JSON.stringify(prev));
      copy.organizations = copy.organizations.filter((o) => o.dn !== org.dn);
      return copy;
    });
    setSelected(null);
  };

  const handleOpenCreateGroup = (defaultOrgDn?: string) => {
    setGroupForm({dn: undefined, name: "", description: "", organizationDn: defaultOrgDn || ""});
    setGroupModalOpen(true);
  };
  const handleOpenEditGroup = (grp: LdapGroup, orgDn: string) => {
    setGroupForm({dn: grp.dn, name: grp.name, description: grp.description, organizationDn: orgDn});
    setGroupModalOpen(true);
  };
  const handleSubmitGroup = async () => {
    if (!tree) return;
    if (!groupForm.name || !groupForm.organizationDn) return alert("Grup adı ve organizasyon zorunludur");
    const org = findOrg(tree, groupForm.organizationDn);
    if (!org) return alert("Organizasyon bulunamadı");

    if (groupForm.dn) {
      await api.updateGroup(groupForm.dn, {name: groupForm.name, description: groupForm.description});
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const o = findOrg(copy, groupForm.organizationDn);
        const g = o && findGroup(o, groupForm.dn!);
        if (g) { g.name = groupForm.name; g.description = groupForm.description; }
        return copy;
      });
    } else {
      const {dn: newDn} = await api.createGroup({organizationDn: groupForm.organizationDn, name: groupForm.name, description: groupForm.description});
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const o = findOrg(copy, groupForm.organizationDn!);
        if (o) o.groups.push({dn: newDn, name: groupForm.name, description: groupForm.description, members: []});
        return copy;
      });
    }
    setGroupModalOpen(false);
  };

  const handleDeleteGroup = async (grp: LdapGroup, orgDn: string) => {
    if (!confirm(`${grp.name} grubu silinsin mi?`)) return;
    await api.deleteGroup(grp.dn);
    setTree((prev) => {
      if (!prev) return prev;
      const copy: LdapTree = JSON.parse(JSON.stringify(prev));
      const o = findOrg(copy, orgDn);
      if (o) {
        o.groups = o.groups.filter((g) => g.dn !== grp.dn);
        for (const u of o.users) u.groups = (u.groups || []).filter((g) => g !== grp.dn);
      }
      return copy;
    });
    setSelected({kind: "organization", dn: orgDn});
  };

  const handleOpenCreateUser = (defaults?: {orgDn?: string; groupDn?: string}) => {
    setUserForm({
      dn: undefined,
      organizationDn: defaults?.orgDn || "",
      groupDn: defaults?.groupDn || "",
      uid: "",
      givenName: "",
      sn: "",
      mail: "",
      phone: "",
      userPassword: "",
      uidNumber: undefined,
      gidNumber: undefined,
      homeDirectory: "",
      isActive: true,
      manualUidGid: false,
      manualHome: false,
    });
    setUserModalOpen(true);
  };
  const handleOpenEditUser = (usr: LdapUser, orgDn: string) => {
    const groupDn = usr.groups?.[0] || "";
    setUserForm({
      dn: usr.dn,
      organizationDn: orgDn,
      groupDn,
      uid: usr.uid,
      givenName: usr.givenName,
      sn: usr.sn,
      mail: usr.mail,
      phone: usr.phone,
      userPassword: "",
      uidNumber: usr.uidNumber,
      gidNumber: usr.gidNumber,
      homeDirectory: usr.homeDirectory,
      isActive: usr.isActive,
      manualUidGid: false,
      manualHome: false,
    });
    setUserModalOpen(true);
  };
  const handleSubmitUser = async () => {
    if (!tree) return;
    if (!userForm.uid || !userForm.givenName || !userForm.sn || !userForm.organizationDn) {
      return alert("Kullanıcı adı, ad, soyad ve organizasyon zorunludur");
    }
    if (uidNumError) return alert("uidNumber geçersiz ya da kullanımda.");

    const payloadUser: any = {
      uid: userForm.uid,
      givenName: userForm.givenName,
      sn: userForm.sn,
      mail: userForm.mail,
      phone: userForm.phone,
      isActive: userForm.isActive,
    };

    if (userForm.userPassword) payloadUser.userPassword = userForm.userPassword;
    if (userForm.manualUidGid) {
      if (userForm.uidNumber != null) payloadUser.uidNumber = Number(userForm.uidNumber);
      if (userForm.gidNumber != null) payloadUser.gidNumber = Number(userForm.gidNumber);
    }
    payloadUser.homeDirectory = userForm.manualHome ? (userForm.homeDirectory || "") : computedHome;

    if (userForm.dn) {
      await api.updateUser(userForm.dn, payloadUser);
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const o = findOrg(copy, userForm.organizationDn!);
        if (!o) return prev;
        const u = findUser(o, userForm.dn!);
        if (u) {
          Object.assign(u, payloadUser);
          if (userForm.groupDn) {
            const allGroups = new Set<string>(u.groups || []);
            allGroups.add(userForm.groupDn);
            u.groups = Array.from(allGroups);
            const g = findGroup(o, userForm.groupDn);
            if (g && !g.members.includes(u.dn)) g.members.push(u.dn);
          }
        }
        return copy;
      });
    } else {
      if (!userForm.groupDn) return alert("Grup zorunlu");
      const newUserPayload: any = {
        dn: "",
        uid: userForm.uid!,
        givenName: userForm.givenName!,
        sn: userForm.sn!,
        mail: userForm.mail,
        phone: userForm.phone,
        userPassword: userForm.userPassword || undefined,
        uidNumber: userForm.uidNumber,
        gidNumber: userForm.gidNumber,
        homeDirectory: userForm.homeDirectory || `/home/${userForm.uid}`,
        isActive: userForm.isActive ?? true,
        groups: [userForm.groupDn],
      };
      const { dn } = await api.createUser({
        organizationDn: userForm.organizationDn!,
        groupDn: userForm.groupDn!,
        user: newUserPayload,
      });
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const o = findOrg(copy, userForm.organizationDn!);
        if (!o) return prev;
        const concreteUser: LdapUser = { ...newUserPayload, dn };
        o.users.push(concreteUser);
        const g = findGroup(o, userForm.groupDn!);
        if (g && !g.members.includes(dn)) g.members.push(dn);
        return copy;
      });
    }
    setUserModalOpen(false);
  };

  const takenUidNumbers = useMemo(() => {
    if (!tree || !userForm.organizationDn) return new Set<number>();
    const org = findOrg(tree, userForm.organizationDn);
    const s = new Set<number>();
    org?.users.forEach((u) => {
      if (u.uidNumber != null && u.dn !== userForm.dn) s.add(Number(u.uidNumber));
    });
    return s;
  }, [tree, userForm.organizationDn, userForm.dn]);

  const uidNumError = !!userForm.manualUidGid && (
    userForm.uidNumber == null ||
    Number.isNaN(Number(userForm.uidNumber)) ||
    Number(userForm.uidNumber) < MIN_UID_GID ||
    takenUidNumbers.has(Number(userForm.uidNumber))
  );

  const computedHome = useMemo(() => {
    const u = (userForm.uid || "").trim();
    return u ? `/home/${u}` : "";
  }, [userForm.uid]);

  useEffect(() => {
    if (!userForm.manualHome) setUserForm((f) => ({ ...f, homeDirectory: computedHome }));
  }, [computedHome, userForm.manualHome]);

  const handleDeleteUser = async (usr: LdapUser, orgDn: string) => {
    if (!confirm(`${usr.uid} kullanıcısı silinsin mi?`)) return;
    await api.deleteUser(usr.dn);
    setTree((prev) => {
      if (!prev) return prev;
      const copy: LdapTree = JSON.parse(JSON.stringify(prev));
      const o = findOrg(copy, orgDn);
      if (!o) return prev;
      o.users = o.users.filter((u) => u.dn !== usr.dn);
      for (const g of o.groups) g.members = g.members.filter((m) => m !== usr.dn);
      return copy;
    });
    setSelected({kind: "organization", dn: orgDn});
  };

  const handleOpenMoveUser = (usr: LdapUser, orgDn: string) => {
    setMoveUser({userDn: usr.dn, fromGroupDn: usr.groups?.[0], toGroupDn: ""});
    setMoveUserModalOpen(true);
  };
  const handleSubmitMoveUser = async () => {
    if (!tree) return;
    if (!moveUser.userDn || !moveUser.toGroupDn) return alert("Hedef grup seçiniz");
    await api.moveUser(moveUser.userDn, moveUser.toGroupDn);
    setTree((prev) => {
      if (!prev) return prev;
      const copy: LdapTree = JSON.parse(JSON.stringify(prev));
      let usrOrg: LdapOrganization | undefined;
      let usr: LdapUser | undefined;
      for (const o of copy.organizations) {
        const u = findUser(o, moveUser.userDn);
        if (u) { usr = u; usrOrg = o; break; }
      }
      if (!usr || !usrOrg) return prev;
      for (const g of usrOrg.groups) g.members = g.members.filter((m) => m !== usr!.dn);
      const toG = findGroup(usrOrg, moveUser.toGroupDn);
      if (toG && !toG.members.includes(usr.dn)) toG.members.push(usr.dn);
      usr.groups = [moveUser.toGroupDn];
      return copy;
    });
    setMoveUserModalOpen(false);
  };

  const handleExport = async () => {
    if (!tree) return;
    const scope = selected ?? { kind: "domain", dn: tree.domain };
    const format = exportFormat;
    setExportModalOpen(false);

    try {
      if (format === "json") {
        setLoading(true);
        let json: any = {};
        if ((scope as any).kind === "domain") json = tree;
        if ((scope as any).kind === "organization") json = findOrg(tree, (scope as any).dn!);
        if ((scope as any).kind === "group") {
          for (const org of tree.organizations) {
            const g = findGroup(org, (scope as any).dn!);
            if (g) { json = { domain: tree.domain, organization: org.dn, group: g }; break; }
          }
        }
        if ((scope as any).kind === "user") {
          for (const org of tree.organizations) {
            const u = findUser(org, (scope as any).dn!);
            if (u) { json = { domain: tree.domain, organization: org.dn, user: u }; break; }
          }
        }
        downloadAsFile(`ldap_export_${(scope as any).kind}.json`, json);
      } else {
        setLoading(true);
        const { blob, filename } = await api.export(scope as any, format);
        downloadBlob(filename, blob);
      }
    } catch (e: any) {
      console.error("Dışa aktarma başarısız", e);
      alert(`Dışa aktarma başarısız: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ===================== Render =====================

  return (
    <DefaultLayout>
      <section className="flex flex-col gap-4 py-8 md:py-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <OrganizationIcon className="text-blue-600" /> LDAP Yönetimi
          </h1>
          <div className="flex items-center gap-2">
            <Input placeholder="Ara (org / grup / kullanıcı)" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
            <Button onPress={load} isDisabled={loading}>Yenile</Button>
            <Button onPress={expandAll} variant="bordered">Tümünü Genişlet</Button>
            <Button onPress={collapseAll} variant="bordered">Tümünü Daralt</Button>
            <Button color="warning" onPress={() => setImportModalOpen(true)}>İçe Aktar</Button>
            <Button color="secondary" onPress={() => setExportModalOpen(true)}>Dışa Aktar</Button>
            <Button color="success" onPress={handleOpenCreateOrg}>+ Organizasyon</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold">LDAP Ağacı</div>
              <div className="text-xs text-gray-500">{loading ? "Yükleniyor..." : tree ? "Hazır" : ""}</div>
            </div>
            <div className="p-2 max-h-[70vh] overflow-auto">
              {tree && builtTree ? (
                <TreeView node={builtTree} expanded={expanded} onToggle={toggle} onSelect={(n) => setSelected({kind: n.kind, dn: n.dn})} selected={selected?.dn} />
              ) : (
                <div className="p-4 text-sm text-gray-500">Veri yok.</div>
              )}
            </div>
          </div>

          <div className="lg:col-span-2 border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">Detaylar</h2>
              <div className="text-xs text-gray-500">{selected ? selected.dn : "Seçim yok"}</div>
            </div>
            <div className="px-6 pb-6 overflow-y-auto flex-1 min-h-0">
              {!currentDetails && <div className="text-sm text-gray-500">Sol ağaçtan bir öğe seçin.</div>}

              {currentDetails?.kind === "domain" && tree && (
                <DomainDetails tree={tree} onCreateOrg={handleOpenCreateOrg} />
              )}

              {currentDetails?.kind === "organization" && tree && (
                <OrganizationDetails
                  org={currentDetails.node as LdapOrganization}
                  onEdit={() => handleOpenEditOrg(currentDetails.node as LdapOrganization)}
                  onDelete={() => handleDeleteOrg(currentDetails.node as LdapOrganization)}
                  onCreateGroup={() => handleOpenCreateGroup((currentDetails.node as LdapOrganization).dn)}
                  onCreateUser={() => handleOpenCreateUser({orgDn: (currentDetails.node as LdapOrganization).dn})}
                />
              )}

              {currentDetails?.kind === "group" && tree && (
                <GroupDetails
                  org={currentDetails.org as LdapOrganization}
                  group={currentDetails.node as LdapGroup}
                  usersInGroup={(currentDetails.org as LdapOrganization).users.filter((u) => (currentDetails.node as LdapGroup).members.includes(u.dn))}
                  onEdit={() => handleOpenEditGroup(currentDetails.node as LdapGroup, (currentDetails.org as LdapOrganization).dn)}
                  onDelete={() => handleDeleteGroup(currentDetails.node as LdapGroup, (currentDetails.org as LdapOrganization).dn)}
                  onCreateUser={() => handleOpenCreateUser({orgDn: (currentDetails.org as LdapOrganization).dn, groupDn: (currentDetails.node as LdapGroup).dn})}
                  onMoveUser={(u) => handleOpenMoveUser(u, (currentDetails.org as LdapOrganization).dn)}
                  onDeleteUser={(u) => handleDeleteUser(u, (currentDetails.org as LdapOrganization).dn)}
                />
              )}

              {currentDetails?.kind === "user" && tree && (
                <UserDetails
                  org={currentDetails.org as LdapOrganization}
                  user={currentDetails.node as LdapUser}
                  onEdit={() => handleOpenEditUser(currentDetails.node as LdapUser, (currentDetails.org as LdapOrganization).dn)}
                  onMove={() => handleOpenMoveUser(currentDetails.node as LdapUser, (currentDetails.org as LdapOrganization).dn)}
                  onDelete={() => handleDeleteUser(currentDetails.node as LdapUser, (currentDetails.org as LdapOrganization).dn)}
                />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ===================== Modals ===================== */}

      {orgModalOpen && (
        <ModalFrame title={orgForm.dn ? "Organizasyonu Düzenle" : "Yeni Organizasyon"} onClose={() => setOrgModalOpen(false)}>
          <div className="space-y-3">
            <Input label="* Organizasyon Adı" placeholder="Örn: OET" value={orgForm.name} isRequired onChange={(e) => setOrgForm((f) => ({...f, name: e.target.value}))} />
            <Input label="Açıklama" placeholder="İsteğe bağlı açıklama" value={orgForm.description || ""} onChange={(e) => setOrgForm((f) => ({...f, description: e.target.value}))} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="bordered" onPress={() => setOrgModalOpen(false)}>İptal</Button>
              <Button color="primary" onPress={handleSubmitOrg}>{orgForm.dn ? "Güncelle" : "Kaydet"}</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {groupModalOpen && (
        <ModalFrame title={groupForm.dn ? "Grubu Düzenle" : "Yeni Grup"} onClose={() => setGroupModalOpen(false)}>
          <div className="space-y-3">
            <Select
              label="* Organizasyon"
              selectedKeys={new Set(groupForm.organizationDn ? [groupForm.organizationDn] : [])}
              onSelectionChange={(keys) => {
                const v = Array.from(keys as Set<string>)[0];
                setGroupForm((f) => ({...f, organizationDn: v || ""}));
              }}
            >
              {orgOptions.map((o) => (<SelectItem key={o.key}>{o.label}</SelectItem>))}
            </Select>
            <Input label="* Grup Adı" placeholder="Örn: devops" value={groupForm.name} isRequired onChange={(e) => setGroupForm((f) => ({...f, name: e.target.value}))} />
            <Input label="Açıklama" placeholder="İsteğe bağlı açıklama" value={groupForm.description || ""} onChange={(e) => setGroupForm((f) => ({...f, description: e.target.value}))} />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="bordered" onPress={() => setGroupModalOpen(false)}>İptal</Button>
              <Button color="primary" onPress={handleSubmitGroup}>{groupForm.dn ? "Güncelle" : "Kaydet"}</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {userModalOpen && (
        <ModalFrame title={userForm.dn ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"} onClose={() => setUserModalOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Select
              label="* Organizasyon"
              selectedKeys={new Set(userForm.organizationDn ? [userForm.organizationDn] : [])}
              onSelectionChange={(keys) => {
                const v = Array.from(keys as Set<string>)[0];
                setUserForm((f) => ({...f, organizationDn: v || "", groupDn: ""}));
              }}
            >
              {orgOptions.map((o) => (<SelectItem key={o.key}>{o.label}</SelectItem>))}
            </Select>
            <Select
              label="* Grup"
              isRequired
              selectedKeys={new Set(userForm.groupDn ? [userForm.groupDn] : [])}
              onSelectionChange={(keys) => {
                const v = Array.from(keys as Set<string>)[0];
                setUserForm((f) => ({...f, groupDn: v || ""}));
              }}
            >
              {groupOptions.map((g) => (<SelectItem key={g.key}>{g.label}</SelectItem>))}
            </Select>

            <Input label="* Kullanıcı Adı (uid)" isRequired value={userForm.uid || ""} onChange={(e) => setUserForm((f) => ({...f, uid: e.target.value}))} />
            <Input label="* Ad (givenName)" isRequired value={userForm.givenName || ""} onChange={(e) => setUserForm((f) => ({...f, givenName: e.target.value}))} />
            <Input label="* Soyad (sn)" isRequired value={userForm.sn || ""} onChange={(e) => setUserForm((f) => ({...f, sn: e.target.value}))} />
            <Input label="E-posta" type="email" value={userForm.mail || ""} onChange={(e) => setUserForm((f) => ({...f, mail: e.target.value}))} />
            <Input label="Telefon" value={userForm.phone || ""} onChange={(e) => setUserForm((f) => ({...f, phone: e.target.value}))} />
            <Input label="Parola" type="password" placeholder={userForm.dn ? "Mevcut parolayı değiştirmek için girin" : "Yeni kullanıcı için parola"} value={userForm.userPassword || ""} onChange={(e) => setUserForm((f) => ({ ...f, userPassword: e.target.value }))} />

            <div className="md:col-span-2 flex items-center justify-between mt-2">
              <div className="text-xs text-gray-500">uidNumber / gidNumber (varsayılan: LDAP otomatik)</div>
              <div className="flex gap-2">
                {!userForm.manualUidGid ? (
                  <Button size="sm" variant="bordered" onPress={() => {
                    if (confirm("uidNumber / gidNumber değerlerini manuel düzenlemek istediğinizden emin misiniz?")) {
                      const suggested = nextFreeNumber(takenUidNumbers, MIN_UID_GID);
                      setUserForm(f => ({ ...f, manualUidGid: true, uidNumber: f.uidNumber ?? suggested, gidNumber: f.gidNumber ?? MIN_UID_GID }));
                    }
                  }}>Manuel</Button>
                ) : (
                  <Button size="sm" variant="flat" onPress={() => setUserForm(f => ({ ...f, manualUidGid: false }))}>Otomatiğe dön</Button>
                )}
              </div>
            </div>

            <Input label="uidNumber" type="number" value={String(userForm.uidNumber ?? "")} isDisabled={!userForm.manualUidGid} min={MIN_UID_GID}
              description={!userForm.manualUidGid ? "LDAP otomatik atayacak." : (uidNumError ? (userForm.uidNumber == null || Number(userForm.uidNumber) < MIN_UID_GID ? `En az ${MIN_UID_GID}.` : "Bu uidNumber kullanımda.") : " ")}
              validationState={uidNumError ? "invalid" : "valid"}
              onChange={(e) => setUserForm((f) => ({ ...f, uidNumber: e.target.value ? Number(e.target.value) : undefined }))} />

            <Input label="gidNumber" type="number" value={String(userForm.gidNumber ?? "")} isDisabled={!userForm.manualUidGid} min={MIN_UID_GID}
              description={!userForm.manualUidGid ? "LDAP otomatik atayacak." : `En az ${MIN_UID_GID}.`}
              onChange={(e) => setUserForm((f) => ({ ...f, gidNumber: e.target.value ? Number(e.target.value) : undefined }))} />

            <div className="md:col-span-2 flex items-center justify-between mt-2">
              <div className="text-xs text-gray-500">Home Directory (varsayılan: /home/$uid)</div>
              <div className="flex gap-2">
                {!userForm.manualHome ? (
                  <Button size="sm" variant="bordered" onPress={() => { if (confirm("Home directory'yi manuel düzenlemek istediğinizden emin misiniz?")) setUserForm(f => ({ ...f, manualHome: true })); }}>Manuel</Button>
                ) : (
                  <Button size="sm" variant="flat" onPress={() => setUserForm(f => ({ ...f, manualHome: false, homeDirectory: computedHome }))}>Otomatiğe dön</Button>
                )}
              </div>
            </div>

            <Input label="Home Directory" value={userForm.manualHome ? (userForm.homeDirectory || "") : computedHome} isDisabled={!userForm.manualHome} onChange={(e) => setUserForm((f) => ({ ...f, homeDirectory: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="bordered" onPress={() => setUserModalOpen(false)}>İptal</Button>
            <Button color="primary" onPress={handleSubmitUser} isDisabled={!userForm.organizationDn || !userForm.groupDn || !userForm.uid || !userForm.givenName || !userForm.sn}>
              {userForm.dn ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </ModalFrame>
      )}

      {moveUserModalOpen && (
        <ModalFrame title="Kullanıcıyı Taşı" onClose={() => setMoveUserModalOpen(false)}>
          <div className="space-y-3">
            <Select
              label="Hedef Grup"
              selectedKeys={new Set(moveUser.toGroupDn ? [moveUser.toGroupDn] : [])}
              onSelectionChange={(keys) => {
                const v = Array.from(keys as Set<string>)[0];
                setMoveUser((f) => ({...f, toGroupDn: v || ""}));
              }}
            >
              {(tree?.organizations.flatMap((o) => o.groups) ?? []).map((g) => (<SelectItem key={g.dn}>{g.name}</SelectItem>))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="bordered" onPress={() => setMoveUserModalOpen(false)}>İptal</Button>
              <Button color="primary" onPress={handleSubmitMoveUser}>Taşı</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {exportModalOpen && (
        <ModalFrame title="Dışa Aktar" onClose={() => setExportModalOpen(false)}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Seçili kapsamı (veya seçim yoksa tüm ağacı) hangi formatta dışa aktarmak istiyorsunuz?</p>
            <Select label="Format Seçin" selectedKeys={new Set([exportFormat])} onSelectionChange={(keys) => {
              const v = Array.from(keys as Set<string>)[0] as any; if (v) setExportFormat(v);
            }}>
              <SelectItem key="json">JSON (.json)</SelectItem>
              <SelectItem key="ldif">LDIF (.ldif)</SelectItem>
              <SelectItem key="pdf">PDF (.pdf)</SelectItem>
            </Select>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="bordered" onPress={() => setExportModalOpen(false)}>İptal</Button>
              <Button color="secondary" onPress={handleExport} isDisabled={loading}>{loading ? "Dışa Aktarılıyor..." : "Dışa Aktar"}</Button>
            </div>
          </div>
        </ModalFrame>
      )}
      {importModalOpen && (
        <ModalFrame title="İçe Aktar" onClose={() => {
          setImportModalOpen(false);
          setImportFile(null);
          setImportPreview(null);
          setValidating(false);
          setApplying(false);
        }}>
          <div className="space-y-4">
            <div className="rounded-xl border p-4 space-y-2">
              <div className="font-semibold">1) Dosya Seç (.json veya .ldif)</div>
              <input
                type="file"
                accept=".json,.ldif,application/json,text/plain"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setImportFile(f);
                  setImportPreview(null);
                }}
              />
              {importFile && (
                <div className="text-xs text-gray-600">
                  Seçili: <span className="font-mono">{importFile.name}</span> ({Math.ceil(importFile.size/1024)} KB)
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  color="secondary"
                  isDisabled={!importFile || validating}
                  onPress={async () => {
                    if (!importFile) return;
                    try {
                      setValidating(true);
                      const v = await api.validateImport(importFile);
                      setImportPreview(v);
                    } catch (e:any) {
                      alert(e.message || "Doğrulama başarısız");
                    } finally {
                      setValidating(false);
                    }
                  }}
                >
                  {validating ? "Doğrulanıyor..." : "Doğrula"}
                </Button>
              </div>
            </div>

            {importPreview && (
              <div className="rounded-xl border p-4 space-y-3">
                <div className="font-semibold">2) Önizleme & Özet</div>

                {importPreview.summary && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.entries(importPreview.summary).map(([k,v]: any) => (
                      <div key={k} className="border rounded-lg p-3">
                        <div className="text-xs uppercase text-gray-500">{k}</div>
                        <div className="text-xl font-semibold">{String(v)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {Array.isArray(importPreview.blockers) && importPreview.blockers.length > 0 && (
                  <div className="rounded-lg border border-red-200 p-3">
                    <div className="font-medium text-red-700 mb-2">Bloklayıcılar</div>
                    <Table aria-label="blockers">
                      <TableHeader>
                        <TableColumn>Tür</TableColumn>
                        <TableColumn>Neden</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {importPreview.blockers.map((b:any, i:number) => (
                          <TableRow key={i}>
                            <TableCell>{b.kind || "-"}</TableCell>
                            <TableCell>{b.reason || JSON.stringify(b)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    <div className="text-xs text-gray-600 mt-2">Bloklayıcılar çözülmeden uygulama butonu pasif olur.</div>
                  </div>
                )}

                {Array.isArray(importPreview.items) && importPreview.items.length > 0 && (
                  <div className="space-y-2">
                    <div className="font-medium">Planlanan İşlemler</div>
                    <Table aria-label="planned-changes">
                      <TableHeader>
                        <TableColumn>İşlem</TableColumn>
                        <TableColumn>Hedef</TableColumn>
                        <TableColumn>Detay</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {importPreview.items.map((it:any, i:number) => (
                          <TableRow key={i}>
                            <TableCell>{it.action || it.kind || "-"}</TableCell>
                            <TableCell>{it.dn || it.target || "-"}</TableCell>
                            <TableCell className="max-w-[420px]">
                              <pre className="whitespace-pre-wrap text-xs">{it.note || it.reason || it.name || "-"}</pre>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm">Ham doğrulama çıktısı (JSON)</summary>
                  <pre className="text-xs mt-2 overflow-auto max-h-72">
{JSON.stringify(importPreview, null, 2)}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="bordered" onPress={() => {
                setImportModalOpen(false);
                setImportFile(null);
                setImportPreview(null);
              }}>
                Kapat
              </Button>
              <Button
                color="primary"
                isDisabled={
                  applying ||
                  !importFile ||
                  (Array.isArray(importPreview?.blockers) && importPreview.blockers.length > 0)
                }
                onPress={async () => {
                  if (!importFile) return;
                  try {
                    setApplying(true);
                    const planId = importPreview?.planId as (string | undefined);
                    const r = await api.applyImport({ planId, file: planId ? undefined : importFile });
                    setImportModalOpen(false);
                    setImportFile(null);
                    setImportPreview(null);
                    await load();
                    alert("İçe aktarma uygulandı.");
                  } catch (e:any) {
                    alert(e.message || "Apply başarısız");
                  } finally {
                    setApplying(false);
                  }
                }}
              >
                {applying ? "Uygulanıyor..." : "Uygula"}
              </Button>
            </div>
          </div>
        </ModalFrame>
      )}
    </DefaultLayout>
  );
}

// ===================== Subcomponents =====================



type TreeViewProps = {
  node: {id: string; dn: string; kind: NodeKind; label: string; children?: any[]};
  expanded: Set<string>;
  selected?: string;
  onToggle: (dn: string) => void;
  onSelect: (node: {dn: string; kind: NodeKind}) => void;
};

function TreeView({node, expanded, selected, onToggle, onSelect}: TreeViewProps) {
  return (
    <div className="text-sm">
      <TreeNode node={node} level={0} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect} />
    </div>
  );
}

type TreeNodeProps = {
  node: {id: string; dn: string; kind: NodeKind; label: string; children?: any[]};
  level: number;
  expanded: Set<string>;
  selected?: string;
  onToggle: (dn: string) => void;
  onSelect: (node: {dn: string; kind: NodeKind}) => void;
};

function TreeNode({node, level, expanded, selected, onToggle, onSelect}: TreeNodeProps) {
  const isParent = (node.children || []).length > 0;
  const isExpanded = expanded.has(node.dn);
  const padding = 8 + level * 16;

  const KindIcon = () =>
      node.kind === "organization" ? (<OrganizationIcon size={16} />)
      : node.kind === "group" ? (<UserGroupIcon size={16} />)
      : node.kind === "user" ? (<UserIcon size={16} />)
      : null;

  return (
    <div>
      <div
        className={classNames("flex items-center justify-between rounded px-2 py-1 cursor-pointer hover:bg-gray-100", selected === node.dn && "bg-blue-50")}
        style={{paddingLeft: padding}}
        onClick={() => onSelect({dn: node.dn, kind: node.kind})}
      >
        <div className="flex items-center gap-2">
          {isParent ? (
            <button className="w-5 h-5 text-xs rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); onToggle(node.dn); }}
              aria-label={isExpanded ? "Daralt" : "Genişlet"}>
              {isExpanded ? "-" : "+"}
            </button>
          ) : (<span className="w-5" />)}
          <span className="opacity-80"><KindIcon /></span>
          <span className={classNames("font-medium", node.kind === "organization" && "text-blue-700", node.kind === "group" && "text-purple-700", node.kind === "user" && "text-gray-800")}>{node.label}</span>
          {node.kind === "user" && <Chip size="sm" variant="flat">uid</Chip>}
        </div>
        <div className="flex items-center gap-2 pr-2">
          {node.kind === "organization" && <span className="text-[10px] uppercase text-gray-500">org</span>}
          {node.kind === "group" && <span className="text-[10px] uppercase text-gray-500">group</span>}
          {node.kind === "user" && <span className="text-[10px] uppercase text-gray-500">user</span>}
        </div>
      </div>
      {isParent && isExpanded && (
        <div>
          {(node.children || []).map((c: any) => (
            <TreeNode key={c.id} node={c} level={level + 1} expanded={expanded} selected={selected} onToggle={onToggle} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModalFrame({title, onClose, children, footer}: {title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="
          relative bg-white w-[96vw] sm:w-[90vw] md:w-[85vw] lg:w-[75vw] xl:w-[1100px]
          max-h-[92dvh] rounded-2xl shadow-xl overflow-hidden flex flex-col
        "
      >
        <div className="sticky top-0 z-10 bg-white border-b px-5 py-3 flex items-center gap-3">
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-900"><CloseIcon /></button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {children}
        </div>

        {footer && (
          <div className="sticky bottom-0 z-10 bg-white border-t px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

function DomainDetails({tree, onCreateOrg}: {tree: LdapTree; onCreateOrg: () => void}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border p-4">
        <div className="text-sm text-gray-500">Alan (domain)</div>
        <div className="text-lg font-semibold">{tree.domain}</div>
      </div>
      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold">Organizasyonlar</div>
          <Button color="success" onPress={onCreateOrg}>+ Organizasyon</Button>
        </div>
        <Table aria-label="orgs">
          <TableHeader>
            <TableColumn>Ad</TableColumn>
            <TableColumn>Açıklama</TableColumn>
            <TableColumn>Grup Sayısı</TableColumn>
            <TableColumn>Kullanıcı Sayısı</TableColumn>
          </TableHeader>
          <TableBody>
            {tree.organizations.map((o) => (
              <TableRow key={o.dn}>
                <TableCell>{o.name}</TableCell>
                <TableCell>{o.description || "-"}</TableCell>
                <TableCell>{o.groups.length}</TableCell>
                <TableCell>{o.users.length}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function OrganizationDetails({org, onEdit, onDelete, onCreateGroup, onCreateUser}: {
  org: LdapOrganization;
  onEdit: () => void;
  onDelete: () => void;
  onCreateGroup: () => void;
  onCreateUser: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Organizasyon</div>
          <div className="text-xl font-semibold">{org.name}</div>
          <div className="text-sm text-gray-600">{org.dn}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="bordered" onPress={onEdit}><EditIcon /></Button>
          <Button color="danger" onPress={onDelete}><DeleteIcon /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold flex items-center gap-2"><UserGroupIcon /> Gruplar</div>
            <Button color="primary" onPress={onCreateGroup}>+ Grup</Button>
          </div>
          <Table aria-label="groups">
            <TableHeader>
              <TableColumn>Ad</TableColumn>
              <TableColumn>Açıklama</TableColumn>
              <TableColumn>Üye</TableColumn>
            </TableHeader>
            <TableBody>
              {org.groups.map((g) => (
                <TableRow key={g.dn}>
                  <TableCell>{g.name}</TableCell>
                  <TableCell>{g.description || "-"}</TableCell>
                  <TableCell>{g.members.length}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="rounded-xl border p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="font-semibold flex items-center gap-2"><UserIcon /> Kullanıcılar</div>
            <Button color="primary" onPress={onCreateUser}>+ Kullanıcı</Button>
          </div>
          <Table aria-label="users">
            <TableHeader>
              <TableColumn>uid</TableColumn>
              <TableColumn>Ad Soyad</TableColumn>
              <TableColumn>E-posta</TableColumn>
              <TableColumn>Grup</TableColumn>
            </TableHeader>
            <TableBody>
              {org.users.map((u) => (
                <TableRow key={u.dn}>
                  <TableCell>{u.uid}</TableCell>
                  <TableCell>{u.givenName} {u.sn}</TableCell>
                  <TableCell>{u.mail || "-"}</TableCell>
                  <TableCell>{(u.groups || []).map((g) => g.split(",")[0].replace("cn=", "")).join(", ")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function GroupDetails({org, group, usersInGroup, onEdit, onDelete, onCreateUser, onMoveUser, onDeleteUser}: {
  org: LdapOrganization;
  group: LdapGroup;
  usersInGroup: LdapUser[];
  onEdit: () => void;
  onDelete: () => void;
  onCreateUser: () => void;
  onMoveUser: (u: LdapUser) => void;
  onDeleteUser: (u: LdapUser) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Grup</div>
          <div className="text-xl font-semibold">{group.name}</div>
          <div className="text-sm text-gray-600">{group.dn}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="bordered" onPress={onEdit}><EditIcon /></Button>
          <Button color="danger" onPress={onDelete}><DeleteIcon /></Button>
        </div>
      </div>

      <div className="rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold flex items-center gap-2"><UserIcon /> Grup Üyeleri</div>
          <Button color="primary" onPress={onCreateUser}>+ Kullanıcı</Button>
        </div>
        <Table aria-label="group-members">
          <TableHeader>
            <TableColumn>uid</TableColumn>
            <TableColumn>Ad Soyad</TableColumn>
            <TableColumn>E-posta</TableColumn>
            <TableColumn>İşlemler</TableColumn>
          </TableHeader>
          <TableBody>
            {usersInGroup.map((u) => (
              <TableRow key={u.dn}>
                <TableCell>{u.uid}</TableCell>
                <TableCell>{u.givenName} {u.sn}</TableCell>
                <TableCell>{u.mail || "-"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" variant="bordered" onPress={() => onMoveUser(u)}>Taşı</Button>
                    <Button size="sm" color="danger" onPress={() => onDeleteUser(u)}><DeleteIcon /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function UserDetails({org, user, onEdit, onMove, onDelete}: {
  org: LdapOrganization;
  user: LdapUser;
  onEdit: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">Kullanıcı</div>
          <div className="text-xl font-semibold">{user.givenName} {user.sn} <span className="text-gray-400 font-normal">({user.uid})</span></div>
          <div className="text-sm text-gray-600">{user.dn}</div>
        </div>
        <div className="flex gap-2">
          <Button variant="bordered" onPress={onEdit}><EditIcon /></Button>
          <Button onPress={onMove}>Taşı</Button>
          <Button color="danger" onPress={onDelete}><DeleteIcon /></Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border p-4">
          <div className="font-semibold mb-2">Profil</div>
          <div className="text-sm space-y-1">
            <div><span className="text-gray-500">Ad:</span> {user.givenName}</div>
            <div><span className="text-gray-500">Soyad:</span> {user.sn}</div>
            <div><span className="text-gray-500">E-posta:</span> {user.mail || "-"}</div>
            <div><span className="text-gray-500">Telefon:</span> {user.phone || "-"}</div>
            <div><span className="text-gray-500">Parola:</span> {user.userPassword ? "*****" : "-"}</div>
            <div><span className="text-gray-500">Durum:</span> <Chip size="sm" color={user.isActive ? "success" : "danger"}>{user.isActive ? "Aktif" : "Pasif"}</Chip></div>
          </div>
        </div>
        <div className="rounded-xl border p-4">
          <div className="font-semibold mb-2">Sistem</div>
          <div className="text-sm space-y-1">
            <div><span className="text-gray-500">uidNumber:</span> {user.uidNumber ?? "-"}</div>
            <div><span className="text-gray-500">gidNumber:</span> {user.gidNumber ?? "-"}</div>
            <div><span className="text-gray-500">Home:</span> {user.homeDirectory || "-"}</div>
            <div><span className="text-gray-500">Gruplar:</span> {(user.groups || []).map((g) => g.split(",")[0].replace("cn=", "")).join(", ") || "-"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
