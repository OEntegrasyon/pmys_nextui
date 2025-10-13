import React, { useEffect, useState, useCallback } from "react";
import DefaultLayout from "@/layouts/default";
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardBody } from "@heroui/card";
import { Table, TableHeader, TableColumn, TableBody, TableCell, TableRow, getKeyValue } from "@heroui/table";
import { Spinner } from "@heroui/spinner";
// --- ÇÖZÜM 1: 'next/dynamic' import ediliyor ---
import dynamic from 'next/dynamic';

// --- ÇÖZÜM 2: Pagination bileşeni SSR olmadan, dinamik olarak yükleniyor ---
// Bu, "Cannot read properties of null (reading 'childNodes')" hatasını çözer.
const Pagination = dynamic(
  () => import('@heroui/pagination').then((mod) => mod.Pagination),
  { ssr: false }
);

// --- TİP TANIMLAMALARI (DÜZELTİLMİŞ) ---
type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type PolicyAssignment = {
  id: string;
  policy: {
    policy_type_name: string;
    name: string;
  } | null;
  assigned_to_username: string;
  created_at: string;
};

type PolicyLogs = {
  id: string;
  action: string;
  timestamp: string;
  details: {
    message: string;
    username?: string;
    parameters?: Record<string, any>;
    policy_type?: string;
  };
};

type ClientLogs = {
  id: string;
  action: string;
  timestamp: string;
  details: Record<string, any>;
  client_uuid: string;
  client_hostname: string;
};

type TabItem = {
  id: string;
  label: string;
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
};

// Django settings.py dosyanızdaki PAGE_SIZE ile aynı olmalı
const PAGE_SIZE = 50;

export default function LogsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [policyAssignments, setPolicyAssignments] = useState<PolicyAssignment[]>([]);
  const [policyLogs, setPolicyLogs] = useState<PolicyLogs[]>([]);
  const [clientLogs, setClientLogs] = useState<ClientLogs[]>([]);

  // Her tab için mevcut sayfayı ve toplam sayfa sayısını tutan state
  const [pagination, setPagination] = useState({
    policy_assignments: { current: 1, total: 0 },
    policy_logs: { current: 1, total: 0 },
    client_logs: { current: 1, total: 0 },
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [tabs, setTabs] = useState<TabItem[]>([]);
  
  const positiveMessages = ["login", "connected", "policy_applied"];
  const negativeMessages = ["disconnected","failed", "policy_failed"];

  // Belirtilen sayfayı çeken güncellenmiş fonksiyon
  const fetchPaginatedData = useCallback(async <T,>(
      endpoint: string,
      page: number,
      setData: React.Dispatch<React.SetStateAction<T[]>>,
      setTotalPages: (totalPages: number) => void,
      key: string
    ) => {
    const url = `${API_BASE}${endpoint}?page=${page}`;
    
    setLoading(prev => ({ ...prev, [key]: true }));
    try {
      const res = await fetch(url);
      const data: PaginatedResponse<T> = await res.json();
      
      // Veriyi listeye eklemek yerine doğrudan yenisiyle değiştiriyoruz
      setData(data.results);
      setTotalPages(Math.ceil(data.count / PAGE_SIZE));

    } catch (err) {
      console.error(`Veri çekme hatası (${key}):`, err);
      setData([]);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, []); // Bağımlılık dizisi boş, fonksiyon sadece bir kez oluşturulur

  // Sayfa numarası değiştikçe ilgili veriyi çeken useEffect'ler
  useEffect(() => {
    fetchPaginatedData(
      '/policy/policy_assignments/',
      pagination.policy_assignments.current,
      setPolicyAssignments,
      (total) => setPagination(p => ({ ...p, policy_assignments: { ...p.policy_assignments, total } })),
      'policy_assignments'
    );
  }, [pagination.policy_assignments.current]);

  useEffect(() => {
    fetchPaginatedData(
      '/policy/policy_logs/',
      pagination.policy_logs.current,
      setPolicyLogs,
      (total) => setPagination(p => ({ ...p, policy_logs: { ...p.policy_logs, total } })),
      'policy_logs'
    );
  }, [pagination.policy_logs.current]);

  useEffect(() => {
    fetchPaginatedData(
      '/client/client_logs/',
      pagination.client_logs.current,
      setClientLogs,
      (total) => setPagination(p => ({ ...p, client_logs: { ...p.client_logs, total } })),
      'client_logs'
    );
  }, [pagination.client_logs.current]);

  // Gelen veriye göre Tab'leri oluşturan useEffect
  useEffect(() => {
    const createTabs = (assignments: PolicyAssignment[], logs: PolicyLogs[], client_logs: ClientLogs[]): void => {
      let newTabs = [
        {
          id: "policy_assignments",
          label: "Politika Atamaları",
          columns: [
              { key: "policy_type_name", label: "Politika Türü" }, { key: "policy_name", label: "Politika Adı" },
              { key: "assigned_to_username", label: "Atanan Kullanıcı" }, { key: "created_at", label: "Oluşturulma Tarihi" },
          ],
          rows: assignments.map(assignment => ({
              key: assignment.id,
              policy_type_name: assignment.policy?.policy_type_name ?? 'N/A',
              policy_name: assignment.policy?.name ?? 'N/A',
              assigned_to_username: assignment.assigned_to_username,
              created_at: new Date(assignment.created_at).toLocaleString('tr-TR'),
          })),
        },
        {
          id: "policy_logs",
          label: "Politika Logları",
          columns: [
              { key: "action", label: "Eylem" }, { key: "timestamp", label: "Tarih" }, { key: "details", label: "Detaylar" },
          ],
          rows: logs.map(log => ({ 
              id: log.id,
              action: log.action,
              timestamp: new Date(log.timestamp).toLocaleString('tr-TR'),
              details: log.details.message, 
          })),
        },
        {
          id: "client_logs",
          label: "İstemci Logları",
          columns: [
              { key: "action", label: "Eylem" }, { key: "timestamp", label: "Tarih" }, { key: "details", label: "Detaylar" },
              { key: "client_uuid", label: "İstemci UUID" }, { key: "client_hostname", label: "İstemci Adı" },
          ],
          rows: client_logs.map(log => ({
              ...log,
              timestamp: new Date(log.timestamp).toLocaleString('tr-TR'),
              details: JSON.stringify(log.details),
          })),
        }
      ];
      setTabs(newTabs);
    }
    
    createTabs(policyAssignments, policyLogs, clientLogs);
  }, [policyAssignments, policyLogs, clientLogs]);

  // Pagination bileşeninden gelen sayfa değiştirme olayını yöneten fonksiyon
  const handlePageChange = (tabId: string, page: number) => {
    setPagination(prev => ({
      ...prev,
      [tabId]: { ...prev[tabId as keyof typeof prev], current: page },
    }));
  };
  
  const getPaginationForTab = (tabId: string) => {
      return pagination[tabId as keyof typeof pagination];
  }
  
  return (
    <DefaultLayout>
        <Tabs aria-label="tab" items={tabs}>
          {(item) => (
            <Tab key={item.id} title={item.label}>
              <Card>
                <CardBody>
                  <Table aria-label="table" className="min-h-[70vh]">
                    <TableHeader columns={item.columns}>
                      {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
                    </TableHeader>
                    <TableBody 
                      items={item.rows}
                      isLoading={loading[item.id]}
                      loadingContent={<Spinner label="Yükleniyor..." />}
                      emptyContent={"Gösterilecek log bulunamadı."}
                    >
                      {(row) => (
                        <TableRow key={row.id}>
                          {(columnKey) => <TableCell
                            className={
                                positiveMessages.includes(getKeyValue(row, columnKey)) ? 'text-emerald-500' :
                                negativeMessages.includes(getKeyValue(row, columnKey)) ? 'text-red-500' : ''
                            }
                          >
                            {getKeyValue(row, columnKey)}
                          </TableCell>}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  <div className="flex justify-center items-center p-4">
                    {/* Yüklenme tamamlandığında ve sayfa sayısı 1'den fazla ise Pagination'ı göster */}
                    {!loading[item.id] && getPaginationForTab(item.id).total > 1 && (
                        <Pagination
                            total={getPaginationForTab(item.id).total}
                            page={getPaginationForTab(item.id).current}
                            onChange={(page) => handlePageChange(item.id, page)}
                        />
                    )}
                  </div>
                </CardBody>
              </Card>
            </Tab>
          )}
        </Tabs>
    </DefaultLayout>
  );
}