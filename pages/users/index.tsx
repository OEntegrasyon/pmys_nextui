import DefaultLayout from "@/layouts/default";
import { useEffect, useState, useMemo } from 'react';
import { ChangeEvent } from 'react';

import { Select, SelectItem} from "@heroui/select";
import { Input} from "@heroui/input";
import { Button} from "@heroui/button";
import { Chip} from "@heroui/chip";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell} from "@heroui/table";
import { CloseIcon, DeleteIcon, EditIcon, OrganizationIcon, UserGroupIcon, UserIcon } from "@/components/icons";

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
  }[];
  group_ids?: number[];
  policies: number[];
  is_active: boolean;
};

type Group = {
  id: number;
  name: string;
  description: string;
  user_count: number;
  organization: string;
  organization_name: string;
};

type Organization = {
  id: number;
  name: string;
  description: string;
  group_count: number;
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

export default function DocsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [users, setUser] = useState<User[] | null>(null);
  const [groups, setGroup] = useState<Group[] | null>(null);
  const [organizations, setOrganization] = useState<Organization[] | null>(null);
  const [search, setSearch] = useState("");
  const [policies, setPolicy] = useState<Policy[] | null>(null);
  const [isUserModalOpen, setUserModalOpen] = useState(false);
  const [isGroupModalOpen, setGroupModalOpen] = useState(false);
  const [isOrganizationModalOpen, setOrganizationModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editOrganization, setEditOrganization] = useState<Organization | null>(null);
  const [isUserDetailModalOpen, setUserDetailModalOpen] = useState(false);
  const [userDetail, setUserDetail] = useState<User | null>(null);
  
  const [newUser, setNewUser] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
    group_ids: [] as number[],
  });
  const [newGroup, setNewGroup] = useState({
    name: '',
    description: '',
    organization: '',
  });
  const [newOrganization, setNewOrganization] = useState({
    name: '',
    description: '',
  });

  const fetchUsers = () => {
    fetch(`${API_BASE}/user/users/`)
      .then(res => res.json())
      .then(data => setUser(data.results))
      .catch(err => console.error('Error fetching users:', err));
  };

  const fetchGroups = () => {
    fetch(`${API_BASE}/user/groups/`)
      .then(res => res.json())
      .then(data => setGroup(data.results))
      .catch(err => console.error('Error fetching groups:', err));
  };

  const fetchOrganizations = () => {
    fetch(`${API_BASE}/user/organizations/`)
      .then(res => res.json())
      .then(data => setOrganization(data.results))
      .catch(err => console.error('Error fetching organizations:', err));
  };

  const fetchPolicies = () => {
    fetch(`${API_BASE}/policy/policies/?paginate=false`)
      .then(res => res.json())
      .then(data => setPolicy(data))
      .catch(err => console.error('Error fetching policies'));
  };

  useEffect(() => {
    fetchUsers();
    fetchGroups();
    fetchOrganizations();
    fetchPolicies();
  }, []);

  const filteredUsers = useMemo(() => {
    if (!users) return null;
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u => {
      if (u.username.toLowerCase().includes(q)) return true;
      if (u.email.toLowerCase().includes(q)) return true;
      if ((u.first_name || '').toLowerCase().includes(q)) return true;
      if ((u.last_name || '').toLowerCase().includes(q)) return true;
      if (u.groups.some(g => (g.name || '').toLowerCase().includes(q))) return true;
      if (u.groups.some(g => (g.organization_name || '').toLowerCase().includes(q))) return true;
      return false;
    });
  }, [users, search]);

  const filteredGroups = useMemo(() => {
    if (!groups) return null;
    const q = search.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => {
      if (g.name.toLowerCase().includes(q)) return true;
      if ((g.description || '').toLowerCase().includes(q)) return true;
      if ((g.organization_name || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }, [groups, search]);

  const filteredOrganizations = useMemo(() => {
    if (!organizations) return null;
    const q = search.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(org => {
      if (org.name.toLowerCase().includes(q)) return true;
      if ((org.description || '').toLowerCase().includes(q)) return true;
      return false;
    });
  }, [organizations, search]);

  const handleChangeUserStatus = (id: number, isActive: boolean) => async () => {
    const newStatus = !isActive;
    const res = await fetch(`${API_BASE}/user/users/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newStatus })
    });

    if (res.ok) {
      setUser(prev => prev?.map(u => u.id === id ? { ...u, is_active: newStatus } : u) || null);
    } else {
      console.error('Aktiflik durumu güncellenemedi.');
    }
  }

  const handleCreateUser = async () => {
    try {
      const res = await fetch(`${API_BASE}/user/users/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser)
      });
  
      if (res.ok) {
        const created = await res.json();
        setUser(prev => (prev ? [...prev, created] : [created]));
        setUserModalOpen(false);
        setNewUser({ username: '', email: '', first_name: '', last_name: '', group_ids: [] });
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Kullanıcı oluşturulamadı.'));
      }
    } catch (err) {
      console.error('Kullanıcı oluşturma hatası:', err);
    }
  };

  const handleUpdateUser = async () => {
    if (!editUser) return;

    try {
      const res = await fetch(`${API_BASE}/user/users/${editUser.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editUser)
      });

      if (res.ok) {
        const updated = await res.json();
        setUser(prev => prev?.map(u => u.id === updated.id ? updated : u) || [updated]);
        setEditUser(null);
        setUserModalOpen(false);
        fetchUsers();
        fetchGroups();
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Kullanıcı güncellenemedi.'));
      }
    } catch (err) {
      console.error('Kullanıcı güncelleme hatası:', err);
    }
  };

  const handleCreateGroup = async () => {
    try {
      const res = await fetch(`${API_BASE}/user/groups/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGroup)
      });
  
      if (res.ok) {
        const created = await res.json();
        setGroup(prev => (prev ? [...prev, created] : [created]));
        setGroupModalOpen(false);
        setNewGroup({ name: '', description: '', organization: '' });
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Grup oluşturulamadı.'));
      }
    } catch (err) {
      console.error('Grup oluşturma hatası:', err);
    }
  };

  const handleUpdateGroup = async () => {
    if (!editGroup) return;

    try {
      const res = await fetch(`${API_BASE}/user/groups/${editGroup.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editGroup)
      });

      if (res.ok) {
        const updated = await res.json();
        setGroup(prev => prev?.map(u => u.id === updated.id ? updated : u) || [updated]);
        setEditGroup(null);
        setGroupModalOpen(false);
        fetchGroups();
        fetchOrganizations();
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Grup güncellenemedi.'));
      }
    } catch (err) {
      console.error('Grup güncelleme hatası:', err);
    }
  };

  const handleCreateOrganization = async () => {
    try {
      const res = await fetch(`${API_BASE}/user/organizations/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newOrganization)
      });
  
      if (res.ok) {
        const created = await res.json();
        setOrganization(prev => (prev ? [...prev, created] : [created]));
        setOrganizationModalOpen(false);
        setNewOrganization({ name: '', description: '',});
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Organizasyon oluşturulamadı.'));
      }
    } catch (err) {
      console.error('Organizasyon oluşturma hatası:', err);
    }
  };

  const handleUpdateOrganization = async () => {
    if (!editOrganization) return;

    try {
      const res = await fetch(`${API_BASE}/user/organizations/${editOrganization.id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editOrganization)
      });

      if (res.ok) {
        const updated = await res.json();
        setOrganization(prev => prev?.map(u => u.id === updated.id ? updated : u) || [updated]);
        setEditOrganization(null);
        setOrganizationModalOpen(false);
        fetchUsers();
        fetchGroups();
        fetchOrganizations();
      } else {
        const error = await res.json();
        alert('Hata: ' + (error.detail || 'Organizasyon güncellenemedi.'));
      }
    } catch (err) {
      console.error('Organizasyon güncelleme hatası:', err);
    }
  };

  const deleteUser = async (id: number, username: string) => {
    if (!confirm(username+ ' adlı kullanıcı silinsin mi')) return;
  
    const res = await fetch(`${API_BASE}/user/users/${id}/`, {
      method: 'DELETE',
    });
  
    if (res.ok) {
      setUser(prev => prev?.filter(u => u.id !== id) || null);
    } else {
      alert('Silme başarısız');
    }
  };  

  const deleteGroup = async (id: number, name: string) => {
    if (!confirm(name+ ' adlı grup silinsin mi')) return;
  
    const res = await fetch(`${API_BASE}/user/groups/${id}/`, {
      method: 'DELETE',
    });
  
    if (res.ok) {
      setGroup(prev => prev?.filter(u => u.id !== id) || null);
    } else {
      alert('Silme başarısız');
    }
  };  

  const deleteOrganization = async (id: number, name: string) => {
    if (!confirm(name+ ' adlı organizasyon silinsin mi')) return;
  
    const res = await fetch(`${API_BASE}/user/organizations/${id}/`, {
      method: 'DELETE',
    });
  
    if (res.ok) {
      setOrganization(prev => prev?.filter(u => u.id !== id) || null);
    } else {
      alert('Silme başarısız');
    }
  }; 

  return (
    <DefaultLayout>

      {isUserDetailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-lg shadow-xl">
            <div className="flex justify-between items-center px-6 pt-6 pb-2">
              <h1 className="text-lg font-bold tracking-tight">Kullanıcı Detayları</h1>
              <button
                onClick={() => setUserDetailModalOpen(false)}
                className="text-gray-600 hover:text-gray-800 cursor-pointer"
              >
                <CloseIcon />
              </button>             
            </div>
            <Table>
              <TableHeader>
                <TableColumn>Parametre</TableColumn>
                <TableColumn>Değer</TableColumn>
              </TableHeader>
              {userDetail ? (
                <TableBody>
                    <TableRow>
                      <TableCell className="font-bold">ID</TableCell>
                      <TableCell>{userDetail.id}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Kullanıcı Adı</TableCell>
                      <TableCell>{userDetail.username}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Ad</TableCell>
                      <TableCell>{userDetail.first_name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Soyad</TableCell>
                      <TableCell>{userDetail.last_name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">E-Posta</TableCell>
                      <TableCell>{userDetail.email}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Gruplar</TableCell>
                      <TableCell>{userDetail.groups.map(g => g.name).join(', ')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Organizasyon</TableCell>
                      <TableCell>{Array.from(new Set(userDetail.groups.map(g => g.organization_name))).join(', ')}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Aktiflik</TableCell>
                      <TableCell>
                        <Chip 
                          className="cursor-pointer"
                          color={`${userDetail.is_active ? 'success' : 'danger'}`}
                        >
                          {userDetail.is_active ? 'Aktif' : 'Pasif'}
                        </Chip>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-bold">Politikalar</TableCell>
                      <TableCell>    
                        {policies?.filter(p => userDetail.policies.includes(p.id))
                          .map(policy => (
                            <Chip key={policy.id} variant="flat" color="secondary" className="cursor-pointer">
                              {policy.name}
                            </Chip>
                          ))}
                      </TableCell>
                    </TableRow>
                </TableBody>
                ) : (
                <TableBody emptyContent={"Kullanıcı Detayları Yükleniyor..."}>{[]}</TableBody>
                )}
            </Table>
          </div>
        </div>
      )}

      {isUserModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4">{editUser ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}</h2>
            <Input 
              className="mb-2"
              label="Kullanıcı Adı" 
              placeholder="Kullanıcı Adı" 
              type="text"
              value={(editUser ?? newUser).username}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editUser
                  ? setEditUser({ ...editUser, username: value })
                  : setNewUser({ ...newUser, username: value });
              }}
            />
            <Input 
              className="mb-2"
              label="E-Posta" 
              placeholder="E-Posta" 
              type="email"
              value={(editUser ?? newUser).email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editUser
                  ? setEditUser({ ...editUser, email: value })
                  : setNewUser({ ...newUser, email: value });
              }}
            />
            <Input 
              className="mb-2"
              label="Ad" 
              placeholder="Ad" 
              type="text"
              value={(editUser ?? newUser).first_name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editUser
                  ? setEditUser({ ...editUser, first_name: value })
                  : setNewUser({ ...newUser, first_name: value });
              }} 
            />
            <Input 
              className="mb-2"
              label="Soyad" 
              placeholder="Soyad" 
              type="text"
              value={(editUser ?? newUser).last_name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editUser
                  ? setEditUser({ ...editUser, last_name: value })
                  : setNewUser({ ...newUser, last_name: value });
              }}
            />
            <Select
              label="Grupları Seçin"
              className="max-w-xs mb-4"
              selectionMode="multiple"
              selectedKeys={
                new Set(
                  (editUser?.group_ids ?? newUser.group_ids ?? []).map(id => id.toString())
                )
              }
              onSelectionChange={(selectedKeys) => {
                const selected = Array.from(selectedKeys as Set<string>).map(Number);
                console.log('Selected groups:', selected);
                if (editUser) {
                  setEditUser({ ...editUser, group_ids: selected });
                } else {
                  setNewUser({ ...newUser, group_ids: selected });
                }
              }}
            >
              {(groups ?? []).map((grp) => (
                <SelectItem key={grp.id.toString()}>
                  {grp.name}
                </SelectItem>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button 
                color="danger"
                onPress={() => {
                  setUserModalOpen(false);
                  setEditUser(null);
                }}
              >
                İptal
              </Button>
              <Button 
                color="primary"
                onPress={editUser ? handleUpdateUser : handleCreateUser}
              >
                {editUser ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4">{editGroup ? 'Grubu Düzenle' : 'Yeni Grup'}</h2>
            <Input 
              className="mb-2"
              label="Grup Adı" 
              placeholder="Grup Adı" 
              type="text"
              value={(editGroup ?? newGroup).name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editGroup
                  ? setEditGroup({ ...editGroup, name: value })
                  : setNewGroup({ ...newGroup, name: value });
              }}
            />
            <Input 
              className="mb-2"
              label="Açıklama" 
              placeholder="Açıklama" 
              type="text"
              value={(editGroup ?? newGroup).description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editGroup
                  ? setEditGroup({ ...editGroup, description: value })
                  : setNewGroup({ ...newGroup, description: value });
              }}
            />
            <Select
              label="Organizasyon Seçin"
              className="max-w-xs mb-4"
              defaultSelectedKeys={editGroup ? [editGroup.organization.toString()] : []}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                const selectedId = e.target.value;
                if (editGroup) {
                  setEditGroup({ ...editGroup, organization: selectedId as any });
                } else {
                  setNewGroup({ ...newGroup, organization: selectedId });
                }
              }}
            >
              {(organizations ?? []).map((org) => (
                <SelectItem 
                  key={org.id.toString()}>
                  {org.name}
                </SelectItem>
              ))}
            </Select>
            <div className="flex justify-end gap-2">
              <Button 
                color="danger"
                onPress={() => {
                  setGroupModalOpen(false);
                  setEditGroup(null);
                }}
              >
                İptal
              </Button>
              <Button 
                color="primary"
                onPress={editGroup ? handleUpdateGroup : handleCreateGroup}
              >
                {editUser ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {isOrganizationModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold mb-4">{editOrganization ? 'Organizasyonu Düzenle' : 'Yeni Organizasyon'}</h2>
            <Input 
              className="mb-2"
              label="Organizasyon Adı" 
              placeholder="Organizasyon Adı" 
              type="text"
              value={(editOrganization ?? newOrganization).name}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editOrganization
                  ? setEditOrganization({ ...editOrganization, name: value })
                  : setNewOrganization({ ...newOrganization, name: value });
              }}
            />
            <Input 
              className="mb-2"
              label="Açıklama" 
              placeholder="Açıklama" 
              type="text"
              value={(editOrganization ?? newOrganization).description}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                editOrganization
                  ? setEditOrganization({ ...editOrganization, description: value })
                  : setNewOrganization({ ...newOrganization, description: value });
              }}
            />
            <div className="flex justify-end gap-2">
              <Button 
                color="danger"
                onPress={() => {
                  setOrganizationModalOpen(false);
                  setEditOrganization(null);
                }}
              >
                İptal
              </Button>
              <Button 
                color="primary"
                onPress={editOrganization ? handleUpdateOrganization : handleCreateOrganization}
              >
                {editUser ? 'Güncelle' : 'Kaydet'}
              </Button>
            </div>
          </div>
        </div>
      )}

      <section className="flex flex-col gap-4 py-8 md:py-10">
        <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200 overflow-y-auto max-h-150">
          <div className="flex justify-between items-center px-6 pt-6 pb-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserIcon className="text-blue-600"/>
              Kullanıcılar
            </h1>
            <Input
              placeholder="Ara (org / grup / kullanıcı)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72"
            />
            <Button 
              color="primary"
              onPress={() => setUserModalOpen(true)}
            >
              + Kullanıcı Ekle
            </Button>
          </div>
          <p className="text-sm px-6 pb-4">
            Sistemde kayıtlı tüm kullanıcıların listesi.
          </p>
          <Table aria-label="Kullanıcılar tablosu">
            <TableHeader>
                <TableColumn >Kullanıcı</TableColumn>
                <TableColumn >Ad Soyad</TableColumn>
                <TableColumn >Rol</TableColumn>
                <TableColumn >Aktiflik</TableColumn>
                <TableColumn >Düzenle</TableColumn>
            </TableHeader>
          {users && users.length > 0 ? (
            <TableBody>
              {(filteredUsers ?? []).map((user) => (
                <TableRow key={user.id}>
                  <TableCell
                  onClick={() => {
                    setUserDetail(user); 
                    setUserDetailModalOpen(true);
                  }}
                  className="cursor-pointer hover:bg-gray-100"
                  >
                    <div className="flex flex-col">
                      <p className="text-bold text-sm">{user.username}</p>
                      <p className="text-bold text-sm text-default-400">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>{user.first_name} {user.last_name}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <p className="text-bold text-sm">{user.groups.map(g => g.name).join(', ')}</p>
                      <p className="text-bold text-sm text-default-400">{Array.from(new Set(user.groups.map(g => g.organization_name))).join(', ')}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      className="cursor-pointer"
                      onClick={handleChangeUserStatus(user.id, user.is_active)}
                      color={`${user.is_active ? 'success' : 'danger'}`}
                    >
                      {user.is_active ? 'Aktif' : 'Pasif'}
                    </Chip>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => {
                        setEditUser({
                          ...user,
                          group_ids: user.groups.map(g => g.id),
                        });
                        setUserModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <EditIcon/>
                    </button>
                    <button
                      onClick={() => deleteUser(user.id, user.username)}
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

      <section className="flex flex-col gap-4 py-8 md:py-10">
        <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200 overflow-y-auto max-h-150">
          <div className="flex justify-between items-center px-6 pt-6 pb-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <UserGroupIcon className="text-blue-600"/>
              Gruplar
            </h1>
            <Button 
              color="primary"
              onPress={() => setGroupModalOpen(true)}
            >
              + Grup Ekle
            </Button>
          </div>
          <p className="text-sm px-6 pb-4">
            Sistemde kayıtlı tüm grupların listesi.
          </p>
          <Table aria-label="Gruplar tablosu">
            <TableHeader>
                <TableColumn >Grup Adı</TableColumn>
                <TableColumn >Açıklama</TableColumn>
                <TableColumn >Organizasyon</TableColumn>
                <TableColumn >Kullanıcı Sayısı</TableColumn>
                <TableColumn >Düzenle</TableColumn>
            </TableHeader>
          {groups && groups.length > 0 ? (
            <TableBody>
              {(filteredGroups ?? []).map((group) => (
                <TableRow key={group.id}>
                  <TableCell>{group.name}</TableCell>
                  <TableCell>{group.description}</TableCell>
                  <TableCell>{group.organization_name}</TableCell>
                  <TableCell>{group.user_count}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => {
                        setEditGroup(group);
                        setGroupModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <EditIcon/>
                    </button>
                    <button
                      onClick={() => deleteGroup(group.id, group.name)}
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

      <section className="flex flex-col gap-4 py-8 md:py-10">
        <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200 overflow-y-auto max-h-150">
          <div className="flex justify-between items-center px-6 pt-6 pb-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <OrganizationIcon className="text-blue-600"/>
              Organizasyonlar
            </h1>
            <Button 
              color="primary"
              onPress={() => setOrganizationModalOpen(true)}
            >
              + Organizasyon Ekle
            </Button>
          </div>
          <p className="text-sm px-6 pb-4">
            Sistemde kayıtlı tüm organizasyonların listesi.
          </p>
          <Table aria-label="Organizasyon tablosu">
            <TableHeader>
                <TableColumn >Organizasyon Adı</TableColumn>
                <TableColumn >Açıklama</TableColumn>
                <TableColumn >Grup Sayısı</TableColumn>
                <TableColumn >Düzenle</TableColumn>
            </TableHeader>
          {organizations && organizations.length > 0 ? (
            <TableBody>
              {(filteredOrganizations ?? []).map((organization) => (
                <TableRow key={organization.id}>
                  <TableCell>{organization.name}</TableCell>
                  <TableCell>{organization.description}</TableCell>
                  <TableCell>{organization.group_count}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => {
                        setEditOrganization(organization);
                        setOrganizationModalOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-800 cursor-pointer"
                    >
                      <EditIcon/>
                    </button>
                    <button
                      onClick={() => deleteOrganization(organization.id, organization.name)}
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