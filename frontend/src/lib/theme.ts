import { createTheme, type MantineColorsTuple } from "@mantine/core";

// Tokens from features.md §8.1 — keep the HTML version's distinctive palette.
const green: MantineColorsTuple = [
  "#e6fbf3",
  "#c9f4e0",
  "#9be8c4",
  "#68dba5",
  "#3fd18d",
  "#34d399",
  "#23b37f",
  "#188c63",
  "#0f6447",
  "#054028",
];

const purple: MantineColorsTuple = [
  "#ecedff",
  "#d0d3ff",
  "#a3a8fb",
  "#8b8ff3",
  "#818cf8",
  "#6368e5",
  "#4b4ec7",
  "#353693",
  "#23245f",
  "#12122f",
];

export const theme = createTheme({
  primaryColor: "green",
  colors: {
    green,
    grape: purple,
  },
  fontFamily: "DM Sans, 'Helvetica Neue', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'SF Mono', 'Fira Code', monospace",
  headings: {
    fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
  },
  defaultRadius: "md",
});
