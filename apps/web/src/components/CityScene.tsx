import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Edges, Grid, Html, Line, OrbitControls } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, CanvasTexture, Color, NearestFilter, RepeatWrapping, SRGBColorSpace, type Mesh } from "three";
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
  rotation: number;
};

type TreeMarker = {
  id: string;
  position: [number, number, number];
  scale: number;
  tone: string;
  shape: "grove" | "median";
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
    <Canvas camera={{ position: [34, 30, 42], fov: 46 }} dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }} shadows>
      <fog attach="fog" args={["#0b1728", 42, 132]} />
      <ambientLight intensity={0.42} color="#B8DDF5" />
      <directionalLight position={[16, 30, 12]} intensity={0.92} castShadow color="#DDEFFF" />
      <pointLight position={[-24, 16, -18]} intensity={0.62} color="#F0C76D" />
      <pointLight position={[22, 18, 18]} intensity={0.86} color="#79D5FF" />
      <CityTerrain bounds={cityBounds} />
      <PulseRing />
      <Grid
        position={[0, 0.018, 0]}
        args={[Math.max(96, cityBounds.size[0] + 18), Math.max(96, cityBounds.size[2] + 18)]}
        cellSize={2}
        cellThickness={0.32}
        sectionSize={12}
        sectionThickness={1}
        cellColor="#34566a"
        sectionColor="#7bbfd9"
        fadeDistance={82}
        fadeStrength={1.05}
      />
      <RoadNetwork roads={landscape.roads} />
      {districtPads.map((pad) => (
        <mesh key={pad.district} position={pad.position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[pad.scale[0], pad.scale[2]]} />
          <meshStandardMaterial color="#294052" emissive="#123247" emissiveIntensity={0.16} transparent opacity={0.82} roughness={0.8} metalness={0.14} />
          <Edges color="#8ad8f6" />
        </mesh>
      ))}
      <GreenSpaces parks={landscape.parks} />
      {layout.lines.map((line) => (
        <Line key={`${line.id}-road`} points={[line.from, line.to]} color="#21384a" opacity={0.76} transparent lineWidth={7.2} />
      ))}
      {layout.lines.map((line) => (
        <Line key={line.id} points={[line.from, line.to]} color="#6fb9d3" opacity={0.42} transparent lineWidth={1.7} />
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
      <ContactShadows position={[0, 0.035, 0]} opacity={0.58} scale={Math.max(84, cityBounds.size[0] + 34)} blur={2.8} far={24} color="#03101a" />
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
      <mesh position={[0, -0.5, 0]} scale={[width, 0.96, depth]} receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#1e3342" roughness={0.78} metalness={0.18} emissive="#0e2a3a" emissiveIntensity={0.1} />
        <Edges color="#6faec7" threshold={8} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#314b5e"
          roughness={0.7}
          metalness={0.12}
          emissive="#14354a"
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]}>
        <ringGeometry args={[Math.max(width, depth) * 0.38, Math.max(width, depth) * 0.385, 4]} />
        <meshBasicMaterial color="#f0c76d" transparent opacity={0.26} />
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
          <meshStandardMaterial color="#233949" roughness={0.7} metalness={0.18} emissive="#143247" emissiveIntensity={0.16} />
          <Edges color="#78bdd7" threshold={8} />
        </mesh>
      ))}
    </>
  );
}

function GreenSpaces({ parks }: { parks: ParkPatch[] }) {
  return (
    <>
      {parks.map((park) => (
        <group key={park.id} position={park.position} rotation={[0, park.rotation, 0]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={park.size} />
            <meshStandardMaterial color={park.tone} roughness={0.9} metalness={0.1} emissive="#071a22" emissiveIntensity={0.04} />
            <Edges color="#345d66" threshold={8} />
          </mesh>
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry args={[Math.min(park.size[0], park.size[1]) * 0.24, Math.min(park.size[0], park.size[1]) * 0.3, 28]} />
            <meshBasicMaterial color="#4f8790" transparent opacity={0.08} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </>
  );
}

function StreetTrees({ trees }: { trees: TreeMarker[] }) {
  return (
    <>
      {trees.map((tree) => (
        <CanopyCluster key={tree.id} marker={tree} />
      ))}
    </>
  );
}

function CanopyCluster({ marker }: { marker: TreeMarker }) {
  const isMedian = marker.shape === "median";
  return (
    <group position={marker.position} scale={marker.scale}>
      <mesh position={[0, 0.065, 0]} scale={isMedian ? [0.86, 0.1, 0.34] : [0.64, 0.1, 0.52]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#233743" roughness={0.62} metalness={0.22} emissive="#0a1d27" emissiveIntensity={0.12} />
        <Edges color="#547f88" threshold={10} />
      </mesh>
      <mesh position={isMedian ? [-0.18, 0.22, 0] : [-0.14, 0.24, -0.08]} scale={isMedian ? [0.32, 0.2, 0.22] : [0.34, 0.24, 0.3]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={marker.tone} roughness={0.94} metalness={0.04} emissive="#092429" emissiveIntensity={0.07} />
      </mesh>
      <mesh position={isMedian ? [0.18, 0.2, 0.02] : [0.16, 0.2, 0.1]} scale={isMedian ? [0.24, 0.16, 0.2] : [0.24, 0.18, 0.24]} castShadow receiveShadow>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2a484a" roughness={0.94} metalness={0.02} emissive="#071f25" emissiveIntensity={0.06} />
      </mesh>
      <mesh position={[0, 0.071, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
        <ringGeometry args={[isMedian ? 0.32 : 0.28, isMedian ? 0.38 : 0.34, 20]} />
        <meshBasicMaterial color="#4f8790" transparent opacity={0.05} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Building({ building, selected, onSelect }: { building: CityBuilding; selected: boolean; onSelect: () => void }) {
  const color = building.active ? building.color : "#4d5a63";
  const edgeColor = selected ? "#f0c76d" : building.active ? building.glowColor : "#5d7280";
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
  const edgeColor = selected ? "#f0c76d" : building.active ? building.accentColor : "#5d7280";
  return (
    <group position={[0, -h / 2 + 0.04, 0]}>
      <mesh scale={[plotWidth, 0.08, plotDepth]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color={building.active ? "#253f52" : "#1d2c38"}
          roughness={0.68}
          metalness={0.2}
          emissive={building.active ? "#123950" : "#000000"}
          emissiveIntensity={0.18}
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
  const opacity = building.active ? 0.92 : 0.26;
  const emissiveIntensity = selected ? 0.46 : building.active ? 0.12 : 0;
  const accentOpacity = building.active ? 0.9 : 0.22;
  const facadeTexture = useMemo(() => createFacadeTexture(building, w, h, d), [building, w, h, d]);
  useEffect(() => () => facadeTexture.dispose(), [facadeTexture]);
  const signature = <BuildingSignature building={building} width={w} height={h} depth={d} selected={selected} accentOpacity={accentOpacity} />;
  const material = () => (
    <meshPhysicalMaterial
      map={facadeTexture}
      emissiveMap={facadeTexture}
      color={color}
      roughness={0.22}
      metalness={0.42}
      clearcoat={0.9}
      clearcoatRoughness={0.08}
      ior={1.42}
      reflectivity={0.62}
      emissive={selected ? "#f0c76d" : building.glowColor}
      emissiveIntensity={emissiveIntensity + 0.08}
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
          {signature}
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
          {signature}
          {details}
        </>
      );
    case "interface":
      return (
        <>
          <BoxPart position={[0, 0, 0]} scale={[w * 0.82, h, d]} material={material()} edgeColor={edgeColor} />
          <BoxPart position={[w * 0.42, h * 0.05, 0]} scale={[w * 0.14, h * 0.86, d * 1.35]} material={material()} edgeColor="#bdeeff" />
          <BoxPart position={[-w * 0.42, h * 0.05, 0]} scale={[w * 0.14, h * 0.86, d * 1.35]} material={material()} edgeColor="#bdeeff" />
          <BoxPart position={[0, h * 0.5 + 0.2, 0]} scale={[w * 1.08, 0.16, d * 1.24]} material={material()} edgeColor={edgeColor} />
          <ScreenPanel position={[0, h * 0.06, d * 0.72]} scale={[w * 1.05, h * 0.62, 0.05]} color={building.accentColor} opacity={accentOpacity} />
          <ScreenPanel position={[0, h * 0.18, -d * 0.72]} scale={[w * 0.8, h * 0.5, 0.05]} color={building.glowColor} opacity={accentOpacity * 0.65} />
          <AntennaCluster width={w} height={h} color={building.glowColor} opacity={accentOpacity} />
          {signature}
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
          {signature}
          {details}
        </>
      );
    case "style":
      return (
        <>
          <BoxPart position={[0, 0, 0]} scale={[w, h, Math.max(0.16, d)]} material={material()} edgeColor="#9bc7d9" />
          <BoxPart position={[0, h * 0.12, d * 0.72]} scale={[w * 0.78, h * 0.55, 0.08]} material={material()} edgeColor="#d6e6ee" />
          <ScreenPanel position={[0, h * 0.12, d * 0.82]} scale={[w * 0.9, h * 0.72, 0.045]} color={building.accentColor} opacity={accentOpacity} />
          <LightBand width={w * 1.1} depth={Math.max(0.5, d * 1.4)} y={-h * 0.28} color={building.glowColor} opacity={accentOpacity * 0.7} />
          <HoloSign building={building} y={h * 0.52 + 0.2} color={building.accentColor} opacity={accentOpacity} />
          {signature}
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
          {signature}
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
          {signature}
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
          {signature}
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
          {signature}
          {details}
        </>
      );
  }
}

function BuildingSignature({
  building,
  width,
  height,
  depth,
  selected,
  accentOpacity
}: {
  building: CityBuilding;
  width: number;
  height: number;
  depth: number;
  selected: boolean;
  accentOpacity: number;
}) {
  const seed = seededNumber(`${building.node.id}-skin`);
  const lightOpacity = selected ? 0.95 : accentOpacity * (0.54 + seed * 0.22);
  const hasBeacon = selected || height > 9 || building.node.commitCount > 35;

  return (
    <>
      <GlassSkin width={width} height={height} depth={depth} color={building.glowColor} selected={selected} />
      <SetbackTerraces width={width} height={height} depth={depth} color={building.glowColor} accentColor={building.accentColor} seed={seed} opacity={accentOpacity} />
      <FloorPlateStack width={width} height={height} depth={depth} color="#d9f6ff" opacity={selected ? 0.62 : accentOpacity * 0.28} seed={seed} />
      <FacadeMullions width={width} height={height} depth={depth} color={building.accentColor} opacity={lightOpacity} seed={seed} />
      <RooftopCrown width={width} height={height} depth={depth} color={building.glowColor} accentColor={building.accentColor} selected={selected} opacity={accentOpacity} />
      <RoofMachinery building={building} width={width} height={height} depth={depth} seed={seed} />
      <GroundHalo width={width} height={height} depth={depth} color={building.accentColor} opacity={selected ? 0.72 : accentOpacity * 0.34} />
      {hasBeacon ? <SkyBeacon width={width} height={height} color={building.glowColor} opacity={selected ? 0.9 : 0.52} /> : null}
    </>
  );
}

function SetbackTerraces({
  width,
  height,
  depth,
  color,
  accentColor,
  seed,
  opacity
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  accentColor: string;
  seed: number;
  opacity: number;
}) {
  if (height < 3.4) return null;
  const count = clampInt(Math.floor(height / 4.8), 1, 4);
  const terraces = Array.from({ length: count }, (_, index) => {
    const ratio = (index + 1) / (count + 1);
    const y = -height / 2 + ratio * height;
    const shrink = 1 - ratio * (0.16 + seed * 0.12);
    const slabHeight = 0.055 + seed * 0.025;
    return (
      <mesh key={index} position={[0, y, 0]} scale={[width * (shrink + 0.12), slabHeight, depth * (shrink + 0.12)]} renderOrder={3}>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#d7f4ff"
          roughness={0.1}
          metalness={0.34}
          clearcoat={0.95}
          emissive={index % 2 ? color : accentColor}
          emissiveIntensity={0.22}
          transparent
          opacity={Math.min(0.42, opacity * 0.34)}
          depthWrite={false}
        />
        <Edges color={index % 2 ? color : accentColor} threshold={12} />
      </mesh>
    );
  });
  return <>{terraces}</>;
}

function FloorPlateStack({
  width,
  height,
  depth,
  color,
  opacity,
  seed
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  opacity: number;
  seed: number;
}) {
  const floors = clampInt(Math.floor(height / (0.95 + seed * 0.55)), 3, 16);
  const plates = Array.from({ length: floors }, (_, index) => {
    const y = -height / 2 + ((index + 1) / (floors + 1)) * height;
    const pulse = index % 3 === 0 ? 1 : 0.74;
    return (
      <group key={index}>
        <GlowBar position={[0, y, depth * 0.538]} scale={[width * 0.88, 0.018, 0.018]} color={color} opacity={opacity * pulse} />
        <GlowBar position={[width * 0.538, y, 0]} scale={[0.018, 0.018, depth * 0.76]} color="#8ad8f6" opacity={opacity * 0.62 * pulse} />
      </group>
    );
  });
  return <>{plates}</>;
}

function GlassSkin({ width, height, depth, color, selected }: { width: number; height: number; depth: number; color: string; selected: boolean }) {
  return (
    <mesh scale={[width * 1.035, height * 1.01, depth * 1.035]} renderOrder={2}>
      <boxGeometry args={[1, 1, 1]} />
      <meshPhysicalMaterial
        color="#d8f4ff"
        roughness={0.05}
        metalness={0.08}
        clearcoat={1}
        clearcoatRoughness={0.04}
        ior={1.5}
        reflectivity={0.72}
        emissive={color}
        emissiveIntensity={selected ? 0.12 : 0.04}
        transparent
        opacity={selected ? 0.2 : 0.095}
        depthWrite={false}
      />
    </mesh>
  );
}

function FacadeMullions({
  width,
  height,
  depth,
  color,
  opacity,
  seed
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  opacity: number;
  seed: number;
}) {
  const frontCount = clampInt(Math.floor(width * 1.15 + seed * 2), 2, 7);
  const sideCount = clampInt(Math.floor(depth * 1.1 + seed * 2), 2, 6);
  const verticals = Array.from({ length: frontCount }, (_, index) => {
    const x = -width * 0.38 + (frontCount === 1 ? 0 : (index / (frontCount - 1)) * width * 0.76);
    return <GlowBar key={`front-${index}`} position={[x, 0, depth * 0.526]} scale={[0.026, height * 0.82, 0.022]} color={color} opacity={opacity * 0.62} />;
  });
  const sideVerticals = Array.from({ length: sideCount }, (_, index) => {
    const z = -depth * 0.36 + (sideCount === 1 ? 0 : (index / (sideCount - 1)) * depth * 0.72);
    return <GlowBar key={`side-${index}`} position={[width * 0.526, 0, z]} scale={[0.022, height * 0.72, 0.026]} color="#bdeeff" opacity={opacity * 0.38} />;
  });

  return (
    <>
      {verticals}
      {sideVerticals}
      <GlowBar position={[0, height * 0.18, depth * 0.532]} scale={[width * 0.84, 0.035, 0.026]} color="#f8fcff" opacity={opacity * 0.24} />
      <GlowBar position={[0, -height * 0.24, depth * 0.532]} scale={[width * 0.74, 0.03, 0.026]} color={color} opacity={opacity * 0.42} />
    </>
  );
}

function RooftopCrown({
  width,
  height,
  depth,
  color,
  accentColor,
  selected,
  opacity
}: {
  width: number;
  height: number;
  depth: number;
  color: string;
  accentColor: string;
  selected: boolean;
  opacity: number;
}) {
  const radius = Math.max(width, depth);
  return (
    <>
      <mesh position={[0, height / 2 + 0.045, 0]} scale={[width * 1.08, 0.08, depth * 1.08]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshPhysicalMaterial
          color="#e6f8ff"
          roughness={0.12}
          metalness={0.26}
          clearcoat={0.92}
          emissive={color}
          emissiveIntensity={selected ? 0.34 : 0.13}
          transparent
          opacity={selected ? 0.5 : 0.28}
        />
        <Edges color={selected ? "#fff0bd" : color} threshold={12} />
      </mesh>
      <mesh position={[0, height / 2 + 0.13, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} renderOrder={3}>
        <ringGeometry args={[radius * 0.42, radius * 0.49, 4]} />
        <meshBasicMaterial color={accentColor} transparent opacity={Math.min(0.78, opacity * 0.72)} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
}

function RoofMachinery({
  building,
  width,
  height,
  depth,
  seed
}: {
  building: CityBuilding;
  width: number;
  height: number;
  depth: number;
  seed: number;
}) {
  const equipmentCount = clampInt(Math.floor((building.node.imports.length + building.node.commitCount / 22 + seed * 2) % 5) + 1, 1, 5);
  const items = Array.from({ length: equipmentCount }, (_, index) => {
    const rng = makeRng(`${building.node.id}-roof-${index}`);
    const x = (rng() - 0.5) * width * 0.48;
    const z = (rng() - 0.5) * depth * 0.48;
    const itemWidth = clampNumber(width * (0.12 + rng() * 0.12), 0.12, 0.56);
    const itemDepth = clampNumber(depth * (0.12 + rng() * 0.12), 0.12, 0.56);
    const itemHeight = clampNumber(height * (0.035 + rng() * 0.035), 0.08, 0.46);
    const color = index % 2 ? building.glowColor : building.accentColor;
    return (
      <group key={index} position={[x, height / 2 + 0.15 + itemHeight / 2, z]}>
        <mesh scale={[itemWidth, itemHeight, itemDepth]} castShadow receiveShadow>
          <boxGeometry args={[1, 1, 1]} />
          <meshPhysicalMaterial color="#bfd4dd" roughness={0.2} metalness={0.48} clearcoat={0.7} emissive={color} emissiveIntensity={0.14} />
          <Edges color={color} threshold={12} />
        </mesh>
        {index % 2 === 0 ? (
          <mesh position={[0, itemHeight / 2 + 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[Math.max(itemWidth, itemDepth) * 0.32, Math.max(itemWidth, itemDepth) * 0.42, 20]} />
            <meshBasicMaterial color={color} transparent opacity={0.58} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        ) : null}
      </group>
    );
  });
  return <>{items}</>;
}

function GroundHalo({ width, height, depth, color, opacity }: { width: number; height: number; depth: number; color: string; opacity: number }) {
  const radius = Math.max(width, depth);
  return (
    <mesh position={[0, -height / 2 + 0.078, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 4]} renderOrder={1}>
      <ringGeometry args={[radius * 0.58, radius * 0.68, 4]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

function SkyBeacon({ width, height, color, opacity }: { width: number; height: number; color: string; opacity: number }) {
  const beaconHeight = clampNumber(height * 0.36, 1.1, 4.2);
  return (
    <group position={[0, height / 2 + beaconHeight / 2 + 0.2, 0]}>
      <mesh renderOrder={3}>
        <cylinderGeometry args={[0.018, 0.032, beaconHeight, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh position={[0, beaconHeight / 2 + 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <ringGeometry args={[Math.max(0.18, width * 0.16), Math.max(0.22, width * 0.2), 34]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.56} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

function GlowBar({
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
    <mesh position={position} scale={scale} renderOrder={3}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial color={color} transparent opacity={opacity} blending={AdditiveBlending} depthWrite={false} />
    </mesh>
  );
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
      <Edges color="#f8fcff" threshold={10} />
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
  const treeTones = ["#1b3b40", "#203f45", "#263f42", "#1a3438"];
  const maxCanopies = clampInt(Math.ceil(pads.length * 0.85), 2, 8);

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

    if (width > 9.5 && depth > 9.5 && padIndex % 4 === 0) {
      const parkWidth = clampNumber(width * 0.12, 1.6, 2.9);
      const parkDepth = clampNumber(depth * 0.1, 1, 2.1);
      const cornerX = padIndex % 4 === 0 ? -1 : 1;
      const cornerZ = padIndex % 3 === 0 ? 1 : -1;
      parks.push({
        id: `${key}-rain-garden`,
        position: [
          x + cornerX * (width / 2 - parkWidth / 2 - 0.72),
          0.066,
          z + cornerZ * (depth / 2 - parkDepth / 2 - 0.72)
        ],
        size: [parkWidth, parkDepth],
        tone: padIndex % 4 === 0 ? "#17343a" : "#1b3a3c",
        rotation: seededNumber(`${pad.district}-garden`) * 0.32 - 0.16
      });
    }

    const canopyCandidates: Array<{ point: [number, number]; shape: TreeMarker["shape"] }> = [
      { point: [x - width / 2 - roadWidth * 0.62, z - depth * 0.26], shape: "median" },
      { point: [x + width / 2 + roadWidth * 0.62, z + depth * 0.24], shape: "median" },
      { point: [x - width * 0.32, z + depth / 2 + roadWidth * 0.62], shape: "grove" },
      { point: [x + width * 0.3, z - depth / 2 - roadWidth * 0.62], shape: "grove" }
    ];

    const startIndex = padIndex % canopyCandidates.length;
    const arrangedCanopies = [...canopyCandidates.slice(startIndex), ...canopyCandidates.slice(0, startIndex)];
    const chosenCount = padIndex % 3 === 0 ? 1 : 0;
    arrangedCanopies.slice(0, chosenCount).forEach(({ point, shape }, treeIndex) => {
      if (trees.length >= maxCanopies) return;
      const [treeX, treeZ] = point;
      if (treeX < bounds.minX || treeX > bounds.maxX || treeZ < bounds.minZ || treeZ > bounds.maxZ) return;
      const seed = seededNumber(`${pad.district}-${treeIndex}`);
      trees.push({
        id: `${key}-canopy-${treeIndex}`,
        position: [treeX, 0.055, treeZ],
        scale: clampNumber(0.42 + seed * 0.18, 0.4, 0.6),
        tone: treeTones[(padIndex + treeIndex) % treeTones.length],
        shape
      });
    });
  });

  return { roads, parks, trees };
}

function createFacadeTexture(building: CityBuilding, width: number, height: number, depth: number): CanvasTexture {
  const rng = makeRng(`${building.node.id}-facade`);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return new CanvasTexture(canvas);

  const accent = new Color(building.accentColor);
  const glow = new Color(building.glowColor);
  const floors = clampInt(Math.floor(height * 1.22), 5, 22);
  const columns = clampInt(Math.floor(Math.max(width, depth) * 2.25), 4, 14);
  const litChance = clampNumber(0.22 + building.node.commitCount / 110 + building.node.imports.length / 18, 0.24, 0.82);
  const cellWidth = canvas.width / columns;
  const cellHeight = canvas.height / floors;

  const bg = context.createLinearGradient(0, 0, 0, canvas.height);
  bg.addColorStop(0, "#294b5f");
  bg.addColorStop(0.5, "#102a3b");
  bg.addColorStop(1, "#06131f");
  context.fillStyle = bg;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < floors; y += 1) {
    for (let x = 0; x < columns; x += 1) {
      const lit = rng() < litChance * (0.72 + ((x + y) % 3) * 0.09);
      const color = rng() > 0.62 ? glow : accent;
      const alpha = lit ? 0.46 + rng() * 0.44 : 0.08 + rng() * 0.08;
      const insetX = 1 + rng() * 1.2;
      const insetY = 1 + rng() * 1.2;
      context.fillStyle = lit ? colorCss(color, alpha, 1.08 + rng() * 0.36) : `rgba(12, 34, 49, ${alpha})`;
      context.fillRect(x * cellWidth + insetX, y * cellHeight + insetY, Math.max(1, cellWidth - insetX * 2), Math.max(1, cellHeight * 0.46));
    }
  }

  context.strokeStyle = "rgba(210, 244, 255, 0.16)";
  context.lineWidth = 1;
  for (let x = 0; x <= columns; x += 1) {
    const px = Math.round(x * cellWidth) + 0.5;
    context.beginPath();
    context.moveTo(px, 0);
    context.lineTo(px, canvas.height);
    context.stroke();
  }
  context.strokeStyle = "rgba(255, 241, 194, 0.12)";
  for (let y = 0; y <= floors; y += 2) {
    const py = Math.round(y * cellHeight) + 0.5;
    context.beginPath();
    context.moveTo(0, py);
    context.lineTo(canvas.width, py);
    context.stroke();
  }

  const bigCanvas = document.createElement("canvas");
  bigCanvas.width = 512;
  bigCanvas.height = 1024;
  const bigContext = bigCanvas.getContext("2d");
  if (!bigContext) return new CanvasTexture(canvas);
  bigContext.imageSmoothingEnabled = false;
  bigContext.drawImage(canvas, 0, 0, bigCanvas.width, bigCanvas.height);

  const texture = new CanvasTexture(bigCanvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(clampNumber(Math.max(width, depth) / 2.4, 1, 3.2), clampNumber(height / 6, 1, 4.8));
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.needsUpdate = true;
  return texture;
}

function colorCss(color: Color, alpha: number, intensity = 1): string {
  const r = Math.min(255, Math.round(color.r * 255 * intensity));
  const g = Math.min(255, Math.round(color.g * 255 * intensity));
  const b = Math.min(255, Math.round(color.b * 255 * intensity));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function makeRng(value: string): () => number {
  let seed = hashString(value);
  return () => {
    seed += 0x6d2b79f5;
    let next = seed;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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
      <meshBasicMaterial color="#d7b76f" transparent opacity={0.3} />
    </mesh>
  );
}
