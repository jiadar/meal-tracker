import { Button, Container, Group, Paper, Stack, Text, Title } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useLogout, useMe, useResendVerification } from "./api";

export function VerifyPendingPage() {
  const { data: user } = useMe();
  const resend = useResendVerification();
  const logout = useLogout();

  const onResend = async () => {
    try {
      await resend.mutateAsync();
      notifications.show({ color: "green", message: "Verification email sent." });
    } catch {
      notifications.show({ color: "red", message: "Could not send email. Try again later." });
    }
  };

  return (
    <Container size={480} pt={80}>
      <Title order={2} ta="center" mb="lg">
        Verify your email
      </Title>
      <Paper withBorder p="xl" radius="md">
        <Stack>
          <Text>
            We sent a verification link to{" "}
            <Text component="span" fw={600}>
              {user?.email ?? "your email"}
            </Text>
            . Click the link to finish setting up your account.
          </Text>
          <Text c="dimmed" size="sm">
            Check your spam folder if you don't see it. In development, links are printed to the
            server logs.
          </Text>
          <Group justify="space-between" mt="md">
            <Button variant="default" onClick={() => logout.mutate()}>
              Sign out
            </Button>
            <Button onClick={onResend} loading={resend.isPending}>
              Resend email
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
