import React, { useEffect, useState } from "react";
import DefaultLayout from "@/layouts/default";
import {Tabs, Tab} from "@heroui/tabs";
import { Card, CardBody } from "@heroui/card";
import { Table, TableHeader, TableColumn, TableBody, TableCell, TableRow, getKeyValue } from "@heroui/table";

type TabItem = {
  id: string;
  label: string;
  columns: { key: string; label: string }[];
  rows: Record<string, any>[];
};

type PolicyAssignment = {
  id: string;
  policy: {
    policy_type_name: string;
    name: string;
  }
  assigned_to_username: string;
  created_at: string;
};
type PolicyLogs = {
  id: string;
  action: string;
  timestamp: string;
  details: string;
};
type ClientLogs = {
  id: string;
  action: string;
  timestamp: string;
  details: string;
  client_uuid: string;
  client_hostname: string;
};

export default function DocsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [policy_assignments, setPolicyAssingments] = useState<PolicyAssignment[] | null>(null);
  const [policy_logs, setPolicyLogs] = useState<PolicyLogs[] | null>(null);
  const [client_logs, setClientLogs] = useState<ClientLogs[] | null>(null);
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const positiveMessages = ["login", "connected", "policy_applied"];
  const negativeMessages = ["disconnected","failed", "policy_failed"];

  const fetchPolicyAssingments = () => {
    fetch(`${API_BASE}/policy/policy_assignments/`)
      .then(res => res.json())
      .then(setPolicyAssingments)
      .catch(err => console.error('Error fetching policy assignments'));
  };
  const fetchPolicyLogs = () => {
    fetch(`${API_BASE}/policy/policy_logs/`)
      .then(res => res.json())
      .then(setPolicyLogs)
      .catch(err => console.error('Error fetching policy logs'));
  };
  const fetchClientLogs = () => {
    fetch(`${API_BASE}/client/client_logs/`)
      .then(res => res.json())
      .then(setClientLogs)
      .catch(err => console.error('Error fetching client logs'));
  };

  const createTabs = (assignments: PolicyAssignment[], logs: PolicyLogs[], client_logs: ClientLogs[]): void => {
    let tabs = [
      {
        id: "policy_assignments",
        label: "Politika Atamaları",
        columns: [
          { key: "policy_type_name", label: "Politika Türü" },
          { key: "policy_name", label: "Politika Adı" },
          { key: "assigned_to_username", label: "Atanan Kullanıcı" },
          { key: "created_at", label: "Oluşturulma Tarihi" },
        ],
        rows: assignments.map(assignment => ({
          key: assignment.id,
          policy_type_name: assignment.policy.policy_type_name,
          policy_name: assignment.policy.name,
          assigned_to_username: assignment.assigned_to_username,
          created_at: new Date(assignment.created_at).toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        })),
      },
      {
        id: "policy_logs",
        label: "Politika Logları",
        columns: [
          { key: "action", label: "Eylem" },
          { key: "timestamp", label: "Tarih" },
          { key: "details", label: "Detaylar" },
        ],
        rows: logs.map(log => ({ 
          ...log,
          timestamp: new Date(log.timestamp).toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          details: JSON.stringify(log.details),
        })),
      },
      {
        id: "client_logs",
        label: "İstemci Logları",
        columns: [
          { key: "action", label: "Eylem" },
          { key: "timestamp", label: "Tarih" },
          { key: "details", label: "Detaylar" },
          { key: "client_uuid", label: "İstemci UUID" },
          { key: "client_hostname", label: "İstemci Adı" },
        ],
        rows: client_logs ? client_logs.map(log => ({
          ...log,
          timestamp: new Date(log.timestamp).toLocaleString('tr-TR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          details: JSON.stringify(log.details),
        })) : [],
      }
    ];
    setTabs(tabs);
  }

  useEffect(() => {
    fetchPolicyAssingments();
    fetchPolicyLogs();
    fetchClientLogs();

    const intervalId = setInterval(() => {
      fetchPolicyAssingments();
      fetchPolicyLogs();
      fetchClientLogs();
    }, 10000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (policy_assignments && policy_logs && client_logs) {
      createTabs(policy_assignments, policy_logs, client_logs);
    }
  }, [policy_assignments, policy_logs, client_logs]);

  return (
    <DefaultLayout>
        <Tabs aria-label="tab" items={tabs}>
          {(item) => (
            <Tab key={item.id} title={item.label}>
              <Card>
                <CardBody>
                  <Table aria-label="table" className="max-h-[70vh]">
                    <TableHeader columns={item.columns}>
                      {(column) => <TableColumn key={column.key}>{column.label}</TableColumn>}
                    </TableHeader>
                    <TableBody items={item.rows}>
                      {(row) => (
                        <TableRow key={row.id}>
                          {(columnKey) => <TableCell
                                            className={
                                              positiveMessages.includes(getKeyValue(row, columnKey))
                                                ? 'text-emerald-500'
                                                : negativeMessages.includes(getKeyValue(row, columnKey))
                                                ? 'text-red-500'
                                                : ''
                                            }
                                          >
                                            {getKeyValue(row, columnKey)}
                                          </TableCell>}
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>           
                </CardBody>
              </Card>
            </Tab>
          )}
        </Tabs>
    </DefaultLayout>
  );
}

