import React, { useEffect, useState, useCallback } from "react";
import DefaultLayout from "@/layouts/default";
import { Tabs, Tab } from "@heroui/tabs";
import { Card, CardBody } from "@heroui/card";
import { Table, TableHeader, TableColumn, TableBody, TableCell, TableRow, getKeyValue } from "@heroui/table";
import { Spinner } from "@heroui/spinner";
import dynamic from 'next/dynamic';

const Pagination = dynamic(
  () => import('@heroui/pagination').then((mod) => mod.Pagination),
  { ssr: false }
);

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
    client_uuid?: string;
    source?: 'user' | 'client';
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

const PAGE_SIZE = 50; 

export default function LogsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;

  const [policyAssignments, setPolicyAssignments] = useState<PolicyAssignment[]>([]);
  const [userPolicyLogs, setUserPolicyLogs] = useState<PolicyLogs[]>([]);
  const [clientStatusLogs, setClientStatusLogs] = useState<ClientLogs[]>([]);
  const [clientPolicyAssignments, setClientPolicyAssignments] = useState<ClientLogs[]>([]);
  const [clientPolicyLogs, setClientPolicyLogs] = useState<PolicyLogs[]>([]);

  const [pagination, setPagination] = useState({
    user_policy_assignments: { current: 1, total: 0 },
    user_policy_logs: { current: 1, total: 0 },
    client_status_logs: { current: 1, total: 0 },
    client_policy_assignments: { current: 1, total: 0 }, 
    client_policy_logs: { current: 1, total: 0 }, 
  });

  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [tabs, setTabs] = useState<TabItem[]>([]);
  
  const positiveMessages = ["login", "connected", "policy_applied", "policy_assigned"];
  const negativeMessages = ["disconnected", "failed", "policy_failed", "policy_removed"];

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
      if (!res.ok) throw new Error(`Fetch error: ${res.statusText} (${url})`);
      const data: PaginatedResponse<T> = await res.json();
      
      setData(data.results);
      setTotalPages(Math.ceil(data.count / PAGE_SIZE));

    } catch (err) {
      console.error(`Veri çekme hatası (${key}):`, err);
      setData([]);
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [API_BASE]); 

  useEffect(() => {
    fetchPaginatedData(
      '/policy/policy_assignments/', 
      pagination.user_policy_assignments.current,
      setPolicyAssignments,
      (total) => setPagination(p => ({ ...p, user_policy_assignments: { ...p.user_policy_assignments, total } })),
      'user_policy_assignments'
    );
  }, [pagination.user_policy_assignments.current, fetchPaginatedData]);

  useEffect(() => {
    fetchPaginatedData(
      '/policy/policy_logs/', 
      pagination.user_policy_logs.current,
      setUserPolicyLogs,
      (total) => setPagination(p => ({ ...p, user_policy_logs: { ...p.user_policy_logs, total } })),
      'user_policy_logs'
    );
  }, [pagination.user_policy_logs.current, fetchPaginatedData]);

  useEffect(() => {
    fetchPaginatedData(
      '/client/client_logs/', 
      pagination.client_status_logs.current,
      setClientStatusLogs,
      (total) => setPagination(p => ({ ...p, client_status_logs: { ...p.client_status_logs, total } })),
      'client_status_logs'
    );
  }, [pagination.client_status_logs.current, fetchPaginatedData]);

  useEffect(() => {
    fetchPaginatedData(
      '/client/client_policy_assignment_logs/', 
      pagination.client_policy_assignments.current,
      setClientPolicyAssignments,
      (total) => setPagination(p => ({ ...p, client_policy_assignments: { ...p.client_policy_assignments, total } })),
      'client_policy_assignments'
    );
  }, [pagination.client_policy_assignments.current, fetchPaginatedData]);

  useEffect(() => {
    fetchPaginatedData(
      '/policy/client_policy_logs/',
      pagination.client_policy_logs.current,
      setClientPolicyLogs,
      (total) => setPagination(p => ({ ...p, client_policy_logs: { ...p.client_policy_logs, total } })),
      'client_policy_logs'
    );
  }, [pagination.client_policy_logs.current, fetchPaginatedData]);

  useEffect(() => {
    const createTabs = (): void => {
      let newTabs: TabItem[] = [
        {
          id: "user_policy_assignments",
          label: "Kullanıcı Atama Logları",
          columns: [
            { key: "policy_type_name", label: "Politika Türü" }, { key: "policy_name", label: "Politika Adı" },
            { key: "assigned_to_username", label: "Atanan Kullanıcı" }, { key: "created_at", label: "Tarih" },
          ],
          rows: policyAssignments.map(assignment => ({
            key: assignment.id,
            policy_type_name: assignment.policy?.policy_type_name ?? 'N/A',
            policy_name: assignment.policy?.name ?? 'N/A',
            assigned_to_username: assignment.assigned_to_username,
            created_at: new Date(assignment.created_at).toLocaleString('tr-TR'),
          })),
        },
        {
          id: "user_policy_logs",
          label: "Kullanıcı Sonuç Logları",
          columns: [
            { key: "action", label: "Eylem" }, { key: "timestamp", label: "Tarih" }, 
            { key: "policy_type", label: "Politika Türü" }, { key: "details", label: "Detay" },
            { key: "username", label: "Kullanıcı" },
          ],
          rows: userPolicyLogs.map(log => ({ 
            id: log.id,
            action: log.action,
            timestamp: new Date(log.timestamp).toLocaleString('tr-TR'),
            policy_type: log.details.policy_type ?? 'N/A',
            details: log.details.message, 
            username: log.details.username ?? 'N/A',
          })),
        },
        {
          id: "client_status_logs",
          label: "İstemci Durum Logları",
          columns: [
            { key: "action", label: "Eylem" }, { key: "timestamp", label: "Tarih" }, 
            { key: "client_hostname", label: "İstemci Adı" }, { key: "details", label: "Detay (IP)" },
          ],
          rows: clientStatusLogs.map(log => ({
            ...log,
            timestamp: new Date(log.timestamp).toLocaleString('tr-TR'),
            details: log.details?.ip ?? log.details?.hostname ?? JSON.stringify(log.details),
          })),
        },

        {
          id: "client_policy_assignments",
          label: "İstemci Atama Logları",
          columns: [
            { key: "action", label: "Eylem" }, { key: "timestamp", label: "Tarih" },
            { key: "client_hostname", label: "İstemci Adı" }, { key: "policy_name", label: "Politika Adı" },
            { key: "details", label: "Detay" },
          ],
          rows: clientPolicyAssignments.map(log => ({
            id: log.id,
            action: log.action,
            timestamp: new Date(log.timestamp).toLocaleString('tr-TR'),
            client_hostname: log.client_hostname,
            policy_name: log.details.policy_name ?? 'N/A',
            details: log.details.message,
          })),
        },
        {
          id: "client_policy_logs",
          label: "İstemci Sonuç Logları",
          columns: [
            { key: "action", label: "Eylem" }, { key: "timestamp", label: "Tarih" },
            { key: "client_uuid", label: "İstemci UUID" },
            { key: "policy_type", label: "Politika Türü" }, { key: "details", label: "Detay" },
          ],
          rows: clientPolicyLogs.map(log => ({
            id: log.id,
            action: log.action,
            timestamp: new Date(log.timestamp).toLocaleString('tr-TR'),
            client_uuid: log.details.client_uuid ?? 'N/A',
            policy_type: log.details.policy_type ?? 'N/A',
            details: log.details.message,
          })),
        },
      ];
      setTabs(newTabs);
    }

    createTabs();
  },
    [
      policyAssignments, 
      userPolicyLogs, 
      clientStatusLogs, 
      clientPolicyAssignments, 
      clientPolicyLogs
    ]
  );
 
  const handlePageChange = (tabId: string, page: number) => {
    setPagination(prev => {
      if (tabId in prev) {
        return {
          ...prev,
          [tabId]: { ...prev[tabId as keyof typeof prev], current: page },
        };
      }
      return prev;
    });
  };
  
  const getPaginationForTab = (tabId: string) => {
      return pagination[tabId as keyof typeof pagination] || { current: 1, total: 0 };
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
                        <TableRow key={row.key ?? row.id}> 
                          {(columnKey) => <TableCell
                            className={
                                String(getKeyValue(row, columnKey)).includes('policy_failed') || negativeMessages.includes(String(getKeyValue(row, columnKey))) ? 'text-red-500' :
                                String(getKeyValue(row, columnKey)).includes('policy_applied') || positiveMessages.includes(String(getKeyValue(row, columnKey))) ? 'text-emerald-500' : ''
                            }
                          >
                            {getKeyValue(row, columnKey)}
                          </TableCell>}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  
                  <div className="flex justify-center items-center p-4">
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