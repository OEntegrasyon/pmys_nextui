import DefaultLayout from "@/layouts/default";
import { useEffect, useState } from 'react';
import { Chip} from "@heroui/chip";
import { Table, TableHeader, TableBody, TableColumn, TableRow, TableCell} from "@heroui/table";
import { PCIcon } from "@/components/icons";


type Client = {
  id: number;
  uuid: string;
  ip_address: string;
  mac_address: string; 
  hostname: string;
  description: string;
  is_active: boolean;
};

export default function DocsPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [clients, setClient] = useState<Client[] | null>(null);

  const fetchClients = () => {
    fetch(`${API_BASE}/client/clients/`)
      .then(res => res.json())
      .then(data => setClient(data.results))
      .catch(err => console.error('Error fetching clients'));
  };

  useEffect(() => {
    fetchClients();

    const intervalId = setInterval(() => {
      fetchClients();
    }, 15000);

    return () => clearInterval(intervalId);
  }, []);

  return (
    <DefaultLayout>
      <section className="flex flex-col gap-4 py-8 md:py-10">
        <div className="inline-block w-full overflow-x-auto shadow rounded-2xl border border-gray-200 overflow-y-auto max-h-150">
          <div className="flex justify-between items-center px-6 pt-6 pb-2">
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <PCIcon className="text-blue-600"/>
              İstemciler
            </h1>
          </div>
          <p className="text-sm px-6 pb-4">
            Sistemde kayıtlı tüm istemcilerin listesi.
          </p>
          <Table aria-label="İstemciler tablosu">
            <TableHeader>
                <TableColumn >UUID</TableColumn>
                <TableColumn >IP ve MAC</TableColumn>
                <TableColumn >PC Adı</TableColumn>
                <TableColumn >Açıklama</TableColumn>
                <TableColumn >Aktiflik</TableColumn>
            </TableHeader>
          {clients && clients.length > 0 ? (
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    {client.uuid}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <p className="text-bold text-sm">{client.ip_address}</p>
                      <p className="text-bold text-sm text-default-400">{client.mac_address}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {client.hostname}
                  </TableCell>
                  <TableCell>
                    {client.description}
                  </TableCell>
                  <TableCell>
                    <Chip className="cursor-pointer"
                      color={`${client.is_active ? 'success' : 'danger'}`}
                    >
                      {client.is_active ? 'Aktif' : 'Pasif'}
                    </Chip>                  
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
