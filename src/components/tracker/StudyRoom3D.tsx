import { Component, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { DECORATIONS, type DecorId } from "@/lib/tracker/gamify";

/** Diorama study corner: an isometric mini room where owned decorations appear as real objects. */

const WOOD = "#a06b43";
const WALL = "#27506e";
const WALL_DARK = "#1d3d55";
const RUG = "#c96f4a";

function emojiTexture(emoji: string) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  g.font = "96px serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(emoji, 64, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function PetSprite({ emoji }: { emoji: string }) {
  const tex = useMemo(() => emojiTexture(emoji), [emoji]);
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current) ref.current.position.y = 0.5 + Math.sin(clock.elapsedTime * 2) * 0.045;
  });
  return (
    <mesh ref={ref} position={[0.3, 0.5, 0.6]}>
      <planeGeometry args={[0.85, 0.85]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  );
}

function Lamp() {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (light.current) light.current.intensity = 2.2 + Math.sin(clock.elapsedTime * 3) * 0.25;
  });
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.09, 0.12, 0.06, 16]} />
        <meshLambertMaterial color="#3b3b45" />
      </mesh>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
        <meshLambertMaterial color="#3b3b45" />
      </mesh>
      <mesh position={[0, 0.62, 0]}>
        <coneGeometry args={[0.16, 0.2, 20]} />
        <meshLambertMaterial color="#f5b942" emissive="#f5b942" emissiveIntensity={0.6} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 0.55, 0]}
        color="#ffcf7a"
        intensity={2.2}
        distance={3.2}
      />
    </group>
  );
}

function Plant() {
  return (
    <group>
      <mesh position={[0, 0.14, 0]}>
        <cylinderGeometry args={[0.14, 0.11, 0.28, 14]} />
        <meshLambertMaterial color="#b3552f" />
      </mesh>
      {(
        [
          [0, 0.42, 0, 0.17],
          [0.09, 0.55, 0.05, 0.12],
          [-0.09, 0.52, -0.04, 0.1],
        ] as [number, number, number, number][]
      ).map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[r, 12, 12]} />
          <meshLambertMaterial color={i === 0 ? "#2f9e44" : "#37a24a"} />
        </mesh>
      ))}
    </group>
  );
}

function Shelf() {
  const books = ["#e05252", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6"];
  return (
    <group position={[1.7, 1.35, -1.68]}>
      <mesh>
        <boxGeometry args={[1.1, 0.06, 0.22]} />
        <meshLambertMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[1.1, 0.06, 0.22]} />
        <meshLambertMaterial color={WOOD} />
      </mesh>
      {books.map((c, i) => (
        <mesh key={c} position={[-0.42 + i * 0.19, -0.16 + (i % 2) * 0.35, 0]}>
          <boxGeometry args={[0.1, 0.26, 0.16]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function Poster({ color = "#d8b4fe" }: { color?: string }) {
  return (
    <mesh position={[0, 0, 0.012]}>
      <planeGeometry args={[0.62, 0.8]} />
      <meshLambertMaterial color={color} />
    </mesh>
  );
}

function Teddy() {
  return (
    <group rotation={[0, -0.5, 0]}>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.17, 14, 14]} />
        <meshLambertMaterial color="#b07d4f" />
      </mesh>
      <mesh position={[0, 0.38, 0]}>
        <sphereGeometry args={[0.12, 14, 14]} />
        <meshLambertMaterial color="#b07d4f" />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <sphereGeometry args={[0.07, 10, 10]} />
        <meshLambertMaterial color="#d8c39a" />
      </mesh>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0.46, 0]}>
          <sphereGeometry args={[0.045, 8, 8]} />
          <meshLambertMaterial color="#b07d4f" />
        </mesh>
      ))}
    </group>
  );
}

function Fairy() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (ref.current)
      ref.current.children.forEach((m, i) => {
        const mat = (m as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.opacity = 0.55 + 0.45 * Math.abs(Math.sin(clock.elapsedTime * 2 + i));
      });
  });
  return (
    <group ref={ref} position={[-0.6, 2.1, -1.7]}>
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[i * 0.34, Math.sin(i) * 0.06, 0]}>
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshBasicMaterial color="#ffe9a3" transparent toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

function StarClock() {
  return (
    <group>
      <mesh>
        <torusGeometry args={[0.26, 0.035, 10, 32]} />
        <meshLambertMaterial color="#c084fc" emissive="#7c3aed" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.07, 0.08, 0.02]}>
        <sphereGeometry args={[0.06, 10, 10]} />
        <meshBasicMaterial color="#fef3c7" toneMapped={false} />
      </mesh>
    </group>
  );
}

function BookStack() {
  const books = ["#f59e0b", "#3b82f6", "#22c55e"];
  return (
    <group position={[0.65, 0, -1.05]}>
      {books.map((c, i) => (
        <mesh key={c} position={[0, 0.99 + i * 0.055, 0]} rotation={[0, i * 0.25, 0]}>
          <boxGeometry args={[0.34, 0.05, 0.24]} />
          <meshLambertMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function Clickable({
  id,
  position,
  rotation = [0, 0, 0],
  children,
  onStow,
}: {
  id: DecorId;
  position: [number, number, number];
  rotation?: [number, number, number];
  children: ReactNode;
  onStow: (id: DecorId) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <group
      position={position}
      rotation={rotation}
      scale={hover ? 1.12 : 1}
      onClick={(e) => {
        e.stopPropagation();
        onStow(id);
      }}
      onPointerOver={() => setHover(true)}
      onPointerOut={() => setHover(false)}
    >
      {children}
    </group>
  );
}

function Room({
  decor,
  onStow,
  petEmoji,
}: {
  decor: DecorId[];
  onStow: (id: DecorId) => void;
  petEmoji: string;
}) {
  const has = (id: DecorId) => decor.includes(id);
  return (
    <group>
      {/* floor + walls */}
      <mesh position={[0, -0.05, 0]} receiveShadow>
        <boxGeometry args={[5, 0.1, 3.5]} />
        <meshLambertMaterial color={WOOD} />
      </mesh>
      <mesh position={[0, 1.15, -1.75]}>
        <boxGeometry args={[5, 2.4, 0.08]} />
        <meshLambertMaterial color={WALL} />
      </mesh>
      <mesh position={[-2.46, 1.15, 0]}>
        <boxGeometry args={[0.08, 2.4, 3.5]} />
        <meshLambertMaterial color={WALL_DARK} />
      </mesh>
      {/* rug */}
      <mesh position={[0.3, 0.015, 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.05, 28]} />
        <meshLambertMaterial color={RUG} />
      </mesh>
      {/* desk */}
      <mesh position={[0.2, 0.9, -1.05]}>
        <boxGeometry args={[2.2, 0.08, 0.9]} />
        <meshLambertMaterial color="#7c4a2d" />
      </mesh>
      {(
        [
          [-0.75, -0.35],
          [-0.75, 0.35],
          [1.15, -0.35],
          [1.15, 0.35],
        ] as [number, number][]
      ).map(([x, z], i) => (
        <mesh key={i} position={[x + 0.2, 0.43, z - 1.05]}>
          <boxGeometry args={[0.07, 0.86, 0.07]} />
          <meshLambertMaterial color="#5d3820" />
        </mesh>
      ))}
      <BookStack />
      <PetSprite emoji={petEmoji} />
      {has("lamp") && (
        <Clickable id="lamp" position={[-0.65, 0.96, -1.0]} onStow={onStow}>
          <Lamp />
        </Clickable>
      )}
      {has("plant") && (
        <Clickable id="plant" position={[-2.0, 0, -1.15]} onStow={onStow}>
          <Plant />
        </Clickable>
      )}
      {has("shelf") && (
        <Clickable id="shelf" position={[0, 0, 0]} onStow={onStow}>
          <Shelf />
        </Clickable>
      )}
      {has("poster") && (
        <Clickable id="poster" position={[-1.6, 1.5, -1.7]} onStow={onStow}>
          <Poster />
        </Clickable>
      )}
      {has("galaxy") && (
        <Clickable id="galaxy" position={[-0.45, 1.5, -1.7]} onStow={onStow}>
          <Poster color="#4c1d95" />
          <mesh position={[0.05, 0.08, 0.014]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshBasicMaterial color="#e9d5ff" toneMapped={false} />
          </mesh>
        </Clickable>
      )}
      {has("starClock") && (
        <Clickable id="starClock" position={[0.7, 1.5, -1.66]} onStow={onStow}>
          <StarClock />
        </Clickable>
      )}
      {has("teddy") && (
        <Clickable id="teddy" position={[1.55, 0, -0.55]} onStow={onStow}>
          <Teddy />
        </Clickable>
      )}
      {has("fairy") && (
        <Clickable id="fairy" position={[0, 0, 0]} onStow={onStow}>
          <Fairy />
        </Clickable>
      )}
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 8, 4]} intensity={0.85} />
      <directionalLight position={[-6, 4, -6]} intensity={0.25} color="#9ec5ff" />
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
}: {
  decor: DecorId[];
  onStow: (id: DecorId) => void;
  petEmoji: string;
}) {
  return (
    <div className="h-44 w-full">
      <Boundary fallback={<EmojiFallback decor={decor} onStow={onStow} />}>
        <Canvas
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: true }}
          style={{ background: "transparent" }}
          orthographic
          camera={{ position: [6, 5.5, 6], zoom: 42, near: 0.1, far: 50 }}
          onCreated={({ camera }) => camera.lookAt(0, 0.6, 0)}
        >
          <Room decor={decor} onStow={onStow} petEmoji={petEmoji} />
        </Canvas>
      </Boundary>
    </div>
  );
}
