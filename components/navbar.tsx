import {
  Navbar as HeroUINavbar,
  NavbarContent,
  NavbarBrand,
  NavbarItem,
} from "@heroui/navbar";
import NextLink from "next/link";
import { ThemeSwitch } from "@/components/theme-switch";
import { HomeIcon, PolicyIcon, UserIcon, PCIcon, BookIcon } from "./icons";

export const Navbar = () => {
  return (
    <HeroUINavbar maxWidth="xl" position="sticky">
      <NavbarContent className="basis-1/5 sm:basis-full" justify="start">
        <NavbarBrand className="gap-3 max-w-fit">
          <NextLink className="flex justify-start items-center gap-1" href="/">
            <p className="font-bold text-inherit">PMYS</p>
          </NextLink>
        </NavbarBrand>
        <div className="hidden lg:flex gap-4 justify-start ml-2">
            <NavbarItem key="/">
              <NextLink
                className="flex gap-1 hover:text-indigo-500"
                color="foreground"
                href="/"
              >
                <HomeIcon/> Ana Sayfa
              </NextLink>
            </NavbarItem>
            <NavbarItem key="/policies">
              <NextLink
                className="flex gap-1 hover:text-sky-500"
                color="foreground"
                href="/policies"
              >
                <PolicyIcon/> Politikalar
              </NextLink>
            </NavbarItem>
            <NavbarItem key="/users">
              <NextLink
                className="flex gap-1 hover:text-teal-500"
                color="foreground"
                href="/users"
              >
                <UserIcon/> Kullanıcılar
              </NextLink>
            </NavbarItem>
            <NavbarItem key="/clients">
              <NextLink
                className="flex gap-1 hover:text-emerald-500"
                color="foreground"
                href="/clients"
              >
                <PCIcon/> İstemciler
              </NextLink>
            </NavbarItem>
            <NavbarItem key="/logs">
              <NextLink
                className="flex gap-1 hover:text-lime-500"
                color="foreground"
                href="/logs"
              >
                <BookIcon/> Loglar
              </NextLink>
            </NavbarItem>
        </div>
      </NavbarContent>

      <NavbarContent
        className="hidden sm:flex basis-1/5 sm:basis-full"
        justify="end"
      >
        <NavbarItem className="hidden sm:flex gap-2">
          <ThemeSwitch />
        </NavbarItem>
      </NavbarContent>
    </HeroUINavbar>
  );
};
