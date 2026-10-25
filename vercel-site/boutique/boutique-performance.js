import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Preserve moving objects and hit targets. Spatial buckets retain frustum culling.
export function batchStaticMeshes(THREE, scene, excluded, interactives) {
  scene.updateMatrixWorld(true);
  const protectedMeshes = new Set(interactives.filter(mesh => !mesh.userData.productId));
  for (const root of excluded) root.traverse(object => protectedMeshes.add(object));
  const buckets = new Map();
  let before = 0;
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    before++;
    if (protectedMeshes.has(mesh) || mesh.name || mesh.children.length || !mesh.visible || Array.isArray(mesh.material) || mesh.material.transparent) return;
    const geometry = mesh.geometry;
    if (!geometry.attributes.position || !geometry.attributes.normal || !geometry.attributes.uv) return;
    const e = mesh.matrixWorld.elements;
    const productId = mesh.userData.productId || '';
    const materialKey = productId ? [mesh.material.type, productId, mesh.material.map?.uuid || 'body'].join(':') : mesh.material.uuid;
    const key = [materialKey, mesh.castShadow, mesh.receiveShadow, Math.floor(e[12] / 5), Math.floor(e[14] / 6)].join(':');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  });
  let removed = 0, batches = 0;
  const retired = new Set();
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const parts = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
    const geometry = mergeGeometries(parts, false);
    parts.forEach(part => part.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere();
    const batch = new THREE.Mesh(geometry, meshes[0].material);
    batch.castShadow = meshes[0].castShadow; batch.receiveShadow = meshes[0].receiveShadow;
    batch.name = 'static-batch';
    if (meshes[0].userData.productId) { batch.userData.productId = meshes[0].userData.productId; interactives.push(batch); }
    scene.add(batch); batches++;
    for (const mesh of meshes) { retired.add(mesh.geometry); mesh.removeFromParent(); const index=interactives.indexOf(mesh); if(index>=0)interactives.splice(index,1); removed++; }
  }
  // A shared bottle geometry can still belong to a live object.
  scene.traverse(mesh => { if (mesh.geometry) retired.delete(mesh.geometry); });
  retired.forEach(geometry => geometry.dispose());
  return { before, after: before - removed + batches, removed, batches };
}
