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
import { useRegister } from "./api";
import { ApiError } from "@/lib/apiClient";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Must be at least 8 characters"),
  display_name: z.string().optional(),
});

export function RegisterPage() {
  const register = useRegister();
  const navigate = useNavigate();
  const form = useForm({
    initialValues: { email: "", password: "", display_name: "" },
    validate: zodResolver(schema),
  });

  const onSubmit = form.onSubmit(async (values) => {
    try {
      await register.mutateAsync(values);
      navigate("/verify-pending");
    } catch (err) {
      if (err instanceof ApiError) {
        for (const e of err.errors) {
          if (e.field && form.values[e.field as keyof typeof form.values] !== undefined) {
            form.setFieldError(e.field as keyof typeof form.values, e.message);
          } else {
            notifications.show({ color: "red", message: e.message });
          }
        }
      }
    }
  });

  return (
    <Container size={420} pt={80}>
      <Title order={2} ta="center" mb="lg">
        Create an account
      </Title>
      <Paper withBorder p="xl" radius="md">
        <form onSubmit={onSubmit}>
          <Stack>
            <TextInput
              label="Display name (optional)"
              {...form.getInputProps("display_name")}
            />
            <TextInput
              label="Email"
              required
              {...form.getInputProps("email")}
            />
            <PasswordInput
              label="Password"
              required
              description="At least 8 characters"
              {...form.getInputProps("password")}
            />
            <Button type="submit" loading={register.isPending}>
              Create account
            </Button>
            <Anchor component={Link} to="/login" ta="center" size="sm">
              Already have an account? Sign in
            </Anchor>
          </Stack>
        </form>
      </Paper>
    </Container>
  );
}
