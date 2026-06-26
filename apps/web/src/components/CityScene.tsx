import { useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges, Grid, Html, Line, OrbitControls } from "@react-three/drei";
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
      .filter((entry): entry is { district: string; position: [number, number, number]; scale: [number, number, number] } => Boolean(entry));
  }, [layout]);

  return (
    <Canvas camera={{ position: [34, 30, 42], fov: 46 }} dpr={[1, 1.8]} shadows>
      <color attach="background" args={["#050706"]} />
      <fog attach="fog" args={["#050706", 38, 118]} />
      <ambientLight intensity={0.42} />
      <directionalLight position={[16, 28, 12]} intensity={1.45} castShadow color="#F4F0E8" />
      <pointLight position={[-24, 16, -18]} intensity={0.9} color="#F2C14E" />
      <pointLight position={[22, 18, 18]} intensity={0.75} color="#9BE7C4" />
      <PulseRing />
      <Grid
        position={[0, -0.02, 0]}
        args={[96, 96]}
        cellSize={2}
        cellThickness={0.5}
        sectionSize={12}
        sectionThickness={1}
        cellColor="#2b3028"
        sectionColor="#586450"
        fadeDistance={82}
        fadeStrength={1.2}
      />
      {districtPads.map((pad) => (
        <mesh key={pad.district} position={pad.position} scale={pad.scale} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color="#132018" emissive="#132018" emissiveIntensity={0.25} transparent opacity={0.34} roughness={0.8} />
          <Edges color="#9BE7C4" />
        </mesh>
      ))}
      {layout.lines.map((line) => (
        <Line key={line.id} points={[line.from, line.to]} color="#A6F6FF" opacity={0.46} transparent lineWidth={1.4} />
      ))}
      {layout.buildings.map((building) => (
        <Building
          key={building.node.id}
          building={building}
          selected={building.node.id === selectedNodeId}
          onSelect={() => onSelectNode(building.node.id)}
        />
      ))}
      {labelPositions.map((label) => (
        <Html key={label.district} position={[label.x, 0.15, label.z]} center distanceFactor={18} zIndexRange={[3, 0]} className="district-label">
          {label.district}
        </Html>
      ))}
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={18} maxDistance={92} maxPolarAngle={Math.PI * 0.47} />
    </Canvas>
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
      <BuildingBody building={building} color={color} edgeColor={edgeColor} selected={selected} />
      {selected ? (
        <Html position={[0, building.scale[1] / 2 + 1.1, 0]} center distanceFactor={16} zIndexRange={[4, 0]} className="building-callout">
          {building.node.name}
        </Html>
      ) : null}
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
          <BoxPart position={[0, -h * 0.08, 0]} scale={[w, h * 0.62, d]} material={material()} edgeColor={edgeColor} />
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
          <BoxPart position={[0, -h * 0.08, 0]} scale={[w, h * 0.74, d]} material={material()} edgeColor={edgeColor} />
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

function seededNumber(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return (hash % 1000) / 1000;
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
