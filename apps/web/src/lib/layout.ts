import type { RepoGraph, RepoNode } from "@repocity/shared";

export type BuildingArchetype = "core" | "service" | "interface" | "archive" | "config" | "script" | "style" | "data" | "test";

export interface BuildingProfile {
  archetype: BuildingArchetype;
  label: string;
  widthFactor: number;
  depthFactor: number;
  heightFactor: number;
  baseColor: string;
  accentColor: string;
  glowColor: string;
}

export interface CityBuilding {
  node: RepoNode;
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  accentColor: string;
  glowColor: string;
  active: boolean;
  profile: BuildingProfile;
}

export interface CityLine {
  id: string;
  from: [number, number, number];
  to: [number, number, number];
}

const fallbackColors = ["#63C7FF", "#F2C14E", "#6EE7B7", "#F472B6", "#C084FC", "#FDBA74"];

export function buildCityLayout(graph: RepoGraph, timelineIndex: number): { buildings: CityBuilding[]; lines: CityLine[]; districts: string[] } {
  const fileNodes = graph.nodes.filter((node) => node.kind === "file");
  const languages = new Map(graph.languages.map((language, index) => [language.language, language.color || fallbackColors[index % fallbackColors.length]]));
  const districts = [...new Set(fileNodes.map((node) => node.district))].sort();
  const cutoff = graph.timeline[timelineIndex]?.date;
  const districtPositions = new Map<string, [number, number]>();
  const columns = Math.ceil(Math.sqrt(districts.length));
  const spacing = 24;

  districts.forEach((district, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    districtPositions.set(district, [(column - (columns - 1) / 2) * spacing, (row - (Math.ceil(districts.length / columns) - 1) / 2) * spacing]);
  });

  const buildings: CityBuilding[] = [];
  for (const district of districts) {
    const nodes = fileNodes.filter((node) => node.district === district);
    const localColumns = Math.ceil(Math.sqrt(nodes.length));
    const [districtX, districtZ] = districtPositions.get(district)!;
    nodes.forEach((node, index) => {
      const profile = buildingProfileForNode(node);
      const row = Math.floor(index / localColumns);
      const column = index % localColumns;
      const width = clamp((Math.sqrt(Math.max(node.loc, 8)) / 6) * profile.widthFactor, 0.8, 6.2);
      const depth = clamp((Math.sqrt(Math.max(node.sizeBytes, 1200)) / 58) * profile.depthFactor, 0.55, 5.8);
      const height = clamp(Math.log2(node.loc + node.complexity * 16 + node.commitCount * 8 + 12) * profile.heightFactor, 0.9, 20);
      const x = districtX + (column - (localColumns - 1) / 2) * 4.4;
      const z = districtZ + (row - (Math.ceil(nodes.length / localColumns) - 1) / 2) * 4.4;
      const active = !cutoff || !node.lastModified || node.lastModified <= cutoff;
      buildings.push({
        node,
        position: [x, height / 2, z],
        scale: [width, height, depth],
        color: profile.baseColor,
        accentColor: languages.get(node.language ?? "Other") ?? profile.accentColor,
        glowColor: profile.glowColor,
        active,
        profile
      });
    });
  }

  const buildingByNode = new Map(buildings.map((building) => [building.node.id, building]));
  const lines = graph.edges
    .filter((edge) => edge.kind === "imports")
    .slice(0, 180)
    .map((edge) => {
      const source = buildingByNode.get(edge.source);
      const target = buildingByNode.get(edge.target);
      if (!source || !target) return undefined;
      return {
        id: edge.id,
        from: [source.position[0], 0.16, source.position[2]] as [number, number, number],
        to: [target.position[0], 0.16, target.position[2]] as [number, number, number]
      };
    })
    .filter((line): line is CityLine => Boolean(line));

  return { buildings, lines, districts };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildingProfileForNode(node: RepoNode): BuildingProfile {
  const lowerPath = node.path.toLowerCase();
  const name = node.name.toLowerCase();
  const language = node.language ?? "Other";

  if (/(^|\/)(__tests__|test|tests|spec|e2e)(\/|$)|\.(test|spec)\.[tj]sx?$/.test(lowerPath)) {
    return {
      archetype: "test",
      label: "test lab",
      widthFactor: 1.15,
      depthFactor: 1.15,
      heightFactor: 0.78,
      baseColor: "#6EE7B7",
      accentColor: "#F4F0E8",
      glowColor: "#9BE7C4"
    };
  }
  if (language === "Markdown" || lowerPath.startsWith("docs/") || name === "readme.md") {
    return {
      archetype: "archive",
      label: "docs archive",
      widthFactor: 1.9,
      depthFactor: 1.25,
      heightFactor: 0.45,
      baseColor: "#D8D3C4",
      accentColor: "#F2C14E",
      glowColor: "#FFF1B8"
    };
  }
  if (
    language === "JSON" ||
    language === "YAML" ||
    /(^|\/)(package|tsconfig|vite\.config|eslint|prettier|rollup|pnpm|yarn|npm|docker|env|config)/.test(lowerPath)
  ) {
    return {
      archetype: "config",
      label: "config core",
      widthFactor: 1.25,
      depthFactor: 1.25,
      heightFactor: 0.72,
      baseColor: "#B7F542",
      accentColor: "#F2C14E",
      glowColor: "#D9FF7A"
    };
  }
  if (lowerPath.startsWith("scripts/") || lowerPath.includes("/bin/") || name.includes("cli")) {
    return {
      archetype: "script",
      label: "automation stack",
      widthFactor: 0.72,
      depthFactor: 0.72,
      heightFactor: 1.36,
      baseColor: "#F2C14E",
      accentColor: "#FF8A3D",
      glowColor: "#FFD166"
    };
  }
  if (language === "CSS" || name.endsWith(".scss")) {
    return {
      archetype: "style",
      label: "style panel",
      widthFactor: 1.9,
      depthFactor: 0.42,
      heightFactor: 0.95,
      baseColor: "#F472B6",
      accentColor: "#63C7FF",
      glowColor: "#FF9BD5"
    };
  }
  if (["React", "Vue", "Svelte", "HTML"].includes(language) || lowerPath.includes("/client/") || lowerPath.includes("/ui/")) {
    return {
      archetype: "interface",
      label: "interface tower",
      widthFactor: 1.28,
      depthFactor: 0.86,
      heightFactor: 1.08,
      baseColor: "#63C7FF",
      accentColor: "#F472B6",
      glowColor: "#A6F6FF"
    };
  }
  if (lowerPath.includes("/server/") || lowerPath.includes("/api/") || lowerPath.includes("/service") || lowerPath.includes("/ssr/")) {
    return {
      archetype: "service",
      label: "service tower",
      widthFactor: 0.92,
      depthFactor: 0.92,
      heightFactor: 1.26,
      baseColor: "#FF8A3D",
      accentColor: "#A6F6FF",
      glowColor: "#FFC857"
    };
  }
  if (language === "Other") {
    return {
      archetype: "data",
      label: "data block",
      widthFactor: 1.18,
      depthFactor: 1.18,
      heightFactor: 0.65,
      baseColor: "#A78BFA",
      accentColor: "#9BE7C4",
      glowColor: "#C4B5FD"
    };
  }
  return {
    archetype: "core",
    label: "source tower",
    widthFactor: 1,
    depthFactor: 1,
    heightFactor: 1,
    baseColor: "#67E8F9",
    accentColor: "#F2C14E",
    glowColor: "#A6F6FF"
  };
}
