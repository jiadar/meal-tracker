import { AppShell as MAppShell, Burger, Button, Group, NavLink, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import {
  IconCalendar,
  IconCalendarStats,
  IconChartBar,
  IconDownload,
  IconMessageChatbot,
  IconLogout,
  IconMoon,
  IconSalad,
  IconScale,
  IconSettings,
  IconTarget,
} from "@tabler/icons-react";
import { NavLink as RouterNavLink, Outlet, useLocation } from "react-router";
import { useLogout, useMe } from "@/features/auth/api";
import { useExport } from "@/features/export/useExport";

const NAV = [
  { to: "/", label: "Day Detail", icon: IconCalendar },
  { to: "/chat", label: "Chat", icon: IconMessageChatbot },
  { to: "/month", label: "Month", icon: IconCalendarStats },
  { to: "/foods", label: "Foods", icon: IconSalad },
  { to: "/recipes", label: "Recipes", icon: IconChartBar },
  { to: "/weight", label: "Weight", icon: IconScale },
  { to: "/sleep", label: "Sleep", icon: IconMoon },
  { to: "/goals", label: "Goals", icon: IconTarget },
  { to: "/settings", label: "Settings", icon: IconSettings },
];

export function AppShell() {
  const [opened, { toggle, close }] = useDisclosure(false);
  const { data: user } = useMe();
  const logout = useLogout();
  const location = useLocation();
  const { exporting, fire: exportJson } = useExport();

  const onExport = async () => {
    try {
      await exportJson();
    } catch {
      notifications.show({ color: "red", message: "Could not export data." });
    }
  };

  return (
    <MAppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: "sm", collapsed: { mobile: !opened } }}
      padding="md"
    >
      <MAppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" />
            <Text fw={700} ff="monospace">
              MEAL TRACKER
            </Text>
          </Group>
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconDownload size={14} />}
              onClick={onExport}
              loading={exporting}
            >
              Export JSON
            </Button>
            <Text size="sm" c="dimmed" visibleFrom="sm">
              {user?.profile?.display_name || user?.email}
            </Text>
          </Group>
        </Group>
      </MAppShell.Header>
      <MAppShell.Navbar p="sm">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            component={RouterNavLink}
            to={to}
            label={label}
            leftSection={<Icon size={18} />}
            active={location.pathname === to}
            onClick={close}
          />
        ))}
        <NavLink
          mt="auto"
          label="Sign out"
          leftSection={<IconLogout size={18} />}
          onClick={() => logout.mutate()}
          c="dimmed"
        />
      </MAppShell.Navbar>
      <MAppShell.Main>
        <Outlet />
      </MAppShell.Main>
    </MAppShell>
  );
}
