import DefaultLayout from "@/layouts/default";
import { useEffect, useState } from 'react';
import { ChangeEvent } from 'react';

import { Select, SelectItem} from "@heroui/select";
import { Input} from "@heroui/input";
import { Button} from "@heroui/button";
import { Divider} from "@heroui/divider";
import { Chip} from "@heroui/chip";
import { addToast } from "@heroui/toast";
import { Checkbox } from "@heroui/checkbox";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell} from "@heroui/table";
import { DeleteIcon, EditIcon, OrganizationIcon, PolicyIcon, UserGroupIcon, UserIcon } from "@/components/icons";


type PolicyType = {
  id: number;
  name: string;
  description: string;
  parameters: Record<string, any>; 
  created_at: string;
};

 type Policy = {
  id: number;
  name: string;
  parameters: Record<string, any>;
  description: string;
  created_at: string;
  policy_type: string;
  policy_type_name: string; 
  policy_type_parameters: Record<string, any>; 
};

type User = {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  groups: {
    id: number;
    name: string;
    organization_name: string;
    organization: number;
  }[];
  group_ids?: number[];
  policies: number[];
  is_active: boolean;
};

export default function DocsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [policies, setPolicy] = useState<Policy[] | null>(null);
  const [policy_types, setPolicyType] = useState<PolicyType[] | null>(null);
  const [selectedPolicyType, setSelectedPolicyType] = useState<PolicyType | null>(null);
  const [users, setUser] = useState<User[] | null>(null);
  const [selOrgs, setSelOrgs] = useState<number[]>([]);
  const [selGroups, setSelGroups] = useState<number[]>([]);
  const [selUsers, setSelUsers] = useState<number[]>([]);
  const [selPolicies, setSelPolicies] = useState<number[]>([]);
  const [isPolicyModalOpen, setPolicyModalOpen] = useState(false);
  const [editPolicy, setEditPolicy] = useState<Policy | null>(null);

  const [newPolicy, setNewPolicy] = useState({
    name: '',
    description: '',
    parameters: {} as Record<string, any>,
    policy_type: '',
  });

  const fetchPolicies = () => {
    fetch(`${API_BASE}/policy/policies/`)
      .then(res => res.json())
      .then(setPolicy)
      .catch(err => console.error('Error fetching policies'));
  };
  const fetchPolicyTypes = () => {
    fetch(`${API_BASE}/policy/policy_types/`)
      .then(res => res.json())
      .then(setPolicyType)
      .catch(err => console.error('Error fetching policy types'));
  };
  const fetchUsers = () => {
    fetch(`${API_BASE}/user/users/`)
      .then(res => res.json())
      .then(setUser)
      .catch(err => console.error('Error fetching users'));
  }

  useEffect(() => {
    if (editPolicy && policy_types) {
      const type = policy_types.find(p => p.id === Number(editPolicy.policy_type));
      setSelectedPolicyType(type ?? null);
    }
  }, [editPolicy, policy_types]);

  useEffect(() => {
    fetchPolicies();
    fetchPolicyTypes();
    fetchUsers();
  }, []);

  const handleCreatePolicy = async () => {
    try {
      const res = await fetch(`${API_BASE}/policy/policies/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPolicy)
      });
  
      if (res.ok) {
        const created = await res.json();
        setPolicy(prev => (prev ? [...prev, created] : [created]));
        setPolicyModalOpen(false);
        setNewPolicy({ name: '', description: '', parameters: {}, policy_type: '' });
        fetchUsers();
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Politika oluşturulamadı.'));
      }
    } catch (err) {
      console.error('Politika oluşturma hatası:', err);
    }
  };

  const handleUpdatePolicy = async () => {
    if (!editPolicy) return;

    try {
      const res = await fetch(`${API_BASE}/policy/policies/${editPolicy.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editPolicy)
      });

      if (res.ok) {
        const updated = await res.json();
        setPolicy(prev => prev?.map(u => u.id === updated.id ? updated : u) || [updated]);
        setEditPolicy(null);
        setPolicyModalOpen(false);
        fetchPolicies();
        fetchUsers();
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Politika güncellenemedi.'));
      }
    } catch (err) {
      console.error('Politika güncelleme hatası:', err);
    }
  };

  const handlePolicyAssignment = async (userIds: number[], policyIds: number[]) => {
    if (userIds.length === 0) {
      alert('En az bir kullanıcı seçmelisiniz.');
      return;
    }
    console.log('Atanacak politikalar:', policyIds);
    console.log('Atanacak kullanıcılar:', userIds);

    for (const user_id of userIds) {
      const user = users?.find(u => u.id === user_id);
      if (!user) {
        alert(`Kullanıcı bulunamadı: ${user_id}`);
        return;
      }
      // let unassigned_policies = user.policies?.filter(p_id => !policyIds.includes(p_id))
      user.policies = []
      for (const policy_id of policyIds) {
        const policy = policies?.find(p => p.id === policy_id);
        if (!policy) {
          alert(`Politika bulunamadı: ${policy_id}`);
          return;
        }
        user.policies.push(policy_id);
        const policy_assing = await fetch(`${API_BASE}/policy/policy_assignments/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ "policy_id": policy_id, "assigned_to_id": user_id })
        });
        if (policy_assing.ok) {
          let policy_assinged = await policy_assing.json();
        }
      }
      const user_update = await fetch(`${API_BASE}/user/users/${user_id}/`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({policies : user.policies})
        });
      if (user_update.ok) {
        let user_updated = await user_update.json();
      }
    }
    setSelOrgs([]);
    setSelGroups([]);
    setSelUsers([]);
    setSelPolicies([]);
    addToast({
      title: "Politikalar Atandı",
      description: `${policyIds.length} politika ${userIds.length} kullanıcıya atandı.`,
      timeout: 5000,
      shouldShowTimeoutProgress: true,
      color: "success",
    });
  }

  const deletePolicy = async (id: number, name: string) => {
    if (!confirm(name+ ' adlı politika silinsin mi')) return;
  
    const res = await fetch(`${API_BASE}/policy/policies/${id}/`, {
      method: 'DELETE',
    });
  
    if (res.ok) {
      setPolicy(prev => prev?.filter(u => u.id !== id) || null);
    } else {
      alert('Silme başarısız');
    }
  };  

  function toggleUserWithPolicies(user: User) {
    setSelUsers(prevUsers => {
      const isSelected = prevUsers.includes(user.id);

      if (isSelected) {
        const updatedUsers = prevUsers.filter(id => id !== user.id);
        setSelPolicies(prevPolicies => {
          const otherUsers = users?.filter(u => updatedUsers.includes(u.id)) || [];

          const remainingPolicyIds = new Set<number>();
          for (const other of otherUsers) {
            for (const pid of other.policies) {
              remainingPolicyIds.add(pid);
            }
          }

          return prevPolicies.filter(pid => remainingPolicyIds.has(pid));
        });

        return updatedUsers;

      } else {
        const updatedUsers = [...prevUsers, user.id];
        setSelPolicies(prevPolicies => {
          const merged = new Set([...prevPolicies, ...user.policies]);
          return Array.from(merged);
        });

        return updatedUsers;
      }
    });
  }

  function toggleGroup(groupId: number) {
    setSelGroups(prevGroups => {
      const isSelected = prevGroups.includes(groupId);
      const updatedGroups = isSelected
        ? prevGroups.filter(id => id !== groupId)
        : [...prevGroups, groupId];

      const affectedUsers = (users ?? []).filter(user =>
        user.groups.some(g => g.id === groupId)
      );

      setSelUsers(prevUsers => {
        const updatedUsers = new Set(prevUsers);
        affectedUsers.forEach(user =>
          isSelected ? updatedUsers.delete(user.id) : updatedUsers.add(user.id)
        );
        return Array.from(updatedUsers);
      });

      setSelPolicies(prevPolicies => {
        const current = new Set(prevPolicies);
        affectedUsers.forEach(user =>
          user.policies.forEach(pid => {
            isSelected ? current.delete(pid) : current.add(pid);
          })
        );
        return Array.from(current);
      });

      return updatedGroups;
    });
  }

  function toggleOrganization(orgId: number) {
    setSelOrgs(prevOrgs => {
      const isSelected = prevOrgs.includes(orgId);
      const updatedOrgs = isSelected
        ? prevOrgs.filter(id => id !== orgId)
        : [...prevOrgs, orgId];

      const affectedUsers = (users ?? []).filter(user =>
        user.groups.some(g => g.organization === orgId)
      );

      setSelGroups(prevGroups => {
        const orgGroupIds = new Set(
          affectedUsers.flatMap(u =>
            u.groups
              .filter(g => g.organization === orgId)
              .map(g => g.id)
          )
        );
        const groupSet = new Set(prevGroups);
        orgGroupIds.forEach(id =>
          isSelected ? groupSet.delete(id) : groupSet.add(id)
        );
        return Array.from(groupSet);
      });

      setSelUsers(prevUsers => {
        const updatedUsers = new Set(prevUsers);
        affectedUsers.forEach(user =>
          isSelected ? updatedUsers.delete(user.id) : updatedUsers.add(user.id)
        );
        return Array.from(updatedUsers);
      });

      setSelPolicies(prevPolicies => {
        const current = new Set(prevPolicies);
        affectedUsers.forEach(user =>
          user.policies.forEach(pid => {
            isSelected ? current.delete(pid) : current.add(pid);
          })
        );
        return Array.from(current);
      });

      return updatedOrgs;
    });
  }
  
  const uniqueOrgs = Array.from(
    new Map(
      users?.flatMap(user =>
        user.groups.map(group => [group.organization, {
          id: group.organization,
          name: group.organization_name
        }])
      ) ?? []
    ).values()
  );

  const uniqueGroups = Array.from(
    new Map(
      users?.flatMap(user => user.groups.map(group => [group.id, group])) || []
    ).values()
  );

  return (
    <DefaultLayout>
      {isPolicyModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4">{editPolicy ? 'Politikayı Düzenle' : 'Yeni Politika'}</h2>
            <Input 
              className="mb-2"
              label="Politika Adı" 
              placeholder="Politika Adı" 
              type="text"
              value={(editPolicy ?? newPolicy).name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editPolicy
                  ? setEditPolicy({ ...editPolicy, name: value })
                  : setNewPolicy({ ...newPolicy, name: value });
              }}
            />
            <Input 
              className="mb-2"
              label="Açıklama" 
              placeholder="Açıklama" 
              type="text"
              value={(editPolicy ?? newPolicy).description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editPolicy
                  ? setEditPolicy({ ...editPolicy, description: value })
                  : setNewPolicy({ ...newPolicy, description: value });
              }}
            />
            <Select
              label="Politika Tipi Seçin"
              className="max-w-xs mb-4"
              selectedKeys={editPolicy ? [editPolicy.policy_type] : [newPolicy.policy_type]}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const selectedId = e.target.value;
                const selectedType = policy_types?.find(p => p.id.toString() === selectedId) || null;
                setSelectedPolicyType(selectedType);

                if (editPolicy) {
                  setEditPolicy({ ...editPolicy, policy_type: selectedId, parameters: {} });
                } else {
                  setNewPolicy({ ...newPolicy, policy_type: selectedId, parameters: {} });
                }
              }}
            >
              {(policy_types ?? []).map((policy_type) => (
                <SelectItem key={policy_type.id.toString()}>{policy_type.name}</SelectItem>
              ))}
            </Select>
            {selectedPolicyType && (
              <div className="mb-4">
                <h4 className="text-sm font-semibold mb-2">Parametreler</h4>
                {Object.entries(selectedPolicyType.parameters).map(([key, defaultValue]) => (
                  <Input
                    key={key}
                    className="mb-2"
                    label={key}
                    placeholder={`${key} giriniz`}
                    value={
                      editPolicy
                        ? editPolicy.parameters?.[key] ?? ''
                        : newPolicy.parameters?.[key] ?? ''
                    }
                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                      const value = e.target.value;
                      if (editPolicy) {
                        setEditPolicy({
                          ...editPolicy,
                          parameters: { ...editPolicy.parameters, [key]: value },
                        });
                      } else {
                        setNewPolicy({
                          ...newPolicy,
                          parameters: { ...newPolicy.parameters, [key]: value },
                        });
                      }
                    }}
                  />
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button 
                color="danger"
                onPress={() => {
                  setPolicyModalOpen(false);
                  setEditPolicy(null);
                  setNewPolicy({name: '', description: '', parameters: {}, policy_type: '' });
                  setSelectedPolicyType(null);
                }}
              >
                İptal
              </Button>
              <Button 
                color="primary"
                onPress={editPolicy ? handleUpdatePolicy : handleCreatePolicy}
              >
                {editPolicy ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
        <PolicyIcon className="text-blue-600"/>
        Politika Ata
      </h1>
      <section className="flex gap-4 py-8 md:py-10">
        <div className="inline-block w-1/4 p-3 shadow rounded-lg border border-gray-200 overflow-y-auto max-h-150">
          <h4 className="flex gap-2 font-medium mb-2"><OrganizationIcon className="text-blue-500"/> Organizasyonlar</h4>
          <Divider className="my-2" />
          {uniqueOrgs.map(org => (
            <Checkbox
              key={org.id}
              isSelected={selOrgs.includes(org.id)}
              onValueChange={() => toggleOrganization(org.id)}
              className="block mb-1"
            >
              {org.name}
            </Checkbox>
          ))}
        </div>
        <div className="inline-block w-1/4 p-3 shadow rounded-lg border border-gray-200 overflow-y-auto max-h-150">
          <h4 className="flex gap-2 font-medium mb-2"><UserGroupIcon className="text-purple-500"/> Gruplar</h4>
          <Divider className="my-2" />
          {uniqueGroups.map(group => (
            <Checkbox
              key={group.id}
              isSelected={selGroups.includes(group.id)}
              onValueChange={() => toggleGroup(group.id)}
              className="block mb-1"
            >
              {group.name}
            </Checkbox>
          ))}
        </div>
        <div className="inline-block w-1/2 p-3 shadow rounded-lg border border-gray-200 overflow-y-auto max-h-150">
          <h4 className="flex gap-2 font-medium mb-2"><UserIcon className="text-green-500"/> Kullanıcılar</h4>
          <Divider className="my-2" />
          {users?.map(user => (
            <Checkbox
              key={user.id}
              isSelected={selUsers.includes(user.id)}
              onValueChange={() => toggleUserWithPolicies(user)}
              className="block mb-1"
            >
              {user.username} ({user.first_name} {user.last_name})
            </Checkbox>
          ))}
        </div>
      </section>
        <div className="inline-block w-full p-3 shadow rounded-lg border border-gray-200 overflow-y-auto max-h-150">
          <h4 className="flex gap-2 font-medium mb-2"><PolicyIcon className="text-emerald-500"/> Politikalar</h4>
          <Divider className="my-2" />
          {policies?.map(policy => (
            <Checkbox
              key={policy.id}
              isSelected={selPolicies.includes(policy.id)}
              onValueChange={(isSelected: boolean) => {
                setSelPolicies(prev =>
                  isSelected
                    ? [...prev, policy.id]
                    : prev.filter(id => id !== policy.id)
                );
              }}
              className="block mb-1"
            >
              {policy.name}
            </Checkbox>
          ))}
        </div>
        <div className="justify-end flex md:flex-row gap-4 mt-4">
          <Button
            color="primary"
            className="mt-4 text-xl p-6"
            onPress={() => {
              handlePolicyAssignment(selUsers, selPolicies);
            }}
          >
            Politikaları Ata
          </Button>
        </div>

      <Divider className="my-6" />
      <section className="flex flex-col gap-4 py-8 md:py-10">
        <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200 overflow-y-auto max-h-150">
          <div className="flex justify-between items-center px-6 pt-6 pb-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <PolicyIcon className="text-blue-600"/>
              Politikalar
            </h1>
            <Button 
              color="primary"
              onPress={() => {
                setSelectedPolicyType(null);
                setPolicyModalOpen(true)}}
            >
              + Politika Ekle
            </Button>
          </div>
          <p className="text-sm px-6 pb-4">
            Sistemde kayıtlı tüm politikaların listesi.
          </p>
          <Table aria-label="Kullanıcılar tablosu">
            <TableHeader>
                <TableColumn >Politika</TableColumn>
                <TableColumn >Açıklama</TableColumn>
                <TableColumn >Parametreler</TableColumn>
                <TableColumn >Oluşturulma Zamanı</TableColumn>
                <TableColumn >Düzenle</TableColumn>
            </TableHeader>
          {policies && policies.length > 0 ? (
            <TableBody>
              {policies.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <p className="text-bold text-sm">{policy.name}</p>
                      <p className="text-bold text-sm text-default-400">{policy.policy_type_name}</p>
                    </div>
                  </TableCell>
                  <TableCell>{policy.description}</TableCell>
                  <TableCell>
                    {policy.parameters && Object.keys(policy.parameters).length === 0 ? (
                      <p className="text-default-400">Parametre yok</p>
                    ) : (
                      <div className="flex flex-col">
                        {Object.entries(policy.parameters).map(([key, value]) => 
                            <p key={key} className="text-sm"><strong>{key}</strong>: {value}</p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {new Date(policy.created_at).toLocaleDateString('tr-TR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                    })}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => {
                        setEditPolicy(policy);
                        setPolicyModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <EditIcon/>
                    </button>
                    <button
                      onClick={() => {
                        deletePolicy(policy.id, policy.name)
                      }}
                      className="text-red-600 hover:text-red-800 cursor-pointer"
                    >
                      <DeleteIcon/>
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          ) : (
            <TableBody emptyContent={"Veri Yok."}>{[]}</TableBody>
          )}
          </Table>
        </div>
      </section>

    </DefaultLayout>
  );
}
