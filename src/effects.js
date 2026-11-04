import * as THREE from "three";

function rand(min, max) {
  return min + Math.random() * (max - min);
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  impact(position, color = 0xffb15a, power = 1, count = 20) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const velocities = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = rand(-0.06, 0.06);
      positions[i * 3 + 1] = rand(-0.06, 0.06);
      positions[i * 3 + 2] = rand(-0.06, 0.06);
      velocities.push(
        new THREE.Vector3(rand(-1, 1), rand(-0.2, 1.15), rand(-1, 1))
          .normalize()
          .multiplyScalar(rand(0.9, 3.6) * power),
      );
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color,
      size: 0.07 * power,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.position.copy(position);
    this.scene.add(points);
    this.items.push({ type: "impact", object: points, velocities, life: 0.7, maxLife: 0.7 });
  }

  confetti(playerColors = [0xff2f38, 0xf7f2e8, 0xffc14a], count = 220) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = [];
    const palette = playerColors.map((hex) => new THREE.Color(hex));
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 3.2;
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 5.5 + Math.random() * 2.6;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
      const color = palette[(Math.random() * palette.length) | 0];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      velocities.push(new THREE.Vector3(rand(-0.4, 0.4), rand(-1.4, -0.5), rand(-0.4, 0.4)));
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(geometry, material);
    points.position.set(0, 0.57, 0);
    this.scene.add(points);
    this.items.push({ type: "confetti", object: points, velocities, life: 6, maxLife: 6 });
  }

  update(dt) {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      const pos = item.object.geometry.attributes.position;
      const drag = item.type === "impact" ? 0.9 : 1;
      for (let j = 0; j < pos.count; j++) {
        const vel = item.velocities[j];
        if (!vel) continue;
        vel.y -= (item.type === "impact" ? 7.8 : 1.7) * dt;
        vel.multiplyScalar(Math.pow(drag, dt * 60));
        pos.setXYZ(j, pos.getX(j) + vel.x * dt, pos.getY(j) + vel.y * dt, pos.getZ(j) + vel.z * dt);
      }
      pos.needsUpdate = true;
      const t = Math.max(0, item.life / item.maxLife);
      if (item.type === "impact") {
        item.object.material.opacity = t;
        item.object.material.size = 0.035 + t * 0.05;
      } else {
        item.object.material.opacity = Math.min(1, t * 2.2);
      }
      if (item.life <= 0) {
        this.scene.remove(item.object);
        item.object.geometry.dispose();
        item.object.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
