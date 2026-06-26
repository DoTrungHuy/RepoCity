export const ignoredDirectoryNames = new Set([
  ".git",
  ".cache",
  ".next",
  ".nuxt",
  ".output",
  ".repocity",
  ".turbo",
  ".vite",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "target",
  "vendor"
]);

export const languageColors: Record<string, string> = {
  TypeScript: "#63C7FF",
  JavaScript: "#F2C14E",
  React: "#7DD3FC",
  CSS: "#F472B6",
  HTML: "#F97316",
  JSON: "#A3E635",
  Markdown: "#E5E7EB",
  Python: "#6EE7B7",
  Rust: "#D97706",
  Go: "#67E8F9",
  Java: "#FCA5A5",
  Kotlin: "#C084FC",
  Swift: "#FB7185",
  "C/C++": "#94A3B8",
  "C#": "#A78BFA",
  Vue: "#86EFAC",
  Svelte: "#FDBA74",
  YAML: "#FDE68A",
  Other: "#CBD5E1"
};

const extensionLanguages: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "React",
  ".js": "JavaScript",
  ".jsx": "React",
  ".mjs": "JavaScript",
  ".cjs": "JavaScript",
  ".css": "CSS",
  ".scss": "CSS",
  ".html": "HTML",
  ".json": "JSON",
  ".md": "Markdown",
  ".mdx": "Markdown",
  ".py": "Python",
  ".rs": "Rust",
  ".go": "Go",
  ".java": "Java",
  ".kt": "Kotlin",
  ".swift": "Swift",
  ".c": "C/C++",
  ".cc": "C/C++",
  ".cpp": "C/C++",
  ".h": "C/C++",
  ".hpp": "C/C++",
  ".cs": "C#",
  ".vue": "Vue",
  ".svelte": "Svelte",
  ".yml": "YAML",
  ".yaml": "YAML",
  ".toml": "YAML"
};

export function languageForPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  const extension = Object.keys(extensionLanguages).find((ext) => lower.endsWith(ext));
  return extension ? extensionLanguages[extension] : "Other";
}

export function colorForLanguage(language: string): string {
  return languageColors[language] ?? languageColors.Other;
}

export function isTextLikePath(filePath: string): boolean {
  return languageForPath(filePath) !== "Other";
}

