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
  uidNumber?: number;
  gidNumber?: number;
  homeDirectory?: string;
  isActive?: boolean;
  groups?: string[]; // group DNs
};

type LdapGroup = {
  dn: string;
  name: string;
  description?: string;
  members: string[]; // user DNs
};

type LdapOrganization = {
  dn: string;
  name: string;
  description?: string;
  groups: LdapGroup[];
  users: LdapUser[]; // optional: users directly under org
};

type LdapTree = {
  domain: string; // e.g. dc=example,dc=org
  organizations: LdapOrganization[];
};

type NodeKind = "domain" | "organization" | "group" | "user";

type TreeNodeRef = {
  kind: NodeKind;
  dn: string; // unique key per node
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

function downloadAsFile(filename: string, data: any) {
  const blob = new Blob([typeof data === "string" ? data : JSON.stringify(data, null, 2)], {type: "application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

// Central place to wire backend later. For now, we do local state ops and provide TODOs.
const api = {
  // ---- Tree ----
  async loadTree(): Promise<LdapTree> {
    // TODO: Replace with your backend call like:
     const res = await fetch(`${API_BASE}/ldap/api/tree/`);
     if (!res.ok) throw new Error('Tree load failed');
     return res.json();

    /* // Fallback sample for preview
    return {
      domain: "dc=example,dc=org",
      organizations: [
        {
          dn: "ou=OET,dc=example,dc=org",
          name: "OET",
          description: "Operasyon Ekibi",
          groups: [
            {
              dn: "cn=devops,ou=OET,dc=example,dc=org",
              name: "devops",
              description: "DevOps grubu",
              members: ["uid=caner,ou=OET,dc=example,dc=org"],
            },
            {
              dn: "cn=secops,ou=OET,dc=example,dc=org",
              name: "secops",
              description: "Security ops",
              members: [],
            },
          ],
          users: [
            {
              dn: "uid=caner,ou=OET,dc=example,dc=org",
              uid: "caner",
              givenName: "Caner",
              sn: "Aysan",
              mail: "caner@example.org",
              phone: "+90 555 555 55 55",
              uidNumber: 10001,
              gidNumber: 10001,
              homeDirectory: "/home/caner",
              isActive: true,
              groups: ["cn=devops,ou=OET,dc=example,dc=org"],
            },
          ],
        },
        {
          dn: "ou=JAVATAR,dc=example,dc=org",
          name: "JAVATAR",
          description: "Java Takımı",
          groups: [
            {
              dn: "cn=backend,ou=JAVATAR,dc=example,dc=org",
              name: "backend",
              members: [],
            },
          ],
          users: [],
        },
      ],
    };*/
  }, 

  async suggestIds(orgDn: string, groupDn?: string): Promise<{uidNumber: number; gidNumber: number}> {
    const qs = new URLSearchParams({ orgDn });
    if (groupDn) qs.set("groupDn", groupDn);
    const res = await fetch(`${API_BASE}/ldap/api/next-ids/?${qs.toString()}`);
    if (!res.ok) throw new Error("next-ids failed");
    return res.json();
  },

  // The following are placeholders. Wire these to your backend endpoints.
  async createOrganization(payload: {name: string; description?: string}) {
    await fetch(`${API_BASE}/ldap/api/organizations/`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    return payload;
  },
  async updateOrganization(dn: string, payload: {name?: string; description?: string}) {
    await fetch(`${API_BASE}/ldap/api/organizations/${dn}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    return payload;
  },
  async deleteOrganization(dn: string) {
    await fetch(`${API_BASE}/ldap/api/organizations/${dn}/`, { method: 'DELETE' })
    return {dn};
  },
  async createGroup(payload: {organizationDn: string; name: string; description?: string}) {
    await fetch(`${API_BASE}/ldap/api/groups/`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    return payload;
  },
  async updateGroup(dn: string, payload: {name?: string; description?: string}) {
    await fetch(`${API_BASE}/ldap/api/groups/${dn}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    return {dn, ...payload};
  },
  async deleteGroup(dn: string) {
    await fetch(`${API_BASE}/ldap/api/groups/${dn}/`, { method: 'DELETE' })
    return {dn};
  },
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
    await fetch(`${API_BASE}/ldap/api/users/${dn}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify(payload) })
    return {dn, ...payload};
  },
  async deleteUser(dn: string) {
    await fetch(`${API_BASE}/ldap/api/users/${dn}/`, { method: 'DELETE' })
    return {dn};
  },
  async moveUser(dn: string, toGroupDn: string) {
    await fetch(`${API_BASE}/ldap/api/users/${dn}/move`, { method: 'POST', headers: { 'Content-Type': 'application/json'}, body: JSON.stringify({toGroupDn}) })
    return {dn, toGroupDn};
  },
  async export(scope: {kind: NodeKind; dn?: string}) {
    // Usually your backend should assemble proper subtree JSON.
    return scope;
  },
  async import(json: any) {
    return json;
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

// Flatten helpers for selects
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

// Build tree nodes for rendering + search filtering
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

    // Users that are directly under org (not in any group)
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

  // Modals & forms
  const [orgModalOpen, setOrgModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [moveUserModalOpen, setMoveUserModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [orgForm, setOrgForm] = useState<{dn?: string; name: string; description?: string}>({name: ""});
  const [groupForm, setGroupForm] = useState<{dn?: string; name: string; description?: string; organizationDn: string | ""}>({name: "", description: "", organizationDn: ""});
  const [userForm, setUserForm] = useState<
  Partial<LdapUser> & {
    organizationDn: string | "";
    groupDn?: string | "";
    manualUidGid?: boolean;   // <— yeni
    manualHome?: boolean;     // <— yeni
  }
>({
  organizationDn: "",
  groupDn: "",
  uid: "",
  givenName: "",
  sn: "",
  manualUidGid: false,
  manualHome: false,
});
  const [moveUser, setMoveUser] = useState<{userDn: string; fromGroupDn?: string; toGroupDn: string | ""}>({userDn: "", toGroupDn: ""});

  const orgOptions = useOrgOptions(tree);
  const groupOptions = useGroupOptions(tree, userForm.organizationDn || undefined);

  const builtTree = useMemo(() => (tree ? buildTreeNodes(tree, search) : null), [tree, search]);
  useEffect(() => {
    if (!userModalOpen) return;             // modal kapalıysa çalışmasın
    if (!userForm.organizationDn || !userForm.groupDn) return;    // org veya grup seçili değilse bekle
    if (userForm.manualUidGid) return;       // manuel modda dokunma
    if (userForm.dn) return;                 // DÜZENLEME modunda (mevcut kullanıcı) dokunma

    api
      .suggestIds(userForm.organizationDn, userForm.groupDn || undefined)
      .then(({ uidNumber, gidNumber }) => {
        setUserForm(f => ({
          ...f,
          uidNumber, // alan disabled olsa da göster
          gidNumber,
        }));
      })
      .catch((e) => console.error("suggestIds error:", e));
  }, [userModalOpen, userForm.organizationDn, userForm.groupDn, userForm.manualUidGid, userForm.dn]);
  // Load
  const load = async () => {
    try {
      setLoading(true);
      const data = await api.loadTree();
      setTree(data);
      // expand domain by default
      setExpanded(new Set([data.domain]));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Expand helpers
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

  // Node selection => populate detail/actions
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

  // ===================== CRUD handlers (front-only; wire API later) =====================

  const handleOpenCreateOrg = () => {
    setOrgForm({name: "", description: ""});
    setOrgModalOpen(true);
  };
  const handleOpenEditOrg = (org: LdapOrganization) => {
    setOrgForm({dn: org.dn, name: org.name, description: org.description});
    setOrgModalOpen(true);
  };
  const handleSubmitOrg = async () => {
    if (!tree) return;
    if (!orgForm.name) return alert("Organizasyon adı zorunlu");
    if (orgForm.dn) {
      // Update
      await api.updateOrganization(orgForm.dn, {name: orgForm.name, description: orgForm.description});
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const org = findOrg(copy, orgForm.dn!);
        if (org) {
          org.name = orgForm.name;
          org.description = orgForm.description;
        }
        return copy;
      });
    } else {
      // Create
      await api.createOrganization({name: orgForm.name, description: orgForm.description});
      const dn = `ou=${orgForm.name},${tree.domain}`;
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
        if (g) {
          g.name = groupForm.name;
          g.description = groupForm.description;
        }
        return copy;
      });
    } else {
      await api.createGroup({organizationDn: groupForm.organizationDn, name: groupForm.name, description: groupForm.description});
      const newDn = `cn=${groupForm.name},${groupForm.organizationDn}`;
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
        // remove membership of users
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
      uidNumber: undefined,
      gidNumber: undefined,
      homeDirectory: "",
      isActive: true,
      manualUidGid: false,   // otomatik
      manualHome: false,     // otomatik
    });
    setUserModalOpen(true);
  };
  const handleOpenEditUser = (usr: LdapUser, orgDn: string) => {
    // pick one group as default for editing (if exists)
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
      uidNumber: usr.uidNumber,
      gidNumber: usr.gidNumber,
      homeDirectory: usr.homeDirectory,
      isActive: usr.isActive,
      manualUidGid: false,   // düzenlemek isterse butonla açacak
      manualHome: false,     // düzenlemek isterse butonla açacak
    });
    setUserModalOpen(true);
  };
  const handleSubmitUser = async () => {
    if (!tree) return;
    if (!userForm.uid || !userForm.givenName || !userForm.sn || !userForm.organizationDn) {
      return alert("Kullanıcı adı, ad, soyad ve organizasyon zorunludur");
    }
    if (uidNumError) {
      return alert("uidNumber geçersiz ya da kullanımda.");
    }

    // Gönderilecek user objesini derle
    const payloadUser: any = {
      uid: userForm.uid,
      givenName: userForm.givenName,
      sn: userForm.sn,
      mail: userForm.mail,
      phone: userForm.phone,
      isActive: userForm.isActive,
    };

    // numaralar
    if (userForm.manualUidGid) {
      if (userForm.uidNumber != null) payloadUser.uidNumber = Number(userForm.uidNumber);
      if (userForm.gidNumber != null) payloadUser.gidNumber = Number(userForm.gidNumber);
    }
    // home
    payloadUser.homeDirectory = userForm.manualHome ? (userForm.homeDirectory || "") : computedHome;

    if (userForm.dn) {
      // UPDATE
      await api.updateUser(userForm.dn, payloadUser);
      // ... mevcut güncelleme setTree bloğun aynı (yalnızca değer kaynağı payloadUser olsun)
      setTree((prev) => {
        if (!prev) return prev;
        const copy: LdapTree = JSON.parse(JSON.stringify(prev));
        const o = findOrg(copy, userForm.organizationDn!);
        if (!o) return prev;
        const u = findUser(o, userForm.dn!);
        if (u) {
          Object.assign(u, payloadUser);
          // grup üyeliği koruma (mevcut kodun)
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
        // Create
        // ZORUNLU: groupDn dolu olmalı
        if (!userForm.groupDn) return alert("Grup zorunlu");

        const newUserPayload: LdapUser = {
          dn: "", // backend döndürecek
          uid: userForm.uid!,
          givenName: userForm.givenName!,
          sn: userForm.sn!,
          mail: userForm.mail,
          phone: userForm.phone,
          uidNumber: userForm.uidNumber,
          gidNumber: userForm.gidNumber,
          homeDirectory: userForm.homeDirectory || `/home/${userForm.uid}`,
          isActive: userForm.isActive ?? true,
          groups: [userForm.groupDn], // seçilen grup
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

    // Org içindeki diğer kullanıcıların uidNumber set'i:
  const takenUidNumbers = useMemo(() => {
    if (!tree || !userForm.organizationDn) return new Set<number>();
    const org = findOrg(tree, userForm.organizationDn);
    const s = new Set<number>();
    org?.users.forEach((u) => {
      if (u.uidNumber != null && u.dn !== userForm.dn) s.add(Number(u.uidNumber));
    });
    return s;
  }, [tree, userForm.organizationDn, userForm.dn]);

  // Hata bayrakları:
  const uidNumError =
    !!userForm.manualUidGid &&
    (
      userForm.uidNumber == null ||
      Number.isNaN(Number(userForm.uidNumber)) ||
      Number(userForm.uidNumber) < MIN_UID_GID ||
      takenUidNumbers.has(Number(userForm.uidNumber))
    );

  // Home otomatik mi?
  const computedHome = useMemo(() => {
    const u = (userForm.uid || "").trim();
    return u ? `/home/${u}` : "";
  }, [userForm.uid]);

  // uid değişince, home manuel değilse güncelle
  useEffect(() => {
    if (!userForm.manualHome) {
      setUserForm((f) => ({ ...f, homeDirectory: computedHome }));
    }
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
        if (u) {
          usr = u;
          usrOrg = o;
          break;
        }
      }
      if (!usr || !usrOrg) return prev;
      // remove from all groups in org
      for (const g of usrOrg.groups) g.members = g.members.filter((m) => m !== usr!.dn);
      // add to new group
      const toG = findGroup(usrOrg, moveUser.toGroupDn);
      if (toG && !toG.members.includes(usr.dn)) toG.members.push(usr.dn);
      usr.groups = [moveUser.toGroupDn];
      return copy;
    });
    setMoveUserModalOpen(false);
  };

  // Export
  const handleExport = async () => {
    if (!tree) return;
    const scope = selected ?? {kind: "domain", dn: tree.domain};
    // Backend: await api.export(scope)
    let json: any = {};
    if (scope.kind === "domain") json = tree;
    if (scope.kind === "organization") json = findOrg(tree, scope.dn!);
    if (scope.kind === "group") {
      for (const org of tree.organizations) {
        const g = findGroup(org, scope.dn!);
        if (g) { json = {domain: tree.domain, organization: org.dn, group: g}; break; }
      }
    }
    if (scope.kind === "user") {
      for (const org of tree.organizations) {
        const u = findUser(org, scope.dn!);
        if (u) { json = {domain: tree.domain, organization: org.dn, user: u}; break; }
      }
    }
    downloadAsFile(`ldap_export_${scope.kind}.json`, json);
  };

  // Import
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [importPreview, setImportPreview] = useState<any>(null);

  const handleChooseImport = () => fileInputRef.current?.click();
  const handleFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const data = JSON.parse(String(fr.result || "{}"));
        setImportPreview(data);
      } catch (err) {
        alert("Geçersiz JSON");
      }
    };
    fr.readAsText(file);
  };
  const handleImportApply = async () => {
    if (!importPreview) return;
    await api.import(importPreview);
    // For preview demo: just replace the tree if it looks like a full tree
    if (importPreview.domain && importPreview.organizations) setTree(importPreview as LdapTree);
    setImportModalOpen(false);
    setImportPreview(null);
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
            <Input
              placeholder="Ara (org / grup / kullanıcı)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72"
            />
            <Button onPress={load} isDisabled={loading}>Yenile</Button>
            <Button onPress={expandAll} variant="bordered">Tümünü Genişlet</Button>
            <Button onPress={collapseAll} variant="bordered">Tümünü Daralt</Button>
            <Button color="primary" onPress={() => setImportModalOpen(true)}>İçe Aktar</Button>
            <Button color="secondary" onPress={handleExport}>Dışa Aktar</Button>
            <Button color="success" onPress={handleOpenCreateOrg}>+ Organizasyon</Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Tree */}
          <div className="lg:col-span-1 border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="font-semibold">LDAP Ağacı</div>
              <div className="text-xs text-gray-500">{loading ? "Yükleniyor..." : tree ? "Hazır" : ""}</div>
            </div>
            <div className="p-2 max-h-[70vh] overflow-auto">
              {tree && builtTree ? (
                <TreeView
                  node={builtTree}
                  expanded={expanded}
                  onToggle={toggle}
                  onSelect={(n) => setSelected({kind: n.kind, dn: n.dn})}
                  selected={selected?.dn}
                />
              ) : (
                <div className="p-4 text-sm text-gray-500">Veri yok.</div>
              )}
            </div>
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-2 border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 pt-6 pb-2 flex items-center justify-between">
              <h2 className="text-xl font-semibold">Detaylar</h2>
              <div className="text-xs text-gray-500">{selected ? selected.dn : "Seçim yok"}</div>
            </div>
            <div className="px-6 pb-6">
              {!currentDetails && <div className="text-sm text-gray-500">Sol ağaçtan bir öğe seçin.</div>}

              {currentDetails?.kind === "domain" && tree && (
                <DomainDetails
                  tree={tree}
                  onCreateOrg={handleOpenCreateOrg}
                />
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

      {/* Organization modal */}
      {orgModalOpen && (
        <ModalFrame title={orgForm.dn ? "Organizasyonu Düzenle" : "Yeni Organizasyon"} onClose={() => setOrgModalOpen(false)}>
          <div className="space-y-3">
            <Input
              label="* Organizasyon Adı"
              placeholder="Örn: OET"
              value={orgForm.name}
              isRequired
              onChange={(e) => setOrgForm((f) => ({...f, name: e.target.value}))}
            />
            <Input
              label="Açıklama"
              placeholder="İsteğe bağlı açıklama"
              value={orgForm.description || ""}
              onChange={(e) => setOrgForm((f) => ({...f, description: e.target.value}))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="bordered" onPress={() => setOrgModalOpen(false)}>İptal</Button>
              <Button color="primary" onPress={handleSubmitOrg}>{orgForm.dn ? "Güncelle" : "Kaydet"}</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* Group modal */}
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
              {orgOptions.map((o) => (
                <SelectItem key={o.key}>{o.label}</SelectItem>
              ))}
            </Select>
            <Input
              label="* Grup Adı"
              placeholder="Örn: devops"
              value={groupForm.name}
              isRequired
              onChange={(e) => setGroupForm((f) => ({...f, name: e.target.value}))}
            />
            <Input
              label="Açıklama"
              placeholder="İsteğe bağlı açıklama"
              value={groupForm.description || ""}
              onChange={(e) => setGroupForm((f) => ({...f, description: e.target.value}))}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="bordered" onPress={() => setGroupModalOpen(false)}>İptal</Button>
              <Button color="primary" onPress={handleSubmitGroup}>{groupForm.dn ? "Güncelle" : "Kaydet"}</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* User modal */}
      {userModalOpen && (
        <ModalFrame title={userForm.dn ? "Kullanıcıyı Düzenle" : "Yeni Kullanıcı"} onClose={() => setUserModalOpen(false)}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Org & Grup */}
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
                {groupOptions.map((g) => (
                  <SelectItem key={g.key}>{g.label}</SelectItem>
              ))}
            </Select>

            {/* Temel alanlar */}
            <Input label="* Kullanıcı Adı (uid)" isRequired value={userForm.uid || ""} onChange={(e) => setUserForm((f) => ({...f, uid: e.target.value}))} />
            <Input label="* Ad (givenName)" isRequired value={userForm.givenName || ""} onChange={(e) => setUserForm((f) => ({...f, givenName: e.target.value}))} />
            <Input label="* Soyad (sn)" isRequired value={userForm.sn || ""} onChange={(e) => setUserForm((f) => ({...f, sn: e.target.value}))} />
            <Input label="E-posta" type="email" value={userForm.mail || ""} onChange={(e) => setUserForm((f) => ({...f, mail: e.target.value}))} />
            <Input label="Telefon" value={userForm.phone || ""} onChange={(e) => setUserForm((f) => ({...f, phone: e.target.value}))} />

            {/* --- UID/GID başlık + Manuel/Otomatik düğmesi --- */}
            <div className="md:col-span-2 flex items-center justify-between mt-2">
              <div className="text-xs text-gray-500">uidNumber / gidNumber (varsayılan: LDAP otomatik)</div>
              <div className="flex gap-2">
                {!userForm.manualUidGid ? (
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => {
                      if (confirm("uidNumber / gidNumber değerlerini manuel düzenlemek istediğinizden emin misiniz? Otomatik yönetim devre dışı kalacak.")) {
                        const suggested = nextFreeNumber(takenUidNumbers, MIN_UID_GID);
                        setUserForm(f => ({
                          ...f,
                          manualUidGid: true,
                          uidNumber: f.uidNumber ?? suggested,
                          gidNumber: f.gidNumber ?? MIN_UID_GID
                        }));
                      }
                    }}
                  >
                    Manuel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setUserForm(f => ({ ...f, manualUidGid: false }))}
                  >
                    Otomatiğe dön
                  </Button>
                )}
              </div>
            </div>

            {/* uidNumber */}
            <Input
              label="uidNumber"
              type="number"
              value={String(userForm.uidNumber ?? "")}
              isDisabled={!userForm.manualUidGid}
              min={MIN_UID_GID}
              description={
                !userForm.manualUidGid
                  ? "LDAP otomatik atayacak."
                  : uidNumError
                    ? (userForm.uidNumber == null || Number(userForm.uidNumber) < MIN_UID_GID
                        ? `En az ${MIN_UID_GID}.`
                        : "Bu uidNumber kullanımda.")
                    : " "
              }
              validationState={uidNumError ? "invalid" : "valid"}
              onChange={(e) =>
                setUserForm((f) => ({
                  ...f,
                  uidNumber: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />

            {/* gidNumber (sadece alt sınır kontrolü) */}
            <Input
              label="gidNumber"
              type="number"
              value={String(userForm.gidNumber ?? "")}
              isDisabled={!userForm.manualUidGid}
              min={MIN_UID_GID}
              description={!userForm.manualUidGid ? "LDAP otomatik atayacak." : `En az ${MIN_UID_GID}.`}
              onChange={(e) =>
                setUserForm((f) => ({
                  ...f,
                  gidNumber: e.target.value ? Number(e.target.value) : undefined,
                }))
              }
            />

            {/* --- Home başlık + Manuel/Otomatik düğmesi --- */}
            <div className="md:col-span-2 flex items-center justify-between mt-2">
              <div className="text-xs text-gray-500">Home Directory (varsayılan: /home/$uid)</div>
              <div className="flex gap-2">
                {!userForm.manualHome ? (
                  <Button
                    size="sm"
                    variant="bordered"
                    onPress={() => {
                      if (confirm("Home directory'yi manuel düzenlemek istediğinizden emin misiniz? Otomatik /home/$uid kuralından çıkılacak.")) {
                        setUserForm(f => ({ ...f, manualHome: true }));
                      }
                    }}
                  >
                    Manuel
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="flat"
                    onPress={() => setUserForm(f => ({ ...f, manualHome: false, homeDirectory: computedHome }))}
                  >
                    Otomatiğe dön
                  </Button>
                )}
              </div>
            </div>

            {/* Home Directory */}
            <Input
              label="Home Directory"
              value={userForm.manualHome ? (userForm.homeDirectory || "") : computedHome}
              isDisabled={!userForm.manualHome}
              onChange={(e) => setUserForm((f) => ({ ...f, homeDirectory: e.target.value }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="bordered" onPress={() => setUserModalOpen(false)}>İptal</Button>
            <Button
              color="primary"
              onPress={handleSubmitUser}
              isDisabled={!userForm.organizationDn || !userForm.groupDn || !userForm.uid || !userForm.givenName || !userForm.sn}
            >
              {userForm.dn ? "Güncelle" : "Kaydet"}
            </Button>
          </div>
        </ModalFrame>
      )}

      {/* Move user modal */}
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
              {(tree?.organizations.flatMap((o) => o.groups) ?? []).map((g) => (
                <SelectItem key={g.dn}>{g.name}</SelectItem>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button variant="bordered" onPress={() => setMoveUserModalOpen(false)}>İptal</Button>
              <Button color="primary" onPress={handleSubmitMoveUser}>Taşı</Button>
            </div>
          </div>
        </ModalFrame>
      )}

      {/* Import modal */}
      {importModalOpen && (
        <ModalFrame title="JSON İçe Aktar" onClose={() => setImportModalOpen(false)}>
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleFileChange} />
            <div className="flex items-center gap-2">
              <Button onPress={handleChooseImport}>Dosya Seç</Button>
              <Button isDisabled={!importPreview} color="primary" onPress={handleImportApply}>Uygula</Button>
            </div>
            {importPreview ? (
              <pre className="max-h-64 overflow-auto text-xs bg-gray-50 p-3 rounded border border-gray-200">{JSON.stringify(importPreview, null, 2)}</pre>
            ) : (
              <p className="text-sm text-gray-500">Bir JSON dosyası seçin. Tam ağaç (domain + organizations) veya parça (ör: tek bir grup ya da kullanıcı) yükleyebilirsiniz.</p>
            )}
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
      node.kind === "organization" ? (
        <OrganizationIcon size={16} />
      ) : node.kind === "group" ? (
        <UserGroupIcon size={16} />
      ) : node.kind === "user" ? (
        <UserIcon size={16} />
      ) : null;

  return (
    <div>
      <div
        className={classNames(
          "flex items-center justify-between rounded px-2 py-1 cursor-pointer hover:bg-gray-100",
          selected === node.dn && "bg-blue-50"
        )}
        style={{paddingLeft: padding}}
        onClick={() => onSelect({dn: node.dn, kind: node.kind})}
      >
        <div className="flex items-center gap-2">
          {isParent ? (
            <button
              className="w-5 h-5 text-xs rounded border border-gray-300 hover:bg-gray-100 flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); onToggle(node.dn); }}
              aria-label={isExpanded ? "Daralt" : "Genişlet"}
            >
              {isExpanded ? "-" : "+"}
            </button>
          ) : (
            <span className="w-5" />
          )}
          <span className="opacity-80">
            <KindIcon />
          </span>
          <span className={classNames("font-medium", node.kind === "organization" && "text-blue-700", node.kind === "group" && "text-purple-700", node.kind === "user" && "text-gray-800")}>{node.label}</span>
          {node.kind === "user" && <Chip size="sm" variant="flat">uid</Chip>}
        </div>
        {/* quick badges */}
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

function ModalFrame({title, onClose, children}: {title: string; onClose: () => void; children: React.ReactNode}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-2xl w-full max-w-2xl shadow-xl">
        <div className="flex justify-between items-center pb-4 border-b">
          <h3 className="text-lg font-bold tracking-tight">{title}</h3>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-900">
            <CloseIcon />
          </button>
        </div>
        <div className="pt-4">{children}</div>
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
