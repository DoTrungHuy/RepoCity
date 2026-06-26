import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Edges, Grid, Html, Line, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import type { Mesh } from "three";
import type { RepoGraph } from "@repocity/shared";
import { buildCityLayout, type CityBuilding } from "../lib/layout";

interface CitySceneProps {
  graph: RepoGraph;
  selectedNodeId?: string;
  timelineIndex: number;
  onSelectNode: (nodeId: string) => void;
}

type DistrictPad = {
  district: string;
  position: [number, number, number];
  scale: [number, number, number];
};

type CityBounds = {
  center: [number, number, number];
  size: [number, number, number];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type ParkPatch = {
  id: string;
  position: [number, number, number];
  size: [number, number];
  tone: string;
};

type TreeMarker = {
  id: string;
  position: [number, number, number];
  scale: number;
  tone: string;
};

type RoadStripData = {
  id: string;
  position: [number, number, number];
  size: [number, number];
};

export function CityScene({ graph, selectedNodeId, timelineIndex, onSelectNode }: CitySceneProps) {
  const layout = useMemo(() => buildCityLayout(graph, timelineIndex), [graph, timelineIndex]);
  const labelPositions = useMemo(() => {
    return layout.districts
      .map((district) => {
        const buildings = layout.buildings.filter((building) => building.node.district === district);
        if (!buildings.length) return undefined;
        const x = buildings.reduce((sum, building) => sum + building.position[0], 0) / buildings.length;
        const z = buildings.reduce((sum, building) => sum + building.position[2], 0) / buildings.length;
        return { district, x, z };
      })
      .filter((entry): entry is { district: string; x: number; z: number } => Boolean(entry));
  }, [layout]);
  const districtPads = useMemo(() => {
    return layout.districts
      .map((district) => {
        const buildings = layout.buildings.filter((building) => building.node.district === district);
        if (!buildings.length) return undefined;
        const minX = Math.min(...buildings.map((building) => building.position[0] - building.scale[0]));
        const maxX = Math.max(...buildings.map((building) => building.position[0] + building.scale[0]));
        const minZ = Math.min(...buildings.map((building) => building.position[2] - building.scale[2]));
        const maxZ = Math.max(...buildings.map((building) => building.position[2] + building.scale[2]));
        return {
          district,
          position: [(minX + maxX) / 2, 0.015, (minZ + maxZ) / 2] as [number, number, number],
          scale: [Math.max(8, maxX - minX + 5), 1, Math.max(8, maxZ - minZ + 5)] as [number, number, number]
        };
      })
      .filter((entry): entry is DistrictPad => Boolean(entry));
  }, [layout]);
  const cityBounds = useMemo(() => computeCityBounds(layout.buildings, districtPads), [layout.buildings, districtPads]);
  const landscape = useMemo(() => buildLandscape(districtPads, cityBounds), [districtPads, cityBounds]);

  return (
    <Canvas camera={{ position: [34, 30, 42], fov: 46 }} dpr={[1, 1.8]} shadows>
      <color attach="background" args={["#050706"]} />
      <fog attach="fog" args={["#050706", 38, 118]} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[16, 28, 12]} intensity={1.45} castShadow color="#F4F0E8" />
      <pointLight position={[-24, 16, -18]} intensity={0.9} color="#F2C14E" />
      <pointLight position={[22, 18, 18]} intensity={0.75} color="#9BE7C4" />
      <CityTerrain bounds={cityBounds} />
      <PulseRing />
      <Grid
        position={[0, 0.018, 0]}
        args={[Math.max(96, cityBounds.size[0] + 18), Math.max(96, cityBounds.size[2] + 18)]}
        cellSize={2}
        cellThickness={0.35}
        sectionSize={12}
        sectionThickness={1}
        cellColor="#263023"
        sectionColor="#586b4f"
        fadeDistance={82}
        fadeStrength={1.2}
      />
      <RoadNetwork roads={landscape.roads} />
      {districtPads.map((pad) => (
        <mesh key={pad.district} position={pad.position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[pad.scale[0], pad.scale[2]]} />
          <meshStandardMaterial color="#172319" emissive="#172319" emissiveIntensity={0.18} transparent opacity={0.78} roughness={0.88} />
          <Edges color="#9BE7C4" />
        </mesh>
      ))}
      <GreenSpaces parks={landscape.parks} />
      {layout.lines.map((line) => (
        <Line key={`${line.id}-road`} points={[line.from, line.to]} color="#0A110C" opacity={0.72} transparent lineWidth={7.2} />
      ))}
      {layout.lines.map((line) => (
        <Line key={line.id} points={[line.from, line.to]} color="#A6F6FF" opacity={0.52} transparent lineWidth={1.7} />
      ))}
      {layout.buildings.map((building) => (
        <Building
          key={building.node.id}
          building={building}
          selected={building.node.id === selectedNodeId}
          onSelect={() => onSelectNode(building.node.id)}
        />
      ))}
      <StreetTrees trees={landscape.trees} />
      <ContactShadows position={[0, 0.03, 0]} opacity={0.52} scale={Math.max(80, cityBounds.size[0] + 30)} blur={2.8} far={22} color="#000000" />
      {labelPositions.map((label) => (
        <Html key={label.district} position={[label.x, 0.15, label.z]} center distanceFactor={18} zIndexRange={[3, 0]} className="district-label">
          {label.district}
        </Html>
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={18} maxDistance={92} maxPolarAngle={Math.PI * 0.47} />
    </Canvas>
  );
}

function CityTerrain({ bounds }: { bounds: CityBounds }) {
  const width = Math.max(72, bounds.size[0] + 18);
  const depth = Math.max(72, bounds.size[2] + 18);
  return (
    <group position={[bounds.center[0], 0, bounds.center[2]]}>
      <mesh position={[0, -0.2, 0]} scale={[width, 0.32, depth]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0A100B" roughness={0.96} metalness={0.04} />
        <Edges color="#263823" threshold={8} />
      </mesh>
      <mesh position={[0, -0.025, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#1C2118"
          roughness={0.94}
          metalness={0.02}
          emissive="#10170F"
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[Math.max(width, depth) * 0.38, Math.max(width, depth) * 0.385, 4]} />
        <meshBasicMaterial color="#D6B35A" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function RoadNetwork({ roads }: { roads: RoadStripData[] }) {
  return (
    <>
      {roads.map((road) => (
        <mesh key={road.id} position={road.position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={road.size} />
          <meshStandardMaterial color="#101611" roughness={0.78} metalness={0.08} emissive="#080D09" emissiveIntensity={0.16} />
          <Edges color="#3A4638" threshold={8} />
        </mesh>
      ))}
    </>
  );
}

function GreenSpaces({ parks }: { parks: ParkPatch[] }) {
  return (
    <>
      {parks.map((park) => (
        <mesh key={park.id} position={park.position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={park.size} />
          <meshStandardMaterial color={park.tone} roughness={0.98} metalness={0} emissive="#1F3A23" emissiveIntensity={0.18} />
          <Edges color="#8ECF7C" threshold={8} />
        </mesh>
      ))}
    </>
  );
}

function StreetTrees({ trees }: { trees: TreeMarker[] }) {
  return (
    <>
      {trees.map((tree) => (
        <Tree key={tree.id} marker={tree} />
      ))}
    </>
  );
}

function Tree({ marker }: { marker: TreeMarker }) {
  return (
    <group position={marker.position} scale={marker.scale}>
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.055, 0.085, 0.44, 6]} />
        <meshStandardMaterial color="#6D5635" roughness={0.86} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.32, 0.72, 7]} />
        <meshStandardMaterial color={marker.tone} roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh position={[0, 0.98, 0]} castShadow receiveShadow>
        <icosahedronGeometry args={[0.22, 0]} />
        <meshStandardMaterial color="#B5E48C" roughness={0.88} metalness={0} emissive="#1F3A23" emissiveIntensity={0.12} />
      </mesh>
    </group>
  );
}

function Building({ building, selected, onSelect }: { building: CityBuilding; selected: boolean; onSelect: () => void }) {
  const color = building.active ? building.color : "#40483f";
  const edgeColor = selected ? "#F2C14E" : building.active ? building.glowColor : "#5D665A";
  return (
    <group
      position={building.position}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      onPointerOver={() => {
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <BuildingPlot building={building} selected={selected} />
      <BuildingBody building={building} color={color} edgeColor={edgeColor} selected={selected} />
      {selected ? (
        <Html position={[0, building.scale[1] / 2 + 1.1, 0]} center distanceFactor={16} zIndexRange={[4, 0]} className="building-callout">
          {building.node.name}
        </Html>
      ) : null}
    </group>
  );
}

function BuildingPlot({ building, selected }: { building: CityBuilding; selected: boolean }) {
  const [w, h, d] = building.scale;
  const plotWidth = Math.max(1.7, w + 0.9);
  const plotDepth = Math.max(1.7, d + 0.9);
  const edgeColor = selected ? "#F2C14E" : building.active ? building.accentColor : "#4A5548";
  return (
    <group position={[0, -h / 2 + 0.04, 0]}>
      <mesh scale={[plotWidth, 0.08, plotDepth]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={building.active ? "#111A13" : "#151815"}
          roughness={0.86}
          metalness={0.12}
          emissive={building.active ? "#0E160F" : "#000000"}
          emissiveIntensity={0.2}
        />
        <Edges color={edgeColor} threshold={8} />
      </mesh>
      <mesh position={[0, 0.052, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[plotWidth * 0.74, plotDepth * 0.74]} />
        <meshBasicMaterial color={building.glowColor} transparent opacity={building.active ? 0.12 : 0.04} />
      </mesh>
    </group>
  );
}

function BuildingBody({
  building,
  color,
  edgeColor,
  selected
}: {
  building: CityBuilding;
  color: string;
  edgeColor: string;
  selected: boolean;
}) {
  const [w, h, d] = building.scale;
  const opacity = building.active ? 0.94 : 0.26;
  const emissiveIntensity = selected ? 0.55 : building.active ? 0.1 : 0;
  const accentOpacity = building.active ? 0.82 : 0.22;
  const material = () => (
    <meshStandardMaterial
      color={color}
      roughness={0.38}
      metalness={0.22}
      emissive={selected ? "#F2C14E" : building.glowColor}
      emissiveIntensity={emissiveIntensity}
      transparent
      opacity={opacity}
    />
  );
  const details = (
    <BuildingDetails building={building} width={w} height={h} depth={d} accentOpacity={accentOpacity} selected={selected} />
  );

  switch (building.profile.archetype) {
    case "archive":
      return (
        <>
          <BoxPart position={[0, -h * 0.19, 0]} scale={[w, h * 0.62, d]} material={material()} edgeColor={edgeColor} />
          <BoxPart position={[0, h * 0.33, 0]} scale={[w * 1.1, h * 0.12, d * 1.08]} material={material()} edgeColor={edgeColor} />
          <BoxPart position={[0, h * 0.49, 0]} scale={[w * 0.92, h * 0.12, d * 0.92]} material={material()} edgeColor={edgeColor} />
          <BoxPart position={[-w * 0.36, h * 0.5 + 0.34, 0]} scale={[0.12, h * 0.26, d * 0.7]} material={material()} edgeColor={building.accentColor} />
          <BoxPart position={[w * 0.36, h * 0.5 + 0.34, 0]} scale={[0.12, h * 0.26, d * 0.7]} material={material()} edgeColor={building.accentColor} />
          <LightBand width={w * 1.18} depth={d * 1.16} y={h * 0.18} color={building.accentColor} opacity={accentOpacity} />
          <LightBand width={w * 1.02} depth={d * 1.06} y={h * 0.4} color={building.glowColor} opacity={accentOpacity * 0.75} />
          {details}
        </>
      );
    case "config":
      return (
        <>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[Math.max(w, d) * 0.42, Math.max(w, d) * 0.52, h, 8]} />
            {material()}
            <Edges color={edgeColor} threshold={18} />
          </mesh>
          <mesh position={[0, h * 0.5 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.max(w, d) * 0.48, 0.045, 8, 36]} />
            <meshBasicMaterial color={building.accentColor} transparent opacity={accentOpacity} />
          </mesh>
          <mesh position={[0, h * 0.08, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 8]}>
            <torusGeometry args={[Math.max(w, d) * 0.66, 0.035, 8, 36]} />
            <meshBasicMaterial color={building.glowColor} transparent opacity={accentOpacity * 0.55} />
          </mesh>
          <mesh position={[0, h * 0.5 + 0.36, 0]} rotation={[0, Math.PI / 4, 0]}>
            <octahedronGeometry args={[Math.max(w, d) * 0.28, 0]} />
            <meshBasicMaterial color={building.glowColor} transparent opacity={accentOpacity} />
          </mesh>
          {details}
        </>
      );
    case "interface":
      return (
        <>
          <BoxPart position={[0, 0, 0]} scale={[w * 0.82, h, d]} material={material()} edgeColor={edgeColor} />
          <BoxPart position={[w * 0.42, h * 0.05, 0]} scale={[w * 0.14, h * 0.86, d * 1.35]} material={material()} edgeColor="#A6F6FF" />
          <BoxPart position={[-w * 0.42, h * 0.05, 0]} scale={[w * 0.14, h * 0.86, d * 1.35]} material={material()} edgeColor="#A6F6FF" />
          <BoxPart position={[0, h * 0.5 + 0.2, 0]} scale={[w * 1.08, 0.16, d * 1.24]} material={material()} edgeColor={edgeColor} />
          <ScreenPanel position={[0, h * 0.06, d * 0.72]} scale={[w * 1.05, h * 0.62, 0.05]} color={building.accentColor} opacity={accentOpacity} />
          <ScreenPanel position={[0, h * 0.18, -d * 0.72]} scale={[w * 0.8, h * 0.5, 0.05]} color={building.glowColor} opacity={accentOpacity * 0.65} />
          <AntennaCluster width={w} height={h} color={building.glowColor} opacity={accentOpacity} />
          {details}
        </>
      );
    case "script":
      return (
        <>
          <BoxPart position={[0, -h * 0.18, 0]} scale={[w * 1.12, h * 0.64, d * 1.12]} material={material()} edgeColor={edgeColor} />
          <mesh position={[0, h * 0.22, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[Math.max(w, d) * 0.22, Math.max(w, d) * 0.28, h * 0.82, 7]} />
            {material()}
            <Edges color={edgeColor} threshold={18} />
          </mesh>
          <mesh position={[0, h * 0.72, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[Math.max(w, d) * 0.24, Math.max(w, d) * 0.32, 24]} />
            <meshBasicMaterial color={building.accentColor} transparent opacity={accentOpacity} />
          </mesh>
          <BoxPart position={[w * 0.48, h * 0.16, 0]} scale={[0.12, h * 0.95, 0.12]} material={material()} edgeColor={building.glowColor} />
          <BoxPart position={[-w * 0.48, h * 0.02, 0]} scale={[0.12, h * 0.72, 0.12]} material={material()} edgeColor={building.glowColor} />
          <AntennaCluster width={w * 0.8} height={h * 1.1} color={building.accentColor} opacity={accentOpacity} />
          {details}
        </>
      );
    case "style":
      return (
        <>
          <BoxPart position={[0, 0, 0]} scale={[w, h, Math.max(0.16, d)]} material={material()} edgeColor="#F472B6" />
          <BoxPart position={[0, h * 0.12, d * 0.72]} scale={[w * 0.78, h * 0.55, 0.08]} material={material()} edgeColor="#F8B4D9" />
          <ScreenPanel position={[0, h * 0.12, d * 0.82]} scale={[w * 0.9, h * 0.72, 0.045]} color={building.accentColor} opacity={accentOpacity} />
          <LightBand width={w * 1.1} depth={Math.max(0.5, d * 1.4)} y={-h * 0.28} color={building.glowColor} opacity={accentOpacity * 0.7} />
          <HoloSign building={building} y={h * 0.52 + 0.2} color={building.accentColor} opacity={accentOpacity} />
        </>
      );
    case "test":
      return (
        <>
          <BoxPart position={[0, -h * 0.13, 0]} scale={[w, h * 0.74, d]} material={material()} edgeColor={edgeColor} />
          <mesh position={[0, h * 0.43, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <torusGeometry args={[Math.max(w, d) * 0.54, 0.055, 8, 40]} />
            <meshBasicMaterial color={building.glowColor} transparent opacity={accentOpacity} />
          </mesh>
          <mesh position={[0, h * 0.58, 0]} castShadow receiveShadow>
            <coneGeometry args={[Math.max(w, d) * 0.32, h * 0.26, 4]} />
            {material()}
            <Edges color={edgeColor} threshold={18} />
          </mesh>
          <LightBand width={w * 1.12} depth={d * 1.12} y={-h * 0.18} color={building.accentColor} opacity={accentOpacity * 0.8} />
          <HoloSign building={building} y={h * 0.56 + 0.3} color={building.glowColor} opacity={accentOpacity} />
          {details}
        </>
      );
    case "data":
      return (
        <>
          <mesh castShadow receiveShadow>
            <cylinderGeometry args={[Math.max(w, d) * 0.48, Math.max(w, d) * 0.48, h, 6]} />
            {material()}
            <Edges color={edgeColor} threshold={18} />
          </mesh>
          <mesh position={[0, h * 0.42, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 6]}>
            <torusGeometry args={[Math.max(w, d) * 0.5, 0.04, 8, 30]} />
            <meshBasicMaterial color={building.accentColor} transparent opacity={accentOpacity} />
          </mesh>
          <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, -Math.PI / 6]}>
            <torusGeometry args={[Math.max(w, d) * 0.38, 0.035, 8, 30]} />
            <meshBasicMaterial color={building.glowColor} transparent opacity={accentOpacity * 0.7} />
          </mesh>
          <DataCores width={w} height={h} depth={d} color={building.accentColor} opacity={accentOpacity} />
        </>
      );
    case "service":
      return (
        <>
          <BoxPart position={[0, 0, 0]} scale={[w, h, d]} material={material()} edgeColor={edgeColor} />
          <mesh position={[0, h * 0.58, 0]} castShadow receiveShadow>
            <coneGeometry args={[Math.max(w, d) * 0.36, h * 0.34, 5]} />
            {material()}
            <Edges color={edgeColor} threshold={18} />
          </mesh>
          <mesh position={[0, h * 0.9, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.04, 0.04, Math.min(2.5, h * 0.35), 8]} />
            <meshBasicMaterial color={building.glowColor} transparent opacity={accentOpacity} />
          </mesh>
          <mesh position={[0, h * 0.75, 0]} rotation={[0, 0, Math.PI / 7]}>
            <torusGeometry args={[Math.max(w, d) * 0.48, 0.035, 8, 34]} />
            <meshBasicMaterial color={building.accentColor} transparent opacity={accentOpacity * 0.72} />
          </mesh>
          <ScreenPanel position={[w * 0.58, h * 0.05, 0]} scale={[0.05, h * 0.58, d * 0.72]} color={building.glowColor} opacity={accentOpacity * 0.65} />
          <AntennaCluster width={w} height={h} color={building.glowColor} opacity={accentOpacity} />
          {details}
        </>
      );
    case "core":
    default:
      return (
        <>
          <BoxPart position={[0, 0, 0]} scale={[w, h, d]} material={material()} edgeColor={edgeColor} />
          <BoxPart position={[0, h * 0.5 + 0.12, 0]} scale={[w * 0.7, 0.24, d * 0.7]} material={material()} edgeColor={edgeColor} />
          <LightBand width={w * 1.08} depth={d * 1.08} y={h * 0.18} color={building.accentColor} opacity={accentOpacity * 0.85} />
          <LightBand width={w * 0.82} depth={d * 0.82} y={-h * 0.18} color={building.glowColor} opacity={accentOpacity * 0.65} />
          <mesh position={[0, h * 0.66, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
            <ringGeometry args={[Math.max(w, d) * 0.32, Math.max(w, d) * 0.39, 4]} />
            <meshBasicMaterial color={building.accentColor} transparent opacity={accentOpacity * 0.7} />
          </mesh>
          <AntennaCluster width={w * 0.7} height={h} color={building.glowColor} opacity={accentOpacity * 0.7} />
          {details}
        </>
      );
  }
}

function BoxPart({
  position,
  scale,
  material,
  edgeColor
}: {
  position: [number, number, number];
  scale: [number, number, number];
  material: JSX.Element;
  edgeColor: string;
}) {
  return (
    <mesh position={position} scale={scale} castShadow receiveShadow>
      <boxGeometry args={[1, 1, 1]} />
      {material}
      <Edges color={edgeColor} threshold={20} />
    </mesh>
  );
}

function LightBand({ width, depth, y, color, opacity }: { width: number; depth: number; y: number; color: string; opacity: number }) {
  return (
    <mesh position={[0, y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.max(width, depth) * 0.44, Math.max(width, depth) * 0.49, 4]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
    </mesh>
  );
}

function ScreenPanel({
  position,
  scale,
  color,
  opacity
}: {
  position: [number, number, number];
  scale: [number, number, number];
  color: string;
  opacity: number;
}) {
  return (
    <mesh position={position} scale={scale}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} />
      <Edges color="#F4F0E8" threshold={10} />
    </mesh>
  );
}

function BuildingDetails({
  building,
  width,
  height,
  depth,
  accentOpacity,
  selected
}: {
  building: CityBuilding;
  width: number;
  height: number;
  depth: number;
  accentOpacity: number;
  selected: boolean;
}) {
  const floors = clampInt(Math.floor(height / 1.35), 2, 11);
  const seed = seededNumber(building.node.id);
  const side = seed > 0.5 ? 1 : -1;
  return (
    <>
      <FacadeStripes width={width} height={height} depth={depth} floors={floors} color={building.accentColor} opacity={accentOpacity * 0.68} />
      <FacadeStripes
        width={depth}
        height={height}
        depth={width}
        floors={Math.max(2, Math.floor(floors * 0.65))}
        color={building.glowColor}
        opacity={accentOpacity * 0.42}
        side={side}
      />
      {(building.node.commitCount > 45 || selected) && (
        <HoloSign building={building} y={height * 0.42} color={building.accentColor} opacity={accentOpacity} />
      )}
      {building.node.imports.length > 1 && (
        <mesh position={[side * (width * 0.58), height * 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[Math.max(0.24, depth * 0.22), 0.025, 6, 24]} />
          <meshBasicMaterial color={building.glowColor} transparent opacity={accentOpacity * 0.55} />
        </mesh>
      )}
    </>
  );
}

function FacadeStripes({
  width,
  height,
  depth,
  floors,
  color,
  opacity,
  side = 0
}: {
  width: number;
  height: number;
  depth: number;
  floors: number;
  color: string;
  opacity: number;
  side?: number;
}) {
  const stripes = Array.from({ length: floors }, (_, index) => {
    const y = -height / 2 + ((index + 1) / (floors + 1)) * height;
    return side === 0 ? (
      <ScreenPanel key={index} position={[0, y, depth * 0.505]} scale={[width * 0.72, 0.035, 0.028]} color={color} opacity={opacity} />
    ) : (
      <ScreenPanel key={index} position={[side * depth * 0.505, y, 0]} scale={[0.028, 0.035, width * 0.72]} color={color} opacity={opacity} />
    );
  });
  return <>{stripes}</>;
}

function HoloSign({ building, y, color, opacity }: { building: CityBuilding; y: number; color: string; opacity: number }) {
  const text = building.profile.archetype.toUpperCase();
  return (
    <group position={[0, y, building.scale[2] * 0.68]}>
      <ScreenPanel position={[0, 0, 0]} scale={[Math.max(1.1, building.scale[0] * 0.72), 0.38, 0.035]} color={color} opacity={opacity * 0.58} />
      <Html center distanceFactor={20} zIndexRange={[2, 0]} className="holo-label">
        {text}
      </Html>
    </group>
  );
}

function AntennaCluster({ width, height, color, opacity }: { width: number; height: number; color: string; opacity: number }) {
  return (
    <group position={[0, height * 0.58, 0]}>
      <ScreenPanel position={[0, height * 0.11, 0]} scale={[0.05, height * 0.42, 0.05]} color={color} opacity={opacity} />
      <ScreenPanel position={[width * 0.18, height * 0.03, 0]} scale={[0.04, height * 0.28, 0.04]} color={color} opacity={opacity * 0.7} />
      <ScreenPanel position={[-width * 0.2, height * 0.0, 0]} scale={[0.035, height * 0.22, 0.035]} color={color} opacity={opacity * 0.55} />
      <mesh position={[0, height * 0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.max(0.18, width * 0.18), Math.max(0.22, width * 0.23), 28]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.64} />
      </mesh>
    </group>
  );
}

function DataCores({ width, height, depth, color, opacity }: { width: number; height: number; depth: number; color: string; opacity: number }) {
  const radius = Math.max(width, depth) * 0.2;
  return (
    <group>
      {[0, 1, 2].map((index) => (
        <mesh key={index} position={[(index - 1) * radius * 1.3, -height * 0.12 + index * height * 0.12, depth * 0.54]}>
          <sphereGeometry args={[radius * (0.45 + index * 0.08), 12, 8]} />
          <meshBasicMaterial color={color} transparent opacity={opacity * (0.44 + index * 0.12)} />
        </mesh>
      ))}
    </group>
  );
}

function computeCityBounds(buildings: CityBuilding[], pads: DistrictPad[]): CityBounds {
  const xs: number[] = [];
  const zs: number[] = [];

  for (const pad of pads) {
    xs.push(pad.position[0] - pad.scale[0] / 2, pad.position[0] + pad.scale[0] / 2);
    zs.push(pad.position[2] - pad.scale[2] / 2, pad.position[2] + pad.scale[2] / 2);
  }
  for (const building of buildings) {
    xs.push(building.position[0] - building.scale[0] / 2, building.position[0] + building.scale[0] / 2);
    zs.push(building.position[2] - building.scale[2] / 2, building.position[2] + building.scale[2] / 2);
  }

  if (!xs.length || !zs.length) {
    return {
      center: [0, 0, 0],
      size: [72, 1, 72],
      minX: -36,
      maxX: 36,
      minZ: -36,
      maxZ: 36
    };
  }

  const minX = Math.min(...xs) - 8;
  const maxX = Math.max(...xs) + 8;
  const minZ = Math.min(...zs) - 8;
  const maxZ = Math.max(...zs) + 8;
  return {
    center: [(minX + maxX) / 2, 0, (minZ + maxZ) / 2],
    size: [maxX - minX, 1, maxZ - minZ],
    minX,
    maxX,
    minZ,
    maxZ
  };
}

function buildLandscape(
  pads: DistrictPad[],
  bounds: CityBounds
): { roads: RoadStripData[]; parks: ParkPatch[]; trees: TreeMarker[] } {
  const roads: RoadStripData[] = [];
  const parks: ParkPatch[] = [];
  const trees: TreeMarker[] = [];
  const treeTones = ["#5FAF5E", "#76B852", "#8ECF7C", "#4F8F57"];

  pads.forEach((pad, padIndex) => {
    const [x, , z] = pad.position;
    const [width, , depth] = pad.scale;
    const roadWidth = 1.18;
    const key = pad.district.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || `district-${padIndex}`;

    roads.push(
      {
        id: `${key}-north-road`,
        position: [x, 0.045, z - depth / 2 - roadWidth * 0.2],
        size: [width + 2.4, roadWidth]
      },
      {
        id: `${key}-south-road`,
        position: [x, 0.045, z + depth / 2 + roadWidth * 0.2],
        size: [width + 2.4, roadWidth]
      },
      {
        id: `${key}-west-road`,
        position: [x - width / 2 - roadWidth * 0.2, 0.046, z],
        size: [roadWidth, depth + 2.4]
      },
      {
        id: `${key}-east-road`,
        position: [x + width / 2 + roadWidth * 0.2, 0.046, z],
        size: [roadWidth, depth + 2.4]
      }
    );

    if (width > 6.5 && depth > 6.5) {
      const parkWidth = clampNumber(width * 0.24, 2.2, 5.8);
      const parkDepth = clampNumber(depth * 0.2, 1.8, 4.6);
      parks.push(
        {
          id: `${key}-park-a`,
          position: [x - width / 2 + parkWidth / 2 + 0.6, 0.064, z + depth / 2 - parkDepth / 2 - 0.6],
          size: [parkWidth, parkDepth],
          tone: padIndex % 2 ? "#274A28" : "#234226"
        },
        {
          id: `${key}-park-b`,
          position: [x + width / 2 - parkWidth / 2 - 0.6, 0.064, z - depth / 2 + parkDepth / 2 + 0.6],
          size: [parkWidth * 0.82, parkDepth * 0.86],
          tone: padIndex % 2 ? "#213B24" : "#2B512B"
        }
      );
    }

    const treePoints: [number, number][] = [
      [x - width / 2 + 0.8, z - depth / 2 + 0.8],
      [x + width / 2 - 0.8, z - depth / 2 + 0.8],
      [x - width / 2 + 0.8, z + depth / 2 - 0.8],
      [x + width / 2 - 0.8, z + depth / 2 - 0.8],
      [x - width * 0.24, z - depth / 2 + 0.82],
      [x + width * 0.24, z + depth / 2 - 0.82],
      [x - width / 2 + 0.82, z + depth * 0.22],
      [x + width / 2 - 0.82, z - depth * 0.22]
    ];

    treePoints.forEach(([treeX, treeZ], treeIndex) => {
      if (treeX < bounds.minX || treeX > bounds.maxX || treeZ < bounds.minZ || treeZ > bounds.maxZ) return;
      const seed = seededNumber(`${pad.district}-${treeIndex}`);
      trees.push({
        id: `${key}-tree-${treeIndex}`,
        position: [treeX, 0.055, treeZ],
        scale: clampNumber(0.78 + seed * 0.46, 0.72, 1.18),
        tone: treeTones[(padIndex + treeIndex) % treeTones.length]
      });
    });
  });

  return { roads, parks, trees };
}

function seededNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampInt(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function PulseRing() {
  const ringRef = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const ring = ringRef.current;
    if (!ring) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 0.9) * 0.08;
    ring.scale.setScalar(pulse);
    ring.rotation.z = clock.elapsedTime * 0.08;
  });

  return (
    <mesh ref={ringRef} position={[0, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[28, 28.18, 96]} />
      <meshBasicMaterial color="#F2C14E" transparent opacity={0.34} />
    </mesh>
  );
}
