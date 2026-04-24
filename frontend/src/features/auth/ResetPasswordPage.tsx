import { Anchor, Button, Container, Paper, Stack, Text, TextInput, Title } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { notifications } from "@mantine/notifications";
import { Link } from "react-router";
import { z } from "zod";
import { useRequestPasswordReset } from "./api";

const schema = z.object({ email: z.string().email() });

export function ResetPasswordPage() {
  const request = useRequestPasswordReset();
  const form = useForm({
    initialValues: { email: "" },
    validate: zodResolver(schema),
  });

  const onSubmit = form.onSubmit(async (values) => {
    await request.mutateAsync(values);
    notifications.show({
      color: "green",
      message: "If the account exists, a reset email has been sent.",
    });
    form.reset();
  });

  return (
    <Container size={420} pt={80}>
      <Title order={2} ta="center" mb="lg">
        Reset password
      </Title>
      <Paper withBorder p="xl" radius="md">
        <form onSubmit={onSubmit}>
          <Stack>
            <Text c="dimmed" size="sm">
              We'll send a reset link to your email if it matches an account.
            </Text>
            <TextInput label="Email" required {...form.getInputProps("email")} />
            <Button type="submit" loading={request.isPending}>
              Send reset email
            </Button>
            <Anchor component={Link} to="/login" ta="center" size="sm">
              Back to sign in
            </Anchor>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
