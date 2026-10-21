import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { ContactShadows, Float, RoundedBox, Sparkles } from "@react-three/drei";
import * as THREE from "three";
import { DECORATIONS, type DecorId } from "@/lib/tracker/gamify";

/** Diorama study corner: an isometric mini room where owned decorations appear as real objects. */

const FLOOR_W = 6.4;
const FLOOR_D = 4.2;
const WALL_H = 2.6;
const BACK_Z = -FLOOR_D / 2; // back wall
const LEFT_X = -FLOOR_W / 2; // left wall

function emojiTexture(emoji: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  if (g) {
    g.font = "96px serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(emoji, 64, 68);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function woodTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#9a6a44";
    g.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 512; y += 64) {
      g.fillStyle = y % 128 === 0 ? "#a3704a" : "#94643f";
      g.fillRect(0, y, 512, 62);
      g.strokeStyle = "rgba(60,35,18,0.35)";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(512, y);
      g.stroke();
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(70,42,22,${0.08 + Math.random() * 0.08})`;
        g.lineWidth = 1 + Math.random() * 2;
        g.beginPath();
        const yy = y + Math.random() * 60;
        g.moveTo(Math.random() * 200, yy);
        g.lineTo(300 + Math.random() * 212, yy + (Math.random() - 0.5) * 6);
        g.stroke();
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 1);
  return t;
}

function galaxyTexture() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 384;
  const g = c.getContext("2d");
  if (g) {
    const grad = g.createLinearGradient(0, 0, 128, 384);
    grad.addColorStop(0, "#2e1065");
    grad.addColorStop(0.45, "#6d28d9");
    grad.addColorStop(0.75, "#312e81");
    grad.addColorStop(1, "#0c0a2a");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 384);
    // milky band
    g.save();
    g.translate(128, 192);
    g.rotate(-0.5);
    const band = g.createLinearGradient(-200, 0, 200, 0);
    band.addColorStop(0, "rgba(216,180,254,0)");
    band.addColorStop(0.5, "rgba(216,180,254,0.55)");
    band.addColorStop(1, "rgba(216,180,254,0)");
    g.fillStyle = band;
    g.fillRect(-240, -46, 480, 92);
    g.restore();
    for (let i = 0; i < 90; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + Math.random() * 0.7})`;
      const r = Math.random() * 1.6 + 0.4;
      g.beginPath();
      g.arc(Math.random() * 256, Math.random() * 384, r, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function posterTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d");
  if (g) {
    g.fillStyle = "#fde68a";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "#f59e0b";
    g.fillRect(16, 16, 224, 224);
    g.fillStyle = "#fff7ed";
    g.fillRect(28, 28, 200, 200);
    g.fillStyle = "#b45309";
    g.font = "bold 34px sans-serif";
    g.textAlign = "center";
    g.fillText("CỐ LÊN!", 128, 108);
    g.font = "20px sans-serif";
    g.fillText("hôm nay chứ", 128, 148);
    g.fillText("không phải ngày mai ✏️", 128, 178);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/* ---------- shared bits ---------- */

function PetSprite({ emoji }: { emoji: string }) {
  const tex = useMemo(() => emojiTexture(emoji), [emoji]);
  return (
    <Float speed={2.2} floatIntensity={0.55} rotationIntensity={0.25}>
      <mesh position={[0.55, 0.5, 0.5]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={tex} transparent toneMapped={false} />
      </mesh>
    </Float>
  );
}

function DeskLamp() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 2.6 + Math.sin(clock.elapsedTime * 3) * 0.3;
  });
  return (
    <group>
      <RoundedBox args={[0.26, 0.06, 0.26]} radius={0.02} position={[0, 0.03, 0]}>
        <meshStandardMaterial color="#2f3542" roughness={0.5} />
      </RoundedBox>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.54, 8]} />
        <meshStandardMaterial color="#2f3542" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.58, 0.05]} rotation={[0.45, 0, 0]}>
        <coneGeometry args={[0.17, 0.22, 20, 1, true]} />
        <meshStandardMaterial
          color="#f7b955"
          emissive="#f7b955"
          emissiveIntensity={0.85}
          side={THREE.DoubleSide}
          roughness={0.4}
        />
      </mesh>
      <mesh position={[0, 0.5, 0.12]}>
        <sphereGeometry args={[0.055, 10, 10]} />
        <meshBasicMaterial color="#ffe6a8" toneMapped={false} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.52, 0.16]}
        color="#ffcf7a"
        intensity={2.6}
        distance={3.6}
      />
    </group>
  );
}

function Plant({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <RoundedBox args={[0.34, 0.3, 0.34]} radius={0.05} position={[0, 0.15, 0]}>
        <meshStandardMaterial color="#b0562e" roughness={0.9} />
      </RoundedBox>
      <mesh position={[0, 0.29, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.04, 18]} />
        <meshStandardMaterial color="#7c3f21" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.52, 0]}>
        <cylinderGeometry args={[0.03, 0.05, 0.42, 8]} />
        <meshStandardMaterial color="#2f7d32" roughness={0.8} />
      </mesh>
      {(
        [
          [0.16, 0.68, 0.05, 0.55, 0.17],
          [-0.15, 0.72, -0.03, -0.5, 0.14],
          [0.02, 0.78, -0.12, 0.15, 0.12],
        ] as const
      ).map(([x, y, z, tilt, r], i) => (
        <group key={i} position={[x, y, z]} rotation={[0, 0, tilt]}>
          <mesh>
            <sphereGeometry args={[r, 12, 10]} />
            <meshStandardMaterial color={i % 2 ? "#43a047" : "#2e7d32"} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function WallShelf() {
  const books = ["#e05252", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#14b8a6"];
  return (
    <group>
      {(
        [
          [0, 0, 4],
          [0, -0.5, 3],
        ] as const
      ).map(([y, , count], row) => (
        <group key={row} position={[0, y, 0]}>
          <RoundedBox args={[1.25, 0.07, 0.26]} radius={0.02}>
            <meshStandardMaterial color="#7c4a2d" roughness={0.75} />
          </RoundedBox>
          {books.slice(0, count).map((c, i) => (
            <mesh
              key={c}
              position={[-0.5 + i * 0.17, 0.17, 0]}
              rotation={[0, 0, i % 3 === 2 ? 0.12 : 0]}
            >
              <boxGeometry args={[0.11, 0.28, 0.17]} />
              <meshStandardMaterial color={c} roughness={0.65} />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0.42, -0.38, 0]}>
        <Plant scale={0.35} />
      </group>
    </group>
  );
}

function Teddy() {
  return (
    <group rotation={[0, -0.55, 0]}>
      <RoundedBox args={[0.5, 0.36, 0.4]} radius={0.16} position={[0, 0.05, 0]}>
        <meshStandardMaterial color="#a9744f" roughness={0.95} />
      </RoundedBox>
      <mesh position={[0, 0.36, 0]}>
        <sphereGeometry args={[0.19, 16, 16]} />
        <meshStandardMaterial color="#a9744f" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.32, 0.14]}>
        <sphereGeometry args={[0.11, 12, 12]} />
        <meshStandardMaterial color="#e6cba4" roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.3, 0.2]}>
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshStandardMaterial color="#4a2e1c" />
      </mesh>
      {(
        [
          [-0.12, 0.48],
          [0.12, 0.48],
        ] as const
      ).map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0]}>
          <sphereGeometry args={[0.07, 10, 10]} />
          <meshStandardMaterial color="#a9744f" roughness={0.95} />
        </mesh>
      ))}
      {(
        [
          [-0.19, 0.02],
          [0.19, 0.02],
        ] as const
      ).map(([x, y], i) => (
        <mesh key={i} position={[x, y, 0.12]} rotation={[0.5, 0, 0]}>
          <capsuleGeometry args={[0.06, 0.14, 4, 10]} />
          <meshStandardMaterial color="#a9744f" roughness={0.95} />
        </mesh>
      ))}
      <RoundedBox args={[0.62, 0.07, 0.5]} radius={0.03} position={[0, -0.13, 0]}>
        <meshStandardMaterial color="#7f5af0" roughness={0.9} />
      </RoundedBox>
    </group>
  );
}

function FairyLights() {
  const group = useRef<THREE.Group>(null);
  const N = 13;
  useFrame(({ clock }) => {
    if (group.current)
      group.current.children.forEach((m, i) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.5 + 0.5 * Math.abs(Math.sin(clock.elapsedTime * 1.8 + i * 0.9));
      });
  });
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[
              new Float32Array(
                Array.from({ length: N }, (_, i) => [
                  -2.9 + i * (5.8 / (N - 1)),
                  -Math.sin((Math.PI * i) / (N - 1)) * 0.3,
                  0,
                ]).flat(),
              ),
              3,
            ]}
          />
        </bufferGeometry>
        <meshBasicMaterial color="#5b4636" />
      </mesh>
      <group ref={group}>
        {Array.from({ length: N }, (_, i) => (
          <mesh
            key={i}
            position={[
              -2.9 + i * (5.8 / (N - 1)),
              -Math.sin((Math.PI * i) / (N - 1)) * 0.3 - 0.09,
              0,
            ]}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial
              color={i % 3 === 0 ? "#ffd6a5" : i % 3 === 1 ? "#caffbf" : "#a0c4ff"}
              transparent
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
      <Sparkles
        count={14}
        scale={[5.6, 0.5, 0.4]}
        position={[0, -0.25, 0]}
        size={2.5}
        speed={0.4}
        color="#ffe9a3"
      />
    </group>
  );
}

function StarClock() {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.rotation.z = clock.elapsedTime * 0.35;
  });
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.3, 0.04, 12, 40]} />
        <meshStandardMaterial color="#d4a017" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, -0.01]}>
        <circleGeometry args={[0.27, 32]} />
        <meshStandardMaterial color="#1e1b4b" roughness={0.9} />
      </mesh>
      <mesh ref={ring} position={[0, 0, 0.015]}>
        <torusGeometry args={[0.17, 0.015, 8, 40]} />
        <meshStandardMaterial color="#e9d5ff" emissive="#a78bfa" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0.06, 0.07, 0.02]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#c4b5fd" emissive="#8b5cf6" emissiveIntensity={0.55} />
      </mesh>
      <mesh position={[0.06, 0.07, 0.02]} rotation={[1.1, 0.3, 0]}>
        <torusGeometry args={[0.13, 0.012, 8, 40]} />
        <meshStandardMaterial color="#fbcfe8" emissive="#f0abfc" emissiveIntensity={0.4} />
      </mesh>
    </group>
  );
}

/* ---------- room ---------- */

// ---- Seasonal room themes (auto by month): Tet (Jan-Feb), Halloween (Oct), Christmas (Dec) ----
export type RoomSeason = "default" | "tet" | "halloween" | "christmas";
export function roomSeason(date = new Date()): RoomSeason {
  const m = date.getMonth();
  if (m === 9) return "halloween";
  if (m === 11) return "christmas";
  if (m === 0 || m === 1) return "tet";
  return "default";
}

const SEASON_PALETTE: Record<
  RoomSeason,
  {
    wallBack: string;
    wallLeft: string;
    baseboard: string;
    curtain: string;
    windowPane: string;
    moon: string;
    moonLight: string;
    ambient: string;
    rugInner: string;
    rugRing: string;
    rugMid: string;
  }
> = {
  default: {
    wallBack: "#2c5570",
    wallLeft: "#25495f",
    baseboard: "#e8d8c3",
    curtain: "#815ac0",
    windowPane: "#9fc2e8",
    moon: "#fdf6d8",
    moonLight: "#aecbf5",
    ambient: "#cfe3ff",
    rugInner: "#c9603f",
    rugRing: "#8a3f33",
    rugMid: "#e0a06c",
  },
  tet: {
    wallBack: "#8a2f2f",
    wallLeft: "#742828",
    baseboard: "#eec87a",
    curtain: "#b91c1c",
    windowPane: "#f7c948",
    moon: "#fff3c4",
    moonLight: "#ffd9a8",
    ambient: "#ffe0c2",
    rugInner: "#d64545",
    rugRing: "#a31515",
    rugMid: "#f4c430",
  },
  halloween: {
    wallBack: "#3b3454",
    wallLeft: "#332e4a",
    baseboard: "#c4b5fd",
    curtain: "#4c1d95",
    windowPane: "#c7d2fe",
    moon: "#e2e8f0",
    moonLight: "#a78bfa",
    ambient: "#d8b4fe",
    rugInner: "#b45309",
    rugRing: "#3b0764",
    rugMid: "#f97316",
  },
  christmas: {
    wallBack: "#274b3d",
    wallLeft: "#224135",
    baseboard: "#dbeafe",
    curtain: "#b91c1c",
    windowPane: "#e0f2fe",
    moon: "#f8fafc",
    moonLight: "#e0f2fe",
    ambient: "#dbeafe",
    rugInner: "#166534",
    rugRing: "#14532d",
    rugMid: "#dc2626",
  },
};

function SeasonExtras({ season }: { season: RoomSeason }) {
  if (season === "tet") {
    const lantern = (x: number, y: number, key: number) => (
      <group key={key} position={[x, y, BACK_Z + 0.25]}>
        <mesh>
          <sphereGeometry args={[0.14, 16, 12]} />
          <meshStandardMaterial
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={0.35}
            roughness={0.4}
          />
        </mesh>
        <mesh position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.16, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.04, 10]} />
          <meshStandardMaterial color="#fbbf24" metalness={0.5} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.26, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.14, 6]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.5} />
        </mesh>
        <pointLight color="#ff9d5c" intensity={0.55} distance={2.2} />
      </group>
    );
    return (
      <group>
        {lantern(-1.7, 2.05, 0)}
        {lantern(1.15, 2.05, 1)}
        {/* red-gold banner on the back wall */}
        <mesh position={[0, 2.25, BACK_Z + 0.14]}>
          <boxGeometry args={[1.6, 0.3, 0.02]} />
          <meshStandardMaterial color="#b91c1c" roughness={0.6} />
        </mesh>
        {[" aura "].map((_, i) => (
          <mesh key={`g${i}`} position={[-0.45 + i * 0.3, 2.25, BACK_Z + 0.16]}>
            <circleGeometry args={[0.07, 5]} />
            <meshBasicMaterial color="#fde68a" toneMapped={false} />
          </mesh>
        ))}
      </group>
    );
  }
  if (season === "halloween") {
    return (
      <group>
        {/* pumpkin on the floor */}
        <group position={[1.5, 0.14, 0.8]}>
          <mesh castShadow>
            <sphereGeometry args={[0.22, 14, 12]} />
            <meshStandardMaterial color="#f97316" roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.03, 0.045, 0.1, 8]} />
            <meshStandardMaterial color="#4a2e1c" roughness={0.9} />
          </mesh>
          {/* jack-o-lantern face */}
          {[-0.09, 0.09].map((x, i) => (
            <mesh key={i} position={[x, 0.05, 0.2]}>
              <circleGeometry args={[0.045, 3]} />
              <meshBasicMaterial color="#1c0a0a" toneMapped={false} />
            </mesh>
          ))}
          <mesh position={[0, -0.05, 0.21]}>
            <circleGeometry args={[0.07, 4]} />
            <meshBasicMaterial color="#1c0a0a" toneMapped={false} />
          </mesh>
          <pointLight color="#fb923c" intensity={0.9} distance={1.8} position={[0, 0.1, 0.2]} />
        </group>
        {/* bats on the wall */}
        {(
          [
            [-1.2, 2.2],
            [-0.7, 2.35],
            [0.4, 2.25],
          ] as [number, number][]
        ).map(([x, y], i) => (
          <mesh key={i} position={[x, y, BACK_Z + 0.13]} rotation={[0, 0, (i % 2 ? 1 : -1) * 0.2]}>
            <circleGeometry args={[0.09, 3]} />
            <meshBasicMaterial color="#1e1b4b" toneMapped={false} />
          </mesh>
        ))}
      </group>
    );
  }
  if (season === "christmas") {
    return (
      <group>
        {/* small tree in the corner */}
        <group position={[2.6, 0, -1.3]}>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.22, 0.26, 0.16, 10]} />
            <meshStandardMaterial color="#7c3f21" roughness={0.9} />
          </mesh>
          {[0.34, 0.26, 0.18].map((r, i) => (
            <mesh key={i} position={[0, 0.32 + i * 0.24, 0]} castShadow>
              <coneGeometry args={[r, 0.4, 12]} />
              <meshStandardMaterial color="#166534" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 1.12, 0]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.8} />
          </mesh>
          {(
            [
              [0.12, 0.5],
              [-0.1, 0.72],
              [0.08, 0.9],
              [-0.14, 0.42],
            ] as [number, number][]
          ).map(([x, y], i) => (
            <mesh key={i} position={[x, y, 0.18]}>
              <sphereGeometry args={[0.035, 8, 8]} />
              <meshBasicMaterial
                color={["#ef4444", "#fbbf24", "#38bdf8", "#f472b6"][i]!}
                toneMapped={false}
              />
            </mesh>
          ))}
          <pointLight color="#ffd9a8" intensity={0.5} distance={2.4} position={[0, 0.8, 0.3]} />
        </group>
        {/* warm string lights along the back wall */}
        {Array.from({ length: 7 }, (_, i) => (
          <mesh key={i} position={[-2.4 + i * 0.8, 2.3 + Math.sin(i * 1.1) * 0.06, BACK_Z + 0.12]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial
              color={["#fbbf24", "#f87171", "#4ade80", "#60a5fa"][i % 4]!}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>
    );
  }
  return null;
}

function Room({
  decor,
  onStow,
  petEmoji,
  onShelfClick,
  season = "default",
}: {
  decor: DecorId[];
  onStow: (id: DecorId) => void;
  petEmoji: string;
  onShelfClick?: (() => void) | undefined;
  season?: RoomSeason;
}) {
  const S = SEASON_PALETTE[season];
  const wood = useMemo(() => woodTexture(), []);
  const galaxyTex = useMemo(() => galaxyTexture(), []);
  const posterTex = useMemo(() => posterTexture(), []);
  const has = (id: DecorId) => decor.includes(id);
  return (
    <group>
      {/* floor */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[FLOOR_W, 0.1, FLOOR_D]} />
        <meshStandardMaterial map={wood} roughness={0.85} />
      </mesh>
      {/* walls */}
      <mesh position={[0, WALL_H / 2, BACK_Z - 0.04]} receiveShadow>
        <boxGeometry args={[FLOOR_W, WALL_H, 0.08]} />
        <meshStandardMaterial color={S.wallBack} roughness={0.95} />
      </mesh>
      <mesh position={[LEFT_X - 0.04, WALL_H / 2, 0]}>
        <boxGeometry args={[0.08, WALL_H, FLOOR_D]} />
        <meshStandardMaterial color={S.wallLeft} roughness={0.95} />
      </mesh>
      {/* baseboards */}
      <mesh position={[0, 0.08, BACK_Z + 0.005]}>
        <boxGeometry args={[FLOOR_W, 0.16, 0.03]} />
        <meshStandardMaterial color={S.baseboard} roughness={0.9} />
      </mesh>
      <mesh position={[LEFT_X + 0.005, 0.08, 0]}>
        <boxGeometry args={[0.03, 0.16, FLOOR_D]} />
        <meshStandardMaterial color={S.baseboard} roughness={0.9} />
      </mesh>
      {/* window on the left wall with moonlight */}
      <group position={[LEFT_X + 0.06, 1.5, -0.55]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[1.15, 1.25, 0.08]} radius={0.03}>
          <meshStandardMaterial color="#e8d8c3" roughness={0.8} />
        </RoundedBox>
        <mesh position={[0, 0, 0.05]}>
          <planeGeometry args={[0.95, 1.05]} />
          <meshBasicMaterial color={S.windowPane} toneMapped={false} />
        </mesh>
        <mesh position={[0.22, 0.28, 0.06]}>
          <circleGeometry args={[0.13, 24]} />
          <meshBasicMaterial color={S.moon} toneMapped={false} />
        </mesh>
        {Array.from({ length: 8 }, (_, i) => (
          <mesh key={i} position={[(Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.9, 0.06]}>
            <circleGeometry args={[0.012, 6]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        ))}
        <mesh position={[0, 0, 0.052]}>
          <boxGeometry args={[0.95, 0.04, 0.012]} />
          <meshStandardMaterial color="#e8d8c3" />
        </mesh>
        <mesh position={[0, 0, 0.052]}>
          <boxGeometry args={[0.04, 1.05, 0.012]} />
          <meshStandardMaterial color="#e8d8c3" />
        </mesh>
        {/* curtains */}
        <mesh position={[-0.62, 0.05, 0.06]} rotation={[0, 0, 0.06]}>
          <boxGeometry args={[0.16, 1.5, 0.02]} />
          <meshStandardMaterial color={S.curtain} roughness={0.95} />
        </mesh>
        <mesh position={[0.62, 0.05, 0.06]} rotation={[0, 0, -0.06]}>
          <boxGeometry args={[0.16, 1.5, 0.02]} />
          <meshStandardMaterial color={S.curtain} roughness={0.95} />
        </mesh>
        <mesh position={[0, 0.72, 0.06]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 1.6, 8]} />
          <meshStandardMaterial color="#d4a017" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
      {/* moonlight from the window */}
      <directionalLight
        position={[-5.5, 4.5, -0.55]}
        intensity={1.15}
        color={S.moonLight}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
      />
      <directionalLight position={[5, 6, 4]} intensity={0.4} color="#ffd9a8" />
      <ambientLight intensity={0.5} color={S.ambient} />
      <SeasonExtras season={season} />
      {/* rug */}
      <mesh position={[0.55, 0.008, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.28, 40]} />
        <meshStandardMaterial color={S.rugInner} roughness={0.95} />
      </mesh>
      <mesh position={[0.55, 0.012, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.06, 1.28, 40]} />
        <meshStandardMaterial color={S.rugRing} roughness={0.95} />
      </mesh>
      <mesh position={[0.55, 0.016, 0.5]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.9, 40]} />
        <meshStandardMaterial color={S.rugMid} roughness={0.95} />
      </mesh>
      {/* desk */}
      <group position={[-0.7, 0, -1.45]}>
        <RoundedBox args={[2.3, 0.09, 0.95]} radius={0.03} position={[0, 0.9, 0]} castShadow>
          <meshStandardMaterial color="#8a5a37" roughness={0.7} />
        </RoundedBox>
        {(
          [
            [-1.05, -0.38],
            [-1.05, 0.38],
            [1.05, -0.38],
            [1.05, 0.38],
          ] as const
        ).map(([x, z], i) => (
          <mesh key={i} position={[x, 0.43, z]}>
            <boxGeometry args={[0.08, 0.86, 0.08]} />
            <meshStandardMaterial color="#6b4226" roughness={0.8} />
          </mesh>
        ))}
        {/* laptop */}
        <group position={[0.15, 0, 0.02]} rotation={[0, -0.15, 0]}>
          <RoundedBox args={[0.5, 0.03, 0.34]} radius={0.01} position={[0, 0.96, 0]}>
            <meshStandardMaterial color="#3a3f4b" roughness={0.4} />
          </RoundedBox>
          <RoundedBox
            args={[0.5, 0.34, 0.02]}
            radius={0.01}
            position={[0, 1.13, -0.16]}
            rotation={[-0.25, 0, 0]}
          >
            <meshStandardMaterial
              color="#454b58"
              roughness={0.4}
              emissive="#1f2937"
              emissiveIntensity={0.4}
            />
          </RoundedBox>
          <mesh position={[0, 1.13, -0.148]} rotation={[-0.25, 0, 0]}>
            <planeGeometry args={[0.42, 0.26]} />
            <meshBasicMaterial color="#7dd3fc" toneMapped={false} opacity={0.85} transparent />
          </mesh>
        </group>
        {/* mug */}
        <group position={[-0.55, 0, 0.12]}>
          <mesh position={[0, 1.0, 0]}>
            <cylinderGeometry args={[0.07, 0.06, 0.14, 14]} />
            <meshStandardMaterial color="#f87171" roughness={0.6} />
          </mesh>
          <mesh position={[0.09, 1.0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <torusGeometry args={[0.045, 0.012, 8, 16]} />
            <meshStandardMaterial color="#f87171" roughness={0.6} />
          </mesh>
        </group>
        {/* books */}
        {(["#f59e0b", "#3b82f6", "#22c55e"] as const).map((c, i) => (
          <RoundedBox
            key={c}
            args={[0.36, 0.05, 0.26]}
            radius={0.01}
            position={[-0.9, 0.97 + i * 0.052, 0]}
            rotation={[0, i * 0.22, 0]}
            castShadow
          >
            <meshStandardMaterial color={c} roughness={0.7} />
          </RoundedBox>
        ))}
        {has("lamp") && (
          <Clickable id="lamp" position={[-1.35, 0.945, 0]} onStow={onStow}>
            <DeskLamp />
          </Clickable>
        )}
      </group>
      {/* chair */}
      <group position={[-0.7, 0, -0.62]}>
        <RoundedBox args={[0.52, 0.08, 0.5]} radius={0.03} position={[0, 0.46, 0]} castShadow>
          <meshStandardMaterial color="#52525b" roughness={0.7} />
        </RoundedBox>
        <RoundedBox
          args={[0.52, 0.5, 0.07]}
          radius={0.03}
          position={[0, 0.72, -0.22]}
          rotation={[-0.12, 0, 0]}
          castShadow
        >
          <meshStandardMaterial color="#52525b" roughness={0.7} />
        </RoundedBox>
        <mesh position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.42, 10]} />
          <meshStandardMaterial color="#3f3f46" roughness={0.6} />
        </mesh>
      </group>
      <PetSprite emoji={petEmoji} />
      {has("plant") && (
        <Clickable id="plant" position={[2.65, 0, -1.55]} onStow={onStow}>
          <Plant />
        </Clickable>
      )}
      {has("teddy") && (
        <Clickable id="teddy" position={[2.0, 0.03, -0.45]} onStow={onStow}>
          <Teddy />
        </Clickable>
      )}
      {has("shelf") && (
        <Clickable
          id="shelf"
          position={[2.35, 1.85, BACK_Z + 0.18]}
          onStow={onStow}
          onClick={onShelfClick}
        >
          <WallShelf />
        </Clickable>
      )}
      {has("poster") && (
        <Clickable id="poster" position={[-2.6, 1.7, BACK_Z + 0.075]} onStow={onStow}>
          <RoundedBox args={[0.78, 0.98, 0.03]} radius={0.01}>
            <meshStandardMaterial color="#5b4636" roughness={0.8} />
          </RoundedBox>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.68, 0.88]} />
            <meshStandardMaterial map={posterTex} roughness={0.85} />
          </mesh>
        </Clickable>
      )}
      {has("galaxy") && (
        <Clickable id="galaxy" position={[-0.75, 2.05, BACK_Z + 0.075]} onStow={onStow}>
          <RoundedBox args={[0.7, 1.0, 0.03]} radius={0.01}>
            <meshStandardMaterial color="#1c1145" roughness={0.7} />
          </RoundedBox>
          <mesh position={[0, 0, 0.02]}>
            <planeGeometry args={[0.6, 0.9]} />
            <meshBasicMaterial map={galaxyTex} toneMapped={false} />
          </mesh>
          <Sparkles count={8} scale={[0.6, 0.9, 0.1]} size={2} speed={0.25} color="#e9d5ff" />
        </Clickable>
      )}
      {has("starClock") && (
        <Clickable id="starClock" position={[1.05, 1.9, BACK_Z + 0.075]} onStow={onStow}>
          <StarClock />
        </Clickable>
      )}
      {has("fairy") && (
        <Clickable id="fairy" position={[0, 2.32, BACK_Z + 0.1]} onStow={onStow}>
          <FairyLights />
        </Clickable>
      )}
      <Sparkles
        count={26}
        scale={[5.5, 2.2, 3.5]}
        position={[0, 1.2, -0.3]}
        size={1.6}
        speed={0.22}
        color="#dbeafe"
      />
      <ContactShadows
        position={[0, 0.011, 0]}
        scale={13}
        blur={2.6}
        opacity={0.38}
        far={3}
        resolution={512}
        color="#20130a"
      />
    </group>
  );
}

/* ---------- wiring ---------- */

function Clickable({
  id,
  position,
  children,
  onStow,
  onClick,
}: {
  id: DecorId;
  position: [number, number, number];
  children: ReactNode;
  onStow: (id: DecorId) => void;
  onClick?: (() => void) | undefined;
}) {
  const [hover, setHover] = useState(false);
  return (
    <group
      position={position}
      scale={hover ? 1.09 : 1}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
        else onStow(id);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "auto";
      }}
    >
      {children}
    </group>
  );
}

/** Emoji fallback when WebGL is unavailable. */
function EmojiFallback({ decor, onStow }: { decor: DecorId[]; onStow: (id: DecorId) => void }) {
  return (
    <div className="flex h-40 items-end justify-center gap-3 text-3xl">
      {decor.map((id) => (
        <button
          key={id}
          type="button"
          title={`${DECORATIONS[id].name} — bấm để cất`}
          onClick={() => onStow(id)}
          className="leading-none transition-transform hover:-translate-y-0.5"
        >
          {DECORATIONS[id].emoji}
        </button>
      ))}
    </div>
  );
}

class Boundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function StudyRoom3D({
  decor,
  onStow,
  petEmoji,
  onShelfClick,
  season = roomSeason(),
}: {
  decor: DecorId[];
  onStow: (id: DecorId) => void;
  petEmoji: string;
  onShelfClick?: () => void;
  season?: RoomSeason;
}) {
  return (
    <div className="h-48 w-full">
      <Boundary fallback={<EmojiFallback decor={decor} onStow={onStow} />}>
        <Canvas
          dpr={[1, 2]}
          shadows
          gl={{ alpha: true, antialias: true }}
          style={{ background: "transparent" }}
          orthographic
          camera={{ position: [9, 7.5, 9], zoom: 38, near: 0.1, far: 60 }}
          onCreated={({ camera }) => camera.lookAt(0, 0.75, 0)}
        >
          <Room
            decor={decor}
            onStow={onStow}
            petEmoji={petEmoji}
            onShelfClick={onShelfClick}
            season={season}
          />
        </Canvas>
      </Boundary>
    </div>
  );
}
