import React, { useEffect, useState, useMemo, useRef } from 'react';
import DefaultLayout from "@/layouts/default";
import { Chip } from "@heroui/chip";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell, Selection } from "@heroui/table";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { PCIcon } from "@/components/icons";
import { addToast } from "@heroui/toast";

// ===================== TİPLER =====================

type Policy = {
  id: number;
  name: string;
  description: string;
  is_cis: boolean;
};

type Client = {
  id: number;
  uuid: string;
  ip_address: string;
  mac_address: string;
  hostname: string;
  description: string;
  is_active: boolean;
  policies: Policy[];
};

const SearchIcon = (props: any) => (
  <svg aria-hidden="true" fill="none" focusable="false" height="1em" role="presentation" viewBox="0 0 24 24" width="1em" {...props}>
    <path d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
    <path d="M22 22L20 20" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
  </svg>
);


export default function ClientsPolicyPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [clients, setClients] = useState<Client[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedClientKeys, setSelectedClientKeys] = useState<Selection>(new Set([]));
  const [selectedPolicyIds, setSelectedPolicyIds] = useState<string[]>([]);
  const [policySearchTerm, setPolicySearchTerm] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const prevSelectionRef = useRef(selectedClientKeys);

  const fetchClients = () => {
    fetch(`${API_BASE}/client/clients/`)
      .then(res => res.json())
      .then(data => setClients(data.results || []))
      .catch(err => console.error('Error fetching clients:', err));
  };

  const fetchPolicies = () => {
    fetch(`${API_BASE}/policy/policies/?paginate=false`)
      .then(res => res.json())
      .then(data => setPolicies(data || []))
      .catch(err => console.error('Error fetching policies:', err));
  };

  useEffect(() => {
    fetchClients();
    fetchPolicies();
    const intervalId = setInterval(fetchClients, 15000); 
    return () => clearInterval(intervalId);
  }, []);

  const filteredPolicies = useMemo(() => {
    if (!policySearchTerm) return policies;
    return policies.filter(p =>
      p.name.toLowerCase().includes(policySearchTerm.toLowerCase()) ||
      p.description.toLowerCase().includes(policySearchTerm.toLowerCase())
    );
  }, [policies, policySearchTerm]);

  useEffect(() => {
    const isSelectionChanged = prevSelectionRef.current !== selectedClientKeys;

    if (isSelectionChanged) {
      setIsEditing(false);
      prevSelectionRef.current = selectedClientKeys;
    }

    if (!isSelectionChanged && isEditing) {
      return;
    }

    const selectedIds = new Set(
      Array.from(selectedClientKeys as Set<string | number>).map(String)
    );

    if (selectedIds.size === 0) {
      setSelectedPolicyIds([]);
      return;
    }

    const policyIdsToShow = new Set<string>();
    clients.forEach(client => {
      if (selectedIds.has(String(client.id))) {
        client.policies.forEach(policy => {
          policyIdsToShow.add(String(policy.id));
        });
      }
    });

    setSelectedPolicyIds(Array.from(policyIdsToShow));

  }, [selectedClientKeys, clients, isEditing]); 

  const handlePolicyAssignment = async () => {
    const clientIds = Array.from(selectedClientKeys as Set<string | number>);
    const policyIdsToAssign = selectedPolicyIds.map(id => parseInt(id, 10));

    if (clientIds.length === 0) {
      addToast({
        title: "İstemci Seçilmedi",
        description: "Lütfen en az bir istemci seçin.",
        color: "warning",
        timeout: 5000,
      });
      return;
    }

    for (const clientId of clientIds) {
      const client = clients.find(c => c.id.toString() === clientId.toString());
      if (!client) continue;

      try {
        const response = await fetch(`${API_BASE}/client/clients/${clientId}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ policy_ids: policyIdsToAssign }),
        });

        if (!response.ok) {
          throw new Error(`İstemci ${client.hostname} güncellenemedi.`);
        }

        setClients(prevClients => prevClients.map(c =>
          c.id.toString() === clientId.toString()
            ? { ...c, policies: policyIdsToAssign.map(id => policies.find(p => p.id === id)!).filter(Boolean) }
            : c
        ));

      } catch (error) {
        addToast({
          title: "Hata",
          description: (error as Error).message,
          color: "danger",
          timeout: 5000,
        });
      }
    }

    setIsEditing(false);

    addToast({
      title: "Başarılı",
      description: `Seçilen ${clientIds.length} istemcinin politikaları güncellendi.`,
      color: "success",
      timeout: 5000,
    });
  };

  const columns = [
    { key: "uuid", label: "UUID" },
    { key: "ip", label: "IP ve MAC" },
    { key: "hostname", label: "PC Adı" },
    { key: "policies", label: "Mevcut Politikalar" },
    { key: "active", label: "Aktiflik" },
  ];

  const renderCell = (client: Client, columnKey: React.Key) => {
    switch (columnKey) {
      case "uuid": return client.uuid.substring(0, 8) + "...";
      case "ip": return (<div className="flex flex-col"><p className="text-bold text-sm">{client.ip_address}</p><p className="text-bold text-sm text-default-400">{client.mac_address}</p></div>);
      case "hostname": return client.hostname;
      case "policies": return (<div className="flex flex-wrap gap-1 max-w-xs">{client.policies.length > 0 ? (client.policies.map(p => (<Chip key={p.id} size="sm" color={p.is_cis ? "warning" : "default"}>{p.name}</Chip>))) : (<span className="text-xs text-gray-500">Politika yok</span>)}</div>);
      case "active": return (<Chip className="cursor-pointer" color={client.is_active ? 'success' : 'danger'}>{client.is_active ? 'Aktif' : 'Pasif'}</Chip>);
      default: return null;
    }
  };

  return (
    <DefaultLayout>
      <section className="flex flex-col gap-6 py-8 md:py-10">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <PCIcon className="text-blue-600" />
            İstemci Yönetimi ve Politika Atama
          </h1>
        </div>

        <div className="flex flex-col gap-6">
          <div>
            <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200 overflow-y-auto max-h-150">
              <Table
                aria-label="İstemciler tablosu"
                selectionMode="multiple"
                selectedKeys={selectedClientKeys}
                onSelectionChange={setSelectedClientKeys}
              >
                <TableHeader columns={columns}>
                  {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
                </TableHeader>
                <TableBody items={clients} emptyContent={"Veri Yok."}>
                  {(client) => (
                    <TableRow key={client.id}>
                      {(columnKey) => <TableCell>{renderCell(client, columnKey)}</TableCell>}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <div>
            <div className="p-6 shadow rounded-2xl border border-gray-200 bg-white flex flex-col gap-4">
              <h2 className="text-xl font-semibold">Politika Ata</h2>
              <Input
                aria-label="Politika Ara"
                placeholder="Politika ara..."
                value={policySearchTerm}
                onValueChange={setPolicySearchTerm}
                startContent={<SearchIcon className="w-5 h-5 text-gray-400" />}
              />

              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Seçili İstemciler: {
                    selectedClientKeys === "all"
                      ? clients.length
                      : (selectedClientKeys as Set<string>).size
                  }
                </p>
                <p className="text-sm text-gray-600 font-medium">
                  Seçili Politikalar: {selectedPolicyIds.length}
                </p>
              </div>

              <CheckboxGroup
                label="Mevcut Politikalar"
                value={selectedPolicyIds}
                onValueChange={(val) => {
                  setIsEditing(true);
                  setSelectedPolicyIds(val);
                }}
                className="max-h-96 overflow-y-auto pr-2"
              >
                {filteredPolicies.length > 0 ? (
                  filteredPolicies.map(policy => (
                    <Checkbox
                      key={policy.id}
                      value={policy.id.toString()}
                    >
                      {policy.name} {policy.is_cis && "(CIS)"}
                    </Checkbox>
                  ))
                ) : (
                  <p className="text-sm text-gray-500">
                    {policySearchTerm
                      ? "Aramayla eşleşen politika bulunamadı."
                      : (policies.length > 0 ? "Tüm politikalar listelendi." : "Yükleniyor...")
                    }
                  </p>
                )}
              </CheckboxGroup>

              <Button
                color="primary"
                onClick={handlePolicyAssignment}
                isDisabled={(selectedClientKeys as Set<string>).size === 0}
              >
                Seçili Politikaları Güncelle
              </Button>
              <p className="text-xs text-gray-500 mt-2">
              </p>
            </div>
          </div>

        </div>
      </section>
    </DefaultLayout>
  );
}