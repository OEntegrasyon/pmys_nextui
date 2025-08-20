import DefaultLayout from "@/layouts/default";
import { Card, CardBody, CardFooter} from "@heroui/card";
import { Chip} from "@heroui/chip";
import { CircularProgress } from "@heroui/progress";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

type User = {
  id: number;
  is_active: boolean;
};

type Client = {
  id: number;
  is_active: boolean;
};

export default function IndexPage() {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
  const [users, setUser] = useState<User[] | null>(null);
  const [clients, setClient] = useState<Client[] | null>(null);

  const fetchUsers = () => {
    fetch(`${API_BASE}/user/users/`)
      .then(res => res.json())
      .then(setUser)
      .catch(err => console.error('Error fetching users:'));
  };

  const fetchClients = () => {
    fetch(`${API_BASE}/client/clients/`)
      .then(res => res.json())
      .then(setClient)
      .catch(err => console.error('Error fetching clients:'));
  };

  useEffect(() => {
    fetchUsers();
    fetchClients();
  }, []);


  const total_clients = clients?.length ?? 0;
  const active_clients = clients?.filter(client => client.is_active).length ?? 0;
  const percentage_clients = total_clients > 0 ? (active_clients / total_clients) * 100 : 0;

  const total_users = users?.length ?? 0;
  const active_users = users?.filter(user => user.is_active).length ?? 0;
  const percentage_users = total_users > 0 ? (active_users / total_users) * 100 : 0;
  const router = useRouter();

  return (
    <DefaultLayout>
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-8 md:py-10">
        <Card
          isPressable
          onClick={() => router.push("/clients")}
          className="group rounded-xl border-none bg-gradient-to-br from-cyan-500 to-sky-500 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
        >
          <CardBody className="flex flex-col items-center justify-center pb-0">
            <CircularProgress
              classNames={{
                svg: "w-44 h-44 drop-shadow-md",
                indicator: "stroke-white",
                track: "stroke-white/10",
                value: "text-lg font-semibold text-white",
              }}
              value={percentage_clients}
              showValueLabel={true}
              strokeWidth={4}
              valueLabel={`${active_clients} / ${total_clients}`}
            />
          </CardBody>
          <CardFooter className="flex justify-center pt-3">
            <Chip
              classNames={{
                base: "border border-white/30 rounded-lg px-3 py-1",
                content: "text-white/90 text-lg font-semibold",
              }}
              variant="bordered"
            >
              Aktif İstemciler
            </Chip>
          </CardFooter>
        </Card>
        
        <Card
          isPressable
          onClick={() => router.push("/users")}
          className="group rounded-xl border-none bg-gradient-to-br from-emerald-500 to-teal-500 shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all cursor-pointer"
        >
          <CardBody className="flex flex-col items-center justify-center pb-0">
            <CircularProgress
              classNames={{
                svg: "w-44 h-44 drop-shadow-md",
                indicator: "stroke-white",
                track: "stroke-white/10",
                value: "text-lg font-semibold text-white",
              }}
              value={percentage_users}
              showValueLabel={true}
              strokeWidth={4}
              valueLabel={`${active_users} / ${total_users}`}
            />
          </CardBody>
          <CardFooter className="flex justify-center pt-3">
            <Chip
              classNames={{
                base: "border border-white/30 rounded-lg px-3 py-1",
                content: "text-white/90 text-lg font-semibold",
              }}
              variant="bordered"
            >
              Aktif Kullanıcılar
            </Chip>
          </CardFooter>
        </Card>
      </section>
    </DefaultLayout>
  );
}
