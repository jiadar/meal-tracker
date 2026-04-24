import { useState } from "react";
import {
  Button,
  Container,
  Group,
  NumberInput,
  Paper,
  Select,
  Stack,
  Stepper,
  Text,
  TextInput,
  Title,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useNavigate } from "react-router";
import { useMe, useUpdateProfile } from "@/features/auth/api";

// A short curated list; user can type any IANA zone.
const COMMON_TIMEZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Africa/Johannesburg",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function OnboardingPage() {
  const { data: user } = useMe();
  const update = useUpdateProfile();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  const [displayName, setDisplayName] = useState(user?.profile.display_name ?? "");
  const [tz, setTz] = useState(user?.profile.timezone ?? "UTC");
  const [bmr, setBmr] = useState<number>(user?.profile.bmr ?? 1970);

  const finish = async () => {
    try {
      await update.mutateAsync({
        display_name: displayName,
        timezone: tz,
        bmr,
        onboarded_at: new Date().toISOString(),
      });
      navigate("/");
    } catch {
      notifications.show({ color: "red", message: "Could not save. Try again." });
    }
  };

  return (
    <Container size={640} pt={60}>
      <Title order={2} mb="lg">
        Welcome to Meal Tracker
      </Title>
      <Paper withBorder p="xl" radius="md">
        <Stepper active={step} onStepClick={setStep}>
          <Stepper.Step label="About you" description="Name & timezone">
            <Stack mt="lg">
              <TextInput
                label="Display name"
                value={displayName}
                onChange={(e) => setDisplayName(e.currentTarget.value)}
                placeholder="How should we greet you?"
              />
              <Select
                label="Timezone"
                data={COMMON_TIMEZONES}
                value={tz}
                onChange={(v) => v && setTz(v)}
                searchable
                description="Used to interpret 'today' for your day records."
              />
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Metabolism" description="Set your BMR">
            <Stack mt="lg">
              <NumberInput
                label="Basal Metabolic Rate (kcal/day)"
                value={bmr}
                onChange={(v) => setBmr(typeof v === "number" ? v : 1970)}
                min={800}
                max={4000}
                description="Your resting calorie burn. Drives the daily calorie budget calculation. You can change this anytime in Settings."
              />
              <Text size="sm" c="dimmed">
                Not sure? Use the Mifflin–St Jeor formula:
                <br />
                men: 10·kg + 6.25·cm − 5·age + 5
                <br />
                women: 10·kg + 6.25·cm − 5·age − 161
              </Text>
            </Stack>
          </Stepper.Step>
          <Stepper.Step label="Ready" description="Start tracking">
            <Stack mt="lg">
              <Text>
                You're all set. Your empty food database and daily log are waiting. You can adjust
                your targets any time in <Text component="span" fw={600}>Settings</Text>.
              </Text>
              <Text size="sm" c="dimmed">
                To import existing data, run the management command on the server — a UI import is
                on the roadmap.
              </Text>
            </Stack>
          </Stepper.Step>
        </Stepper>

        <Group justify="space-between" mt="xl">
          <Button variant="default" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)}>Next</Button>
          ) : (
            <Button onClick={finish} loading={update.isPending}>
              Start tracking
            </Button>
          )}
        </Group>
      </Paper>
    </Container>
  );
}
