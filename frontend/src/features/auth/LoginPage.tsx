import {
  Anchor,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { notifications } from "@mantine/notifications";
import { Link, useNavigate } from "react-router";
import { z } from "zod";
import { useLogin } from "./api";
import { ApiError } from "@/lib/apiClient";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1, "Password is required"),
});

export function LoginPage() {
  const login = useLogin();
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { email: "", password: "" },
    validate: zodResolver(schema),
  });

  const onSubmit = form.onSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
      navigate("/");
    } catch (err) {
      if (err instanceof ApiError) {
        notifications.show({ color: "red", message: err.errors[0]?.message ?? "Login failed" });
      }
    }
  });

  return (
    <Container size={420} pt={80}>
      <Title order={2} ta="center" mb="lg">
        Sign in
      </Title>
      <Paper withBorder p="xl" radius="md">
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Email"
              placeholder="you@example.com"
              required
              autoFocus
              {...form.getInputProps("email")}
            />
            <PasswordInput
              label="Password"
              required
              {...form.getInputProps("password")}
            />
            <Button type="submit" loading={login.isPending}>
              Sign in
            </Button>
            <Anchor component={Link} to="/register" ta="center" size="sm">
              Create an account
            </Anchor>
            <Anchor component={Link} to="/reset-password" ta="center" size="sm" c="dimmed">
              Forgot password?
            </Anchor>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
